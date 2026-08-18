# Regras de Consistência Financeira

## Caixa realizado

Uma transação entra no caixa realizado quando:

- `isPaid === true`;
- não é transferência;
- não é uma compra de cartão que ainda está representada pela fatura;
- sua data efetiva é `paymentDate`, com fallback para `date` quando a baixa não possui data explícita.

Compras de cartão com `paymentDate` são excluídas do caixa realizado para evitar dupla contagem. O pagamento da fatura entra como uma transação própria, com `notes` iniciando por `pagamento_fatura:` e `accountId` apontando para a conta debitada. Compras antigas marcadas como pagas sem `paymentDate` permanecem compatíveis e são consideradas realizadas pela data original.

## Períodos

- Relatórios de caixa e detalhes de contas agrupam pela data efetiva do pagamento.
- Extrato de compromissos pode continuar agrupando lançamentos pela data/ciclo original.
- Ciclos de cartão devem atravessar corretamente dezembro/janeiro e limitar dias inválidos ao último dia do mês.

## Faturas

- O valor a pagar é o saldo em aberto, não necessariamente o total histórico da fatura.
- A exportação PDF da fatura respeita o cartão e o ciclo selecionados e apresenta o período
  de abertura, fechamento e vencimento, além de descrição, parcela, valor e data de cada
  lançamento.
- Uma fatura paga deve ser idempotente: repetir a mesma tentativa não pode criar outro débito.
- Se novas compras entrarem no ciclo depois de uma baixa antecipada, ou se houver pagamento
  parcial, a nova baixa usa um registro técnico próprio e debita apenas o saldo ainda aberto.
- Nas transações, cada cartão/ciclo aparece como uma única fatura virtual; uma baixa parcial
  nunca pode fazer a mesma fatura aparecer duplicada.
- O movimento de pagamento deve ficar disponível no histórico da conta e nos relatórios de caixa.

## Dinheiro e Carteira

- Conta do tipo `carteira` representa dinheiro em espécie.
- A forma de pagamento `Dinheiro` deve apontar para uma conta do tipo `carteira`.
- Uma despesa paga em Dinheiro só pode debitar a Carteira vinculada; banco, poupança,
  investimento e cartão não são opções válidas.
- Depósito na Carteira é uma transferência entre contas, com débito na origem e crédito
  na Carteira, sem gerar receita consolidada.
- A baixa exige conexão ativa e leitura atualizada do Supabase; não pode ser enfileirada
  silenciosamente para execução offline.
- A baixa usa uma chave técnica estável por fatura (`pagamento_fatura:<cartão>-<ciclo>`).
  A primeira tentativa usa a chave exata; tentativas adicionais usam um sufixo único e
  mantêm um registro local temporário para recuperar uma interrupção entre a criação do
  movimento e o débito da conta.
- Se o saldo não puder ser confirmado, a operação para e informa o usuário; não reprocessa
  automaticamente uma fatura nem altera lançamentos históricos.

## Modos do Relatório

- **Realizado**: somente entradas e saídas efetivamente pagas/recebidas.
- **Projetado**: realizado mais transações pendentes dentro do período selecionado; compras de cartão pendentes usam o mês de vencimento da fatura.
- **Comparativo**: exibe realizado e projetado lado a lado para o mesmo filtro.
- **Saldo atual**: soma as contas `corrente`, `poupança` e `carteira`, exclui investimentos
  do caixa disponível e permanece igual ao trocar o mês ou o modo do relatório.
- **Resultado do período**: entradas menos saídas do filtro; não é o mesmo que saldo atual.
- **Saldo projetado**: para o mês atual/futuro, parte do saldo atual e soma somente os
  movimentos previstos até o fim do período, sem repetir o que já foi realizado. Para
  períodos passados, usa o saldo histórico reconstruído pelos movimentos realizados após
  o fim do período.
- A exportação PDF do relatório deve gerar um documento próprio, com resumo e tabelas
  legíveis dos indicadores e categorias, sem depender de captura de tela da interface.
- No modo projetado, o documento deve evidenciar a hierarquia saldo inicial + entradas
  previstas - saídas previstas = saldo projetado, com percentuais e gráficos de categoria
  quando houver dados.
- No Relatório, compras de cartão e baixas técnicas de fatura devem ser agrupadas na
  categoria gerencial `Cartões`; a categoria original permanece disponível nos detalhes
  do lançamento e da fatura.
- As listas de categorias do Relatório começam recolhidas. Ao expandir, lançamentos
  parcelados do mesmo `parentId` são somados somente pelas parcelas dentro do período;
  a categoria `Cartões` mostra apenas cartão, valor e vencimento da fatura.

O modo não altera o filtro de mês ou período personalizado. Ele altera apenas a camada de dados exibida, mantendo a distinção explícita entre dinheiro já movimentado e compromisso previsto.

## Inicialização

- A interface não deve apresentar valores vazios como se fossem o estado real enquanto a sessão autenticada ainda carrega os dados.
- A aplicação só libera o painel após a primeira carga bem-sucedida; em falha, mostra erro e uma ação explícita para tentar novamente.
- Consultas concorrentes não podem permitir que uma resposta antiga sobrescreva uma carga mais recente.

## Invariantes mínimas

1. Pendências não entram no caixa realizado.
2. Pagamento posterior usa o mês da baixa.
3. Compra de cartão não duplica o pagamento da fatura.
4. Transferência não infla receitas/despesas consolidadas.
5. Reset e exclusão nunca saem do escopo do usuário autenticado.

As invariantes são executadas com `npm run test:financial`.
