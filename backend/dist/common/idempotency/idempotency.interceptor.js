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
exports.IdempotencyInterceptor = exports.IDEMPOTENT_KEY_TTL_SECONDS = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rxjs_1 = require("rxjs");
const redis_service_1 = require("../redis/redis.service");
exports.IDEMPOTENT_KEY_TTL_SECONDS = 60 * 60 * 24;
let IdempotencyInterceptor = class IdempotencyInterceptor {
    constructor(redisService, reflector) {
        this.redisService = redisService;
        this.reflector = reflector;
    }
    async intercept(context, next) {
        const isRpc = context.getType() !== 'http';
        if (isRpc)
            return next.handle();
        const request = context.switchToHttp().getRequest();
        const key = request.headers['x-idempotency-key'] ?? request.headers['X-Idempotency-Key'];
        if (!key || key.trim().length === 0) {
            throw new common_1.HttpException('Header X-Idempotency-Key e obrigatorio para movimentacao financeira.', common_1.HttpStatus.BAD_REQUEST);
        }
        const redisKey = `idempotency:${key}`;
        const client = this.redisService.client;
        const acquired = await client.set(redisKey, JSON.stringify({ status: 'PROCESSING' }), 'EX', exports.IDEMPOTENT_KEY_TTL_SECONDS, 'NX');
        if (!acquired) {
            const raw = await client.get(redisKey);
            const record = raw
                ? JSON.parse(raw)
                : null;
            if (record?.status === 'COMPLETED') {
                return of(record.body);
            }
            throw new common_1.HttpException('Chave idempotente duplicada: transacao em processamento.', common_1.HttpStatus.CONFLICT);
        }
        return next.handle().pipe((0, rxjs_1.tap)(async (body) => {
            await client.set(redisKey, JSON.stringify({ status: 'COMPLETED', body }), 'EX', exports.IDEMPOTENT_KEY_TTL_SECONDS);
        }), (0, rxjs_1.switchMap)(async (body) => body));
    }
};
exports.IdempotencyInterceptor = IdempotencyInterceptor;
exports.IdempotencyInterceptor = IdempotencyInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        core_1.Reflector])
], IdempotencyInterceptor);
function of(value) {
    return new rxjs_1.Observable((subscriber) => {
        subscriber.next(value);
        subscriber.complete();
    });
}
//# sourceMappingURL=idempotency.interceptor.js.map