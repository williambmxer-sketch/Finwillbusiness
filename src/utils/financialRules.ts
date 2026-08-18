import { Transaction } from '../db/db';

export function normalizePaymentMethodName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function isCashPaymentMethod(name: string | null | undefined): boolean {
  const normalized = normalizePaymentMethodName(name || '');
  return normalized === 'dinheiro' || normalized.startsWith('dinheiro ');
}

/**
 * Marcadores técnicos usados para movimentos que não são lançamentos comuns.
 * Eles continuam sendo transações para manter auditoria e histórico, mas podem
 * ser tratados de forma diferente em telas de compromissos e categorias.
 */
export const INVOICE_PAYMENT_PREFIX = 'pagamento_fatura:';

export function isTransfer(transaction: Pick<Transaction, 'notes'>): boolean {
  return transaction.notes?.startsWith('transferencia:') ?? false;
}

export function isInvoicePayment(transaction: Pick<Transaction, 'notes'>): boolean {
  return transaction.notes?.startsWith(INVOICE_PAYMENT_PREFIX) ?? false;
}

/** Cartão representa uma compra comprometida; a saída da conta ocorre na baixa da fatura. */
export function isCardCharge(transaction: Pick<Transaction, 'cardId' | 'notes'>): boolean {
  return Boolean(transaction.cardId && transaction.cardId !== 'money') && !isInvoicePayment(transaction);
}

export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Data que representa quando o dinheiro efetivamente entrou ou saiu. */
export function getCashDate(transaction: Pick<Transaction, 'date' | 'paymentDate' | 'isPaid'>): Date | null {
  if (!transaction.isPaid) return null;
  return toDate(transaction.paymentDate) ?? toDate(transaction.date);
}

/**
 * Movimento realizado de caixa.
 * Compras de cartão ficam fora porque a saída real é o pagamento da fatura,
 * registrado como uma transação técnica de pagamento_fatura.
 */
export function isRealizedCashFlow(transaction: Transaction): boolean {
  if (!transaction.isPaid || isTransfer(transaction)) return false;

  // Compatibilidade com dados antigos: antes do registro técnico da fatura,
  // uma compra de cartão paga não recebia paymentDate. Mantemos esse histórico
  // nos relatórios, usando a data original, para não apagar dados já lançados.
  if (isCardCharge(transaction)) return !transaction.paymentDate;

  return true;
}

export function getCashImpact(transaction: Pick<Transaction, 'type' | 'amount'>): number {
  return transaction.type === 'receita' ? transaction.amount : -transaction.amount;
}

export function getPeriodId(date: Date | string | null | undefined): string | null {
  const parsed = toDate(date);
  if (!parsed) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

export function getCashPeriodId(transaction: Transaction): string | null {
  return getPeriodId(getCashDate(transaction));
}

export function sumRealizedCashFlow(transactions: Transaction[], type?: Transaction['type']): number {
  return transactions
    .filter(transaction => isRealizedCashFlow(transaction) && (!type || transaction.type === type))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

/** Divide um valor em centavos sem perder o total original. */
export function splitAmount(total: number, parts: number): number[] {
  const safeParts = Math.max(1, Math.floor(parts));
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / safeParts);
  const remainder = totalCents - baseCents * safeParts;

  return Array.from({ length: safeParts }, (_, index) =>
    (baseCents + (index < remainder ? 1 : 0)) / 100
  );
}
