import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDataStore } from '../store/useDataStore';
import { api } from '../services/api';
import { Transaction, Category, Account, Card } from '../db/db';
import { X, Save, Trash } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

export function TransactionModal() {
  const { 
    isTransactionModalOpen, setTransactionModalOpen, 
    editingTransactionId, setEditingTransactionId,
    defaultPaymentMethod, setDefaultPaymentMethod,
    activeContextCardId,
    currentView
  } = useAppStore();
  
  const categories = useDataStore(state => state.categories);
  const accounts = useDataStore(state => state.accounts);
  const cards = useDataStore(state => state.cards);

  const [type, setType] = useState<'receita'|'despesa'>('despesa');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('money');
  const [isPaid, setIsPaid] = useState(true);

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

  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!isTransactionModalOpen) {
      setHasInitialized(false);
      return;
    }

    if (!categories || !accounts || !cards) return;

    // Only initialize once per open
    if (hasInitialized) return;
    
    // Wait for accounts to exist if needed, strictly speaking we just pick the first once loaded
    // but typically useLiveQuery returns [] initially then updates.
    // If it's empty, we'll just not set a default account right now to prevent loops.
    
    if (editingTransactionId) {
      const t = useDataStore.getState().transactions.find(tx => tx.id === editingTransactionId);
      if (t) {
          setType(t.type);
          setAmount((t.amount).toString());
          setDescription(t.description);
          setDate(new Date(t.date).toISOString().split('T')[0]);
          setCategoryId(t.categoryId);
          setAccountId(t.accountId || (accounts[0]?.id || ''));
          setCardId(t.cardId || 'money');
          setIsPaid(t.isPaid);
          setHasInitialized(true);
        }
    } else {
      setType('despesa');
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setCategoryId('');
      setAccountId(accounts[0]?.id || '');
      
      if (defaultPaymentMethod?.startsWith('card-')) {
        setCardId(defaultPaymentMethod.replace('card-', ''));
      } else {
        setCardId('money');
      }

      setIsPaid(true);
      setHasInitialized(true);
    }
  }, [editingTransactionId, isTransactionModalOpen, accounts, defaultPaymentMethod, hasInitialized]);

  const handleSave = async () => {
    if (!description || !amount || parseFloat(amount) <= 0 || !categoryId || categoryId === 'none') return;
    if (cardId === 'money' && (!accountId || accountId === 'none')) return;
    
    // Convert date string with local timezone offset
    const dateObj = new Date(date + 'T12:00:00');

    const tx: Transaction = {
      id: editingTransactionId || crypto.randomUUID(),
      description,
      amount: parseFloat(amount),
      date: dateObj,
      type,
      categoryId,
      accountId: cardId !== 'money' ? undefined : accountId,
      cardId: cardId !== 'money' ? cardId : undefined,
      isPaid: cardId !== 'money' ? false : isPaid,
    };

    const getAcc = (id: string) => useDataStore.getState().accounts.find(a => a.id === id);

    if (editingTransactionId) {
      const oldTx = useDataStore.getState().transactions.find(t => t.id === editingTransactionId);
      if (oldTx) {
          // Revert old transaction impact
          if (oldTx.accountId && oldTx.isPaid) {
              const oldAcc = getAcc(oldTx.accountId);
              if (oldAcc) {
                  await api.accounts.update(oldTx.accountId, {
                      balance: oldAcc.balance - (oldTx.type === 'receita' ? oldTx.amount : -oldTx.amount)
                  });
              }
          }
      }
      await api.transactions.update(editingTransactionId, tx);
      // Apply new transaction impact
      if (tx.accountId && tx.isPaid) {
          const newAcc = getAcc(tx.accountId);
          if (newAcc) {
              await api.accounts.update(tx.accountId, {
                  balance: newAcc.balance + (tx.type === 'receita' ? tx.amount : -tx.amount)
              });
          }
      }
    } else {
      await api.transactions.add(tx);
      // Auto-update account balance if paid using an account
      if (tx.accountId && tx.isPaid) {
        const acc = getAcc(tx.accountId);
        if (acc) {
          await api.accounts.update(tx.accountId, {
            balance: acc.balance + (tx.type === 'receita' ? tx.amount : -tx.amount)
          });
        }
      }
    }
    
    closeModal();
  };

  const handleDelete = async () => {
    if (editingTransactionId) {
      const oldTx = useDataStore.getState().transactions.find(t => t.id === editingTransactionId);
      if (oldTx && oldTx.accountId && oldTx.isPaid) {
          const oldAcc = useDataStore.getState().accounts.find(a => a.id === oldTx.accountId);
          if (oldAcc) {
              await api.accounts.update(oldTx.accountId, {
                  balance: oldAcc.balance - (oldTx.type === 'receita' ? oldTx.amount : -oldTx.amount)
              });
          }
      }
      await api.transactions.delete(editingTransactionId);
      closeModal();
    }
  };

  const closeModal = () => {
    setTransactionModalOpen(false);
    setTimeout(() => {
      setEditingTransactionId(null);
      setDefaultPaymentMethod(null);
    }, 300);
  };

  if (!isTransactionModalOpen || !categories || !accounts || !cards) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm sm:backdrop-blur-md">
      <div className="w-full max-w-md bg-card border-t sm:border border-border sm:rounded-[20px] rounded-t-[24px] shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90dvh] transition-all relative">
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted rounded-full" />
        
        <div className="flex justify-between items-center p-5 pb-4 border-b">
          <h2 className="text-base font-bold tracking-tight">{editingTransactionId ? 'Editar Transação' : 'Nova Transação'}</h2>
          <button onClick={closeModal} className="p-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="flex bg-muted/50 p-1.5 rounded-[16px]">
            <button 
              className={`flex-1 py-2.5 rounded-[12px] text-[11px] font-bold uppercase tracking-widest transition-all ${type === 'despesa' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-30 disabled:cursor-not-allowed`}
              onClick={() => setType('despesa')}
              disabled={!!activeContextCardId && currentView === 'cardDetails'}
            >Despesa</button>
            <button 
              className={`flex-1 py-2.5 rounded-[12px] text-[11px] font-bold uppercase tracking-widest transition-all ${type === 'receita' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-30 disabled:cursor-not-allowed`}
              onClick={() => setType('receita')}
              disabled={!!activeContextCardId && currentView === 'cardDetails'}
            >Receita</button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Valor</span>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold text-muted-foreground">R$</span>
                <Input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="0,00" 
                  className="w-[180px] p-0 text-center text-4xl font-bold h-12 bg-transparent border-none shadow-none focus-visible:ring-0"
                  value={displayAmount}
                  onChange={handleAmountChange}
                />
              </div>
            </div>

            <div className="bg-muted/10 rounded-[24px] p-5 space-y-4 border border-border/30">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Descrição</Label>
                <Input 
                  placeholder="Ex: Almoço" 
                  className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Data</Label>
                  <Input 
                    type="date" 
                    className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none uppercase font-medium"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Categoria</Label>
                  <Select value={categoryId || "none"} onValueChange={setCategoryId}>
                    <SelectTrigger className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none">
                      <SelectValue placeholder="Selecione...">
                        {categoryId === "none" ? "Selecione..." : categories?.find(c => c.id === categoryId)?.name || "Selecione..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl z-[200]">
                      <SelectItem value="none" disabled className="hidden">Selecione...</SelectItem>
                      {categories.filter(c => c.type === type).map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-sm font-medium">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {type === 'despesa' && (
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Método de Pagamento</Label>
                  <Select value={cardId || "none"} onValueChange={setCardId} disabled={!!activeContextCardId && currentView === 'cardDetails'}>
                    <SelectTrigger className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none disabled:opacity-50 disabled:cursor-not-allowed">
                      <SelectValue placeholder="Selecione...">
                        {cardId === 'money' ? 'Conta Corrente / PIX / Dinheiro' : 
                         cardId === 'none' ? 'Selecione...' :
                         cards?.find(c => c.id === cardId) 
                           ? `${cards.find(c => c.id === cardId)?.name} ${cards.find(c => c.id === cardId)?.lastFour ? `(Final ${cards.find(c => c.id === cardId)?.lastFour})` : ''}` 
                           : "Selecione..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl z-[200]">
                      <SelectItem value="none" disabled className="hidden">Selecione...</SelectItem>
                      <SelectItem value="money" className="text-sm font-medium">Conta Corrente / PIX / Dinheiro</SelectItem>
                      {cards.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-sm font-medium">{c.name} {c.lastFour ? `(Final ${c.lastFour})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(type === 'receita' || cardId === 'money') && (
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Conta</Label>
                  <Select value={accountId || "none"} onValueChange={setAccountId}>
                    <SelectTrigger className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none">
                      <SelectValue placeholder="Selecione...">
                        {accountId === "none" ? "Selecione..." : accounts?.find(a => a.id === accountId)?.name || "Selecione..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl z-[200]">
                      <SelectItem value="none" disabled className="hidden">Selecione...</SelectItem>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id} className="text-sm font-medium">{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {cardId === 'money' && (
                <div className="flex items-center gap-3 mt-1 ml-1">
                  <input 
                    type="checkbox" 
                    id="isPaid" 
                    className="rounded-[4px] text-primary focus:ring-primary h-4 w-4 border-input bg-background"
                    checked={isPaid}
                    onChange={e => setIsPaid(e.target.checked)}
                  />
                  <Label htmlFor="isPaid" className="text-sm font-semibold cursor-pointer">Confirmar Pagamento</Label>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 p-4 border-t pb-8 sm:pb-4 bg-background">
          {editingTransactionId && (
            <button onClick={handleDelete} className="p-3 w-12 border border-destructive/20 text-destructive rounded-xl flex items-center justify-center hover:bg-destructive/10 transition-colors">
              <Trash className="w-5 h-5" />
            </button>
          )}
          <button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground text-sm font-bold rounded-xl h-11 flex items-center justify-center gap-2 hover:bg-primary/90 transition-all">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
