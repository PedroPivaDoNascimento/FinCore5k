import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;

/**
 * TASK 2.3 - Colecao `ledger_entries` (Append-Only, imutavel).
 * Espelho exato da secao 5.1 do ARCHITECTURE.md.
 *
 * REGRA ABSOLUTA (RULES.md secao 1): amount_cents e NumberLong (int64)
 * representando centavos. NUNCA float/double.
 */
@Schema({
  collection: 'ledger_entries',
  // Append-only: sem __v, sem updatedAt; documentos nunca sao mutados.
  versionKey: false,
  timestamps: false,
  minimize: false,
})
export class LedgerEntry {
  /** UUID da transacao financeira (tx_uuid_12345). */
  @Prop({ required: true, index: true })
  transaction_id!: string;

  /** Shard Key hashed: { account_id: 'hashed' } (ARCHITECTURE.md 5.2.1). */
  @Prop({ required: true })
  account_id!: string;

  @Prop({ required: true, enum: ['DEBIT', 'CREDIT'] })
  type!: 'DEBIT' | 'CREDIT';

  /** Inteiro positivo em CENTAVOS (NumberLong / long no driver). */
  @Prop({ required: true })
  amount_cents!: number;

  /** Indice UNIQUE global para bloqueio de duplicidade (idempotencia L2). */
  @Prop({ required: true, unique: true })
  idempotency_key!: string;

  @Prop({ required: true, default: 'PENDING', enum: ['PENDING', 'COMMITTED', 'ABORTED'] })
  status!: 'PENDING' | 'COMMITTED' | 'ABORTED';

  @Prop({ required: true, default: () => new Date() })
  created_at!: Date;
}

export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);

// Índices críticos (ARCHITECTURE.md seção 5.2):
// 1. Shard key hashed é criada no provisionamento do cluster (scripts/01-sharding.js).
// 2. idempotency_key único já declarado via @Prop(unique).
LedgerEntrySchema.index({ account_id: 1, created_at: -1 }, { name: 'idx_account_statement' });
LedgerEntrySchema.index({ transaction_id: 1 }, { name: 'idx_transaction_lookup' });
