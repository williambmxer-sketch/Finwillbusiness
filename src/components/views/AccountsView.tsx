import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Landmark, SlidersHorizontal, X, Check, ArrowDownToLine } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';
import { api } from '../../services/api';
import { Transaction } from '../../db/db';
import { generateUUID } from '../../lib/utils';

export function AccountsView() {
  const accounts = useDataStore(state => state.accounts);
  const { setAccountModalOpen, setEditingAccountId, setCurrentView, setActiveAccountId } = useAppStore();

  const totalBalance = accounts.reduce((acc, account) => acc + account.balance, 0);

  // Inline balance adjustment state
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [depositTargetId, setDepositTargetId] = useState<string | null>(null);
  const [depositSourceId, setDepositSourceId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositError, setDepositError] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);

  const handleAdjustOpen = (id: string, currentBalance: number) => {
    setAdjustingId(id);
    setAdjustValue(currentBalance.toFixed(2));
    setAdjustReason('');
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
      if (!adjustReason.trim()) {
        setAdjustError('O motivo do ajuste é obrigatório');
        return;
      }

      const type = diff >= 0 ? 'receita' : 'despesa';
      const categories = useDataStore.getState().categories;
      const category = categories.find(c => c.type === type && (c.name.toLowerCase().includes('ajuste') || c.name.toLowerCase().includes('outro'))) || categories.find(c => c.type === type);

      await api.transactions.add({
        description: `Ajuste de Saldo: ${adjustReason.trim()}`,
        amount: Math.abs(diff),
        date: new Date(),
        type,
        categoryId: category?.id || 'none',
        accountId: id,
        isPaid: true,
        paymentDate: new Date(),
        notes: 'Ajuste manual de saldo'
      });
    }

    await api.accounts.update(id, { balance: parsed });
    setAdjustingId(null);
    setAdjustValue('');
    setAdjustReason('');
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

  const depositTarget = accounts.find(account => account.id === depositTargetId);
  const depositSources = accounts.filter(account => account.id !== depositTargetId);
  const displayDepositAmount = depositAmount ? parseFloat(depositAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

  const openDeposit = (accountId: string) => {
    setDepositTargetId(accountId);
    setDepositSourceId(accounts.find(account => account.id !== accountId)?.id || '');
    setDepositAmount('');
    setDepositError('');
  };

  const closeDeposit = () => {
    if (isDepositing) return;
    setDepositTargetId(null);
    setDepositSourceId('');
    setDepositAmount('');
    setDepositError('');
  };

  const handleDeposit = async () => {
    if (isDepositing) return;
    const amount = parseFloat(depositAmount);
    if (!depositTargetId || !depositSourceId || !amount || amount <= 0) {
      setDepositError('Selecione a conta de origem e informe um valor válido.');
      return;
    }
    if (depositTargetId === depositSourceId) {
      setDepositError('A conta de origem precisa ser diferente da Carteira.');
      return;
    }

    setIsDepositing(true);
    setDepositError('');
    let createdTransactions: Transaction[] = [];

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('O depósito precisa de conexão ativa para proteger os saldos.');
      }

      const [freshAccounts, freshCategories] = await Promise.all([api.accounts.list(), api.categories.list()]);
      const target = freshAccounts.find(account => account.id === depositTargetId);
      const source = freshAccounts.find(account => account.id === depositSourceId);
      if (!target || target.type !== 'carteira') throw new Error('A conta de destino não é uma Carteira válida.');
      if (!source) throw new Error('A conta de origem não foi encontrada. Atualize a tela e tente novamente.');
      if (source.balance < amount) throw new Error('Saldo insuficiente na conta de origem para realizar o depósito.');

      let transferCategory = freshCategories.find(category =>
        category.name.toLowerCase() === 'transferência' || category.name.toLowerCase() === 'transferencia'
      );
      if (!transferCategory) {
        transferCategory = await api.categories.add({
          name: 'Transferência',
          color: '#3b82f6',
          icon: 'arrow-right-left',
          type: 'despesa',
          showInCards: false,
          showInAccounts: false
        });
      }

      const groupId = generateUUID();
      const date = new Date();
      createdTransactions = await api.transactions.bulkAddStrict([
        {
          description: `Depósito na ${target.name}`,
          amount,
          date,
          type: 'despesa',
          categoryId: transferCategory.id,
          accountId: source.id,
          isPaid: true,
          paymentDate: date,
          notes: `transferencia:${groupId}`,
          parentId: groupId
        },
        {
          description: `Depósito vindo de ${source.name}`,
          amount,
          date,
          type: 'receita',
          categoryId: transferCategory.id,
          accountId: target.id,
          isPaid: true,
          paymentDate: date,
          notes: `transferencia:${groupId}`,
          parentId: groupId
        }
      ]);

      const sourceExpected = source.balance - amount;
      const targetExpected = target.balance + amount;
      try {
        await api.accounts.update(source.id, { balance: sourceExpected });
      } catch {
        const checked = await api.accounts.list();
        const checkedSource = checked.find(account => account.id === source.id);
        if (!checkedSource || Math.abs(checkedSource.balance - sourceExpected) >= 0.005) {
          if (checkedSource && Math.abs(checkedSource.balance - source.balance) < 0.005) {
            await Promise.all(createdTransactions.map(transaction => api.transactions.delete(transaction.id)));
          }
          throw new Error('Não foi possível confirmar a saída da conta de origem. O depósito foi interrompido para evitar inconsistência.');
        }
      }

      try {
        await api.accounts.update(target.id, { balance: targetExpected });
      } catch {
        const checked = await api.accounts.list();
        const checkedTarget = checked.find(account => account.id === target.id);
        if (checkedTarget && Math.abs(checkedTarget.balance - targetExpected) < 0.005) {
          // A resposta falhou, mas o saldo da Carteira foi confirmado.
        } else if (checkedTarget && Math.abs(checkedTarget.balance - target.balance) < 0.005) {
          await api.accounts.update(source.id, { balance: source.balance });
          await Promise.all(createdTransactions.map(transaction => api.transactions.delete(transaction.id)));
          throw new Error('Não foi possível confirmar a entrada na Carteira. O depósito foi desfeito.');
        } else {
          throw new Error('Não foi possível confirmar o saldo da Carteira. Atualize a tela antes de tentar novamente.');
        }
      }

      await useDataStore.getState().fetchData();
      setDepositTargetId(null);
      setDepositSourceId('');
      setDepositAmount('');
      setDepositError('');
    } catch (error) {
      setDepositError(error instanceof Error ? error.message : 'Não foi possível concluir o depósito.');
      await useDataStore.getState().fetchData().catch(() => undefined);
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
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

                {account.type === 'carteira' && (
                  <div className="border-t border-border/40 px-4 py-2.5 bg-emerald-500/5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeposit(account.id);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" /> Depositar na Carteira
                    </button>
                  </div>
                )}

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
                        <div className="mt-2 bg-muted/40 rounded-xl px-3 h-8 flex items-center border border-transparent focus-within:border-primary/40 focus-within:bg-background transition-all">
                          <input
                            type="text"
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAdjustConfirm(account.id);
                              if (e.key === 'Escape') setAdjustingId(null);
                            }}
                            className="flex-1 bg-transparent text-[10px] font-medium outline-none text-muted-foreground placeholder:text-muted-foreground/50"
                            placeholder="Motivo do ajuste (ex: Correção, Rendimento)..."
                          />
                        </div>
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

      <AnimatePresence>
        {depositTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-sm rounded-[24px] border bg-card p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">Depositar na Carteira</h2>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Destino: {depositTarget.name}</p>
                </div>
                <button onClick={closeDeposit} disabled={isDepositing} className="rounded-full bg-muted p-1.5 text-muted-foreground disabled:opacity-50">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block ml-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Conta de origem</label>
                  <select
                    value={depositSourceId}
                    onChange={e => setDepositSourceId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-transparent bg-muted/50 px-3 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Selecione a conta...</option>
                    {depositSources.map(account => (
                      <option key={account.id} value={account.id}>{account.name} ({formatCurrency(account.balance)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block ml-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Valor do depósito</label>
                  <div className="flex h-11 items-center rounded-xl bg-muted/50 px-3">
                    <span className="mr-1.5 text-xs font-bold text-muted-foreground">R$</span>
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      value={displayDepositAmount}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setDepositAmount(digits ? (parseInt(digits, 10) / 100).toFixed(2) : '');
                        setDepositError('');
                      }}
                      className="w-full bg-transparent text-lg font-bold outline-none"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                {depositError && <p className="text-[10px] font-medium text-destructive">{depositError}</p>}
              </div>

              <div className="mt-5 flex gap-2.5">
                <button onClick={closeDeposit} disabled={isDepositing} className="flex-1 rounded-xl bg-muted py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground disabled:opacity-50">Cancelar</button>
                <button onClick={handleDeposit} disabled={isDepositing} className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50">{isDepositing ? 'Processando...' : 'Depositar'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
