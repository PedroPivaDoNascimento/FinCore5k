import { Connection, Model } from 'mongoose';
import { LedgerService } from '../ledger/ledger.service';
import { DistributedLockService } from '../common/lock/distributed-lock.service';
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
export declare class TransactionsService {
    private readonly ledgerService;
    private readonly lockService;
    private readonly connection;
    private readonly ledgerModel;
    constructor(ledgerService: LedgerService, lockService: DistributedLockService, connection: Connection, ledgerModel: Model<unknown>);
    deposit(accountId: string, amountCents: number, idempotencyKey: string): Promise<void>;
    getBalance(accountId: string): Promise<number>;
    transfer(dto: CreateTransferDto, idempotencyKey: string): Promise<TransferResult>;
}
