import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../services/api';
import { useDataStore } from '../store/useDataStore';
import { Category } from '../db/db';
import { generateUUID } from '../lib/utils';
import { X, Trash, AlertCircle } from 'lucide-react';
import { Input } from './ui/input';

interface CustomPaymentMethod {
  id: string;
  name: string;
  allowInstallments: boolean;
}

export function CategoryModal() {
  const { isCategoryModalOpen, setCategoryModalOpen } = useAppStore();
  const categories = useDataStore(state => state.categories);
  const transactions = useDataStore(state => state.transactions);

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
  const [paymentMethods, setPaymentMethods] = useState<CustomPaymentMethod[]>([]);
  const [pmName, setPmName] = useState('');
  const [pmAllowInstallments, setPmAllowInstallments] = useState(true);
  const [editingPmId, setEditingPmId] = useState<string | null>(null);
  const [confirmDeletePmId, setConfirmDeletePmId] = useState<string | null>(null);

  useEffect(() => {
    if (isCategoryModalOpen) {
      const stored = localStorage.getItem('custom_payment_methods');
      if (stored) {
        setPaymentMethods(JSON.parse(stored));
      } else {
        const initial = [
          { id: '1', name: 'Crediário', allowInstallments: true },
          { id: '2', name: 'Boleto Parcelado', allowInstallments: true }
        ];
        setPaymentMethods(initial);
        localStorage.setItem('custom_payment_methods', JSON.stringify(initial));
      }
    }
  }, [isCategoryModalOpen]);

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

  const handleSavePaymentMethod = () => {
    if (!pmName.trim()) return;
    let updated: CustomPaymentMethod[];
    if (editingPmId) {
      updated = paymentMethods.map(pm => pm.id === editingPmId ? { ...pm, name: pmName.trim(), allowInstallments: pmAllowInstallments } : pm);
      setEditingPmId(null);
    } else {
      const newPm: CustomPaymentMethod = {
        id: generateUUID(),
        name: pmName.trim(),
        allowInstallments: pmAllowInstallments
      };
      updated = [...paymentMethods, newPm];
    }
    setPaymentMethods(updated);
    localStorage.setItem('custom_payment_methods', JSON.stringify(updated));
    setPmName('');
    setPmAllowInstallments(true);
    // Dispatch db_mutation to update transaction modal dropdown
    window.dispatchEvent(new Event('db_mutation'));
  };

  const handleEditPaymentMethod = (pm: CustomPaymentMethod) => {
    setEditingPmId(pm.id);
    setPmName(pm.name);
    setPmAllowInstallments(pm.allowInstallments);
  };

  const handleCancelEditPaymentMethod = () => {
    setEditingPmId(null);
    setPmName('');
    setPmAllowInstallments(true);
  };

  const handleDeletePaymentMethod = (id: string) => {
    const updated = paymentMethods.filter(pm => pm.id !== id);
    setPaymentMethods(updated);
    localStorage.setItem('custom_payment_methods', JSON.stringify(updated));
    setConfirmDeletePmId(null);
    if (editingPmId === id) handleCancelEditPaymentMethod();
    window.dispatchEvent(new Event('db_mutation'));
  };

  if (!isCategoryModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm sm:backdrop-blur-md">
      <div className="w-full max-w-md bg-card border-t sm:border border-border sm:rounded-[20px] rounded-t-[24px] shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90dvh] transition-all relative">
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted rounded-full" />
        
        <div className="flex justify-between items-center p-4 pb-3 border-b">
          <h2 className="text-sm font-bold tracking-tight">Configurações</h2>
          <button onClick={() => setCategoryModalOpen(false)} className="p-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex bg-muted/50 p-1 mx-4 mt-3 rounded-[12px]">
          <button 
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'categories' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('categories')}
          >Categorias</button>
          <button 
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'payment_methods' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('payment_methods')}
          >Formas de Pagamento</button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden mt-2">
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
                <div className="p-4 bg-muted/10 border-b animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex gap-2 mb-3">
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
                      className="rounded-[12px] h-11 text-xs bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary shadow-none flex-1"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                    <button onClick={handleSave} className="px-4 bg-primary text-primary-foreground font-bold text-[10px] h-11 rounded-[12px] hover:bg-primary/90 transition-all uppercase tracking-wider">
                      {editingId ? 'Salvar' : 'Add'}
                    </button>
                    <button onClick={handleCancelEdit} className="px-3 bg-muted text-foreground font-bold text-[10px] h-11 rounded-[12px] hover:bg-muted/80 transition-colors uppercase tracking-wider">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {type === 'despesa' && (
                    <div className="flex gap-4 mt-3">
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
                </div>
              )}

              {/* List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-4 pb-8 sm:pb-2">
                {['receita', 'despesa'].map((catType) => {
                  const filteredCats = categories.filter(c => c.type === catType);
                  if (filteredCats.length === 0) return null;
                  
                  return (
                    <div key={catType} className="space-y-1.5">
                      <div className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 mt-1">
                        {catType === 'receita' ? 'Receitas' : 'Despesas'}
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
              {/* Form custom payment methods */}
              <div className="p-4 bg-muted/10 border-b space-y-3">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Nome da forma de pagamento... Ex: Crediário" 
                    className="rounded-[12px] h-11 text-xs bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-primary shadow-none flex-1"
                    value={pmName}
                    onChange={e => setPmName(e.target.value)}
                  />
                  <button onClick={handleSavePaymentMethod} className="px-4 bg-primary text-primary-foreground font-bold text-[10px] h-11 rounded-[12px] hover:bg-primary/90 transition-all uppercase tracking-wider">
                    {editingPmId ? 'Salvar' : 'Add'}
                  </button>
                  {editingPmId && (
                    <button onClick={handleCancelEditPaymentMethod} className="px-3 bg-muted text-foreground font-bold text-[10px] h-11 rounded-[12px] hover:bg-muted/80 transition-colors uppercase tracking-wider">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground select-none">Permitir Parcelamento</span>
                  <button
                    type="button"
                    onClick={() => setPmAllowInstallments(!pmAllowInstallments)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${pmAllowInstallments ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${pmAllowInstallments ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </div>

              {/* List custom payment methods */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 pb-8 sm:pb-2">
                {paymentMethods.map(pm => {
                  const isConfirmingPm = confirmDeletePmId === pm.id;
                  return (
                    <div key={pm.id} className="rounded-lg bg-card border border-border/50 shadow-sm hover:border-primary/30 transition-colors text-xs overflow-hidden">
                      <div className="flex items-center justify-between p-1.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <div>
                            <div className="font-semibold leading-none mb-0.5">{pm.name}</div>
                            <div className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider leading-none">
                              {pm.allowInstallments ? 'Permite parcelas' : 'À vista'}
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
  );
}
