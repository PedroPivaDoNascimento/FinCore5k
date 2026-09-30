import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { TransactionsModule } from './transactions/transactions.module';
import { RedisModule } from './common/redis/redis.module';
import { LedgerModule } from './ledger/ledger.module';

/**
 * Modulo raiz do FinCore 5K Backend.
 *
 * TASK 2.1: Connection Pool do Mongo tunado por Pod (RULES.md secao 3.1):
 * maxPoolSize=100 / minPoolSize=20, conexao global unica reutilizada via DI.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
        // Tuning obrigatorio para 5k CCU - NUNCA recriar conexoes TCP sob carga.
        maxPoolSize: Number(config.get('MONGO_MAX_POOL_SIZE') ?? 100),
        minPoolSize: Number(config.get('MONGO_MIN_POOL_SIZE') ?? 20),
        // Transacoes ACID exigem writeConcern majority + journaling.
        writeConcern: { w: 'majority', j: true },
        readPreference: 'primary',
        serverSelectionTimeoutMS: 5_000,
        retryWrites: true,
      }),
    }),
    RedisModule,
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: Number(config.get('REDIS_PORT', 6379)),
          password: config.get('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: null, // exigido pelo BullMQ
        },
      }),
    }),
    BullModule.registerQueue({ name: 'outbox-dispatch' }),
    LedgerModule,
    TransactionsModule,
  ],
})
export class AppModule {}
