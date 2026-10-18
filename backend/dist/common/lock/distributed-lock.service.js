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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var DistributedLockService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountLockContentionError = exports.DistributedLockService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redlock_1 = __importDefault(require("redlock"));
const redis_service_1 = require("../redis/redis.service");
function withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }, (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
let DistributedLockService = DistributedLockService_1 = class DistributedLockService {
    constructor(redis, config) {
        this.logger = new common_1.Logger(DistributedLockService_1.name);
        this.ttlMs = Number(config.get('REDLOCK_TTL_MS', 2_000));
        this.acquireTimeoutMs = Number(config.get('REDLOCK_ACQUIRE_TIMEOUT_MS', 500));
        this.redlock = new redlock_1.default([redis.client], {
            driftFactor: 0.01,
            retryCount: 0,
            retryDelay: 50,
        });
    }
    onModuleInit() {
        this.redlock.on('clientError', (err) => this.logger.error(`Redlock client error: ${err.message}`));
    }
    async withAccountLock(accountId, fn) {
        const resource = `account:lock:{${accountId}}`;
        let acquired;
        try {
            acquired = await withTimeout(this.redlock.acquire([resource], this.ttlMs), this.acquireTimeoutMs, `Timeout de aquisicao de lock (${this.acquireTimeoutMs}ms) para conta ${accountId}.`);
            const lock = acquired;
            try {
                return await fn();
            }
            finally {
                await lock.release().catch((err) => this.logger.warn(`Falha ao liberar lock ${resource}: ${err}`));
            }
        }
        catch (err) {
            if (!acquired && err instanceof Error && err.message.startsWith('Timeout de aquisicao')) {
                this.logger.warn(`Aquisicao de lock ${resource} excedeu ${this.acquireTimeoutMs}ms; ` +
                    `chave sera expirada pelo TTL (${this.ttlMs}ms).`);
                throw new AccountLockContentionError(accountId);
            }
            if (err instanceof Error && err.name === 'ExecutionError') {
                throw new AccountLockContentionError(accountId);
            }
            throw err;
        }
    }
};
exports.DistributedLockService = DistributedLockService;
exports.DistributedLockService = DistributedLockService = DistributedLockService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        config_1.ConfigService])
], DistributedLockService);
class AccountLockContentionError extends Error {
    constructor(accountId) {
        super(`Conta ${accountId} esta sob contencao de lock (race condition retida).`);
        this.accountId = accountId;
        this.name = 'AccountLockContentionError';
    }
}
exports.AccountLockContentionError = AccountLockContentionError;
//# sourceMappingURL=distributed-lock.service.js.map