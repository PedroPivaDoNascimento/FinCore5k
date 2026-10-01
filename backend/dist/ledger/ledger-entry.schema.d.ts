import { HydratedDocument } from 'mongoose';
export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;
export declare class LedgerEntry {
    transaction_id: string;
    account_id: string;
    type: 'DEBIT' | 'CREDIT';
    amount_cents: number;
    idempotency_key: string;
    status: 'PENDING' | 'COMMITTED' | 'ABORTED';
    created_at: Date;
}
export declare const LedgerEntrySchema: import("mongoose").Schema<LedgerEntry, import("mongoose").Model<LedgerEntry, any, any, any, import("mongoose").Document<unknown, any, LedgerEntry, any, {}> & LedgerEntry & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, LedgerEntry, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<LedgerEntry>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<LedgerEntry> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
