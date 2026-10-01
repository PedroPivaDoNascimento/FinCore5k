import { ConfigService } from '@nestjs/config';
import Redlock from 'redlock';
import {
  AccountLockContentionError,
  DistributedLockService,
} from './distributed-lock.service';
import { RedisService } from '../redis/redis.service';

/**
 * TASK 1.2 - Suite unitaria do RedlockService com mocks do Redis.
 * Garante os contratos da RULES.md secao 2.3: TTL 2s, timeout de aquisicao
 * 500ms, chave por conta com hash-tag e falha rapida sem retries.
 */
jest.mock('redlock');

const MockedRedlock = Redlock as unknown as jest.Mock;

describe('DistributedLockService (unitario)', () => {
  let redisClient: any;
  let config: ConfigService;
  let acquire: jest.Mock;
  let release: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    redisClient = { quit: jest.fn() };
    config = new ConfigService({
      REDLOCK_TTL_MS: '2000',
      REDLOCK_ACQUIRE_TIMEOUT_MS: '500',
    });
    release = jest.fn().mockResolvedValue(undefined);
    acquire = jest.fn().mockResolvedValue({ release });
    MockedRedlock.mockImplementation((() => ({
      acquire,
      on: jest.fn(),
    })) as unknown as jest.Mock);
  });

  function buildService(): DistributedLockService {
    const redis = { client: redisClient } as unknown as RedisService;
    return new DistributedLockService(redis, config);
  }

  it('instancia o Redlock com retryCount 0 (falha rapida, sem retries)', () => {
    buildService();
    const settings = MockedRedlock.mock.calls[0][1];
    expect(settings).toMatchObject({ driftFactor: 0.01, retryCount: 0, retryDelay: 50 });
  });

  it('adquire lock na chave com hash-tag da conta, TTL de 2s, executa fn e libera', async () => {
    const service = buildService();
    const fn = jest.fn().mockResolvedValue('ok');

    await expect(service.withAccountLock('acc-9', fn)).resolves.toBe('ok');

    expect(acquire).toHaveBeenCalledWith(['account:lock:{acc-9}'], 2_000);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('libera o lock mesmo quando a funcao critica lanca erro', async () => {
    const service = buildService();
    const boom = new Error('falha de negocio');

    await expect(
      service.withAccountLock('acc-9', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('converte timeout de aquisicao (>500ms) em AccountLockContentionError sem deletar a chave', async () => {
    // acquire nunca resolve: o timeout proprio do servico (500ms) deve disparar.
    acquire.mockImplementationOnce(() => new Promise(() => undefined));
    const service = buildService();

    await expect(
      service.withAccountLock('acc-lent', async () => 'never'),
    ).rejects.toBeInstanceOf(AccountLockContentionError);

    // Seguranca anti-double-spending: NUNCA ha DEL manual da chave;
    // a expiracao e feita pelo TTL natural do Redis (2s).
    expect(redisClient.del).toBeUndefined();
    expect(release).not.toHaveBeenCalled();
  });

  it('mapeia ExecutionError (lock ocupado) para AccountLockContentionError', async () => {
    const executionError = new Error('Experienced the following operational errors upon attempting to acquire a lock...');
    executionError.name = 'ExecutionError';
    acquire.mockRejectedValueOnce(executionError);

    const service = buildService();
    await expect(
      service.withAccountLock('acc-busy', async () => 'x'),
    ).rejects.toBeInstanceOf(AccountLockContentionError);
  });

  it('propaga erros inesperados de infraestrutura sem mascara-los', async () => {
    acquire.mockRejectedValueOnce(new Error('MISCONF Redis busy'));
    const service = buildService();
    await expect(
      service.withAccountLock('acc-x', async () => 'x'),
    ).rejects.toThrow('MISCONF Redis busy');
  });
});
