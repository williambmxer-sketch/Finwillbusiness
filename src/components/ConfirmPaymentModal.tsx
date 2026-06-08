import React, { useState, useEffect } from 'react';
import { useDataStore } from '../store/useDataStore';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { X, CheckCircle2 } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function ConfirmPaymentModal() {
  const { confirmPaymentTransactionId, setConfirmPaymentTransactionId } = useAppStore();
  
  const allTransactions = useDataStore(state => state.transactions);
  const transaction = allTransactions.find(t => t.id === confirmPaymentTransactionId);
  const accounts = useDataStore(state => state.accounts);
  const cards = useDataStore(state => state.cards);

  const [date, setDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');

  useEffect(() => {
    if (transaction) {
      setDate(new Date().toISOString().split('T')[0]); // Default to today
      setAccountId(transaction.accountId || '');
      setCardId(transaction.cardId || 'money');
    }
  }, [transaction]);

  if (!confirmPaymentTransactionId || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Create local Date from input, setting to noon to avoid timezone shift issues
    const realPaymentDate = new Date(date + 'T12:00:00');

    await api.transactions.update(transaction.id, {
      paymentDate: realPaymentDate,
      accountId: accountId || undefined,
      cardId: cardId,
      isPaid: true
    });

    if (accountId && cardId === 'money') {
      const acc = useDataStore.getState().accounts.find(a => a.id === accountId);
      if (acc) {
        await api.accounts.update(accountId, {
          balance: acc.balance + (transaction.type === 'receita' ? transaction.amount : -transaction.amount)
        });
      }
    }

    setConfirmPaymentTransactionId(null);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
      <div 
        className="bg-card w-full max-w-md rounded-[32px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 fade-in duration-300 relative"
      >
        <button 
          onClick={() => setConfirmPaymentTransactionId(null)}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/40 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Confirmar Pagamento</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Confirme os dados para dar baixa na transação <strong className="text-foreground">{transaction.description}</strong>.
            </p>

            <div className="bg-muted/10 rounded-[24px] p-5 space-y-4 border border-border/30">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Data do Pagamento</label>
                <Input 
                  type="date" 
                  className="w-full h-10 bg-muted/50 border-transparent focus:bg-background focus:ring-1 focus:ring-primary transition-colors shadow-none rounded-[12px] uppercase"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Forma de Pagamento</label>
                <Select value={cardId} onValueChange={setCardId}>
                  <SelectTrigger className="w-full h-10 bg-muted/50 border-transparent focus:ring-1 focus:ring-primary shadow-none rounded-[12px] font-medium">
                    <SelectValue placeholder="Selecione...">
                      {cardId === 'money' ? 'PIX / Débito / Dinheiro' : (cards.find(c => c.id === cardId) ? `Cartão ${cards.find(c => c.id === cardId)?.name}` : 'Selecione...')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl z-[200]">
                    <SelectItem value="money" className="font-medium">PIX / Débito / Dinheiro</SelectItem>
                    {cards.map(c => (
                      <SelectItem key={c.id} value={c.id} className="font-medium">Cartão {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {cardId === 'money' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Conta a sair o dinheiro</label>
                  <Select value={accountId} onValueChange={setAccountId} required>
                    <SelectTrigger className="w-full h-10 bg-muted/50 border-transparent focus:ring-1 focus:ring-primary shadow-none rounded-[12px] font-medium">
                      <SelectValue placeholder="Selecione a conta...">
                        {accountId ? accounts.find(a => a.id === accountId)?.name : 'Selecione a conta...'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl z-[200]">
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id} className="font-medium">{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-muted/10 border-t mt-4 flex gap-3">
            <button 
              type="button"
              onClick={() => setConfirmPaymentTransactionId(null)}
              className="flex-1 py-3.5 rounded-[16px] text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted hover:bg-muted/80 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 py-3.5 rounded-[16px] text-xs font-bold uppercase tracking-widest text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
