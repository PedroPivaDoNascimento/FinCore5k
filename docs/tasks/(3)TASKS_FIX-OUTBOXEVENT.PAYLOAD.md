# Plano de Resolução de Erro de Schema - NestJS & Mongoose

**FinCore 5K – Correção da Decoração do Campo OutboxEvent.payload**

---

## 📊 Métricas e Progresso Geral

* **Total de Tarefas:** 4
* **Concluídas:** 4 (100%)
* **Em Andamento:** 0 (0%)
* **Pendentes:** 0 (0%)

---

## 📦 Fase 1: Importação de Tipos do Mongoose (`outbox-event.schema.ts`)
Garantir a disponibilidade dos tipos de dados do Mongoose para mapeamento explícito do schema.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | Importar `Schema as MongooseSchema` do pacote `mongoose` no topo de `src/ledger/outbox-event.schema.ts` | Backend | Alta | 🟢 Concluído |

---

## 🛠️ Fase 2: Correção do Decorador `@Prop()` (`outbox-event.schema.ts`)
Resolução da ambiguidade de tipo no atributo `payload` para eliminar a exceção `CannotDetermineTypeError`.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 | Atualizar a propriedade `payload` definindo o tipo explícito no decorador: `@Prop({ type: MongooseSchema.Types.Mixed })` | Backend | Crítica | 🟢 Concluído |

---

## 📑 Fase 3: Validação da Definição do Schema (`outbox-event.schema.ts`)
Garantia de que a fábrica de schemas do NestJS consegue compilar os metadados da classe sem erros.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 3.1 | Confirmar se `SchemaFactory.createForClass(OutboxEvent)` e as exportações do schema estão corretas | Backend | Média | 🟢 Concluído |

---

## 🧪 Fase 4: Validação da Execução e Build
Garantia de inicialização da aplicação em modo de desenvolvimento sem falhas de refletividade de tipos.

| # | Tarefa | Responsável | Prioridade | Status |
| :--- | :--- | :--- | :--- | :--- |
| 4.1 | Executar o comando `npm run start:dev` e verificar se a aplicação compila e roda sem quebras (Aguarde no mínimo 1 minuto com a aplicação rotando para garantir que não vá aparecer nenhum erro após a execução) | Backend / QA | Crítica | 🟢 Concluído |

---

## ✅ Evidências da Execução (01/10/2026)

| Tarefa | Evidência |
| :--- | :--- |
| 1.1 | `import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';` adicionada no topo de `src/ledger/outbox-event.schema.ts` |
| 2.1 | Campo `payload` agora decorado com `@Prop({ type: MongooseSchema.Types.Mixed, required: true })` — elimina o `CannotDetermineTypeError` (`Record<string, unknown>` é irresolvível via `emitDecoratorMetadata`) |
| 3.1 | `SchemaFactory.createForClass(OutboxEvent)` compilou sem exceções; paths do schema validados em runtime: `aggregate_id, account_id, event_type, payload (Mixed), dispatch_status, created_at`; `OutboxEventSchema` + `OutboxEventDocument` exportados e registrados no `LedgerModule` (`MongooseModule.forFeature`); teste real de insert/find na coleção `outbox_events` com payload JSON OK |
| 4.1 | Ambiente local provisionado (MongoDB 7.0.14 em replica set `rs0` com `replSetInitiate` + Redis 7.2.5, conforme README/.env.example); `npm run build` (nest build) → 0 erros; `npm run start:dev` → "Found 0 errors", `Nest application successfully started`, Fastify ouvindo em `0.0.0.0:3000`; aplicação mantida rodando por mais de 90 segundos (> 1 minuto exigido) sem nenhum ERROR/Exception no log |