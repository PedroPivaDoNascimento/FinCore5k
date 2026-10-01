/**
 * TASK 1.2 / 2.1 (helpers) - Redis de teste sem processo externo.
 *
 * Decisao de design: `ioredis-mock` implementa a API do ioredis (incluindo
 * `SET key value EX ttl NX`, usado pelo IdempotencyInterceptor) em memoria,
 * mantendo as suites unitarias e E2E executaveis em qualquer CI sem instalar
 * Redis. Em producao continuam os nos reais do Redis Enterprise Cluster
 * (ARCHITECTURE.md secao 3) — o mock substitui apenas a borda de teste.
 */
import IORedisMock from 'ioredis-mock';

export type MockRedisClient = InstanceType<typeof IORedisMock>;

export function createMockRedis(): MockRedisClient {
  return new IORedisMock();
}
