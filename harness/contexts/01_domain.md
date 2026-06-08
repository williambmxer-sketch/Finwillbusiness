# Domínio de Negócio: Sistema Financeiro

O sistema é um gerenciador financeiro pessoal focado no controle detalhado de receitas, despesas, cartões e contas.

## Entidades Principais
1. **Contas (Accounts)**: Onde o saldo real existe (Corrente, Poupança, Dinheiro, etc.).
2. **Cartões (Cards)**: Cartões de crédito com dias de vencimento e fechamento. Faturas são pagas através de contas.
3. **Transações (Transactions)**: 
   - **Despesas**: Dinheiro que sai.
   - **Receitas**: Dinheiro que entra.
   - **Transferências**: Movimentações entre contas.
4. **Categorias (Categories)**: Classificação de transações para relatórios.
5. **Metas (Goals/Budgets)**: Orçamentos estipulados para diferentes áreas da vida financeira.

## Contexto de Usuário (Supabase Auth)
Com a adoção do Supabase, o domínio envolverá o contexto de **Usuários (Users)**, garantindo que todas as transações, contas e cartões pertençam estritamente ao usuário autenticado (Row Level Security - RLS).
