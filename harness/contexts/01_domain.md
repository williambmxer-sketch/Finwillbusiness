# Domínio de Negócio: Finanças Pessoais

## Entidades

1. **Contas**: onde o saldo bancário ou de carteira é materializado.
2. **Cartões**: instrumentos de crédito com fechamento e vencimento.
3. **Transações**: receitas, despesas, transferências e movimentos técnicos de fatura.
4. **Categorias**: classificação de receitas e despesas.
5. **Formas de pagamento**: meios personalizados que podem ou não debitar uma conta.
6. **Faturas**: atualmente calculadas a partir das transações de cartão; não são uma tabela persistida usada pelo frontend.

## Estados financeiros

- **Pendente**: compromisso registrado, ainda sem entrada/saída realizada.
- **Pago/recebido**: movimento realizado; deve possuir `data_pagamento` quando a baixa ocorre em data diferente do lançamento.
- **Compra de cartão**: permanece como compromisso até a baixa da fatura.
- **Pagamento de fatura**: saída real da conta, registrada separadamente com o marcador `pagamento_fatura:<cardId>-<ciclo>`.

## Regras de caixa

- Dashboard e relatórios de caixa usam somente movimentos realizados.
- O período de caixa usa a data efetiva (`data_pagamento`) e não a data original do compromisso.
- Transferências podem aparecer no extrato da conta, mas não entram no total consolidado de receitas/despesas.
- Uma compra de cartão e o pagamento da respectiva fatura não podem ser somados como duas saídas realizadas.
- O pagamento de uma fatura deve considerar apenas o valor ainda em aberto.

## Usuário e isolamento

Todas as entidades persistidas devem pertencer ao usuário autenticado e depender das políticas RLS do Supabase. Nenhum fallback de erro pode ampliar uma operação filtrada por usuário para a tabela inteira.
