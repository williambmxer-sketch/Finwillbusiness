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
- Uma fatura paga deve ser idempotente: repetir a ação não pode criar outro débito para o mesmo ciclo.
- O movimento de pagamento deve ficar disponível no histórico da conta e nos relatórios de caixa.
- A baixa exige conexão ativa e leitura atualizada do Supabase; não pode ser enfileirada
  silenciosamente para execução offline.
- A baixa usa uma chave técnica por fatura (`pagamento_fatura:<cartão>-<ciclo>`), bloqueia
  duplicidade e mantém um registro local temporário apenas para recuperar uma interrupção
  entre a criação do movimento e o débito da conta.
- Se o saldo não puder ser confirmado, a operação para e informa o usuário; não reprocessa
  automaticamente uma fatura nem altera lançamentos históricos.

## Modos do Relatório

- **Realizado**: somente entradas e saídas efetivamente pagas/recebidas.
- **Projetado**: realizado mais transações pendentes dentro do período selecionado; compras de cartão pendentes usam o mês de vencimento da fatura.
- **Comparativo**: exibe realizado e projetado lado a lado para o mesmo filtro.

O modo não altera o filtro de mês ou período personalizado. Ele altera apenas a camada de dados exibida, mantendo a distinção explícita entre dinheiro já movimentado e compromisso previsto.

## Invariantes mínimas

1. Pendências não entram no caixa realizado.
2. Pagamento posterior usa o mês da baixa.
3. Compra de cartão não duplica o pagamento da fatura.
4. Transferência não infla receitas/despesas consolidadas.
5. Reset e exclusão nunca saem do escopo do usuário autenticado.

As invariantes são executadas com `npm run test:financial`.
