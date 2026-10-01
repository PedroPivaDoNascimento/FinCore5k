# Plano de Resolução de Erros de Build - TypeScript

**FinCore 5K – Correção de Incompatibilidades de Tipagem e Build**

---

## 📊 Métricas e Progresso Geral

* **Total de Tarefas:** 4
* **Concluídas:** 0 (0%)
* **Em Andamento:** 0 (0%)
* **Pendentes:** 4 (100%)

---

## 🔒 Fase 1: Ajuste de Lock Distribuído (`distributed-lock.service.ts`)
Resolução de incompatibilidade de opções na biblioteca de lock distribuído (Redlock).

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | Remover a propriedade `signal` do objeto de configurações do `acquire` e ajustar o parâmetro de timeout/duração | Backend | Alta | 🔴 Não Iniciado |

---

## 🗝️ Fase 2: Configuração de Autenticação do Redis Cluster (`redis.service.ts`)
Ajuste da estrutura de opções do `ClusterOptions` da biblioteca Redis (`ioredis`).

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 | Mover a chave `password` para dentro da propriedade `redisOptions` ao instanciar o `Redis.Cluster` | Backend | Alta | 🔴 Não Iniciado |

---

## 📑 Fase 3: Correção de Tipagens do Mongoose (`ledger.service.ts`)
Ajuste de namespaces e escopo de exportação de sessões do Mongoose.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 3.1 | Substituir `Types.ClientSession` pela importação direta `ClientSession` do pacote `mongoose` | Backend | Alta | 🔴 Não Iniciado |

---

## 🧪 Fase 4: Validação da Compilação
Garantia de integridade e geração do build da aplicação.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 4.1 | Executar o comando `nest build` e verificar a ausência de novos erros de compilação no TypeScript | Backend / QA | Crítica | 🔴 Não Iniciado |