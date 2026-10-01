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
exports.TransactionsController = void 0;
const common_1 = require("@nestjs/common");
const idempotency_interceptor_1 = require("../common/idempotency/idempotency.interceptor");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const create_transfer_dto_1 = require("./dto/create-transfer.dto");
const transactions_service_1 = require("./transactions.service");
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let TransactionsController = class TransactionsController {
    constructor(transactionsService) {
        this.transactionsService = transactionsService;
    }
    async transfer(dto, idempotencyKey) {
        this.assertIdempotencyKey(idempotencyKey);
        return this.transactionsService.transfer(dto, idempotencyKey);
    }
    async deposit(accountId, amountInCents, idempotencyKey) {
        this.assertIdempotencyKey(idempotencyKey);
        await this.transactionsService.deposit(accountId, Number(amountInCents), idempotencyKey);
        return { status: 'COMMITTED', accountId, amountCents: Number(amountInCents) };
    }
    async balance(accountId) {
        const balanceCents = await this.transactionsService.getBalance(accountId);
        return { accountId, balanceCents };
    }
    assertIdempotencyKey(key) {
        if (!key || !UUID_V4_RE.test(key.trim())) {
            throw new common_1.UnauthorizedException('Header X-Idempotency-Key obrigatorio e deve ser um UUID valido.');
        }
    }
};
exports.TransactionsController = TransactionsController;
__decorate([
    (0, common_1.Post)('transfer'),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_transfer_dto_1.CreateTransferDto, String]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "transfer", null);
__decorate([
    (0, common_1.Post)('deposit'),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_1.Body)('accountId')),
    __param(1, (0, common_1.Body)('amountInCents')),
    __param(2, (0, common_1.Headers)('x-idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, String]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "deposit", null);
__decorate([
    (0, common_1.Get)('balance/:accountId'),
    __param(0, (0, common_1.Param)('accountId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "balance", null);
exports.TransactionsController = TransactionsController = __decorate([
    (0, common_1.Controller)('transactions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.UseInterceptors)(idempotency_interceptor_1.IdempotencyInterceptor),
    __metadata("design:paramtypes", [transactions_service_1.TransactionsService])
], TransactionsController);
//# sourceMappingURL=transactions.controller.js.map