"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter({
        bodyLimit: 1_048_576,
        trustProxy: true,
        caseSensitive: true,
    }), { logger: ['error', 'warn', 'log'] });
    app.enableCors({
        origin: process.env.WS_CORS_ORIGIN?.split(',') ?? true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = Number(process.env.PORT ?? 3000);
    await app.listen({ port, host: '0.0.0.0' });
    logger.log(`FinCore API (Fastify) ouvindo em 0.0.0.0:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map