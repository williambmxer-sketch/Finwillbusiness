import React, { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronRight, Clock3, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useAppStore } from '../../store/useAppStore';
import { formatCurrency } from '../../utils/formatters';

export function AgendaView({ mode }: { mode: 'payable' | 'receivable' }) {
  const transactions = useDataStore(state => state.transactions);
  const categories = useDataStore(state => state.categories);
  const contacts = useDataStore(state => state.contacts);
  const { setConfirmPaymentTransactionId, setEditingTransactionId, setTransactionModalOpen, setCurrentView } = useAppStore();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'open' | 'overdue' | 'paid'>('open');
  const type = mode === 'payable' ? 'despesa' : 'receita';
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const items = useMemo(() => transactions
    .filter(item => item.type === type && item.nature !== 'transferencia' && item.nature !== 'pagamento_fatura')
    .filter(item => {
      const due = new Date(item.dueDate || item.date);
      due.setHours(0, 0, 0, 0);
      if (status === 'paid') return item.isPaid;
      if (status === 'overdue') return !item.isPaid && due < now;
      return !item.isPaid;
    })
    .filter(item => !search || item.description.toLowerCase().includes(search.toLowerCase()) || contacts.find(contact => contact.id === item.contactId)?.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(a.dueDate || a.date).getTime() - new Date(b.dueDate || b.date).getTime()),
  [transactions, type, status, search, contacts]);

  const allOpen = transactions.filter(item => item.type === type && !item.isPaid && item.nature !== 'transferencia' && item.nature !== 'pagamento_fatura');
  const totalOpen = allOpen.reduce((sum, item) => sum + item.amount, 0);
  const totalOverdue = allOpen.filter(item => new Date(item.dueDate || item.date) < now).reduce((sum, item) => sum + item.amount, 0);
  const Icon = mode === 'payable' ? TrendingDown : TrendingUp;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${mode === 'payable' ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}><Icon className="h-3.5 w-3.5" /> Financeiro</div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Contas a {mode === 'payable' ? 'pagar' : 'receber'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe vencimentos e dê baixa sem perder nenhum compromisso.</p>
        </div>
        <button type="button" onClick={() => {
          useAppStore.getState().setTransactionPreset(mode === 'payable' ? 'expense_pending' : 'income_pending');
          setEditingTransactionId(null);
          setTransactionModalOpen(true);
        }} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">
          Novo lançamento
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Em aberto" value={totalOpen} icon={Clock3} tone="primary" />
        <SummaryCard label="Vencido" value={totalOverdue} icon={CalendarClock} tone={totalOverdue ? 'danger' : 'muted'} />
        <SummaryCard label="Quantidade" value={allOpen.length} icon={CheckCircle2} count />
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
          <div className="divide-y divide-border">
            {items.map(item => {
              const due = new Date(item.dueDate || item.date);
              const overdue = !item.isPaid && due < now;
              const contact = contacts.find(value => value.id === item.contactId);
              const category = categories.find(value => value.id === item.categoryId);
              return (
                <div key={item.id} className="group flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-center">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${overdue ? 'bg-red-500/10 text-red-600' : item.isPaid ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                    {item.isPaid ? <CheckCircle2 className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
                  </div>
                  <button type="button" onClick={() => { setEditingTransactionId(item.id); setTransactionModalOpen(true); }} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-bold">{item.description}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                      <span>{contact?.name || (mode === 'payable' ? 'Sem fornecedor' : 'Sem cliente')}</span>
                      <span>•</span><span>{category?.name || 'Sem categoria'}</span>
                      {item.nature && item.nature !== 'operacional' && <><span>•</span><span className="capitalize text-primary">{item.nature.replaceAll('_', ' ')}</span></>}
                    </div>
                  </button>
                  <div className="min-w-36 md:text-right">
                    <div className="text-sm font-black">{formatCurrency(item.amount)}</div>
                    <div className={`mt-1 text-[10px] font-bold ${overdue ? 'text-red-600' : 'text-muted-foreground'}`}>{item.isPaid ? `${mode === 'payable' ? 'Pago' : 'Recebido'} em ${new Date(item.paymentDate || item.date).toLocaleDateString('pt-BR')}` : `${overdue ? 'Venceu' : 'Vence'} em ${due.toLocaleDateString('pt-BR')}`}</div>
                  </div>
                  {!item.isPaid ? (
                    <button type="button" onClick={() => setConfirmPaymentTransactionId(item.id)} className="rounded-xl bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-primary-foreground">Dar baixa</button>
                  ) : <ChevronRight className="hidden h-4 w-4 text-muted-foreground md:block" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone = 'muted', count = false }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone?: 'primary' | 'danger' | 'muted'; count?: boolean }) {
  const tones = { primary: 'bg-primary/10 text-primary', danger: 'bg-red-500/10 text-red-600', muted: 'bg-muted text-muted-foreground' };
  return <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div><div><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-lg font-black">{count ? value : formatCurrency(value)}</div></div></div>;
}
