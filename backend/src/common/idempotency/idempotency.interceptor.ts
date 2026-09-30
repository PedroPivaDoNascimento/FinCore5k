import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, switchMap, tap } from 'rxjs';
import Redis from 'ioredis';
import { RedisService } from '../redis/redis.service';

/**
 * TASK 2.2 - Interceptor de Idempotencia com validacao via Redis Cluster.
 *
 * Regras (RULES.md secao 2.1 e PRD.md RF-1):
 *  - Header obrigatorio X-Idempotency-Key em rotas de movimentacao financeira.
 *  - Chave existente com status PROCESSING -> HTTP 409 imediato.
 *  - Chave existente com status COMPLETED  -> retorna resultado em cache.
 *  - Retencao da chave em Redis por 24 horas.
 */
export const IDEMPOTENT_KEY_TTL_SECONDS = 60 * 60 * 24; // 24h (PRD RF-1)

type IdempotencyRecord = {
  status: 'PROCESSING' | 'COMPLETED';
  body?: unknown;
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const isRpc = context.getType() !== 'http';
    if (isRpc) return next.handle();

    const request = context.switchToHttp().getRequest();
    const key: string | undefined =
      request.headers['x-idempotency-key'] ?? request.headers['X-Idempotency-Key'];

    if (!key || key.trim().length === 0) {
      throw new HttpException(
        'Header X-Idempotency-Key e obrigatorio para movimentacao financeira.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const redisKey = `idempotency:${key}`;
    const client: Redis = this.redisService.client as Redis;

    // SET NX: adquire a chave atomicamente com status PROCESSING.
    const acquired = await client.set(
      redisKey,
      JSON.stringify({ status: 'PROCESSING' } satisfies IdempotencyRecord),
      'EX',
      IDEMPOTENT_KEY_TTL_SECONDS,
      'NX',
    );

    if (!acquired) {
      const raw = await client.get(redisKey);
      const record: IdempotencyRecord | null = raw
        ? (JSON.parse(raw) as IdempotencyRecord)
        : null;

      if (record?.status === 'COMPLETED') {
        // Replay do resultado original - nunca reprocessa o debito.
        return of(record.body);
      }
      throw new HttpException(
        'Chave idempotente duplicada: transacao em processamento.',
        HttpStatus.CONFLICT, // 409
      );
    }

    return next.handle().pipe(
      tap(async (body) => {
        // Sucesso: persiste resultado COMPLETED para replays futuros.
        await client.set(
          redisKey,
          JSON.stringify({ status: 'COMPLETED', body } satisfies IdempotencyRecord),
          'EX',
          IDEMPOTENT_KEY_TTL_SECONDS,
        );
      }),
      switchMap(async (body) => body),
    );
  }
}

/** Helper para devolver replay de cache como Observable assincrono. */
function of(value: unknown): Observable<unknown> {
  return new Observable((subscriber) => {
    subscriber.next(value);
    subscriber.complete();
  });
}
