import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { LedgerService, LedgerWriteInput } from '../ledger/ledger.service';
import { DistributedLockService, AccountLockContentionError } from '../common/lock/distributed-lock.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

export interface TransferResult {
  transactionId: string;
  idempotencyKey: string;
  status: 'COMMITTED';
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  projectedBalanceCents: number;
  outboxEvent: 'PENDING_DISPATCH';
}

/**
 * TASK E2E 2.2 - Orquestracao da transferencia financeira.
 *
 * Ordem obrigatoria das camadas de seguranca (RULES.md secoes 2.1-2.3):
 *   1. Idempotencia (interceptor, antes de tudo) -> replay/409;
 *   2. Redlock por conta (adquirido ANTES da sessao Mongo);
 *   3. Sessao ACID multi-documento no Ledger + Outbox (LedgerService);
 *   4. Regra de negocio: saldo projetado nunca negativo -> 422.
 */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly lockService: DistributedLockService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel('LedgerEntry') private readonly ledgerModel: Model<unknown>,
  ) {}

  /** Depósito inicial (seed) — usado pelos testes e2e e pelo script de carga. */
  async deposit(accountId: string, amountCents: number, idempotencyKey: string): Promise<void> {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new HttpException('amountInCents deve ser inteiro positivo (centavos).', HttpStatus.BAD_REQUEST);
    }
    const entry: LedgerWriteInput = {
      transactionId: randomUUID(),
      accountId,
      type: 'CREDIT',
      amountCents,
      idempotencyKey,
    };
    // Ledger append-only puro: sem contrapartida, apenas credito de seed.
    await this.lockService.withAccountLock(accountId, async () => {
      const session: ClientSession = await this.connection.startSession();
      try {
        await session.startTransaction({
          readConcern: { level: 'majority' },
          writeConcern: { w: 'majority', j: true },
        });
        await this.ledgerModel.create([
          {
            transaction_id: entry.transactionId,
            account_id: entry.accountId,
            type: entry.type,
            amount_cents: entry.amountCents,
            idempotency_key: entry.idempotencyKey,
            status: 'COMMITTED',
            created_at: new Date(),
          },
        ], { session });
        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        await session.endSession();
      }
    });
  }

  async getBalance(accountId: string): Promise<number> {
    return this.ledgerService.getBalanceCents(accountId);
  }

  async transfer(dto: CreateTransferDto, idempotencyKey: string): Promise<TransferResult> {
    const { accountId, destinationAccountId, amountInCents, type } = dto;

    if (accountId === destinationAccountId) {
      throw new HttpException(
        'Conta de origem e destino nao podem ser iguais.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const transactionId = randomUUID();

    // Locks na ordem canonica (menor chave primeiro) para prevenir deadlock
    // entre transferencias A->B e B->A concorrentes.
    const [first, second] = [accountId, destinationAccountId].sort();

    let committed: boolean;
    try {
      committed = await this.lockService.withAccountLock(first, async () =>
        this.lockService.withAccountLock(second, async () => {
          const debit: LedgerWriteInput = {
            transactionId,
            accountId,
            type: 'DEBIT',
            amountCents: amountInCents,
            idempotencyKey,
          };
          const credit: LedgerWriteInput = {
            transactionId,
            accountId: destinationAccountId,
            type: 'CREDIT',
            amountCents: amountInCents,
            idempotencyKey: `${idempotencyKey}:credit`,
          };
          return this.ledgerService.transferWithSession(debit, credit);
        }),
      );
    } catch (err) {
      if (err instanceof AccountLockContentionError) {
        throw new ConflictException(
          'Conta sob contencao de lock distribuido; tente novamente.',
        );
      }
      throw err;
    }

    if (!committed) {
      // Zero double-spending: bloqueio de saldo projetado negativo.
      throw new UnprocessableEntityException({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'InsufficientFunds',
        message: 'Saldo projetado insuficiente para a movimentacao.',
        transactionId,
      });
    }

    const projectedBalanceCents = await this.ledgerService.getBalanceCents(accountId);

    return {
      transactionId,
      idempotencyKey,
      status: 'COMMITTED',
      fromAccountId: accountId,
      toAccountId: destinationAccountId,
      amountCents: amountInCents,
      projectedBalanceCents,
      outboxEvent: 'PENDING_DISPATCH',
    };
  }
}
