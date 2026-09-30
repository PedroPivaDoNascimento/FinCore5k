# Plano de Implementação e Divisão de Tarefas

**FinCore 5K – Cronograma de Otimização e Lançamento (5k Concorrentes)**

---

## 📊 Métricas e Progresso Geral

* **Total de Tarefas:** 15
* **Concluídas:** 0 (0%)
* **Em Andamento:** 0 (0%)
* **Pendentes:** 15 (100%)

---

## 🚀 Fase 1: Infraestrutura e Cluster de Alta Performance (K8s & Mongo)
Estruturação do ambiente que suportará a carga massiva de 5.000 usuários simultâneos.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | Provisionar Cluster Mongo Atlas Sharded (M60+) com Shard Key por `account_id` | DevOps / DBA | Crítica | 🔴 Não Iniciado |
| 1.2 | Configurar Cluster Redis Enterprise para Locks Distribuídos (Redlock) e Caching | DevOps | Crítica | 🔴 Não Iniciado |
| 1.3 | Configurar Cluster Kubernetes (EKS/GKE) com NGINX Ingress e HTTP/2 enabled | DevOps | Crítica | 🔴 Não Iniciado |
| 1.4 | Configurar métricas de escalabilidade KEDA baseadas em profundidade de filas | DevOps | Alta | 🔴 Não Iniciado |

---

## ⚡ Fase 2: Core Financial Engine (NestJS & Backend)
Desenvolvimento do motor atômico de liquidação e gerenciamento de concorrência.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 | Implementar adaptador Fastify no NestJS e tuning do Connection Pool do Mongo | Backend | Crítica | 🔴 Não Iniciado |
| 2.2 | Criar interceptor de Idempotência com validação via Redis Cluster | Backend | Crítica | 🔴 Não Iniciado |
| 2.3 | Implementar padrão Ledger Append-Only com Mongo Multi-Document Sessions | Backend | Crítica | 🔴 Não Iniciado |
| 2.4 | Implementar mecanismo de Redlock para retenção de race condition por conta | Backend | Crítica | 🔴 Não Iniciado |
| 2.5 | Implementar Transactional Outbox Pattern para mensageria assíncrona segura | Backend | Alta | 🔴 Não Iniciado |

---

## 🖥️ Fase 3: Frontend e Camada de Apresentação (Next.js)
Construção da interface de baixa latência e atualização em tempo real.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 3.1 | Implementar rotas Edge com validação de JWT no Next.js Middleware | Frontend | Alta | 🔴 Não Iniciado |
| 3.2 | Criar contexto de WebSockets no Next.js para escutar atualizações de transação | Frontend | Alta | 🔴 Não Iniciado |
| 3.3 | Implementar lógica visual de Optimistic Updates e prevencao de duplo clique | Frontend | Média | 🔴 Não Iniciado |

---

## 🧪 Fase 4: Testes de Carga Extrema e Stress Testing (5k CCU)
Simulação realística de tráfego financeiro pesado.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 4.1 | Escrever scripts de teste de carga no Grafana k6 para simular 5.000 VUs em pico | QA / DevOps | Crítica | 🔴 Não Iniciado |
| 4.2 | Executar testes de Chaos Engineering (derrubar pods de API/Workers durante a carga) | QA / DevOps | Alta | 🔴 Não Iniciado |
| 4.3 | Validar inconsistência zero no Ledger após $1.000.000$ de transações simuladas | QA / Finance | Crítica | 🔴 Não Iniciado |

## Fase 5: Criar um arquivo README.md
Criação de um arquivo README.md dando um breve resumo sobre o projeto e também exlicando o passo a passo para como executar o código fonte e também como realizar os testes de cargas e extrair os seus resultados. | 🔴 Não Iniciado |
