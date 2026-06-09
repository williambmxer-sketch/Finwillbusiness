import React, { useState, useEffect, useMemo } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { api } from '../../services/api';
import { Transaction, Card } from '../../db/db';
import { formatCurrency } from '../../utils/formatters';
import { Receipt, ChevronRight, X, ArrowDown, ChevronDown, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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

function getCycleId(date: Date, closingDay: number = 1, dueDay: number = 5) {
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
  const { setCurrentView, setActiveContextCardId, setConfirmModal } = useAppStore();
  const allTransactions = useDataStore(state => state.transactions);
  const cards = useDataStore(state => state.cards);
  const accounts = useDataStore(state => state.accounts);
  const categories = useDataStore(state => state.categories);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAccountId, setPayAccountId] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (cards.length > 0 && !selectedCardId) {
      setSelectedCardId(cards[0].id);
    }
  }, [cards, selectedCardId]);

  const currentCycleId = useMemo(() => {
    if (!selectedCardId) return '';
    const card = cards.find(c => c.id === selectedCardId);
    if (!card) return '';
    return getCycleId(new Date(), card.closingDay, card.dueDay).cycleId;
  }, [selectedCardId, cards]);

  useEffect(() => {
    if (currentCycleId) {
      setSelectedCycle(currentCycleId);
    }
  }, [currentCycleId]);

  useEffect(() => {
    setActiveContextCardId(selectedCardId);
    return () => setActiveContextCardId(null);
  }, [selectedCardId, setActiveContextCardId]);

  const transactions = useMemo(() => {
    return selectedCardId ? allTransactions.filter(t => t.cardId === selectedCardId) : [];
  }, [allTransactions, selectedCardId]);

  const dbInvoices: any[] = []; // Invoices exist as computed only for now

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
      if (t.type === 'despesa') {
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

    // Determine status dynamically based on transactions in it
    for (const [_, inv] of invoiceMap) {
      if (inv.transactions.length > 0 && inv.transactions.every(t => t.isPaid)) {
        inv.status = 'paid';
      } else {
        inv.status = 'open';
      }
    }

    return Array.from(invoiceMap.values()).sort((a, b) => {
      if (a.yearMonth === currentCycleId) return -1;
      if (b.yearMonth === currentCycleId) return 1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }, [transactions, cards, selectedCardId, dbInvoices, currentCycleId]);

  const cycles = useMemo(() => {
    const rawCycles = Array.from(new Set(computedInvoices.map(inv => inv.yearMonth))) as string[];
    return rawCycles.sort((a, b) => {
      if (a === currentCycleId) return -1;
      if (b === currentCycleId) return 1;
      const [aYear, aMonth] = a.split('-').map(Number);
      const [bYear, bMonth] = b.split('-').map(Number);
      if (aYear !== bYear) return aYear - bYear;
      return aMonth - bMonth;
    });
  }, [computedInvoices, currentCycleId]);

  const formatCycleName = (cycleId: string) => {
    if (!cycleId || cycleId === 'all') return '';
    const [y, m] = cycleId.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const filteredInvoices = useMemo(() => {
    if (selectedCycle === 'all') return computedInvoices;
    return computedInvoices.filter(inv => inv.yearMonth === selectedCycle);
  }, [computedInvoices, selectedCycle]);

  const [selectedInvoice, setSelectedInvoice] = useState<ComputedInvoice | null>(null);

  const handlePayInvoice = async () => {
    if (!selectedInvoice || !selectedCardId || selectedInvoice.amount <= 0 || !payAccountId) return;
    
    const card = cards.find(c => c.id === selectedCardId);
    if (!card) return;

    const executePayInvoice = async () => {
      if (selectedInvoice.transactions.length > 0) {
        await Promise.all(selectedInvoice.transactions.map(t => 
          api.transactions.update(t.id, { isPaid: true })
        ));
      }
      
      const acc = accounts.find(a => a.id === payAccountId);
      if (acc) {
        await api.accounts.update(payAccountId, {
          balance: acc.balance - selectedInvoice.amount
        });
      }

      setPayModalOpen(false);
      setSelectedInvoice(null);
      setDetailsOpen(false);
    };

    const now = new Date();
    const { cycleId: currentCycle } = getCycleId(now, card.closingDay, card.dueDay);
    const closingDate = new Date(now.getFullYear(), now.getMonth(), card.closingDay, 23, 59, 59);
    
    if (selectedInvoice.yearMonth === currentCycle && now < closingDate) {
      setConfirmModal({
        title: 'Pagar Fatura Adiantada',
        description: 'Você está pagando a fatura antes do fechamento. O limite do cartão será liberado, mas novas compras até o fechamento ainda serão lançadas nesta mesma fatura. Confirma o pagamento?',
        onConfirm: executePayInvoice
      });
    } else {
      setConfirmModal({
        title: 'Pagar Fatura',
        description: `Confirma o pagamento da fatura de ${selectedInvoice.month}? Isso dará baixa em todas as despesas vinculadas a ela e debitará do saldo da conta escolhida.`,
        onConfirm: executePayInvoice
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
      <header className="px-4 pb-4">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Faturas</h1>
        <p className="text-xs text-muted-foreground">Gerencie seus pagamentos</p>
      </header>

      {/* Card Selector (Compact) */}
      <div className="px-4 mb-3">
        <div className="flex w-full bg-muted p-1 rounded-xl overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {cards.map((c) => (
            <button 
              key={c.id} 
              onClick={() => setSelectedCardId(c.id)}
              className={`flex-1 min-w-fit px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${selectedCardId === c.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }}></div>
              <span className="truncate max-w-[120px]">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Month Selector */}
      <div className="px-4 mb-4">
        <Select value={selectedCycle} onValueChange={setSelectedCycle}>
          <SelectTrigger className="w-full bg-muted/30 border-border/50 rounded-xl h-10 text-xs font-bold uppercase tracking-wider text-muted-foreground focus:ring-primary shadow-sm hover:bg-muted/50 transition-colors">
            <SelectValue placeholder="Filtrar por mês...">
              {selectedCycle === 'all' ? '✨ TODAS AS FATURAS' : formatCycleName(selectedCycle)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl z-[200]" side="bottom" sideOffset={4} alignItemWithTrigger={false}>
            <SelectItem value="all" className="text-sm font-medium">✨ TODAS AS FATURAS</SelectItem>
            {cycles.map(c => (
              <SelectItem key={c} value={c} className="text-sm font-medium capitalize">
                {formatCycleName(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 px-4">
        <div className="flex flex-col gap-2.5">
          {filteredInvoices.map((inv, i) => {
            const isExpanded = expandedInvoiceId === inv.id;
            return (
              <motion.div 
                key={inv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex flex-col bg-card shadow-sm rounded-[11px] border cursor-pointer hover:border-primary/50 transition-colors overflow-hidden ${
                  isExpanded ? 'border-primary/50 ring-1 ring-primary/20' : ''
                } ${
                  inv.status === 'open' ? 'bg-primary/5 border-primary/20' : ''
                }`}
              >
                <div 
                  className="flex items-center justify-between p-3"
                  onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
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
                    <ChevronDown className={`h-4 w-4 text-muted-foreground opacity-50 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="border-t bg-muted/10 p-3 flex gap-2"
                  >
                    {inv.status === 'open' ? (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPayAccountId(accounts[0]?.id || '');
                            setSelectedInvoice(inv);
                            setPayModalOpen(true);
                          }}
                          disabled={inv.amount <= 0}
                          className="flex-1 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-lg py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          Pagar Fatura
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                            setDetailsOpen(true);
                          }}
                          className="px-4 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg flex items-center justify-center transition-colors"
                          title="Visualizar Histórico"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 text-emerald-600 dark:text-emerald-500 font-bold text-xs flex items-center pl-1">
                          Fatura Paga
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                            setDetailsOpen(true);
                          }}
                          className="px-4 py-2.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"
                          title="Visualizar Histórico"
                        >
                          <Eye className="w-4 h-4" /> Ver Histórico
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Invoice Details Modal */}
      <AnimatePresence>
        {selectedInvoice && detailsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedInvoice(null);
                setDetailsOpen(false);
              }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-50 h-[80vh] bg-background border-t rounded-t-[28px] sm:border sm:rounded-[24px] shadow-2xl flex flex-col max-w-lg mx-auto w-full overflow-hidden"
            >
              <div className="flex justify-between items-center p-5 border-b">
                <div>
                  <h2 className="text-base font-bold capitalize">Fatura - {selectedInvoice.month}</h2>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Vencimento: {selectedInvoice.dueDate.toLocaleDateString('pt-BR')}</p>
                </div>
                <button onClick={() => {
                  setSelectedInvoice(null);
                  setDetailsOpen(false);
                }} className="p-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 bg-gradient-to-br from-primary/10 via-background to-card border-b flex flex-col items-center justify-center">
                <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mb-1 select-none">Total da Fatura</div>
                <div className="text-3xl font-extrabold tracking-tight">{formatCurrency(selectedInvoice.amount)}</div>
                <div className={`mt-2.5 text-[9px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full select-none ${selectedInvoice.status === 'open' ? 'bg-primary/15 text-primary border border-primary/25' : 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25'}`}>
                  {selectedInvoice.status === 'open' ? 'Fatura Aberta' : 'Fatura Paga'}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3.5">
                <div className="flex justify-between items-center mb-0.5">
                  <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Transações Realizadas</h3>
                </div>
                {selectedInvoice.transactions.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8 border border-dashed rounded-[16px] border-border/50 text-xs text-muted-foreground">Nenhuma transação nesta fatura.</div>
                ) : (
                  selectedInvoice.transactions.sort((a,b) => b.date.getTime() - a.date.getTime()).map(t => {
                    const cat = categories.find(c => c.id === t.categoryId);
                    return (
                      <div key={t.id} className="flex justify-between items-center p-3 rounded-xl border border-border/60 shadow-sm bg-card hover:border-primary/20 transition-all">
                        <div>
                          <div className="font-semibold text-xs mb-0.5 tracking-tight flex items-center gap-1.5">
                            {t.description}
                            {t.installments && t.installments > 1 && (
                              <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                {t.currentInstallment}/{t.installments}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-medium">
                            <span>{t.date.toLocaleDateString('pt-BR')}</span>
                            <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat?.color || '#ccc' }} />
                              <span>{cat?.name || 'Geral'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="font-bold text-xs text-rose-600 dark:text-rose-500">
                          -{formatCurrency(t.amount)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedInvoice.status === 'open' && (
                <div className="p-4 border-t bg-background">
                   <button 
                    onClick={() => {
                      setPayAccountId(accounts[0]?.id || '');
                      setPayModalOpen(true);
                    }}
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

      {/* Modal de Seleção de Conta para Pagamento de Fatura */}
      <AnimatePresence>
        {payModalOpen && selectedInvoice && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setPayModalOpen(false);
                if (!detailsOpen) {
                  setSelectedInvoice(null);
                }
              }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[150]"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 m-auto z-[160] h-fit max-w-sm w-[90%] bg-card border rounded-[24px] shadow-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm">Selecione a Conta para Pagamento</h3>
                <button onClick={() => {
                  setPayModalOpen(false);
                  if (!detailsOpen) {
                    setSelectedInvoice(null);
                  }
                }} className="p-1 rounded-full bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione de qual conta bancária deseja debitar o valor de <strong className="text-foreground">{formatCurrency(selectedInvoice.amount)}</strong> para pagar a fatura do cartão.
              </p>
              
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold ml-1">Conta de Origem</label>
                <div className="relative">
                  <select
                    value={payAccountId}
                    onChange={e => setPayAccountId(e.target.value)}
                    className="w-full rounded-xl h-11 px-3 text-sm bg-muted/50 border border-transparent focus:ring-1 focus:ring-primary focus:bg-background outline-none font-medium appearance-none"
                  >
                    <option value="" disabled>Selecione a conta...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Saldo: {formatCurrency(acc.balance)})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-2.5 mt-2">
                <button 
                  onClick={() => {
                    setPayModalOpen(false);
                    if (!detailsOpen) {
                      setSelectedInvoice(null);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted hover:bg-muted/80 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handlePayInvoice}
                  disabled={!payAccountId}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
