import React, { useEffect, useState } from 'react';
import { ClipboardList, Filter, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

type AuditEntry = Awaited<ReturnType<typeof api.audit.list>>[number];

const actionLabel: Record<string, string> = {
  criou: 'Criou',
  alterou: 'Alterou',
  baixou: 'Baixou',
  estornou: 'Estornou',
  excluiu: 'Excluiu',
};

export function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await api.audit.list({ startDate, endDate, userId, action }));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar a auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const users = Array.from(new Map(entries.filter(entry => entry.usuario_id).map(entry => [entry.usuario_id, entry.usuario_nome])).entries());

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary"><ClipboardList className="h-3.5 w-3.5" /> Auditoria</div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Registro de operações</h1>
          <p className="mt-1 text-sm text-muted-foreground">Histórico de quem realizou cada operação na empresa.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground hover:text-foreground disabled:opacity-50" aria-label="Atualizar auditoria"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      <form onSubmit={event => { event.preventDefault(); void load(); }} className="mb-5 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">De<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="field-input mt-1 normal-case tracking-normal" /></label>
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Até<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="field-input mt-1 normal-case tracking-normal" /></label>
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usuário<select value={userId} onChange={event => setUserId(event.target.value)} className="field-input mt-1 normal-case tracking-normal"><option value="">Todos os usuários</option>{users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ação<select value={action} onChange={event => setAction(event.target.value)} className="field-input mt-1 normal-case tracking-normal"><option value="">Todas as ações</option>{Object.entries(actionLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground sm:col-span-2 lg:col-span-4"><Filter className="h-4 w-4" />Aplicar filtros</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {error ? <div className="p-6 text-sm text-red-600">{error}</div> : loading ? <div className="flex min-h-40 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-primary" /></div> : entries.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma operação registrada ainda.</div> : (
          <div className="divide-y divide-border">
            {entries.map(entry => (
              <div key={entry.id} className="flex flex-wrap items-center gap-3 p-4">
                  <span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-black uppercase text-primary">{actionLabel[entry.acao] || entry.acao}</span>
                  <span className="text-xs font-bold">{entry.tela}: {entry.descricao}</span>
                  <span className="text-xs text-muted-foreground">por {entry.usuario_nome}</span>
                  <time className="ml-auto text-[10px] text-muted-foreground" dateTime={entry.criado_em}>{new Date(entry.criado_em).toLocaleString('pt-BR')}</time>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
