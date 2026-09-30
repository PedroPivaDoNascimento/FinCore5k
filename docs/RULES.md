# Regras de Desenvolvimento e Padrões de Código

**FinCore 5K – Diretrizes Estruturais para Transações de Alta Performance**

--- 

## Observação Importante!!!

Antes de começar qualquer task ou alteração no código fonte, é necessário realizar a **leitura obrigatória** dos arquivos @ARCHITECTURE.md, @DESIGN.md, @PRD.md. Garantindo que a task ou a alteração do código fonte siga os requisitos abordados nesses arquivos. Além disso caso uma das tarefas presentes nos arquivos TASKS esteja em andamento ou foram concluidas durante a execução das tarefas. É necessário, após o término de todas as tasks alterar o estado da tarefa para em andamento ou concluida de acordo com o estado atual após as alterações.

## 1. Regras Absolutas de Manipulação de Dinheiro e Precisão

1. **NUNCA UTILIZE `float` OU `double` PARA VALORES MONETÁRIOS.**
   * Todos os valores monetários devem ser processados e armazenados como **inteiros representando centavos** (ex: R$ $100{,}50 \rightarrow 10050$) ou utilizando a biblioteca `decimal.js` / `BigInt`.
2. **Campos do MongoDB:**
   * Armazenar sempre como `NumberLong` (64-bit integer) ou `Decimal128`.

---

## 2. Padrões Obrigatórios de Concorrência e Transação (NestJS)

1. **Garantia de Idempotência:**
   * Toda rota do NestJS que efetua movimentação financeira DEVE utilizar o `@UseInterceptors(IdempotencyInterceptor)`.
   * Se a `X-Idempotency-Key` já existir no Redis com status `PROCESSING` ou `COMPLETED`, retornar imediatamente HTTP 409 ou o resultado em cache.

2. **MongoDB Session Management:**
   * Todas as operações que envolvem mais de uma coleção (ex: Ledger + Outbox) devem rodar dentro de uma sessão iniciada explicitamente:
     ```typescript
     const session = await this.connection.startSession();
     session.startTransaction({
       readConcern: { level: 'majority' },
       writeConcern: { w: 'majority', j: true }
     });
     try {
       // Operações financeiras append-only
       await session.commitTransaction();
     } catch (error) {
       await session.abortTransaction();
       throw error;
     } finally {
       session.endSession();
     }
     ```

3. **Uso de Distributed Locks:**
   * Para operações de conta única, adquirir sempre o lock no Redis via Redlock antes de abrir a sessão no banco de dados.
   * Definir timeout curto de aquisição ($500\text{ms}$) e TTL de execução estrito ($2.000\text{ms}$).

---

## 3. Otimização de Performance no Código Node.js / NestJS

1. **Driver do MongoDB:**
   * Reutilizar a mesma conexão global via Dependency Injection.
   * Configurar `maxPoolSize: 100` e `minPoolSize: 20` por Pod para suportar concorrência sem recriar conexões TCP.
2. **NestJS Fastify Adapter:**
   * Não utilizar middlewares ou bibliotecas dependentes do Express. Use os equivalentes nativos do Fastify.
3. **Async / Non-Blocking Execution:**
   * Evitar chamadas síncronas pesadas no evento loop. Tarefas de envio de e-mail, notificações push e Webhooks DEVEM ser empurradas para as filas do BullMQ.

---

## 4. Padrões no Frontend (Next.js)

1. **Prevencao de Cliques Duplos (UI Level):**
   * Desabilitar botões imediatamente após a submissão e gerar um `UUIDv4` para a `X-Idempotency-Key` no lado do cliente.
2. **Optimistic Updates:**
   * Atualizar a interface do usuário instantaneamente com status "Em Processamento", aguardando a confirmação via WebSocket antes de consolidar o estado visual.