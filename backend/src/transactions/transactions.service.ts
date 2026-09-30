import {
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LedgerService, LedgerWriteInput } from '../ledger/ledger.service';
import {
  AccountLockContentionError,
  DistributedLockService,
} from '../common/lock/distributed-lock.service';
import { TransferDto, UUID_V4_REGEX } from './dto/transfer.dto';

export interface TransferResult {
  transactionId: string;
  status: 'COMMITTED';
  type: TransferDto['type'];
  accountId: string;
  destinationAccountId: string;
  amountCents: number;
  idempotencyKey: string;
  /** Saldo projetado da origem apos o DEBIT (centavos, inteiro). */
  balanceAfterCents: number;
}

/**
 * TASKS 2.2 / 2.3 — Orquestracao de movimentacao financeira:
 *
 *  1. A Idempotencia (X-Idempotency-Key obrigatoria, PROCESSING -> HTTP 409,
 *     COMPLETED -> replay do resultado em cache, retencao de 24h no Redis) e
 *     garantida pelo IdempotencyInterceptor aplicado na controller
 *     (RULES.md secao 2.1).
 *  2. Adquire o Redlock por conta ANTES de abrir a sessao no MongoDB (RULES 2.3).
 *  3. Delega ao LedgerService a escrita append-only DEBIT + CREDIT + Outbox dentro
 *     de uma unica sessao ACID multi-documento (RULES 2.2).
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly ledger: LedgerService,
    private readonly locks: DistributedLockService,
  ) {}

  async transfer(
    dto: TransferDto,
    idempotencyKey: string,
  ): Promise<TransferResult> {
    this.assertIdempotencyKey(idempotencyKey);

    if (dto.accountId === dto.destinationAccountId) {
      throw new UnprocessableEntityException(
        'Conta de origem e destino nao podem ser iguais.',
      );
    }

    const transactionId = randomUUID();

    // Duas linhas append-only para a MESMA transacao. O indice UNIQUE global de
    // `idempotency_key` bloqueia reprocessamento da mesma chave, entao a linha
    // de credito usa um sufixo deterministico da mesma chave idempotente.
    const debit: LedgerWriteInput = {
      transactionId,
      accountId: dto.accountId,
      type: 'DEBIT',
      amountCents: dto.amountInCents,
      idempotencyKey,
    };

    const credit: LedgerWriteInput = {
      transactionId,
      accountId: dto.destinationAccountId,
      type: 'CREDIT',
      amountCents: dto.amountInCents,
      idempotencyKey: `${idempotencyKey}:CREDIT`,
    };

    let committed: boolean;
    try {
      // Lock na conta de origem antes de abrir a sessao ACID (RULES 2.3).
      committed = await this.locks.withAccountLock(dto.accountId, () =>
        this.ledger.transferWithSession(debit, credit),
      );
    } catch (err) {
      if (err instanceof AccountLockContentionError) {
        throw new ConflictException(err.message);
      }
      throw err;
    }

    if (!committed) {
      // Regra de negocio: saldo projetado insuficiente -> bloqueio de double-spending.
      this.logger.warn(
        `Transferencia ${transactionId} recusada: saldo insuficiente (conta ${dto.accountId}).`,
      );
      throw new UnprocessableEntityException({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'INSUFFICIENT_FUNDS',
        message: 'Saldo projetado insuficiente para a movimentacao.',
        transactionId,
      });
    }

    const balanceAfterCents = await this.ledger.getBalanceCents(
      dto.accountId,
    );

    return {
      transactionId,
      status: 'COMMITTED',
      type: dto.type,
      accountId: dto.accountId,
      destinationAccountId: dto.destinationAccountId,
      amountCents: dto.amountInCents,
      idempotencyKey,
      balanceAfterCents,
    };
  }

  private assertIdempotencyKey(key: string): void {
    if (!key || !UUID_V4_REGEX.test(key.trim())) {
      throw new UnprocessableEntityException(
        'X-Idempotency-Key deve ser um UUIDv4 unico por intencao de pagamento.',
      );
    }
  }
}
