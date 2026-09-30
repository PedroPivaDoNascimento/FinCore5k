import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

/**
 * Fornecimento global da conexao Redis (Cluster) reutilizada por:
 * IdempotencyInterceptor, Redlock service, cache de saldo e filas BullMQ.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
