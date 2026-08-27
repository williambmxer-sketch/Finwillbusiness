import React, { useEffect, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
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

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await api.audit.list());
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar a auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {error ? <div className="p-6 text-sm text-red-600">{error}</div> : loading ? <div className="flex min-h-40 items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-primary" /></div> : entries.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma operação registrada ainda.</div> : (
          <div className="divide-y divide-border">
            {entries.map(entry => (
              <details key={entry.id} className="group p-4">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                  <span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-black uppercase text-primary">{actionLabel[entry.acao] || entry.acao}</span>
                  <span className="text-xs font-bold">{entry.tela}</span>
                  <span className="text-xs text-muted-foreground">{entry.entidade_id ? `#${entry.entidade_id.slice(0, 8)}` : ''}</span>
                  <time className="ml-auto text-[10px] text-muted-foreground" dateTime={entry.criado_em}>{new Date(entry.criado_em).toLocaleString('pt-BR')}</time>
                </summary>
                <div className="mt-3 grid gap-3 border-t border-border pt-3 text-[10px] text-muted-foreground sm:grid-cols-2">
                  <div><strong className="text-foreground">Usuário:</strong> {entry.usuario_id || 'Sistema'}</div>
                  <div><strong className="text-foreground">Entidade:</strong> {entry.entidade}</div>
                  {entry.dados_anteriores && <pre className="overflow-auto rounded-lg bg-muted p-3">Antes: {JSON.stringify(entry.dados_anteriores, null, 2)}</pre>}
                  {entry.dados_novos && <pre className="overflow-auto rounded-lg bg-muted p-3">Depois: {JSON.stringify(entry.dados_novos, null, 2)}</pre>}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
