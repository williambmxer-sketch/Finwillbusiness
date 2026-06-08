import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { api } from '../../services/api';
import { Transaction } from '../../db/db';
import { formatCurrency } from '../../utils/formatters';
import { ChevronLeft, CreditCard, ShoppingBag, Clock, TrendingDown, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { generateUUID } from '../../lib/utils';


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

export function CardDetailsView() {
  const { setCurrentView, activeContextCardId, setEditingCardId, setCardModalOpen, setEditingTransactionId, setTransactionModalOpen, setConfirmModal } = useAppStore();
  
  const cards = useDataStore(state => state.cards);
  const card = cards.find(c => c.id === activeContextCardId);

  const categories = useDataStore(state => state.categories);
  const allTransactions = useDataStore(state => state.transactions);
  
  const transactions = React.useMemo(() => {
    return allTransactions
      .filter(t => t.cardId === activeContextCardId && t.type === 'despesa')
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allTransactions, activeContextCardId]);

  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  const cardCycles = React.useMemo(() => {
    if (!card) return [];
    
    const now = new Date();
    const current = getCycleId(now, card.closingDay, card.dueDay);
    
    const cyclesMap = new Map<string, {id: string, name: string}>();
    cyclesMap.set(current.cycleId, { id: current.cycleId, name: current.monthName });

    transactions.forEach(t => {
      const { cycleId, monthName } = getCycleId(t.date, card.closingDay, card.dueDay);
      if (!cyclesMap.has(cycleId)) {
        cyclesMap.set(cycleId, { id: cycleId, name: monthName });
      }
    });

    return Array.from(cyclesMap.values()).sort((a,b) => {
      const [yA, mA] = a.id.split('-').map(Number);
      const [yB, mB] = b.id.split('-').map(Number);
      return (yA - yB) || (mA - mB);
    }).reverse();
  }, [card, transactions]);

  React.useEffect(() => {
    if (card && !selectedCycleId) {
       const now = new Date();
       const current = getCycleId(now, card.closingDay, card.dueDay);
       setSelectedCycleId(current.cycleId);
    }
  }, [card, selectedCycleId]);

  const visibleTransactions = React.useMemo(() => {
    if (!card || !selectedCycleId) return [];
    return transactions.filter(t => {
      const { cycleId } = getCycleId(t.date, card.closingDay, card.dueDay);
      return cycleId === selectedCycleId;
    });
  }, [transactions, card, selectedCycleId]);

  // Quick Add Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [installments, setInstallments] = useState('1');

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') {
      setAmount('');
      return;
    }
    const numericValue = (parseInt(value, 10) / 100).toFixed(2);
    setAmount(numericValue);
  };

  const displayAmount = amount ? parseFloat(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !categoryId || !card) return;

    const numInstallments = Math.max(1, parseInt(installments, 10) || 1);
    const totalAmount = parseFloat(amount);

    // Check limit
    const currentUsage = allTransactions
      .filter(t => t.cardId === card.id && t.type === 'despesa')
      .reduce((sum, t) => sum + t.amount, 0);

    if (currentUsage + totalAmount > card.limit) {
      alert(`Limite do cartão excedido! Limite disponível: R$ ${(card.limit - currentUsage).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      return;
    }

    const installmentAmount = totalAmount / numInstallments;
    
    // Create local Date from input, setting to noon to avoid timezone shift issues
    const startDate = new Date(date + 'T12:00:00');
    
    const parentId = numInstallments > 1 ? generateUUID() : undefined;

    const newTransactions: Transaction[] = [];

    for (let i = 0; i < numInstallments; i++) {
      const txDate = new Date(startDate);
      txDate.setMonth(txDate.getMonth() + i);

      newTransactions.push({
        id: generateUUID(),
        description: numInstallments > 1 ? `${description} (${i + 1}/${numInstallments})` : description,
        amount: installmentAmount,
        date: txDate,
        type: 'despesa',
        categoryId,
        cardId: card.id,
        installments: numInstallments > 1 ? numInstallments : undefined,
        currentInstallment: numInstallments > 1 ? i + 1 : undefined,
        parentId,
        isPaid: false,
      });
    }

    await Promise.all(newTransactions.map(t => api.transactions.add(t)));

    // Reset fields for the next rapid entry
    setAmount('');
    setDescription('');
    // Keep categoryId, date and installments to make repetitive entry faster
  };

  const handleDeleteTransaction = (id: string) => {
    setConfirmModal({
      title: 'Excluir Despesa',
      description: 'Tem certeza que deseja excluir permanentemente esta despesa?',
      onConfirm: async () => {
        await api.transactions.delete(id);
      }
    });
  };

  if (!card) {
    return (
      <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => setCurrentView('cards')} className="p-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Cartão não encontrado</h1>
        </header>
      </div>
    );
  }

  const cardUsage = transactions.reduce((acc, t) => acc + t.amount, 0);
  const availableLimit = card.limit - cardUsage;

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
      <header className="px-4 pb-4">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentView('cards')} className="p-1 -ml-1 text-muted-foreground hover:text-foreground bg-muted/20 rounded-lg">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{card.name}</h1>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{card.brand} •••• {card.lastFour}</div>
            </div>
          </div>
          <button 
            onClick={() => {
              setEditingCardId(card.id);
              setCurrentView('cards'); // navigate back to cards view behind modal
              setCardModalOpen(true);
            }}
            className="text-primary text-xs font-bold uppercase tracking-wider p-2 bg-primary/10 rounded-[11px]"
          >
            Editar
          </button>
        </div>
        
        <div className="bg-card border shadow-sm rounded-[11px] p-5 mb-4 relative overflow-hidden" style={{ borderColor: card.color }}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CreditCard className="w-32 h-32 -mr-8 -mt-8" style={{ color: card.color }} />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Uso Total</div>
            <div className="text-4xl font-bold tracking-tight mb-4">{formatCurrency(cardUsage)}</div>
            
            <div className="flex justify-between border-t pt-4">
               <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Limite Disponível</div>
                  <div className="text-sm font-bold text-emerald-600">{formatCurrency(availableLimit)}</div>
               </div>
               <div className="text-right">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Vencimento</div>
                  <div className="text-sm font-bold">Dia {card.dueDay}</div>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Add Form */}
      <div className="px-4 mb-4">
        <form onSubmit={handleQuickSubmit} className="bg-card border shadow-sm rounded-[11px] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-foreground">Lançamento Rápido</span>
          </div>
          
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground uppercase tracking-widest">R$</span>
              <Input 
                type="text" 
                inputMode="numeric"
                placeholder="0,00" 
                className="w-full h-10 text-sm font-bold bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary pl-8"
                value={displayAmount}
                onChange={handleAmountChange}
                required
              />
            </div>
            <div className="relative w-24">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Em</span>
              <Input 
                type="number"
                min="1"
                max="72"
                className="w-full h-10 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary text-center pl-8 pr-6"
                value={installments}
                onChange={e => setInstallments(e.target.value)}
                title="Parcelas"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">X</span>
            </div>
          </div>

          <Input 
            placeholder="Descrição (ex: iFood, Uber)..." 
            className="w-full h-10 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary"
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
          />

          <div className="flex gap-2">
            <Input 
              type="date" 
              className="w-[140px] h-10 text-xs bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary uppercase"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
            
            <Select value={categoryId || "none"} onValueChange={setCategoryId} required>
              <SelectTrigger className="flex-1 h-10 text-xs bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary">
                <SelectValue placeholder="Categoria...">
                  {categoryId === "none" ? "Categoria..." : categories?.find(c => c.id === categoryId)?.name || "Categoria..."}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl z-[200]">
                {categories.filter(c => c.type === 'despesa').map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs font-medium">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button type="submit" className="px-4 bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-primary/90 transition-colors">
              Add
            </button>
          </div>
        </form>
      </div>

      {/* Transactions List */}
      <div className="flex-1 px-4 mt-2">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Histórico de Compras</h2>
          
          <Select value={selectedCycleId || ""} onValueChange={setSelectedCycleId}>
             <SelectTrigger className="w-[135px] h-8 text-[10px] uppercase font-bold tracking-wider bg-muted border-none shadow-none rounded-lg">
                <SelectValue placeholder="Fatura..." />
             </SelectTrigger>
             <SelectContent className="rounded-xl">
               {cardCycles.map(c => (
                 <SelectItem key={c.id} value={c.id} className="text-xs font-bold capitalize">Fatura {c.name}</SelectItem>
               ))}
             </SelectContent>
          </Select>
        </div>
        
        <div className="flex flex-col gap-2.5 pb-24">
          {visibleTransactions.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 flex flex-col items-center border border-dashed rounded-[11px] border-border/50">
               <p className="text-xs">Nenhuma despesa nesta fatura</p>
            </div>
          ) : (
            visibleTransactions.map((t, i) => (
              <motion.div 
                key={t.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 bg-card shadow-sm rounded-[11px] border transition-colors"
              >
                 <div className="flex items-center gap-3">
                    <div className="p-2 rounded-[11px] bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500">
                      <TrendingDown className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-xs mb-0.5 tracking-tight">
                        {t.description} 
                        {t.installments && t.installments > 1 && (
                          <span className="ml-1 text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {t.currentInstallment}/{t.installments}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 font-medium">
                        <span>{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 text-right">
                   <div>
                     <div className="font-bold text-xs text-foreground">
                       -{formatCurrency(t.amount)}
                     </div>
                     {!t.isPaid && <div className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-1">Na Fatura</div>}
                   </div>
                   
                   <div className="flex items-center gap-1 border-l pl-2 ml-1 border-border/50">
                     <button 
                       onClick={() => {
                         setEditingTransactionId(t.id);
                         setTransactionModalOpen(true);
                       }}
                       className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                       title="Editar"
                     >
                       <Pencil className="w-3.5 h-3.5" />
                     </button>
                     <button 
                       onClick={() => handleDeleteTransaction(t.id)}
                       className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                       title="Excluir"
                     >
                       <Trash2 className="w-3.5 h-3.5" />
                     </button>
                   </div>
                 </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
