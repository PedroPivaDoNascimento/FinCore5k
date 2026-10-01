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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var LedgerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const decimal_js_1 = __importDefault(require("decimal.js"));
const ledger_entry_schema_1 = require("./ledger-entry.schema");
const outbox_event_schema_1 = require("./outbox-event.schema");
let LedgerService = LedgerService_1 = class LedgerService {
    constructor(connection, ledgerModel, outboxModel) {
        this.connection = connection;
        this.ledgerModel = ledgerModel;
        this.outboxModel = outboxModel;
        this.logger = new common_1.Logger(LedgerService_1.name);
    }
    async getBalanceCents(accountId) {
        const result = await this.ledgerModel
            .aggregate([
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
            .allowDiskUse(false)
            .exec();
        return result[0]?.total ?? 0;
    }
    async transferWithSession(debit, credit) {
        if (!Number.isInteger(debit.amountCents) || !Number.isInteger(credit.amountCents)) {
            throw new Error('amount_cents deve ser inteiro (centavos). float/double proibido.');
        }
        const session = await this.connection.startSession();
        session.startTransaction({
            readConcern: { level: 'majority' },
            writeConcern: { w: 'majority', j: true },
        });
        try {
            const balanceBefore = await this.getBalanceCentsInSession(debit.accountId, session);
            const insufficient = new decimal_js_1.default(balanceBefore)
                .minus(debit.amountCents)
                .isNegative();
            if (insufficient) {
                await session.abortTransaction();
                return false;
            }
            await this.ledgerModel.insertMany([
                { ...this.toDoc(debit), status: 'COMMITTED' },
                { ...this.toDoc(credit), status: 'COMMITTED' },
            ], { session });
            await this.outboxModel.insertOne({
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
            }, { session });
            await session.commitTransaction();
            return true;
        }
        catch (error) {
            await session.abortTransaction();
            this.logger.error(`Transacao abortada: ${error.message}`);
            throw error;
        }
        finally {
            await session.endSession();
        }
    }
    async getBalanceCentsInSession(accountId, session) {
        const result = await this.ledgerModel
            .aggregate([
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
    toDoc(input) {
        return {
            transaction_id: input.transactionId,
            account_id: input.accountId,
            type: input.type,
            amount_cents: input.amountCents,
            idempotency_key: input.idempotencyKey,
            created_at: new Date(),
        };
    }
};
exports.LedgerService = LedgerService;
exports.LedgerService = LedgerService = LedgerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectConnection)()),
    __param(1, (0, mongoose_1.InjectModel)(ledger_entry_schema_1.LedgerEntry.name)),
    __param(2, (0, mongoose_1.InjectModel)(outbox_event_schema_1.OutboxEvent.name)),
    __metadata("design:paramtypes", [mongoose_2.Connection,
        mongoose_2.Model,
        mongoose_2.Model])
], LedgerService);
//# sourceMappingURL=ledger.service.js.map