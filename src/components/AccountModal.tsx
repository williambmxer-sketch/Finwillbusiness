import React, { useState, useEffect } from 'react';
import { useDataStore } from '../store/useDataStore';
import { Account } from '../db/db';
import { api } from '../services/api';
import { Loader2, X, Trash } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAppStore } from '../store/useAppStore';

export function AccountModal() {
  const { isAccountModalOpen, setAccountModalOpen, editingAccountId, setEditingAccountId } = useAppStore();
  
  const accounts = useDataStore(state => state.accounts);

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [type, setType] = useState<Account['type']>('corrente');
  const [showInPayments, setShowInPayments] = useState(true);
  const [showInReceipts, setShowInReceipts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') {
      setBalance('');
      return;
    }
    const numericValue = (parseInt(value, 10) / 100).toFixed(2);
    setBalance(numericValue);
  };

  const displayBalance = balance ? parseFloat(balance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : '';

  useEffect(() => {
    if (editingAccountId && isAccountModalOpen) {
      const account = accounts.find(a => a.id === editingAccountId);
      if (account) {
        setName(account.name);
        setBalance(account.balance.toString());
        setType(account.type || 'corrente');
        setShowInPayments(account.showInPayments ?? true);
        setShowInReceipts(account.showInReceipts ?? true);
      }
    } else if (!editingAccountId && isAccountModalOpen) {
      setName('');
      setBalance('');
      setType('corrente');
      setShowInPayments(true);
      setShowInReceipts(true);
    }
  }, [editingAccountId, isAccountModalOpen, accounts]);

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) {
      setSaveError('Informe o nome da conta para continuar.');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      if (editingAccountId) {
        // O saldo é derivado dos lançamentos. Alterá-lo diretamente quebraria o
        // histórico; ajustes são registrados como uma transação na tela de contas.
        await api.accounts.update(editingAccountId, { name: name.trim(), type, showInPayments, showInReceipts });
      } else {
        await api.accounts.add({
          name: name.trim(),
          balance: balance ? parseFloat(balance) : 0,
          type,
          color: '#1a1a1a',
          icon: 'wallet',
          showInPayments,
          showInReceipts,
        });
      }

      closeModal();
    } catch (error: any) {
      setSaveError(error?.message || 'Não foi possível salvar a conta. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (editingAccountId) {
      await api.accounts.delete(editingAccountId);
      closeModal();
    }
  };

  const closeModal = () => {
    setSaveError('');
    setAccountModalOpen(false);
    setTimeout(() => setEditingAccountId(null), 200);
  };

  if (!isAccountModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm sm:backdrop-blur-md">
      <div className="w-full max-w-md bg-card border-t sm:border border-border sm:rounded-[20px] rounded-t-[24px] shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90dvh] transition-all relative">
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted rounded-full" />
        
        <div className="flex justify-between items-center p-5 pb-4 border-b">
          <h2 className="text-base font-bold tracking-tight">{editingAccountId ? 'Editar Conta' : 'Nova Conta'}</h2>
          <button onClick={closeModal} className="p-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                {editingAccountId ? 'Saldo atual' : 'Saldo inicial'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold text-muted-foreground">R$</span>
                <Input 
                  type="text" 
                  inputMode="numeric"
                  placeholder="0,00" 
                  className="w-[180px] p-0 text-center text-4xl font-bold h-12 bg-transparent border-none shadow-none focus-visible:ring-0"
                  value={displayBalance}
                  onChange={handleBalanceChange}
                  disabled={Boolean(editingAccountId)}
                />
              </div>
              {editingAccountId && (
                <p className="mt-2 text-center text-[10px] text-muted-foreground">
                  Para corrigir o saldo, use “Ajustar saldo” em Contas e caixa.
                </p>
              )}
            </div>

            <div className="bg-muted/10 rounded-[24px] p-5 space-y-4 border border-border/30">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Nome da Conta</Label>
                <Input 
                  placeholder="Ex: NuBank, Carteira..." 
                  className="rounded-xl h-11 text-sm bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary focus:bg-background transition-colors shadow-none"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Tipo</Label>
                <div className="grid grid-cols-2 gap-1.5 w-full bg-muted/50 p-1.5 rounded-[16px]">
                  <button 
                    onClick={() => setType('corrente')}
                    className={`flex-1 py-2.5 rounded-[12px] text-[11px] font-bold uppercase tracking-widest transition-all ${type === 'corrente' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >Corrente</button>
                  <button 
                    onClick={() => setType('poupança')}
                    className={`flex-1 py-2.5 rounded-[12px] text-[11px] font-bold uppercase tracking-widest transition-all ${type === 'poupança' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >Poupança</button>
                  <button
                    onClick={() => setType('carteira')}
                    className={`py-2.5 rounded-[12px] text-[11px] font-bold uppercase tracking-widest transition-all ${type === 'carteira' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >Carteira</button>
                  <button
                    onClick={() => setType('investimento')}
                    className={`py-2.5 rounded-[12px] text-[11px] font-bold uppercase tracking-widest transition-all ${type === 'investimento' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >Investimento</button>
                </div>
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5 block ml-1">Disponibilidade nos lançamentos</Label>
                <div className="space-y-2 rounded-2xl border border-border/50 bg-background/70 p-3">
                  <AccountVisibilityToggle
                    label="Aparecer em pagamentos"
                    description="Despesas, pró-labore, retiradas e faturas"
                    checked={showInPayments}
                    onChange={() => setShowInPayments(value => !value)}
                  />
                  <AccountVisibilityToggle
                    label="Aparecer em recebimentos"
                    description="Vendas, receitas e aportes"
                    checked={showInReceipts}
                    onChange={() => setShowInReceipts(value => !value)}
                  />
                </div>
                {!showInPayments && !showInReceipts && (
                  <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground">Esta conta continuará disponível em Contas e caixa e poderá ser usada em transferências, mas não aparecerá nos lançamentos de rotina.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 p-4 border-t pb-8 sm:pb-4 bg-background">
          {editingAccountId && (
            <button type="button" onClick={handleDelete} disabled={saving} className="p-3 w-12 border border-destructive/20 text-destructive rounded-xl flex items-center justify-center transition-all hover:bg-destructive/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash className="w-5 h-5" />
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={saving} aria-busy={saving} className="flex-1 bg-primary text-primary-foreground text-sm font-bold rounded-xl h-11 flex items-center justify-center gap-2 shadow-sm transition-all duration-150 hover:brightness-105 active:scale-[0.98] active:shadow-inner disabled:cursor-wait disabled:opacity-80">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</> : 'Salvar'}
          </button>
        </div>
        {saveError && <p role="alert" className="px-4 pb-3 text-center text-xs font-semibold text-destructive">{saveError}</p>}
      </div>
    </div>
  );
}

function AccountVisibilityToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/60">
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}
