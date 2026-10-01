import { HttpException, HttpStatus } from '@nestjs/common';
import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { IdempotencyInterceptor, IDEMPOTENT_KEY_TTL_SECONDS } from './idempotency.interceptor';
import { RedisService } from '../redis/redis.service';
import { createMockRedis, MockRedisClient } from '../../../test/helpers/redis-mock';

/**
 * TASK 1.2 - Suite unitaria do Interceptor de Idempotencia (X-Idempotency-Key)
 * usando mocks do Redis (ioredis-mock). Cobre RULES.md 2.1 / PRD RF-1:
 *  - chave nova  -> PROCESSING + segue o fluxo;
 *  - duplicada em PROCESSING -> HTTP 409 imediato;
 *  - duplicada COMPLETED     -> replay do corpo original (nao reprocessa);
 *  - ausente/invalida        -> HTTP 400;
 *  - TTL de retencao de 24h.
 */
describe('IdempotencyInterceptor (unitario)', () => {
  let redis: MockRedisClient;
  let interceptor: IdempotencyInterceptor;

  const httpContext = (headers: Record<string, string>) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    }) as any;

  const callHandler = (body: unknown) => ({ handle: () => of(body) }) as any;

  beforeEach(() => {
    redis = createMockRedis();
    const redisService = { client: redis } as unknown as RedisService;
    interceptor = new IdempotencyInterceptor(redisService, { get: () => [] } as any);
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  it('exige o header X-Idempotency-Key (HTTP 400 quando ausente)', async () => {
    await expect(
      interceptor.intercept(httpContext({}), callHandler({ ok: true })),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      message: expect.stringContaining('X-Idempotency-Key'),
    });
  });

  it('rejeita chave em branco com HTTP 400', async () => {
    await expect(
      interceptor.intercept(httpContext({ 'x-idempotency-key': '   ' }), callHandler({})),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('adquire a chave com SET NX EX 24h e deixa a requisicao prosseguir', async () => {
    const key = '5b8e4c3a-1d2f-4a6b-9c8d-7e6f5a4b3c2d';
    const stream = await interceptor.intercept(
      httpContext({ 'x-idempotency-key': key }),
      callHandler({ transactionId: 'tx-1' }),
    );
    const body = await firstValueFrom(stream);

    expect(body).toEqual({ transactionId: 'tx-1' });
    // Chave gravada no Redis com TTL de 24h (PRD RF-1).
    const raw = await redis.get(`idempotency:${key}`);
    expect(JSON.parse(raw!).status).toBe('COMPLETED');
    expect(await redis.ttl(`idempotency:${key}`)).toBe(IDEMPOTENT_KEY_TTL_SECONDS);
    expect(IDEMPOTENT_KEY_TTL_SECONDS).toBe(86_400);
  });

  it('retorna HTTP 409 quando a chave ja esta em PROCESSING (duplicata concorrente)', async () => {
    const key = 'k-processing';
    await redis.set(
      `idempotency:${key}`,
      JSON.stringify({ status: 'PROCESSING' }),
      'EX',
      IDEMPOTENT_KEY_TTL_SECONDS,
    );

    await expect(
      interceptor.intercept(httpContext({ 'x-idempotency-key': key }), callHandler({})),
    ).rejects.toMatchObject({
      getStatus: expect.any(Function),
      message: expect.stringContaining('duplicada'),
    });

    // Reforco numerico do status 409 (Conflict).
    await interceptor
      .intercept(httpContext({ 'x-idempotency-key': key }), callHandler({}))
      .catch((e: HttpException) => expect(e.getStatus()).toBe(HttpStatus.CONFLICT));
  });

  it('faz replay do resultado COMPLETED sem reexecutar o handler (nunca reprocessa debito)', async () => {
    const key = 'k-completed';
    const originalBody = { transactionId: 'tx-original', status: 'COMMITTED' };
    await redis.set(
      `idempotency:${key}`,
      JSON.stringify({ status: 'COMPLETED', body: originalBody }),
      'EX',
      IDEMPOTENT_KEY_TTL_SECONDS,
    );

    const handlerSpy = jest.fn(() => of({ transactionId: 'tx-NAO-DEVE-EXECUTAR' }));
    const stream = await interceptor.intercept(
      httpContext({ 'x-idempotency-key': key }),
      handlerSpy as any,
    );
    const body = await firstValueFrom(stream);

    expect(handlerSpy).not.toHaveBeenCalled();
    expect(body).toEqual(originalBody);
  });

  it('grava COMPLETED com o corpo da resposta apos sucesso do fluxo', async () => {
    const key = 'k-happy';
    const stream = await interceptor.intercept(
      httpContext({ 'x-idempotency-key': key }),
      callHandler({ status: 'COMMITTED', amountCents: 12_345 }),
    );
    await firstValueFrom(stream);

    const record = JSON.parse((await redis.get(`idempotency:${key}`))!);
    expect(record).toEqual({
      status: 'COMPLETED',
      body: { status: 'COMMITTED', amountCents: 12_345 },
    });
  });

  it('ignora contextos nao-http (WS/RPC passthrough)', async () => {
    const ctx = { getType: () => 'rpc' } as any;
    const stream = await interceptor.intercept(ctx, callHandler('passthrough'));
    await expect(firstValueFrom(stream)).resolves.toBe('passthrough');
  });
});
