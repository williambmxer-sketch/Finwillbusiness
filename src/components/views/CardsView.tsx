import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { formatCurrency } from '../../utils/formatters';
import { Plus, CreditCard as CardIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { Progress } from '../ui/progress';
import { useAppStore } from '../../store/useAppStore';

export function CardsView() {
  const cards = useLiveQuery(() => db.cards.toArray()) || [];
  const { setCardModalOpen, setEditingCardId, setCurrentView, setActiveContextCardId } = useAppStore();

  return (
    <div className="flex flex-col h-full bg-background relative pt-8 px-4 max-w-lg mx-auto w-full">
      <header className="flex justify-between items-end mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Cartões</h1>
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
          <div className="text-center text-muted-foreground p-8 border border-dashed rounded-[11px] border-border/50 text-xs">Nenhum cartão cadastrado.</div>
        ) : (
          cards.map((card, i) => {
            const used = 4500; // Mock calculation
            const available = card.limit - used;
            const progress = (used / card.limit) * 100;

            return (
              <motion.div 
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveContextCardId(card.id);
                  setCurrentView('cardDetails');
                }}
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="cursor-pointer"
              >
                <div className="bg-card border shadow-sm rounded-[11px] p-4 overflow-hidden relative hover:border-primary/50 transition-colors">
                   <div className="flex justify-between items-start mb-4 z-10 relative">
                     <div className="flex items-center gap-2">
                       <div className="w-8 h-5 rounded bg-gradient-to-tr from-muted-foreground/20 to-muted-foreground/40 border border-white/10" style={{ backgroundColor: card.color }}></div>
                       <div>
                         <div className="font-semibold text-xs leading-tight">{card.name}</div>
                         <div className="text-[10px] text-muted-foreground font-mono mt-0.5">•••• {card.lastFour}</div>
                       </div>
                     </div>
                     <div className="text-right">
                        <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Fechamento</div>
                        <div className="text-[10px] font-semibold">Dia {card.closingDay}</div>
                     </div>
                   </div>

                   <div className="space-y-3 relative z-10">
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
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></div>
                           <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Disponível</span>
                         </div>
                         <div className="text-xs font-bold text-emerald-600 dark:text-emerald-500">{formatCurrency(available)}</div>
                       </div>
                       <div className="text-right">
                         <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Limite Total</div>
                         <div className="text-xs font-semibold">{formatCurrency(card.limit)}</div>
                       </div>
                     </div>
                   </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
