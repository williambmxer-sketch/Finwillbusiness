import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Landmark } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppStore } from '../../store/useAppStore';

export function AccountsView() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const { setAccountModalOpen, setEditingAccountId, setCurrentView, setActiveAccountId } = useAppStore();

  const totalBalance = accounts.reduce((acc, account) => acc + account.balance, 0);

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
          <div className="text-center text-muted-foreground p-8 border border-dashed rounded-[11px] border-border/50 text-xs">Nenhuma conta cadastrada.</div>
        ) : (
          accounts.map((account, i) => (
            <motion.div 
              onClick={() => {
                setActiveAccountId(account.id);
                setCurrentView('accountDetails');
              }}
              key={account.id}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="cursor-pointer"
            >
              <div className="bg-card border shadow-sm rounded-[11px] p-4 flex items-center justify-between hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-[11px] bg-primary/10 text-primary">
                     <Landmark className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm tracking-tight mb-0.5">{account.name}</div>
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{account.type}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tracking-tight">{formatCurrency(account.balance)}</div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
