import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
export type OutboxEventDocument = HydratedDocument<OutboxEvent>;
export declare class OutboxEvent {
    aggregate_id: string;
    account_id: string;
    event_type: 'TX_COMMITTED' | 'TX_FAILED' | 'NOTIFICATION';
    payload: Record<string, unknown>;
    dispatch_status: 'PENDING' | 'DISPATCHED';
    dispatched_at?: Date | null;
    created_at: Date;
}
export declare const OutboxEventSchema: MongooseSchema<OutboxEvent, import("mongoose").Model<OutboxEvent, any, any, any, import("mongoose").Document<unknown, any, OutboxEvent, any, {}> & OutboxEvent & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, OutboxEvent, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<OutboxEvent>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<OutboxEvent> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
