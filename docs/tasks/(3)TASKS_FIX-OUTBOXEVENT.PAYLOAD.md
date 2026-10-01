# Plano de Resolução de Erro de Schema - NestJS & Mongoose

**FinCore 5K – Correção da Decoração do Campo OutboxEvent.payload**

---

## 📊 Métricas e Progresso Geral

* **Total de Tarefas:** 4
* **Concluídas:** 0 (0%)
* **Em Andamento:** 0 (0%)
* **Pendentes:** 4 (100%)

---

## 📦 Fase 1: Importação de Tipos do Mongoose (`outbox-event.schema.ts`)
Garantir a disponibilidade dos tipos de dados do Mongoose para mapeamento explícito do schema.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | Importar `Schema as MongooseSchema` do pacote `mongoose` no topo de `src/ledger/outbox-event.schema.ts` | Backend | Alta | 🔴 Não Iniciado |

---

## 🛠️ Fase 2: Correção do Decorador `@Prop()` (`outbox-event.schema.ts`)
Resolução da ambiguidade de tipo no atributo `payload` para eliminar a exceção `CannotDetermineTypeError`.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 | Atualizar a propriedade `payload` definindo o tipo explícito no decorador: `@Prop({ type: MongooseSchema.Types.Mixed })` | Backend | Crítica | 🔴 Não Iniciado |

---

## 📑 Fase 3: Validação da Definição do Schema (`outbox-event.schema.ts`)
Garantia de que a fábrica de schemas do NestJS consegue compilar os metadados da classe sem erros.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 3.1 | Confirmar se `SchemaFactory.createForClass(OutboxEvent)` e as exportações do schema estão corretas | Backend | Média | 🔴 Não Iniciado |

---

## 🧪 Fase 4: Validação da Execução e Build
Garantia de inicialização da aplicação em modo de desenvolvimento sem falhas de refletividade de tipos.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 4.1 | Executar o comando `npm run start:dev` e verificar se a aplicação compila e roda sem quebras (Aguarde no mínimo 1 minuto com a aplicação rotando para garantir que não vá aparecer nenhum erro após a execução) | Backend / QA | Crítica | 🔴 Não Iniciado |