import React, { useMemo, useState } from 'react';
import { Building2, ChevronDown, Mail, Pencil, Phone, Plus, Search, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { api } from '../../services/api';
import { Contact } from '../../db/db';

export function ContactsView() {
  const contacts = useDataStore(state => state.contacts);
  const fetchData = useDataStore(state => state.fetchData);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | Contact['type']>('todos');
  const [editing, setEditing] = useState<Contact | null | 'new'>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const filtered = useMemo(() => contacts
    .filter(contact => contact.active)
    .filter(contact => filter === 'todos' || contact.type === filter || contact.type === 'ambos')
    .filter(contact => !search || [contact.name, contact.email, contact.phone].some(value => value?.toLowerCase().includes(search.toLowerCase()))),
  [contacts, filter, search]);

  const handleDelete = async (contact: Contact) => {
    if (!window.confirm(`Excluir o cadastro de “${contact.name}”? Ele deixará de aparecer nas listas, mas o histórico financeiro será preservado.`)) return;
    setDeletingId(contact.id);
    setError('');
    try {
      await api.contacts.delete(contact.id);
      await fetchData();
      setExpandedId(current => current === contact.id ? null : current);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir o cadastro.');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpanded = (contactId: string) => setExpandedId(current => current === contactId ? null : contactId);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-black tracking-tight md:text-2xl">Clientes e fornecedores</h1>
        <button type="button" onClick={() => setEditing('new')} className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground"><Plus className="h-3.5 w-3.5" />Novo contato</button>
      </div>

      <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {([['todos', 'Todos'], ['cliente', 'Clientes'], ['fornecedor', 'Fornecedores']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${filter === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>{label}</button>)}
        </div>
        <label className="relative block w-full md:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar contato" className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs outline-none focus:border-primary" /></label>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center"><UsersRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><div className="text-sm font-bold">Nenhum contato encontrado</div><p className="mt-1 text-xs text-muted-foreground">Cadastre seu primeiro cliente ou fornecedor.</p></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="hidden grid-cols-[minmax(0,1fr)_140px_auto] gap-4 border-b border-border bg-muted/30 px-4 py-1.5 text-[8px] font-black uppercase tracking-widest text-muted-foreground md:grid">
            <span>Cadastro</span><span>Tipo</span><span />
          </div>
          <div className="divide-y divide-border">
            {filtered.map(contact => {
              const expanded = expandedId === contact.id;
              const ContactIcon = contact.type === 'cliente' ? UserRound : Building2;
              const tone = contact.type === 'cliente' ? 'bg-emerald-500/10 text-emerald-600' : contact.type === 'fornecedor' ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary';
              return (
                <div key={contact.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    onClick={() => toggleExpanded(contact.id)}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleExpanded(contact.id); } }}
                    className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-1.5 outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 md:grid-cols-[minmax(0,1fr)_140px_auto]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}><ContactIcon className="h-3.5 w-3.5" /></div>
                      <div className="truncate text-[13px] font-bold">{contact.name}</div>
                    </div>
                    <div><span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-primary">{contact.type}</span></div>
                    <div className="col-span-2 flex justify-end md:col-span-1"><ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180 text-foreground' : ''}`} /></div>
                  </div>
                  <div
                    aria-hidden={!expanded}
                    className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className={`min-h-0 overflow-hidden bg-muted/20 px-4 transition-[height,padding,transform] duration-300 ease-out md:grid md:grid-cols-[1fr_1fr_auto] md:items-start md:gap-6 ${expanded ? 'border-t border-border py-3 translate-y-0' : 'h-0 border-t-0 py-0 -translate-y-2'}`}>
                      <div><div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">E-mail</div><div className="mt-1 flex items-center gap-2 text-xs">{contact.email ? <><Mail className="h-3.5 w-3.5 text-muted-foreground" />{contact.email}</> : 'Não informado'}</div></div>
                      <div><div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Telefone e observações</div><div className="mt-1 flex items-center gap-2 text-xs">{contact.phone ? <><Phone className="h-3.5 w-3.5 text-muted-foreground" />{contact.phone}</> : 'Não informado'}</div>{contact.notes && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{contact.notes}</p>}</div>
                      <div className="mt-3 flex gap-2 md:mt-0 md:justify-end"><button type="button" tabIndex={expanded ? 0 : -1} onClick={() => setEditing(contact)} className="rounded-xl border border-border px-3 py-2 text-[10px] font-bold hover:bg-card"><Pencil className="mr-1 inline h-3.5 w-3.5" />Editar</button><button type="button" tabIndex={expanded ? 0 : -1} onClick={() => handleDelete(contact)} disabled={deletingId === contact.id} className="rounded-xl border border-red-500/20 px-3 py-2 text-[10px] font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Excluir</button></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && <ContactDialog contact={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { await fetchData(); setEditing(null); }} />}
    </div>
  );
}

function ContactDialog({ contact, onClose, onSaved }: { contact: Contact | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(contact?.name || '');
  const [type, setType] = useState<Contact['type']>(contact?.type || 'cliente');
  const [email, setEmail] = useState(contact?.email || '');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [notes, setNotes] = useState(contact?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      const payload = { name: name.trim(), type, email: email.trim() || undefined, phone: phone.trim() || undefined, notes: notes.trim() || undefined, active: true };
      if (contact) await api.contacts.update(contact.id, payload);
      else await api.contacts.add(payload);
      await onSaved();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o contato.');
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center"><form onSubmit={submit} className="w-full max-w-lg rounded-3xl border border-border bg-card p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-black">{contact ? 'Editar contato' : 'Novo contato'}</h2><p className="mt-1 text-xs text-muted-foreground">Somente nome e tipo são obrigatórios.</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-muted"><X className="h-5 w-5" /></button></div>
    <div className="space-y-4"><Field label="Nome"><input value={name} onChange={event => setName(event.target.value)} required className="field-input" placeholder="Nome do cliente ou fornecedor" /></Field><Field label="Tipo"><div className="grid grid-cols-3 gap-2">{(['cliente', 'fornecedor', 'ambos'] as const).map(value => <button key={value} type="button" onClick={() => setType(value)} className={`rounded-xl border px-3 py-2.5 text-[10px] font-black uppercase ${type === value ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{value}</button>)}</div></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="E-mail"><input type="email" value={email} onChange={event => setEmail(event.target.value)} className="field-input" placeholder="contato@empresa.com" /></Field><Field label="Telefone"><input value={phone} onChange={event => setPhone(event.target.value)} className="field-input" placeholder="(00) 00000-0000" /></Field></div><Field label="Observações"><textarea value={notes} onChange={event => setNotes(event.target.value)} className="field-input min-h-20 resize-none py-3" placeholder="Informações úteis" /></Field></div>
    {error && <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-600">{error}</div>}<div className="mt-5 flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border px-4 py-3 text-xs font-bold">Cancelar</button><button disabled={saving} type="submit" className="flex-1 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar contato'}</button></div></form></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>{children}</label>; }
