# Documento de Requisitos do Produto (PRD)

**FinCore 5K – Plataforma Financeira de Alta Volumetria Concorrente**

| Campo | Valor |
| :--- | :--- |
| **Versão** | 1.0.0-PROD |
| **Data** | 30 de Setembro de 2026 |
| **Autor** | Pedro Piva |
| **Status** | Aprovado para Arquitetura e Implementação |
| **Lançamento Alvo** | Produção Escala 5k CCU |

---

## 1. Visão Geral do Produto
O **FinCore 5K** é uma plataforma financeira de alta performance capaz de processar transações financeiras em tempo real para **5.000 usuários simultâneos ativos (CCU)** com carga de escrita pesada, garantindo inconsistência zero (*zero double-spending*), resiliência a falhas de infraestrutura e latência p99 abaixo de $100\text{ms}$.

## 2. Declaração do Problema
Processar transações financeiras sob alta concorrência ($5.000$ usuários realizando saques, transferências e pagamentos ao mesmo tempo) causa contenção de locks em bancos de dados relacionais e não-relacionais, race conditions, exaustão de conexões (Connection Pooling Limits) e degradação de performance na camada de apresentação. O sistema precisa garantir acoplamento zero entre leitura e escrita, além de idempotência estrita.

## 3. Objetivos Métricos (SLA / SLO)
* **Concorrência:** Suportar no mínimo $5.000$ usuários ativos simultâneos enviando transações ativas.
* **Throughput:** Processar até $2.500$ a $5.000$ transações por segundo (TPS em pico).
* **Latência (p99):** $< 100\text{ms}$ para autorização de transação; $< 50\text{ms}$ para consultas de saldo cached.
* **Disponibilidade:** $99{,}999\%$ (máximo de 5.26 minutos de downtime por ano).
* **Consistência:** *Zero Double-Spending*, consistência ACID no extrato e consistência eventual na projeção visual com tempo limite de sincronia de $500\text{ms}$.

## 4. Usuários-Alvo e Perfis de Acesso
* **Usuário Final (Web):** Realiza transferências Pix/TED, pagamentos e checagem de saldo em tempo real sob alta concorrência.
* **Core Financial Engine (Workers):** Serviços desacoplados processando liquidação assíncrona.
* **Operador de Auditoria e Compliance:** Acesso a logs imutáveis e trilha de auditoria sem impactar a base OLTP quente.

## 5. Requisitos Funcionais Principais
1. **Motor de Idempotência:** Chave única `X-Idempotency-Key` obrigatória por intenção de pagamento com retenção em Redis por 24 horas.
2. **Ledger Financeiro Imutável:** Modelo Append-Only para créditos e débitos, sem alteração direta de documentos de saldo para evitar contenção de escrita (*Hot-key lock*).
3. **Notificação em Tempo Real:** Retorno instantâneo via WebSocket / Server-Sent Events (SSE) para atualização de status no Next.js.
4. **Mecanismo de Circuit Breaker:** Degradação graciosa em caso de sobrecarga no provedor externo de liquidação financeira.
5. **Autenticação e Autorização em Camada Edge:** Validação JWT stateless com mTLS entre microsserviços.

## 6. Requisitos Não-Funcionais Críticos
* **Segurança:** Criptografia em trânsito (TLS 1.3) e em repouso (Mongo Atlas Encryption at Rest + KMS).
* **Escalabilidade:** Autoscaling de Pods em Kubernetes via KEDA baseado na taxa de requisições e profundidade de filas (BullMQ/RabbitMQ).
* **Auditoria:** Registro imutável de todas as chamadas de transação via CDC (Change Data Capture) com Mongo Change Streams e exportação para S3.