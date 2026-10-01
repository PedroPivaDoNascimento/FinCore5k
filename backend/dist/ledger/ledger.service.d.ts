import { Connection, Model } from 'mongoose';
import { LedgerEntryDocument } from './ledger-entry.schema';
import { OutboxEvent } from './outbox-event.schema';
export interface LedgerWriteInput {
    transactionId: string;
    accountId: string;
    type: 'DEBIT' | 'CREDIT';
    amountCents: number;
    idempotencyKey: string;
}
export declare class LedgerService {
    private readonly connection;
    private readonly ledgerModel;
    private readonly outboxModel;
    private readonly logger;
    constructor(connection: Connection, ledgerModel: Model<LedgerEntryDocument>, outboxModel: Model<import('mongoose').HydratedDocument<OutboxEvent>>);
    getBalanceCents(accountId: string): Promise<number>;
    transferWithSession(debit: LedgerWriteInput, credit: LedgerWriteInput): Promise<boolean>;
    private getBalanceCentsInSession;
    private toDoc;
}
