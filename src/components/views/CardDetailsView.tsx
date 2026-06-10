import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { api } from '../../services/api';
import { Transaction } from '../../db/db';
import { formatCurrency } from '../../utils/formatters';
import { getCycleId } from '../../utils/cycleUtils';
import { ChevronLeft, CreditCard, ShoppingBag, Clock, TrendingDown, Pencil, Trash2, Search, Plus, ChevronDown, Filter, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { generateUUID } from '../../lib/utils';





export function CardDetailsView() {
  const { setCurrentView, activeContextCardId, setEditingCardId, setCardModalOpen, setEditingTransactionId, setTransactionModalOpen, setConfirmModal } = useAppStore();

  const cards = useDataStore(state => state.cards);
  const card = cards.find(c => c.id === activeContextCardId);

  const categories = useDataStore(state => state.categories);
  const allTransactions = useDataStore(state => state.transactions);

  const transactions = React.useMemo(() => {
    return allTransactions
      .filter(t => t.cardId === activeContextCardId && t.type === 'despesa')
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [allTransactions, activeContextCardId]);

  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingTx, setDeletingTx] = useState<any | null>(null);
  const [deleteInstallmentModalOpen, setDeleteInstallmentModalOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const cardCycles = React.useMemo(() => {
    if (!card) return [];

    const now = new Date();
    const current = getCycleId(now, card.closingDay, card.dueDay);

    const cyclesMap = new Map<string, { id: string, name: string }>();
    cyclesMap.set(current.cycleId, { id: current.cycleId, name: current.monthName });

    transactions.forEach(t => {
      const { cycleId, monthName } = getCycleId(t.date, card.closingDay, card.dueDay);
      if (!cyclesMap.has(cycleId)) {
        cyclesMap.set(cycleId, { id: cycleId, name: monthName });
      }
    });

    return Array.from(cyclesMap.values()).sort((a, b) => {
      const [yA, mA] = a.id.split('-').map(Number);
      const [yB, mB] = b.id.split('-').map(Number);
      return (yA - yB) || (mA - mB);
    }).reverse();
  }, [card, transactions]);

  React.useEffect(() => {
    if (card && !selectedCycleId) {
      const now = new Date();
      const current = getCycleId(now, card.closingDay, card.dueDay);
      setSelectedCycleId(current.cycleId);
    }
  }, [card, selectedCycleId]);

  const visibleTransactions = React.useMemo(() => {
    if (!card || !selectedCycleId) return [];
    return transactions.filter(t => {
      const { cycleId } = getCycleId(t.date, card.closingDay, card.dueDay);
      if (cycleId !== selectedCycleId) return false;
      if (searchTerm.trim()) {
        if (!t.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      }
      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(t.categoryId)) return false;
      }
      return true;
    });
  }, [transactions, card, selectedCycleId, searchTerm, selectedCategories]);

  const visibleTotal = React.useMemo(() => {
    return visibleTransactions.reduce((acc, t) => acc + t.amount, 0);
  }, [visibleTransactions]);

  // Quick Add Form State
  const [isQuickAddExpanded, setIsQuickAddExpanded] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [installments, setInstallments] = useState('1');
  const [installmentMode, setInstallmentMode] = useState<'divide' | 'repeat'>('divide');

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

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !categoryId || !card) return;

    const numInstallments = Math.max(1, parseInt(installments, 10) || 1);
    const totalAmount = parseFloat(amount);
    
    const installmentAmount = installmentMode === 'divide' ? totalAmount / numInstallments : totalAmount;
    const totalDeduction = installmentMode === 'divide' ? totalAmount : totalAmount * numInstallments;

    if (true) {
      // Check limit
      const currentUsage = allTransactions
        .filter(t => t.cardId === card.id && t.type === 'despesa' && !t.isPaid)
        .reduce((sum, t) => sum + t.amount, 0);

      if (currentUsage + totalDeduction > card.limit) {
        alert(`Limite do cartão excedido! Limite disponível: R$ ${(card.limit - currentUsage).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        return;
      }
    }

    // Create local Date from input, setting to noon to avoid timezone shift issues
    const startDate = new Date(date + 'T12:00:00');

    const parentId = numInstallments > 1 ? generateUUID() : undefined;

    const newTransactions: Transaction[] = [];

    for (let i = 0; i < numInstallments; i++) {
      const txDate = new Date(startDate);
      txDate.setMonth(txDate.getMonth() + i);

      newTransactions.push({
        id: generateUUID(),
        description: numInstallments > 1 ? `${description} (${i + 1}/${numInstallments})` : description,
        amount: installmentAmount,
        date: txDate,
        type: 'despesa',
        categoryId,
        cardId: card.id,
        installments: numInstallments > 1 ? numInstallments : undefined,
        currentInstallment: numInstallments > 1 ? i + 1 : undefined,
        parentId,
        isPaid: false,
      });
    }

    await Promise.all(newTransactions.map(t => api.transactions.add(t)));

    // Reset fields for the next rapid entry
    setAmount('');
    setDescription('');
    setIsQuickAddExpanded(false);
  };

  const handleDeleteTransaction = (t: any) => {
    if (t.parentId && t.installments && t.installments > 1) {
      // Parcelado: perguntar escopo
      setDeletingTx(t);
      setDeleteInstallmentModalOpen(true);
    } else {
      setConfirmModal({
        title: 'Excluir Despesa',
        description: 'Tem certeza que deseja excluir permanentemente esta despesa?',
        onConfirm: async () => {
          await api.transactions.delete(t.id);
        }
      });
    }
  };

  const handleDeleteInstallmentScope = async (scope: 'only' | 'following' | 'all') => {
    if (!deletingTx) return;
    let targets: any[] = [];
    if (scope === 'only') {
      targets = [deletingTx];
    } else if (scope === 'following') {
      targets = allTransactions.filter(
        t => t.parentId === deletingTx.parentId && t.currentInstallment >= deletingTx.currentInstallment
      );
    } else {
      targets = allTransactions.filter(t => t.parentId === deletingTx.parentId);
    }
    for (const t of targets) {
      await api.transactions.delete(t.id);
    }
    setDeleteInstallmentModalOpen(false);
    setDeletingTx(null);
  };

  if (!card) {
    return (
      <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => setCurrentView('cards')} className="p-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Cartão não encontrado</h1>
        </header>
      </div>
    );
  }

  const cardUsage = transactions.filter(t => !t.isPaid).reduce((acc, t) => acc + t.amount, 0);
  const availableLimit = card.limit - cardUsage;

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
      <header className="px-4 pb-4">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentView('cards')} className="p-1 -ml-1 text-muted-foreground hover:text-foreground bg-muted/20 rounded-lg">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{card.name}</h1>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{card.brand} •••• {card.lastFour}</div>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingCardId(card.id);
              setCurrentView('cards'); // navigate back to cards view behind modal
              setCardModalOpen(true);
            }}
            className="text-primary text-xs font-bold uppercase tracking-wider p-2 bg-primary/10 rounded-[11px]"
          >
            Editar
          </button>
        </div>

        <div className="bg-card border shadow-sm rounded-[11px] p-5 mb-4 relative overflow-hidden" style={{ borderColor: card.color }}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CreditCard className="w-32 h-32 -mr-8 -mt-8" style={{ color: card.color }} />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Uso Total</div>
            <div className="text-4xl font-bold tracking-tight mb-4">{formatCurrency(cardUsage)}</div>

            <div className="flex justify-between border-t pt-4">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Limite Disponível</div>
                <div className="text-sm font-bold text-emerald-600">{formatCurrency(availableLimit)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Vencimento</div>
                <div className="text-sm font-bold">Dia {card.dueDay}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Add Form - Expandable */}
      <div className="px-4 mb-4">
        <div className="bg-card border shadow-sm rounded-[16px] overflow-hidden">
          <button 
            onClick={() => setIsQuickAddExpanded(!isQuickAddExpanded)}
            className="w-full p-3 flex items-center justify-between bg-muted/10 hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight">Nova Transação</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isQuickAddExpanded ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {isQuickAddExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t"
              >
                <form onSubmit={handleQuickSubmit} className="p-3 flex flex-col gap-2">
                  {/* Valor */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-bold text-muted-foreground">R$</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        className="w-36 h-10 text-3xl font-extrabold bg-transparent border-none focus-visible:ring-0 text-center p-0 shadow-none"
                        value={displayAmount}
                        onChange={handleAmountChange}
                        required
                      />
                    </div>
                    {parseInt(installments, 10) > 1 && amount && parseFloat(amount) > 0 && (
                      <div className="text-[9px] font-medium text-rose-500/90 -mt-1 uppercase tracking-widest">
                        {installmentMode === 'divide' 
                          ? `${parseInt(installments, 10)}x de R$ ${(parseFloat(amount) / parseInt(installments, 10)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `${parseInt(installments, 10)}x de R$ ${parseFloat(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </div>
                    )}
                  </div>

                  {/* Descrição */}
                  <div className="space-y-0.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Descrição</label>
                    <Input
                      placeholder="Ex: Almoço..."
                      className="w-full h-8 text-xs bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary rounded-md"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      required
                    />
                  </div>

                  {/* Grid Data / Parcelas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Data</label>
                      <Input
                        type="date"
                        className="w-full h-8 text-xs bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary uppercase rounded-md"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Parcelas</label>
                      <Input
                        type="number"
                        min="1"
                        max="72"
                        className="w-full h-8 text-xs bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary text-center rounded-md font-bold"
                        value={installments}
                        onChange={e => setInstallments(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Categoria e Modo Parcelamento */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Categoria</label>
                      <Select value={categoryId || "none"} onValueChange={setCategoryId} required>
                        <SelectTrigger className="w-full h-8 text-xs bg-muted/30 border-transparent focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary rounded-md">
                          <SelectValue placeholder="Selecione...">
                            {categoryId === "none" ? "Selecione..." : categories?.find(c => c.id === categoryId)?.name || "Selecione..."}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl z-[200]">
                          {categories.filter(c => c.type === 'despesa').map(c => (
                            <SelectItem key={c.id} value={c.id} className="text-xs font-medium">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {parseInt(installments, 10) > 1 && (
                      <div className="space-y-0.5">
                        <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold ml-1">Modo</label>
                        <div className="flex bg-muted/50 p-0.5 rounded-md h-8 items-center">
                          <button
                            type="button"
                            onClick={() => setInstallmentMode('divide')}
                            className={`flex-1 h-full rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
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
                            className={`flex-1 h-full rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
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

                  <button type="submit" className="w-full h-9 mt-1 bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-widest rounded-md hover:bg-primary/90 transition-colors shadow-sm">
                    Salvar
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Transactions List */}
      <div className="flex-1 px-4 mt-2">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Histórico</h2>
            {visibleTotal > 0 && (
              <span className="text-[10px] font-bold text-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">
                R$ {visibleTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Select value={selectedCycleId || ""} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="w-[110px] h-8 text-[10px] uppercase font-bold tracking-wider bg-muted border-none shadow-none rounded-lg px-2">
                <SelectValue placeholder="Fatura..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {cardCycles.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs font-bold capitalize">Fatura {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`p-1.5 rounded-lg h-8 w-8 flex items-center justify-center transition-colors ${selectedCategories.length > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                <Filter className="w-4 h-4" />
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-card border shadow-xl rounded-xl p-2 z-[200] max-h-64 overflow-y-auto">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-2">Categorias</div>
                  {categories.filter(c => c.type === 'despesa').map(cat => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategories(prev => 
                            isSelected ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                          );
                        }}
                        className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 rounded-lg transition-colors text-xs font-medium text-left"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || '#ccc' }} />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-primary" />}
                      </button>
                    )
                  })}
                  {selectedCategories.length > 0 && (
                    <button 
                      onClick={() => setSelectedCategories([])}
                      className="w-full mt-2 pt-2 border-t text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground text-center"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar lançamento..."
            className="pl-9 h-9 text-xs bg-muted/50 border-none rounded-[11px] focus-visible:ring-primary shadow-inner"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2.5 pb-24">
          {visibleTransactions.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 flex flex-col items-center border border-dashed rounded-[11px] border-border/50">
              <p className="text-xs">Nenhuma despesa nesta fatura</p>
            </div>
          ) : (
            visibleTransactions.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 bg-card shadow-sm rounded-[11px] border transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-[11px] bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-500">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs mb-0.5 tracking-tight">
                      {t.description}
                      {t.installments && t.installments > 1 && (
                        <span className="ml-1 text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {t.currentInstallment}/{t.installments}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 font-medium flex-wrap">
                      <span>{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                      {(() => {
                        const cat = categories.find(c => c.id === t.categoryId);
                        if (!cat) return null;
                        return (
                          <span className="flex items-center gap-1">
                            <span className="opacity-30">•</span>
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block flex-none"
                              style={{ backgroundColor: cat.color || '#aaa' }}
                            />
                            <span className="opacity-60">{cat.name}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="font-bold text-xs text-foreground">
                      -{formatCurrency(t.amount)}
                    </div>
                    {!t.isPaid && <div className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mt-1">Na Fatura</div>}
                  </div>

                  <div className="flex items-center gap-1 border-l pl-2 ml-1 border-border/50">
                    <button
                      onClick={() => {
                        setEditingTransactionId(t.id);
                        setTransactionModalOpen(true);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTransaction(t)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Modal de escopo de exclusão para parcelados */}
      {deleteInstallmentModalOpen && deletingTx && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-[280px] rounded-[20px] border border-border shadow-xl p-5 flex flex-col items-center text-center animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold tracking-tight mb-2">Excluir Parcelamento</h3>
            <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">
              Esta é a parcela {deletingTx.currentInstallment}/{deletingTx.installments}. Como deseja excluir?
            </p>
            <div className="flex flex-col w-full gap-2 mb-4">
              <button
                onClick={() => handleDeleteInstallmentScope('only')}
                className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-lg transition-all"
              >
                Apenas esta parcela
              </button>
              <button
                onClick={() => handleDeleteInstallmentScope('following')}
                className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-lg transition-all"
              >
                Esta e as próximas
              </button>
              <button
                onClick={() => handleDeleteInstallmentScope('all')}
                className="w-full py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 text-xs font-semibold rounded-lg transition-all"
              >
                Todas as parcelas
              </button>
            </div>
            <button
              onClick={() => { setDeleteInstallmentModalOpen(false); setDeletingTx(null); }}
              className="text-xs text-muted-foreground hover:text-foreground font-medium underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
