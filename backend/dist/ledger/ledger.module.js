"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const bullmq_1 = require("@nestjs/bullmq");
const ledger_entry_schema_1 = require("./ledger-entry.schema");
const outbox_event_schema_1 = require("./outbox-event.schema");
const ledger_service_1 = require("./ledger.service");
const outbox_dispatcher_service_1 = require("./outbox-dispatcher.service");
let LedgerModule = class LedgerModule {
};
exports.LedgerModule = LedgerModule;
exports.LedgerModule = LedgerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: ledger_entry_schema_1.LedgerEntry.name, schema: ledger_entry_schema_1.LedgerEntrySchema },
                { name: outbox_event_schema_1.OutboxEvent.name, schema: outbox_event_schema_1.OutboxEventSchema },
            ]),
        ],
        providers: [
            ledger_service_1.LedgerService,
            outbox_dispatcher_service_1.OutboxDispatcherService,
            { provide: 'OUTBOX_DISPATCH_QUEUE', useFactory: (q) => q, inject: [(0, bullmq_1.getQueueToken)('outbox-dispatch')] },
        ],
        exports: [ledger_service_1.LedgerService, outbox_dispatcher_service_1.OutboxDispatcherService],
    })
], LedgerModule);
//# sourceMappingURL=ledger.module.js.map