# Task 02: Tela de Detalhes do Cartão e Lançamento Rápido

**Objetivo**: Facilitar a entrada em lote de despesas de cartão de crédito para novos usuários.

## Requisitos Implementados
1. **Nova View (`CardDetailsView.tsx`)**: 
   - Acessada clicando em um cartão na lista de cartões (`CardsView`).
   - Apresenta um cabeçalho com o nome do cartão, limite total e disponível.
   - Lista o histórico de despesas atreladas exclusivamente ao cartão selecionado (`cardId`).
   
2. **Formulário de Entrada Rápida (In-line)**:
   - Posicionado no topo da tela (abaixo do cabeçalho de totais).
   - Não bloqueia a visão e não fecha ao ser submetido.
   - Campos: Valor, Descrição, Data, Categoria, Parcelas.
   
3. **Lógica de Parcelamento**:
   - Apenas para a visualização local por enquanto, antes da migração pro Supabase.
   - Pega o `Valor Total`, divide pelo número de `Parcelas`.
   - Gera `N` transações no banco de dados (`Dexie`), incrementando a data em 1 mês para cada nova transação (usando `date-fns` ou lógica nativa).
   - Um `parentId` igual para as N transações.

## Status
Em desenvolvimento.
