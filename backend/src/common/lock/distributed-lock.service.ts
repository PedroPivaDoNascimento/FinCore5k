import {
  Injectable,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redlock, { type Lock } from 'redlock';
import { RedisService } from '../redis/redis.service';

/**
 * Promessa com timeout em ms. Usado no lugar da opcao `signal` do
 * `redlock.acquire()` (TASK FIX 1.1): em redlock 5.0.0-beta.2 o objeto de
 * settings de `acquire` e `Partial<Settings>` (driftFactor/retryCount/...),
 * que NAO possui a propriedade `signal` — causa de TS2353 no build.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

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
    let acquired: Lock | undefined;
    try {
      // TASK FIX 1.1: `signal` removido do objeto de opcoes de `acquire`
      // (nao existe em Partial<Settings> do redlock v5). O timeout curto de
      // aquisicao de 500ms (RULES.md secao 2.3) passa a ser aplicado via
      // wrapper de promessa; o TTL/duracao do lock permanece this.ttlMs (2s).
      acquired = await withTimeout(
        this.redlock.acquire([resource], this.ttlMs),
        this.acquireTimeoutMs,
        `Timeout de aquisicao de lock (${this.acquireTimeoutMs}ms) para conta ${accountId}.`,
      );
      const lock = acquired;
      try {
        return await fn();
      } finally {
        await lock.release().catch((err) =>
          this.logger.warn(`Falha ao liberar lock ${resource}: ${err}`),
        );
      }
    } catch (err) {
      // Timeout de aquisicao: o lock pode ter sido obtido no Redis apos o
      // prazo de 500ms. NAO deletar a chave diretamente: como `acquire` pode
      // completar-se logo apos o timeout, um DEL causaria liberacao indevida
      // (risco de double-spending). O lock expira naturalmente pelo TTL (2s).
      if (!acquired && err instanceof Error && err.message.startsWith('Timeout de aquisicao')) {
        this.logger.warn(
          `Aquisicao de lock ${resource} excedeu ${this.acquireTimeoutMs}ms; ` +
            `chave sera expirada pelo TTL (${this.ttlMs}ms).`,
        );
        throw new AccountLockContentionError(accountId);
      }
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
