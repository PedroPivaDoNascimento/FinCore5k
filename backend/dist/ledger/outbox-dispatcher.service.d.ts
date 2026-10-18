import { Model } from 'mongoose';
import { Queue } from 'bullmq';
import { OutboxEvent } from './outbox-event.schema';
export declare class OutboxDispatcherService {
    private readonly outboxModel;
    private readonly dispatchQueue;
    private readonly logger;
    constructor(outboxModel: Model<OutboxEvent>, dispatchQueue: Queue);
    dispatchPending(batchSize?: number): Promise<number>;
}
