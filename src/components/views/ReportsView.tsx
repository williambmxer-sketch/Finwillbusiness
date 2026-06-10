import React, { useMemo, useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const COLOR_RECEITA = '#10b981';
const COLOR_DESPESA = '#dc2626';

export function ReportsView() {
  const allTransactions = useDataStore(state => state.transactions);
  const allCategories = useDataStore(state => state.categories);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const periodLabel = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Helpers to get start and end dates
  const start = currentMonth;
  const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

  const prevStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const prevEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0, 23, 59, 59);

  // Transactions within selected range
  const filtered = useMemo(
    () => allTransactions.filter(t => t.date >= start && t.date <= end),
    [allTransactions, start, end]
  );

  const prevFiltered = useMemo(
    () => allTransactions.filter(t => t.date >= prevStart && t.date <= prevEnd),
    [allTransactions, prevStart, prevEnd]
  );

  // Calculate totals
  const calcTotals = (txs: any[]) => {
    const receitas = txs.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
    const despesas = txs
      .filter(t =>
        t.type === 'despesa' &&
        (t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:')))
      )
      .reduce((s, t) => s + t.amount, 0);
    return { receitas, despesas, balanco: receitas - despesas };
  };

  const currentTotals = calcTotals(filtered);
  const prevTotals = calcTotals(prevFiltered);

  const savingsRate = currentTotals.receitas > 0 ? (currentTotals.balanco / currentTotals.receitas) * 100 : 0;

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
    const txs = filtered.filter(t => {
      if (t.type !== type) return false;
      if (type === 'despesa' && !(t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:')))) return false;
      return true;
    });

    txs.forEach(t => map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount));
    const total = txs.reduce((s, t) => s + t.amount, 0);
    if (total === 0) return [];

    return Array.from(map.entries())
      .map(([catId, amount]) => {
        const cat = allCategories.find(c => c.id === catId);
        return { name: cat?.name || 'Outros', percentage: (amount / total) * 100, amount, color: cat?.color || (type === 'receita' ? COLOR_RECEITA : '#888888') };
      })
      .sort((a, b) => b.amount - a.amount);
  };

  const incomeCategories = useMemo(() => getCategories('receita'), [filtered, allCategories]);
  const expenseCategories = useMemo(() => getCategories('despesa'), [filtered, allCategories]);

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

  return (
    <div className="flex flex-col h-full bg-background relative pt-6 px-4 max-w-lg mx-auto w-full pb-16">
      
      {/* Header and Fast Navigation */}
      <header className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight mb-0.5">Visão</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Saúde Financeira</p>
        </div>
        
        <div className="flex items-center bg-card border border-border rounded-xl p-1 shadow-sm">
          <button onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest min-w-[100px] text-center">
            {periodLabel}
          </span>
          <button onClick={handleNextMonth} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-card border rounded-[16px] p-3 shadow-sm flex flex-col">
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Receitas</div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(currentTotals.receitas)}</div>
          {prevTotals.receitas > 0 && (
            <div className={`text-[8px] font-bold uppercase tracking-widest mt-1.5 ${diffReceitas >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
              {diffReceitas >= 0 ? '▲' : '▼'} {Math.abs(diffReceitas).toFixed(0)}% ref. mês ant.
            </div>
          )}
        </div>
        <div className="bg-card border rounded-[16px] p-3 shadow-sm flex flex-col">
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Despesas</div>
          <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(currentTotals.despesas)}</div>
          {prevTotals.despesas > 0 && (
            <div className={`text-[8px] font-bold uppercase tracking-widest mt-1.5 ${diffDespesas <= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
              {diffDespesas > 0 ? '▲' : '▼'} {Math.abs(diffDespesas).toFixed(0)}% ref. mês ant.
            </div>
          )}
        </div>
        
        <div className="bg-card border rounded-[16px] p-3 shadow-sm flex flex-col col-span-2">
          <div className="flex justify-between items-center mb-1">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Balanço do Mês</div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Poupança</div>
          </div>
          <div className="flex justify-between items-end">
            <div className={`text-xl font-bold tracking-tight ${currentTotals.balanco >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {currentTotals.balanco >= 0 ? '+' : ''}{formatCurrency(currentTotals.balanco)}
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`text-sm font-bold ${savingsRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {savingsRate.toFixed(1)}%
              </div>
            </div>
          </div>
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
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Distribuição de Despesas</h2>
            <div className="p-4 bg-card border rounded-[16px] shadow-sm flex items-center justify-between">
              <div className="w-32 h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
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
              
              <div className="flex-1 pl-4 flex flex-col gap-2 overflow-y-auto max-h-32 pr-1">
                {expenseCategories.slice(0, 4).map((cat, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-semibold truncate text-[10px] uppercase tracking-wider">{cat.name}</span>
                    </div>
                    <span className="font-bold text-[10px] text-muted-foreground ml-2">{cat.percentage.toFixed(0)}%</span>
                  </div>
                ))}
                {expenseCategories.length > 4 && (
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-right mt-1">
                    + {expenseCategories.length - 4} categorias
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Expense categories Details */}
        {expenseCategories.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Maiores Gastos</h2>
            <div className="flex flex-col gap-2">
              {expenseCategories.map((cat, i) => (
                <div key={i} className="bg-card border border-border/50 shadow-sm rounded-[12px] p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs font-semibold">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold">{formatCurrency(cat.amount)}</span>
                      <span className="text-[9px] text-muted-foreground ml-1.5 font-bold uppercase">{cat.percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Income categories Details */}
        {incomeCategories.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Fontes de Renda</h2>
            <div className="flex flex-col gap-2">
              {incomeCategories.map((cat, i) => (
                <div key={i} className="bg-card border border-border/50 shadow-sm rounded-[12px] p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs font-semibold">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(cat.amount)}</span>
                      <span className="text-[9px] text-muted-foreground ml-1.5 font-bold uppercase">{cat.percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {expenseCategories.length === 0 && incomeCategories.length === 0 && (
          <div className="text-center text-muted-foreground p-10 border border-dashed rounded-[16px] border-border/50 text-xs">
            Nenhum dado no mês de {periodLabel}
          </div>
        )}
      </div>
    </div>
  );
}
