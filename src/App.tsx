/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/useAuthStore';
import { useAppStore } from './store/useAppStore';
import { useDataStore } from './store/useDataStore';
import { useOrganizationStore } from './store/useOrganizationStore';
import { AuthView } from './components/views/AuthView';
import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { DashboardView } from './components/views/DashboardView';
import { CardsView } from './components/views/CardsView';
import { AccountsView } from './components/views/AccountsView';
import { AccountDetailsView } from './components/views/AccountDetailsView';
import { CardDetailsView } from './components/views/CardDetailsView';
import { TransactionModal } from './components/TransactionModal';
import { CardModal } from './components/CardModal';
import { CategoryModal } from './components/CategoryModal';
import { AccountModal } from './components/AccountModal';
import { ConfirmPaymentModal } from './components/ConfirmPaymentModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { TopNavigation } from './components/TopNavigation';
import { AgendaView } from './components/views/AgendaView';
import { ContactsView } from './components/views/ContactsView';
import { PartnersView } from './components/views/PartnersView';
import { CompanyView } from './components/views/CompanyView';
import { api } from './services/api';

const TransactionsView = React.lazy(() => import('./components/views/TransactionsView').then(module => ({ default: module.TransactionsView })));
const InvoicesView = React.lazy(() => import('./components/views/InvoicesView').then(module => ({ default: module.InvoicesView })));
const ReportsView = React.lazy(() => import('./components/views/ReportsView').then(module => ({ default: module.ReportsView })));
const AuditView = React.lazy(() => import('./components/views/AuditView').then(module => ({ default: module.AuditView })));

export default function App() {
  const { currentView } = useAppStore();
  const { session, setSession, isLoading } = useAuthStore();
  const { hasLoaded: hasLoadedData, isLoading: isLoadingData, error: dataError, fetchData, clearData } = useDataStore();
  const { load: loadOrganization, clear: clearOrganization, isLoading: isLoadingOrganization } = useOrganizationStore();
  const [isReady, setIsReady] = useState(false);
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({ immediate: true });
  const [isUpdating, setIsUpdating] = useState(false);
  const updateReloadTimer = useRef<number | null>(null);
  const initializedUserIdRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (updateReloadTimer.current !== null) {
      window.clearTimeout(updateReloadTimer.current);
    }
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    // Esconde o aviso imediatamente. Se o evento `controlling` do Workbox
    // não chegar, a recarga de segurança evita deixar o modal travado.
    setNeedRefresh(false);

    const reloadPage = () => {
      if (updateReloadTimer.current !== null) {
        window.clearTimeout(updateReloadTimer.current);
        updateReloadTimer.current = null;
      }
      window.location.reload();
    };

    // O Workbox normalmente faz isso por updateServiceWorker(), mas o envio
    // direto cobre browsers que mantêm o worker novo em `waiting` após um
    // refresh forçado.
    updateReloadTimer.current = window.setTimeout(reloadPage, 3000);

    try {
      await updateServiceWorker(true);
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (error) {
      if (updateReloadTimer.current !== null) {
        window.clearTimeout(updateReloadTimer.current);
        updateReloadTimer.current = null;
      }
      setIsUpdating(false);
      console.error('Não foi possível aplicar a atualização do sistema.', error);
    }
  };

  useEffect(() => {
    let validatingInitialSession = true;
    let cancelled = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (validatingInitialSession && event === 'INITIAL_SESSION') return;
      setSession(session);
    });

    (async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessionError || !session) {
        validatingInitialSession = false;
        setSession(null);
        return;
      }

      // getSession() pode devolver um token antigo do armazenamento local. A
      // validação no servidor impede abrir a empresa com um usuário já removido.
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (cancelled) return;

      validatingInitialSession = false;
      if (userError || !user) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        return;
      }

      setSession({ ...session, user });
    })().catch(error => {
      if (!cancelled) {
        validatingInitialSession = false;
        console.error('Não foi possível validar a sessão.', error);
        setSession(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setSession]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    if (session) {
      const userId = session.user.id;
      if (initializedUserIdRef.current === userId) return;
      initializedUserIdRef.current = userId;

      (async () => {
        await loadOrganization();
        if (cancelled) return;
        try {
          await api.withdrawals.generateDue();
        } catch (error) {
          console.warn('Não foi possível gerar o pró-labore recorrente.', error);
        }
        await fetchData();
        if (!cancelled) cleanup = useDataStore.getState().setupSubscriptions();
      })().catch(error => {
        if (initializedUserIdRef.current === userId) initializedUserIdRef.current = null;
        console.error('Falha na inicialização da empresa.', error);
      });

      return () => {
        cancelled = true;
        cleanup?.();
      };
    }

    initializedUserIdRef.current = null;
    clearOrganization();
    clearData();
    return () => { cancelled = true; cleanup?.(); };
  }, [session, fetchData, clearData, loadOrganization, clearOrganization]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let intervalId: number | null = null;
    let cancelled = false;

    navigator.serviceWorker.ready.then(registration => {
      if (cancelled) return;
      registration.update();
      intervalId = window.setInterval(() => registration.update(), 60_000);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    async function init() {
      // Supabase is our source of truth now, no local mock DB seed.
      setIsReady(true);
    }
    init();
  }, []);

  if (isLoading || !isReady || (session && (isLoadingOrganization || (isLoadingData && !hasLoadedData)))) {
    return (
      <div className="flex bg-background h-screen w-screen items-center justify-center">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <img src="/icone-financas-pwa.svg?v=2" alt="FinWill" className="h-14 w-14 object-contain" />
        </motion.div>
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  if (dataError && !hasLoadedData) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <img src="/icone-financas-pwa.svg?v=2" alt="FinWill" className="h-12 w-12 object-contain" />
        <div>
          <h1 className="text-base font-bold">Não foi possível carregar seus dados</h1>
          <p className="mt-1 text-xs text-muted-foreground">Verifique sua conexão e tente novamente.</p>
        </div>
        <button
          onClick={() => fetchData()}
          className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'transactions':
        return <TransactionsView />;
      case 'agendaPayable':
        return <AgendaView mode="payable" />;
      case 'agendaReceivable':
        return <AgendaView mode="receivable" />;
      case 'cards':
        return <CardsView />;
      case 'invoices':
        return <InvoicesView />;
      case 'accounts':
        return <AccountsView />;
      case 'accountDetails':
        return <AccountDetailsView />;
      case 'cardDetails':
        return <CardDetailsView />;
      case 'reports':
        return <ReportsView />;
      case 'audit':
        return <AuditView />;
      case 'contacts':
        return <ContactsView />;
      case 'partners':
        return <PartnersView />;
      case 'categories':
        return <CategoryModal />;
      case 'company':
        return <CompanyView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden">

      <TopNavigation />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden touch-pan-y relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full pb-24 lg:pb-16"
          >
            <React.Suspense fallback={<div className="flex min-h-[45vh] items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-primary" /></div>}>
              {renderView()}
            </React.Suspense>
          </motion.div>
        </AnimatePresence>
      </div>

      <TransactionModal />
      <CardModal />
      <AccountModal />
      <ConfirmPaymentModal />
      <ConfirmationModal />
      <AnimatePresence>
        {needRefresh && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/35 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-available-title"
          >
            <motion.div
              className="w-full max-w-sm rounded-[20px] border border-border bg-card p-5 shadow-2xl"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id="update-available-title" className="text-sm font-bold">Nova versão disponível</h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Atualize para carregar as melhorias mais recentes do sistema.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNeedRefresh(false)}
                  disabled={isUpdating}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Fechar aviso de atualização"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setNeedRefresh(false)}
                  disabled={isUpdating}
                  className="flex-1 rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Depois
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70"
                >
                  {isUpdating ? 'Atualizando...' : 'Atualizar agora'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
