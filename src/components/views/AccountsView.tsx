import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Landmark, SlidersHorizontal, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../services/api';
import { normalizePaymentMethodName } from '../../utils/financialRules';

export function AccountsView() {
  const accounts = useDataStore(state => state.accounts);
  const customPaymentMethods = useDataStore(state => state.customPaymentMethods);
  const { setAccountModalOpen, setEditingAccountId, setCurrentView, setActiveAccountId } = useAppStore();

  const totalBalance = accounts.reduce((acc, account) => acc + account.balance, 0);

  // Inline balance adjustment state
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [adjustReason, setAdjustReason] = useState<'aporte_titular' | 'ajuste_saldo'>('aporte_titular');
  const [adjustPaymentMethodId, setAdjustPaymentMethodId] = useState('');
  const [adjustError, setAdjustError] = useState('');

  const handleAdjustOpen = (id: string, currentBalance: number) => {
    const selectedAccount = accounts.find(account => account.id === id);
    const linkedMethods = customPaymentMethods.filter(method => method.linkedAccountId === id);
    const preferredMethodName = selectedAccount?.type === 'carteira' ? 'dinheiro' : 'pix';
    const preferredMethod = linkedMethods.find(method => normalizePaymentMethodName(method.name) === preferredMethodName) || linkedMethods[0];
    setAdjustingId(id);
    setAdjustValue(currentBalance.toFixed(2));
    setAdjustReason('aporte_titular');
    setAdjustPaymentMethodId(preferredMethod?.id || '');
    setAdjustError('');
  };

  const handleAdjustConfirm = async (id: string) => {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    const parsed = parseFloat(adjustValue);
    if (isNaN(parsed)) {
      setAdjustError('Valor inválido');
      return;
    }

    const diff = parsed - account.balance;
    if (diff !== 0) {
      if (adjustReason === 'aporte_titular' && diff < 0) {
        setAdjustError('Aporte do titular deve aumentar o saldo. Para reduzir, use Correção de saldo.');
        return;
      }

      const selectedPaymentMethod = adjustReason === 'aporte_titular'
        ? customPaymentMethods.find(method => method.id === adjustPaymentMethodId && method.linkedAccountId === id)
        : undefined;
      if (adjustReason === 'aporte_titular' && !selectedPaymentMethod) {
        setAdjustError('Selecione uma forma cadastrada e vinculada a esta conta.');
        return;
      }

      const type = diff >= 0 ? 'receita' : 'despesa';
      const nature = adjustReason === 'aporte_titular' ? 'aporte_socio' : 'ajuste_saldo';
      const description = adjustReason === 'aporte_titular' ? 'Aporte do titular' : 'Correção de saldo';

      await api.transactions.add({
        description,
        amount: Math.abs(diff),
        date: new Date(),
        type,
        nature,
        accountId: id,
        isPaid: true,
        paymentDate: new Date(),
        notes: selectedPaymentMethod ? `paymentMethod:${selectedPaymentMethod.name}` : 'Ajuste manual de saldo'
      });
    }

    setAdjustingId(null);
    setAdjustValue('');
    setAdjustReason('aporte_titular');
    setAdjustPaymentMethodId('');
    setAdjustError('');
  };

  const handleAdjustChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') {
      setAdjustValue('');
      return;
    }
    const numericValue = (parseInt(value, 10) / 100).toFixed(2);
    setAdjustValue(numericValue);
    setAdjustError('');
  };

  const displayAdjustValue = adjustValue ? parseFloat(adjustValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

  return (
    <div className="flex flex-col h-full bg-background relative pt-6 px-4 max-w-6xl mx-auto w-full lg:px-8">
      <header className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Contas</h1>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex gap-1.5 items-center">
            Total {formatCurrency(totalBalance)}
          </div>
        </div>
        <button
          onClick={() => {
            setEditingAccountId(null);
            setAccountModalOpen(true);
          }}
          className="text-primary bg-primary/10 p-2 rounded-[11px]"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col gap-3">
        {accounts.length === 0 ? (
          <div className="text-center text-muted-foreground p-8 border border-dashed rounded-[11px] border-border/50 text-xs">
            Nenhuma conta cadastrada.
          </div>
        ) : (
          accounts.map((account, i) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="bg-card border shadow-sm rounded-[11px] overflow-hidden hover:border-primary/30 transition-colors">
                {/* Main row */}
                <div
                  onClick={() => {
                    if (adjustingId === account.id) return;
                    setActiveAccountId(account.id);
                    setCurrentView('accountDetails');
                  }}
                  className="p-4 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-[11px] bg-primary/10 text-primary">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm tracking-tight mb-0.5">{account.name}</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{account.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className={`text-lg font-bold tracking-tight ${account.balance < 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                        {formatCurrency(account.balance)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (adjustingId === account.id) {
                          setAdjustingId(null);
                        } else {
                          handleAdjustOpen(account.id, account.balance);
                        }
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        adjustingId === account.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground/50 hover:text-primary hover:bg-primary/10'
                      }`}
                      title="Ajustar saldo"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline balance adjustment panel */}
                <AnimatePresence>
                  {adjustingId === account.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 border-t border-border/40 bg-muted/10">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-3 mb-2">
                          Ajustar saldo de {account.name}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-muted/60 rounded-xl px-3 flex-1 h-10 border border-transparent focus-within:border-primary/50 focus-within:bg-background transition-all">
                            <span className="text-xs font-bold text-muted-foreground mr-1.5">R$</span>
                            <input
                              autoFocus
                              type="text"
                              inputMode="decimal"
                              value={displayAdjustValue}
                              onChange={handleAdjustChange}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAdjustConfirm(account.id);
                                if (e.key === 'Escape') setAdjustingId(null);
                              }}
                              className="flex-1 bg-transparent text-sm font-bold outline-none text-foreground"
                              placeholder="0,00"
                            />
                          </div>
                          <button
                            onClick={() => handleAdjustConfirm(account.id)}
                            className="h-10 w-10 flex items-center justify-center bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-xl transition-colors shrink-0"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setAdjustingId(null)}
                            className="h-10 w-10 flex items-center justify-center bg-muted/60 text-muted-foreground hover:bg-muted rounded-xl transition-colors shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <label className="flex min-w-0 flex-col gap-1">
                            <span className="ml-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Motivo</span>
                            <select
                              value={adjustReason}
                              onChange={(e) => { const value = e.target.value as typeof adjustReason; setAdjustReason(value); if (value === 'ajuste_saldo') setAdjustPaymentMethodId(''); setAdjustError(''); }}
                              className="h-8 min-w-0 rounded-xl border border-transparent bg-muted/40 px-3 text-[10px] font-semibold outline-none transition-all focus:border-primary/40 focus:bg-background"
                            >
                              <option value="aporte_titular">Aporte do titular</option>
                              <option value="ajuste_saldo">Correção de saldo</option>
                            </select>
                          </label>
                          {adjustReason === 'aporte_titular' && (
                            <label className="flex min-w-0 flex-col gap-1">
                              <span className="ml-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Forma de entrada</span>
                              <select
                                value={adjustPaymentMethodId}
                                onChange={(e) => { setAdjustPaymentMethodId(e.target.value); setAdjustError(''); }}
                                className="h-8 min-w-0 rounded-xl border border-transparent bg-muted/40 px-3 text-[10px] font-semibold outline-none transition-all focus:border-primary/40 focus:bg-background"
                              >
                                <option value="">Selecione uma forma cadastrada...</option>
                                {customPaymentMethods.filter(method => method.linkedAccountId === account.id).map(method => (
                                  <option key={method.id} value={method.id}>{method.name}</option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                        {adjustReason === 'aporte_titular' && customPaymentMethods.every(method => method.linkedAccountId !== account.id) && (
                          <p className="mt-1.5 ml-1 text-[9px] text-amber-700">Cadastre uma forma de pagamento vinculada a esta conta antes de confirmar.</p>
                        )}
                        {adjustError && (
                          <p className="text-[10px] text-destructive mt-1 ml-1 font-medium">{adjustError}</p>
                        )}
                        <p className="text-[9px] text-muted-foreground mt-1.5 ml-1">
                          Saldo atual: {formatCurrency(account.balance)} · Enter para confirmar
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))
        )}
      </div>

    </div>
  );
}
