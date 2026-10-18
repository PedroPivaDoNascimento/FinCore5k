# Plano de Correção do Ambiente E2E – Injeção de Dependências do BullMQ

**FinCore 5K – Resolução de Erro de Injeção da Fila Outbox no Contexto de Testes E2E**

---

## 📊 Métricas e Progresso Geral

* **Total de Tarefas:** 3
* **Concluídas:** 0 (0%)
* **Em Andamento:** 0 (0%)
* **Pendentes:** 3 (100%)

---

## 📦 Fase 1: Correção de Injeção de Provedores BullMQ em Testes E2E
Ajuste do setup de testes E2E (`test/app.e2e-spec.ts`) para prover corretamente a fila do BullMQ (`outbox-dispatch`) ou mockar o `BullModule` no contexto de compilação do NestJS.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | Atualizar o arquivo `test/app.e2e-spec.ts` para registrar o `BullModule.forRoot()` (ou utilizar um mock para a fila `outbox-dispatch`) dentro das importações do módulo de teste | Backend / QA | Crítica | 🔴 Pendente |
| 1.2 | Validar se o `LedgerModule` ou o `OutboxDispatcherService` possui a importação correta do `BullModule.registerQueue({ name: 'outbox-dispatch' })` compartilhada com o ambiente de testes | Backend / QA | Alta | 🔴 Pendente |
| 1.3 | Executar a suíte de testes E2E (`npm run test:e2e`) e confirmar a aprovação de todos os cenários (HTTP 201, 409, 422, 400 e 401) sem falhas de injeção | Backend / QA | Crítica | 🔴 Pendente |

---

## ✅ Evidências da Execução e Comandos de Validação

| Categoria | Comando | Meta Esperada / Parâmetros |
| :--- | :--- | :--- |
| **Testes E2E** | `cd backend && npm run test:e2e` | `Test Suites: 1 passed, 1 total` (10 testes validados com sucesso) |
| **Detecção de Handles** | `cd backend && npx jest --config ./test/jest-e2e.json --detectOpenHandles` | Garantir o encerramento correto de conexões assíncronas (Redis/Mongo) após o término dos testes |