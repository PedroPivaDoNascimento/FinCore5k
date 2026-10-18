/**
 * TASK 2.1/2.2/2.3 - Suite E2E do FinCore 5K (NestJS + Fastify).
 *
 * Ambiente real de integracao:
 *  - MongoDB: Replica Set em memoria (mongodb-memory-server 7.0.14) — unicas
 *    configuracoes que suportam as sessoes ACID multi-documento do Ledger;
 *  - Redis: ioredis-mock (SET NX EX / GET) substituindo o RedisService e a
 *    fila BullMQ, mantendo o teste hermetico em CI sem processos externos;
 *  - HTTP: adaptador Fastify real + Supertest (cenarios 201 / 409 / 422 / 401).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import * as supertest from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TransactionsModule } from '../src/transactions/transactions.module';
import { RedisModule } from '../src/common/redis/redis.module';
import { LedgerEntry, LedgerEntrySchema } from '../src/ledger/ledger-entry.schema';
import { OutboxEvent, OutboxEventSchema } from '../src/ledger/outbox-event.schema';
import { RedisService } from '../src/common/redis/redis.service';
import {
  startMemoryReplicaSet,
  getMemoryUri,
  stopMemoryReplicaSet,
} from './helpers/mongo-memory';
import { createMockRedis } from './helpers/redis-mock';
import { startTestServer } from './helpers/fastify-server';

const JWT_SECRET = 'fincore-e2e-secret';
process.env.TEST_JWT_SECRET = JWT_SECRET;

const b64u = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const bearer = (sub = 'user-e2e'): string => {
  const header = b64u({ alg: 'HS256', typ: 'JWT' });
  const payload = b64u({ sub, exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
};

const uuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

describe('FinCore API - POST /transactions/transfer (E2E)', () => {
  let app: NestFastApplicationAlias;
  let moduleRef: TestingModule;
  let baseUrl: string;
  let closeHttp: () => Promise<void>;
  let ledgerModel: Model<LedgerEntry>;
  let outboxModel: Model<OutboxEvent>;
  const redisMock = createMockRedis();

  type NestFastApplicationAlias = INestApplication;

  beforeAll(async () => {
    const replSet = await startMemoryReplicaSet();
    const mongoUri = getMemoryUri(replSet, 'fincore_e2e');

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [] }),
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: LedgerEntry.name, schema: LedgerEntrySchema },
          { name: OutboxEvent.name, schema: OutboxEventSchema },
        ]),
        // RedisModule global presente apenas para o token RedisService existir
        // no grafo de DI; o construtor NUNCA roda porque o provedor e
        // sobrescrito abaixo (overrideProvider) com o mock em memoria.
        RedisModule,
        TransactionsModule,
      ],
      providers: [
        // Fila BullMQ no-op — o contrato do outbox e exercitado via Mongo.
        {
          provide: getQueueToken('outbox-dispatch'),
          useValue: { add: async () => ({}) },
        },
      ],
    })
      .overrideProvider(RedisService)
      .useValue({ client: redisMock })
      .compile();

    app = moduleRef.createNestApplication<NestFastApplicationAlias>(
      new FastifyAdapter({ bodyLimit: 1_048_576, trustProxy: true }),
    );
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const started = await startTestServer(app);
    baseUrl = started.url;
    closeHttp = started.close;

    ledgerModel = moduleRef.get<Model<LedgerEntry>>(getModelToken(LedgerEntry.name));
    outboxModel = moduleRef.get<Model<OutboxEvent>>(getModelToken(OutboxEvent.name));
  }, 120_000);

  afterAll(async () => {
    if (closeHttp) await closeHttp();
    if (app) await app.close();
    if (moduleRef) await moduleRef.close();
    redisMock.disconnect();
    await stopMemoryReplicaSet();
  });

  beforeEach(async () => {
    await Promise.all([ledgerModel.deleteMany({}), outboxModel.deleteMany({})]);
    await redisMock.flushall();
  });

  const post = (path: string) => supertest.agent(baseUrl).post(path);
  const get = (path: string) => supertest.agent(baseUrl).get(path);

  /** Seed de saldo via endpoint idempotente de deposito. */
  async function deposit(accountId: string, amountInCents: number): Promise<void> {
    const res = await post('/transactions/deposit')
      .set('Authorization', `Bearer ${bearer()}`)
      .set('X-Idempotency-Key', uuid())
      .send({ accountId, amountInCents });
    expect(res.status).toBe(201);
  }

  describe('Cenario feliz — HTTP 201 Created', () => {
    it('transfere entre contas com saldo suficiente gravando par append-only + outbox', async () => {
      const from = 'acc-A';
      const to = 'acc-B';
      await deposit(from, 100_000); // R$ 1.000,00

      const key = uuid();
      const res = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${bearer()}`)
        .set('X-Idempotency-Key', key)
        .send({ accountId: from, destinationAccountId: to, amountInCents: 25_000, type: 'PIX' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        status: 'COMMITTED',
        fromAccountId: from,
        toAccountId: to,
        amountCents: 25_000,
        projectedBalanceCents: 75_000,
        idempotencyKey: key,
        outboxEvent: 'PENDING_DISPATCH',
      });
      expect(res.body.transactionId).toEqual(expect.any(String));

      // Ledger append-only: 1 CREDIT seed + DEBIT/CREDIT da transferencia.
      const entries = await ledgerModel.find().sort({ created_at: 1 }).exec();
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.type)).toEqual(['CREDIT', 'DEBIT', 'CREDIT']);
      expect(entries[1].idempotency_key).toBe(key);
      expect(entries[2].idempotency_key).toBe(`${key}:credit`);
      expect(entries[1].transaction_id).toBe(entries[2].transaction_id);

      // Equacao fundamental do zero double-spending: soma(CREDIT) == soma(DEBIT)+saldo.
      const balanceA = await get(`/transactions/balance/${from}`)
        .set('Authorization', `Bearer ${bearer()}`);
      const balanceB = await get(`/transactions/balance/${to}`)
        .set('Authorization', `Bearer ${bearer()}`);
      expect(balanceA.body.balanceCents).toBe(75_000);
      expect(balanceB.body.balanceCents).toBe(25_000);

      // Transactional Outbox gravado na mesma transacao ACID.
      const events = await outboxModel.find().exec();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        event_type: 'TX_COMMITTED',
        dispatch_status: 'PENDING',
        payload: { from, to, amount_cents: 25_000 },
      });
    });
  });

  describe('Idempotencia — HTTP 409 Conflict e replay 201', () => {
    it('rejeita chave duplicada em PROCESSING com 409', async () => {
      const from = 'acc-C';
      const to = 'acc-D';
      await deposit(from, 50_000);

      const key = uuid();
      // Simula requisicao concorrente ja registrada como PROCESSING no Redis.
      await redisMock.set(`idempotency:${key}`, JSON.stringify({ status: 'PROCESSING' }), 'EX', 86_400);

      const res = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${bearer()}`)
        .set('X-Idempotency-Key', key)
        .send({ accountId: from, destinationAccountId: to, amountInCents: 10_000, type: 'PIX' });

      expect(res.status).toBe(409);
      // Nenhum lancamento novo pode existir alem do seed.
      expect(await ledgerModel.countDocuments()).toBe(1);
    });

    it('repete a MESMA chave apos COMPLETED e devolve replay 201 sem dobrar o debito', async () => {
      const from = 'acc-E';
      const to = 'acc-F';
      await deposit(from, 60_000);

      const key = uuid();
      const body = { accountId: from, destinationAccountId: to, amountInCents: 20_000, type: 'PIX' };

      const first = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${bearer()}`)
        .set('X-Idempotency-Key', key)
        .send(body);
      expect(first.status).toBe(201);

      const second = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${bearer()}`)
        .set('X-Idempotency-Key', key)
        .send(body);
      // Replay do resultado original (mesmo transactionId), NUNCA reprocessa.
      expect(second.status).toBe(201);
      expect(second.body.transactionId).toBe(first.body.transactionId);

      // Zero double-spending: apenas 1 DEBIT gravado para a chave.
      const debits = await ledgerModel.find({ idempotency_key: key }).exec();
      expect(debits).toHaveLength(1);
      const bal = await get(`/transactions/balance/${from}`).set('Authorization', `Bearer ${bearer()}`);
      expect(bal.body.balanceCents).toBe(40_000);
    });
  });

  describe('Saldo insuficiente — HTTP 422 Unprocessable Entity', () => {
    it('bloqueia transferencia maior que o saldo projetado sem gravar nada', async () => {
      const from = 'acc-G';
      const to = 'acc-H';
      await deposit(from, 10_000);

      const res = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${bearer()}`)
        .set('X-Idempotency-Key', uuid())
        .send({ accountId: from, destinationAccountId: to, amountInCents: 10_001, type: 'PIX' });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('InsufficientFunds');

      // Transacao abortada: somente o seed permanece no ledger (append-only imutavel).
      expect(await ledgerModel.countDocuments()).toBe(1);
      expect(await outboxModel.countDocuments()).toBe(0);
      const bal = await get(`/transactions/balance/${from}`).set('Authorization', `Bearer ${bearer()}`);
      expect(bal.body.balanceCents).toBe(10_000);
    });

    it('rejeita origem e destino identicos com 422', async () => {
      const res = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${bearer()}`)
        .set('X-Idempotency-Key', uuid())
        .send({ accountId: 'same', destinationAccountId: 'same', amountInCents: 1, type: 'PIX' });
      expect(res.status).toBe(422);
    });
  });

  describe('Validacao de borda (DTO) — HTTP 400', () => {
    it('rejeita valor fracionario (float proibido — RULES.md secao 1)', async () => {
      const res = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${bearer()}`)
        .set('X-Idempotency-Key', uuid())
        .send({ accountId: 'a', destinationAccountId: 'b', amountInCents: 10.5, type: 'PIX' });
      expect(res.status).toBe(400);
    });

    it('rejeita campos fora do whitelist do DTO', async () => {
      const res = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${bearer()}`)
        .set('X-Idempotency-Key', uuid())
        .send({ accountId: 'a', destinationAccountId: 'b', amountInCents: 100, type: 'PIX', isAdmin: true });
      expect(res.status).toBe(400);
    });
  });

  describe('Autenticacao Bearer JWT e headers obrigatorios — HTTP 401', () => {
    it('recusa requisicao sem Authorization', async () => {
      const res = await post('/transactions/transfer')
        .set('X-Idempotency-Key', uuid())
        .send({ accountId: 'a', destinationAccountId: 'b', amountInCents: 100, type: 'PIX' });
      expect(res.status).toBe(401);
    });

    it('recusa token forjado (assinatura invalida)', async () => {
      const header = b64u({ alg: 'HS256', typ: 'JWT' });
      const payload = b64u({ sub: 'hacker', exp: Math.floor(Date.now() / 1000) + 600 });
      const res = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${header}.${payload}.Zm9yamVk`)
        .set('X-Idempotency-Key', uuid())
        .send({ accountId: 'a', destinationAccountId: 'b', amountInCents: 100, type: 'PIX' });
      expect(res.status).toBe(401);
    });

    it('recusa X-Idempotency-Key ausente ou nao-UUID', async () => {
      const missing = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${bearer()}`)
        .send({ accountId: 'a', destinationAccountId: 'b', amountInCents: 100, type: 'PIX' });
      expect(missing.status).toBe(401);

      const malformed = await post('/transactions/transfer')
        .set('Authorization', `Bearer ${bearer()}`)
        .set('X-Idempotency-Key', 'nao-e-uuid')
        .send({ accountId: 'a', destinationAccountId: 'b', amountInCents: 100, type: 'PIX' });
      expect(malformed.status).toBe(401);
    });
  });
});
