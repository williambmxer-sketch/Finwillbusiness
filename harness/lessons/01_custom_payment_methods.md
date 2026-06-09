# Lições Aprendidas - Formas de Pagamento Personalizadas e Consolidação de Faturas

Este documento consolida as alterações, decisões de design e regras de interface implementadas para suportar formas de pagamento personalizadas que não se comportam como cartões de crédito convencionais, além de melhorias de ordenação e posicionamento.

---

## 1. Contexto e Motivação
O usuário precisava cadastrar formas de pagamento neutras (como "Crediário", "Boleto Parcelado", "Carnê") com suporte a parcelamento, mas **sem** a complexidade de ciclos de faturamento de cartão de crédito (vencimento e fechamento fixos por fatura). As parcelas devem ser geradas como despesas pendentes individuais no extrato e pagas usando contas bancárias reais (da baixa) posteriormente na loja/banco.

---

## 2. Decisões Arquiteturais

### A. Armazenamento e Cadastro
- **Formas de Pagamento Customizadas**: São persistidas no `localStorage` sob a chave `custom_payment_methods`. Cada uma tem:
  - `id`: UUID.
  - `name`: Nome (ex: "Crediário").
  - `allowInstallments`: Switch booleano que define se o formulário de transação deve solicitar o número de parcelas para este método.
- **Vínculo com Transações**: Para não violar as tabelas relacionais do Supabase (`transacoes`), vinculamos as formas de pagamento personalizadas utilizando o campo `notes` (observações) no formato: `paymentMethod:NomeDaForma`. O campo `cardId` permanece `undefined` (já que não é um cartão físico cadastrado) e `accountId` permanece `undefined` enquanto a transação estiver pendente.
  - **Soma de Despesas**: As compras por formas personalizadas (mesmo pendentes) são contabilizadas como despesas contraídas no Dashboard e Relatórios, utilizando a checagem do prefixo `paymentMethod:` nas observações.

### B. Ciclo de Vida e Baixa
- **Lançamento e Carência**: Ao lançar a despesa parcelada (`installments > 1`), o sistema exibe a opção **"Primeira parcela em 30 dias"**.
  - Se ativada (comportamento padrão para crediários/boletos), as parcelas são salvas com vencimentos a partir de `D+30` (próximo mês).
  - Se desativada (comportamento padrão para cartões de crédito ou compras com entrada), as parcelas iniciam no mês atual (`D+0`).
  - O valor bruto é dividido igualmente e gerado no banco via `bulkAdd` com `isPaid = false`.
- **Baixa**: Cada parcela aparece individualmente no extrato como "Pendente". Ao clicar em "Confirmar Pagamento", o usuário seleciona a conta bancária real de débito e a transação passa a ter `isPaid = true` e `accountId` preenchido, abatendo o saldo bancário.

### C. Alerta de Saldo
- Implementada validação no salvamento/edição de despesas pagas: se o valor a ser debitado ultrapassar o saldo atual da conta bancária de origem, a operação é bloqueada e um alerta é exibido.

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
