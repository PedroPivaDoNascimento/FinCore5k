import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { LockModule } from '../common/lock/lock.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

/**
 * Modulo de movimentacao financeira (TASKS 2.2 / 2.3).
 * Orquestra Idempotencia (Redis) + Redlock por conta + Ledger Append-Only ACID.
 */
@Module({
  imports: [LedgerModule, LockModule, IdempotencyModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
