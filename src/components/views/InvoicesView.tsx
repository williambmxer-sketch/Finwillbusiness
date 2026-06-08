import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction, Card } from '../../db/db';
import { formatCurrency } from '../../utils/formatters';
import { Receipt, ChevronRight, X, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useAppStore } from '../../store/useAppStore';

interface ComputedInvoice {
  id: string;
  month: string;
  amount: number;
  status: 'open' | 'paid';
  dueDate: Date;
  transactions: Transaction[];
  yearMonth: string;
}

function getCycleId(date: Date, closingDay: number, dueDay: number) {
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
    dueDate: finalDueDate,
    monthName: finalDueDate.toLocaleDateString('pt-BR', { month: 'long' })
  };
}

export function InvoicesView() {
  const { setDefaultPaymentMethod, setTransactionModalOpen, setActiveContextCardId } = useAppStore();
  const cards = useLiveQuery(() => db.cards.toArray()) || [];
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (cards.length > 0 && !selectedCardId) {
      setSelectedCardId(cards[0].id);
    }
  }, [cards, selectedCardId]);

  useEffect(() => {
    setActiveContextCardId(selectedCardId);
    return () => setActiveContextCardId(null);
  }, [selectedCardId, setActiveContextCardId]);

  const transactions = useLiveQuery(
    () => selectedCardId ? db.transactions.where({ cardId: selectedCardId }).toArray() : [],
    [selectedCardId]
  ) || [];

  const dbInvoices = useLiveQuery(
    () => selectedCardId ? db.invoices.where({ cardId: selectedCardId }).toArray() : [],
    [selectedCardId]
  ) || [];

  const computedInvoices = useMemo(() => {
    if (!selectedCardId) return [];
    const card = cards.find(c => c.id === selectedCardId);
    if (!card) return [];

    const invoiceMap = new Map<string, ComputedInvoice>();

    transactions.forEach(t => {
      const { cycleId, dueDate, monthName } = getCycleId(t.date, card.closingDay, card.dueDay);
      const invoiceId = `${card.id}-${cycleId}`;
      
      if (!invoiceMap.has(invoiceId)) {
        const dbInv = dbInvoices.find(inv => inv.id === invoiceId);
        const st = dbInv?.status === 'paid' ? 'paid' : 'open';
        
        invoiceMap.set(invoiceId, {
          id: invoiceId,
          month: monthName,
          yearMonth: cycleId,
          amount: 0,
          status: st,
          dueDate: dueDate,
          transactions: []
        });
      }
      
      const inv = invoiceMap.get(invoiceId)!;
      inv.transactions.push(t);
      if (t.type === 'expense') {
        inv.amount += t.amount;
      } else {
        inv.amount -= t.amount;
      }
    });

    const now = new Date();
    const { cycleId: currentCycle, dueDate: currentDue, monthName: currentMonthName } = getCycleId(now, card.closingDay, card.dueDay);
    const currentInvoiceId = `${card.id}-${currentCycle}`;
    if (!invoiceMap.has(currentInvoiceId)) {
        const dbInv = dbInvoices.find(inv => inv.id === currentInvoiceId);
        const st = dbInv?.status === 'paid' ? 'paid' : 'open';
        invoiceMap.set(currentInvoiceId, {
          id: currentInvoiceId,
          month: currentMonthName,
          yearMonth: currentCycle,
          amount: 0,
          status: st,
          dueDate: currentDue,
          transactions: []
        });
    }

    return Array.from(invoiceMap.values()).sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
  }, [transactions, cards, selectedCardId, dbInvoices]);

  const [selectedInvoice, setSelectedInvoice] = useState<ComputedInvoice | null>(null);

  const handlePayInvoice = async () => {
    if (!selectedInvoice || !selectedCardId || selectedInvoice.amount <= 0) return;
    
    await db.invoices.put({
      id: selectedInvoice.id,
      cardId: selectedCardId,
      month: selectedInvoice.yearMonth,
      status: 'paid',
      totalAmount: selectedInvoice.amount,
      dueDate: selectedInvoice.dueDate,
      closingDate: selectedInvoice.dueDate
    });

    if (selectedInvoice.transactions.length > 0) {
      const txIds = selectedInvoice.transactions.map(t => t.id);
      await db.transactions.where('id').anyOf(txIds).modify({ isPaid: true });
    }
    
    setSelectedInvoice(null);
  };

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
      <header className="px-4 pb-4">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Faturas</h1>
        <p className="text-xs text-muted-foreground">Gerencie seus pagamentos</p>
      </header>

      {/* Card Selector (Compact) */}
      <div className="px-4 mb-4">
        <div className="flex w-full bg-muted p-1 rounded-xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {cards.map((c) => (
            <button 
              key={c.id} 
              onClick={() => setSelectedCardId(c.id)}
              className={`flex-1 min-w-fit px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${selectedCardId === c.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }}></div>
              <span className="truncate max-w-[80px]">{c.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4">
        <div className="flex flex-col gap-2.5">
          {computedInvoices.map((inv, i) => (
            <motion.div 
              key={inv.id}
              onClick={() => setSelectedInvoice(inv)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-3 rounded-[11px] border shadow-sm flex items-center justify-between cursor-pointer ${
                inv.status === 'open' 
                  ? 'bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors' 
                  : 'bg-card hover:bg-muted/50 transition-colors'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-[11px] ${inv.status === 'open' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                   <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs mb-0.5 capitalize">{inv.month}</div>
                  <div className="text-[10px] text-muted-foreground font-medium">Venc. {inv.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                </div>
              </div>
              <div className="text-right flex items-center gap-2">
                <div>
                  <div className="text-xs font-bold tracking-tight">{formatCurrency(inv.amount)}</div>
                  <div className={`text-[8px] uppercase tracking-widest font-bold mt-0.5 ${inv.status === 'open' ? 'text-primary' : 'text-emerald-600 dark:text-emerald-500'}`}>
                    {inv.status === 'open' ? 'Aberta' : 'Paga'}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Invoice Details Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoice(null)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-50 h-[85vh] bg-background border-t rounded-t-[20px] sm:border sm:rounded-[20px] shadow-2xl flex flex-col max-w-lg mx-auto w-full"
            >
              <div className="flex justify-between items-center p-4 border-b">
                <div>
                  <h2 className="text-base font-bold capitalize">Fatura - {selectedInvoice.month}</h2>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mt-0.5">Vencimento: {selectedInvoice.dueDate.toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => setSelectedInvoice(null)} className="p-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 bg-muted/10 border-b flex flex-col items-center justify-center">
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Total da Fatura</div>
                <div className="text-3xl font-bold tracking-tight">{formatCurrency(selectedInvoice.amount)}</div>
                <div className={`mt-2 text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-md ${selectedInvoice.status === 'open' ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600'}`}>
                  {selectedInvoice.status === 'open' ? 'Fatura Aberta' : 'Fatura Paga'}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transações</h3>
                </div>
                {selectedInvoice.transactions.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8 border border-dashed rounded-[11px] border-border/50 text-xs text-muted-foreground">Nenhuma transação nesta fatura.</div>
                ) : (
                  selectedInvoice.transactions.sort((a,b) => b.date.getTime() - a.date.getTime()).map(t => (
                    <div key={t.id} className="flex justify-between items-center p-3 rounded-xl border shadow-sm bg-card">
                      <div>
                        <div className="font-semibold text-xs mb-0.5 tracking-tight">
                          {t.description}
                          <span className="ml-1 text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                            {t.currentInstallment || 1}/{t.installments || 1}
                          </span>
                        </div>
                        <div className="text-[9px] text-muted-foreground">{t.date.toLocaleDateString('pt-BR')}</div>
                      </div>
                      <div className="font-bold text-xs">
                        {t.type === 'expense' ? `-${formatCurrency(t.amount)}` : `+${formatCurrency(t.amount)}`}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selectedInvoice.status === 'open' && (
                <div className="p-4 border-t bg-background">
                   <button 
                    onClick={handlePayInvoice}
                    disabled={selectedInvoice.amount <= 0}
                    className="w-full bg-primary text-primary-foreground text-sm font-bold rounded-xl h-11 flex items-center justify-center transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Pagar Fatura
                   </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
