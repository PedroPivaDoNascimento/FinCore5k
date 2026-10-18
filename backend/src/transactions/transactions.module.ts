import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LedgerEntry, LedgerEntrySchema } from '../ledger/ledger-entry.schema';
import { LedgerModule } from '../ledger/ledger.module';
import { LockModule } from '../common/lock/lock.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * TASK E2E 2.1 - Modulo de transacoes: controller + service + guards +
 * interceptor de idempotencia (RULES.md secao 2.1).
 */
@Module({
  imports: [
    LedgerModule,
    LockModule,
    IdempotencyModule,
    MongooseModule.forFeature([{ name: LedgerEntry.name, schema: LedgerEntrySchema }]),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, JwtAuthGuard],
})
export class TransactionsModule {}
