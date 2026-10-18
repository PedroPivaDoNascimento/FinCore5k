import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster as RedisCluster } from 'ioredis';
export declare class RedisService implements OnModuleDestroy {
    private readonly config;
    private readonly logger;
    readonly client: Redis | RedisCluster;
    constructor(config: ConfigService);
    onModuleDestroy(): Promise<void>;
}
