# FinCore 5K – Plataforma Financeira de Alta Volumetria Concorrente

[![Node](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20Sharded-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Cluster-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![k6](https://img.shields.io/badge/Grafana%20k6-Load%20Test-blue?logo=grafana&logoColor=white)](https://k6.io)

## 📌 Visão Geral

O **FinCore 5K** é um core financeiro de alta performance projetado para processar transações financeiras (Pix/TED, pagamentos e saques) em tempo real para **5.000 usuários simultâneos (CCU)**, com carga de escrita pesada de até **5.000 TPS em pico**.

Os compromissos de qualidade (SLA/SLO) do produto:

| Métrica | Meta |
| :--- | :--- |
| Concorrência | ≥ 5.000 usuários ativos simultâneos |
| Throughput | 2.500 a 5.000 TPS em pico |
| Latência p99 | < 100 ms (autorização) / < 50 ms (saldo em cache) |
| Disponibilidade | 99,999% |
| Consistência | **Zero Double-Spending**, ACID no extrato |

### Como a consistência é garantida sob concorrência extrema

- **Ledger Append-Only:** nenhuma atualização direta de documento de saldo (elimina o gargalo de *Hot Document* / lock contention no WiredTiger). Todo movimento gera uma nova entrada imutável na coleção `ledger_entries`.
- **Redlock (Redis Cluster):** lock distribuído por conta (`account:lock:{userId}`, TTL 2s) antes da escrita no ledger, prevenindo race conditions.
- **Transações ACID no MongoDB:** sessões multi-documento com `readConcern: majority` e `writeConcern: { w: 'majority', j: true }`, cobrindo Ledger + Outbox atomicamente.
- **Idempotência estrita:** header `X-Idempotency-Key` obrigatório em toda movimentação financeira, retido no Redis por 24h (repetição → HTTP 409 ou resultado em cache).
- **Transactional Outbox Pattern:** eventos persistidos na mesma transação ACID e despachados de forma segura via filas BullMQ aos workers.
- **Precisão monetária:** valores sempre em centavos (inteiros 64-bit) ou `decimal.js` — nunca `float`/`double`.

## 🏗️ Arquitetura

```
[ Next.js Frontend ] --(HTTP/2 / WebSocket)--> [ Cloudflare CDN / Edge ]
                                                      |
                                             [ NGINX Ingress / K8s ]
                                                      |
                                       +--------------+--------------+
                                       |                             |
                         [ NestJS API Gateway ]            [ NestJS WS Gateway ]
                          (Fastify - Stateless)             (Real-time Status)
                                       |                             |
                     +-----------------+-----------------+          |
                     |                                   |          |
              [ Redis Cluster ]                   [ NestJS Transaction ]
            (Locks, Cache, RateLimit)             (Ledger Engine Services)
                     |                                   |
                     +-----------------+-----------------+
                                       |
                           [ Mongo Atlas Sharded Cluster ]
                          (Primary / Secondary Read Preference)
                                       |
                         [ Transactional Outbox Pattern ]
                                       |
                             [ Worker Pods (KEDA) ]
```

### Stack Técnica

| Camada | Tecnologia |
| :--- | :--- |
| Frontend | Next.js 14+ (App Router), WebSockets |
| API Backend | NestJS 10 + Fastify Adapter (stateless) |
| Banco de Dados | MongoDB Atlas Sharded (shard key `account_id: hashed`, M60+) |
| Cache / Locks / Filas | Redis Cluster (Redlock, BullMQ) |
| Orquestração | Kubernetes (EKS/GKE) + NGINX Ingress + KEDA |
| Testes de Carga | Grafana k6 |

## 📂 Estrutura do Repositório

```
.
├── backend/                 # Core Financial Engine (NestJS + Fastify)
│   └── src/
│       ├── main.ts          # Bootstrap Fastify (TASK 2.1)
│       ├── app.module.ts    # Root module + pool tuning Mongo
│       ├── common/
│       │   ├── redis/          # Conexão Redis Cluster compartilhada
│       │   ├── lock/           # Redlock distribuído (TASK 2.4)
│       │   └── idempotency/    # Interceptor X-Idempotency-Key (TASK 2.2)
│       └── ledger/             # Ledger Append-Only + Outbox (TASKS 2.3 / 2.5)
├── docs/                    # PRD, ARQUITETURA, DESIGN, RULES, GEMINI e tasks/
├── infrastructure/          # Manifests K8s (k8s/) e setup Mongo (mongo/)
├── load-tests/              # Scripts Grafana k6 (5.000 VUs)
├── scripts/                 # Utilitários (seed, validação, relatórios)
└── frontend/                # Next.js (Fase 3 – em construção)
```

## ✅ Pré-requisitos

| Ferramenta | Versão mínima | Observação |
| :--- | :--- | :--- |
| Node.js | 20.x LTS | Backend (NestJS) |
| npm | 10.x | Acompanha o Node 20 |
| MongoDB | Atlas Replicaset/Sharded M60+ (ou local 7.x com replica set p/ transações) | Transações ACID exigem replica set |
| Redis | 6.x+ (Cluster mode em produção) | Locks, idempotência e filas BullMQ |
| Grafana k6 | ≥ 0.52 | Testes de carga |
| Docker + kubectl | Opcionais | Para ambiente K8s completo |

## ⚙️ Configuração de Ambiente (.env)

Crie `backend/.env` a partir das variáveis abaixo:

| Variável | Valor padrão | Descrição |
| :--- | :--- | :--- |
| `PORT` | `3000` | Porta HTTP da API (Fastify) |
| `MONGO_URI` | — (**obrigatória**) | String de conexão do Mongo Atlas (replica set/sharded) |
| `MONGO_MAX_POOL_SIZE` | `100` | Connection pool por pod (tuning 5k CCU) |
| `MONGO_MIN_POOL_SIZE` | `20` | Conexões mínimas mantidas vivas |
| `REDIS_HOST` | `localhost` | Host do Redis Cluster |
| `REDIS_PORT` | `6379` | Porta do Redis |
| `REDIS_PASSWORD` | *(vazio)* | Senha AUTH do Redis |
| `WS_CORS_ORIGIN` | `*` | Origens permitidas para WebSocket/CORS (lista separada por vírgula) |

> ⚠️ **Produção:** use TLS 1.3, `writeConcern: { w: 'majority', j: true }` (já aplicado no código) e credenciais via Secrets do Kubernetes — nunca commitar `.env`.

## 🚀 Como Executar o Projeto

### 1. Subir as dependências (dev local)

```bash
# Redis local (sem senha)
docker run -d --name fincore-redis -p 6379:6379 redis:7-alpine

# Mongo local como REPLICA SET (obrigatório para transações ACID multi-documento)
docker run -d --name fincore-mongo -p 27017:27017 mongo:7 \
  --replSet rs0 --bind_ip_all
docker exec fincore-mongo mongosh --eval \
  'rs.initiate({_id: "rs0", members: [{_id: 0, host: "localhost:27017"}]})'
```

Em produção/staging, aponte `MONGO_URI` para o cluster **Mongo Atlas Sharded (M60+)** provisionado na Fase 1.

### 2. Instalar e iniciar o Backend (NestJS + Fastify)

```bash
cd backend
npm install

# Build de verificação
npm run build

# Desenvolvimento (hot reload)
npm run start:dev

# Produção
npm run start:prod
```

A API sobe em `http://0.0.0.0:3000` com keep-alive e pool de conexões tunado para alta concorrência.

### 3. Executar os testes unitários / e2e

```bash
cd backend
npm test              # Jest (unitários)
npm run test:cov      # Unitários + cobertura
npm run test:e2e      # Testes e2e (supertest)
```

### 4. Frontend (Next.js) — Fase 3

```bash
cd frontend
npm install
npm run dev           # http://localhost:3001
```

*(Diretório será populado nas tarefas 3.1–3.3: middleware JWT na Edge, contexto WebSocket e optimistic updates.)*

## 🔌 Principais Endpoints

Rotas de movimentação financeira exigem o header `X-Idempotency-Key` (UUID único por intenção de pagamento; retenção de 24h no Redis):

```bash
curl -X POST http://localhost:3000/transactions/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -H "X-Idempotency-Key: 3f2b7c9e-1a4d-4e8b-9c2f-6d0a1b2c3d4e" \
  -d '{
        "accountId": "acc_123",
        "destinationAccountId": "acc_456",
        "amountInCents": 10050,
        "type": "PIX"
      }'
```

Respostas esperadas: `201` (aceita, evento no outbox), `409 CONFLICT` (chave de idempotência já `PROCESSING`/`COMPLETED`) e `422` (saldo projetado insuficiente — bloqueio de *double-spending*).

## 🧪 Testes de Carga (Grafana k6 – 5.000 CCU)

Os scripts da Fase 4 simulam 5.000 VUs executando transferências Pix concorrentes contra a API.

### Instalação do k6

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyserver --keyserver https://arm.k6.io --recv-key C5AD17C7C3E781512550B476D7A2BA96F5F6E65B \
  | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.cloudsmith.io/public/grafana/k6_deb linux/deb all main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update && sudo apt install k6
```

### Executar o teste de carga

```bash
export TARGET_BASE_URL="http://localhost:3000"
export TARGET_JWT="<token de teste>"

k6 run --out json=load-tests/results.json load-tests/peak-5000-vus.js
```

Parâmetros úteis:

| Flag | Função |
| :--- | :--- |
| `-u 5000` | Sobrescreve o número de VUs virtuais |
| `--duration` / estágios no script | Controla rampa de subida/manutenção/descida |
| `--compatibility-mode=2` | Bundle ES5 (legado) |
| `--out json=<arquivo>` | Exporta métricas em JSON |
| `--address` | Proxy para inspeção |

### Extrair e interpretar os resultados

O resumo padrão do k6 ao final da execução traz as métricas críticas do SLO:

```
http_req_duration{expected_response:true}
  ● p(90)=45ms  p(95)=62ms  p(99)=87ms   ← meta: p99 < 100ms ✔
checks.........................: 99.98%  ← zero double-spending validado
http_req_failed................: 0.02%
iterations.....................: 8.4M    ← throughput efetivo (TPS)
```

Exportar para análise histórica:

```bash
# JSON -> arquivo para ingestão no Elasticsearch / S3
k6 run --out json=load-tests/results.json load-tests/peak-5000-vus.js

# CSV -> planilha / análise offline
k6 run --out csv=load-tests/results.csv load-tests/peak-5000-vus.js

# Thresholds falhando = exit code != 0 (integração CI/CD)
k6 run load-tests/peak-5000-vus.js || echo "SLO violado!"
```

Validação de consistência pós-carga (TASK 4.3 — zero inconsistência após 1M de transações):

```bash
node scripts/validate-ledger-consistency.js --uri "$MONGO_URI"
# Compara soma(devedor) == soma(credor) em ledger_entries e detecta saldo negativo/saldo duplo.
```

## 🐳 Deploy em Kubernetes (Fase 1)

```bash
kubectl apply -f infrastructure/k8s/
kubectl scale deployment fincore-api --replicas=6   # KEDA assume o autoscaling
```

## 🧭 Roadmap de Implementação

| Fase | Escopo | Status |
| :--- | :--- | :--- |
| **1** | Infraestrutura (Mongo Atlas Sharded, Redis Cluster, K8s + NGINX, KEDA) | 🔲 Pendente |
| **2** | Core Financial Engine (Fastify, Idempotência, Ledger Append-Only, Redlock, Outbox) | 🟡 Em andamento |
| **3** | Frontend Next.js (Edge JWT, WebSocket, Optimistic Updates) | 🔲 Pendente |
| **4** | Testes de Carga 5k CCU, Chaos Engineering e validação de consistência | 🔲 Pendente |
| **5** | README / documentação de operação | ✅ Concluída |

Detalhamento completo em [`docs/tasks/TASKS_SETUP(1).md`](docs/tasks/TASKS_SETUP\(1\).md). Diretrizes de código em [`docs/RULES.md`](docs/RULES.md); memória de decisões em [`docs/GEMINI.md`](docs/GEMINI.md).

## 👤 Autor

**Pedro Piva** – FinCore 5K v1.0.0-PROD
