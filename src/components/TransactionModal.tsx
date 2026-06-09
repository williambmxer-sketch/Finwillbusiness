import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDataStore } from '../store/useDataStore';
import { api } from '../services/api';
import { generateUUID } from '../lib/utils';
import { Transaction, Category, Account, Card } from '../db/db';
import { X, Save, Trash, ChevronDown } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function CustomSelect({
  value,
  onValueChange,
  options,
  placeholder = "Selecione...",
  disabled = false
}: {
  value: string;
  onValueChange: (val: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl h-11 px-3.5 text-sm bg-muted/50 border border-transparent text-left flex items-center justify-between focus:ring-1 focus:ring-primary focus:bg-background transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={!selectedOption ? "text-muted-foreground" : "text-foreground font-medium"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute z-[250] mt-1 w-full max-h-60 overflow-y-auto rounded-xl bg-card border border-border shadow-xl py-1 outline-none animate-in fade-in-50 slide-in-from-top-1">
          {options.length === 0 ? (
            <div className="px-3.5 py-2 text-xs text-muted-foreground text-center">Nenhuma opção disponível</div>
          ) : (
            options.map(opt => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  onValueChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between ${opt.value === value ? 'bg-primary/5 text-primary font-semibold' : 'text-foreground font-medium'
                  } ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface CustomPaymentMethod {
  id: string;
  name: string;
  allowInstallments: boolean;
}

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

  const [type, setType] = useState<'receita' | 'despesa'>('despesa');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('money');
  const [isPaid, setIsPaid] = useState(true);
  const [installments, setInstallments] = useState('1');
  const [customPaymentMethods, setCustomPaymentMethods] = useState<CustomPaymentMethod[]>([]);
  const [firstInstallmentIn30Days, setFirstInstallmentIn30Days] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cardId.startsWith('custom-')) {
      setFirstInstallmentIn30Days(true);
    } else {
      setFirstInstallmentIn30Days(false);
    }
  }, [cardId]);

  useEffect(() => {
    if (isTransactionModalOpen) {
      const stored = localStorage.getItem('custom_payment_methods');
      if (stored) {
        setCustomPaymentMethods(JSON.parse(stored));
      } else {
        const initial = [
          { id: '1', name: 'Crediário', allowInstallments: true },
          { id: '2', name: 'Boleto Parcelado', allowInstallments: true }
        ];
        setCustomPaymentMethods(initial);
        localStorage.setItem('custom_payment_methods', JSON.stringify(initial));
      }
    }
  }, [isTransactionModalOpen]);

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
      setError(null);
      return;
    }

    if (!categories || !accounts || !cards) return;

    // Only initialize once per open
    if (hasInitialized) return;

    if (editingTransactionId) {
      const t = useDataStore.getState().transactions.find(tx => tx.id === editingTransactionId);
      if (t) {
        setType(t.type);
        setAmount((t.amount).toString());
        setDescription(t.description);
        setDate(new Date(t.date).toISOString().split('T')[0]);
        setCategoryId(t.categoryId);
        setAccountId(t.accountId || (accounts[0]?.id || ''));
        
        let pmId = 'money';
        if (t.cardId) {
          pmId = t.cardId;
        } else if (t.notes && t.notes.startsWith('paymentMethod:')) {
          const pmNameFromNotes = t.notes.replace('paymentMethod:', '');
          const stored = localStorage.getItem('custom_payment_methods');
          const pms: CustomPaymentMethod[] = stored ? JSON.parse(stored) : [];
          const found = pms.find(p => p.name === pmNameFromNotes);
          if (found) {
            pmId = `custom-${found.id}`;
          } else {
            pmId = `custom-${pmNameFromNotes}`;
          }
        }
        setCardId(pmId);
        setIsPaid(t.isPaid);
        setInstallments((t.installments || 1).toString());
        setHasInitialized(true);
      }
    } else {
      setType('despesa');
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setCategoryId('');
      setAccountId('');

      if (defaultPaymentMethod?.startsWith('card-')) {
        setCardId(defaultPaymentMethod.replace('card-', ''));
      } else {
        setCardId('money');
      }

      setIsPaid(false);
      setInstallments('1');
      setHasInitialized(true);
    }
  }, [editingTransactionId, isTransactionModalOpen, accounts, defaultPaymentMethod, hasInitialized]);

  const selectedPaymentMethod = cardId.startsWith('custom-')
    ? (customPaymentMethods.find(pm => `custom-${pm.id}` === cardId || `custom-${pm.name}` === cardId) || { name: cardId.replace('custom-', ''), allowInstallments: true })
    : null;

  const showInstallments = (cardId !== 'money' && !selectedPaymentMethod) || (selectedPaymentMethod?.allowInstallments);

  const handleSave = async () => {
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Por favor, insira um valor válido para a transação.');
      return;
    }

    if (!description || !description.trim()) {
      setError('Por favor, preencha a descrição da transação.');
      return;
    }

    if (!categoryId || categoryId === 'none' || categoryId === '') {
      setError('Por favor, selecione uma categoria.');
      return;
    }

    if (type === 'receita' && (!accountId || accountId === 'none' || accountId === '')) {
      setError('Selecione a conta de destino para receber o valor.');
      return;
    }

    if (type === 'despesa' && cardId === 'money' && isPaid && (!accountId || accountId === 'none' || accountId === '')) {
      setError('Selecione a conta bancária para confirmar o pagamento.');
      return;
    }

    const txAmount = parseFloat(amount);

    if (type === 'despesa' && isPaid && accountId) {
      const accountsList = useDataStore.getState().accounts;
      const acc = accountsList.find(a => a.id === accountId);
      if (acc) {
        const oldTx = editingTransactionId ? useDataStore.getState().transactions.find(t => t.id === editingTransactionId) : null;
        const originalAmountPaidOnSameAcc = (oldTx && oldTx.isPaid && oldTx.accountId === accountId) ? oldTx.amount : 0;
        const netDeduction = txAmount - originalAmountPaidOnSameAcc;
        if (acc.balance < netDeduction) {
          alert(`Saldo insuficiente na conta selecionada! Saldo disponível: R$ ${acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          return;
        }
      }
    }

    const isCustom = cardId.startsWith('custom-');
    const isCard = cardId !== 'money' && !isCustom;
    const paymentMethodName = isCustom ? (selectedPaymentMethod?.name || cardId.replace('custom-', '')) : undefined;

    if (isCard) {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        const currentUsage = useDataStore.getState().transactions
          .filter(t => t.cardId === card.id && t.type === 'despesa' && t.id !== editingTransactionId)
          .reduce((sum, t) => sum + t.amount, 0);

        if (currentUsage + txAmount > card.limit) {
          alert(`Limite do cartão excedido! Limite disponível: R$ ${(card.limit - currentUsage).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          return;
        }
      }
    }

    // Convert date string with local timezone offset
    const dateObj = new Date(date + 'T12:00:00');
    const numInstallments = showInstallments ? Math.max(1, parseInt(installments, 10) || 1) : 1;
    const getAcc = (id: string) => useDataStore.getState().accounts.find(a => a.id === id);

    if (numInstallments > 1 && !editingTransactionId) {
      const parentId = generateUUID();
      const installmentAmount = txAmount / numInstallments;
      const newTransactions: Transaction[] = [];

      for (let i = 0; i < numInstallments; i++) {
        const txDate = new Date(dateObj);
        const monthOffset = firstInstallmentIn30Days ? i + 1 : i;
        txDate.setMonth(txDate.getMonth() + monthOffset);

        newTransactions.push({
          id: generateUUID(),
          description: `${description} (${i + 1}/${numInstallments})`,
          amount: installmentAmount,
          date: txDate,
          type: 'despesa',
          categoryId,
          cardId: isCard ? cardId : undefined,
          accountId: undefined,
          installments: numInstallments,
          currentInstallment: i + 1,
          parentId,
          isPaid: false,
          notes: isCustom ? `paymentMethod:${paymentMethodName}` : undefined,
        });
      }

      await api.transactions.bulkAdd(newTransactions);
    } else {
      const tx: Transaction = {
        id: editingTransactionId || generateUUID(),
        description,
        amount: txAmount,
        date: dateObj,
        type,
        categoryId,
        accountId: (cardId !== 'money' || !accountId || accountId === 'none') ? undefined : accountId,
        cardId: isCard ? cardId : undefined,
        isPaid: cardId !== 'money' ? false : isPaid,
        notes: isCustom ? `paymentMethod:${paymentMethodName}` : undefined,
      };

      if (editingTransactionId) {
        const oldTx = useDataStore.getState().transactions.find(t => t.id === editingTransactionId);
        if (oldTx) {
          tx.installments = oldTx.installments;
          tx.currentInstallment = oldTx.currentInstallment;
          tx.parentId = oldTx.parentId;
          if (!isCustom && oldTx.notes) tx.notes = oldTx.notes;
        }
        await api.transactions.update(editingTransactionId, tx);

        if (oldTx) {
          if (oldTx.accountId === tx.accountId) {
            let balanceDiff = 0;
            if (oldTx.isPaid) {
              balanceDiff -= (oldTx.type === 'receita' ? oldTx.amount : -oldTx.amount);
            }
            if (tx.isPaid) {
              balanceDiff += (tx.type === 'receita' ? tx.amount : -tx.amount);
            }

            if (tx.accountId && balanceDiff !== 0) {
              const acc = getAcc(tx.accountId);
              if (acc) {
                await api.accounts.update(tx.accountId, {
                  balance: acc.balance + balanceDiff
                });
              }
            }
          } else {
            if (oldTx.accountId && oldTx.isPaid) {
              const oldAcc = getAcc(oldTx.accountId);
              if (oldAcc) {
                await api.accounts.update(oldTx.accountId, {
                  balance: oldAcc.balance - (oldTx.type === 'receita' ? oldTx.amount : -oldTx.amount)
                });
              }
            }
            if (tx.accountId && tx.isPaid) {
              const newAcc = getAcc(tx.accountId);
              if (newAcc) {
                await api.accounts.update(tx.accountId, {
                  balance: newAcc.balance + (tx.type === 'receita' ? tx.amount : -tx.amount)
                });
              }
            }
          }
        }
      } else {
        await api.transactions.add(tx);
        if (tx.accountId && tx.isPaid) {
          const acc = getAcc(tx.accountId);
          if (acc) {
            await api.accounts.update(tx.accountId, {
              balance: acc.balance + (tx.type === 'receita' ? tx.amount : -tx.amount)
            });
          }
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
      setError(null);
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

        <div className="flex-1 p-5 flex flex-col gap-4">
          <div className="flex bg-muted/50 p-1 rounded-[12px]">
            <button
              className={`flex-1 py-2 rounded-[10px] text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'despesa' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-30 disabled:cursor-not-allowed`}
              onClick={() => setType('despesa')}
              disabled={!!activeContextCardId && currentView === 'cardDetails'}
            >Despesa</button>
            <button
              className={`flex-1 py-2 rounded-[10px] text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'receita' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-30 disabled:cursor-not-allowed`}
              onClick={() => setType('receita')}
              disabled={!!activeContextCardId && currentView === 'cardDetails'}
            >Receita</button>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-1">
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-muted-foreground">R$</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  className="w-[180px] p-0 text-center text-3xl font-extrabold h-9 bg-transparent border-none shadow-none focus-visible:ring-0"
                  value={displayAmount}
                  onChange={handleAmountChange}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Descrição</Label>
                <Input
                  placeholder="Ex: Almoço"
                  className="rounded-xl h-10 text-xs bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Data</Label>
                  <Input
                    type="date"
                    className="rounded-xl h-10 text-xs bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none uppercase font-medium"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Categoria</Label>
                  <CustomSelect
                    value={categoryId}
                    onValueChange={setCategoryId}
                    placeholder="Selecione..."
                    options={categories.filter(c => {
                      const ct = String(c.type || '').toLowerCase();
                      const t = String(type || '').toLowerCase();
                      return ct === t ||
                        (t === 'despesa' && (ct === 'expense' || ct === 'despesa' || ct === 'desp')) ||
                        (t === 'receita' && (ct === 'income' || ct === 'receita' || ct === 'rec'));
                    }).map(c => ({
                      value: c.id,
                      label: c.name
                    }))}
                  />
                </div>
              </div>

              {type === 'despesa' ? (
                <div className={`grid ${(cardId === 'money' && isPaid) || showInstallments ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                  <div>
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Pagamento</Label>
                    <CustomSelect
                      value={cardId}
                      onValueChange={setCardId}
                      placeholder="Selecione..."
                      disabled={!!activeContextCardId && currentView === 'cardDetails'}
                      options={[
                        { value: 'money', label: 'PIX' },
                        ...cards.map(c => ({
                          value: c.id,
                          label: c.name
                        })),
                        ...customPaymentMethods.map(pm => ({
                          value: `custom-${pm.id}`,
                          label: pm.name
                        }))
                      ]}
                    />
                  </div>
                  {cardId === 'money' && isPaid && (
                    <div>
                      <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">
                        Conta <span className="text-destructive font-bold">*</span>
                      </Label>
                      <CustomSelect
                        value={accountId}
                        onValueChange={setAccountId}
                        placeholder="Selecione..."
                        options={accounts.map(a => ({
                          value: a.id,
                          label: a.name
                        }))}
                      />
                    </div>
                  )}
                  {cardId !== 'money' && showInstallments && (
                    <div>
                      <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Parcelas</Label>
                      <Input
                        type="number"
                        min="1"
                        max="72"
                        className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none font-medium text-center"
                        value={installments}
                        onChange={e => setInstallments(e.target.value)}
                        disabled={!!editingTransactionId}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">
                    Conta <span className="text-destructive font-bold">*</span>
                  </Label>
                  <CustomSelect
                    value={accountId}
                    onValueChange={setAccountId}
                    placeholder="Selecione..."
                    options={accounts.map(a => ({
                      value: a.id,
                      label: a.name
                    }))}
                  />
                </div>
              )}

              {type === 'despesa' && cardId === 'money' && (
                <div className="flex items-center justify-between pt-1 px-1">
                  <span className="text-xs font-semibold text-foreground select-none">Confirmar Pagamento</span>
                  <button
                    type="button"
                    onClick={() => setIsPaid(!isPaid)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${isPaid ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${isPaid ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              )}

              {type === 'despesa' && showInstallments && parseInt(installments, 10) > 1 && (
                <div className="flex items-center justify-between pt-1 px-1">
                  <span className="text-xs font-semibold text-foreground select-none">Primeira parcela em 30 dias</span>
                  <button
                    type="button"
                    onClick={() => setFirstInstallmentIn30Days(!firstInstallmentIn30Days)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${firstInstallmentIn30Days ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${firstInstallmentIn30Days ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="px-5 py-2 mx-5 mb-1 bg-destructive/10 text-destructive text-xs font-semibold rounded-xl text-center animate-in fade-in-50 slide-in-from-top-1">
            {error}
          </div>
        )}

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
