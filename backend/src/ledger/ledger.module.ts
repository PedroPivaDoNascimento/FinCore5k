import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { LedgerEntry, LedgerEntrySchema } from './ledger-entry.schema';
import { OutboxEvent, OutboxEventSchema } from './outbox-event.schema';
import { LedgerService } from './ledger.service';
import { OutboxDispatcherService } from './outbox-dispatcher.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: OutboxEvent.name, schema: OutboxEventSchema },
    ]),
  ],
  providers: [
    LedgerService,
    OutboxDispatcherService,
    // Injeta a fila BullMQ registrada no AppModule (BullModule.registerQueue).
    { provide: 'OUTBOX_DISPATCH_QUEUE', useFactory: (q: unknown) => q, inject: [getQueueToken('outbox-dispatch')] },
  ],
  exports: [LedgerService, OutboxDispatcherService],
})
export class LedgerModule {}
