import React, { useMemo, useState } from 'react';
import { Building2, Mail, Pencil, Phone, Plus, Search, UserRound, UsersRound, X } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { api } from '../../services/api';
import { Contact } from '../../db/db';

export function ContactsView() {
  const contacts = useDataStore(state => state.contacts);
  const fetchData = useDataStore(state => state.fetchData);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | Contact['type']>('todos');
  const [editing, setEditing] = useState<Contact | null | 'new'>(null);

  const filtered = useMemo(() => contacts
    .filter(contact => contact.active)
    .filter(contact => filter === 'todos' || contact.type === filter || contact.type === 'ambos')
    .filter(contact => !search || [contact.name, contact.email, contact.phone].some(value => value?.toLowerCase().includes(search.toLowerCase()))),
  [contacts, filter, search]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary"><UsersRound className="h-3.5 w-3.5" /> Relacionamentos</div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">Clientes e fornecedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cadastros rápidos para identificar de onde o dinheiro vem e para onde vai.</p>
        </div>
        <button type="button" onClick={() => setEditing('new')} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"><Plus className="h-4 w-4" />Novo contato</button>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {([['todos', 'Todos'], ['cliente', 'Clientes'], ['fornecedor', 'Fornecedores']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider ${filter === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>{label}</button>)}
        </div>
        <label className="relative block w-full md:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar contato" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs outline-none focus:border-primary" /></label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center"><UsersRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><div className="text-sm font-bold">Nenhum contato encontrado</div><p className="mt-1 text-xs text-muted-foreground">Cadastre seu primeiro cliente ou fornecedor.</p></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(contact => (
            <button key={contact.id} type="button" onClick={() => setEditing(contact)} className="group rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <div className="flex items-start justify-between gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${contact.type === 'cliente' ? 'bg-emerald-500/10 text-emerald-600' : contact.type === 'fornecedor' ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}>{contact.type === 'cliente' ? <UserRound className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}</div><Pencil className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /></div>
              <div className="mt-3 truncate text-sm font-black">{contact.name}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-primary">{contact.type}</div>
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">{contact.email && <div className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0" />{contact.email}</div>}{contact.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{contact.phone}</div>}</div>
            </button>
          ))}
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
