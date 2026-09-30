import {
  Injectable,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster as RedisCluster } from 'ioredis';

/**
 * Nota de tipos (ioredis 5.x): o construtor de Cluster aceita opcoes de
 * conexao (password/username/tls...) aninhadas em `redisOptions` — a interface
 * `ClusterOptions` nao expoe `password` na raiz.
 */
interface RedisClusterSettings {
  redisOptions?: {
    password?: string;
    tls?: Record<string, unknown>;
  };
  enableReadyCheck?: boolean;
  scaleReads?: 'master' | 'slave';
}

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
      const clusterSettings: RedisClusterSettings = {
        // AUTH do Cluster vai aninhado em `redisOptions` (aplicado a todos os nos).
        redisOptions: {
          password: this.config.get<string>('REDIS_PASSWORD') || undefined,
        },
        enableReadyCheck: true,
        scaleReads: 'slave',
      };
      this.client = new RedisCluster(
        clusterNodes.split(',').map((node) => {
          const [host, port] = node.split(':');
          return { host, port: Number(port) };
        }),
        clusterSettings,
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
