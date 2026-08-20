import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  CalendarClock,
  ChevronDown,
  CircleDollarSign,
  ContactRound,
  CreditCard,
  HandCoins,
  Landmark,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Settings,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import { useAppStore, AppView, TransactionPreset } from '../store/useAppStore';
import { useOrganizationStore } from '../store/useOrganizationStore';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import { formatCurrency } from '../utils/formatters';

type MenuKey = 'company' | 'finance' | 'agenda' | 'treasury' | 'management' | 'records' | 'new' | 'user';
type MobileSection = keyof Pick<MenuMap, 'finance' | 'agenda' | 'treasury'> | 'more';

type MenuMap = {
  finance: MenuItem[];
  agenda: MenuItem[];
  treasury: MenuItem[];
  management: MenuItem[];
  records: MenuItem[];
};

interface MenuItem {
  label: string;
  view?: AppView;
  preset?: TransactionPreset;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function TopNavigation() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileSection, setMobileSection] = useState<MobileSection | null>(null);
  const { currentView, setCurrentView, setTransactionModalOpen, setEditingTransactionId, setTransactionPreset } = useAppStore();
  const { organizations, currentOrganization, switchOrganization } = useOrganizationStore();
  const signOut = useAuthStore(state => state.signOut);
  const transactions = useDataStore(state => state.transactions);
  const canEdit = currentOrganization && !['consulta', 'visualizador', 'membro'].includes(currentOrganization.role);

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const overdueCount = transactions.filter(t => !t.isPaid && (t.dueDate || t.date) < today).length;
  const payableTotal = transactions
    .filter(t => !t.isPaid && t.type === 'despesa')
    .reduce((sum, item) => sum + item.amount, 0);

  const menus = useMemo<Record<'finance' | 'agenda' | 'treasury' | 'management' | 'records', MenuItem[]>>(() => ({
    finance: [
      { label: 'Venda recebida', preset: 'income_received', icon: TrendingUp },
      { label: 'Venda a receber', preset: 'income_pending', icon: CalendarClock },
      { label: 'Despesa paga', preset: 'expense_paid', icon: TrendingDown },
      { label: 'Despesa a pagar', preset: 'expense_pending', icon: ReceiptText },
      { label: 'Transferência', preset: 'transfer', icon: Landmark },
      { label: 'Pró-labore e retiradas', view: 'partners', icon: HandCoins },
      { label: 'Todos os lançamentos', view: 'transactions', icon: WalletCards },
    ],
    agenda: [
      { label: 'Contas a pagar', view: 'agendaPayable', icon: TrendingDown, badge: payableTotal ? formatCurrency(payableTotal) : undefined },
      { label: 'Contas a receber', view: 'agendaReceivable', icon: TrendingUp },
      { label: 'Planejamento recorrente', view: 'planning', icon: CalendarClock },
    ],
    treasury: [
      { label: 'Contas e caixa', view: 'accounts', icon: Landmark },
      { label: 'Cartões', view: 'cards', icon: CreditCard },
      { label: 'Faturas', view: 'invoices', icon: ReceiptText },
      { label: 'Extrato consolidado', view: 'transactions', icon: WalletCards },
    ],
    management: [
      { label: 'Relatórios', view: 'reports', icon: BarChart3 },
      { label: 'Resultado do negócio', view: 'dashboard', icon: CircleDollarSign },
    ],
    records: [
      { label: 'Clientes e fornecedores', view: 'contacts', icon: ContactRound },
      { label: 'Categorias', view: 'transactions', icon: Settings },
      { label: 'Usuários e empresa', view: 'company', icon: Users },
    ],
  }), [overdueCount, payableTotal]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setOpenMenu(null);
    setMobileSection(null);
  }, [currentView]);

  const toggle = (key: MenuKey) => setOpenMenu(current => current === key ? null : key);

  const openItem = (item: MenuItem) => {
    if (item.view) setCurrentView(item.view);
    if (item.preset && canEdit) {
      setEditingTransactionId(null);
      setTransactionPreset(item.preset);
      setTransactionModalOpen(true);
    }
    setOpenMenu(null);
    setMobileSection(null);
  };

  const renderDropdown = (key: keyof typeof menus, wide = false) => (
    <DropdownPanel className={wide ? 'w-80' : 'w-64'}>
      {menus[key].map(item => {
        const Icon = item.icon;
        const disabled = Boolean(item.preset && !canEdit);
        return (
          <button
            key={item.label}
            type="button"
            disabled={disabled}
            onClick={() => openItem(item)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${item.view === currentView ? 'bg-primary/10 text-primary' : 'hover:bg-muted'} disabled:cursor-not-allowed disabled:opacity-45`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-xs font-semibold">{item.label}</span>
            {item.badge && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-700 dark:text-amber-400">{item.badge}</span>}
          </button>
        );
      })}
    </DropdownPanel>
  );

  return (
    <div ref={rootRef} className="relative z-[80] border-b border-border bg-card/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-2 px-3 lg:px-5">
        <button type="button" onClick={() => setCurrentView('dashboard')} className="mr-1 flex shrink-0 items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-muted">
          <img src="/icone-financas-pwa.svg" alt="FinWill" className="h-9 w-9" />
          <div className="hidden text-left sm:block">
            <div className="text-sm font-black leading-none tracking-tight">FinWill</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Business</div>
          </div>
        </button>

        <div className="relative block min-w-0">
          {organizations.length > 1 ? (
            <>
              <MenuButton label={currentOrganization?.tradeName || currentOrganization?.name || 'Empresa'} icon={Building2} active={openMenu === 'company'} onClick={() => toggle('company')} compact />
              {openMenu === 'company' && (
                <DropdownPanel className="left-0 w-72">
                  <div className="px-3 pb-2 pt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Trocar empresa</div>
                  {organizations.map(organization => (
                    <button
                      key={organization.id}
                      type="button"
                      onClick={async () => { await switchOrganization(organization.id); setOpenMenu(null); }}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${organization.id === currentOrganization?.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                    >
                      <Building2 className="h-4 w-4" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{organization.tradeName || organization.name}</span>
                      <span className="text-[9px] uppercase text-muted-foreground">{organization.role === 'proprietario' ? 'Proprietário' : organization.role}</span>
                    </button>
                  ))}
                </DropdownPanel>
              )}
            </>
          ) : (
            <div title="Empresa ativa" className="flex max-w-[220px] items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold">
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{currentOrganization?.tradeName || currentOrganization?.name || 'Empresa'}</span>
            </div>
          )}
        </div>

        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex">
          <button type="button" onClick={() => setCurrentView('dashboard')} className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${currentView === 'dashboard' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>Visão geral</button>
          <div className="relative"><MenuButton label="Lançamentos" active={openMenu === 'finance'} onClick={() => toggle('finance')} />{openMenu === 'finance' && renderDropdown('finance', true)}</div>
          <div className="relative"><MenuButton label="Financeiro" active={openMenu === 'agenda'} onClick={() => toggle('agenda')} badge={overdueCount || undefined} />{openMenu === 'agenda' && renderDropdown('agenda', true)}</div>
          <div className="relative"><MenuButton label="Tesouraria" active={openMenu === 'treasury'} onClick={() => toggle('treasury')} />{openMenu === 'treasury' && renderDropdown('treasury')}</div>
          <div className="relative"><MenuButton label="Gestão" active={openMenu === 'management'} onClick={() => toggle('management')} />{openMenu === 'management' && renderDropdown('management')}</div>
          <div className="relative"><MenuButton label="Cadastros" active={openMenu === 'records'} onClick={() => toggle('records')} />{openMenu === 'records' && renderDropdown('records')}</div>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <div className="relative hidden md:block">
              <button type="button" onClick={() => toggle('new')} className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform active:scale-95">
                <Plus className="h-4 w-4" /> Novo <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {openMenu === 'new' && (
                <DropdownPanel className="right-0 w-64">
                  {menus.finance.slice(0, 5).map(item => {
                    const Icon = item.icon;
                    return <button key={item.label} type="button" onClick={() => openItem(item)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold hover:bg-muted"><Icon className="h-4 w-4 text-primary" />{item.label}</button>;
                  })}
                  <div className="my-2 border-t border-border" />
                  {[
                    { label: 'Pró-labore', preset: 'prolabore' as const, icon: HandCoins },
                    { label: 'Retirada extra', preset: 'withdrawal' as const, icon: TrendingDown },
                    { label: 'Aporte do sócio', preset: 'contribution' as const, icon: TrendingUp },
                  ].map(item => {
                    const Icon = item.icon;
                    return <button key={item.label} type="button" onClick={() => openItem(item)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold hover:bg-muted"><Icon className="h-4 w-4 text-primary" />{item.label}</button>;
                  })}
                </DropdownPanel>
              )}
            </div>
          )}

          <div className="relative hidden sm:block">
            <button type="button" onClick={() => toggle('user')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-xs font-black uppercase hover:bg-muted">
              {(useAuthStore.getState().user?.email || 'U').slice(0, 1)}
            </button>
            {openMenu === 'user' && (
              <DropdownPanel className="right-0 w-64">
                <div className="px-3 py-2">
                  <div className="truncate text-xs font-bold">{useAuthStore.getState().user?.email}</div>
                  <div className="mt-1 text-[10px] capitalize text-muted-foreground">{currentOrganization?.role || 'usuário'}</div>
                </div>
                <div className="my-2 border-t border-border" />
                <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-500/10"><LogOut className="h-4 w-4" />Sair</button>
              </DropdownPanel>
            )}
          </div>

        </div>
      </div>

      <MobileBottomNavigation
        currentView={currentView}
        mobileSection={mobileSection}
        setMobileSection={setMobileSection}
        setCurrentView={setCurrentView}
        openItem={openItem}
        menus={menus}
        overdueCount={overdueCount}
        signOut={signOut}
      />
    </div>
  );
}

function MobileBottomNavigation({
  currentView,
  mobileSection,
  setMobileSection,
  setCurrentView,
  openItem,
  menus,
  overdueCount,
  signOut,
}: {
  currentView: AppView;
  mobileSection: MobileSection | null;
  setMobileSection: React.Dispatch<React.SetStateAction<MobileSection | null>>;
  setCurrentView: (view: AppView) => void;
  openItem: (item: MenuItem) => void;
  menus: MenuMap;
  overdueCount: number;
  signOut: () => void;
}) {
  const toggleSection = (section: MobileSection) => setMobileSection(current => current === section ? null : section);
  const moreMenus: Array<{ key: keyof Pick<MenuMap, 'management' | 'records'>; label: string }> = [
    { key: 'management', label: 'Gestão' },
    { key: 'records', label: 'Cadastros' },
  ];

  const sheetTitle = mobileSection === 'more'
    ? 'Mais opções'
    : mobileSection === 'finance'
    ? 'Lançamentos'
    : mobileSection === 'agenda'
      ? 'Financeiro'
        : mobileSection === 'treasury'
          ? 'Tesouraria'
          : '';

  return (
    <>
      {mobileSection && (
        <>
          <button type="button" aria-label="Fechar menu" onClick={() => setMobileSection(null)} className="fixed inset-0 z-[60] bg-black/20 lg:hidden" />
          <div className="fixed inset-x-3 bottom-[4.5rem] z-[70] max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-2xl lg:hidden">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{sheetTitle}</div>
              <button type="button" onClick={() => setMobileSection(null)} className="rounded-lg px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-muted">Fechar</button>
            </div>
            {mobileSection === 'more' ? (
              <>
                {moreMenus.map(group => (
                  <div key={group.key} className="mb-3 last:mb-0">
                    <div className="px-1 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</div>
                    {menus[group.key].map(item => <MobileMenuItem key={item.label} item={item} currentView={currentView} openItem={openItem} />)}
                  </div>
                ))}
                <div className="mt-2 border-t border-border pt-2">
                  <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-500/10"><LogOut className="h-4 w-4" />Sair</button>
                </div>
              </>
            ) : (
              menus[mobileSection].map(item => <MobileMenuItem key={item.label} item={item} currentView={currentView} openItem={openItem} />)
            )}
          </div>
        </>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-[65] border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-xl lg:hidden" aria-label="Navegação principal">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between">
          <MobileNavItem icon={LayoutDashboard} label="Início" active={currentView === 'dashboard'} onClick={() => { setMobileSection(null); setCurrentView('dashboard'); }} />
          <MobileNavItem icon={WalletCards} label="Lançamentos" active={mobileSection === 'finance'} onClick={() => toggleSection('finance')} />
          <MobileNavItem icon={CalendarClock} label="Financeiro" badge={overdueCount || undefined} active={mobileSection === 'agenda' || currentView === 'agendaPayable' || currentView === 'agendaReceivable' || currentView === 'planning'} onClick={() => toggleSection('agenda')} />
          <MobileNavItem icon={Landmark} label="Tesouraria" active={mobileSection === 'treasury' || ['accounts', 'cards', 'invoices'].includes(currentView)} onClick={() => toggleSection('treasury')} />
          <MobileNavItem icon={MoreHorizontal} label="Mais" active={mobileSection === 'more' || ['management', 'records', 'company', 'contacts', 'reports'].includes(currentView)} onClick={() => toggleSection('more')} />
        </div>
      </nav>
    </>
  );
}

function MobileMenuItem({ item, currentView, openItem }: { key?: React.Key; item: MenuItem; currentView: AppView; openItem: (item: MenuItem) => void }) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={() => openItem(item)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${item.view === currentView ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-primary"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">{item.label}</span>
      {item.badge && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-700 dark:text-amber-400">{item.badge}</span>}
    </button>
  );
}

function MobileNavItem({ icon: Icon, label, active, onClick, badge }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button type="button" onClick={onClick} className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
      <span className="relative"><Icon className="h-5 w-5" />{badge ? <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-black text-white">{badge}</span> : null}</span>
      <span className="max-w-full truncate text-[9px] font-bold">{label}</span>
    </button>
  );
}

function MenuButton({ label, icon: Icon, active, onClick, compact, badge }: { label: string; icon?: React.ComponentType<{ className?: string }>; active: boolean; onClick: () => void; compact?: boolean; badge?: number }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={active} className={`flex max-w-[220px] items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${active ? 'bg-primary/10 text-primary' : 'hover:bg-muted'} ${compact ? 'border border-border bg-background' : ''}`}>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="truncate">{label}</span>
      {badge ? <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-black text-white">{badge}</span> : null}
      <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${active ? 'rotate-180' : ''}`} />
    </button>
  );
}

function DropdownPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`absolute top-[calc(100%+0.5rem)] rounded-2xl border border-border bg-card p-2 shadow-2xl animate-in fade-in slide-in-from-top-1 ${className}`}>{children}</div>;
}
