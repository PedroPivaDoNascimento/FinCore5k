import {
  Injectable,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster as RedisCluster } from 'ioredis';

/**
 * Servico global de Redis (RULES.md secao 2.1 / 2.3 e ARCHITECTURE.md secao 3).
 * Suporta modo standalone (dev) e Redis Cluster (prod) via REDIS_CLUSTER_NODES.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis | RedisCluster;

  constructor(private readonly config: ConfigService) {
    const clusterNodes = this.config.get<string>('REDIS_CLUSTER_NODES');
    if (clusterNodes) {
      // Producao: Redis Enterprise Cluster para locks/idempotencia/cache.
      this.client = new RedisCluster(
        clusterNodes.split(',').map((node) => {
          const [host, port] = node.split(':');
          return { host, port: Number(port) };
        }),
        {
          // TASK FIX 2.1: em ioredis v5, credenciais de autenticacao do
          // Cluster (AUTH) pertencem a `redisOptions` — `password` na raiz de
          // ClusterOptions nao existe e quebrava o build (TS2353).
          redisOptions: {
            password: this.config.get('REDIS_PASSWORD') || undefined,
          },
          enableReadyCheck: true,
          scaleReads: 'slave',
        },
      );
      this.logger.log('Conectado ao Redis Cluster');
    } else {
      this.client = new Redis({
        host: this.config.get('REDIS_HOST', 'localhost'),
        port: Number(this.config.get('REDIS_PORT', 6379)),
        password: this.config.get('REDIS_PASSWORD') || undefined,
        maxRetriesPerRequest: null, // exigido pelo BullMQ quando compartilhado
        keepAlive: 30_000,
      });
      this.logger.log('Conectado ao Redis standalone');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
