# Plano de Testes e Validação de Qualidade - NestJS & Grafana k6

**FinCore 5K – Suíte de Testes Unitários, E2E, Carga (5k CCU) e Validação de Consistência**

---

## 📊 Métricas e Progresso Geral

* **Total de Tarefas:** 11
* **Concluídas:** 0 (0%)
* **Em Andamento:** 0 (0%)
* **Pendentes:** 11 (100%)

---

## 📦 Fase 1: Suíte de Testes Unitários e Cobertura (Jest)
Implementação de testes unitários isolados para os componentes core do motor financeiro.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | Criar testes unitários para o `LedgerEngineService` cobrindo inserções append-only na coleção `ledger_entries` e cálculo de saldo projetado | Backend / QA | Alta | 🔴 Pendente |
| 1.2 | Criar testes unitários para o `RedlockService` e para o interceptor de idempotência (`X-Idempotency-Key`) utilizando mocks do Redis | Backend / QA | Alta | 🔴 Pendente |
| 1.3 | Criar testes unitários para o serviço de eventos e despacho do `Transactional Outbox Pattern` (`outbox_events`) | Backend / QA | Média | 🔴 Pendente |
| 1.4 | Configurar script de cobertura de código (`npm run test:cov`) e estabelecer thresholds de integridade no Jest | QA / DevOps | Média | 🔴 Pendente |

---

## 🛠️ Fase 2: Suíte de Testes End-to-End (E2E / Supertest)
Validação dos fluxos completos das APIs financeiras contra o Fastify Adapter e instâncias de testes do MongoDB Replica Set e Redis.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 | Configurar o ambiente de testes e2e (`test/app.e2e-spec.ts`) integrando NestJS + Fastify com banco de dados e cache | Backend / QA | Crítica | 🔴 Pendente |
| 2.2 | Implementar testes e2e para o endpoint `POST /transactions/transfer` validando respostas HTTP `201 Created` (sucesso), `409 Conflict` (idempotência duplicada) e `422 Unprocessable Entity` (saldo insuficiente) | Backend / QA | Crítica | 🔴 Pendente |
| 2.3 | Criar testes e2e para validação de autenticação Bearer JWT e sanitização de headers obrigatórios | Backend / QA | Alta | 🔴 Pendente |

---

## 🧪 Fase 3: Testes de Carga e Desempenho (Grafana k6 – 5.000 CCU)
Simulação de alta concorrência e carga de pico para verificação de SLAs/SLOs de infraestrutura e aplicação.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 3.1 | Criar/Estruturar o script de teste de carga k6 (`load-tests/peak-5000-vus.js`) configurando rampa de subida, patamar de 5.000 VUs em pico e descida | QA / DevOps | Crítica | 🔴 Pendente |
| 3.2 | Configurar thresholds no k6 para validação dos SLOs: Latência p99 < 100ms (autorização), < 50ms (saldo em cache) e taxa de falhas `http_req_failed < 0.01%` | QA / DevOps | Crítica | 🔴 Pendente |
| 3.3 | Configurar exportação automatizada de métricas em formatos JSON (`--out json=load-tests/results.json`) e CSV para relatórios históricos | DevOps / QA | Média | 🔴 Pendente |

---

## 📑 Fase 4: Validação de Consistência Financeira Pós-Carga (Ledger Engine)
Garantia de consistência estrita (Zero Double-Spending) e integridade matemática das transações gravadas no MongoDB.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 4.1 | Desenvolver/Ajustar o script de auditoria `scripts/validate-ledger-consistency.js` para validação matemática pós-carga via MongoDB URI | Backend / QA | Crítica | 🔴 Pendente |
| 4.2 | Executar a validação e confirmar a equivalência `soma(devedor) == soma(credor)` em `ledger_entries`, garantindo zero inconsistência e ausência de saldo negativo | Backend / QA | Crítica | 🔴 Pendente |

---

## ✅ Evidências da Execução e Comandos de Validação

| Categoria | Comando | Meta Esperada / Parâmetros |
| :--- | :--- | :--- |
| **Unitários** | `cd backend && npm test` | 100% dos suítes de testes unitários do NestJS aprovados |
| **Cobertura** | `cd backend && npm run test:cov` | Relatório gerado sem violação dos limites de cobertura |
| **E2E** | `cd backend && npm run test:e2e` | Todos os cenários HTTP (201, 409, 422) validados via Supertest |
| **Carga** | `k6 run --out json=load-tests/results.json load-tests/peak-5000-vus.js` | 5.000 VUs, throughput de pico (2.500–5.000 TPS) e latência p99 < 100ms |
| **Consistência**| `node scripts/validate-ledger-consistency.js --uri "$MONGO_URI"` | Relatório zerado de inconsistências e sem registros de double-spending |