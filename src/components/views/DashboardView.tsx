import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { Card } from '../ui/card';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  WalletCards, 
  CreditCard,
  ChevronRight,
  Landmark,
  Settings2
} from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Cell, XAxis, Tooltip, YAxis } from 'recharts';
import { formatCurrency } from '../../utils/formatters';

import { useAppStore } from '../../store/useAppStore';

function getCycleId(dateVal: Date | string, closingDay: number = 10, dueDay: number = 17) {
  const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (!date || isNaN(date.getTime())) {
    return { cycleId: '', dueDate: new Date() };
  }
  let yr = date.getFullYear();
  let mo = date.getMonth();
  let currentMonthClosing = new Date(yr, mo, closingDay, 23, 59, 59);
  
  let cycleMonth = mo;
  let cycleYear = yr;

  if (date > currentMonthClosing) {
    cycleMonth += 1;
    if (cycleMonth > 11) { cycleMonth = 0; cycleYear++; }
  }
  
  let dueMonth = cycleMonth;
  let dueYear = cycleYear;
  if (dueDay < closingDay) {
    dueMonth += 1;
    if (dueMonth > 11) { dueMonth = 0; dueYear++; }
  }

  let finalDueDate = new Date(dueYear, dueMonth, dueDay);
  return {
    cycleId: `${dueYear}-${dueMonth + 1}`,
    dueDate: finalDueDate
  };
}

export function DashboardView() {
  const { setCategoryModalOpen, setCurrentView } = useAppStore();
  const accounts = useDataStore(state => state.accounts);
  const cards = useDataStore(state => state.cards);
  const allTransactions = useDataStore(state => state.transactions);
  
  const transactions = useMemo(() => {
    const grouped = new Map<string, any>();
    const ungrouped: any[] = [];

    // Sort allTransactions by date descending so we process newer ones first
    const sortedAll = [...allTransactions].sort((a, b) => b.date.getTime() - a.date.getTime());

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
            installmentCount: t.installments
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
    return combined.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
  }, [allTransactions]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

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

  const currentMonthTransactions = allTransactions.filter(t => {
    return t.date.getMonth() === currentMonth && t.date.getFullYear() === currentYear;
  });

  const totalIncomes = currentMonthTransactions
    .filter(t => t.type === 'receita' && t.isPaid)
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = currentMonthTransactions
    .filter(t => t.type === 'despesa' && (t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:'))))
    .reduce((acc, t) => acc + t.amount, 0);

  const chartData = useMemo(() => {
    const data = [];
    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const monthNumber = d.getMonth();
      const yearNumber = d.getFullYear();
      
      const monthExpenses = allTransactions
        .filter(t => t.type === 'despesa' && t.date.getMonth() === monthNumber && t.date.getFullYear() === yearNumber && (t.isPaid || (t.cardId && t.cardId !== 'money') || (t.notes && t.notes.startsWith('paymentMethod:'))))
        .reduce((sum, t) => sum + t.amount, 0);
        
      data.push({
        name: d.toLocaleDateString('pt-BR', { month: 'short' }),
        val: monthExpenses
      });
    }
    return data;
  }, [allTransactions]);

  return (
    <div className="flex flex-col gap-4 p-4 pt-8 max-w-lg mx-auto w-full">
      <header className="flex justify-between items-start mb-1">
        <div>
          <h1 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Saldo Total</h1>
          <div className="text-3xl font-bold tracking-tight">{formatCurrency(totalBalance)}</div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => {
             setCategoryModalOpen(true);
           }} className="bg-primary/10 text-primary p-2.5 rounded-[11px] hover:bg-primary/20 transition-colors">
             <Settings2 className="h-5 w-5" />
           </button>
           <button onClick={() => setCurrentView('accounts')} className="bg-primary/10 text-primary p-2.5 rounded-[11px] hover:bg-primary/20 transition-colors">
             <Landmark className="h-5 w-5" />
           </button>
         </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 bg-card rounded-[11px] border shadow-sm">
          <div className="flex items-center gap-1.5 text-emerald-600 mb-0.5">
             <TrendingUp className="h-3.5 w-3.5" />
             <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Receitas</span>
          </div>
          <div className="text-base font-bold text-foreground">{formatCurrency(totalIncomes)}</div>
        </div>
        <div className="p-3.5 bg-card rounded-[11px] border shadow-sm">
          <div className="flex items-center gap-1.5 text-rose-600 mb-0.5">
             <TrendingDown className="h-3.5 w-3.5" />
             <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Despesas</span>
          </div>
          <div className="text-base font-bold text-foreground">{formatCurrency(totalExpenses)}</div>
        </div>
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
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  key={card.id} 
                  className="flex-none w-[85%] sm:w-[300px] snap-center p-4 rounded-[11px] flex flex-col justify-between relative overflow-hidden"
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
                </motion.div>
              );
            })
          )}
        </div>
      </section>

      {/* Monthly Evolution Chart */}
      <section className="mt-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Evolução de Gastos</h2>
        <div className="p-3 bg-card border rounded-[11px] shadow-sm h-48">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }} dy={10} />
               <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(val) => `R$ ${val}`} />
               <Tooltip 
                 cursor={{ fill: 'transparent' }} 
                 contentStyle={{ borderRadius: '11px', border: '1px solid hsl(var(--border))', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                 formatter={(value: number) => [formatCurrency(value), 'Gastos']}
                 labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px', textTransform: 'capitalize' }}
               />
               <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                 {chartData.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary))'} className={index === chartData.length - 1 ? "opacity-100" : "opacity-40 hover:opacity-80 transition-opacity"} />
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
                     <div className="text-[8px] font-bold uppercase tracking-widest mt-0.5 text-emerald-600 dark:text-emerald-500">
                       Recebido
                     </div>
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
