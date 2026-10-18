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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerEntrySchema = exports.LedgerEntry = void 0;
const mongoose_1 = require("@nestjs/mongoose");
let LedgerEntry = class LedgerEntry {
};
exports.LedgerEntry = LedgerEntry;
__decorate([
    (0, mongoose_1.Prop)({ required: true, index: true }),
    __metadata("design:type", String)
], LedgerEntry.prototype, "transaction_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], LedgerEntry.prototype, "account_id", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['DEBIT', 'CREDIT'] }),
    __metadata("design:type", String)
], LedgerEntry.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Number)
], LedgerEntry.prototype, "amount_cents", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], LedgerEntry.prototype, "idempotency_key", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: 'PENDING', enum: ['PENDING', 'COMMITTED', 'ABORTED'] }),
    __metadata("design:type", String)
], LedgerEntry.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, default: () => new Date() }),
    __metadata("design:type", Date)
], LedgerEntry.prototype, "created_at", void 0);
exports.LedgerEntry = LedgerEntry = __decorate([
    (0, mongoose_1.Schema)({
        collection: 'ledger_entries',
        versionKey: false,
        timestamps: false,
        minimize: false,
    })
], LedgerEntry);
exports.LedgerEntrySchema = mongoose_1.SchemaFactory.createForClass(LedgerEntry);
exports.LedgerEntrySchema.index({ account_id: 1, created_at: -1 }, { name: 'idx_account_statement' });
exports.LedgerEntrySchema.index({ transaction_id: 1 }, { name: 'idx_transaction_lookup' });
//# sourceMappingURL=ledger-entry.schema.js.map