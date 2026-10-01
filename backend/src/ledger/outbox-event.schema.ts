import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// TASK FIX 1.1: importa `Schema as MongooseSchema` do pacote `mongoose` para
// permitir o mapeamento EXPLICITO do tipo do campo `payload` no decorador
// @Prop() abaixo (evita o CannotDetermineTypeError de refletividade).
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

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
  // TASK FIX 2.1: tipo explicito `MongooseSchema.Types.Mixed` no @Prop().
  // Sem ele, emitDecoratorMetadata nao consegue resolver `Record<string, unknown>`
  // (type design falha em index signatures) e o NestJS/Mongoose lanca
  // "Cannot determine a type for the OutboxEvent.payload property"
  // (CannotDetermineTypeError) na inicializacao do modulo.
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
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
