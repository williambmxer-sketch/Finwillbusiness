import React, { useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { BarChart, Bar, ResponsiveContainer, Cell, XAxis, YAxis, Tooltip } from 'recharts';
import { Card } from '../ui/card';
import { formatCurrency } from '../../utils/formatters';

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
      
      const monthTx = allTransactions.filter(t => t.date.getMonth() === monthNumber && t.date.getFullYear() === yearNumber);
      
      const receitas = monthTx.filter(t => t.type === 'receita' && t.isPaid).reduce((sum, t) => sum + t.amount, 0);
      const despesas = monthTx.filter(t => t.type === 'despesa' && (t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:')))).reduce((sum, t) => sum + t.amount, 0);
        
      data.push({
        name: d.toLocaleDateString('pt-BR', { month: 'short' }),
        receitas,
        despesas
      });
    }
    return data;
  }, [allTransactions]);

  const categories = useMemo(() => {
    const expensesByCategory = new Map<string, number>();
    const expenses = allTransactions.filter(t => t.type === 'despesa' && (t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:'))));
    
    expenses.forEach(t => {
      const current = expensesByCategory.get(t.categoryId) || 0;
      expensesByCategory.set(t.categoryId, current + t.amount);
    });

    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
    if (totalExpenses === 0) return [];

    return Array.from(expensesByCategory.entries())
      .map(([catId, amount]) => {
        const cat = allCategories.find(c => c.id === catId);
        return {
          name: cat ? cat.name : 'Outros',
          percentage: (amount / totalExpenses) * 100,
          amount,
          color: cat && cat.color ? cat.color : '#888888',
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [allTransactions, allCategories]);

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
      <header className="pb-4">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Visão</h1>
        <p className="text-xs text-muted-foreground">Análise financeira do ano</p>
      </header>

      <div className="flex-1">
        <div className="flex flex-col gap-4">
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Receitas vs Despesas</h2>
            <div className="p-3 bg-card border rounded-[11px] shadow-sm h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => `R$${value/1000}k`} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '11px', border: '1px solid hsl(var(--border))', fontSize: '10px' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="receitas" fill="hsl(var(--primary))" radius={[11, 11, 0, 0]} maxBarSize={10} />
                  <Bar dataKey="despesas" fill="hsl(var(--muted-foreground))" radius={[11, 11, 0, 0]} maxBarSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Maiores Gastos</h2>
            <div className="flex flex-col gap-2.5">
              {categories.map((cat, i) => (
                <div key={i} className="bg-card border shadow-sm rounded-[11px] p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></div>
                      <span className="text-xs font-medium">{cat.name}</span>
                    </div>
                    <span className="text-xs font-bold">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
