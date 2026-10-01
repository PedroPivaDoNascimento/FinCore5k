"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var OutboxDispatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const bullmq_1 = require("bullmq");
const outbox_event_schema_1 = require("./outbox-event.schema");
let OutboxDispatcherService = OutboxDispatcherService_1 = class OutboxDispatcherService {
    constructor(outboxModel, dispatchQueue) {
        this.outboxModel = outboxModel;
        this.dispatchQueue = dispatchQueue;
        this.logger = new common_1.Logger(OutboxDispatcherService_1.name);
    }
    async dispatchPending(batchSize = 100) {
        const pending = await this.outboxModel
            .find({ dispatch_status: 'PENDING' })
            .sort({ created_at: 1 })
            .limit(batchSize)
            .exec();
        let dispatched = 0;
        for (const event of pending) {
            const claimed = await this.outboxModel.updateOne({ _id: event._id, dispatch_status: 'PENDING' }, { $set: { dispatch_status: 'DISPATCHED', dispatched_at: new Date() } });
            if (claimed.modifiedCount !== 1)
                continue;
            try {
                await this.dispatchQueue.add(event.event_type, event.payload, {
                    jobId: String(event._id),
                });
                dispatched += 1;
            }
            catch (err) {
                await this.outboxModel.updateOne({ _id: event._id }, { $set: { dispatch_status: 'PENDING' } });
                this.logger.error(`Falha ao enfileirar outbox event ${event._id}: ${err.message}`);
            }
        }
        return dispatched;
    }
};
exports.OutboxDispatcherService = OutboxDispatcherService;
exports.OutboxDispatcherService = OutboxDispatcherService = OutboxDispatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(outbox_event_schema_1.OutboxEvent.name)),
    __param(1, (0, common_1.Inject)('OUTBOX_DISPATCH_QUEUE')),
    __metadata("design:paramtypes", [mongoose_2.Model,
        bullmq_1.Queue])
], OutboxDispatcherService);
//# sourceMappingURL=outbox-dispatcher.service.js.map