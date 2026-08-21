import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { getCycleId } from '../../utils/cycleUtils';
import { Card } from '../ui/card';
import { motion } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  WalletCards,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Cell, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '../../utils/formatters';

import { useAppStore } from '../../store/useAppStore';
import { getCashPeriodId, isRealizedCashFlow } from '../../utils/financialRules';



export function DashboardView() {
  const { setCurrentView, setActiveContextCardId } = useAppStore();
  const accounts = useDataStore(state => state.accounts);
  const cards = useDataStore(state => state.cards);
  const allTransactions = useDataStore(state => state.transactions);

  const transactions = useMemo(() => {
    const grouped = new Map<string, any>();
    const ungrouped: any[] = [];

    // Filter out transfer transactions
    const filteredTxs = allTransactions.filter(t => !t.notes?.startsWith('transferencia:'));

    // Sort transactions by createdAt descending so we process newer ones first
    // If createdAt is missing, use array index (assuming newest are at the end)
    const sortedAll = filteredTxs.map((t, index) => ({ t, index })).sort((a, b) => {
      if (a.t.createdAt && b.t.createdAt) {
        return new Date(b.t.createdAt).getTime() - new Date(a.t.createdAt).getTime();
      }
      return b.index - a.index;
    }).map(x => x.t);

    sortedAll.forEach(t => {
      if (t.parentId && t.installments && t.installments > 1) {
        if (!grouped.has(t.parentId)) {
          const cleanDesc = t.description.replace(/\s\(\d+\/\d+\)$/, '');
          grouped.set(t.parentId, {
            id: t.parentId,
            description: cleanDesc,
            amount: 0,
            date: t.date,
            type: t.type,
            isPaid: true,
            installments: t.installments,
            notes: t.notes,
            cardId: t.cardId,
            isGroupedInstallments: true,
            totalPaid: 0,
            installmentCount: t.installments,
            accountId: t.accountId,
            createdAt: t.createdAt,
            _originalIndex: sortedAll.findIndex(tx => tx.id === t.id)
          });
        }
        const groupObj = grouped.get(t.parentId);
        groupObj.amount += t.amount;
        if (t.isPaid) {
          groupObj.totalPaid += 1;
        } else {
          groupObj.isPaid = false;
        }
        if (t.date < groupObj.date) {
          groupObj.date = t.date;
        }
      } else {
        ungrouped.push({ ...t });
      }
    });

    const combined = [...ungrouped, ...Array.from(grouped.values())];
    return combined.sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // If one of them is missing createdAt, or both, sort based on their position in sortedAll
      const indexA = a.isGroupedInstallments ? a._originalIndex : sortedAll.findIndex(t => t.id === a.id);
      const indexB = b.isGroupedInstallments ? b._originalIndex : sortedAll.findIndex(t => t.id === b.id);
      return indexA - indexB;
    }).slice(0, 5);
  }, [allTransactions]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [selectedChartIndex, setSelectedChartIndex] = useState<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const totalBalance = accounts.reduce((acc, account) => acc + account.balance, 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentCycleId = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const currentMonthTransactions = allTransactions.filter(t =>
    isRealizedCashFlow(t) && getCashPeriodId(t) === currentCycleId
  );

  const totalIncomes = currentMonthTransactions
    .filter(t => t.type === 'receita' && !t.notes?.startsWith('transferencia:'))
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = currentMonthTransactions
    .filter(t => t.type === 'despesa' && !t.notes?.startsWith('transferencia:'))
    .reduce((acc, t) => acc + t.amount, 0);

  const pendingReceivables = allTransactions
    .filter(t => t.type === 'receita' && !t.isPaid && t.nature !== 'transferencia')
    .reduce((acc, t) => acc + t.amount, 0);
  const pendingPayables = allTransactions
    .filter(t => t.type === 'despesa' && !t.isPaid && t.nature !== 'transferencia')
    .reduce((acc, t) => acc + t.amount, 0);
  const partnerOutflows = currentMonthTransactions
    .filter(t => t.nature === 'pro_labore' || t.nature === 'retirada_extra')
    .reduce((acc, t) => acc + t.amount, 0);
  const operatingIncome = currentMonthTransactions
    .filter(t => t.type === 'receita' && (t.nature || 'operacional') === 'operacional')
    .reduce((acc, t) => acc + t.amount, 0);
  const operatingExpense = currentMonthTransactions
    .filter(t => t.type === 'despesa' && (t.nature || 'operacional') === 'operacional')
    .reduce((acc, t) => acc + t.amount, 0);

  const chartData = useMemo(() => {
    const data = [];
    const date = new Date();
    // 4 months back, current month, 4 months forward (total 9 columns)
    for (let i = 4; i >= -4; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const monthNumber = d.getMonth();
      const yearNumber = d.getFullYear();

      const cycleId = `${yearNumber}-${String(monthNumber + 1).padStart(2, '0')}`;
      const monthExpenses = allTransactions
        .filter(t => t.type === 'despesa' && isRealizedCashFlow(t) && getCashPeriodId(t) === cycleId)
        .reduce((sum, t) => sum + t.amount, 0);

      data.push({
        name: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), // Clean up period from abbreviation if any
        val: monthExpenses,
        isCurrentMonth: i === 0
      });
    }
    return data;
  }, [allTransactions, cards]);

  return (
    <div className="flex flex-col gap-5 p-4 pt-6 max-w-6xl mx-auto w-full lg:px-8">
      <header className="flex justify-between items-start mb-1 relative">
        <div>
          <h1 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Caixa disponível</h1>
          <div className="text-3xl font-black tracking-tight">{formatCurrency(totalBalance)}</div>
          <div className="mt-1 text-[11px] font-semibold text-muted-foreground">Resultado operacional: <span className={operatingIncome - operatingExpense >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(operatingIncome - operatingExpense)}</span>{partnerOutflows > 0 ? ` • retiradas ${formatCurrency(partnerOutflows)}` : ''}</div>
        </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="p-3.5 bg-card rounded-[11px] border shadow-sm">
          <div className="flex items-center gap-1.5 text-emerald-600 mb-0.5">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Entradas realizadas</span>
          </div>
          <div className="text-base font-bold text-foreground">{formatCurrency(totalIncomes)}</div>
        </div>
        <div className="p-3.5 bg-card rounded-[11px] border shadow-sm">
          <div className="flex items-center gap-1.5 text-rose-600 mb-0.5">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Saídas realizadas</span>
          </div>
          <div className="text-base font-bold text-foreground">{formatCurrency(totalExpenses)}</div>
        </div>
        <button type="button" onClick={() => setCurrentView('agendaReceivable')} className="p-3.5 bg-card rounded-[11px] border shadow-sm text-left hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-1.5 text-blue-600 mb-0.5"><TrendingUp className="h-3.5 w-3.5" /><span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">A receber</span></div>
          <div className="text-base font-bold text-foreground">{formatCurrency(pendingReceivables)}</div>
        </button>
        <button type="button" onClick={() => setCurrentView('agendaPayable')} className="p-3.5 bg-card rounded-[11px] border shadow-sm text-left hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-1.5 text-amber-600 mb-0.5"><TrendingDown className="h-3.5 w-3.5" /><span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">A pagar</span></div>
          <div className="text-base font-bold text-foreground">{formatCurrency(pendingPayables)}</div>
        </button>
      </div>

      {/* Credit Cards Summary */}
      <section className="mt-1">
        <div className="flex justify-between items-center mb-2 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Meus Cartões</h2>
          <button
            onClick={() => setCurrentView('cards')}
            className="text-primary text-[10px] font-bold flex items-center hover:opacity-80 transition-opacity"
          >
            VER TODOS <ChevronRight className="h-3 w-3 ml-0.5" />
          </button>
        </div>
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 select-none ${isDragging ? 'cursor-grabbing snap-none' : 'cursor-grab snap-x snap-mandatory'} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
        >
          {cards.length === 0 ? (
            <div className="text-center text-muted-foreground p-6 border border-dashed rounded-[11px] border-border/50 text-xs w-full">
              Nenhum cartão
            </div>
          ) : (
            cards.map(card => {
              const now = new Date();
              const { cycleId: currentCycle } = getCycleId(now, card.closingDay, card.dueDay);

              // Fatura atual is the sum of unpaid transactions in the current cycle
              const currentInvoice = allTransactions
                .filter(t => {
                  if (t.type !== 'despesa' || t.cardId !== card.id || t.isPaid) return false;
                  const { cycleId } = getCycleId(t.date, card.closingDay, card.dueDay);
                  return cycleId === currentCycle;
                })
                .reduce((acc, t) => acc + t.amount, 0);

              // Total unpaid across all cycles to accurately subtract from limit
              const totalUnpaid = allTransactions
                .filter(t => t.type === 'despesa' && t.cardId === card.id && !t.isPaid)
                .reduce((acc, t) => acc + t.amount, 0);

              return (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  key={card.id}
                  type="button"
                  onClick={() => {
                    setActiveContextCardId(card.id);
                    setCurrentView('cardDetails');
                  }}
                  aria-label={`Abrir cartão ${card.name}`}
                  className="flex-none w-[85%] sm:w-[300px] snap-center p-4 rounded-[11px] flex flex-col justify-between relative overflow-hidden text-left cursor-pointer outline-none ring-offset-2 transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-white/80"
                  style={{ backgroundColor: card.color }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 p-4 opacity-10">
                    <CreditCard className="h-28 w-28 -mr-8 text-white" />
                  </div>
                  <div className="relative z-10 text-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold opacity-90">{card.name}</div>
                      <div className="text-xs font-bold tracking-widest opacity-80">•••• {card.lastFour}</div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[9px] uppercase font-bold tracking-widest opacity-70 mb-0.5">Fatura atual</div>
                        <div className="text-lg font-bold">{formatCurrency(currentInvoice)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] uppercase font-bold tracking-widest opacity-70 mb-0.5">Disponível</div>
                        <div className="text-sm font-semibold">{formatCurrency(card.limit - totalUnpaid)}</div>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </section>

      {/* Monthly Evolution Chart */}
      <section className="mt-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Evolução de Gastos</h2>
        <div className="relative p-3 bg-card border rounded-[11px] shadow-sm h-48">
          {selectedChartIndex !== null && chartData[selectedChartIndex] && (
            <div
              className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-[11px] border bg-card px-3 py-2 text-xs font-semibold shadow-lg whitespace-nowrap"
              style={{ left: `${((selectedChartIndex + 0.5) / chartData.length) * 100}%` }}
            >
              {chartData[selectedChartIndex].name}: {formatCurrency(chartData[selectedChartIndex].val)}
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1} initialDimension={{ width: 800, height: 168 }}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }} dy={10} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(val) => val >= 1000 ? `R$ ${val / 1000}k` : `R$ ${val}`}
                width={62}
                tickMargin={6}
              />
              <Bar
                dataKey="val"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
                onClick={(entry: any) => {
                  const clicked = entry?.payload ?? entry;
                  const index = chartData.findIndex(item => item.name === clicked?.name && item.val === clicked?.val);
                  if (index >= 0) setSelectedChartIndex(index);
                }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={'hsl(var(--primary))'} className={entry.isCurrentMonth ? "opacity-100" : "opacity-40 hover:opacity-80 transition-opacity"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recent Transactions */}
      <section className="mt-1 mb-12">
        <div className="flex justify-between items-center mb-2 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Transações Recentes</h2>
          <button
            onClick={() => setCurrentView('transactions')}
            className="text-primary text-[10px] font-bold flex items-center hover:opacity-80 transition-opacity"
          >
            EXTRATO <ChevronRight className="h-3 w-3 ml-0.5" />
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {transactions.length === 0 ? (
            <div className="text-center text-muted-foreground p-6 border border-dashed rounded-[11px] border-border/50 text-xs">
              Nenhuma transação recente
            </div>
          ) : (
            transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 bg-card border shadow-sm rounded-[11px]">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-[11px] ${t.type === 'receita' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500'}`}>
                    {t.type === 'receita' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-xs tracking-tight mb-0.5 flex items-center gap-1.5 flex-wrap">
                      {t.description}
                      {t.isGroupedInstallments && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {t.installmentCount}x
                        </span>
                      )}
                      {t.notes && t.notes.startsWith('paymentMethod:') && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {t.notes.replace('paymentMethod:', '')}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium">
                      {t.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      {t.cardId && t.cardId !== 'money' ? (
                        <span className="ml-1 opacity-70 border-l border-border/50 pl-1">
                          {cards.find(c => c.id === t.cardId)?.name || 'Cartão'}
                        </span>
                      ) : t.accountId && t.accountId !== 'none' ? (
                        <span className="ml-1 opacity-70 border-l border-border/50 pl-1">
                          {accounts.find(a => a.id === t.accountId)?.name || 'Conta'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-xs ${t.type === 'receita' ? 'text-emerald-600 dark:text-emerald-500' : 'text-foreground'}`}>
                    {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
                  </div>
                  {t.type === 'despesa' && (
                    t.isGroupedInstallments ? (
                      <div className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${t.isPaid ? 'text-emerald-600 dark:text-emerald-500' : 'text-amber-500'}`}>
                        {t.totalPaid}/{t.installmentCount} Pago
                      </div>
                    ) : t.cardId && t.cardId !== 'money' ? (
                      <div className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${t.isPaid ? 'text-emerald-600 dark:text-emerald-500' : 'text-amber-500'}`}>
                        {t.isPaid ? 'Pago' : 'Na Fatura'}
                      </div>
                    ) : (
                      <div className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${t.isPaid ? 'text-emerald-600 dark:text-emerald-500' : 'text-amber-500'}`}>
                        {t.isPaid ? 'Pago' : 'Pendente'}
                      </div>
                    )
                  )}
                  {t.type === 'receita' && (
                    t.isGroupedInstallments ? (
                      <div className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${t.isPaid ? 'text-emerald-600 dark:text-emerald-500' : 'text-amber-500'}`}>
                        {t.totalPaid}/{t.installmentCount} Recebido
                      </div>
                    ) : (
                      <div className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${t.isPaid ? 'text-emerald-600 dark:text-emerald-500' : 'text-amber-500'}`}>
                        {t.isPaid ? 'Recebido' : 'Pendente'}
                      </div>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

    </div>
  );
}
