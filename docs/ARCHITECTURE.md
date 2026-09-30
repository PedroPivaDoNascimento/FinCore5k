# Arquitetura do Sistema de Alta Escalabilidade e Concorrência (5k CCU)

Este documento detalha a arquitetura técnica para suportar **5.000 usuários simultâneos efetuando transações financeiras simultâneas** utilizando a stack **Next.js, NestJS, MongoDB Atlas e Kubernetes**.

---

## 1. Visão Geral da Arquitetura (CQRS + Event-Driven)

```
[ Next.js Frontend ] --(HTTP/2 / WebSocket)--> [ Cloudflare CDN / Edge ]
                                                       |
                                              [ NGINX Ingress / K8s ]
                                                       |
                                        +--------------+--------------+
                                        |                             |
                          [ NestJS API Gateway ]            [ NestJS WS Gateway ]
                           (Fastify - Stateless)            (Real-time Status)
                                        |                             |
                      +-----------------+-----------------+           |
                      |                                   |           |
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

---

## 2. Estratégia de Desbloqueio e Concorrência (Gargalos Eliminados)

### 2.1. O Problema do "Hot Document"
Alterar o documento de saldo do usuário com `db.accounts.updateOne({_id: id}, {$inc: {balance: -amount}})` sob $5.000$ requisições simultâneas causa **Lock Contention** severo no MongoDB WiredTiger engine.

### 2.2. A Solução: Modelo Ledger Append-Only + Redlock
1. **Append-Only Entries:** Toda transação grava um novo documento na coleção `ledger_entries` (sem update de documentos existentes).
2. **Distributed Lock (Redlock):** Antes de criar a entrada no ledger, o NestJS solicita um Lock Distribuído temporário no **Redis Cluster** para a chave `account:lock:{userId}` com TTL de $2.000\text{ms}$.
3. **MongoDB Sessions & Transactions:** Início de uma transação ACID local com `writeConcern: { w: 'majority', j: true }` garantindo que o saldo projetado não fique negativo.

---

## 3. Detalhamento da Stack Técnica

| Camada | Tecnologia | Configuração para 5k CCU |
| :--- | :--- | :--- |
| **Edge / Ingress** | NGINX / Cloudflare | H2/H3, Keep-Alive `timeout 75s`, Rate Limiting de 100 req/s por IP |
| **Frontend** | Next.js 14+ (App Router) | SWC, SSR/Static Caching em CDN, WebSockets para feedback de status |
| **API Backend** | NestJS + Fastify Adapter | Fastify (3x mais throughput que Express), Keep-Alive, Worker Threads |
| **Database** | Mongo Atlas (Sharded) | Shard Key: `{ account_id: "hashed" }`, Multi-document ACID, Cluster M60+ |
| **Cache & Queue** | Redis Enterprise Cluster | BullMQ para mensageria assíncrona, Redlock para locks, Memory LRU |
| **Orquestração** | Kubernetes (EKS/GKE) | HPA + KEDA, Pod Anti-Affinity, Topology Spread Constraints |

---

## 4. Dimensionamento e Tuning no Kubernetes

### 4.1. Configuração dos Pods (NestJS API)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fincore-api
spec:
  replicas: 10 # Mínimo inicial para suportar 5k CCU sem delay de frio
  template:
    spec:
      containers:
      - name: api
        image: fincore-api:latest
        resources:
          requests:
            cpu: "2000m"
            memory: "4Gi"
          limits:
            cpu: "4000m"
            memory: "8Gi"
        env:
        - name: MONGO_MAX_POOL_SIZE
          value: "100" # Evita exaustão de conexões no Atlas
```

### 4.2. Autoscaling HPA & KEDA
* **HPA (CPU/Memória):** Escala de 10 para até 50 pods se a CPU ultrapassar $60\%$.
* **KEDA (Queue Length):** Escala os pods de processamento assíncrono (*Workers*) baseando-se no número de mensagens pendentes na fila BullMQ (`queue_length > 500`).

---

## 5. Estrutura do Banco de Dados (Mongo Atlas)

### 5.1. Coleção `ledger_entries` (Particionada por Shard Key)
```json
{
  "_id": ObjectId("..."),
  "transaction_id": "tx_uuid_12345",
  "account_id": "acc_98765",
  "type": "DEBIT", // DEBIT ou CREDIT
  "amount_cents": 10000, // Inteiro positivo (R$ 100,00)
  "idempotency_key": "idemp_abc_999",
  "status": "COMMITTED",
  "created_at": ISODate("2026-09-30T10:00:00Z")
}
```

### 5.2. Índices Críticos para Performance
1. `{ account_id: "hashed" }` (Shard Key).
2. `{ idempotency_key: 1 }` (Único para bloqueio de duplicidade).
3. `{ account_id: 1, created_at: -1 }` (Consultas otimizadas de extrato).