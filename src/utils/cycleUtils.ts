/**
 * Calcula o ciclo de uma fatura com base na data da compra,
 * dia de fechamento e dia de vencimento do cartão.
 *
 * O cycleId retornado representa o MÊS DE VENCIMENTO da fatura,
 * que é quando o usuário efetivamente paga a conta.
 *
 * Exemplo:
 *   Compra: 09/jun, fechamento: dia 25, vencimento: dia 5
 *   → Fatura fecha em 25/jun → vence em 05/jul → cycleId = "2026-07"
 */
export interface CycleResult {
  cycleId: string; // formato "YYYY-MM", ex: "2026-07"
  dueDate: Date;
}

export function getCycleId(
  dateVal: Date | string,
  closingDay: number = 10,
  dueDay: number = 17
): CycleResult {
  const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (!date || isNaN(date.getTime())) {
    return { cycleId: '', dueDate: new Date() };
  }

  let yr = date.getFullYear();
  let mo = date.getMonth();
  const currentMonthClosing = new Date(yr, mo, closingDay, 23, 59, 59);

  // Se a compra foi feita APÓS o fechamento deste mês, vai para o próximo ciclo
  let cycleMonth = mo;
  let cycleYear = yr;
  if (date > currentMonthClosing) {
    cycleMonth += 1;
    if (cycleMonth > 11) { cycleMonth = 0; cycleYear++; }
  }

  // O vencimento pode cair no mês seguinte ao fechamento (ex: fecha dia 25, vence dia 5)
  let dueMonth = cycleMonth;
  let dueYear = cycleYear;
  if (dueDay < closingDay) {
    dueMonth += 1;
    if (dueMonth > 11) { dueMonth = 0; dueYear++; }
  }

  return {
    cycleId: `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}`,
    dueDate: new Date(dueYear, dueMonth, dueDay),
  };
}

/**
 * Retorna o cycleId de uma transação.
 * - Transações em dinheiro/conta: usa o mês/ano da data diretamente.
 * - Transações de cartão: usa getCycleId com closingDay e dueDay do cartão,
 *   atribuindo a despesa ao mês em que a fatura VENCE.
 */
export function getTransactionCycle(
  t: { date: Date; cardId?: string | null },
  cards: { id: string; closingDay: number; dueDay: number }[]
): string {
  const d = t.date;

  if (!t.cardId || t.cardId === 'money') {
    // Dinheiro/conta: o ciclo é o próprio mês da transação
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const card = cards.find(c => c.id === t.cardId);
  if (!card) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const { cycleId } = getCycleId(d, card.closingDay, card.dueDay);
  return cycleId;
}
