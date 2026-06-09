import React, { useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '../../utils/formatters';

// Emerald green for receita, burnt red for despesa
const COLOR_RECEITA = '#10b981';  // emerald-500
const COLOR_DESPESA = '#dc2626';  // red-600 (queimado)

export function ReportsView() {
  const allTransactions = useDataStore(state => state.transactions);
  const allCategories = useDataStore(state => state.categories);

  const chartData = useMemo(() => {
    const data = [];
    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const monthNumber = d.getMonth();
      const yearNumber = d.getFullYear();

      const monthTx = allTransactions.filter(
        t => t.date.getMonth() === monthNumber && t.date.getFullYear() === yearNumber
      );

      const receitas = monthTx
        .filter(t => t.type === 'receita')
        .reduce((sum, t) => sum + t.amount, 0);

      const despesas = monthTx
        .filter(t =>
          t.type === 'despesa' &&
          (t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:')))
        )
        .reduce((sum, t) => sum + t.amount, 0);

      data.push({
        name: d.toLocaleDateString('pt-BR', { month: 'short' }),
        receitas,
        despesas,
      });
    }
    return data;
  }, [allTransactions]);

  // Expense categories (biggest spendings)
  const expenseCategories = useMemo(() => {
    const map = new Map<string, number>();
    const expenses = allTransactions.filter(
      t =>
        t.type === 'despesa' &&
        (t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:')))
    );
    expenses.forEach(t => {
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    });
    const total = expenses.reduce((s, t) => s + t.amount, 0);
    if (total === 0) return [];
    return Array.from(map.entries())
      .map(([catId, amount]) => {
        const cat = allCategories.find(c => c.id === catId);
        return {
          name: cat?.name || 'Outros',
          percentage: (amount / total) * 100,
          amount,
          color: cat?.color || '#888888',
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [allTransactions, allCategories]);

  // Income categories
  const incomeCategories = useMemo(() => {
    const map = new Map<string, number>();
    const incomes = allTransactions.filter(t => t.type === 'receita');
    incomes.forEach(t => {
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    });
    const total = incomes.reduce((s, t) => s + t.amount, 0);
    if (total === 0) return [];
    return Array.from(map.entries())
      .map(([catId, amount]) => {
        const cat = allCategories.find(c => c.id === catId);
        return {
          name: cat?.name || 'Outros',
          percentage: (amount / total) * 100,
          amount,
          color: cat?.color || COLOR_RECEITA,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [allTransactions, allCategories]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-card border border-border rounded-[11px] shadow-xl p-3 text-[10px] min-w-[130px]">
        <p className="font-bold text-foreground mb-1.5 uppercase tracking-wider">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex justify-between items-center gap-3 mb-0.5">
            <span className="flex items-center gap-1 text-muted-foreground font-medium">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: p.fill }} />
              {p.dataKey === 'receitas' ? 'Receitas' : 'Despesas'}
            </span>
            <span className="font-bold" style={{ color: p.fill }}>{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full pb-12">
      <header className="pb-4">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Visão</h1>
        <p className="text-xs text-muted-foreground">Análise financeira do ano</p>
      </header>

      <div className="flex flex-col gap-5">
        {/* Chart */}
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Receitas vs Despesas</h2>
          <div className="p-3 bg-card border rounded-[11px] shadow-sm h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barGap={3}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)', radius: 6 } as any} />
                <Bar dataKey="receitas" fill={COLOR_RECEITA} radius={[6, 6, 0, 0]} maxBarSize={12} />
                <Bar dataKey="despesas" fill={COLOR_DESPESA} radius={[6, 6, 0, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex gap-4 justify-center mt-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_RECEITA }} />
              Receitas
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_DESPESA }} />
              Despesas
            </span>
          </div>
        </section>

        {/* Income categories */}
        {incomeCategories.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Maiores Receitas</h2>
            <div className="flex flex-col gap-2">
              {incomeCategories.map((cat, i) => (
                <div key={i} className="bg-card border shadow-sm rounded-[11px] p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs font-semibold">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(cat.amount)}
                      </span>
                      <span className="text-[9px] text-muted-foreground ml-1.5 font-medium">
                        {cat.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Expense categories */}
        {expenseCategories.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Maiores Gastos</h2>
            <div className="flex flex-col gap-2">
              {expenseCategories.map((cat, i) => (
                <div key={i} className="bg-card border shadow-sm rounded-[11px] p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs font-semibold">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold">{formatCurrency(cat.amount)}</span>
                      <span className="text-[9px] text-muted-foreground ml-1.5 font-medium">
                        {cat.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {expenseCategories.length === 0 && incomeCategories.length === 0 && (
          <div className="text-center text-muted-foreground p-10 border border-dashed rounded-[16px] border-border/50 text-xs">
            Nenhum dado disponível ainda
          </div>
        )}
      </div>
    </div>
  );
}
