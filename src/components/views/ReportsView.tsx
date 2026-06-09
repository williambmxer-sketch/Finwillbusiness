import React, { useMemo, useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { CalendarDays, ChevronDown } from 'lucide-react';

const COLOR_RECEITA = '#10b981';
const COLOR_DESPESA = '#dc2626';

// Returns YYYY-MM-DD string for a Date
const toDateStr = (d: Date) => d.toISOString().split('T')[0];

// First and last day of current month
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const lastOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
};

export function ReportsView() {
  const allTransactions = useDataStore(state => state.transactions);
  const allCategories = useDataStore(state => state.categories);

  const [startDate, setStartDate] = useState(toDateStr(firstOfMonth()));
  const [endDate, setEndDate] = useState(toDateStr(lastOfMonth()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const start = useMemo(() => new Date(startDate + 'T00:00:00'), [startDate]);
  const end = useMemo(() => new Date(endDate + 'T23:59:59'), [endDate]);

  // Format period label
  const periodLabel = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    const s = start.toLocaleDateString('pt-BR', opts);
    const e = end.toLocaleDateString('pt-BR', opts);
    if (s === e) return s;
    return `${s} – ${e}`;
  }, [start, end]);

  // Transactions within selected range
  const filtered = useMemo(
    () => allTransactions.filter(t => t.date >= start && t.date <= end),
    [allTransactions, start, end]
  );

  // Chart: months that fall within the range (capped at 12)
  const chartData = useMemo(() => {
    const months: { year: number; month: number }[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endMonth && months.length < 12) {
      months.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months.map(({ year, month }) => {
      const label = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'short' });
      const monthTx = allTransactions.filter(
        t => t.date.getMonth() === month && t.date.getFullYear() === year
      );
      const receitas = monthTx
        .filter(t => t.type === 'receita')
        .reduce((s, t) => s + t.amount, 0);
      const despesas = monthTx
        .filter(t =>
          t.type === 'despesa' &&
          (t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:')))
        )
        .reduce((s, t) => s + t.amount, 0);
      return { name: label, receitas, despesas };
    });
  }, [allTransactions, start, end]);

  // Income categories (filtered by date range)
  const incomeCategories = useMemo(() => {
    const map = new Map<string, number>();
    const incomes = filtered.filter(t => t.type === 'receita');
    incomes.forEach(t => map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount));
    const total = incomes.reduce((s, t) => s + t.amount, 0);
    if (total === 0) return [];
    return Array.from(map.entries())
      .map(([catId, amount]) => {
        const cat = allCategories.find(c => c.id === catId);
        return { name: cat?.name || 'Outros', percentage: (amount / total) * 100, amount, color: cat?.color || COLOR_RECEITA };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filtered, allCategories]);

  // Expense categories (filtered by date range)
  const expenseCategories = useMemo(() => {
    const map = new Map<string, number>();
    const expenses = filtered.filter(
      t =>
        t.type === 'despesa' &&
        (t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:')))
    );
    expenses.forEach(t => map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount));
    const total = expenses.reduce((s, t) => s + t.amount, 0);
    if (total === 0) return [];
    return Array.from(map.entries())
      .map(([catId, amount]) => {
        const cat = allCategories.find(c => c.id === catId);
        return { name: cat?.name || 'Outros', percentage: (amount / total) * 100, amount, color: cat?.color || '#888888' };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [filtered, allCategories]);

  const totalReceitas = filtered.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
  const totalDespesas = filtered
    .filter(t =>
      t.type === 'despesa' &&
      (t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:')))
    )
    .reduce((s, t) => s + t.amount, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-[11px] shadow-xl p-3 text-[10px] min-w-[130px]">
        <p className="font-bold text-foreground mb-1.5 uppercase tracking-wider">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex justify-between items-center gap-3 mb-0.5">
            <span className="flex items-center gap-1 text-muted-foreground font-medium">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.fill }} />
              {p.dataKey === 'receitas' ? 'Receitas' : 'Despesas'}
            </span>
            <span className="font-bold" style={{ color: p.fill }}>{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full pb-16">
      <header className="pb-3">
        <h1 className="text-2xl font-bold tracking-tight mb-0.5">Visão</h1>
        <p className="text-xs text-muted-foreground">Análise financeira por período</p>
      </header>

      {/* Date range picker */}
      <div className="mb-4">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="flex items-center gap-2 w-full bg-card border border-border rounded-[11px] px-3 py-2.5 shadow-sm hover:border-primary/40 transition-colors"
        >
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          <span className="flex-1 text-left text-xs font-semibold text-foreground truncate">{periodLabel}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showDatePicker ? 'rotate-180' : ''}`} />
        </button>

        {showDatePicker && (
          <div className="mt-2 bg-card border border-border rounded-[14px] p-4 shadow-lg animate-in fade-in-50 slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">De</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  className="w-full rounded-[10px] h-9 px-3 text-xs bg-muted/50 border border-transparent focus:ring-1 focus:ring-primary focus:bg-background outline-none transition-all font-medium uppercase"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Até</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full rounded-[10px] h-9 px-3 text-xs bg-muted/50 border border-transparent focus:ring-1 focus:ring-primary focus:bg-background outline-none transition-all font-medium uppercase"
                />
              </div>
            </div>

            {/* Quick shortcuts */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {[
                { label: 'Este mês', fn: () => { setStartDate(toDateStr(firstOfMonth())); setEndDate(toDateStr(lastOfMonth())); } },
                {
                  label: 'Mês anterior', fn: () => {
                    const d = new Date();
                    const f = new Date(d.getFullYear(), d.getMonth() - 1, 1);
                    const l = new Date(d.getFullYear(), d.getMonth(), 0);
                    setStartDate(toDateStr(f)); setEndDate(toDateStr(l));
                  }
                },
                {
                  label: 'Próximo mês', fn: () => {
                    const d = new Date();
                    const f = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                    const l = new Date(d.getFullYear(), d.getMonth() + 2, 0);
                    setStartDate(toDateStr(f)); setEndDate(toDateStr(l));
                  }
                },
                {
                  label: 'Últimos 3 meses', fn: () => {
                    const d = new Date();
                    const f = new Date(d.getFullYear(), d.getMonth() - 2, 1);
                    setStartDate(toDateStr(f)); setEndDate(toDateStr(lastOfMonth()));
                  }
                },
                {
                  label: 'Este ano', fn: () => {
                    const d = new Date();
                    setStartDate(`${d.getFullYear()}-01-01`);
                    setEndDate(`${d.getFullYear()}-12-31`);
                  }
                },
              ].map(({ label, fn }) => (
                <button
                  key={label}
                  onClick={() => { fn(); setShowDatePicker(false); }}
                  className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 bg-muted hover:bg-primary/10 hover:text-primary rounded-lg transition-colors text-muted-foreground"
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowDatePicker(false)}
              className="mt-3 w-full py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-[10px] hover:bg-primary/90 transition-colors"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* Summary totals */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-card border rounded-[11px] p-3 shadow-sm">
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Receitas</div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalReceitas)}</div>
        </div>
        <div className="bg-card border rounded-[11px] p-3 shadow-sm">
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Despesas</div>
          <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatCurrency(totalDespesas)}</div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Chart */}
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Receitas vs Despesas</h2>
          <div className="p-3 bg-card border rounded-[11px] shadow-sm h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barGap={3}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)', radius: 6 } as any} />
                <Bar dataKey="receitas" fill={COLOR_RECEITA} radius={[6, 6, 0, 0]} maxBarSize={12} />
                <Bar dataKey="despesas" fill={COLOR_DESPESA} radius={[6, 6, 0, 0]} maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 justify-center mt-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_RECEITA }} />Receitas
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_DESPESA }} />Despesas
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
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(cat.amount)}</span>
                      <span className="text-[9px] text-muted-foreground ml-1.5 font-medium">{cat.percentage.toFixed(0)}%</span>
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
                      <span className="text-[9px] text-muted-foreground ml-1.5 font-medium">{cat.percentage.toFixed(0)}%</span>
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
            Nenhum dado no período selecionado
          </div>
        )}
      </div>
    </div>
  );
}
