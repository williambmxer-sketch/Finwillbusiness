import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarClock, CalendarDays, CheckCircle2, ChevronDown, Clock3, Pencil, RotateCcw, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Transaction } from '../../db/db';
import { api } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../utils/formatters';

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCurrentMonthPeriod() {
  const today = new Date();
  return {
    start: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: toDateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

export function AgendaView({ mode }: { mode: 'payable' | 'receivable' }) {
  const transactions = useDataStore(state => state.transactions);
  const categories = useDataStore(state => state.categories);
  const contacts = useDataStore(state => state.contacts);
  const accounts = useDataStore(state => state.accounts);
  const cards = useDataStore(state => state.cards);
  const customPaymentMethods = useDataStore(state => state.customPaymentMethods);
  const { setConfirmModal, setConfirmPaymentTransactionId, setEditingTransactionId, setTransactionModalOpen } = useAppStore();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'open' | 'overdue' | 'paid'>('open');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const currentMonthPeriod = getCurrentMonthPeriod();
  const [periodStart, setPeriodStart] = useState(currentMonthPeriod.start);
  const [periodEnd, setPeriodEnd] = useState(currentMonthPeriod.end);
  const [presetOpen, setPresetOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);
  const type = mode === 'payable' ? 'despesa' : 'receita';
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const periodTransactions = useMemo(() => {
    const start = periodStart ? new Date(`${periodStart}T00:00:00`) : null;
    const end = periodEnd ? new Date(`${periodEnd}T23:59:59.999`) : null;

    return transactions
      .filter(item => item.type === type && item.nature !== 'transferencia' && item.nature !== 'pagamento_fatura')
      .filter(item => {
        const date = new Date(item.dueDate || item.date);
        if (Number.isNaN(date.getTime())) return false;
        return (!start || date >= start) && (!end || date <= end);
      });
  }, [transactions, type, periodStart, periodEnd]);

  const items = useMemo(() => periodTransactions
    .filter(item => {
      const due = new Date(item.dueDate || item.date);
      due.setHours(0, 0, 0, 0);
      if (status === 'paid') return item.isPaid;
      if (status === 'overdue') return !item.isPaid && due < now;
      return !item.isPaid;
    })
    .filter(item => !search || item.description.toLowerCase().includes(search.toLowerCase()) || contacts.find(contact => contact.id === item.contactId)?.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(a.dueDate || a.date).getTime() - new Date(b.dueDate || b.date).getTime()),
  [periodTransactions, status, search, contacts]);

  const allOpen = periodTransactions.filter(item => !item.isPaid);
  const totalOpen = allOpen.reduce((sum, item) => sum + item.amount, 0);
  const totalOverdue = allOpen.filter(item => {
    const due = new Date(item.dueDate || item.date);
    due.setHours(0, 0, 0, 0);
    return due < now;
  }).reduce((sum, item) => sum + item.amount, 0);
  const Icon = mode === 'payable' ? TrendingDown : TrendingUp;

  const clearPeriod = () => {
    setPeriodStart('');
    setPeriodEnd('');
    setExpandedId(null);
  };

  useEffect(() => {
    const closePresets = (event: PointerEvent) => {
      if (presetRef.current && !presetRef.current.contains(event.target as Node)) setPresetOpen(false);
    };
    document.addEventListener('pointerdown', closePresets);
    return () => document.removeEventListener('pointerdown', closePresets);
  }, []);

  const applyPeriodPreset = (preset: 'today' | 'month' | 'year') => {
    const today = new Date();
    if (preset === 'today') {
      const value = toDateInputValue(today);
      setPeriodStart(value);
      setPeriodEnd(value);
    } else if (preset === 'month') {
      const current = getCurrentMonthPeriod();
      setPeriodStart(current.start);
      setPeriodEnd(current.end);
    } else {
      setPeriodStart(toDateInputValue(new Date(today.getFullYear(), 0, 1)));
      setPeriodEnd(toDateInputValue(new Date(today.getFullYear(), 11, 31)));
    }
    setExpandedId(null);
    setPresetOpen(false);
  };

  const reverseTitle = (item: Transaction) => {
    setConfirmModal({
      title: mode === 'payable' ? 'Estornar pagamento' : 'Estornar recebimento',
      description: `O título “${item.description}” voltará para Contas a ${mode === 'payable' ? 'pagar' : 'receber'} e poderá ser baixado novamente.`,
      variant: 'danger',
      onConfirm: async () => {
        await api.transactions.update(item.id, { isPaid: false, paymentDate: null });
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 pb-24 lg:px-8 lg:pb-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${mode === 'payable' ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}><Icon className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Financeiro</div>
            <h1 className="truncate text-xl font-black tracking-tight">A {mode === 'payable' ? 'pagar' : 'receber'}</h1>
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <SummaryCard label="A vencer" value={totalOpen} icon={Clock3} tone="primary" />
        <SummaryCard label="Vencidos" value={totalOverdue} icon={CalendarClock} tone={totalOverdue ? 'danger' : 'muted'} />
      </div>

      <div className="mb-3 flex flex-wrap items-start gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm sm:items-end">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:items-end sm:gap-2">
          <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Início</span>
            <input type="date" aria-label="Data inicial do período" value={periodStart} max={periodEnd || undefined} onChange={event => { const value = event.target.value; setPeriodStart(value); if (value && periodEnd && value > periodEnd) setPeriodEnd(value); setExpandedId(null); }} className="h-8 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-[10px] font-semibold outline-none focus:border-primary sm:w-[132px]" />
          </label>
          <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Fim</span>
            <input type="date" aria-label="Data final do período" value={periodEnd} min={periodStart || undefined} onChange={event => { const value = event.target.value; setPeriodEnd(value); if (value && periodStart && value < periodStart) setPeriodStart(value); setExpandedId(null); }} className="h-8 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-[10px] font-semibold outline-none focus:border-primary sm:w-[132px]" />
          </label>
        </div>
        <div ref={presetRef} className="relative shrink-0 pt-4 sm:pt-0">
          <button type="button" aria-label="Presets de período" title="Presets de período" onClick={() => setPresetOpen(open => !open)} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${presetOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><CalendarDays className="h-4 w-4" /></button>
          {presetOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-36 rounded-xl border border-border bg-card p-1.5 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
              <button type="button" onClick={() => applyPeriodPreset('today')} className="w-full rounded-lg px-2.5 py-2 text-left text-[10px] font-bold hover:bg-muted">Hoje</button>
              <button type="button" onClick={() => applyPeriodPreset('month')} className="w-full rounded-lg px-2.5 py-2 text-left text-[10px] font-bold hover:bg-muted">Este mês</button>
              <button type="button" onClick={() => applyPeriodPreset('year')} className="w-full rounded-lg px-2.5 py-2 text-left text-[10px] font-bold hover:bg-muted">Este ano</button>
            </div>
          )}
        </div>
        <button type="button" onClick={clearPeriod} className="mt-4 h-8 w-[132px] shrink-0 rounded-lg border border-border bg-muted/60 px-3 text-center text-[9px] font-black uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:mt-0">Limpar</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
            {[['open', 'Em aberto'], ['overdue', 'Vencidos'], ['paid', mode === 'payable' ? 'Pagos' : 'Recebidos']].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setStatus(value as typeof status)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider ${status === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
            ))}
          </div>
          <label className="relative block w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar descrição ou contato" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs outline-none focus:border-primary" />
          </label>
        </div>

        {items.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
            <div className="text-sm font-bold">Nada por aqui</div>
            <div className="mt-1 text-xs text-muted-foreground">Não encontramos lançamentos para este filtro.</div>
          </div>
        ) : (
          <div className="space-y-2 p-2 sm:p-3">
            {items.map(item => {
              const due = new Date(item.dueDate || item.date);
              const overdue = !item.isPaid && due < now;
              const contact = contacts.find(value => value.id === item.contactId);
              const category = categories.find(value => value.id === item.categoryId);
              const account = accounts.find(value => value.id === item.accountId);
              const card = cards.find(value => value.id === item.cardId);
              const savedPaymentMethod = item.notes?.startsWith('paymentMethod:')
                ? item.notes.replace('paymentMethod:', '')
                : undefined;
              const registeredPaymentMethod = customPaymentMethods.find(value => value.name === savedPaymentMethod)?.name;
              const paymentMethod = item.cardId && item.cardId !== 'money'
                ? `Cartão ${card?.name || 'cadastrado'}`
                : registeredPaymentMethod || savedPaymentMethod || 'Não informado';
              const accountLabel = account?.name || 'Não informado';
              const issueDate = new Date(item.date).toLocaleDateString('pt-BR');
              const paymentDate = item.isPaid
                ? new Date(item.paymentDate || item.date).toLocaleDateString('pt-BR')
                : 'Não realizado';
              const expanded = expandedId === item.id;
              const statusText = item.isPaid
                ? `${mode === 'payable' ? 'Pago' : 'Recebido'} em ${new Date(item.paymentDate || item.date).toLocaleDateString('pt-BR')}`
                : `${overdue ? 'Venceu' : 'Vence'} em ${due.toLocaleDateString('pt-BR')}`;

              return (
                <motion.div key={item.id} layout className="overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-sm">
                  <button type="button" aria-expanded={expanded} onClick={() => setExpandedId(current => current === item.id ? null : item.id)} className="flex w-full items-center gap-3 p-3 text-left sm:p-3.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${overdue ? 'bg-red-500/10 text-red-600' : item.isPaid ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                      {item.isPaid ? <CheckCircle2 className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{contact?.name || item.description}</div>
                      <div className="mt-0.5 truncate text-[10px] font-semibold text-muted-foreground">{statusText}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black">{formatCurrency(item.amount)}</div>
                      <div className={`mt-0.5 text-[9px] font-bold uppercase tracking-wider ${overdue ? 'text-red-600' : item.isPaid ? 'text-emerald-600' : 'text-muted-foreground'}`}>{item.isPaid ? (mode === 'payable' ? 'Pago' : 'Recebido') : 'Em aberto'}</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <div className="border-t border-border bg-muted/20 px-3 pb-3 pt-3 sm:px-4">
                          <div className="mb-3 rounded-lg bg-card/70 px-2.5 py-2">
                            <Detail label="Descrição" value={item.description} />
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3 lg:grid-cols-7">
                            <Detail label="Emissão" value={issueDate} />
                            <Detail label="Vencimento" value={due.toLocaleDateString('pt-BR')} />
                            <Detail label="Pagamento" value={paymentDate} />
                            <Detail label={mode === 'payable' ? 'Fornecedor' : 'Cliente'} value={contact?.name || 'Não informado'} />
                            <Detail label="Categoria" value={category?.name || 'Sem categoria'} />
                            <Detail label={mode === 'payable' ? 'Forma de pagamento' : 'Forma de recebimento'} value={paymentMethod} />
                            <Detail label={mode === 'payable' ? 'Conta de saída' : 'Conta de entrada'} value={accountLabel} />
                          </div>
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            {!item.isPaid ? (
                              <>
                                <button type="button" onClick={event => { event.stopPropagation(); setEditingTransactionId(item.id); setTransactionModalOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[10px] font-bold transition-colors hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                                <button type="button" onClick={event => { event.stopPropagation(); setConfirmPaymentTransactionId(item.id); }} className="rounded-lg bg-primary px-3 py-2 text-[10px] font-black uppercase tracking-wider text-primary-foreground transition-transform active:scale-95">Dar baixa integral</button>
                              </>
                            ) : (
                              <button type="button" onClick={event => { event.stopPropagation(); reverseTitle(item); }} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-[10px] font-bold text-red-600 transition-colors hover:bg-red-500/10"><RotateCcw className="h-3.5 w-3.5" /> Estornar</button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-0.5 truncate font-semibold">{value}</div></div>;
}

function SummaryCard({ label, value, icon: Icon, tone = 'muted', count = false }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone?: 'primary' | 'danger' | 'muted'; count?: boolean }) {
  const tones = { primary: 'bg-primary/10 text-primary', danger: 'bg-red-500/10 text-red-600', muted: 'bg-muted text-muted-foreground' };
  return <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm"><div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-3.5 w-3.5" /></div><div className="min-w-0"><div className="truncate text-[8px] font-black uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-0.5 truncate text-sm font-black">{count ? value : formatCurrency(value)}</div></div></div>;
}
