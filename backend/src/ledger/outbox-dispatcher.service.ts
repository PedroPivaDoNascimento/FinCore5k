import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Queue } from 'bullmq';
import { OutboxEvent } from './outbox-event.schema';

/**
 * TASK 1.3 - Despacho do Transactional Outbox Pattern (TASK 2.5 original).
 *
 * O evento e gravado na MESMA transacao ACID do ledger (LedgerService); este
 * servico faz a ponte at-least-once com o BullMQ:
 *   1. varre `dispatch_status: PENDING` em lotes (tailable por indice
 *      `idx_outbox_pending_dispatch`);
 *   2. marca DISPATCHED ANTES de enfileirar;
 *   3. falha no enqueue devolve o evento para PENDING (retry no proximo ciclo).
 *
 * Nunca ha envio de evento fora da transacao financeira (garantia do padrao);
 * a duplicacao residual e tratada por `jobId = _id` (deduplicacao BullMQ).
 */
@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);

  constructor(
    @InjectModel(OutboxEvent.name)
    private readonly outboxModel: Model<OutboxEvent>,
    @Inject('OUTBOX_DISPATCH_QUEUE')
    private readonly dispatchQueue: Queue,
  ) {}

  async dispatchPending(batchSize = 100): Promise<number> {
    const pending = await this.outboxModel
      .find({ dispatch_status: 'PENDING' })
      .sort({ created_at: 1 })
      .limit(batchSize)
      .exec();

    let dispatched = 0;
    for (const event of pending) {
      // Marca antes de enfileirar: no pior caso o worker re-processa um
      // evento ja enviado (at-least-once), nunca perde um evento commitado.
      const claimed = await this.outboxModel.updateOne(
        { _id: event._id, dispatch_status: 'PENDING' },
        { $set: { dispatch_status: 'DISPATCHED', dispatched_at: new Date() } },
      );
      if (claimed.modifiedCount !== 1) continue; // corrida: outro worker levou

      try {
        await this.dispatchQueue.add(event.event_type, event.payload, {
          jobId: String(event._id), // idempotencia de fila
        });
        dispatched += 1;
      } catch (err) {
        // Devolve para PENDING — sera retentado no proximo ciclo.
        await this.outboxModel.updateOne(
          { _id: event._id },
          { $set: { dispatch_status: 'PENDING' } },
        );
        this.logger.error(
          `Falha ao enfileirar outbox event ${event._id}: ${(err as Error).message}`,
        );
      }
    }
    return dispatched;
  }
}
