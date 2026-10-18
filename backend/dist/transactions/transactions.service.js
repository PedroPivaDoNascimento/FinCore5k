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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const node_crypto_1 = require("node:crypto");
const ledger_service_1 = require("../ledger/ledger.service");
const distributed_lock_service_1 = require("../common/lock/distributed-lock.service");
let TransactionsService = class TransactionsService {
    constructor(ledgerService, lockService, connection, ledgerModel) {
        this.ledgerService = ledgerService;
        this.lockService = lockService;
        this.connection = connection;
        this.ledgerModel = ledgerModel;
    }
    async deposit(accountId, amountCents, idempotencyKey) {
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
            throw new common_1.HttpException('amountInCents deve ser inteiro positivo (centavos).', common_1.HttpStatus.BAD_REQUEST);
        }
        const entry = {
            transactionId: (0, node_crypto_1.randomUUID)(),
            accountId,
            type: 'CREDIT',
            amountCents,
            idempotencyKey,
        };
        await this.lockService.withAccountLock(accountId, async () => {
            const session = await this.connection.startSession();
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
            }
            catch (err) {
                await session.abortTransaction();
                throw err;
            }
            finally {
                await session.endSession();
            }
        });
    }
    async getBalance(accountId) {
        return this.ledgerService.getBalanceCents(accountId);
    }
    async transfer(dto, idempotencyKey) {
        const { accountId, destinationAccountId, amountInCents, type } = dto;
        if (accountId === destinationAccountId) {
            throw new common_1.HttpException('Conta de origem e destino nao podem ser iguais.', common_1.HttpStatus.UNPROCESSABLE_ENTITY);
        }
        const transactionId = (0, node_crypto_1.randomUUID)();
        const [first, second] = [accountId, destinationAccountId].sort();
        let committed;
        try {
            committed = await this.lockService.withAccountLock(first, async () => this.lockService.withAccountLock(second, async () => {
                const debit = {
                    transactionId,
                    accountId,
                    type: 'DEBIT',
                    amountCents: amountInCents,
                    idempotencyKey,
                };
                const credit = {
                    transactionId,
                    accountId: destinationAccountId,
                    type: 'CREDIT',
                    amountCents: amountInCents,
                    idempotencyKey: `${idempotencyKey}:credit`,
                };
                return this.ledgerService.transferWithSession(debit, credit);
            }));
        }
        catch (err) {
            if (err instanceof distributed_lock_service_1.AccountLockContentionError) {
                throw new common_1.ConflictException('Conta sob contencao de lock distribuido; tente novamente.');
            }
            throw err;
        }
        if (!committed) {
            throw new common_1.UnprocessableEntityException({
                statusCode: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
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
};
exports.TransactionsService = TransactionsService;
exports.TransactionsService = TransactionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, mongoose_1.InjectConnection)()),
    __param(3, (0, mongoose_1.InjectModel)('LedgerEntry')),
    __metadata("design:paramtypes", [ledger_service_1.LedgerService,
        distributed_lock_service_1.DistributedLockService,
        mongoose_2.Connection,
        mongoose_2.Model])
], TransactionsService);
//# sourceMappingURL=transactions.service.js.map