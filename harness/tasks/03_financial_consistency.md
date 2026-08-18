# Consistência de Caixa e Relatórios

## Implementado na branch `test`

- [x] Centralizar regras de caixa realizado em `src/utils/financialRules.ts`.
- [x] Dashboard usa entradas e saídas realizadas pela data efetiva.
- [x] Relatórios usam caixa realizado e distinguem o período da baixa.
- [x] Detalhes de contas agrupam pelo mês do pagamento.
- [x] Baixas e estornos atualizam/limpam `paymentDate`.
- [x] Pagamento de fatura cria uma transação auditável e paga apenas o saldo em aberto.
- [x] Remover fallbacks que poderiam atingir dados fora do usuário.
- [x] Corrigir ciclo de cartão em meses com dias inexistentes e virada de ano.
- [x] Criar invariantes executáveis em `harness/tests/financial_invariants.ts`.
- [x] Adicionar modos Realizado, Projetado e Comparativo ao Relatório.
- [x] Projetar pendências de cartão pelo mês de vencimento da fatura.
- [x] Tornar a baixa de fatura online-only, idempotente e reconciliável após falha de rede.
- [x] Proteger a inicialização após login/F5 contra painel temporariamente zerado e repetir consultas iniciais transitórias.
- [x] Adicionar conta tipo Carteira e restringir a forma Dinheiro à Carteira vinculada.
- [x] Adicionar depósito para Carteira escolhendo a conta de origem, registrado como transferência.
- [x] Exibir saldo atual de contas e carteira separado do resultado do período no Relatório.
- [x] Manter o saldo atual independente do mês e do modo Realizado/Projetado/Comparativo.
- [x] Agrupar cada fatura em uma única linha nas Transações, inclusive em pagamento parcial.
- [x] Permitir novas baixas do saldo restante após baixa antecipada ou pagamento parcial,
  sem duplicar o débito da tentativa anterior.
- [x] Calcular saldo projetado a partir do saldo atual e dos movimentos previstos até o
  fim do período, sem dupla contagem das movimentações realizadas.
- [x] Reconstruir saldo histórico para consulta de períodos passados.

## Próxima etapa recomendada

- Criar uma RPC/transação no Supabase para baixa de fatura, transferência e alteração de saldo, reduzindo risco de falha entre chamadas separadas.
- Adicionar reconciliação administrativa entre `contas.saldo` e os movimentos realizados.
- Migrar testes de invariantes para uma suíte formal com banco de teste/RLS.
