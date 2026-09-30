import {
  Injectable,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redlock from 'redlock';
import { RedisService } from '../redis/redis.service';

/**
 * TASK 2.4 - Mecanismo de Redlock para retencao de race condition por conta.
 *
 * Regras (RULES.md secao 2.3):
 *  - Lock adquirido no Redis ANTES de abrir a sessao no MongoDB.
 *  - Timeout curto de aquisicao: 500ms.
 *  - TTL de execucao estrito: 2.000ms.
 * Chave de lock: account:lock:{accountId} (ARCHITECTURE.md secao 2.2).
 */
@Injectable()
export class DistributedLockService implements OnModuleInit {
  private readonly logger = new Logger(DistributedLockService.name);
  private redlock!: Redlock;

  private readonly ttlMs: number;
  private readonly acquireTimeoutMs: number;

  constructor(
    redis: RedisService,
    config: ConfigService,
  ) {
    this.ttlMs = Number(config.get('REDLOCK_TTL_MS', 2_000));
    this.acquireTimeoutMs = Number(
      config.get('REDLOCK_ACQUIRE_TIMEOUT_MS', 500),
    );
    // Redlock v5 exige array de clientes Redis (Cluster nodes em prod).
    this.redlock = new Redlock([redis.client as never], {
      driftFactor: 0.01,
      retryCount: 0, // falha rapida: sem retries alem do timeout de 500ms
      retryDelay: 50,
    });
  }

  onModuleInit(): void {
    this.redlock.on('clientError', (err: Error) =>
      this.logger.error(`Redlock client error: ${err.message}`),
    );
  }

  /**
   * Adquire o lock exclusivo da conta e executa `fn` sob sua protecao.
   * Lancara HTTP 409 (via controller) quando a conta estiver contentionada.
   */
  async withAccountLock<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    const resource = `account:lock:{${accountId}}`; // hash tag p/ Cluster slots
    try {
      const lock = await this.redlock.acquire(
        [resource],
        this.ttlMs,
        { signal: AbortSignal.timeout(this.acquireTimeoutMs) },
      );
      try {
        return await fn();
      } finally {
        await lock.release().catch((err) =>
          this.logger.warn(`Falha ao liberar lock ${resource}: ${err}`),
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'ExecutionError') {
        throw new AccountLockContentionError(accountId);
      }
      throw err;
    }
  }
}

export class AccountLockContentionError extends Error {
  constructor(public readonly accountId: string) {
    super(
      `Conta ${accountId} esta sob contencao de lock (race condition retida).`,
    );
    this.name = 'AccountLockContentionError';
  }
}
