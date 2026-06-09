import React, { useState } from 'react';
import { api } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Filter, Search, TrendingUp, TrendingDown, Clock, Settings2, CheckCircle2, Pencil, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';
import { Input } from '../ui/input';
import { useAppStore } from '../../store/useAppStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type FilterType = 'all' | 'receita' | 'despesa' | 'pending' | 'paid';

export function TransactionsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const now = new Date();
  const currentCycleId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedCycle, setSelectedCycle] = useState<string>(currentCycleId);

  const { setTransactionModalOpen, setEditingTransactionId, setCategoryModalOpen, setConfirmPaymentTransactionId, setConfirmModal } = useAppStore();
  
  const allTransactions = useDataStore(state => state.transactions);
  const cards = useDataStore(state => state.cards);
  
  const transactions = React.useMemo(() => {
    return [...allTransactions].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allTransactions]);

  const getEffectiveCycle = (t: any) => {
    const d = t.date;
    let yr = d.getFullYear();
    let mo = d.getMonth();

    if (t.cardId && t.cardId !== 'money') {
      const card = cards.find(c => c.id === t.cardId);
      if (card) {
        const closingDate = new Date(yr, mo, card.closingDay);
        const txDateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (txDateOnly > closingDate) {
          mo++;
          if (mo > 11) { mo = 0; yr++; }
        }
      }
    }
    return `${yr}-${String(mo + 1).padStart(2, '0')}`;
  };

  const cycles = Array.from<string>(new Set(transactions.map(t => getEffectiveCycle(t)))).sort().reverse();
  if (!cycles.includes(currentCycleId)) {
    cycles.push(currentCycleId);
    cycles.sort().reverse();
  }

  const formatCycleName = (cycleId: string) => {
    const [y, m] = cycleId.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleTogglePayment = async (t: any) => {
    const isNowPaid = !t.isPaid;
    
    if (!isNowPaid) {
      setConfirmModal({
        title: 'Estornar Pagamento',
        description: 'Deseja cancelar o pagamento e estornar o valor desta transação?',
        onConfirm: async () => {
          await executeTogglePayment(t, isNowPaid);
        }
      });
    } else {
      await executeTogglePayment(t, isNowPaid);
    }
  };

  const executeTogglePayment = async (t: any, isNowPaid: boolean) => {
    await api.transactions.update(t.id, { isPaid: isNowPaid });
    
    if (t.accountId && t.cardId === 'money') {
      const accounts = useDataStore.getState().accounts;
      const acc = accounts.find(a => a.id === t.accountId);
      if (acc) {
        const amountChange = t.type === 'receita' ? t.amount : -t.amount;
        const balanceChange = isNowPaid ? amountChange : -amountChange;
        
        await api.accounts.update(t.accountId, {
          balance: acc.balance + balanceChange
        });
      }
    }
  };

  const filtered = transactions.filter(t => {
    if (selectedCycle !== 'all' && getEffectiveCycle(t) !== selectedCycle) return false;
    if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterType === 'receita' && t.type !== 'receita') return false;
    if (filterType === 'despesa' && t.type !== 'despesa') return false;
    if (filterType === 'pending' && t.isPaid) return false;
    if (filterType === 'paid' && !t.isPaid) return false;
    return true;
  });

  const displayItems = React.useMemo(() => {
    const items: any[] = [];
    const cardInvoices = new Map<string, any>(); // cardId -> VirtualInvoice

    filtered.forEach(t => {
      // Se for transação de crédito, não coloca solta na lista. Agrupa na fatura.
      if (t.cardId && t.cardId !== 'money') {
        const cycleId = getEffectiveCycle(t);
        const invoiceKey = `${t.cardId}-${cycleId}`;
        
        if (!cardInvoices.has(invoiceKey)) {
          const card = cards.find(c => c.id === t.cardId);
          cardInvoices.set(invoiceKey, {
            id: `invoice-${invoiceKey}`,
            isVirtualInvoice: true,
            cardId: t.cardId,
            description: `Fatura ${card ? card.name : 'Cartão'}`,
            amount: 0,
            date: new Date(t.date), // Just a reference date
            type: 'despesa',
            isPaid: false, 
            color: card?.color,
            brand: card?.brand
          });
        }
        
        const inv = cardInvoices.get(invoiceKey);
        if (t.type === 'despesa') {
           inv.amount += t.amount;
        } else {
           inv.amount -= t.amount;
        }
        // update reference date to be the latest date in that invoice
        if (t.date > inv.date) inv.date = t.date;
      } else {
        items.push(t);
      }
    });

    items.push(...Array.from(cardInvoices.values()));
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filtered, cards]);

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
      <header className="px-4 pb-3">
        <div className="flex justify-between items-end mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
          <button onClick={() => setCategoryModalOpen(true)} className="text-primary flex items-center justify-center p-2 bg-primary/10 rounded-[11px]">
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar transações..." 
            className="pl-9 bg-muted/50 border-none rounded-[11px] h-10 text-sm focus-visible:ring-primary shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <div className="px-4 mb-3 flex gap-2">
        <Select value={selectedCycle} onValueChange={setSelectedCycle}>
          <SelectTrigger className="w-1/2 bg-muted/30 border-border/50 rounded-[11px] h-10 text-xs font-bold uppercase tracking-wider text-foreground focus:ring-primary shadow-sm hover:bg-muted/50 transition-colors">
            <SelectValue placeholder="Mês">
              {selectedCycle === 'all' ? '✨ TODO O PERÍODO' : formatCycleName(selectedCycle)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl z-[200]" side="bottom" sideOffset={4} alignItemWithTrigger={false}>
            <SelectItem value="all" className="text-sm font-medium">✨ TODO O PERÍODO</SelectItem>
            {cycles.map(c => (
              <SelectItem key={c} value={c} className="text-sm font-medium capitalize">
                {formatCycleName(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={(value: FilterType) => setFilterType(value)}>
          <SelectTrigger className="w-1/2 bg-muted/30 border-border/50 rounded-[11px] h-10 text-xs font-bold uppercase tracking-wider text-muted-foreground focus:ring-primary shadow-sm hover:bg-muted/50 transition-colors">
            <SelectValue placeholder="Filtrar por...">
              {filterType === 'all' && '✨ TODAS'}
              {filterType === 'receita' && '🟢 RECEITAS'}
              {filterType === 'despesa' && '🔴 DESPESAS'}
              {filterType === 'pending' && '⏳ PENDENTES'}
              {filterType === 'paid' && '✅ PAGAS'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl z-[200]" side="bottom" sideOffset={4} alignItemWithTrigger={false}>
            <SelectItem value="all" className="text-sm font-medium">✨ TODAS AS TRANSAÇÕES</SelectItem>
            <SelectItem value="receita" className="text-sm font-medium text-emerald-600 dark:text-emerald-500">🟢 RECEITAS</SelectItem>
            <SelectItem value="despesa" className="text-sm font-medium text-rose-600 dark:text-rose-500">🔴 DESPESAS</SelectItem>
            <SelectItem value="pending" className="text-sm font-medium text-amber-600 dark:text-amber-500">⏳ PENDENTES</SelectItem>
            <SelectItem value="paid" className="text-sm font-medium text-primary">✅ PAGAS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 px-4">
        <div className="flex flex-col gap-2.5">
          {displayItems.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 flex flex-col items-center border border-dashed rounded-[11px] border-border/50">
               <div className="bg-card w-10 h-10 rounded-[11px] flex items-center justify-center mb-3">
                 <Search className="h-5 w-5 opacity-50" />
               </div>
               <p className="text-xs">Nenhuma transação</p>
            </div>
          ) : (
            displayItems.map((t, i) => {
              const isExpanded = expandedId === t.id;
              const isInvoice = t.isVirtualInvoice;
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={t.id} 
                  className={`flex flex-col bg-card shadow-sm rounded-[11px] border cursor-pointer hover:border-primary/50 transition-colors overflow-hidden ${isExpanded ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}
                >
                   {/* Main Row */}
                   <div 
                     className="flex items-center justify-between p-3"
                     onClick={() => setExpandedId(isExpanded ? null : t.id)}
                   >
                     <div className="flex items-center gap-3">
                        {isInvoice ? (
                          <div className="p-2 rounded-[11px] text-white" style={{ backgroundColor: t.color || '#333' }}>
                            <CreditCard className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className={`p-2 rounded-[11px] ${
                            t.type === 'receita' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500' : 
                            !t.isPaid ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500'
                          }`}>
                            {t.type === 'receita' ? <TrendingUp className="h-4 w-4" /> : 
                             !t.isPaid ? <Clock className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-xs mb-0.5 tracking-tight flex items-center gap-1.5 flex-wrap">
                            {t.description}
                            {isInvoice && t.brand && <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t.brand}</span>}
                            {t.notes && t.notes.startsWith('paymentMethod:') && (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {t.notes.replace('paymentMethod:', '')}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex flex-col gap-0.5 font-medium">
                            <span>{isInvoice ? 'Vencimento da Fatura' : 'Lançamento'}: {t.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                            {t.isPaid && t.paymentDate && (
                              <span className="text-emerald-600 dark:text-emerald-500 font-bold">Pago em: {new Date(t.paymentDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                            )}
                            {t.installments && t.installments > 1 && (
                              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 self-start">
                                {t.currentInstallment}/{t.installments}
                              </span>
                            )}
                          </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 text-right">
                       <div>
                         <div className={`font-bold text-xs ${
                           t.type === 'receita' ? 'text-emerald-600 dark:text-emerald-500' : 
                           (t.isPaid || isInvoice) ? 'text-foreground' : 'text-amber-600 dark:text-amber-500'
                         }`}>
                           {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
                         </div>
                         {!t.isPaid && !isInvoice && <div className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-1">Pendente</div>}
                         {t.isPaid && !isInvoice && <div className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest mt-1">Pago</div>}
                         {isInvoice && <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Fatura</div>}
                       </div>
                     </div>
                   </div>

                   {/* Expanded Area */}
                   {isExpanded && (
                     <motion.div 
                       initial={{ height: 0, opacity: 0 }}
                       animate={{ height: 'auto', opacity: 1 }}
                       className="border-t bg-muted/10 p-3 flex gap-2"
                     >
                        {isInvoice ? (
                          <div className="flex-1 flex flex-col items-center justify-center p-2 text-center">
                            <p className="text-xs font-medium text-muted-foreground">Para dar baixa nesta fatura ou ver os lançamentos individuais, acesse a área de Cartões/Faturas.</p>
                          </div>
                        ) : (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (t.isPaid) {
                                  handleTogglePayment(t);
                                } else {
                                  setConfirmPaymentTransactionId(t.id);
                                }
                              }}
                              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                                t.isPaid 
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-400' 
                                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400'
                              }`}
                            >
                              {t.isPaid ? (
                                <><Clock className="w-4 h-4" /> Tornar Pendente</>
                              ) : (
                                <><CheckCircle2 className="w-4 h-4" /> Confirmar Pagamento</>
                              )}
                            </button>
                            
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTransactionId(t.id);
                                setTransactionModalOpen(true);
                              }}
                              className="px-4 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg flex items-center justify-center transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </>
                        )}
                     </motion.div>
                   )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
