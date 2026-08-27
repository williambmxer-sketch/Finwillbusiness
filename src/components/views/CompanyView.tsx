import React, { useEffect, useState } from 'react';
import { Building2, Check, Clipboard, DatabaseZap, Mail, ShieldCheck, UserMinus, UserPlus, Users, XCircle } from 'lucide-react';
import { useOrganizationStore } from '../../store/useOrganizationStore';
import { api } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';

type InviteRole = 'administrador' | 'socio' | 'consulta';

export function CompanyView() {
  const { currentOrganization, members, load, refreshMembers } = useOrganizationStore();
  const [name, setName] = useState(currentOrganization?.name || '');
  const [tradeName, setTradeName] = useState(currentOrganization?.tradeName || '');
  const [document, setDocument] = useState(currentOrganization?.document || '');
  const [savingCompany, setSavingCompany] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('socio');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteExpiry, setInviteExpiry] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const canAdmin = currentOrganization && ['proprietario', 'administrador'].includes(currentOrganization.role);
  const hasFinancialData = useDataStore(state => state.accounts.length > 0 || state.transactions.length > 0 || state.categories.length > 0);

  useEffect(() => {
    setName(currentOrganization?.name || '');
    setTradeName(currentOrganization?.tradeName || '');
    setDocument(currentOrganization?.document || '');
  }, [currentOrganization]);

  const saveCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentOrganization || !name.trim()) return;
    setSavingCompany(true); setMessage(null);
    try {
      await api.organizations.update(currentOrganization.id, { name: name.trim(), tradeName: tradeName.trim(), document: document.trim() });
      await load();
      setMessage({ type: 'success', text: 'Dados da empresa atualizados.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível atualizar a empresa.' });
    } finally { setSavingCompany(false); }
  };

  const createInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setMessage(null);
    try {
      const result = await api.organizations.createInvite(email.trim(), role);
      setInviteCode(result.codigo);
      setInviteExpiry(result.expira_em);
      setMessage({ type: 'success', text: 'Convite criado. Compartilhe o código com segurança.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível criar o convite.' });
    } finally { setBusy(false); }
  };

  const updateMember = async (userId: string, nextRole: InviteRole, active: boolean) => {
    setBusy(true); setMessage(null);
    try {
      await api.organizations.updateMember(userId, nextRole, active);
      await refreshMembers();
      setMessage({ type: 'success', text: 'Permissão atualizada.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível alterar o usuário.' });
    } finally { setBusy(false); }
  };

  const removeMember = async (member: { userId: string; displayName?: string; email?: string }) => {
    const label = member.displayName || member.email || 'este usuário';
    if (!window.confirm(`Remover ${label} da empresa? O acesso será removido, mas a conta Auth será preservada.`)) return;
    setBusy(true); setMessage(null);
    try {
      await api.organizations.removeMember(member.userId);
      await refreshMembers();
      setMessage({ type: 'success', text: 'Acesso removido. A conta Auth foi preservada.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível remover o acesso.' });
    } finally { setBusy(false); }
  };

  const loadDemo = async () => {
    setBusy(true); setMessage(null);
    try {
      const created = await api.demo.seed();
      await Promise.all([useDataStore.getState().fetchData(), load()]);
      setMessage({ type: created ? 'success' : 'error', text: created ? 'Demonstração carregada com contas, contatos e lançamentos variados.' : 'A empresa já possui dados; a demonstração não foi aplicada para preservar seus registros.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível carregar a demonstração.' });
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary"><Building2 className="h-3.5 w-3.5" /> Organização</div><h1 className="text-2xl font-black tracking-tight md:text-3xl">Empresa e usuários</h1><p className="mt-1 text-sm text-muted-foreground">Dados do negócio, sócios e acessos compartilhados.</p></div>

      {message && <div className={`mb-5 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'}`}>{message.type === 'success' ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{message.text}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
        <div className="space-y-5">
          <form onSubmit={saveCompany} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div><div><h2 className="text-sm font-black">Dados da empresa</h2><p className="text-xs text-muted-foreground">Informações exibidas no sistema e relatórios.</p></div></div><div className="space-y-4"><Field label="Nome da empresa"><input className="field-input" value={name} onChange={event => setName(event.target.value)} disabled={!canAdmin} required /></Field><Field label="Nome fantasia"><input className="field-input" value={tradeName} onChange={event => setTradeName(event.target.value)} disabled={!canAdmin} placeholder="Como você chama o seu negócio" /></Field><Field label="Documento (opcional)"><input className="field-input" value={document} onChange={event => setDocument(event.target.value)} disabled={!canAdmin} placeholder="CNPJ ou identificação interna" /></Field></div>{canAdmin && <button disabled={savingCompany} type="submit" className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-50">{savingCompany ? 'Salvando...' : 'Salvar empresa'}</button>}</form>

          {canAdmin && !hasFinancialData && <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><DatabaseZap className="h-5 w-5" /></div><div><h2 className="text-sm font-black">Dados para demonstração</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Carregue uma empresa fictícia completa para explorar contas, cartão, clientes, fornecedores, pendências e pró-labore. Esta opção só funciona enquanto a empresa estiver vazia.</p></div></div><button type="button" disabled={busy} onClick={loadDemo} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy ? 'Carregando...' : 'Carregar demonstração completa'}</button></div>}
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border p-5"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600"><Users className="h-5 w-5" /></div><div><h2 className="text-sm font-black">Usuários e sócios</h2><p className="text-xs text-muted-foreground">{members.filter(member => member.active).length} acesso(s) ativo(s)</p></div></div>{canAdmin && <ShieldCheck className="h-5 w-5 text-emerald-500" />}</div><div className="divide-y divide-border">{members.map(member => {
            const isOwner = member.role === 'proprietario';
            return <div key={member.userId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black uppercase text-primary">{(member.displayName || member.email || 'U').slice(0, 2)}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{member.displayName || member.email || 'Usuário'}</div><div className="truncate text-[10px] text-muted-foreground">{member.email}</div></div>{isOwner ? <span className="rounded-full bg-primary/10 px-3 py-1.5 text-[9px] font-black uppercase text-primary">Proprietário</span> : canAdmin ? <><select value={member.role === 'administrador' ? 'administrador' : member.role === 'consulta' ? 'consulta' : 'socio'} onChange={event => updateMember(member.userId, event.target.value as InviteRole, member.active)} disabled={busy} className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"><option value="administrador">Administrador</option><option value="socio">Sócio</option><option value="consulta">Consulta</option></select><button type="button" onClick={() => updateMember(member.userId, member.role === 'administrador' ? 'administrador' : member.role === 'consulta' ? 'consulta' : 'socio', !member.active)} disabled={busy} className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase ${member.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>{member.active ? 'Ativo' : 'Inativo'}</button><button type="button" onClick={() => removeMember(member)} disabled={busy} className="rounded-xl border border-red-500/20 px-3 py-2 text-[9px] font-black uppercase text-red-600 hover:bg-red-500/10 disabled:opacity-50"><UserMinus className="mr-1 inline h-3.5 w-3.5" />Remover</button></> : <span className="text-xs capitalize text-muted-foreground">{member.role}</span>}</div>;
          })}</div></div>

          {canAdmin && <form onSubmit={createInvite} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><UserPlus className="h-5 w-5" /></div><div><h2 className="text-sm font-black">Convidar usuário</h2><p className="text-xs text-muted-foreground">O código expira em sete dias e só funciona para o e-mail informado.</p></div></div><div className="grid gap-3 sm:grid-cols-[1fr_150px]"><label className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="email" required value={email} onChange={event => setEmail(event.target.value)} className="field-input pl-9" placeholder="socio@empresa.com" /></label><select value={role} onChange={event => setRole(event.target.value as InviteRole)} className="field-input"><option value="socio">Sócio</option><option value="administrador">Administrador</option><option value="consulta">Consulta</option></select></div><button disabled={busy} className="mt-3 w-full rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-50">Gerar convite</button>{inviteCode && <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4"><div className="text-[9px] font-black uppercase tracking-widest text-primary">Código do convite</div><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-xl bg-background px-3 py-2.5 text-center text-sm font-black tracking-[0.18em]">{inviteCode}</code><button type="button" onClick={() => navigator.clipboard.writeText(inviteCode)} className="rounded-xl border border-border bg-background p-2.5" aria-label="Copiar código"><Clipboard className="h-4 w-4" /></button></div>{inviteExpiry && <div className="mt-2 text-[10px] text-muted-foreground">Válido até {new Date(inviteExpiry).toLocaleString('pt-BR')}</div>}</div>}</form>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>{children}</label>; }
