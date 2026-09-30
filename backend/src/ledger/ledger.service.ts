import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
// TASK FIX 3.1: `Types.ClientSession` nao existe no namespace Types do
// mongoose 8 (TS2694). `ClientSession` e exportado diretamente pelo pacote
// (alias de mongodb.ClientSession), portanto a importacao passa a ser feita
// da raiz de 'mongoose'.
import { ClientSession, Connection, Model } from 'mongoose';
import Decimal from 'decimal.js';
import { LedgerEntry, LedgerEntryDocument } from './ledger-entry.schema';
import { OutboxEvent } from './outbox-event.schema';

export interface LedgerWriteInput {
  transactionId: string;
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  /** Sempre inteiros de CENTAVOS (RULES.md secao 1). Nunca float. */
  amountCents: number;
  idempotencyKey: string;
}

/**
 * TASK 2.3 / 2.5 - Motor do Ledger Append-Only com Mongo Multi-Document Sessions
 * e Transactional Outbox na mesma transacao ACID.
 *
 * Padrao obrigatorio da RULES.md secao 2.2: sessao iniciada explicitamente com
 * readConcern majority + writeConcern { w: 'majority', j: true }, commit em try,
 * abort no catch e endSession no finally.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(LedgerEntry.name)
    private readonly ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(OutboxEvent.name)
    private readonly outboxModel: Model<import('mongoose').HydratedDocument<OutboxEvent>>,
  ) {}

  /**
   * Projecao do saldo atual somando o ledger append-only da conta.
   * Usa decimal.js para agregacao segura de centavos em lotes grandes.
   */
  async getBalanceCents(accountId: string): Promise<number> {
    const result = await this.ledgerModel
      .aggregate<{ _id: null; total: number | null }>([
        { $match: { account_id: accountId, status: 'COMMITTED' } },
        {
          $group: {
            _id: null,
            // Converte CREDIT em soma e DEBIT em subtracao ainda em inteiros.
            total: {
              $sum: {
                $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount_cents', { $multiply: ['$amount_cents', -1] }],
              },
            },
          },
        },
      ])
      .allowDiskUse(false)
      .exec();

    return result[0]?.total ?? 0;
  }

  /**
   * Grava um par de lancamentos (DEBIT origem + CREDIT destino) mais o evento
   * de Outbox DENTRO de uma unica sessao ACID multi-documento.
   * Retorna false quando a operacao e abortada (ex.: saldo insuficiente).
   */
  async transferWithSession(
    debit: LedgerWriteInput,
    credit: LedgerWriteInput,
  ): Promise<boolean> {
    if (!Number.isInteger(debit.amountCents) || !Number.isInteger(credit.amountCents)) {
      throw new Error('amount_cents deve ser inteiro (centavos). float/double proibido.');
    }

    const session = await this.connection.startSession();
    session.startTransaction({
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority', j: true },
    });

    try {
      // 1. Projecao do saldo dentro da propria sessao (consistencia forte).
      const balanceBefore = await this.getBalanceCentsInSession(debit.accountId, session);

      // 2. Regra de negocio: saldo nunca negativo (comparacao inteira exata).
      const insufficient = new Decimal(balanceBefore)
        .minus(debit.amountCents)
        .isNegative();
      if (insufficient) {
        await session.abortTransaction();
        return false;
      }

      // 3. Append-only: NUNCA atualiza documento de saldo existente.
      await this.ledgerModel.insertMany(
        [
          { ...this.toDoc(debit), status: 'COMMITTED' },
          { ...this.toDoc(credit), status: 'COMMITTED' },
        ],
        { session },
      );

      // 4. Outbox gravado na MESMA transacao (TASK 2.5) - entrega garantida.
      await this.outboxModel.insertOne(
        {
          aggregate_id: debit.transactionId,
          account_id: debit.accountId,
          event_type: 'TX_COMMITTED',
          payload: {
            transaction_id: debit.transactionId,
            from: debit.accountId,
            to: credit.accountId,
            amount_cents: debit.amountCents,
          },
          dispatch_status: 'PENDING',
          created_at: new Date(),
        },
        { session },
      );

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(`Transacao abortada: ${(error as Error).message}`);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /** Saldo projetado lido dentro da sessao corrente (read-your-writes). */
  private async getBalanceCentsInSession(
    accountId: string,
    session: ClientSession,
  ): Promise<number> {
    const result = await this.ledgerModel
      .aggregate<{ _id: null; total: number | null }>([
        { $match: { account_id: accountId, status: 'COMMITTED' } },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount_cents', { $multiply: ['$amount_cents', -1] }],
              },
            },
          },
        },
      ])
      .session(session)
      .exec();
    return result[0]?.total ?? 0;
  }

  private toDoc(input: LedgerWriteInput) {
    return {
      transaction_id: input.transactionId,
      account_id: input.accountId,
      type: input.type,
      amount_cents: input.amountCents,
      idempotency_key: input.idempotencyKey,
      created_at: new Date(),
    };
  }
}
