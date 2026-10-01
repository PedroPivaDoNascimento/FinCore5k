# 🧠 Project Memory (Memória do Projeto e Arquivo de Decisões)

**FinCore 5K – Registro Histórico de Decisões de Arquitetura (ADR)**

| Campo | Informação |
| :--- | :--- |
| **Última Atualização** | 30 de Setembro de 2026 - 10:25 |
| **Fase Atual** | Fase 1 - Infraestrutura e Otimização do Core |
| **Status Geral** | Definição da Arquitetura para 5k CCU Concluída |

---

## 📌 Registros de Decisões de Arquitetura (ADRs)

### ADR-005 — Criação do README.md oficial do projeto (Fase 5 / TASK 5)
- **Data:** 30/09/2026
- **Status:** ✅ Aceito
- **Contexto:** O plano de implementação (TASKS_SETUP) definiu a Fase 5 como a criação de um README contendo resumo do projeto, passo a passo de execução do código-fonte e instruções de execução/extração de resultados dos testes de carga.
- **Decisão:** Criar `README.md` na raiz do repositório em português, estruturado em: visão geral + SLA/SLO, explicação das garantias de consistência (Ledger Append-Only, Redlock, sessões ACID, idempotência, Outbox, valores em centavos), diagrama de arquitetura, tabela da stack, estrutura de pastas, pré-requisitos, variáveis `.env`, passo a passo de execução (Docker para Redis/Mongo replica set local, `npm install/build/start:dev/start:prod`), exemplo de chamada com `X-Idempotency-Key`, guia completo de k6 (instalação, execução com 5.000 VUs, flags, exportação JSON/CSV e leitura de p99/thresholds) e roadmap por fases alinhado ao TASKS_SETUP.
- **Consequências:** Ponto único de entrada para onboarding de novos devs e operação local; referências cruzadas a RULES.md, ARCHITECTURE.md e GEMINI.md mantêm a documentação consistente.

## 🛠️ Histórico de Alterações (Changelog da Sessão)

### 30/09/2026 — Sessão: Fase 5 (Documentação) + Setup (Fases anteriores)

| # | Ação | Arquivos alterados/criados | Detalhes |
| :--- | :--- | :--- | :--- |
| 1 | Leitura obrigatória das diretrizes | `docs/RULES.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/PRD.md`, `docs/tasks/TASKS_SETUP(1).md` | Conformidade pré-implementation exigida pela "Observação Importante" do RULES.md |
| 2 | Scaffold do monorepo FinCore 5K | `.gitignore`, `backend/*`, `docs/*`, `infrastructure/k8s/`, `infrastructure/mongo/`, `load-tests/`, `scripts/` | Estrutura de pastas criada conforme arquitetura CQRS + Event-Driven |
| 3 | Bootstrap do backend NestJS | `backend/package.json`, `backend/tsconfig.json`, `backend/nest-cli.json` | Stack: NestJS 10 + Fastify Adapter, Mongoose 8, BullMQ, ioredis, redlock 5, decimal.js, Jest; zero dependências Express (RULES §3.2) |
| 4 | Implementação Fase 2 (parcial) | `backend/src/main.ts`, `app.module.ts`, `common/redis/*`, `common/lock/*`, `common/idempotency/*`, `ledger/*` | TASK 2.1 (Fastify + pool tuning), 2.2 (interceptor idempotência), 2.3 (Ledger Append-Only + Outbox schemas), 2.4 (Redlock service) |
| 5 | Instalação de dependências | `backend/node_modules/`, `backend/package-lock.json` | `npm install` executado com sucesso (log em `backend/npm-install.log`) |
| 6 | **Criação do README.md (TASK Fase 5)** | `README.md` (raiz) | Resumo do produto, SLA/SLO, arquitetura, pré-requisitos, `.env`, passo a passo de execução do fonte, guia de testes de carga k6 (5k VUs) e extração de resultados, roadmap de fases |
| 7 | **Fix OutboxEvent.payload (TASKS_FIX-OUTBOXEVENT.PAYLOAD 1.1/2.1)** | `backend/src/ledger/outbox-event.schema.ts` | Importação de `Schema as MongooseSchema` do pacote `mongoose` + tipo explícito `@Prop({ type: MongooseSchema.Types.Mixed, required: true })` no campo `payload`, eliminando o `CannotDetermineTypeError` (`Record<string, unknown>` é irresolvível via `emitDecoratorMetadata`) |
| 8 | Validação Schema + Build + Runtime (TASKS 3.1/4.1) | — | `nest build` sem erros; ambiente local provisionado (MongoDB 7.0 replica set `rs0` + Redis 7.2); `npm run start:dev` subiu a aplicação (Fastify em `0.0.0.0:3000`) e rodou >90s sem ERROR/Exception; paths do schema confirmados (`payload` = `Mixed`) com teste real de insert/find em `outbox_events` |

### Observações Relevantes
- `backend/src/app.module.ts` referencia `./transactions/transactions.module`, módulo ainda não implementado — necessário concluir as TASKS 2.2/2.3 (controller/service de transações) antes do primeiro `npm run build` sem erros.
- Transações multi-documento ACID no MongoDB **exigem replica set**; o README orienta o `rs.initiate()` para ambiente local via Docker.
- Os diretórios `load-tests/` e `scripts/` estão reservados para as Tasks 4.1–4.3 (script k6 `peak-5000-vus.js` e validador de consistência do ledger); o README já documenta os comandos esperados para quando forem criados.
- Frontend Next.js (Fase 3) ainda não existe no repositório; seção correspondente no README está marcada como "em construção".
- Conforme RULES.md, os status das tasks no `TASKS_SETUP(1).md` foram atualizados (Fase 2 → Em andamento; Fase 5 → Concluída).


## 🟢 Status dos Ingressos e Dependências de Infraestrutura
