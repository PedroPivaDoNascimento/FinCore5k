import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
export declare class DistributedLockService implements OnModuleInit {
    private readonly logger;
    private redlock;
    private readonly ttlMs;
    private readonly acquireTimeoutMs;
    constructor(redis: RedisService, config: ConfigService);
    onModuleInit(): void;
    withAccountLock<T>(accountId: string, fn: () => Promise<T>): Promise<T>;
}
export declare class AccountLockContentionError extends Error {
    readonly accountId: string;
    constructor(accountId: string);
}
