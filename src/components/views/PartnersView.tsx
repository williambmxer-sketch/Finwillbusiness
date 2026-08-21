import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, HandCoins, PiggyBank, Plus, RefreshCw, TrendingDown, TrendingUp, UserRound } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useOrganizationStore } from '../../store/useOrganizationStore';
import { useAppStore, TransactionPreset } from '../../store/useAppStore';
import { api } from '../../services/api';
import { Account, Category, WithdrawalConfig } from '../../db/db';
import { formatCurrency } from '../../utils/formatters';

export function PartnersView() {
  const transactions = useDataStore(state => state.transactions);
  const accounts = useDataStore(state => state.accounts);
  const categories = useDataStore(state => state.categories);
  const members = useOrganizationStore(state => state.members).filter(member => member.active && ['proprietario', 'administrador', 'socio', 'financeiro'].includes(member.role));
  const currentOrganization = useOrganizationStore(state => state.currentOrganization);
  const [configs, setConfigs] = useState<WithdrawalConfig[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const canAdmin = currentOrganization && ['proprietario', 'administrador'].includes(currentOrganization.role);

  const loadConfigs = async () => setConfigs(await api.withdrawals.list());
  useEffect(() => { loadConfigs().catch(() => undefined); }, [currentOrganization?.id]);

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const monthTransactions = transactions.filter(item => {
    const date = item.paymentDate || item.date;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === currentMonth;
  });
  const prolabore = monthTransactions.filter(item => item.nature === 'pro_labore').reduce((sum, item) => sum + item.amount, 0);
  const withdrawals = monthTransactions.filter(item => item.nature === 'retirada_extra').reduce((sum, item) => sum + item.amount, 0);
  const contributions = monthTransactions.filter(item => item.nature === 'aporte_socio').reduce((sum, item) => sum + item.amount, 0);
  const operationalIncome = monthTransactions.filter(item => item.isPaid && item.type === 'receita' && (item.nature || 'operacional') === 'operacional').reduce((sum, item) => sum + item.amount, 0);
  const operationalExpense = monthTransactions.filter(item => item.isPaid && item.type === 'despesa' && (item.nature || 'operacional') === 'operacional').reduce((sum, item) => sum + item.amount, 0);
  const operationalResult = operationalIncome - operationalExpense;

  const openPreset = (preset: TransactionPreset) => {
    useAppStore.getState().setEditingTransactionId(null);
    useAppStore.getState().setTransactionPreset(preset);
    useAppStore.getState().setTransactionModalOpen(true);
  };

  const generate = async () => {
    setBusy(true); setMessage('');
    try {
      const count = await api.withdrawals.generateDue();
      await Promise.all([loadConfigs(), useDataStore.getState().fetchData()]);
      setMessage(count ? `${count} pró-labore gerado com sucesso.` : 'Os pró-labores deste mês já estavam gerados.');
    } catch (error: any) { setMessage(error?.message || 'Não foi possível gerar os lançamentos.'); }
    finally { setBusy(false); }
  };

  const recent = useMemo(() => transactions
    .filter(item => ['pro_labore', 'retirada_extra', 'aporte_socio'].includes(item.nature || ''))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 12), [transactions]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-violet-600"><HandCoins className="h-3.5 w-3.5" /> Sócios e titular</div><h1 className="text-2xl font-black tracking-tight md:text-3xl">Pró-labore e retiradas</h1><p className="mt-1 text-sm text-muted-foreground">Pró-labore e retiradas ficam separados das receitas e despesas do negócio.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openPreset('prolabore')} className="rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground">Registrar pró-labore</button><button type="button" onClick={() => openPreset('withdrawal')} className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold">Retirada extra</button></div></div>

      {message && <div className="mb-4 rounded-xl bg-primary/10 p-3 text-xs font-semibold text-primary">{message}</div>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Resultado operacional" value={operationalResult} icon={PiggyBank} tone={operationalResult >= 0 ? 'green' : 'red'} /><Metric label="Pró-labore" value={prolabore} icon={HandCoins} tone="violet" /><Metric label="Retiradas extras" value={withdrawals} icon={TrendingDown} tone="amber" /><Metric label="Aportes" value={contributions} icon={TrendingUp} tone="blue" /><Metric label="Após retiradas" value={operationalResult - prolabore - withdrawals + contributions} icon={PiggyBank} tone="primary" /></div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="text-sm font-black">Pró-labore mensal</h2><p className="mt-1 text-xs text-muted-foreground">Configure um compromisso mensal para cada sócio.</p></div>{canAdmin && <button type="button" disabled={busy || configs.length === 0} onClick={generate} className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-[10px] font-black uppercase text-primary disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />Gerar mês</button>}</div><div className="divide-y divide-border">{members.map(member => {
          const config = configs.find(item => item.beneficiaryUserId === member.userId);
          return <div key={member.userId} className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 text-xs font-black uppercase text-violet-600">{(member.displayName || member.email || 'S').slice(0, 2)}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{member.displayName || member.email}</div><div className="mt-1 text-[10px] text-muted-foreground">{config ? `${formatCurrency(config.amount)} • vence dia ${config.dueDay}` : 'Sem pró-labore configurado'}</div></div>{canAdmin && <button type="button" onClick={() => setEditingMemberId(member.userId)} className="rounded-xl border border-border px-3 py-2 text-[10px] font-black uppercase hover:bg-muted">{config ? 'Editar' : 'Configurar'}</button>}</div>;
        })}{members.length === 0 && <div className="p-8 text-center text-xs text-muted-foreground">Nenhum sócio ativo.</div>}</div></div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border p-5"><h2 className="text-sm font-black">Histórico recente</h2><p className="mt-1 text-xs text-muted-foreground">Movimentos financeiros dos sócios.</p></div><div className="divide-y divide-border">{recent.map(item => {
          const member = members.find(value => value.userId === item.beneficiaryUserId);
          return <div key={item.id} className="flex items-center gap-3 p-4"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.nature === 'aporte_socio' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-violet-500/10 text-violet-600'}`}>{item.nature === 'aporte_socio' ? <TrendingUp className="h-4 w-4" /> : <HandCoins className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{item.description}</div><div className="mt-1 truncate text-[10px] text-muted-foreground">{member?.displayName || member?.email || 'Sócio'} • {item.date.toLocaleDateString('pt-BR')}</div></div><div className={`text-xs font-black ${item.nature === 'aporte_socio' ? 'text-emerald-600' : ''}`}>{item.nature === 'aporte_socio' ? '+' : '-'} {formatCurrency(item.amount)}</div></div>;
        })}{recent.length === 0 && <div className="p-8 text-center text-xs text-muted-foreground">Ainda não há movimentos de sócios.</div>}</div></div>
      </div>

      {editingMemberId && <ProlaboreDialog memberId={editingMemberId} existing={configs.find(item => item.beneficiaryUserId === editingMemberId)} accounts={accounts} categories={categories.filter(item => item.type === 'despesa')} onClose={() => setEditingMemberId(null)} onSaved={async () => { await loadConfigs(); setEditingMemberId(null); setMessage('Configuração mensal salva.'); }} />}
    </div>
  );
}

function ProlaboreDialog({ memberId, existing, accounts, categories, onClose, onSaved }: { memberId: string; existing?: WithdrawalConfig; accounts: Account[]; categories: Category[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [amount, setAmount] = useState(existing?.amount.toString() || '');
  const [dueDay, setDueDay] = useState(existing?.dueDay || 5);
  const [accountId, setAccountId] = useState(existing?.accountId || '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId || categories.find(item => item.name.toLowerCase().includes('pró'))?.id || categories[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const nextMonth = existing?.nextCompetence || new Date().toISOString().slice(0, 7) + '-01';
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { await api.withdrawals.save({ id: existing?.id, beneficiaryUserId: memberId, description: 'Pró-labore mensal', amount: Number(amount), dueDay, accountId: accountId || undefined, categoryId: categoryId || undefined, nextCompetence: nextMonth, active: true }); await onSaved(); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl"><div className="mb-5"><h2 className="text-lg font-black">Configurar pró-labore</h2><p className="mt-1 text-xs text-muted-foreground">O lançamento será criado como conta a pagar e só afetará o saldo após a baixa.</p></div><div className="space-y-4"><Field label="Valor mensal"><input type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} className="field-input" /></Field><Field label="Dia do vencimento"><input type="number" min="1" max="31" required value={dueDay} onChange={event => setDueDay(Number(event.target.value))} className="field-input" /></Field><Field label="Conta padrão (opcional)"><select value={accountId} onChange={event => setAccountId(event.target.value)} className="field-input"><option value="">Escolher na baixa</option>{accounts.filter((account) => (account.showInPayments !== false || account.id === accountId)).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Categoria"><select value={categoryId} onChange={event => setCategoryId(event.target.value)} className="field-input">{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field></div><div className="mt-5 flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border px-4 py-3 text-xs font-bold">Cancelar</button><button disabled={saving} className="flex-1 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button></div></form></div>;
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: 'green' | 'red' | 'violet' | 'amber' | 'blue' | 'primary' }) { const tones = { green: 'bg-emerald-500/10 text-emerald-600', red: 'bg-red-500/10 text-red-600', violet: 'bg-violet-500/10 text-violet-600', amber: 'bg-amber-500/10 text-amber-600', blue: 'bg-blue-500/10 text-blue-600', primary: 'bg-primary/10 text-primary' }; return <div className="rounded-2xl border border-border bg-card p-4"><div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" /></div><div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-1 text-lg font-black">{formatCurrency(value)}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>{children}</label>; }
