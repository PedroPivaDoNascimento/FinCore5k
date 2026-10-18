import { OutboxDispatcherService } from './outbox-dispatcher.service';

/**
 * TASK 1.3 - Suite unitaria do despacho do Transactional Outbox Pattern.
 *
 * Garantias validadas (RULES.md 2.2 / ARCHITECTURE.md 2.4):
 *  - varredura PENDING ordenada por created_at com lote limitado;
 *  - claim atomico (updateOne condicional) ANTES do enqueue — at-least-once;
 *  - jobId = _id do evento (deduplicacao na fila BullMQ);
 *  - falha no enqueue devolve o evento para PENDING (retry no proximo ciclo);
 *  - corrida entre workers: quem nao claimou (modifiedCount != 1) e ignorado.
 */
describe('OutboxDispatcherService (unitario)', () => {
  let outboxModel: jest.Mocked<any>;
  let queue: { add: jest.Mock };
  let service: OutboxDispatcherService;

  const event = (over: Record<string, unknown> = {}) => ({
    _id: 'evt-1',
    event_type: 'TX_COMMITTED',
    payload: { transaction_id: 'tx-1', amount_cents: 5_000 },
    dispatch_status: 'PENDING',
    created_at: new Date(),
    ...over,
  });

  /** Encadeamento find().sort().limit().exec() */
  const mockFind = (pending: any[]) => {
    const exec = jest.fn().mockResolvedValue(pending);
    const chain: any = { sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), exec };
    outboxModel.find.mockReturnValue(chain);
    return chain;
  };

  beforeEach(() => {
    outboxModel = { find: jest.fn(), updateOne: jest.fn() };
    queue = { add: jest.fn().mockResolvedValue({}) };
    service = new OutboxDispatcherService(outboxModel, queue as any);
  });

  it('consulta apenas eventos PENDING em ordem cronologica com batch size', async () => {
    mockFind([]);
    await service.dispatchPending(50);

    expect(outboxModel.find).toHaveBeenCalledWith({ dispatch_status: 'PENDING' });
    expect(outboxModel.find.mock.results[0].value.sort).toHaveBeenCalledWith({ created_at: 1 });
    expect(outboxModel.find.mock.results[0].value.limit).toHaveBeenCalledWith(50);
  });

  it('claima DISPATCHED antes de enfileirar e usa jobId = _id (idempotencia de fila)', async () => {
    mockFind([event()]);
    outboxModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const dispatched = await service.dispatchPending();

    expect(dispatched).toBe(1);
    // Ordem: claim -> enqueue.
    expect(outboxModel.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-1', dispatch_status: 'PENDING' },
      { $set: { dispatch_status: 'DISPATCHED', dispatched_at: expect.any(Date) } },
    );
    expect(queue.add).toHaveBeenCalledWith('TX_COMMITTED', { transaction_id: 'tx-1', amount_cents: 5_000 }, { jobId: 'evt-1' });
  });

  it('devolve o evento para PENDING quando o enqueue falha (nenhuma perda)', async () => {
    mockFind([event()]);
    outboxModel.updateOne
      .mockResolvedValueOnce({ modifiedCount: 1 }) // claim OK
      .mockResolvedValueOnce({ modifiedCount: 1 }); // rollback p/ PENDING
    queue.add.mockRejectedValueOnce(new Error('Redis down'));

    const dispatched = await service.dispatchPending();

    expect(dispatched).toBe(0);
    expect(outboxModel.updateOne).toHaveBeenLastCalledWith(
      { _id: 'evt-1' },
      { $set: { dispatch_status: 'PENDING' } },
    );
  });

  it('ignora eventos perdidos em corrida de workers (modifiedCount 0)', async () => {
    mockFind([event({ _id: 'evt-race' })]);
    outboxModel.updateOne.mockResolvedValue({ modifiedCount: 0 });

    const dispatched = await service.dispatchPending();

    expect(dispatched).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('despacha um lote inteiro e conta somente os enfileirados com sucesso', async () => {
    mockFind([event({ _id: 'a' }), event({ _id: 'b' })]);
    outboxModel.updateOne
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 1 });

    await expect(service.dispatchPending()).resolves.toBe(2);
    expect(queue.add).toHaveBeenCalledTimes(2);
  });
});
