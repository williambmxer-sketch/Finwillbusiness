import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../services/api';
import { useDataStore } from '../store/useDataStore';
import { Category, CustomPaymentMethod } from '../db/db';
import { generateUUID } from '../lib/utils';
import { X, Trash, AlertCircle } from 'lucide-react';
import { Input } from './ui/input';
import { isBankAccount, isCashPaymentMethod } from '../utils/financialRules';


export function CategoryModal() {
  const { currentView, setCurrentView } = useAppStore();
  const categories = useDataStore(state => state.categories);
  const paymentMethods = useDataStore(state => state.customPaymentMethods);
  const transactions = useDataStore(state => state.transactions);
  const accounts = useDataStore(state => state.accounts);

  // Set of category IDs that are actually used in at least one transaction
  const usedCategoryIds = new Set(transactions.map(t => t.categoryId));

  const [activeTab, setActiveTab] = useState<'categories' | 'payment_methods'>('categories');

  // Categories state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'receita'|'despesa'>('despesa');
  const [color, setColor] = useState('#3b82f6');
  const [showInCards, setShowInCards] = useState(true);
  const [showInAccounts, setShowInAccounts] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Custom Payment Methods state
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);
  const [pmName, setPmName] = useState('');
  const [pmDebitFromAccount, setPmDebitFromAccount] = useState(true);
  const [editingPmId, setEditingPmId] = useState<string | null>(null);
  const [confirmDeletePmId, setConfirmDeletePmId] = useState<string | null>(null);
  const [pmLinkedAccountId, setPmLinkedAccountId] = useState('');
  const [paymentMethodError, setPaymentMethodError] = useState<string | null>(null);

  const handleEdit = (c: Category) => {
    setConfirmDeleteId(null);
    setEditingId(c.id);
    setName(c.name);
    setType(c.type);
    setColor(c.color);
    setShowInCards(c.showInCards ?? true);
    setShowInAccounts(c.showInAccounts ?? true);
    setIsAddingCategory(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setType('despesa');
    setColor('#3b82f6');
    setShowInCards(true);
    setShowInAccounts(true);
    setIsAddingCategory(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      const existing = categories.find(c => c.id === editingId);
      const cat: Category = {
        id: editingId || generateUUID(),
        name: name.trim(),
        // on edit, keep original type; on new, use selected type
        type: editingId ? (existing?.type ?? type) : type,
        color,
        icon: existing?.icon || 'Tag',
        showInCards,
        showInAccounts,
      };
      if (editingId) {
        await api.categories.update(cat.id, cat);
      } else {
        await api.categories.add(cat);
      }
      handleCancelEdit();
    } catch (error: any) {
      console.error('Erro ao salvar categoria:', error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    await api.categories.delete(id);
    setConfirmDeleteId(null);
    if (editingId === id) handleCancelEdit();
  };

  const handleSavePaymentMethod = async () => {
    const trimmedName = pmName.trim();
    if (!trimmedName) return;

    const isCash = isCashPaymentMethod(trimmedName);
    const linkedAccount = accounts.find(account => account.id === pmLinkedAccountId);
    const debitFromAccount = isCash || pmDebitFromAccount;
    if (debitFromAccount) {
      if (isCash && (!linkedAccount || linkedAccount.type !== 'carteira')) {
        setPaymentMethodError('A forma Dinheiro precisa estar vinculada a uma conta caixa/carteira. Crie ou selecione uma Carteira.');
        return;
      }
      if (!isCash && !isBankAccount(linkedAccount)) {
        setPaymentMethodError('Selecione uma conta bancária (Corrente ou Poupança) para esta forma de pagamento.');
        return;
      }
    }

    try {
      const payload: Partial<CustomPaymentMethod> = {
        name: trimmedName,
        debitFromAccount,
        linkedAccountId: debitFromAccount ? linkedAccount?.id : undefined,
      };

      if (editingPmId) {
        await api.paymentMethods.update(editingPmId, payload);
      } else {
        await api.paymentMethods.add(payload as Omit<CustomPaymentMethod, 'id'>);
      }

      setPmName('');
      setPmDebitFromAccount(true);
      setIsAddingPaymentMethod(false);
      setEditingPmId(null);
      setPmLinkedAccountId('');
      setPaymentMethodError(null);
    } catch (error) {
      console.error('Erro ao salvar forma de pagamento:', error);
      setPaymentMethodError(error instanceof Error ? error.message : 'Não foi possível salvar a forma de pagamento.');
    }
  };

  const handleEditPaymentMethod = (pm: CustomPaymentMethod) => {
    setEditingPmId(pm.id);
    setPmName(pm.name);
    setPmDebitFromAccount(pm.debitFromAccount ?? true);
    setPmLinkedAccountId(pm.linkedAccountId || '');
    setPaymentMethodError(null);
    setIsAddingPaymentMethod(true);
  };

  const handleCancelEditPaymentMethod = () => {
    setEditingPmId(null);
    setPmName('');
    setPmDebitFromAccount(true);
    setIsAddingPaymentMethod(false);
    setPmLinkedAccountId('');
    setPaymentMethodError(null);
  };

  const handleDeletePaymentMethod = async (id: string) => {
    try {
      await api.paymentMethods.delete(id);
      setConfirmDeletePmId(null);
      if (editingPmId === id) handleCancelEditPaymentMethod();
    } catch (error) {
      console.error('Erro ao deletar forma de pagamento:', error);
    }
  };

  if (currentView !== 'categories') return null;

  return (
    <div className="w-full bg-background">
      <div className="relative flex w-full flex-col bg-background">
        <div className="shrink-0 border-b border-border bg-card shadow-sm">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cadastros</div>
              <h2 className="mt-0.5 text-xl font-black tracking-tight">Categorias e formas de pagamento</h2>
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col overflow-y-auto px-4 lg:px-8">
          <div className="mt-5 flex w-full rounded-xl border border-border bg-muted/50 p-1 shadow-sm">
          <button 
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'categories' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('categories')}
          >Categorias</button>
          <button 
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'payment_methods' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('payment_methods')}
          >Formas de Pagamento</button>
          </div>

        <div className="mt-4 flex flex-col pb-10">
          {activeTab === 'categories' ? (
            <>
              {/* Button to add new category */}
              {!isAddingCategory && (
                <div className="p-3 border-b">
                  <button 
                    onClick={() => setIsAddingCategory(true)}
                    className="w-full py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary/20 transition-colors border border-primary/20 border-dashed"
                  >
                    + Nova Categoria
                  </button>
                </div>
              )}

              {/* Form */}
              {isAddingCategory && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-150">
                  <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-primary">Categorias</div>
                        <h3 className="mt-1 text-lg font-black tracking-tight">{editingId ? 'Editar categoria' : 'Nova categoria'}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Defina o tipo, a cor e onde ela deve aparecer.</p>
                      </div>
                      <button type="button" onClick={handleCancelEdit} aria-label="Fechar formulário" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mb-4 flex gap-2">
                    {/* Type toggle — hidden when editing (type is locked) */}
                    {!editingId ? (
                      <div className="flex flex-1 items-center bg-muted/80 p-1.5 rounded-xl">
                        <button
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'despesa' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setType('despesa')}
                        >Desp</button>
                        <button
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${type === 'receita' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setType('receita')}
                        >Rec</button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40 rounded-xl">
                        {type === 'receita' ? '🟢 Receita' : '🔴 Despesa'}
                      </div>
                    )}
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-border shadow-sm flex-shrink-0">
                      <input
                        type="color"
                        value={color}
                        onChange={e => setColor(e.target.value)}
                        className="absolute -inset-2 w-12 h-12 cursor-pointer"
                      />
                    </div>
                  </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome da categoria..."
                        className="rounded-[12px] h-9 text-xs bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary shadow-none flex-1"
                        value={name}
                        onChange={e => setName(e.target.value)}
                      />
                    </div>

                    {type === 'despesa' && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="flex items-center justify-between flex-1 bg-muted/30 px-3 py-2 rounded-xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground select-none">Mostrar em Cartões</span>
                        <button
                          type="button"
                          onClick={() => setShowInCards(!showInCards)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${showInCards ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${showInCards ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between flex-1 bg-muted/30 px-3 py-2 rounded-xl">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground select-none">Mostrar em Contas</span>
                        <button
                          type="button"
                          onClick={() => setShowInAccounts(!showInAccounts)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${showInAccounts ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${showInAccounts ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                    )}
                    <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                      <button type="button" onClick={handleCancelEdit} className="h-10 rounded-xl border border-border px-4 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Cancelar</button>
                      <button type="button" onClick={handleSave} className="h-10 rounded-xl bg-primary px-5 text-xs font-black uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90">{editingId ? 'Salvar alterações' : 'Criar categoria'}</button>
                    </div>
                  </div>
                </div>
              )}

              {/* List */}
              <div className="space-y-5 pb-8 pr-1 sm:pb-6">
                {['receita', 'despesa'].map((catType) => {
                  const filteredCats = categories.filter(c => c.type === catType);
                  if (filteredCats.length === 0) return null;
                  
                  return (
                    <div key={catType} className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
                      <div className="flex items-center justify-between border-b border-border/70 px-1 pb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {catType === 'receita' ? 'Receitas' : 'Despesas'}
                        <span className="text-[9px] font-semibold normal-case tracking-normal">{filteredCats.length} {filteredCats.length === 1 ? 'categoria' : 'categorias'}</span>
                      </div>
                      {filteredCats.map(c => {
                        const inUse = usedCategoryIds.has(c.id);
                        const isConfirming = confirmDeleteId === c.id;
                        return (
                          <div key={c.id} className="rounded-lg bg-card border border-border/50 shadow-sm hover:border-primary/30 transition-colors text-xs overflow-hidden">
                            <div className="flex items-center justify-between p-1.5 px-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shadow-sm shrink-0" style={{ backgroundColor: c.color }} />
                                <div>
                                  <div className="font-semibold leading-none mb-0.5">{c.name}</div>
                                  <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider leading-none flex items-center gap-1.5">
                                    {inUse && <span className="text-primary/60">em uso</span>}
                                    {inUse && c.type === 'despesa' && (c.showInCards !== false || c.showInAccounts !== false) && <span className="text-muted-foreground/30">•</span>}
                                    {c.type === 'despesa' && (
                                      <>
                                        {c.showInCards !== false && <span className="text-muted-foreground">Cartão</span>}
                                        {c.showInCards !== false && c.showInAccounts !== false && <span className="text-muted-foreground/30">|</span>}
                                        {c.showInAccounts !== false && <span className="text-muted-foreground">Conta</span>}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-1 items-center shrink-0">
                                <button
                                  onClick={() => handleEdit(c)}
                                  className="text-[9px] font-bold text-primary px-2 py-1 bg-primary/10 rounded uppercase tracking-wider hover:bg-primary/20 transition-colors"
                                >Editar</button>
                                {inUse ? (
                                  <div className="relative group">
                                    <button
                                      disabled
                                      className="text-muted-foreground/40 p-1 bg-muted/30 rounded cursor-not-allowed"
                                    >
                                      <Trash className="w-3 h-3" />
                                    </button>
                                    <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:flex items-center gap-1 bg-popover border border-border text-[9px] text-muted-foreground font-medium rounded-lg px-2 py-1 shadow-lg whitespace-nowrap z-50">
                                      <AlertCircle className="w-2.5 h-2.5 text-amber-500" />
                                      Categoria em uso
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteId(isConfirming ? null : c.id)}
                                    className={`p-1 rounded transition-colors ${
                                      isConfirming
                                        ? 'bg-destructive/20 text-destructive'
                                        : 'text-destructive/60 bg-destructive/10 hover:bg-destructive/20 hover:text-destructive'
                                    }`}
                                  >
                                    <Trash className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Inline confirm row */}
                            {isConfirming && (
                              <div className="flex items-center justify-between px-3 py-2 bg-destructive/5 border-t border-destructive/10 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                                <span className="text-[10px] text-destructive/80 font-medium">Excluir "{c.name}"?</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-[9px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider px-2 py-1 rounded hover:bg-muted transition-colors"
                                  >Cancelar</button>
                                  <button
                                    onClick={() => handleDeleteCategory(c.id)}
                                    className="text-[9px] font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 uppercase tracking-wider px-2 py-1 rounded transition-colors"
                                  >Confirmar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {categories.length === 0 && (
                  <div className="text-center text-muted-foreground p-8 border border-dashed rounded-[16px] border-border/50 text-xs">
                    Nenhuma categoria cadastrada
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {!isAddingPaymentMethod && (
                <div className="p-3 border-b">
                  <button 
                    onClick={() => setIsAddingPaymentMethod(true)}
                    className="w-full py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary/20 transition-colors border border-primary/20 border-dashed"
                  >
                    + Nova Forma de Pagamento
                  </button>
                </div>
              )}

              {/* Form custom payment methods */}
              {isAddingPaymentMethod && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-150">
                  <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-150 sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-primary">Formas de pagamento</div>
                        <h3 className="mt-1 text-lg font-black tracking-tight">{editingPmId ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Configure como o pagamento será registrado no caixa.</p>
                      </div>
                      <button type="button" onClick={handleCancelEditPaymentMethod} aria-label="Fechar formulário" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                    <Input 
                      placeholder="Nome da forma de pagamento... Ex: Crediário" 
                      className="h-10 rounded-xl bg-muted/50 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-primary"
                      value={pmName}
                      onChange={e => {
                        const nextName = e.target.value;
                        setPmName(nextName);
                        if (isCashPaymentMethod(nextName)) setPmDebitFromAccount(true);
                        setPaymentMethodError(null);
                      }}
                    />
                  </div>
                  {((isCashPaymentMethod(pmName) || pmDebitFromAccount) && (
                    <div className="mt-4 space-y-2 border-t pt-4">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1 block">
                        {isCashPaymentMethod(pmName) ? 'Conta caixa / carteira usada pelo Dinheiro' : 'Conta bancária padrão'}
                      </label>
                      <select
                        value={pmLinkedAccountId}
                        onChange={e => setPmLinkedAccountId(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-transparent bg-muted/50 px-3 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">{isCashPaymentMethod(pmName) ? 'Selecione a conta caixa...' : 'Selecione a conta bancária...'}</option>
                        {accounts.filter(account => isCashPaymentMethod(pmName) ? account.type === 'carteira' : isBankAccount(account)).map(account => (
                          <option key={account.id} value={account.id}>
                            {account.name} ({account.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                          </option>
                        ))}
                      </select>
                      {accounts.every(account => isCashPaymentMethod(pmName) ? account.type !== 'carteira' : !isBankAccount(account)) && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                          {isCashPaymentMethod(pmName) ? 'Crie primeiro uma conta com o tipo Carteira na tela Contas.' : 'Crie primeiro uma conta Corrente ou Poupança na tela Contas.'}
                        </p>
                      )}
                    </div>
                  ))}
                  {paymentMethodError && (
                    <p className="text-[10px] text-destructive font-medium">{paymentMethodError}</p>
                  )}
                  <div className="mt-4 space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground select-none">Debitar da conta (Exige Saldo)</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isCashPaymentMethod(pmName)) setPmDebitFromAccount(!pmDebitFromAccount);
                      }}
                      disabled={isCashPaymentMethod(pmName)}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${isCashPaymentMethod(pmName) ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${pmDebitFromAccount ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${pmDebitFromAccount ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  </div>
                  <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    <button type="button" onClick={handleCancelEditPaymentMethod} className="h-10 rounded-xl border border-border px-4 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Cancelar</button>
                    <button type="button" onClick={handleSavePaymentMethod} className="h-10 rounded-xl bg-primary px-5 text-xs font-black uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90">{editingPmId ? 'Salvar alterações' : 'Criar forma de pagamento'}</button>
                  </div>
                </div>
                </div>
              )}

              {/* List custom payment methods */}
              <div className="space-y-2 pb-8 pr-1 sm:pb-6">
                {paymentMethods.map(pm => {
                  const isConfirmingPm = confirmDeletePmId === pm.id;
                  const linkedAccount = accounts.find(account => account.id === pm.linkedAccountId);
                  return (
                    <div key={pm.id} className="rounded-lg bg-card border border-border/50 shadow-sm hover:border-primary/30 transition-colors text-xs overflow-hidden">
                      <div className="flex items-center justify-between p-1.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <div>
                            <div className="font-semibold leading-none mb-0.5">{pm.name}</div>
                            <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider flex flex-wrap gap-1 items-center mt-1">
                              {pm.debitFromAccount && <span className="bg-orange-500/10 text-orange-600 px-1 py-0.5 rounded">Debita Conta</span>}
                              {pm.debitFromAccount && (
                                <span className="bg-emerald-500/10 text-emerald-600 px-1 py-0.5 rounded">
                                  {isCashPaymentMethod(pm.name) ? 'Caixa' : 'Banco'}: {linkedAccount?.name || 'não vinculada'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleEditPaymentMethod(pm)} className="text-[9px] font-bold text-primary px-2 py-1 bg-primary/10 rounded uppercase tracking-wider hover:bg-primary/20 transition-colors">Editar</button>
                          <button
                            onClick={() => setConfirmDeletePmId(isConfirmingPm ? null : pm.id)}
                            className={`p-1 rounded transition-colors ${
                              isConfirmingPm
                                ? 'bg-destructive/20 text-destructive'
                                : 'text-destructive/60 bg-destructive/10 hover:bg-destructive/20 hover:text-destructive'
                            }`}
                          ><Trash className="w-3 h-3" /></button>
                        </div>
                      </div>
                      {isConfirmingPm && (
                        <div className="flex items-center justify-between px-3 py-2 bg-destructive/5 border-t border-destructive/10 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                          <span className="text-[10px] text-destructive/80 font-medium">Excluir "{pm.name}"?</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmDeletePmId(null)}
                              className="text-[9px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider px-2 py-1 rounded hover:bg-muted transition-colors"
                            >Cancelar</button>
                            <button
                              onClick={() => handleDeletePaymentMethod(pm.id)}
                              className="text-[9px] font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 uppercase tracking-wider px-2 py-1 rounded transition-colors"
                            >Confirmar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {paymentMethods.length === 0 && (
                  <div className="text-center text-muted-foreground p-8 border border-dashed rounded-[16px] border-border/50 text-xs">
                    Nenhuma forma de pagamento cadastrada
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
