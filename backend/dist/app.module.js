"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const bullmq_1 = require("@nestjs/bullmq");
const transactions_module_1 = require("./transactions/transactions.module");
const redis_module_1 = require("./common/redis/redis.module");
const ledger_module_1 = require("./ledger/ledger.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            mongoose_1.MongooseModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    uri: config.getOrThrow('MONGO_URI'),
                    maxPoolSize: Number(config.get('MONGO_MAX_POOL_SIZE') ?? 100),
                    minPoolSize: Number(config.get('MONGO_MIN_POOL_SIZE') ?? 20),
                    writeConcern: { w: 'majority', j: true },
                    readPreference: 'primary',
                    serverSelectionTimeoutMS: 5_000,
                    retryWrites: true,
                }),
            }),
            redis_module_1.RedisModule,
            bullmq_1.BullModule.forRootAsync({
                imports: [redis_module_1.RedisModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    connection: {
                        host: config.get('REDIS_HOST', 'localhost'),
                        port: Number(config.get('REDIS_PORT', 6379)),
                        password: config.get('REDIS_PASSWORD') || undefined,
                        maxRetriesPerRequest: null,
                    },
                }),
            }),
            bullmq_1.BullModule.registerQueue({ name: 'outbox-dispatch' }),
            ledger_module_1.LedgerModule,
            transactions_module_1.TransactionsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map