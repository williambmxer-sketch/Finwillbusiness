import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDataStore } from '../store/useDataStore';
import { api } from '../services/api';
import { generateUUID } from '../lib/utils';
import { Transaction, TransactionNature, CustomPaymentMethod } from '../db/db';
import { X, Save, Trash, ChevronDown, ArrowRightLeft } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { formatCurrency } from '../utils/formatters';
import { isCashPaymentMethod, splitAmount } from '../utils/financialRules';
import { useOrganizationStore } from '../store/useOrganizationStore';
import { useAuthStore } from '../store/useAuthStore';

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

export function TransactionModal() {
  const {
    isTransactionModalOpen, setTransactionModalOpen,
    editingTransactionId, setEditingTransactionId,
    defaultPaymentMethod, setDefaultPaymentMethod,
    activeContextCardId,
    currentView,
    transactionPreset, setTransactionPreset,
  } = useAppStore();

  const categories = useDataStore(state => state.categories);
  const accounts = useDataStore(state => state.accounts);
  const cards = useDataStore(state => state.cards);
  const customPaymentMethods = useDataStore(state => state.customPaymentMethods);
  const contacts = useDataStore(state => state.contacts);
  const members = useOrganizationStore(state => state.members);
  const currentUserId = useAuthStore(state => state.user?.id);

  const [type, setType] = useState<'receita' | 'despesa' | 'transferencia'>('despesa');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [contactId, setContactId] = useState('');
  const [nature, setNature] = useState<TransactionNature>('operacional');
  const [beneficiaryUserId, setBeneficiaryUserId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [installments, setInstallments] = useState('1');
  const [firstInstallmentIn30Days, setFirstInstallmentIn30Days] = useState(false);
  const [payFirstInstallmentToday, setPayFirstInstallmentToday] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);
  const [installmentActionType, setInstallmentActionType] = useState<'edit' | 'delete' | null>(null);
  const [installmentMode, setInstallmentMode] = useState<'divide' | 'repeat'>('divide');
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!editingTransactionId && hasInitialized && !transactionPreset) {
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
    // any logic on open can go here
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

  const displayAmount = amount ? parseFloat(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : '';

  useEffect(() => {
    if (!isTransactionModalOpen) {
      setHasInitialized(false);
      setError(null);
      setBalanceWarning(null);
      setIsSubmitting(false);
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
        setDueDate(new Date(t.dueDate || t.date).toISOString().split('T')[0]);
        setCategoryId(t.categoryId);
        setContactId(t.contactId || '');
        setNature(t.nature || 'operacional');
        setBeneficiaryUserId(t.beneficiaryUserId || '');
        setAccountId(t.accountId || (accounts[0]?.id || ''));
        
        let pmId = '';
        if (t.cardId) {
          pmId = t.cardId;
        } else if (t.notes && t.notes.startsWith('paymentMethod:')) {
          const pmNameFromNotes = t.notes.replace('paymentMethod:', '');
          const found = customPaymentMethods.find(p => p.name === pmNameFromNotes);
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
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      const future = new Date(today);
      future.setDate(future.getDate() + 7);
      const presetType = transactionPreset === 'income_received' || transactionPreset === 'income_pending' || transactionPreset === 'contribution'
        ? 'receita'
        : transactionPreset === 'transfer' ? 'transferencia' : 'despesa';
      const presetPaid = ['income_received', 'expense_paid', 'prolabore', 'withdrawal', 'contribution'].includes(transactionPreset || '');
      const presetNature: TransactionNature = transactionPreset === 'prolabore'
        ? 'pro_labore'
        : transactionPreset === 'withdrawal'
          ? 'retirada_extra'
          : transactionPreset === 'contribution'
            ? 'aporte_socio'
            : transactionPreset === 'transfer'
              ? 'transferencia'
              : 'operacional';

      setType(presetType);
      setNature(presetNature);
      setDate(todayString);
      setDueDate(presetPaid ? todayString : future.toISOString().split('T')[0]);
      setCategoryId(categories.find(category => {
        if (category.type !== (presetType === 'transferencia' ? 'despesa' : presetType)) return false;
        if (presetNature === 'pro_labore') return category.name.toLowerCase().includes('pró') || category.name.toLowerCase().includes('sócio');
        if (presetNature === 'retirada_extra') return category.name.toLowerCase().includes('retirada');
        if (presetNature === 'aporte_socio') return category.name.toLowerCase().includes('aporte');
        return true;
      })?.id || '');
      setAccountId('');
      setToAccountId('');
      setContactId('');
      setBeneficiaryUserId(['pro_labore', 'retirada_extra', 'aporte_socio'].includes(presetNature) ? (currentUserId || members[0]?.userId || '') : '');

      if (defaultPaymentMethod?.startsWith('card-')) {
        setCardId(defaultPaymentMethod.replace('card-', ''));
      } else {
        setCardId(presetType === 'despesa' && presetPaid && customPaymentMethods[0] ? `custom-${customPaymentMethods[0].id}` : '');
      }

      setIsPaid(presetPaid);
      setDescription(presetNature === 'pro_labore' ? 'Pró-labore' : presetNature === 'retirada_extra' ? 'Retirada extra' : presetNature === 'aporte_socio' ? 'Aporte do sócio' : '');
      setInstallments('1');
      setHasInitialized(true);
    }
  }, [editingTransactionId, isTransactionModalOpen, accounts, categories, customPaymentMethods, defaultPaymentMethod, hasInitialized, transactionPreset, currentUserId, members]);

  const selectedPaymentMethod = cardId.startsWith('custom-')
    ? (customPaymentMethods.find(pm => `custom-${pm.id}` === cardId || `custom-${pm.name}` === cardId) || { id: '', name: cardId.replace('custom-', ''), debitFromAccount: true } as CustomPaymentMethod)
    : null;

  const isCashPayment = isCashPaymentMethod(selectedPaymentMethod?.name);

  useEffect(() => {
    if (selectedPaymentMethod?.linkedAccountId) {
      setAccountId(selectedPaymentMethod.linkedAccountId);
    }
  }, [cardId, selectedPaymentMethod?.linkedAccountId]);

  const showInstallments = type === 'receita' || type === 'despesa';

  const numInstallments = showInstallments ? Math.max(1, parseInt(installments, 10) || 1) : 1;

  const handleSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError('Por favor, insira um valor válido para a transação.');
      setIsSubmitting(false);
      return;
    }

    if (!description || !description.trim()) {
      setError('Por favor, preencha a descrição da transação.');
      setIsSubmitting(false);
      return;
    }

    if (['pro_labore', 'retirada_extra', 'aporte_socio'].includes(nature) && !beneficiaryUserId) {
      setError('Selecione o sócio ou titular relacionado a este movimento.');
      setIsSubmitting(false);
      return;
    }

    if (type === 'transferencia') {
      if (!accountId || !toAccountId || accountId === toAccountId) {
        setError('Por favor, selecione contas de origem e destino válidas e diferentes.');
        setIsSubmitting(false);
        return;
      }
    }
    if (type === 'despesa') {
      if (isPaid && (!cardId || cardId === '')) {
        setError('Por favor, selecione uma Forma de Pagamento.');
        setIsSubmitting(false);
        return;
      }
      if (!categoryId || categoryId === 'none' || categoryId === '') {
        setError('Por favor, selecione uma categoria.');
        setIsSubmitting(false);
        return;
      }
    }

    if (type === 'receita' && isPaid && (!accountId || accountId === 'none' || accountId === '')) {
      setError('Selecione a conta de destino para receber o valor.');
      setIsSubmitting(false);
      return;
    }

    const txAmount = parseFloat(amount);

    const cashPaymentNeedsAccount = type === 'despesa' && isCashPayment && (
      isPaid || (showInstallments && numInstallments > 1 && !firstInstallmentIn30Days && payFirstInstallmentToday)
    );
    if (cashPaymentNeedsAccount) {
      const cashAccount = accounts.find(account => account.id === accountId);
      if (!cashAccount || cashAccount.type !== 'carteira') {
        setError('Pagamentos em Dinheiro só podem sair de uma conta do tipo Carteira.');
        setIsSubmitting(false);
        return;
      }
      if (selectedPaymentMethod?.linkedAccountId && selectedPaymentMethod.linkedAccountId !== cashAccount.id) {
        setError('A forma Dinheiro está vinculada a outra Carteira.');
        setIsSubmitting(false);
        return;
      }
    }

    const requiresAccount = type === 'despesa' && isPaid && selectedPaymentMethod && (selectedPaymentMethod.debitFromAccount || isCashPayment);

    if (requiresAccount && (!accountId || accountId === 'none' || accountId === '')) {
      setError('Selecione a conta bancária para confirmar o pagamento.');
      setIsSubmitting(false);
      return;
    }

    if (type === 'despesa' && showInstallments && numInstallments > 1 && !firstInstallmentIn30Days && payFirstInstallmentToday && (!accountId || accountId === 'none' || accountId === '')) {
      setError('Selecione a conta bancária para a entrada / primeira parcela.');
      setIsSubmitting(false);
      return;
    }

    if (requiresAccount && accountId) {
      const accountsList = useDataStore.getState().accounts;
      const acc = accountsList.find(a => a.id === accountId);
      if (acc) {
        const oldTx = editingTransactionId ? useDataStore.getState().transactions.find(t => t.id === editingTransactionId) : null;
        const originalAmountPaidOnSameAcc = (oldTx && oldTx.isPaid && oldTx.accountId === accountId) ? oldTx.amount : 0;
        const netDeduction = txAmount - originalAmountPaidOnSameAcc;
        if (acc.balance < netDeduction && !balanceWarning) {
          setBalanceWarning(`Saldo insuficiente na conta selecionada. Saldo disponível: ${acc.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 3 })}. Clique em Salvar novamente para confirmar mesmo assim.`);
          setIsSubmitting(false);
          return;
        }
      }
    }

    if (type === 'despesa' && showInstallments && numInstallments > 1 && !firstInstallmentIn30Days && payFirstInstallmentToday && accountId) {
      const accountsList = useDataStore.getState().accounts;
      const acc = accountsList.find(a => a.id === accountId);
      const firstInstallmentAmount = installmentMode === 'divide' ? txAmount / numInstallments : txAmount;
      if (acc && acc.balance < firstInstallmentAmount && !balanceWarning) {
        setBalanceWarning(`Saldo insuficiente para pagar a entrada. Saldo disponível: ${acc.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 3 })}. Clique em Salvar novamente para confirmar mesmo assim.`);
        setIsSubmitting(false);
        return;
      }
    }

    const isCustom = cardId.startsWith('custom-');
    const isCard = !isCustom;
    const paymentMethodName = isCustom ? (selectedPaymentMethod?.name || cardId.replace('custom-', '')) : undefined;

    if (isCard) {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        const currentUsage = useDataStore.getState().transactions
          .filter(t => t.cardId === card.id && t.type === 'despesa' && t.id !== editingTransactionId)
          .reduce((sum, t) => sum + t.amount, 0);

        if (currentUsage + txAmount > card.limit) {
          setError(`Limite do cartão excedido! Limite disponível: R$ ${(card.limit - currentUsage).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`);
          setIsSubmitting(false);
          return;
        }
      }
    }

    // Intercept if editing an installment transaction
    if (editingTransactionId) {
      const oldTx = useDataStore.getState().transactions.find(t => t.id === editingTransactionId);
      if (oldTx && oldTx.parentId && oldTx.installments && oldTx.installments > 1) {
        setInstallmentActionType('edit');
        setIsSubmitting(false);
        return;
      }
    }

    // Convert date string with local timezone offset
    const dateObj = new Date(date + 'T12:00:00');

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
        dueDate: dateObj,
        nature: 'transferencia',
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
        dueDate: dateObj,
        nature: 'transferencia',
        notes: `transferencia:${transferGroupId}`,
        parentId: transferGroupId
      };

      await api.transactions.bulkAdd([originTx, destTx]);
      
      setIsSubmitting(false);
      closeModal();
      return;
    }
    // --- END TRANSFER LOGIC ---

    if (numInstallments > 1 && !editingTransactionId) {
      const parentId = generateUUID();
      // 'divide': split total equally; 'repeat': repeat full amount each month
      const installmentAmounts = installmentMode === 'divide'
        ? splitAmount(txAmount, numInstallments)
        : Array.from({ length: numInstallments }, () => txAmount);
      const newTransactions: Transaction[] = [];

      for (let i = 0; i < numInstallments; i++) {
        const txDate = new Date(dateObj);
        const txDueDate = new Date(dueDate + 'T12:00:00');
        const monthOffset = (type === 'despesa' && firstInstallmentIn30Days) ? i + 1 : i;
        txDate.setMonth(txDate.getMonth() + monthOffset);
        txDueDate.setMonth(txDueDate.getMonth() + monthOffset);

        const isThisPaid = type === 'receita'
          ? (i === 0 ? isPaid : false)
          : ((!firstInstallmentIn30Days && i === 0) ? payFirstInstallmentToday : false);

        newTransactions.push({
          id: generateUUID(),
          description: `${description} (${i + 1}/${numInstallments})`,
          amount: installmentAmounts[i],
          date: txDate,
          type: type,
          categoryId,
          cardId: type === 'despesa' && isCard ? cardId : undefined,
          accountId: isThisPaid ? accountId : undefined,
          installments: numInstallments,
          currentInstallment: i + 1,
          parentId,
          isPaid: isThisPaid,
          paymentDate: isThisPaid ? dateObj : undefined,
          dueDate: txDueDate,
          nature,
          contactId: contactId || undefined,
          beneficiaryUserId: beneficiaryUserId || undefined,
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
        accountId: requiresAccount || type === 'receita' ? accountId : undefined,
        cardId: type === 'despesa' && isCard ? cardId : undefined,
        isPaid: isPaid,
        paymentDate: isPaid ? dateObj : null,
        dueDate: new Date(dueDate + 'T12:00:00'),
        nature,
        contactId: contactId || undefined,
        beneficiaryUserId: beneficiaryUserId || undefined,
        notes: isCustom ? `paymentMethod:${paymentMethodName}` : undefined,
      };

      if (editingTransactionId) {
        const oldTx = useDataStore.getState().transactions.find(t => t.id === editingTransactionId);
        if (oldTx) {
          tx.installments = oldTx.installments;
          tx.currentInstallment = oldTx.currentInstallment;
          tx.parentId = oldTx.parentId;
          tx.paymentDate = isPaid ? (oldTx.paymentDate || dateObj) : null;
          if (!isCustom && oldTx.notes) tx.notes = oldTx.notes;
        }
        await api.transactions.update(editingTransactionId, tx);
      } else {
        await api.transactions.add(tx);
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
      setIsSubmitting(false);
    } else {
      setIsSubmitting(false);
      closeModal();
    }
  };

  const handleDelete = async () => {
    if (editingTransactionId) {
      const oldTx = useDataStore.getState().transactions.find(t => t.id === editingTransactionId);
      if (oldTx) {
        if (oldTx.notes && oldTx.notes.startsWith('transferencia:')) {
          const transferGroupId = oldTx.notes.replace('transferencia:', '');
          const related = useDataStore.getState().transactions.filter(t => t.notes === `transferencia:${transferGroupId}`);
          
          for (const tx of related) {
            await api.transactions.delete(tx.id);
          }
          closeModal();
          return;
        }

        if (oldTx.parentId && oldTx.installments && oldTx.installments > 1) {
          setInstallmentActionType('delete');
          return;
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
    const isCard = !isCustom;
    const paymentMethodName = isCustom ? (selectedPaymentMethod?.name || cardId.replace('custom-', '')) : undefined;
    const requiresAccount = type === 'despesa' && isPaid && selectedPaymentMethod && selectedPaymentMethod.debitFromAccount;

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
          accountId: requiresAccount || type === 'receita' ? accountId : undefined,
          cardId: type === 'despesa' && isCard ? cardId : undefined,
          isPaid: isPaid,
          paymentDate: isPaid ? (t.paymentDate || dateObj) : null,
          dueDate: new Date(dueDate + 'T12:00:00'),
          nature,
          contactId: contactId || undefined,
          beneficiaryUserId: beneficiaryUserId || undefined,
          notes: isCustom ? `paymentMethod:${paymentMethodName}` : (t.notes && !isCustom ? t.notes : undefined),
        };


        await api.transactions.update(t.id, newTx);
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
      setTransactionPreset(null);
      setError(null);
      setBalanceWarning(null);
      setKeepOpen(false);
      setInstallmentActionType(null);
      setConfirmingDelete(false);
      setNature('operacional');
      setContactId('');
      setBeneficiaryUserId('');
    }, 300);
  };

  if (!isTransactionModalOpen || !categories || !accounts || !cards) return null;

  const showAccountSelector = 
    (type === 'receita') ||
    (type === 'transferencia') ||
    (type === 'despesa' && isPaid && selectedPaymentMethod && (selectedPaymentMethod.debitFromAccount || isCashPayment)) ||
    (type === 'despesa' && showInstallments && numInstallments > 1 && !firstInstallmentIn30Days && payFirstInstallmentToday);

  const presetTitle = transactionPreset ? {
    income_received: 'Registrar venda recebida',
    income_pending: 'Registrar venda a receber',
    expense_paid: 'Registrar despesa paga',
    expense_pending: 'Registrar despesa a pagar',
    transfer: 'Nova transferência',
    prolabore: 'Registrar pró-labore',
    withdrawal: 'Registrar retirada extra',
    contribution: 'Registrar aporte do sócio',
  }[transactionPreset] : null;

  const modalTitle = editingTransactionId
    ? 'Editar lançamento'
    : presetTitle || (nature === 'pro_labore'
      ? 'Registrar pró-labore'
      : nature === 'retirada_extra'
        ? 'Registrar retirada extra'
        : nature === 'aporte_socio'
          ? 'Registrar aporte do sócio'
          : type === 'transferencia'
            ? 'Nova transferência'
            : type === 'receita'
              ? 'Nova receita'
              : 'Nova despesa');

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm sm:backdrop-blur-md">
      <div className="w-full max-w-md bg-card border-t sm:border border-border sm:rounded-[20px] rounded-[24px] shadow-2xl flex flex-col h-[85dvh] sm:h-[640px] relative">
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted rounded-full" />

        <div className="flex justify-between items-center px-4 py-3 border-b">
          <div>
            <h2 className="text-base font-bold tracking-tight">{modalTitle}</h2>
            {nature !== 'operacional' && nature !== 'transferencia' && <div className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-primary">Movimento de sócio • separado do resultado operacional</div>}
          </div>
          <button onClick={closeModal} className="p-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 px-4 py-2 flex flex-col gap-2 overflow-y-auto">
          <div className="flex bg-muted/50 p-1 rounded-[12px] shrink-0">
            <button
              className={`flex-1 py-2 rounded-[10px] text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'despesa' ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-30 disabled:cursor-not-allowed`}
              onClick={() => { setType('despesa'); setNature('operacional'); setTransactionPreset(null); }}
              disabled={!!activeContextCardId && currentView === 'cardDetails'}
            >Despesa</button>
            <button
              className={`flex-1 py-2 rounded-[10px] text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'receita' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-30 disabled:cursor-not-allowed`}
              onClick={() => { setType('receita'); setNature('operacional'); setTransactionPreset(null); }}
              disabled={!!activeContextCardId && currentView === 'cardDetails'}
            >Receita</button>
            <button
              className={`flex-1 py-2 rounded-[10px] text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'transferencia' ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'} disabled:opacity-30 disabled:cursor-not-allowed`}
              onClick={() => { setType('transferencia'); setNature('transferencia'); setTransactionPreset(null); }}
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
              {type !== 'transferencia' && showInstallments && numInstallments > 1 && !editingTransactionId && (
                <div className="text-[12px] font-bold text-foreground mt-1 animate-in fade-in slide-in-from-top-1">
                  {installmentMode === 'divide' 
                    ? `${numInstallments}x de ${formatCurrency(amount / numInstallments)}` 
                    : `${numInstallments}x de ${formatCurrency(amount)} (Total: ${formatCurrency(amount * numInstallments)})`}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
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
                          const isCardMethod = cardId && !cardId.startsWith('custom-');
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

              {type !== 'transferencia' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Vencimento</Label>
                    <Input
                      type="date"
                      className="rounded-xl h-8 text-[11px] bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none uppercase font-medium"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">{type === 'receita' ? 'Cliente' : 'Fornecedor'} (opcional)</Label>
                    <CustomSelect
                      value={contactId}
                      onValueChange={setContactId}
                      placeholder="Sem contato"
                      options={contacts.filter(contact => contact.active && (contact.type === 'ambos' || contact.type === (type === 'receita' ? 'cliente' : 'fornecedor'))).map(contact => ({ value: contact.id, label: contact.name }))}
                    />
                  </div>
                </div>
              )}

              {['pro_labore', 'retirada_extra', 'aporte_socio'].includes(nature) && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5">
                  <Label className="text-[9px] uppercase tracking-widest text-primary font-bold mb-1 block ml-1">Sócio ou titular</Label>
                  <CustomSelect
                    value={beneficiaryUserId}
                    onValueChange={setBeneficiaryUserId}
                    placeholder="Selecione o beneficiário"
                    options={members.filter(member => member.active).map(member => ({ value: member.userId, label: member.displayName || member.email || 'Usuário' }))}
                  />
                </div>
              )}

              {type === 'transferencia' ? (
                <div className="flex flex-col gap-1 p-2.5 bg-muted/30 rounded-xl border border-border">
                  <div>
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Conta de Origem</Label>
                    <CustomSelect
                      value={accountId}
                      onValueChange={(val) => {
                        if (val === toAccountId) setToAccountId(accountId);
                        setAccountId(val);
                      }}
                      placeholder="De..."
                      options={accounts.map(c => ({
                        value: c.id,
                        label: `${c.name} • ${formatCurrency(c.balance)}`
                      }))}
                    />
                  </div>
                  <div className="flex items-center justify-center -my-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const temp = accountId;
                        setAccountId(toAccountId);
                        setToAccountId(temp);
                      }}
                      className="p-1.5 rounded-full bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Conta de Destino</Label>
                    <CustomSelect
                      value={toAccountId}
                      onValueChange={(val) => {
                        if (val === accountId) setAccountId(toAccountId);
                        setToAccountId(val);
                      }}
                      placeholder="Para..."
                      options={accounts.map(c => ({
                        value: c.id,
                        label: `${c.name} • ${formatCurrency(c.balance)}`
                      }))}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {type === 'despesa' && isPaid && (
                    <div className="p-2.5 bg-muted/30 rounded-xl border border-border space-y-2 animate-in fade-in slide-in-from-top-1">
                      <div>
                        <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Forma de Pagamento</Label>
                        <CustomSelect
                          value={cardId}
                          onValueChange={val => {
                            setCardId(val);
                            if (!val.startsWith('custom-')) {
                              setIsPaid(false); 
                            }
                          }}
                          disabled={!!activeContextCardId && currentView === 'cardDetails'}
                          options={
                            type === 'receita' || isPaid 
                            ? [
                                ...cards.map(c => ({ value: c.id, label: `🛒 Cartão ${c.name}` })),
                                ...customPaymentMethods.map(pm => ({
                                  value: `custom-${pm.id}`,
                                  label: `⚡ ${pm.name}`
                                }))
                              ]
                            : []
                          }
                        />
                      </div>
                    </div>
                  )}

                  {(type === 'receita' || type === 'despesa') && (
                    <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-xl border border-border">
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

                  {showAccountSelector && (
                    <div className="p-2.5 bg-muted/30 rounded-xl border border-border space-y-2 animate-in fade-in slide-in-from-top-1">
                      <div>
                        <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Conta Bancária</Label>
                        <CustomSelect
                          value={accountId}
                          onValueChange={setAccountId}
                          placeholder={isCashPayment ? 'Selecione a Carteira...' : 'Selecione a conta...'}
                          options={(isCashPayment
                            ? accounts.filter(account => account.type === 'carteira' && (!selectedPaymentMethod?.linkedAccountId || account.id === selectedPaymentMethod.linkedAccountId))
                            : accounts
                          ).map(c => ({
                            value: c.id,
                            label: `${c.name} • ${formatCurrency(c.balance)}`
                          }))}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {type !== 'transferencia' && showInstallments && (
                <div className="flex flex-col gap-2 p-2.5 bg-muted/30 rounded-xl border border-border">
                  <div className="grid grid-cols-2 gap-3">
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
                      <div className="col-span-1">
                        <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block ml-1">Modo</Label>
                        <div className="flex bg-muted/50 p-1 rounded-xl h-8">
                          <button
                            type="button"
                            onClick={() => setInstallmentMode('divide')}
                            className={`flex-1 rounded-[8px] text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center ${
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
                            className={`flex-1 rounded-[8px] text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center ${
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
                </div>
              )}



              {type === 'despesa' && showInstallments && numInstallments > 1 && (
                <div className="space-y-1">
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
                <div className="flex items-center justify-between px-1 border-t border-border/20 mt-1 pt-1.5">
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

        <div className="flex gap-3 p-4 border-t pb-8 sm:pb-4 bg-background rounded-b-[24px] sm:rounded-b-[20px]">
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
          <button disabled={isSubmitting} onClick={handleSave} className={`flex-1 text-sm font-bold rounded-xl h-11 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${balanceWarning ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
            {isSubmitting ? 'Salvando...' : (balanceWarning ? 'Confirmar mesmo assim' : 'Salvar')}
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
