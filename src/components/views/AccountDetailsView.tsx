import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { Plus, ChevronLeft, Landmark, TrendingUp, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';

export function AccountDetailsView() {
  const { setCurrentView, activeAccountId, setEditingAccountId, setAccountModalOpen, setEditingTransactionId, setTransactionModalOpen } = useAppStore();
  
  const accounts = useDataStore(state => state.accounts);
  const account = accounts.find(a => a.id === activeAccountId);

  const allTransactions = useDataStore(state => state.transactions);
  const transactions = React.useMemo(() => {
    return allTransactions
      .filter(t => t.accountId === activeAccountId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allTransactions, activeAccountId]);

  const handleQuickPay = async (e: React.MouseEvent, t: any) => {
    e.stopPropagation();
    if (t.isPaid || t.cardId !== 'money') return;
    
    await api.transactions.update(t.id, { isPaid: true });
    
    if (t.accountId) {
      const acc = useDataStore.getState().accounts.find(a => a.id === t.accountId);
      if (acc) {
        await api.accounts.update(t.accountId, {
          balance: acc.balance + (t.type === 'receita' ? t.amount : -t.amount)
        });
      }
    }
  };

  if (!account) {
    return (
      <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => setCurrentView('accounts')} className="p-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Conta não encontrada</h1>
        </header>
      </div>
    );
  }

  // Calculate a mock evolution or just use the current balance as the focal point
  const totalIncomes = transactions.filter(t => t.type === 'receita' && t.isPaid).reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'despesa' && t.isPaid).reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
      <header className="px-4 pb-4">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentView('accounts')} className="p-1 -ml-1 text-muted-foreground hover:text-foreground bg-muted/20 rounded-lg">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{account.name}</h1>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{account.type}</div>
            </div>
          </div>
          <button 
            onClick={() => {
              setEditingAccountId(account.id);
              setCurrentView('accounts'); // navigate back behind modal
              setAccountModalOpen(true);
            }}
            className="text-primary text-xs font-bold uppercase tracking-wider p-2 bg-primary/10 rounded-[11px]"
          >
            Editar
          </button>
        </div>
        
        <div className="bg-card border shadow-sm rounded-[11px] p-5 mb-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Landmark className="w-32 h-32 -mr-8 -mt-8" />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Saldo Atual</div>
            <div className="text-4xl font-bold tracking-tight mb-4">{formatCurrency(account.balance)}</div>
            
            <div className="flex gap-4 border-t pt-4">
               <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mb-0.5">Entradas (Pagas)</div>
                  <div className="text-sm font-bold">{formatCurrency(totalIncomes)}</div>
               </div>
               <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-rose-600 mb-0.5">Saídas (Pagas)</div>
                  <div className="text-sm font-bold">{formatCurrency(totalExpenses)}</div>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* Transactions List */}
      <div className="flex-1 px-4 mt-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Movimentações</h2>
        
        <div className="flex flex-col gap-2.5">
          {transactions.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 flex flex-col items-center border border-dashed rounded-[11px] border-border/50">
               <p className="text-xs">Nenhuma movimentação nesta conta</p>
            </div>
          ) : (
            transactions.map((t, i) => (
              <motion.div 
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setEditingTransactionId(t.id);
                  setTransactionModalOpen(true);
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={t.id} 
                className="flex items-center justify-between p-3 bg-card shadow-sm rounded-[11px] border cursor-pointer hover:border-primary/50 transition-colors"
              >
                 <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-[11px] ${
                      t.type === 'receita' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500' : 
                      !t.isPaid ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500'
                    }`}>
                      {t.type === 'receita' ? <TrendingUp className="h-4 w-4" /> : 
                       !t.isPaid ? <Clock className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-semibold text-xs mb-0.5 tracking-tight">{t.description}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 font-medium">
                        <span>{t.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 text-right">
                   <div>
                     <div className={`font-bold text-xs ${
                       t.type === 'receita' ? 'text-emerald-600 dark:text-emerald-500' : 
                       t.isPaid ? 'text-foreground' : 'text-amber-600 dark:text-amber-500'
                     }`}>
                       {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
                     </div>
                     {!t.isPaid && <div className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-1">Pendente</div>}
                   </div>
                   {!t.isPaid && t.cardId === 'money' && (
                     <button 
                       onClick={(e) => handleQuickPay(e, t)}
                       className="p-2 border border-emerald-500/30 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 hover:bg-emerald-100 hover:border-emerald-500/50 rounded-lg transition-colors flex-shrink-0"
                     >
                       <CheckCircle2 className="w-5 h-5" />
                     </button>
                   )}
                 </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
