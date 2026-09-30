# Sistema de Design (UI/UX) - High-Frequency Finance

**FinCore 5K – Design System Otimizado para Resposta Rápida e Clareza Visual**

---

## 1. Princípios Gerais do Design
* **Feedback Instantâneo:** Resposta visual em menos de $50\text{ms}$ para qualquer ação do usuário (Optimistic States).
* **Clareza de Estado Financeiro:** Estados claros e distintos para Transação Pendente, Concluída, Falhada e Revertida.
* **Acessibilidade sob Estresse:** Alto contraste para facilitar o uso em dispositivos móveis sob luz solar forte ou alta velocidade.

---

## 2. Paleta de Cores e Estados

| Estado | Hex / Variável | Aplicação no Fluxo Financeiro |
| :--- | :--- | :--- |
| **Primária** | `#0052FF` | Ações de envio, botões "Confirmar Pagamento" |
| **Sucesso** | `#00C853` | Transação confirmada no Ledger (`COMMITTED`) |
| **Processando** | `#FFAB00` | Transação na fila ou aguardando resposta da rede (`PENDING`) |
| **Erro/Falha** | `#D50000` | Saldo insuficiente, transação negada ou abortada |
| **Superfície Dark** | `#0A0E17` | Fundo principal (reduz o cansaço visual em dashboards) |
| **Superfície Card** | `#161F30` | Cards de saldo, extrato e confirmação |

---

## 3. Componentes Específicos para Fluxo Financeiro

### 3.1. Indicador de Status em Tempo Real (Status Badge)
* **Em Processamento:** Animação Pulse em amarelo com ícone de Spinner. Exibe o tempo de resposta transcorrido em ms.
* **Sucesso:** Ícone de Check estático em verde com efeito hálito curto.
* **Falha:** Ícone de Exclamação em vermelho com explicação direta (ex: "Chave idempotente duplicada" ou "Saldo Insuficiente").

### 3.2. Formatação de Teclado e Entrada Numérica
* **Input de Valor:** Utiliza tamanho estendido ($36\text{pt}$ ou $48\text{pt}$), com formatação automática de moeda local enquanto o usuário digita.
* **Tratamento de Decimais:** Bloqueia a inserção de mais de 2 casas decimais diretamente no componente de interface.

---

## 4. Estratégia de Feedback Visual no Next.js (Optimistic UI)

```
[ Usuário Clica "Pagar" ]
          |
   (Imediatamente) ---> Exibe Card "Processando Pagamento..." + Desabilita Botão
          |
   (WebSocket Event) -> Recebeu evento "TX_SUCCESS" da API
          |
   (Atualização) ----> Transiciona suavemente para a cor Sucesso e toca feedback tátil
```