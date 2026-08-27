import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  Building2,
  ChevronDown,
  ContactRound,
  CreditCard,
  Home,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Settings,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useAppStore, AppView, TransactionPreset } from '../store/useAppStore';
import { useOrganizationStore } from '../store/useOrganizationStore';
import { useAuthStore } from '../store/useAuthStore';
import { useDataStore } from '../store/useDataStore';
import { formatCurrency } from '../utils/formatters';

type MenuKey = 'agenda' | 'treasury' | 'management' | 'records' | 'new' | 'user';

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
  action?: 'categories';
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  alertCount?: number;
}

export function TopNavigation() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentView, setCurrentView, setTransactionModalOpen, setEditingTransactionId, setTransactionPreset, setActiveContextCardId } = useAppStore();
  const { organizations, currentOrganization, switchOrganization } = useOrganizationStore();
  const signOut = useAuthStore(state => state.signOut);
  const transactions = useDataStore(state => state.transactions);
  const canEdit = currentOrganization && !['consulta', 'visualizador', 'membro'].includes(currentOrganization.role);
  const organizationName = currentOrganization?.tradeName || currentOrganization?.name || 'Minha empresa';

  const notificationCutoff = new Date();
  notificationCutoff.setHours(23, 59, 59, 999);
  notificationCutoff.setDate(notificationCutoff.getDate() + 1);
  const isFinancialTitle = (transaction: typeof transactions[number]) => (
    (transaction.type === 'despesa' || transaction.type === 'receita') &&
    transaction.nature !== 'transferencia' &&
    transaction.nature !== 'pagamento_fatura'
  );
  const financialAlertCount = transactions.filter(transaction => (
    isFinancialTitle(transaction) &&
    !transaction.isPaid &&
    new Date(transaction.dueDate || transaction.date) <= notificationCutoff
  )).length;
  const payableAlertCount = transactions.filter(transaction => (
    isFinancialTitle(transaction) &&
    transaction.type === 'despesa' &&
    !transaction.isPaid &&
    new Date(transaction.dueDate || transaction.date) <= notificationCutoff
  )).length;
  const receivableAlertCount = transactions.filter(transaction => (
    isFinancialTitle(transaction) &&
    transaction.type === 'receita' &&
    !transaction.isPaid &&
    new Date(transaction.dueDate || transaction.date) <= notificationCutoff
  )).length;
  const payableTotal = transactions
    .filter(t => isFinancialTitle(t) && !t.isPaid && t.type === 'despesa')
    .reduce((sum, item) => sum + item.amount, 0);
  const receivableTotal = transactions
    .filter(t => isFinancialTitle(t) && !t.isPaid && t.type === 'receita')
    .reduce((sum, item) => sum + item.amount, 0);

  const menus = useMemo<Record<'finance' | 'agenda' | 'treasury' | 'management' | 'records', MenuItem[]>>(() => ({
    finance: [
      { label: 'Nova receita', preset: 'income', icon: TrendingUp },
      { label: 'Nova despesa', preset: 'expense', icon: TrendingDown },
      { label: 'Transferência', preset: 'transfer', icon: Landmark },
    ],
    agenda: [
      { label: 'Contas a pagar', view: 'agendaPayable', icon: TrendingDown, badge: payableTotal ? formatCurrency(payableTotal) : undefined, alertCount: payableAlertCount },
      { label: 'Contas a receber', view: 'agendaReceivable', icon: TrendingUp, badge: receivableTotal ? formatCurrency(receivableTotal) : undefined, alertCount: receivableAlertCount },
      { label: 'Lançamentos', view: 'transactions', icon: WalletCards },
    ],
    treasury: [
      { label: 'Contas e caixa', view: 'accounts', icon: Landmark },
      { label: 'Cartões', view: 'cards', icon: CreditCard },
      { label: 'Faturas', view: 'invoices', icon: ReceiptText },
    ],
    management: [
      { label: 'Relatórios', view: 'reports', icon: BarChart3 },
      { label: 'Auditoria', view: 'audit', icon: ClipboardList },
    ],
    records: [
      { label: 'Clientes e fornecedores', view: 'contacts', icon: ContactRound },
      { label: 'Categorias', view: 'categories', icon: Settings },
      { label: 'Usuários e empresa', view: 'company', icon: Users },
    ],
  }), [financialAlertCount, payableAlertCount, payableTotal, receivableAlertCount, receivableTotal]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
        setMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setMobileMenuOpen(false);
      }
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
    setMobileMenuOpen(false);
  }, [currentView]);

  const toggle = (key: MenuKey) => setOpenMenu(current => current === key ? null : key);

  const openItem = (item: MenuItem) => {
    if (item.view) setCurrentView(item.view);
    if (item.preset && canEdit) {
      if (currentView === 'cardDetails') setCurrentView('transactions');
      setActiveContextCardId(null);
      setEditingTransactionId(null);
      setTransactionPreset(item.preset);
      setTransactionModalOpen(true);
    }
    setOpenMenu(null);
    setMobileMenuOpen(false);
  };

  const openQuickCreate = () => {
    if (!canEdit) return;
    if (currentView === 'cardDetails') setCurrentView('transactions');
    // O + global nunca herda o cartão aberto. O lançamento do cartão é feito
    // somente pelo formulário contextual da tela de detalhes do cartão.
    setActiveContextCardId(null);
    setEditingTransactionId(null);
    setTransactionPreset('expense');
    setTransactionModalOpen(true);
    setOpenMenu(null);
    setMobileMenuOpen(false);
  };

  const mobileMenuGroups: Array<{ label: string; items: MenuItem[] }> = [
    { label: 'Financeiro', items: menus.agenda },
    { label: 'Contas', items: menus.treasury },
    { label: 'Gestão', items: menus.management },
    { label: 'Cadastros', items: menus.records },
  ];

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
            {item.alertCount ? <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">{item.alertCount}</span> : null}
            {item.badge && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-700 dark:text-amber-400">{item.badge}</span>}
          </button>
        );
      })}
    </DropdownPanel>
  );

  return (
    <div ref={rootRef} className="relative z-[80] border-b border-border bg-card/95 shadow-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-3 lg:px-5">
        <button type="button" onClick={() => setCurrentView('dashboard')} className="mr-1 flex shrink-0 items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-muted">
          <img src="/icone-financas-pwa.svg?v=2" alt="FinWill" className="h-9 w-9" />
          <div className="hidden text-left sm:block">
            <div className="text-sm font-black leading-none tracking-tight">FinWill</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Business</div>
          </div>
        </button>

        <div className="min-w-0 flex-1 px-2 text-center lg:hidden" aria-label={`Empresa ativa: ${organizationName}`}>
          <span className="block truncate text-xs font-bold text-foreground">{organizationName}</span>
        </div>

        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex">
          <button type="button" aria-label="Visão geral" onClick={() => setCurrentView('dashboard')} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${currentView === 'dashboard' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}><Home className="h-4 w-4" />Visão geral</button>
          <div className="relative"><MenuButton label="Financeiro" active={openMenu === 'agenda'} onClick={() => toggle('agenda')} badge={financialAlertCount || undefined} />{openMenu === 'agenda' && renderDropdown('agenda', true)}</div>
          <div className="relative"><MenuButton label="Contas" active={openMenu === 'treasury'} onClick={() => toggle('treasury')} />{openMenu === 'treasury' && renderDropdown('treasury')}</div>
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
                  {menus.finance.map(item => {
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
                {organizations.length > 1 && (
                  <>
                    <div className="my-2 border-t border-border" />
                    <div className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Trocar empresa</div>
                    {organizations.map(organization => (
                      <button
                        key={organization.id}
                        type="button"
                        onClick={async () => { await switchOrganization(organization.id); setOpenMenu(null); }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${organization.id === currentOrganization?.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                      >
                        <Building2 className="h-4 w-4" />
                        <span className="min-w-0 flex-1 truncate">{organization.tradeName || organization.name}</span>
                        <span className="text-[9px] uppercase text-muted-foreground">{organization.id === currentOrganization?.id ? 'Ativa' : 'Abrir'}</span>
                      </button>
                    ))}
                  </>
                )}
                <div className="my-2 border-t border-border" />
                <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-500/10"><LogOut className="h-4 w-4" />Sair</button>
              </DropdownPanel>
            )}
          </div>

          <button type="button" onClick={() => setMobileMenuOpen(open => !open)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background lg:hidden" aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

        </div>
      </div>

      {mobileMenuOpen && <MobileMenuPanel currentView={currentView} groups={mobileMenuGroups} openItem={openItem} signOut={signOut} onClose={() => setMobileMenuOpen(false)} />}

      <MobileBottomNavigation
        currentView={currentView}
        setCurrentView={setCurrentView}
        onNew={openQuickCreate}
      />
    </div>
  );
}

function MobileMenuPanel({
  currentView,
  groups,
  openItem,
  signOut,
  onClose,
}: {
  currentView: AppView;
  groups: Array<{ label: string; items: MenuItem[] }>;
  openItem: (item: MenuItem) => void;
  signOut: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button type="button" aria-label="Fechar menu" onClick={onClose} className="fixed inset-x-0 bottom-0 top-16 z-[90] bg-black/25 lg:hidden" />
      <div className="absolute inset-x-0 top-full z-[100] h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-border bg-card p-2 shadow-2xl animate-in fade-in-0 slide-in-from-top-2 duration-200 ease-out lg:hidden">
        <div className="mx-auto max-w-md">
          {groups.map(group => (
            <div key={group.label} className="mb-2 rounded-xl border border-border p-1 last:mb-0">
              <div className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{group.label}</div>
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.label} type="button" onClick={() => openItem(item)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors ${item.view === currentView ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-primary"><Icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {item.alertCount ? <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">{item.alertCount}</span> : null}
                    {item.badge && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-700 dark:text-amber-400">{item.badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          <button type="button" onClick={signOut} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-red-500/20 px-2.5 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-500/10"><LogOut className="h-4 w-4" />Sair</button>
        </div>
      </div>
    </>
  );
}

function MobileBottomNavigation({ currentView, setCurrentView, onNew }: { currentView: AppView; setCurrentView: (view: AppView) => void; onNew: () => void }) {
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-[65] border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-xl" aria-label="Navegação principal">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-1">
          <MobileNavItem icon={LayoutDashboard} label="Início" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <MobileNavItem icon={TrendingUp} label="Receber" active={currentView === 'agendaReceivable'} onClick={() => setCurrentView('agendaReceivable')} />
          <MobileNavItem icon={TrendingDown} label="Pagar" active={currentView === 'agendaPayable'} onClick={() => setCurrentView('agendaPayable')} />
          <MobileNavItem icon={ReceiptText} label="Faturas" active={currentView === 'invoices'} onClick={() => setCurrentView('invoices')} />
          <MobileNavItem icon={BarChart3} label="Relatórios" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} />
        </div>
      </nav>
      <button type="button" onClick={onNew} aria-label="Novo lançamento" className="fixed bottom-[4.75rem] right-4 z-[75] flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 lg:hidden">
        <Plus className="h-5 w-5" />
      </button>
    </>
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
