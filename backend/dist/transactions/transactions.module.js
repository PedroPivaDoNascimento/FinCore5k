"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const ledger_entry_schema_1 = require("../ledger/ledger-entry.schema");
const ledger_module_1 = require("../ledger/ledger.module");
const lock_module_1 = require("../common/lock/lock.module");
const idempotency_module_1 = require("../common/idempotency/idempotency.module");
const transactions_controller_1 = require("./transactions.controller");
const transactions_service_1 = require("./transactions.service");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
let TransactionsModule = class TransactionsModule {
};
exports.TransactionsModule = TransactionsModule;
exports.TransactionsModule = TransactionsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            ledger_module_1.LedgerModule,
            lock_module_1.LockModule,
            idempotency_module_1.IdempotencyModule,
            mongoose_1.MongooseModule.forFeature([{ name: ledger_entry_schema_1.LedgerEntry.name, schema: ledger_entry_schema_1.LedgerEntrySchema }]),
        ],
        controllers: [transactions_controller_1.TransactionsController],
        providers: [transactions_service_1.TransactionsService, jwt_auth_guard_1.JwtAuthGuard],
    })
], TransactionsModule);
//# sourceMappingURL=transactions.module.js.map