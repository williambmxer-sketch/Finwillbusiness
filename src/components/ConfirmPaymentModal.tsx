import React, { useState, useEffect } from 'react';
import { useDataStore } from '../store/useDataStore';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { isBankAccount, isCashPaymentMethod } from '../utils/financialRules';
import { formatCurrency } from '../utils/formatters';

export function ConfirmPaymentModal() {
  const { confirmPaymentTransactionId, setConfirmPaymentTransactionId } = useAppStore();
  
  const allTransactions = useDataStore(state => state.transactions);
  const transaction = allTransactions.find(t => t.id === confirmPaymentTransactionId);
  const accounts = useDataStore(state => state.accounts);
  const cards = useDataStore(state => state.cards);
  const customPaymentMethods = useDataStore(state => state.customPaymentMethods);

  const [date, setDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [validationError, setValidationError] = useState('');

  const eligibleAccounts = transaction
    ? accounts.filter(account => (
      transaction.type === 'receita'
        ? account.showInReceipts !== false
        : account.showInPayments !== false
    ) || account.id === transaction.accountId)
    : accounts;

  useEffect(() => {
    if (transaction) {
      setDate(new Date().toISOString().split('T')[0]); // Default to today
      let pmId = '';
      if (transaction.cardId) {
        pmId = transaction.cardId;
      } else if (transaction.notes && transaction.notes.startsWith('paymentMethod:')) {
        const pmNameFromNotes = transaction.notes.replace('paymentMethod:', '');
        const found = customPaymentMethods.find(p => p.name === pmNameFromNotes);
        if (found) {
          pmId = `custom-${found.id}`;
        } else {
          pmId = `custom-${pmNameFromNotes}`;
        }
      }
      setCardId(pmId);
      const selectedMethod = customPaymentMethods.find(pm => `custom-${pm.id}` === pmId);
      const linkedAccount = selectedMethod?.linkedAccountId
        ? accounts.find(account => account.id === selectedMethod.linkedAccountId)
        : undefined;
      const availableAccounts = linkedAccount && !eligibleAccounts.some(account => account.id === linkedAccount.id)
        ? [...eligibleAccounts, linkedAccount]
        : eligibleAccounts;
      const defaultAccounts = isCashPaymentMethod(selectedMethod?.name)
        ? availableAccounts.filter(account => account.type === 'carteira')
        : availableAccounts.filter(isBankAccount);
      setAccountId(linkedAccount?.id || (transaction.accountId && availableAccounts.some(account => account.id === transaction.accountId)
        ? transaction.accountId
        : defaultAccounts[0]?.id || availableAccounts[0]?.id || ''));
      setAmount(transaction.amount);
      setValidationError('');
    }
  }, [transaction, accounts, customPaymentMethods]);

  if (!confirmPaymentTransactionId || !transaction || transaction.isPaid) return null;

  const selectedMethod = cardId.startsWith('custom-') ? customPaymentMethods.find(pm => `custom-${pm.id}` === cardId) : null;
  const isCashPayment = isCashPaymentMethod(selectedMethod?.name);
  const linkedAccount = selectedMethod?.linkedAccountId
    ? accounts.find(account => account.id === selectedMethod.linkedAccountId)
    : undefined;
  const eligibleAccountsWithLinked = linkedAccount && !eligibleAccounts.some(account => account.id === linkedAccount.id)
    ? [...eligibleAccounts, linkedAccount]
    : eligibleAccounts;
  const accountOptions = isCashPayment
    ? eligibleAccountsWithLinked.filter(account => account.type === 'carteira' && (!selectedMethod?.linkedAccountId || account.id === selectedMethod.linkedAccountId))
    : (cardId || selectedMethod || transaction.type === 'receita')
      ? eligibleAccountsWithLinked.filter(isBankAccount)
      : eligibleAccountsWithLinked;

  const handlePaymentMethodChange = (nextPaymentMethodId: string) => {
    setValidationError('');
    setCardId(nextPaymentMethodId);
    const nextMethod = nextPaymentMethodId.startsWith('custom-')
      ? customPaymentMethods.find(pm => `custom-${pm.id}` === nextPaymentMethodId)
      : null;
    const nextIsCash = isCashPaymentMethod(nextMethod?.name);
    const nextLinkedAccount = nextMethod?.linkedAccountId
      ? accounts.find(account => account.id === nextMethod.linkedAccountId)
      : undefined;
    const nextAccounts = nextLinkedAccount && !eligibleAccounts.some(account => account.id === nextLinkedAccount.id)
      ? [...eligibleAccounts, nextLinkedAccount]
      : eligibleAccounts;
    const nextOptions = nextIsCash
      ? nextAccounts.filter(account => account.type === 'carteira' && (!nextMethod?.linkedAccountId || account.id === nextMethod.linkedAccountId))
      : nextPaymentMethodId || nextMethod || transaction.type === 'receita'
        ? nextAccounts.filter(isBankAccount)
        : nextAccounts;
    setAccountId(nextLinkedAccount?.id || (nextOptions.some(account => account.id === accountId) ? accountId : nextOptions[0]?.id || ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isCustom = cardId.startsWith('custom-');
    const isCard = transaction.type === 'despesa' && !isCustom;
    const requiresAccount = selectedMethod ? (selectedMethod.debitFromAccount !== false || isCashPaymentMethod(selectedMethod.name)) : true;

    if (!cardId) {
      setValidationError(`Selecione uma forma de ${transaction.type === 'receita' ? 'recebimento' : 'pagamento'} para continuar.`);
      return;
    }

    if (transaction.type === 'receita' && !isCustom) {
      setValidationError('Selecione uma forma de recebimento válida. Cartões não podem ser usados para recebimentos.');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setValidationError('Informe um valor de recebimento ou pagamento maior que zero.');
      return;
    }

    if (!date) {
      setValidationError('Informe a data para concluir a baixa.');
      return;
    }

    const selectedAccount = accounts.find(account => account.id === accountId);
    if (isCashPayment && (!selectedAccount || selectedAccount.type !== 'carteira')) {
      setValidationError('Pagamentos em Dinheiro só podem sair de uma conta do tipo Carteira.');
      return;
    }
    if (isCashPayment && selectedMethod?.linkedAccountId && selectedMethod.linkedAccountId !== accountId) {
      setValidationError('A forma Dinheiro está vinculada a outra Carteira.');
      return;
    }
    if (requiresAccount && !accountId) {
      setValidationError(`Selecione uma conta de ${transaction.type === 'receita' ? 'entrada' : 'saída'}.`);
      return;
    }
    if (requiresAccount && !isCashPayment && !isBankAccount(selectedAccount)) {
      setValidationError(`Esta forma de ${transaction.type === 'receita' ? 'recebimento' : 'pagamento'} deve usar uma conta bancária Corrente ou Poupança.`);
      return;
    }

    // Create local Date from input, setting to noon to avoid timezone shift issues
    const realPaymentDate = new Date(date + 'T12:00:00');
    const finalAmount = amount === '' ? transaction.amount : Number(amount);

    const paymentMethodName = isCustom ? (selectedMethod?.name || cardId.replace('custom-', '')) : undefined;

    await api.transactions.update(transaction.id, {
      amount: finalAmount,
      paymentDate: realPaymentDate,
      accountId: requiresAccount || transaction.type === 'receita' ? accountId : undefined,
      cardId: transaction.type === 'despesa' && isCard ? cardId : undefined,
      isPaid: true,
      notes: isCustom ? `paymentMethod:${paymentMethodName}` : transaction.notes
    });

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
              <h2 className="text-xl font-bold tracking-tight">Confirmar {transaction.type === 'receita' ? 'Recebimento' : 'Pagamento'}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Confirme os dados para dar baixa na transação <strong className="text-foreground">{transaction.description}</strong>.
            </p>

            {validationError && (
              <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-700 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <div className="bg-muted/10 rounded-[24px] p-5 space-y-4 border border-border/30">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Valor</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                  <Input 
                    type="number" 
                    step="0.01"
                    className="w-full h-10 pl-9 bg-muted/50 border-transparent focus:bg-background focus:ring-1 focus:ring-primary transition-colors shadow-none rounded-[12px] font-medium"
                    value={amount}
                    onChange={e => { setValidationError(''); setAmount(e.target.value ? Number(e.target.value) : ''); }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Data do {transaction.type === 'receita' ? 'Recebimento' : 'Pagamento'}</label>
                <Input 
                  type="date" 
                  className="w-full h-10 bg-muted/50 border-transparent focus:bg-background focus:ring-1 focus:ring-primary transition-colors shadow-none rounded-[12px] uppercase"
                  value={date}
                  onChange={e => { setValidationError(''); setDate(e.target.value); }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Forma de {transaction.type === 'receita' ? 'Recebimento' : 'Pagamento'}</label>
                  <Select value={cardId} onValueChange={handlePaymentMethodChange}>
                  <SelectTrigger className="w-full h-10 bg-muted/50 border-transparent focus:ring-1 focus:ring-primary shadow-none rounded-[12px] font-medium">
                    <SelectValue placeholder="Selecione...">
                      {cards.find(c => c.id === cardId) ? `🛒 Cartão ${cards.find(c => c.id === cardId)?.name}` : (
                        customPaymentMethods.find(pm => `custom-${pm.id}` === cardId) ? `⚡ ${customPaymentMethods.find(pm => `custom-${pm.id}` === cardId)?.name}` : (cardId ? `⚡ ${cardId.replace('custom-', '')}` : 'Selecione...')
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" alignItemWithTrigger={false} sideOffset={6} className="max-h-56 rounded-xl z-[200]">
                    {transaction.type === 'despesa' && cards.map(c => (
                      <SelectItem key={c.id} value={c.id} className="font-medium">🛒 Cartão {c.name}</SelectItem>
                    ))}
                    {customPaymentMethods.map(pm => (
                      <SelectItem key={pm.id} value={`custom-${pm.id}`} className="font-medium">⚡ {pm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {((!cardId.startsWith('custom-') && cardId !== '') || (customPaymentMethods.find(pm => `custom-${pm.id}` === cardId)?.debitFromAccount !== false) || transaction.type === 'receita') && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Conta de {transaction.type === 'receita' ? 'Entrada' : 'Saída'}</label>
                  <Select value={accountId} onValueChange={(value) => { setValidationError(''); setAccountId(value); }}>
                    <SelectTrigger className="w-full h-10 bg-muted/50 border-transparent focus:ring-1 focus:ring-primary shadow-none rounded-[12px] font-medium">
                    <SelectValue placeholder="Selecione a conta...">
                      {accountId ? (() => {
                        const account = accounts.find(a => a.id === accountId);
                        return account ? `${account.name} • ${formatCurrency(account.balance)}` : 'Selecione a conta...';
                      })() : 'Selecione a conta...'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" alignItemWithTrigger={false} sideOffset={6} className="max-h-56 rounded-xl z-[200]">
                    {accountOptions.map(a => (
                      <SelectItem key={a.id} value={a.id} className="font-medium">{a.name} • {formatCurrency(a.balance)}</SelectItem>
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
