import React, { useEffect, useMemo, useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { getCycleId } from '../../utils/cycleUtils';
import { getCashDate, getCashImpact, isCardCharge, isInvoicePayment, isPendingProjectedCashFlow, isRealizedCashFlow, isTransfer, toDate } from '../../utils/financialRules';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnimatePresence, motion } from 'motion/react';

const COLOR_RECEITA = '#10b981';
const COLOR_DESPESA = '#dc2626';
const CARD_REPORT_CATEGORY = '__cartoes__';
const COLOR_CARTAO = '#f97316';

const getReportCategoryKey = (transaction: any) => (
  isInvoicePayment(transaction)
    ? CARD_REPORT_CATEGORY
    : (transaction.categoryId || 'outros')
);

const getInvoicePaymentInfo = (transaction: any, cards: any[]) => {
  const note = transaction.notes || '';
  const suffix = note.startsWith('pagamento_fatura:') ? note.replace('pagamento_fatura:', '') : '';
  // Baixas repetidas podem receber um sufixo técnico após o ciclo
  // (`cartao-ciclo:uuid`). O ciclo continua sendo a parte YYYY-MM.
  const match = suffix.match(/^(.*)-(\d{4}-\d{2})(?::.*)?$/);
  const cardId = match?.[1] || transaction.cardId;
  const cycleId = match?.[2] || null;
  const card = cards.find(c => c.id === cardId);

  if (card && cycleId) {
    const [year, month] = cycleId.split('-').map(Number);
    const dueDate = new Date(year, month - 1, Math.min(card.dueDay, new Date(year, month, 0).getDate()));
    return { cardId, cycleId, cardName: card.name, dueDate };
  }

  if (card) {
    const cycle = getCycleId(new Date(transaction.date), card.closingDay, card.dueDay);
    return { cardId, cycleId: cycle.cycleId, cardName: card.name, dueDate: cycle.dueDate };
  }

  return { cardId: cardId || 'unknown', cycleId: cycleId || 'unknown', cardName: 'Cartão', dueDate: new Date(transaction.date) };
};

/**
 * Reapresenta a baixa da fatura pelas categorias dos lançamentos que ela
 * quitou. O movimento técnico continua sendo usado para o caixa, mas a
 * distribuição do relatório fica rastreável sem somar a fatura duas vezes.
 */
const expandInvoicePaymentsForReport = (transactions: any[], allTransactions: any[], cards: any[]) => (
  transactions.flatMap(transaction => {
    if (!isInvoicePayment(transaction)) return [transaction];

    const paymentDate = getCashDate(transaction);
    const invoiceInfo = getInvoicePaymentInfo(transaction, cards);
    const card = cards.find(currentCard => currentCard.id === invoiceInfo.cardId);
    if (!paymentDate || !card || invoiceInfo.cycleId === 'unknown') return [transaction];

    const cycleCharges = allTransactions.filter(charge => {
      if (!isCardCharge(charge) || charge.type !== 'despesa' || !charge.isPaid) return false;
      if (charge.cardId !== invoiceInfo.cardId) return false;
      if (getCycleId(toDate(charge.date) || charge.date, card.closingDay, card.dueDay).cycleId !== invoiceInfo.cycleId) return false;
      return true;
    });

    const paidCharges = cycleCharges.filter(charge => {
      const chargePaymentDate = getCashDate(charge);
      return Boolean(chargePaymentDate && chargePaymentDate.getTime() === paymentDate.getTime());
    });

    if (paidCharges.length === 0) {
      // Compatibilidade com faturas quitadas antes de existir paymentDate nas
      // compras: se o valor da baixa fecha exatamente com o ciclo, podemos
      // reapresentar as categorias sem criar uma saída duplicada.
      const cycleTotal = cycleCharges.reduce((total, charge) => total + charge.amount, 0);
      if (Math.round(cycleTotal * 100) === Math.round(transaction.amount * 100)) {
        return cycleCharges.map(charge => ({
          ...charge,
          id: `${transaction.id}:${charge.id}`,
          date: paymentDate,
          paymentDate,
        }));
      }

      return [transaction];
    }

    return paidCharges.map(charge => ({
      ...charge,
      id: `${transaction.id}:${charge.id}`,
      date: paymentDate,
      paymentDate,
    }));
  })
);

const getReportSourceLabel = (transaction: any, cards: any[]) => {
  if (!transaction.cardId || transaction.cardId === 'money') return 'Transações';
  const card = cards.find(currentCard => currentCard.id === transaction.cardId);
  return card ? `Cartão ${card.name}` : 'Cartão';
};

export function ReportsView() {
  const [isExporting, setIsExporting] = useState(false);

  const allTransactions = useDataStore(state => state.transactions);
  const allCategories = useDataStore(state => state.categories);
  const cards = useDataStore(state => state.cards);
  const accounts = useDataStore(state => state.accounts);

  // Saldo disponível é uma fotografia do caixa atual e não deve mudar quando
  // o usuário consulta outro mês ou alterna entre realizado e projetado.
  // Investimentos permanecem separados porque não são caixa de uso imediato.
  const cashAccounts = useMemo(() => accounts
    .filter(account => ['corrente', 'poupança', 'carteira'].includes(account.type)), [accounts]);
  const cashAccountIds = useMemo(() => new Set(cashAccounts.map(account => account.id)), [cashAccounts]);
  const currentBalance = useMemo(() => cashAccounts
    .reduce((total, account) => total + (Number.isFinite(account.balance) ? account.balance : 0), 0), [cashAccounts]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);
  const [reportMode, setReportMode] = useState<'realized' | 'projected' | 'comparison'>('realized');

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  let periodLabel = '';
  if (isCustomMode) {
    const s = new Date(customStart + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();
    const e = new Date(customEnd + 'T23:59:59').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }).replace('.', '').toUpperCase();
    periodLabel = `${s} – ${e}`;
  } else {
    const month = currentMonth.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    const year = currentMonth.getFullYear();
    periodLabel = `${month}/${year}`;
  }

  // Helpers to get start and end dates
  const start = isCustomMode ? new Date(customStart + 'T00:00:00') : currentMonth;
  const end = isCustomMode ? new Date(customEnd + 'T23:59:59') : new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

  const prevStart = isCustomMode ? new Date(start.getTime() - (end.getTime() - start.getTime())) : new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const prevEnd = isCustomMode ? new Date(start.getTime() - 1) : new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0, 23, 59, 59);

  // Relatórios representam caixa realizado. Compras de cartão entram quando
  // a fatura é paga, por meio da transação técnica de pagamento da fatura.
  const getEffectiveDate = (t: any) => getCashDate(t);

  // Para pendências, cartão usa a data de vencimento da fatura; os demais
  // lançamentos usam a própria data prevista.
  const getForecastDate = (t: any) => {
    if (t.isPaid) return getCashDate(t);
    const date = toDate(t.date);
    if (!date) return null;
    if (!t.cardId || t.cardId === 'money') return date;
    const card = cards.find(c => c.id === t.cardId);
    return card ? getCycleId(date, card.closingDay, card.dueDay).dueDate : date;
  };

  // Transactions within selected range
  const filtered = useMemo(
    () => allTransactions.filter(t => {
      if (!isRealizedCashFlow(t)) return false;
      const d = getEffectiveDate(t);
      return Boolean(d && d >= start && d <= end);
    }),
    [allTransactions, start, end]
  );

  const pendingFiltered = useMemo(
    () => allTransactions.filter(t => {
      if (t.isPaid || isTransfer(t)) return false;
      const d = getForecastDate(t);
      return Boolean(d && d >= start && d <= end);
    }),
    [allTransactions, start, end, cards]
  );

  // Para o mês atual ou um mês futuro, o saldo projetado parte do saldo real
  // de hoje e considera somente pendências posteriores a hoje. Transações
  // pagas já estão materializadas no saldo e nunca podem ser somadas de novo,
  // mesmo quando seu timestamp está à frente do relógio atual.
  const projectedBalanceFlow = useMemo(() => {
    const now = new Date();
    if (end < now) return null;

    return allTransactions.reduce((flow, transaction) => {
      if (!isPendingProjectedCashFlow(transaction)) return flow;

      const date = getForecastDate(transaction);
      if (!date || date <= now || date > end) return flow;

      if (transaction.type === 'receita') {
        return { receitas: flow.receitas + transaction.amount, despesas: flow.despesas };
      }
      return { receitas: flow.receitas, despesas: flow.despesas + transaction.amount };
    }, { receitas: 0, despesas: 0 });
  }, [allTransactions, cards, end]);

  const projectedBalance = projectedBalanceFlow === null
    ? null
    : currentBalance + projectedBalanceFlow.receitas - projectedBalanceFlow.despesas;

  // Para períodos passados, o saldo atual não pode ser usado como se fosse o
  // saldo daquele mês. Reconstituímos o fechamento retirando do saldo atual
  // os movimentos realizados depois do fim do período, apenas nas contas de
  // caixa. Isso mantém a consulta histórica coerente sem criar snapshots.
  const historicalBalance = useMemo(() => {
    const now = new Date();
    if (end >= now) return null;

    const movementsAfterPeriod = allTransactions.reduce((total, transaction) => {
      const date = getCashDate(transaction);
      if (!date || date <= end || !isRealizedCashFlow(transaction)) return total;
      if (!transaction.accountId || !cashAccountIds.has(transaction.accountId)) return total;
      return total + getCashImpact(transaction);
    }, 0);

    return currentBalance - movementsAfterPeriod;
  }, [allTransactions, cashAccountIds, currentBalance, end]);

  const closingBalance = projectedBalance ?? historicalBalance ?? currentBalance;
  const isProjectedClosingBalance = reportMode === 'projected';
  const closingBalanceLabel = reportMode === 'comparison'
    ? 'Saldos'
    : isProjectedClosingBalance
    ? (projectedBalance !== null ? 'Saldo projetado' : 'Saldo histórico')
    : 'Saldo atual';
  const closingBalanceDescription = reportMode === 'comparison'
    ? 'Saldo atual comparado ao fechamento previsto.'
    : isProjectedClosingBalance
    ? (projectedBalance !== null
      ? 'Saldo atual + movimentos restantes até o fim do período.'
      : 'Saldo reconstruído a partir dos movimentos realizados após o período.')
    : 'Saldo real disponível, independente do período consultado.';

  const prevFiltered = useMemo(
    () => allTransactions.filter(t => {
      if (!isRealizedCashFlow(t)) return false;
      const d = getEffectiveDate(t);
      return Boolean(d && d >= prevStart && d <= prevEnd);
    }),
    [allTransactions, prevStart, prevEnd]
  );

  const prevPendingFiltered = useMemo(
    () => allTransactions.filter(t => {
      if (t.isPaid || isTransfer(t)) return false;
      const d = getForecastDate(t);
      return Boolean(d && d >= prevStart && d <= prevEnd);
    }),
    [allTransactions, prevStart, prevEnd, cards]
  );

  // Calculate totals
  const calcTotals = (txs: any[]) => {
    const receitas = txs.filter(t => t.type === 'receita' && !t.notes?.startsWith('transferencia:')).reduce((s, t) => s + t.amount, 0);
    const despesas = txs
      .filter(t => t.type === 'despesa' && !t.notes?.startsWith('transferencia:'))
      .reduce((s, t) => s + t.amount, 0);
    return { receitas, despesas, balanco: receitas - despesas };
  };

  const realizedTotals = calcTotals(filtered);
  const pendingTotals = calcTotals(pendingFiltered);
  const projectedTotals = calcTotals([...filtered, ...pendingFiltered]);
  const prevRealizedTotals = calcTotals(prevFiltered);
  const prevProjectedTotals = calcTotals([...prevFiltered, ...prevPendingFiltered]);
  const currentTotals = reportMode === 'projected' ? projectedTotals : realizedTotals;
  const prevTotals = reportMode === 'projected' ? prevProjectedTotals : prevRealizedTotals;
  const categoryTransactions = useMemo(() => {
    const baseTransactions = reportMode === 'realized' ? filtered : [...filtered, ...pendingFiltered];
    return expandInvoicePaymentsForReport(baseTransactions, allTransactions, cards);
  }, [reportMode, filtered, pendingFiltered, allTransactions, cards]);

  const realizedSavingsRate = realizedTotals.receitas > 0 ? (realizedTotals.balanco / realizedTotals.receitas) * 100 : 0;
  const projectedSavingsRate = projectedTotals.receitas > 0 ? (projectedTotals.balanco / projectedTotals.receitas) * 100 : 0;
  const savingsRate = reportMode === 'projected' ? projectedSavingsRate : realizedSavingsRate;

  // Percentage differences
  const getDiff = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return ((current - prev) / prev) * 100;
  };

  const diffReceitas = getDiff(currentTotals.receitas, prevTotals.receitas);
  const diffDespesas = getDiff(currentTotals.despesas, prevTotals.despesas);

  // Categories
  const getCategories = (type: 'receita' | 'despesa') => {
    const map = new Map<string, number>();
    const txs = categoryTransactions.filter(t => t.type === type && !t.notes?.startsWith('transferencia:'));

    txs.forEach(t => {
      // Compras no cartão preservam a categoria original para que o relatório
      // mostre, por exemplo, Alimentação e Combustível. A baixa técnica da
      // fatura continua em Cartões para não misturar o débito da conta com a
      // categoria da compra.
      const categoryKey = getReportCategoryKey(t);
      map.set(categoryKey, (map.get(categoryKey) || 0) + t.amount);
    });
    const total = txs.reduce((s, t) => s + t.amount, 0);
    if (total === 0) return [];

    return Array.from(map.entries())
      .map(([catId, amount]) => {
        if (catId === CARD_REPORT_CATEGORY) {
          return { categoryKey: catId, name: 'Cartões', percentage: (amount / total) * 100, amount, color: COLOR_CARTAO };
        }
        const cat = allCategories.find(c => c.id === catId);
        return { categoryKey: catId, name: cat?.name || 'Outros', percentage: (amount / total) * 100, amount, color: cat?.color || (type === 'receita' ? COLOR_RECEITA : '#888888') };
      })
      .sort((a, b) => b.amount - a.amount);
  };

  const incomeCategories = useMemo(() => getCategories('receita'), [categoryTransactions, allCategories]);
  const expenseCategories = useMemo(() => getCategories('despesa'), [categoryTransactions, allCategories]);
  const [expandedCategoryKey, setExpandedCategoryKey] = useState<string | null>(null);
  const [isProjectedBalanceBreakdownOpen, setIsProjectedBalanceBreakdownOpen] = useState(false);

  useEffect(() => {
    setExpandedCategoryKey(null);
    setIsProjectedBalanceBreakdownOpen(false);
  }, [currentMonth, customStart, customEnd, isCustomMode, reportMode]);

  const categoryDetailsByKey = useMemo(() => {
    const groups = new Map<string, any>();

    categoryTransactions
      .filter(transaction => !isTransfer(transaction))
      .forEach(transaction => {
        const categoryKey = getReportCategoryKey(transaction);
        const reportKey = `${transaction.type}:${categoryKey}`;

        if (categoryKey === CARD_REPORT_CATEGORY) {
          const cardInfo = getInvoicePaymentInfo(transaction, cards);
          const detailKey = `${reportKey}:${cardInfo.cardId}:${cardInfo.cycleId}`;
          const existing = groups.get(detailKey);
          groups.set(detailKey, existing
            ? { ...existing, amount: existing.amount + transaction.amount }
            : {
              reportKey,
              detailKey,
              isCard: true,
              cardName: cardInfo.cardName,
              amount: transaction.amount,
              dueDate: cardInfo.dueDate,
            });
          return;
        }

        const installmentGroup = transaction.parentId || transaction.id;
        const detailKey = `${reportKey}:${installmentGroup}`;
        const existing = groups.get(detailKey);
        const sourceLabel = getReportSourceLabel(transaction, cards);
        groups.set(detailKey, existing
          ? {
            ...existing,
            amount: existing.amount + transaction.amount,
            installmentCount: existing.installmentCount + 1,
            totalInstallments: Math.max(existing.totalInstallments, transaction.installments || 1),
            sourceLabels: Array.from(new Set([...existing.sourceLabels, sourceLabel])),
          }
          : {
            reportKey,
            detailKey,
            isCard: false,
            description: transaction.description,
            amount: transaction.amount,
            installmentCount: 1,
            totalInstallments: transaction.installments || 1,
            sourceLabels: [sourceLabel],
          });
      });

    const result = new Map<string, any[]>();
    Array.from(groups.values()).forEach(detail => {
      const current = result.get(detail.reportKey) || [];
      current.push(detail);
      result.set(detail.reportKey, current);
    });
    result.forEach(details => details.sort((a, b) => b.amount - a.amount));
    return result;
  }, [categoryTransactions, cards]);

  const renderCategoryCard = (category: any, type: 'receita' | 'despesa') => {
    const reportKey = `${type}:${category.categoryKey}`;
    const expanded = expandedCategoryKey === reportKey;
    const details = categoryDetailsByKey.get(reportKey) || [];
    const isIncome = type === 'receita';

    return (
      <div key={reportKey} className="bg-card border border-border/50 shadow-sm rounded-[12px] overflow-hidden">
        <button
          type="button"
          onClick={() => setExpandedCategoryKey(expanded ? null : reportKey)}
          className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
          aria-expanded={expanded}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
              <span className="text-xs font-semibold truncate">{category.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <span className={`text-xs font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{formatCurrency(category.amount)}</span>
                <span className="text-[9px] text-muted-foreground ml-1.5 font-bold uppercase">{category.percentage.toFixed(0)}%</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </div>
          </div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${category.percentage}%`, backgroundColor: category.color }} />
          </div>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/50 bg-muted/10 px-3 pb-3 pt-1.5 flex flex-col gap-1.5">
                {details.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground py-2">Nenhum lançamento encontrado no período.</div>
                ) : details.map(detail => (
                  detail.isCard ? (
                    <div key={detail.detailKey} className="rounded-lg bg-background border border-border/50 px-2.5 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold truncate">{detail.cardName}</div>
                        <div className="text-[9px] text-muted-foreground">Vencimento: {detail.dueDate.toLocaleDateString('pt-BR')}</div>
                        <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">
                          Cartão {detail.cardName}
                        </span>
                      </div>
                      <div className={`text-[10px] font-bold shrink-0 ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(detail.amount)}
                      </div>
                    </div>
                  ) : (
                    <div key={detail.detailKey} className="rounded-lg bg-background border border-border/50 px-2.5 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold truncate">{detail.description}</div>
                        <div className="text-[9px] text-muted-foreground">
                          {detail.totalInstallments > 1
                            ? `${detail.installmentCount === detail.totalInstallments ? detail.totalInstallments : `${detail.installmentCount} de ${detail.totalInstallments}`} parcela(s)`
                            : 'Lançamento avulso'}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(detail.sourceLabels || [`Cartão ${detail.cardName}`]).map((source: string) => (
                            <span key={source} className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={`text-[10px] font-bold shrink-0 ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                        {isIncome ? '+' : '-'}{formatCurrency(detail.amount)}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const modeDescription = reportMode === 'realized'
    ? 'Somente o que já foi pago ou recebido.'
    : reportMode === 'projected'
      ? `Realizado + ${pendingFiltered.length} pendência(s) prevista(s) no período. O saldo projetado considera somente o que ainda falta.`
      : 'Compare o realizado com o fechamento esperado do período.';

  const modeLabel = reportMode === 'realized'
    ? 'realizadas'
    : reportMode === 'projected'
      ? 'projetadas'
      : '';

  const periodFlowTitle = reportMode === 'realized'
    ? 'Fluxo realizado do período'
    : reportMode === 'projected'
      ? 'Fluxo total do período'
      : 'Fluxo do período';

  const getPeriodFlowDescription = (flow: number) => {
    if (flow < 0) {
      return `Saídas superaram as entradas em ${formatCurrency(Math.abs(flow))}. Isso não representa saldo negativo; saldo atual: ${formatCurrency(currentBalance)}.`;
    }

    if (flow > 0) {
      return `Entradas superaram as saídas em ${formatCurrency(flow)} no período. Saldo atual: ${formatCurrency(currentBalance)}.`;
    }

    return `Entradas e saídas ficaram equilibradas no período. Saldo atual: ${formatCurrency(currentBalance)}.`;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-[11px] shadow-xl p-3 text-[10px] min-w-[130px]">
        <p className="font-bold text-foreground mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
          {data.name}
        </p>
        <p className="font-bold" style={{ color: data.color }}>{formatCurrency(data.amount)}</p>
        <p className="text-muted-foreground font-medium mt-0.5">{data.percentage.toFixed(1)}% das despesas</p>
      </div>
    );
  };

  const handleExportPDF = () => {
    setIsExporting(true);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const margin = 12;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - (margin * 2);
      const contentBottom = pageHeight - 14;
      let cursorY = 12;
      const generatedAt = new Date().toLocaleString('pt-BR');
      const modeTitle = reportMode === 'realized' ? 'Realizado' : reportMode === 'projected' ? 'Projetado' : 'Comparativo';

      const addPageHeader = () => {
        doc.setFillColor(249, 115, 22);
        doc.roundedRect(margin, cursorY, 24, 1.8, 0.9, 0.9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(31, 41, 55);
        doc.text('Relatório financeiro', margin, cursorY + 8.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(`${periodLabel.replace('–', '-')}  |  ${modeTitle}`, margin, cursorY + 15);
        doc.text(`Gerado em ${generatedAt}`, pageWidth - margin, cursorY + 15, { align: 'right' });
        cursorY += 21;
      };

      const ensureSpace = (height: number) => {
        if (cursorY + height > contentBottom) {
          doc.addPage();
          cursorY = 12;
          addPageHeader();
        }
      };

      const addSectionTitle = (title: string) => {
        ensureSpace(8);
        doc.setDrawColor(249, 115, 22);
        doc.setLineWidth(0.7);
        doc.line(margin, cursorY + 0.5, margin + 8, cursorY + 0.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(55, 65, 81);
        doc.text(title, margin + 11, cursorY + 3.5);
        cursorY += 8;
      };

      const addSummaryCards = (items: Array<{ label: string; value: string; hint?: string; tone?: 'default' | 'positive' | 'negative' | 'projected' }>) => {
        const gap = 3;
        const cardWidth = (contentWidth - (gap * 3)) / 4;
        const cardHeight = 22;
        ensureSpace(cardHeight + 4);

        const getValueColor = (tone: 'default' | 'positive' | 'negative' | 'projected') => {
          if (tone === 'positive') return [5, 150, 105] as [number, number, number];
          if (tone === 'negative') return [225, 29, 72] as [number, number, number];
          if (tone === 'projected') return [234, 88, 12] as [number, number, number];
          return [31, 41, 55] as [number, number, number];
        };

        items.forEach((item, index) => {
          const x = margin + (index * (cardWidth + gap));
          const y = cursorY;
          doc.setFillColor(250, 250, 249);
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.4);
          doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.1);
          doc.setTextColor(107, 114, 128);
          doc.text(item.label.toUpperCase(), x + 4, y + 6);
          doc.setFontSize(8.4);
          doc.setTextColor(...getValueColor(item.tone || 'default'));
          doc.text(item.value, x + 4, y + 14.5);
          if (item.hint) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(156, 163, 175);
            const hint = doc.splitTextToSize(item.hint, cardWidth - 8)[0];
            doc.text(hint, x + 4, y + 19.5);
          }
        });

        cursorY += cardHeight + 7;
      };

      const addTable = (head: string[], body: any[][], widths?: number[]) => {
        autoTable(doc, {
          head: [head],
          body,
          startY: cursorY,
          margin: { left: margin, right: margin },
          theme: 'plain',
          pageBreak: 'auto',
          rowPageBreak: 'avoid',
          showHead: 'everyPage',
          styles: { fontSize: 7.3, cellPadding: { top: 1.8, right: 3, bottom: 1.8, left: 3 }, textColor: [55, 65, 81], lineColor: [229, 231, 235], lineWidth: 0.2 },
          headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [250, 250, 249] },
          bodyStyles: { lineColor: [229, 231, 235], lineWidth: 0.2 },
          columnStyles: widths?.reduce((styles, width, index) => {
            styles[index] = { cellWidth: width, ...(index > 0 ? { halign: 'right' as const } : {}) };
            return styles;
          }, {} as Record<number, { cellWidth?: number; halign?: 'left' | 'right' | 'center' }>)
        });
        const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || cursorY;
        cursorY = finalY + 5;
      };

      const addFlowCard = (rows: Array<[string, string]>, note?: string) => {
        const rowHeight = 6.5;
        const cardHeight = (rows.length * rowHeight) + (note ? 11 : 6);
        ensureSpace(cardHeight + 6);
        doc.setFillColor(255, 247, 237);
        doc.setDrawColor(253, 186, 116);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, cursorY, contentWidth, cardHeight, 3, 3, 'FD');

        rows.forEach(([label, value], index) => {
          const rowY = cursorY + 5.5 + (index * rowHeight);
          if (index > 0) {
            doc.setDrawColor(254, 215, 170);
            doc.setLineWidth(0.25);
            doc.line(margin + 5, rowY - 3.2, pageWidth - margin - 5, rowY - 3.2);
          }
          doc.setFont('helvetica', index === rows.length - 1 ? 'bold' : 'normal');
          doc.setFontSize(index === rows.length - 1 ? 8.2 : 7.3);
          doc.setTextColor(index === rows.length - 1 ? 31 : 75, index === rows.length - 1 ? 41 : 85, index === rows.length - 1 ? 55 : 99);
          doc.text(label, margin + 6, rowY);
          doc.text(value, pageWidth - margin - 6, rowY, { align: 'right' });
        });

        if (note) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.2);
          doc.setTextColor(107, 114, 128);
          doc.text(doc.splitTextToSize(note, contentWidth - 12)[0], margin + 6, cursorY + cardHeight - 4);
        }
        cursorY += cardHeight + 6;
      };

      const hexToRgb = (hex: string): [number, number, number] => {
        const normalized = hex.replace('#', '');
        const value = normalized.length === 3
          ? normalized.split('').map(char => char + char).join('')
          : normalized;
        const parsed = Number.parseInt(value, 16);
        return Number.isNaN(parsed)
          ? [156, 163, 175]
          : [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
      };

      const addPieChart = (categories: Array<{ name: string; amount: number; percentage: number; color: string }>) => {
        if (categories.length === 0) return;

        const chartItems = categories.length > 7
          ? [
            ...categories.slice(0, 6),
            {
              name: 'Outros',
              amount: categories.slice(6).reduce((sum, category) => sum + category.amount, 0),
              percentage: categories.slice(6).reduce((sum, category) => sum + category.percentage, 0),
              color: '#9ca3af',
            },
          ]
          : categories;
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 360;
        const context = canvas.getContext('2d');
        if (!context) return;

        const center = 150;
        const radius = 124;
        let startAngle = -Math.PI / 2;
        chartItems.forEach(category => {
          const sliceAngle = (category.percentage / 100) * Math.PI * 2;
          context.beginPath();
          context.moveTo(center, center);
          context.arc(center, center, radius, startAngle, startAngle + sliceAngle);
          context.closePath();
          context.fillStyle = category.color || '#9ca3af';
          context.fill();
          startAngle += sliceAngle;
        });
        context.beginPath();
        context.arc(center, center, radius * 0.58, 0, Math.PI * 2);
        context.fillStyle = '#ffffff';
        context.fill();

        const chartCardHeight = 48;
        const chartSize = 38;
        ensureSpace(chartCardHeight + 4);
        const chartCardStartY = cursorY;
        doc.setFillColor(250, 250, 249);
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, chartCardStartY, contentWidth, chartCardHeight, 3, 3, 'FD');
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin + 4, cursorY + 5, chartSize, chartSize);
        const legendLineHeight = 5.5;
        const legendHeight = chartItems.length * legendLineHeight;
        let legendY = cursorY + ((chartCardHeight - legendHeight) / 2) + 3.5;
        const legendX = margin + 53;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.9);
        chartItems.forEach(category => {
          doc.setFillColor(...hexToRgb(category.color || '#9ca3af'));
          doc.roundedRect(legendX, legendY - 2.4, 2.5, 2.5, 0.8, 0.8, 'F');
          doc.setTextColor(55, 65, 81);
          doc.text(category.name, legendX + 6, legendY);
          doc.setTextColor(107, 114, 128);
          doc.text(`${formatCurrency(category.amount)} · ${category.percentage.toFixed(1)}%`, pageWidth - margin - 5, legendY, { align: 'right' });
          legendY += legendLineHeight;
        });
        cursorY += chartCardHeight + 5;
      };

      addPageHeader();
      addSectionTitle('Resumo do período');

      const formatSigned = (value: number) => `${value >= 0 ? '+' : ''}${formatCurrency(value)}`;
      const summaryCards = reportMode === 'comparison'
        ? [
          { label: 'Saldo atual', value: formatCurrency(currentBalance), hint: 'Contas + carteira', tone: currentBalance >= 0 ? 'positive' as const : 'negative' as const },
          { label: 'Saldo projetado', value: formatCurrency(closingBalance), hint: 'Fechamento', tone: 'projected' as const },
          { label: 'Fluxo realizado', value: formatSigned(realizedTotals.balanco), hint: `${realizedSavingsRate.toFixed(1)}% poupança`, tone: realizedTotals.balanco >= 0 ? 'positive' as const : 'negative' as const },
          { label: 'Fluxo projetado', value: formatSigned(projectedTotals.balanco), hint: `${projectedSavingsRate.toFixed(1)}% poupança`, tone: 'projected' as const },
        ]
        : [
          { label: reportMode === 'projected' ? 'Saldo projetado' : 'Saldo atual', value: formatCurrency(reportMode === 'projected' ? closingBalance : currentBalance), hint: reportMode === 'projected' ? 'Fechamento' : 'Contas + carteira', tone: reportMode === 'projected' ? 'projected' as const : currentBalance >= 0 ? 'positive' as const : 'negative' as const },
          { label: 'Entradas', value: formatCurrency(currentTotals.receitas), hint: modeLabel || 'período', tone: 'positive' as const },
          { label: 'Saídas', value: formatCurrency(currentTotals.despesas), hint: modeLabel || 'período', tone: 'negative' as const },
          { label: 'Resultado', value: formatSigned(currentTotals.balanco), hint: `${savingsRate.toFixed(1)}% poupança`, tone: currentTotals.balanco >= 0 ? 'positive' as const : 'negative' as const },
        ];
      addSummaryCards(summaryCards);

      if (reportMode === 'projected' && projectedBalance !== null && projectedBalanceFlow) {
        addSectionTitle('Como o saldo projetado é formado');
        addFlowCard([
          ['Saldo inicial (saldo atual)', formatCurrency(currentBalance)],
          ['+ Entradas previstas até o fechamento', formatCurrency(projectedBalanceFlow.receitas)],
          ['- Saídas previstas até o fechamento', formatCurrency(projectedBalanceFlow.despesas)],
          ['= Saldo projetado', formatCurrency(projectedBalance)],
        ]);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(107, 114, 128);
      doc.text(doc.splitTextToSize(modeDescription, contentWidth)[0], margin, cursorY);
      cursorY += 6;

      if (expenseCategories.length > 0) {
        ensureSpace(8 + 48 + 5);
        addSectionTitle(`Despesas ${reportMode === 'realized' ? 'realizadas' : 'projetadas'}`);
        addPieChart(expenseCategories);
        addTable(
          ['Categoria', 'Valor', 'Participação'],
          expenseCategories.map(category => [category.name, formatCurrency(category.amount), `${category.percentage.toFixed(1)}%`]),
          [contentWidth - 58, 31, 27]
        );
      }

      if (incomeCategories.length > 0) {
        ensureSpace(8 + 11);
        addSectionTitle(`Fontes de renda ${reportMode === 'realized' ? 'realizadas' : 'projetadas'}`);
        addTable(
          ['Categoria', 'Valor', 'Participação'],
          incomeCategories.map(category => [category.name, formatCurrency(category.amount), `${category.percentage.toFixed(1)}%`]),
          [contentWidth - 58, 31, 27]
        );
      }

      if (expenseCategories.length === 0 && incomeCategories.length === 0) {
        addSectionTitle('Detalhamento');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text('Nenhum lançamento no período selecionado.', margin, cursorY + 3);
      }

      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(`FinWill · Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
      }

      const safePeriod = periodLabel.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      doc.save(`relatorio-${safePeriod || 'periodo'}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF', error);
      alert('Erro ao gerar PDF do relatório.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative pt-6 px-4 max-w-6xl mx-auto w-full pb-16 overflow-y-auto lg:px-8">
      <div className="bg-background pb-6 pt-2">
        {/* Header and Fast Navigation */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3 relative px-1">
          <div>
            <h1 className="text-xl font-bold tracking-tight mb-0.5">Relatório</h1>
          </div>

          <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
            <div className="flex items-center w-full gap-2 justify-between sm:justify-end">
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="hide-in-pdf flex shrink-0 items-center justify-center gap-1.5 h-[34px] px-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-500 hover:bg-rose-500/20 transition-all disabled:opacity-50 shadow-sm"
                title="Salvar como PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-widest hidden xs:inline">PDF</span>
              </button>
              <div className="flex items-center w-full sm:w-auto bg-card border border-border rounded-xl p-1 shadow-sm justify-between sm:justify-start">
                {!isCustomMode && (
                  <button onClick={handlePrevMonth} className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all shrink-0">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest flex-1 sm:flex-initial sm:min-w-[120px] text-center px-2">
                  {periodLabel}
                </span>
                {!isCustomMode && (
                  <button onClick={handleNextMonth} className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <div className="w-[1px] h-4 bg-border mx-1 shrink-0" />
                <button onClick={() => setShowCalendarMenu(!showCalendarMenu)} className={`p-1.5 rounded-lg transition-colors shrink-0 ${showCalendarMenu || isCustomMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                  <CalendarDays className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Popover for custom date */}
            {showCalendarMenu && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-card border border-border shadow-xl rounded-xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Período Customizado</span>
                  {isCustomMode && (
                    <button onClick={() => { setIsCustomMode(false); setShowCalendarMenu(false); }} className="text-[9px] font-bold uppercase text-primary hover:underline">
                      Resetar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground mb-1 block">De</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                      className="w-full bg-muted/50 border border-transparent focus:border-primary/50 focus:bg-background rounded-lg text-xs h-8 px-2 outline-none uppercase font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-muted-foreground mb-1 block">Até</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                      className="w-full bg-muted/50 border border-transparent focus:border-primary/50 focus:bg-background rounded-lg text-xs h-8 px-2 outline-none uppercase font-medium"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {[
                    { label: 'Este ano', fn: () => { const d = new Date(); setCustomStart(`${d.getFullYear()}-01-01`); setCustomEnd(`${d.getFullYear()}-12-31`); } },
                    { label: 'Últimos 30 dias', fn: () => { const d = new Date(); const p = new Date(d); p.setDate(p.getDate() - 30); setCustomStart(p.toISOString().split('T')[0]); setCustomEnd(d.toISOString().split('T')[0]); } },
                    { label: 'Últimos 6 meses', fn: () => { const d = new Date(); const p = new Date(d); p.setMonth(p.getMonth() - 6); setCustomStart(p.toISOString().split('T')[0]); setCustomEnd(d.toISOString().split('T')[0]); } },
                  ].map((shortcut) => (
                    <button key={shortcut.label} onClick={shortcut.fn} className="text-[9px] font-bold uppercase tracking-wider bg-muted hover:bg-muted/80 text-muted-foreground px-2 py-1 rounded-md transition-colors">
                      {shortcut.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => { setIsCustomMode(true); setShowCalendarMenu(false); }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase tracking-wider h-8 rounded-lg transition-colors"
                >
                  Aplicar
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="mb-5 px-1">
          <div className="flex w-full bg-muted p-1 rounded-xl gap-1">
            {([
              ['realized', 'Realizado'],
              ['projected', 'Projetado'],
              ['comparison', 'Comparativo'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setReportMode(value)}
                className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${reportMode === value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground font-medium mt-2 px-1">{modeDescription}</p>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-card border rounded-[14px] p-2.5 shadow-sm flex flex-col col-span-2">
            <div className="flex justify-between items-center mb-1">
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{closingBalanceLabel}</div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Contas + carteira</div>
            </div>
            {reportMode === 'comparison' ? (
              <div className="flex flex-col gap-0.5 text-[11px] font-bold">
                <span className={currentBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>Atual: {formatCurrency(currentBalance)}</span>
                <span className={closingBalance >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-orange-600 dark:text-orange-400'}>Proj.: {formatCurrency(closingBalance)}</span>
              </div>
            ) : (
              <div className={`text-lg font-bold tracking-tight ${closingBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCurrency(isProjectedClosingBalance ? closingBalance : currentBalance)}
              </div>
            )}
            {!(reportMode === 'projected' && projectedBalance !== null) && (
              <div className="text-[9px] text-muted-foreground font-medium mt-1">{closingBalanceDescription}</div>
            )}

            {reportMode === 'projected' && projectedBalance !== null && projectedBalanceFlow && (
              <div className="mt-3 overflow-hidden rounded-xl border border-sky-500/20 bg-sky-500/5">
                <button
                  type="button"
                  onClick={() => setIsProjectedBalanceBreakdownOpen(open => !open)}
                  className="flex w-full items-center justify-between px-2.5 py-2 text-left transition-colors hover:bg-sky-500/10"
                  aria-expanded={isProjectedBalanceBreakdownOpen}
                  aria-controls="projected-balance-breakdown"
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">
                    Ver composição do saldo
                  </span>
                  <ChevronDown className={`h-4 w-4 text-sky-700 transition-transform dark:text-sky-300 ${isProjectedBalanceBreakdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {isProjectedBalanceBreakdownOpen && (
                    <motion.div
                      id="projected-balance-breakdown"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="border-t border-sky-500/20"
                    >
                      <div className="px-2.5 pb-2.5 pt-2">
                        <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">
                          Como o saldo projetado é formado
                        </div>
                        <div className="flex flex-col gap-1 text-[10px] font-semibold">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Saldo atual</span>
                            <span>{formatCurrency(currentBalance)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-emerald-600 dark:text-emerald-400">+ Entradas restantes</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(projectedBalanceFlow.receitas)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-rose-600 dark:text-rose-400">− Saídas restantes</span>
                            <span className="text-rose-600 dark:text-rose-400">{formatCurrency(projectedBalanceFlow.despesas)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 border-t border-sky-500/20 pt-1.5 font-bold">
                            <span className="text-sky-700 dark:text-sky-300">= Saldo projetado</span>
                            <span className="text-sky-700 dark:text-sky-300">{formatCurrency(projectedBalance)}</span>
                          </div>
                        </div>
                        <div className="mt-2 text-[9px] font-medium leading-relaxed text-muted-foreground">
                          O fluxo do período abaixo inclui valores já realizados; este quadro mostra apenas o que falta até o fim.
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="bg-card border rounded-[14px] p-2.5 shadow-sm flex flex-col">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{reportMode === 'comparison' ? 'Entradas' : `Entradas ${modeLabel}`}</div>
            {reportMode === 'comparison' ? (
              <div className="flex flex-col gap-0.5 text-[10px] font-bold">
                <span className="text-emerald-600 dark:text-emerald-400">Real.: {formatCurrency(realizedTotals.receitas)}</span>
                <span className="text-sky-600 dark:text-sky-400">Proj.: {formatCurrency(projectedTotals.receitas)}</span>
              </div>
            ) : (
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(currentTotals.receitas)}</div>
            )}
            {reportMode !== 'comparison' && prevTotals.receitas > 0 && !isCustomMode && (
              <div className={`text-[8px] font-bold uppercase tracking-widest mt-1.5 ${diffReceitas >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                {diffReceitas >= 0 ? '▲' : '▼'} {Math.abs(diffReceitas).toFixed(0)}% ref. mês ant.
              </div>
            )}
          </div>
          <div className="bg-card border rounded-[14px] p-2.5 shadow-sm flex flex-col">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{reportMode === 'comparison' ? 'Saídas' : `Saídas ${modeLabel}`}</div>
            {reportMode === 'comparison' ? (
              <div className="flex flex-col gap-0.5 text-[10px] font-bold">
                <span className="text-rose-600 dark:text-rose-400">Real.: {formatCurrency(realizedTotals.despesas)}</span>
                <span className="text-orange-600 dark:text-orange-400">Proj.: {formatCurrency(projectedTotals.despesas)}</span>
              </div>
            ) : (
              <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(currentTotals.despesas)}</div>
            )}
            {reportMode !== 'comparison' && prevTotals.despesas > 0 && !isCustomMode && (
              <div className={`text-[8px] font-bold uppercase tracking-widest mt-1.5 ${diffDespesas <= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                {diffDespesas > 0 ? '▲' : '▼'} {Math.abs(diffDespesas).toFixed(0)}% ref. mês ant.
              </div>
            )}
          </div>

          <div className="bg-card border rounded-[14px] p-2.5 shadow-sm flex flex-col col-span-2">
            <div className="flex justify-between items-center mb-1">
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                {periodFlowTitle}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Poupança no período</div>
            </div>
            <div className="flex justify-between items-end">
              {reportMode === 'comparison' ? (
                <div className="flex flex-col gap-0.5 text-[11px] font-bold">
                  <span className={realizedTotals.balanco >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>Real.: {realizedTotals.balanco >= 0 ? '+' : ''}{formatCurrency(realizedTotals.balanco)}</span>
                  <span className={projectedTotals.balanco >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-orange-600 dark:text-orange-400'}>Proj.: {projectedTotals.balanco >= 0 ? '+' : ''}{formatCurrency(projectedTotals.balanco)}</span>
                </div>
              ) : (
                <div className={`text-lg font-bold tracking-tight ${currentTotals.balanco >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {currentTotals.balanco >= 0 ? '+' : ''}{formatCurrency(currentTotals.balanco)}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {reportMode === 'comparison' ? (
                  <div className="flex flex-col items-end gap-0.5 text-[10px] font-bold">
                    <span className={realizedSavingsRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>Real.: {realizedSavingsRate.toFixed(1)}%</span>
                    <span className={projectedSavingsRate >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-orange-600 dark:text-orange-400'}>Proj.: {projectedSavingsRate.toFixed(1)}%</span>
                  </div>
                ) : (
                  <div className={`text-sm font-bold ${savingsRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {savingsRate.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
            {reportMode !== 'comparison' && (
              <div className="text-[9px] text-muted-foreground font-medium mt-2">
                {getPeriodFlowDescription(currentTotals.balanco)}
              </div>
            )}
            {savingsRate > 0 && (
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mt-3">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(savingsRate, 100)}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Donut Chart for Expenses */}
          {expenseCategories.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Distribuição de Despesas {reportMode === 'realized' ? 'Realizadas' : 'Projetadas'}</h2>
              <div className="p-3.5 bg-card border border-border/60 rounded-[16px] shadow-sm flex items-center justify-center gap-4">
                <div className="w-36 h-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1} initialDimension={{ width: 144, height: 144 }}>
                    <PieChart>
                      <Pie
                        data={expenseCategories}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="amount"
                        stroke="none"
                      >
                        {expenseCategories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomPieTooltip />} cursor={false} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center gap-2.5 pr-1">
                  {expenseCategories.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="font-semibold truncate text-[10px] uppercase tracking-wider">{cat.name}</span>
                      </div>
                      <span className="font-bold text-[10px] text-muted-foreground ml-2">{cat.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Expense categories Details */}
          {expenseCategories.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Maiores Gastos</h2>
              <div className="flex flex-col gap-2.5">
                {expenseCategories.map(category => renderCategoryCard(category, 'despesa'))}
              </div>
            </section>
          )}

          {/* Income categories Details */}
          {incomeCategories.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Fontes de Renda</h2>
              <div className="flex flex-col gap-2.5">
                {incomeCategories.map(category => renderCategoryCard(category, 'receita'))}
              </div>
            </section>
          )}

          {expenseCategories.length === 0 && incomeCategories.length === 0 && (
            <div className="text-center text-muted-foreground p-10 border border-dashed rounded-[16px] border-border/50 text-xs mx-1">
              Nenhum dado no mês selecionado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
