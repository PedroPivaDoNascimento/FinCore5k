import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { RedisService } from '../redis/redis.service';
export declare const IDEMPOTENT_KEY_TTL_SECONDS: number;
export declare class IdempotencyInterceptor implements NestInterceptor {
    private readonly redisService;
    private readonly reflector;
    constructor(redisService: RedisService, reflector: Reflector);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>>;
}
