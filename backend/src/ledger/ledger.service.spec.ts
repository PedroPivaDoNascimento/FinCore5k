import { Connection } from 'mongoose';
import { LedgerService, LedgerWriteInput } from './ledger.service';
import { LedgerEntrySchema } from './ledger-entry.schema';
import { OutboxEventSchema } from './outbox-event.schema';

/**
 * TASK 1.1 - Suite unitaria do LedgerEngine (append-only + saldo projetado).
 *
 * Estrategia: mocks finos de Model/Connection do Mongoose para validar o
 * CONTRATO do servico sem I/O — a integracao real ACID e coberta pela suite
 * E2E contra o Replica Set em memoria (test/app.e2e-spec.ts).
 */
describe('LedgerService (unitario)', () => {
  let ledgerModel: jest.Mocked<any>;
  let outboxModel: jest.Mocked<any>;
  let connection: jest.Mocked<Pick<Connection, 'startSession'>>;
  let session: any;
  let service: LedgerService;

  const baseInput = (over: Partial<LedgerWriteInput> = {}): LedgerWriteInput => ({
    transactionId: 'tx-1',
    accountId: 'acc-A',
    type: 'DEBIT',
    amountCents: 5_000,
    idempotencyKey: 'idem-1',
    ...over,
  });

  beforeEach(() => {
    session = {
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    connection = { startSession: jest.fn().mockResolvedValue(session) } as any;

    ledgerModel = {
      aggregate: jest.fn(),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    outboxModel = { insertOne: jest.fn().mockResolvedValue({ acknowledged: true }) };

    service = new LedgerService(connection as unknown as Connection, ledgerModel, outboxModel);
  });

  /** Helper: encadeamento aggregate().allowDiskUse()/.session().exec() */
  const mockAggregateBalance = (total: number | null) => {
    const exec = jest.fn().mockResolvedValue(total === null ? [] : [{ _id: null, total }]);
    const chain: any = { exec };
    chain.allowDiskUse = jest.fn().mockReturnValue(chain);
    chain.session = jest.fn().mockReturnValue(chain);
    ledgerModel.aggregate.mockReturnValue(chain);
    return chain;
  };

  describe('getBalanceCents - projecao do saldo append-only', () => {
    it('agrega apenas entradas COMMITTED convertendo DEBIT em subtracao', async () => {
      mockAggregateBalance(15_000);

      const balance = await service.getBalanceCents('acc-A');

      expect(balance).toBe(15_000);
      expect(ledgerModel.aggregate).toHaveBeenCalledWith([
        { $match: { account_id: 'acc-A', status: 'COMMITTED' } },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount_cents', { $multiply: ['$amount_cents', -1] }],
              },
            },
          },
        },
      ]);
    });

    it('retorna 0 quando a conta nao possui lancamentos', async () => {
      mockAggregateBalance(null);
      await expect(service.getBalanceCents('acc-vazia')).resolves.toBe(0);
    });
  });

  describe('transferWithSession - gravacao append-only em sessao ACID', () => {
    it('inicia transacao com readConcern/writeConcern majority e grava par DEBIT/CREDIT + Outbox', async () => {
      mockAggregateBalance(10_000); // saldo suficiente

      const ok = await service.transferWithSession(
        baseInput(),
        baseInput({ accountId: 'acc-B', type: 'CREDIT', idempotencyKey: 'idem-1:credit' }),
      );

      expect(ok).toBe(true);
      // RULES.md 2.2: maioria + journaling obrigatorios.
      expect(session.startTransaction).toHaveBeenCalledWith({
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority', j: true },
      });
      // Append-only: insercao de DOIS novos lancamentos, nunca update.
      expect(ledgerModel.insertMany).toHaveBeenCalledTimes(1);
      const [docs, opts] = ledgerModel.insertMany.mock.calls[0];
      expect(docs).toHaveLength(2);
      expect(docs[0]).toMatchObject({ type: 'DEBIT', account_id: 'acc-A', amount_cents: 5_000, status: 'COMMITTED' });
      expect(docs[1]).toMatchObject({ type: 'CREDIT', account_id: 'acc-B', amount_cents: 5_000, status: 'COMMITTED' });
      expect(opts).toEqual({ session });
      expect(ledgerModel.updateOne).toBeUndefined(); // NUNCA muta lancamento
      // Transactional Outbox na MESMA sessao (TASK 2.5).
      expect(outboxModel.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregate_id: 'tx-1',
          event_type: 'TX_COMMITTED',
          dispatch_status: 'PENDING',
          payload: expect.objectContaining({ amount_cents: 5_000 }),
        }),
        { session },
      );
      expect(session.commitTransaction).toHaveBeenCalledTimes(1);
      expect(session.abortTransaction).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('aborta e retorna false quando o saldo projetado ficaria negativo (zero double-spending)', async () => {
      mockAggregateBalance(3_000); // menor que o debito de 5.000

      const ok = await service.transferWithSession(
        baseInput(),
        baseInput({ accountId: 'acc-B', type: 'CREDIT', idempotencyKey: 'idem-1:credit' }),
      );

      expect(ok).toBe(false);
      expect(ledgerModel.insertMany).not.toHaveBeenCalled();
      expect(outboxModel.insertOne).not.toHaveBeenCalled();
      expect(session.abortTransaction).toHaveBeenCalledTimes(1);
      expect(session.commitTransaction).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    it('rejeita valores fracionarios (float proibido — RULES.md secao 1)', async () => {
      await expect(
        service.transferWithSession(
          baseInput({ amountCents: 50.5 as number }),
          baseInput({ accountId: 'acc-B', type: 'CREDIT' }),
        ),
      ).rejects.toThrow(/inteiro/);
      expect(connection.startSession).not.toHaveBeenCalled();
    });

    it('aborta e propaga erro quando a gravacao falha no meio da sessao', async () => {
      mockAggregateBalance(10_000);
      ledgerModel.insertMany.mockRejectedValueOnce(
        Object.assign(new Error('E11000 duplicate key error'), { code: 11000 }),
      );

      await expect(
        service.transferWithSession(
          baseInput(),
          baseInput({ accountId: 'acc-B', type: 'CREDIT', idempotencyKey: 'idem-1:credit' }),
        ),
      ).rejects.toThrow(/duplicate key/);

      expect(session.abortTransaction).toHaveBeenCalledTimes(1);
      expect(session.commitTransaction).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('Schema LedgerEntry (espele ARCHITECTURE.md 5.1)', () => {
    it('usa a colecao append-only ledger_entries sem versionKey/timestamps', () => {
      expect(LedgerEntrySchema.options.collection).toBe('ledger_entries');
      expect(LedgerEntrySchema.options.versionKey).toBe(false);
      expect(LedgerEntrySchema.options.timestamps).toBeFalsy();
      // idempotency_key: indice UNIQUE global (idempotencia L2 no banco).
      const idemPath = LedgerEntrySchema.path('idempotency_key');
      expect(idemPath.options.unique).toBe(true);
      // amount_cents obrigatorio (centavos inteiros — RULES.md secao 1).
      expect(LedgerEntrySchema.path('amount_cents')).toBeDefined();
    });
  });

  describe('Schema OutboxEvent (payload Mixed - FIX TASK 3.x)', () => {
    it('declara a colecao outbox_events com payload Mixed obrigatorioso', () => {
      expect(OutboxEventSchema.options.collection).toBe('outbox_events');
      expect(OutboxEventSchema.path('payload').instance).toBe('Mixed');
      expect(OutboxEventSchema.path('dispatch_status').options.default).toBe('PENDING');
    });
  });
});
