import React, { useState } from 'react';
import { useDataStore } from '../../store/useDataStore';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { Plus, SlidersHorizontal, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Progress } from '../ui/progress';
import { useAppStore } from '../../store/useAppStore';
import { getCycleId } from '../../utils/cycleUtils';

export function CardsView() {
  const cards = useDataStore((state) => state.cards);
  const transactions = useDataStore((state) => state.transactions);
  const { setCardModalOpen, setEditingCardId, setCurrentView, setActiveContextCardId } = useAppStore();

  const totalNextInvoice = React.useMemo(() => {
    return cards.reduce((sum, card) => {
      const now = new Date();
      const { cycleId: currentCycle } = getCycleId(now, card.closingDay, card.dueDay);
      const currentInvoice = transactions
        .filter(t => {
          if (t.type !== 'despesa' || t.cardId !== card.id || t.isPaid) return false;
          const { cycleId } = getCycleId(t.date, card.closingDay, card.dueDay);
          return cycleId === currentCycle;
        })
        .reduce((acc, t) => acc + t.amount, 0);
      return sum + currentInvoice;
    }, 0);
  }, [cards, transactions]);

  // Inline limit adjustment state
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [adjustError, setAdjustError] = useState('');

  const handleAdjustOpen = (id: string, currentLimit: number) => {
    setAdjustingId(id);
    setAdjustValue(currentLimit.toFixed(2).replace('.', ','));
    setAdjustError('');
  };

  const handleAdjustConfirm = async (id: string) => {
    const raw = adjustValue.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || parsed <= 0) {
      setAdjustError('Valor inválido');
      return;
    }
    // Only update the card limit — does NOT touch any transactions or used balance
    await api.cards.update(id, { limit: parsed });
    setAdjustingId(null);
    setAdjustValue('');
    setAdjustError('');
  };

  const handleAdjustChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9,]/g, '');
    setAdjustValue(v);
    setAdjustError('');
  };

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
      <header className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartões</h1>
          {cards.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Próximas faturas: <span className="font-semibold text-foreground">{formatCurrency(totalNextInvoice)}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setEditingCardId(null);
            setCardModalOpen(true);
          }}
          className="text-primary bg-primary/10 p-2 rounded-[11px]"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col gap-3">
        {cards.length === 0 ? (
          <div className="text-center text-muted-foreground p-8 border border-dashed rounded-[11px] border-border/50 text-xs">
            Nenhum cartão cadastrado.
          </div>
        ) : (
          cards.map((card, i) => {
            const used = transactions
              .filter(t => t.cardId === card.id && t.type === 'despesa' && !t.isPaid)
              .reduce((sum, t) => sum + t.amount, 0);
            const available = card.limit - used;
            const progress = card.limit > 0 ? Math.min((used / card.limit) * 100, 100) : 0;
            const isAdjusting = adjustingId === card.id;

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="bg-card border shadow-sm rounded-[11px] overflow-hidden hover:border-primary/30 transition-colors">
                  {/* Main card content */}
                  <div
                    onClick={() => {
                      if (isAdjusting) return;
                      setActiveContextCardId(card.id);
                      setCurrentView('cardDetails');
                    }}
                    className="p-4 cursor-pointer"
                  >
                    {/* Header row */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-5 rounded border border-white/10"
                          style={{ backgroundColor: card.color }}
                        />
                        <div>
                          <div className="font-semibold text-xs leading-tight">{card.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">•••• {card.lastFour}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="text-right">
                          <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Fechamento</div>
                          <div className="text-[10px] font-semibold">Dia {card.closingDay}</div>
                        </div>
                        {/* Limit adjust button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAdjusting) {
                              setAdjustingId(null);
                            } else {
                              handleAdjustOpen(card.id, card.limit);
                            }
                          }}
                          className={`ml-1 p-1.5 rounded-lg transition-colors ${
                            isAdjusting
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground/40 hover:text-primary hover:bg-primary/10'
                          }`}
                          title="Ajustar limite"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Usage bar */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1 font-medium">
                          <span className="text-muted-foreground">Limite Usado</span>
                          <span className="text-foreground font-bold">{formatCurrency(used)}</span>
                        </div>
                        <Progress value={progress} className="h-1.5 bg-secondary" />
                      </div>

                      <div className="flex justify-between items-end">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Disponível</span>
                          </div>
                          <div className={`text-xs font-bold ${available < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-500'}`}>
                            {formatCurrency(available)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Limite Total</div>
                          <div className="text-xs font-semibold">{formatCurrency(card.limit)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Inline limit adjustment panel */}
                  <AnimatePresence>
                    {isAdjusting && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0 border-t border-border/40 bg-muted/10">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-3 mb-2">
                            Ajustar limite de {card.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-muted/60 rounded-xl px-3 flex-1 h-10 border border-transparent focus-within:border-primary/50 focus-within:bg-background transition-all">
                              <span className="text-xs font-bold text-muted-foreground mr-1.5">R$</span>
                              <input
                                autoFocus
                                type="text"
                                inputMode="decimal"
                                value={adjustValue}
                                onChange={handleAdjustChange}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAdjustConfirm(card.id);
                                  if (e.key === 'Escape') setAdjustingId(null);
                                }}
                                className="flex-1 bg-transparent text-sm font-bold outline-none text-foreground"
                                placeholder="0,00"
                              />
                            </div>
                            <button
                              onClick={() => handleAdjustConfirm(card.id)}
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
                          {adjustError && (
                            <p className="text-[10px] text-destructive mt-1 ml-1 font-medium">{adjustError}</p>
                          )}
                          <p className="text-[9px] text-muted-foreground mt-1.5 ml-1">
                            Limite atual: {formatCurrency(card.limit)} · Apenas o limite é alterado, os lançamentos não são afetados · Enter para confirmar
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
