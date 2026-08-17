# Lições Aprendidas - Formas de Pagamento Personalizadas e Consolidação de Faturas

Este documento consolida as alterações, decisões de design e regras de interface implementadas para suportar formas de pagamento personalizadas que não se comportam como cartões de crédito convencionais, além de melhorias de ordenação e posicionamento.

---

## 1. Contexto e Motivação
O usuário precisava cadastrar formas de pagamento neutras (como "Crediário", "Boleto Parcelado", "Carnê") com suporte a parcelamento, mas **sem** a complexidade de ciclos de faturamento de cartão de crédito (vencimento e fechamento fixos por fatura). As parcelas devem ser geradas como despesas pendentes individuais no extrato e pagas usando contas bancárias reais (da baixa) posteriormente na loja/banco.

---

## 2. Decisões Arquiteturais

### A. Armazenamento e Cadastro
- **Formas de Pagamento Customizadas**: Foram **MIGRADAS** do `localStorage` para a nuvem via Supabase (na tabela `formas_pagamento`). O sistema não usa mais armazenamento local, garantindo integridade e sincronização entre dispositivos. O estado global no aplicativo gerencia essas opções através do `useDataStore`, buscando dados via API. Cada forma possui:
  - `id`: UUID gerenciado pelo Supabase.
  - `name`: Nome (ex: "Pix", "Dinheiro em Espécie").
  - `debitFromAccount`: Define se a forma de pagamento deve debitar o saldo de uma Conta Bancária (Ex: Pix debita, Dinheiro em Espécie não).

- **Vínculo com Transações**: Para não violar as tabelas relacionais do Supabase (`transacoes`), vinculamos as formas de pagamento personalizadas utilizando o campo `notes` (observações) no formato: `paymentMethod:NomeDaForma` e a chave estrangeira `cardId` é alimentada com o `id` da forma customizada (usando o prefixo `custom-id`).

  > Estado atual: o frontend identifica a forma personalizada pelo marcador `paymentMethod:NomeDaForma`; formas personalizadas não usam `cartao_id` como chave estrangeira de cartão.

### B. Ciclo de Vida e Baixa
- **Lançamento Flexível e Enxuto**: 
  - Ao lançar uma despesa como **Pendente** (quando "Confirmar Pagamento" estiver desmarcado), o modal de criação **OCULTA** a escolha de Forma de Pagamento. A despesa fica registrada de maneira genérica até o momento do pagamento.
  - Ao ativar "Confirmar Pagamento", o campo de "Forma de Pagamento" aparece, listando os cartões de crédito físicos e as formas customizadas vindas do Supabase.
- **Carência no Parcelamento**: Ao lançar a despesa parcelada (`installments > 1`), o sistema exibe a opção **"Primeira parcela em 30 dias"**.
  - Se ativada, as parcelas são salvas com vencimentos a partir de `D+30`.
  - Se desativada, as parcelas iniciam no mês atual (`D+0`).
- **Baixa Dinâmica**: 
  - Cada parcela aparece individualmente no extrato como "Pendente".
  - Ao clicar em "Confirmar Pagamento" (Dar Baixa), o sistema lê a propriedade `debitFromAccount` da Forma de Pagamento escolhida. Se estiver ativada, ele exige a Conta de Saída e abate o saldo; se desativada, ele efetiva a baixa sem abater de nenhuma conta (útil para "Dinheiro em Espécie").

### C. Alerta de Saldo
- Implementada validação no salvamento/edição de despesas pagas: se o valor a ser debitado ultrapassar o saldo atual da conta bancária de origem, a operação é bloqueada e um alerta é exibido.

### D. Caixa realizado e faturas
- Compras de cartão não entram no caixa realizado enquanto estiverem representadas pela fatura.
- O pagamento da fatura cria uma transação técnica com `pagamento_fatura:<cartão>-<ciclo>`, vinculada à conta debitada.
- O valor debitado considera apenas o saldo em aberto da fatura e a operação é protegida contra repetição pelo marcador técnico.

---

## 3. Comportamento e Padrões da Interface (UI)

### A. Ocultação Dinâmica da Conta
- No modal de transações, o seletor de **Conta de Origem** só deve ser exibido se a forma de pagamento for dinheiro/PIX (`cardId === 'money'`) **E** a opção **"Confirmar Pagamento"** estiver ativada (`isPaid = true`). Caso contrário, o campo de conta permanece oculto e o grid se auto-ajusta para ocupar a largura total, limpando a poluição visual do formulário.

### B. Consolidação na Home (Dashboard)
- Na lista de **Transações Recentes** do Dashboard, lançamentos parcelados (cartão de crédito ou crediário) que possuem o mesmo `parentId` são agrupados em uma única linha.
- Exibe o **valor bruto consolidado** da compra.
- Exibe um badge com a indicação de parcelas (ex: `10x`).
- Exibe o progresso de pagamento formatado em texto (ex: `1/10 Pago`), incrementando conforme as parcelas individuais são pagas no extrato.

### C. Accordion e Detalhes de Faturas
- Na listagem de **Faturas**, as linhas funcionam como cards expansíveis (estilo accordion). Clicar na fatura expande a linha revelando o botão de pagar e um ícone de **"Olho" (`Eye`)**.
- O ícone do Olho abre um Drawer Modal aprimorado com gradientes, cantos arredondados, que lista os lançamentos individuais da fatura com tags de parcelamento e indicação visual de **Categoria** (bolinha colorida e nome da categoria carregados dinamicamente).
- **Filtro de Mês**: A tela de Faturas carrega por padrão a fatura do **mês vigente**, permitindo mudar o período por um seletor para evitar listar dezenas de faturas passadas e futuras de uma só vez.

### D. Regras de Componentes Select (Dropdowns)
- **Base UI Align Item**: Por padrão, o `@base-ui/react/select` tenta alinhar o item ativo sobre o botão do trigger, o que fazia as listas longas de meses abrirem para cima no meio da tela.
- **Correção**: Todos os componentes `SelectContent` foram configurados com `alignItemWithTrigger={false}`, `side="bottom"` e `sideOffset={4}` para garantir que os menus dropdown sempre abram **exclusivamente para baixo** de maneira limpa.
- **Ordenação Chronológica**: As chaves de meses (`yearMonth` ex: `2026-9`, `2026-10`) devem ser ordenadas de forma numérica dividindo o ano e o mês, evitando erros de ordenação alfabética (onde `10` vinha antes de `9`).
