import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * FinCore 5K - Bootstrap do Core Financial Engine.
 *
 * TASK 2.1: Adaptador Fastify obrigatorio (RULES.md secao 3.2 - proibido
 * middlewares/bibliotecas dependentes do Express). Configuracoes de keep-alive
 * e HTTP/2 compativeis com o NGINX Ingress (ARCHITECTURE.md secao 3).
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // bodyLimit generoso para lotes de transacoes; trust proxy atras do
    // NGINX Ingress para rate-limiting correto por IP real.
    new FastifyAdapter({
      bodyLimit: 1_048_576, // 1 MiB
      trustProxy: true,
      caseSensitive: true,
    }),
    { logger: ['error', 'warn', 'log'] },
  );

  app.enableCors({
    origin: process.env.WS_CORS_ORIGIN?.split(',') ?? true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
  logger.log(`FinCore API (Fastify) ouvindo em 0.0.0.0:${port}`);
}

bootstrap();
