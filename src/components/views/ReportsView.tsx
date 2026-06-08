import { BarChart, Bar, ResponsiveContainer, Cell, XAxis, YAxis, Tooltip } from 'recharts';
import { Card } from '../ui/card';
import { formatCurrency } from '../../utils/formatters';

export function ReportsView() {
  const mockChartData = [
    { name: 'Jan', receitas: 12000, despesas: 8500 },
    { name: 'Fev', receitas: 12000, despesas: 9200 },
    { name: 'Mar', receitas: 12500, despesas: 7800 },
    { name: 'Abr', receitas: 12500, despesas: 10500 },
    { name: 'Mai', receitas: 13000, despesas: 8100 },
    { name: 'Jun', receitas: 13000, despesas: 4500 },
  ];

  const categories = [
    { name: 'Moradia', percentage: 35, amount: 2800, color: 'bg-emerald-500' },
    { name: 'Alimentação', percentage: 22, amount: 1760, color: 'bg-orange-500' },
    { name: 'Transporte', percentage: 15, amount: 1200, color: 'bg-blue-500' },
    { name: 'Lazer', percentage: 10, amount: 800, color: 'bg-rose-500' },
  ];

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
                <BarChart data={mockChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
                      <div className={`w-2 h-2 rounded-full ${cat.color}`}></div>
                      <span className="text-xs font-medium">{cat.name}</span>
                    </div>
                    <span className="text-xs font-bold">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${cat.color}`} style={{ width: `${cat.percentage}%` }}></div>
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
