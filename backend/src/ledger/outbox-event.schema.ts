import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OutboxEventDocument = HydratedDocument<OutboxEvent>;

/**
 * TASK 2.5 - Transactional Outbox Pattern.
 * Eventos de mensageria sao gravados na MESMA sessao ACID do Ledger e
 * processados de forma assincrona pelos Worker Pods (KEDA) via BullMQ.
 * Nunca ha envio de evento fora da transacao financeira.
 */
@Schema({ collection: 'outbox_events', versionKey: false })
export class OutboxEvent {
  @Prop({ required: true })
  aggregate_id!: string; // transaction_id relacionado

  @Prop({ required: true })
  account_id!: string; // replica a shard key para co-localizacao

  @Prop({ required: true, enum: ['TX_COMMITTED', 'TX_FAILED', 'NOTIFICATION'] })
  event_type!: 'TX_COMMITTED' | 'TX_FAILED' | 'NOTIFICATION';

  /** Payload JSON serializavel do evento (webhook / e-mail / push). */
  @Prop({ required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: true, default: 'PENDING', enum: ['PENDING', 'DISPATCHED'] })
  dispatch_status!: 'PENDING' | 'DISPATCHED';

  @Prop({ required: true, default: () => new Date() })
  created_at!: Date;
}

export const OutboxEventSchema = SchemaFactory.createForClass(OutboxEvent);

OutboxEventSchema.index(
  { dispatch_status: 1, created_at: 1 },
  { name: 'idx_outbox_pending_dispatch' },
);
