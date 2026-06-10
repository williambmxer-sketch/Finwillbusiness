import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDataStore } from '../store/useDataStore';
import { api } from '../services/api';
import { generateUUID } from '../lib/utils';
import { Transaction, Category, Account, Card } from '../db/db';
import { X, Save, Trash, ChevronDown } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { formatCurrency } from '../utils/formatters';

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
        className="w-full rounded-xl h-8 px-3 text-[11px] bg-muted/50 border border-transparent text-left flex items-center justify-between focus:ring-1 focus:ring-primary focus:bg-background transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate text-left w-full pr-2 font-medium ${!selectedOption ? "text-muted-foreground" : "text-foreground"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-[250] mt-1 w-full max-h-48 overflow-y-auto rounded-xl bg-card border border-border shadow-xl py-1 outline-none animate-in fade-in-50 slide-in-from-top-1">
          {options.length === 0 ? (
            <div className="px-3 py-1.5 text-[11px] text-muted-foreground text-center">Nenhuma opção disponível</div>
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
                className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted transition-colors flex items-center justify-between ${opt.value === value ? 'bg-primary/5 text-primary font-semibold' : 'text-foreground font-medium'
                  } ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="truncate pr-2">{opt.label}</span>
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

  const [type, setType] = useState<'receita' | 'despesa' | 'transferencia'>('despesa');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [cardId, setCardId] = useState('money');
  const [isPaid, setIsPaid] = useState(false);
  const [installments, setInstallments] = useState('1');
  const [customPaymentMethods, setCustomPaymentMethods] = useState<CustomPaymentMethod[]>([]);
  const [firstInstallmentIn30Days, setFirstInstallmentIn30Days] = useState(false);
  const [payFirstInstallmentToday, setPayFirstInstallmentToday] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);
  const [installmentActionType, setInstallmentActionType] = useState<'edit' | 'delete' | null>(null);
  const [installmentMode, setInstallmentMode] = useState<'divide' | 'repeat'>('divide');
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (cardId.startsWith('custom-')) {
      setFirstInstallmentIn30Days(true);
      setPayFirstInstallmentToday(false);
    } else {
      setFirstInstallmentIn30Days(false);
      setPayFirstInstallmentToday(false);
    }
  }, [cardId]);

  useEffect(() => {
    if (!editingTransactionId && hasInitialized) {
      if (type === 'receita') {
        setIsPaid(false);
        setInstallmentMode('repeat');
      } else {
        setIsPaid(false);
        setInstallmentMode('divide');
      }
    }
  }, [type, editingTransactionId, hasInitialized]);

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

  useEffect(() => {
    if (!isTransactionModalOpen) {
      setHasInitialized(false);
      setError(null);
      setBalanceWarning(null);
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
        setFirstInstallmentIn30Days(false);
        setPayFirstInstallmentToday(false);
        setHasInitialized(true);
      }
    } else {
      setType('despesa');
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setCategoryId('');
      setAccountId('');
      setToAccountId('');

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

  const showInstallments = type === 'receita' || (cardId !== 'money' && !selectedPaymentMethod) || (selectedPaymentMethod?.allowInstallments);

  const numInstallments = showInstallments ? Math.max(1, parseInt(installments, 10) || 1) : 1;

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

    if (type === 'transferencia') {
      if (!accountId || !toAccountId || accountId === toAccountId) {
        setError('Por favor, selecione contas de origem e destino válidas e diferentes.');
        return;
      }
    } else {
      if (!categoryId || categoryId === 'none' || categoryId === '') {
        setError('Por favor, selecione uma categoria.');
        return;
      }
    }

    if (type === 'receita' && isPaid && (!accountId || accountId === 'none' || accountId === '')) {
      setError('Selecione a conta de destino para receber o valor.');
      return;
    }

    const txAmount = parseFloat(amount);

    if (type === 'despesa' && cardId === 'money' && isPaid && (!accountId || accountId === 'none' || accountId === '')) {
      setError('Selecione a conta bancária para confirmar o pagamento.');
      return;
    }

    if (type === 'despesa' && showInstallments && numInstallments > 1 && !firstInstallmentIn30Days && payFirstInstallmentToday && (!accountId || accountId === 'none' || accountId === '')) {
      setError('Selecione a conta bancária para a entrada / primeira parcela.');
      return;
    }

    if (type === 'despesa' && isPaid && accountId && cardId === 'money') {
      const accountsList = useDataStore.getState().accounts;
      const acc = accountsList.find(a => a.id === accountId);
      if (acc) {
        const oldTx = editingTransactionId ? useDataStore.getState().transactions.find(t => t.id === editingTransactionId) : null;
        const originalAmountPaidOnSameAcc = (oldTx && oldTx.isPaid && oldTx.accountId === accountId) ? oldTx.amount : 0;
        const netDeduction = txAmount - originalAmountPaidOnSameAcc;
        if (acc.balance < netDeduction && !balanceWarning) {
          setBalanceWarning(`Saldo insuficiente na conta selecionada. Saldo disponível: ${acc.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Clique em Salvar novamente para confirmar mesmo assim.`);
          return;
        }
      }
    }

    if (type === 'despesa' && showInstallments && numInstallments > 1 && !firstInstallmentIn30Days && payFirstInstallmentToday && accountId) {
      const accountsList = useDataStore.getState().accounts;
      const acc = accountsList.find(a => a.id === accountId);
      const firstInstallmentAmount = installmentMode === 'divide' ? txAmount / numInstallments : txAmount;
      if (acc && acc.balance < firstInstallmentAmount && !balanceWarning) {
        setBalanceWarning(`Saldo insuficiente para pagar a entrada. Saldo disponível: ${acc.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Clique em Salvar novamente para confirmar mesmo assim.`);
        return;
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
          setError(`Limite do cartão excedido! Limite disponível: R$ ${(card.limit - currentUsage).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          return;
        }
      }
    }

    // Intercept if editing an installment transaction
    if (editingTransactionId) {
      const oldTx = useDataStore.getState().transactions.find(t => t.id === editingTransactionId);
      if (oldTx && oldTx.parentId && oldTx.installments && oldTx.installments > 1) {
        setInstallmentActionType('edit');
        return;
      }
    }

    // Convert date string with local timezone offset
    const dateObj = new Date(date + 'T12:00:00');
    const getAcc = (id: string) => useDataStore.getState().accounts.find(a => a.id === id);

    // --- TRANSFER LOGIC ---
    if (type === 'transferencia') {
      let transferCategory = categories.find(c => c.name.toLowerCase() === 'transferência' || c.name.toLowerCase() === 'transferencia');
      if (!transferCategory) {
        const newCat = {
          id: generateUUID(),
          name: 'Transferência',
          color: '#3b82f6', // blue-500
          icon: 'arrow-right-left',
          type: 'despesa' as const,
          showInCards: false,
          showInAccounts: false
        };
        await api.categories.add(newCat);
        transferCategory = newCat;
      }

      const transferGroupId = generateUUID();
      const originTx: Transaction = {
        id: generateUUID(),
        description: description || `Transferência para ${accounts.find(a => a.id === toAccountId)?.name}`,
        amount: txAmount,
        date: dateObj,
        type: 'despesa',
        categoryId: transferCategory.id,
        accountId: accountId,
        isPaid: true,
        paymentDate: dateObj,
        notes: `transferencia:${transferGroupId}`,
        parentId: transferGroupId
      };
      const destTx: Transaction = {
        id: generateUUID(),
        description: description || `Transferência de ${accounts.find(a => a.id === accountId)?.name}`,
        amount: txAmount,
        date: dateObj,
        type: 'receita',
        categoryId: transferCategory.id,
        accountId: toAccountId,
        isPaid: true,
        paymentDate: dateObj,
        notes: `transferencia:${transferGroupId}`,
        parentId: transferGroupId
      };

      await api.transactions.bulkAdd([originTx, destTx]);
      
      const originAcc = getAcc(accountId);
      const destAcc = getAcc(toAccountId);
      if (originAcc) await api.accounts.update(accountId, { balance: originAcc.balance - txAmount });
      if (destAcc) await api.accounts.update(toAccountId, { balance: destAcc.balance + txAmount });
      
      closeModal();
      return;
    }
    // --- END TRANSFER LOGIC ---

    if (numInstallments > 1 && !editingTransactionId) {
      const parentId = generateUUID();
      // 'divide': split total equally; 'repeat': repeat full amount each month
      const installmentAmount = installmentMode === 'divide'
        ? txAmount / numInstallments
        : txAmount;
      const newTransactions: Transaction[] = [];

      for (let i = 0; i < numInstallments; i++) {
        const txDate = new Date(dateObj);
        const monthOffset = (type === 'despesa' && firstInstallmentIn30Days) ? i + 1 : i;
        txDate.setMonth(txDate.getMonth() + monthOffset);

        const isThisPaid = type === 'receita'
          ? (i === 0 ? isPaid : false)
          : ((!firstInstallmentIn30Days && i === 0) ? payFirstInstallmentToday : false);

        newTransactions.push({
          id: generateUUID(),
          description: `${description} (${i + 1}/${numInstallments})`,
          amount: installmentAmount,
          date: txDate,
          type: type,
          categoryId,
          cardId: type === 'despesa' && isCard ? cardId : undefined,
          accountId: isThisPaid ? accountId : undefined,
          installments: numInstallments,
          currentInstallment: i + 1,
          parentId,
          isPaid: isThisPaid,
          notes: isCustom ? `paymentMethod:${paymentMethodName}` : undefined,
        });
      }

      await api.transactions.bulkAdd(newTransactions);

      const firstPaidAmount = installmentMode === 'divide' ? txAmount / numInstallments : txAmount;
      if (type === 'receita' && isPaid && accountId) {
        const acc = getAcc(accountId);
        if (acc) {
          await api.accounts.update(accountId, {
            balance: acc.balance + firstPaidAmount
          });
        }
      } else if (type === 'despesa' && !firstInstallmentIn30Days && payFirstInstallmentToday && accountId) {
        const acc = getAcc(accountId);
        if (acc) {
          await api.accounts.update(accountId, {
            balance: acc.balance - firstPaidAmount
          });
        }
      }
    } else {
      const tx: Transaction = {
        id: editingTransactionId || generateUUID(),
        description,
        amount: txAmount,
        date: dateObj,
        type,
        categoryId,
        accountId: (type === 'despesa' && cardId !== 'money') || !isPaid || !accountId || accountId === 'none' ? undefined : accountId,
        cardId: type === 'despesa' && isCard ? cardId : undefined,
        isPaid: type === 'despesa' && cardId !== 'money' ? false : isPaid,
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

    setBalanceWarning(null);
    if (keepOpen && !editingTransactionId) {
      setAmount('');
      setDescription('');
      setCategoryId('');
      setIsPaid(false);
      setInstallments('1');
      setError(null);
    } else {
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (editingTransactionId) {
      const oldTx = useDataStore.getState().transactions.find(t => t.id === editingTransactionId);
      if (oldTx) {
        if (oldTx.parentId && oldTx.installments && oldTx.installments > 1) {
          setInstallmentActionType('delete');
          return;
        }

        if (oldTx.accountId && oldTx.isPaid) {
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
    }
  };


  const handleInstallmentAction = async (scope: 'only' | 'following' | 'all') => {
    if (!editingTransactionId) return;
    const oldTx = useDataStore.getState().transactions.find(t => t.id === editingTransactionId);
    if (!oldTx) return;


    const txAmount = parseFloat(amount);
    const dateObj = new Date(date + 'T12:00:00');
    const isCustom = cardId.startsWith('custom-');
    const isCard = cardId !== 'money' && !isCustom;
    const paymentMethodName = isCustom ? (selectedPaymentMethod?.name || cardId.replace('custom-', '')) : undefined;
    const getAcc = (id: string) => useDataStore.getState().accounts.find(a => a.id === id);

    if (installmentActionType === 'edit') {
      let targets: Transaction[] = [];
      if (scope === 'only') {
        targets = [oldTx];
      } else if (scope === 'following') {
        targets = useDataStore.getState().transactions.filter(
          t => t.parentId === oldTx.parentId && t.currentInstallment! >= oldTx.currentInstallment!
        );
      } else {
        targets = useDataStore.getState().transactions.filter(
          t => t.parentId === oldTx.parentId
        );
      }

      // Base description without any installment suffix (e.g. "Carro" from "Carro (3/6)")
      const baseDescription = description.replace(/\s*\(\d+\/\d+\)$/, '').trim();

      // Delta de meses entre a nova data digitada e a data original da parcela sendo editada.
      const anchorOriginalDate = new Date(oldTx.date);
      const monthDelta =
        (dateObj.getFullYear() - anchorOriginalDate.getFullYear()) * 12 +
        (dateObj.getMonth() - anchorOriginalDate.getMonth());

      for (const t of targets) {
        const isThis = t.id === oldTx.id;

        // --- Data ---
        let newDate: Date;
        if (scope === 'only') {
          newDate = dateObj;
        } else if (isThis) {
          newDate = dateObj;
        } else {
          const tOriginal = new Date(t.date);
          newDate = new Date(tOriginal);
          newDate.setMonth(tOriginal.getMonth() + monthDelta);
          newDate.setDate(dateObj.getDate());
          if (newDate.getMonth() !== (tOriginal.getMonth() + monthDelta + 12) % 12) {
            newDate.setDate(0); 
          }
        }

        // --- Descrição ---
        const totalInstallments = t.installments ?? 1;
        const newDescription = isThis
          ? description
          : totalInstallments > 1
            ? `${baseDescription} (${t.currentInstallment}/${totalInstallments})`
            : baseDescription;

        const newTx: Transaction = {
          ...t,
          description: newDescription,
          amount: txAmount,
          date: newDate,
          categoryId,
          accountId: (type === 'despesa' && cardId !== 'money') || !isPaid || !accountId || accountId === 'none' ? undefined : accountId,
          cardId: type === 'despesa' && isCard ? cardId : undefined,
          isPaid: type === 'despesa' && cardId !== 'money' ? false : isPaid,
          notes: isCustom ? `paymentMethod:${paymentMethodName}` : (t.notes && !isCustom ? t.notes : undefined),
        };


        await api.transactions.update(t.id, newTx);

        if (t.accountId === newTx.accountId) {
          let balanceDiff = 0;
          if (t.isPaid) {
            balanceDiff -= (t.type === 'receita' ? t.amount : -t.amount);
          }
          if (newTx.isPaid) {
            balanceDiff += (newTx.type === 'receita' ? newTx.amount : -newTx.amount);
          }

          if (newTx.accountId && balanceDiff !== 0) {
            const acc = getAcc(newTx.accountId);
            if (acc) {
              await api.accounts.update(newTx.accountId, {
                balance: acc.balance + balanceDiff
              });
            }
          }
        } else {
          if (t.accountId && t.isPaid) {
            const oldAcc = getAcc(t.accountId);
            if (oldAcc) {
              await api.accounts.update(t.accountId, {
                balance: oldAcc.balance - (t.type === 'receita' ? t.amount : -t.amount)
              });
            }
          }
          if (newTx.accountId && newTx.isPaid) {
            const newAcc = getAcc(newTx.accountId);
            if (newAcc) {
              await api.accounts.update(newTx.accountId, {
                balance: newAcc.balance + (newTx.type === 'receita' ? newTx.amount : -newTx.amount)
              });
            }
          }
        }
      }
    } else if (installmentActionType === 'delete') {
      let targets: Transaction[] = [];
      if (scope === 'only') {
        targets = [oldTx];
      } else if (scope === 'following') {
        targets = useDataStore.getState().transactions.filter(
          t => t.parentId === oldTx.parentId && t.currentInstallment! >= oldTx.currentInstallment!
        );
      } else {
        targets = useDataStore.getState().transactions.filter(
          t => t.parentId === oldTx.parentId
        );
      }

      for (const t of targets) {
        if (t.accountId && t.isPaid) {
          const oldAcc = getAcc(t.accountId);
          if (oldAcc) {
            await api.accounts.update(t.accountId, {
              balance: oldAcc.balance - (t.type === 'receita' ? t.amount : -t.amount)
            });
          }
        }
        await api.transactions.delete(t.id);
      }
    }

    setInstallmentActionType(null);
    closeModal();
  };

  const closeModal = () => {
    setTransactionModalOpen(false);
    setTimeout(() => {
      setEditingTransactionId(null);
      setDefaultPaymentMethod(null);
      setError(null);
      setBalanceWarning(null);
      setKeepOpen(false);
      setInstallmentActionType(null);
      setConfirmingDelete(false);
    }, 300);
  };

  if (!isTransactionModalOpen || !categories || !accounts || !cards) return null;

  const showAccountSelector = 
    (type === 'receita') ||
    (type === 'transferencia') ||
    (type === 'despesa' && cardId === 'money' && isPaid) ||
    (type === 'despesa' && showInstallments && numInstallments > 1 && !firstInstallmentIn30Days && payFirstInstallmentToday);

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

        <div className="flex-1 p-5 flex flex-col gap-3 overflow-y-auto min-h-[460px] max-h-[460px]">
          <div className="flex bg-muted/50 p-1 rounded-[12px] shrink-0">
            <button
              className={`flex-1 py-2 rounded-[10px] text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'despesa' ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-30 disabled:cursor-not-allowed`}
              onClick={() => setType('despesa')}
              disabled={!!activeContextCardId && currentView === 'cardDetails'}
            >Despesa</button>
            <button
              className={`flex-1 py-2 rounded-[10px] text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'receita' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-30 disabled:cursor-not-allowed`}
              onClick={() => setType('receita')}
              disabled={!!activeContextCardId && currentView === 'cardDetails'}
            >Receita</button>
            <button
              className={`flex-1 py-2 rounded-[10px] text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'transferencia' ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-30 disabled:cursor-not-allowed`}
              onClick={() => setType('transferencia')}
              disabled={!!activeContextCardId && currentView === 'cardDetails'}
            >Transf.</button>
          </div>

          <div className="space-y-3">
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

            <div className="space-y-2.5">
              <div>
                <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Descrição</Label>
                <Input
                  placeholder="Ex: Almoço"
                  className="rounded-xl h-8 text-[11px] bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Data</Label>
                  <Input
                    type="date"
                    className="rounded-xl h-8 text-[11px] bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none uppercase font-medium"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
                {type !== 'transferencia' && (
                  <div>
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Categoria</Label>
                    <CustomSelect
                      value={categoryId}
                      onValueChange={setCategoryId}
                      placeholder="Selecione..."
                      options={categories.filter(c => {
                        const ct = String(c.type || '').toLowerCase();
                        const t = String(type || '').toLowerCase();
                        const isTypeMatch = ct === t ||
                          (t === 'despesa' && (ct === 'expense' || ct === 'despesa' || ct === 'desp')) ||
                          (t === 'receita' && (ct === 'income' || ct === 'receita' || ct === 'rec'));
                        
                        if (!isTypeMatch) return false;

                        if (t === 'despesa') {
                          const isCardMethod = cardId && cardId !== 'money' && !cardId.startsWith('custom-');
                          if (isCardMethod && c.showInCards === false) return false;
                          if (!isCardMethod && c.showInAccounts === false) return false;
                        }

                        return true;
                      }).map(c => ({
                        value: c.id,
                        label: c.name
                      }))}
                    />
                  </div>
                )}
              </div>

              {type === 'transferencia' ? (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-xl border border-border">
                  <div>
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Conta de Origem</Label>
                    <CustomSelect
                      value={accountId}
                      onValueChange={setAccountId}
                      placeholder="De..."
                      options={accounts.map(c => ({
                        value: c.id,
                        label: c.name
                      }))}
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Conta de Destino</Label>
                    <CustomSelect
                      value={toAccountId}
                      onValueChange={setToAccountId}
                      placeholder="Para..."
                      options={accounts.map(c => ({
                        value: c.id,
                        label: c.name,
                        disabled: c.id === accountId
                      }))}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-3">
                    <div>
                      <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Forma de Pagamento</Label>
                      <CustomSelect
                        value={cardId}
                        onValueChange={val => {
                          setCardId(val);
                          if (val !== 'money' && !val.startsWith('custom-')) {
                            setIsPaid(true); 
                          }
                        }}
                        disabled={!!activeContextCardId && currentView === 'cardDetails'}
                        options={[
                          { value: 'money', label: '💳 Dinheiro / Conta Bancária' },
                          ...cards.map(c => ({
                            value: c.id,
                            label: `🛒 Cartão ${c.name}`
                          })),
                          ...(customPaymentMethods.length > 0 ? [{ value: 'custom-sep', label: '──────────', disabled: true }] : []),
                          ...customPaymentMethods.map(pm => ({
                            value: `custom-${pm.id}`,
                            label: `⚡ ${pm.name}`
                          }))
                        ]}
                      />
                    </div>

                    {showAccountSelector && (
                      <div className="animate-in fade-in slide-in-from-top-1">
                        <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Conta Bancária</Label>
                        <CustomSelect
                          value={accountId}
                          onValueChange={setAccountId}
                          placeholder="Selecione a conta..."
                          options={accounts.map(c => ({
                            value: c.id,
                            label: c.name
                          }))}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {type !== 'transferencia' && showInstallments && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-xl border border-border">
                  <div className="col-span-1">
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Parcelas</Label>
                    <Input
                      type="number"
                      min="1"
                      max="72"
                      className="rounded-xl h-8 text-[11px] bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none font-medium text-center"
                      value={installments}
                      onChange={e => setInstallments(e.target.value)}
                      disabled={!!editingTransactionId}
                    />
                  </div>
                  {numInstallments > 1 && !editingTransactionId && (
                    <div className="col-span-2">
                      <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Modo</Label>
                      <div className="flex bg-muted/50 p-1 rounded-[10px]">
                        <button
                          type="button"
                          onClick={() => setInstallmentMode('divide')}
                          className={`flex-1 py-1.5 rounded-[8px] text-[10px] font-bold uppercase tracking-widest transition-all ${
                            installmentMode === 'divide'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Dividir
                        </button>
                        <button
                          type="button"
                          onClick={() => setInstallmentMode('repeat')}
                          className={`flex-1 py-1.5 rounded-[8px] text-[10px] font-bold uppercase tracking-widest transition-all ${
                            installmentMode === 'repeat'
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Repetir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {type !== 'transferencia' && cardId === 'money' && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-foreground select-none">
                    {type === 'receita' ? 'Confirmar Recebimento' : 'Confirmar Pagamento'}
                  </span>
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

              {type === 'despesa' && showInstallments && numInstallments > 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pt-1 px-1">
                    <span className="text-xs font-semibold text-foreground select-none">Primeira parcela em 30 dias</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !firstInstallmentIn30Days;
                        setFirstInstallmentIn30Days(nextVal);
                        if (nextVal) {
                          setPayFirstInstallmentToday(false);
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${firstInstallmentIn30Days ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${firstInstallmentIn30Days ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>

                  {!firstInstallmentIn30Days && (
                    <div className="flex items-center justify-between pt-1 px-1">
                      <span className="text-xs font-semibold text-foreground select-none">Pagar 1ª parcela hoje (Entrada)</span>
                      <button
                        type="button"
                        onClick={() => setPayFirstInstallmentToday(!payFirstInstallmentToday)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${payFirstInstallmentToday ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${payFirstInstallmentToday ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!editingTransactionId && (
                <div className="flex items-center justify-between pt-1 px-1 border-t border-border/20 mt-1 pt-2">
                  <span className="text-xs font-semibold text-foreground select-none">
                    Fixar modal aberto (continuar lançando)
                  </span>
                  <button
                    type="button"
                    onClick={() => setKeepOpen(!keepOpen)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${keepOpen ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${keepOpen ? 'translate-x-4' : 'translate-x-0'}`}
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

        {balanceWarning && (
          <div className="px-4 py-2.5 mx-5 mb-1 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-medium rounded-xl animate-in fade-in-50 slide-in-from-top-1 leading-relaxed">
            ⚠ {balanceWarning}
          </div>
        )}

        <div className="flex gap-3 p-4 border-t pb-8 sm:pb-4 bg-background">
          {editingTransactionId && (
            confirmingDelete ? (
              <div className="flex items-center gap-2 animate-in fade-in-0 zoom-in-95 duration-150">
                <span className="text-xs font-semibold text-destructive whitespace-nowrap">Excluir?</span>
                <button
                  onClick={() => { setConfirmingDelete(false); handleDelete(); }}
                  className="px-3 h-11 bg-destructive text-destructive-foreground text-xs font-bold rounded-xl hover:bg-destructive/90 transition-colors"
                >
                  Sim
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 h-11 bg-muted text-foreground text-xs font-bold rounded-xl hover:bg-muted/80 transition-colors"
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="p-3 w-12 border border-destructive/20 text-destructive rounded-xl flex items-center justify-center hover:bg-destructive/10 transition-colors"
              >
                <Trash className="w-5 h-5" />
              </button>
            )
          )}
          <button onClick={handleSave} className={`flex-1 text-sm font-bold rounded-xl h-11 flex items-center justify-center gap-2 transition-all ${balanceWarning ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
            {balanceWarning ? 'Confirmar mesmo assim' : 'Salvar'}
          </button>
        </div>

        {installmentActionType && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[280] flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-[280px] rounded-[20px] border border-border shadow-xl p-5 flex flex-col items-center text-center animate-in zoom-in-95 duration-150">
              <h3 className="text-sm font-bold tracking-tight mb-2">
                {installmentActionType === 'edit' ? 'Editar Parcelamento' : 'Excluir Parcelamento'}
              </h3>
              <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
                Esta transação faz parte de um parcelamento. Como você deseja aplicar esta {installmentActionType === 'edit' ? 'alteração' : 'exclusão'}?
              </p>
              
              <div className="flex flex-col w-full gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => handleInstallmentAction('only')}
                  className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-lg transition-all"
                >
                  Apenas esta parcela
                </button>
                <button
                  type="button"
                  onClick={() => handleInstallmentAction('following')}
                  className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-lg transition-all"
                >
                  Esta e as próximas
                </button>
                <button
                  type="button"
                  onClick={() => handleInstallmentAction('all')}
                  className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-lg transition-all"
                >
                  Todas as parcelas
                </button>
              </div>
              
              <button
                type="button"
                onClick={() => setInstallmentActionType(null)}
                className="text-xs text-muted-foreground hover:text-foreground font-medium underline"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
