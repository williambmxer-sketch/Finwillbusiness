/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/useAuthStore';
import { useAppStore } from './store/useAppStore';
import { useDataStore } from './store/useDataStore';
import { AuthView } from './components/views/AuthView';
import { Home, CreditCard, Receipt, Wallet, PieChart, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { seedDB } from './db/db';
import { DashboardView } from './components/views/DashboardView';
import { TransactionsView } from './components/views/TransactionsView';
import { CardsView } from './components/views/CardsView';
import { InvoicesView } from './components/views/InvoicesView';
import { ReportsView } from './components/views/ReportsView';
import { AccountsView } from './components/views/AccountsView';
import { AccountDetailsView } from './components/views/AccountDetailsView';
import { CardDetailsView } from './components/views/CardDetailsView';
import { TransactionModal } from './components/TransactionModal';
import { CardModal } from './components/CardModal';
import { CategoryModal } from './components/CategoryModal';
import { AccountModal } from './components/AccountModal';
import { ConfirmPaymentModal } from './components/ConfirmPaymentModal';
import { ConfirmationModal } from './components/ConfirmationModal';

export default function App() {
  const { currentView, setCurrentView, setTransactionModalOpen, setEditingTransactionId, activeContextCardId, setDefaultPaymentMethod } = useAppStore();
  const { session, setSession, isLoading } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  useEffect(() => {
    if (session) {
      useDataStore.getState().fetchData();
      const cleanup = useDataStore.getState().setupSubscriptions();

      // Corrigir a transação do almoço que ficou com isPaid=true devido ao bug anterior
      supabase.from('transacoes')
        .update({ esta_pago: false, data_pagamento: null })
        .eq('id', 'ece992ac-a2a1-4f46-8ccd-65274cbd512d')
        .then(() => {
          useDataStore.getState().fetchData();
        });

      return () => cleanup();
    }
  }, [session]);

  useEffect(() => {
    async function init() {
      // Supabase is our source of truth now, no local mock DB seed.
      setIsReady(true);
    }
    init();
  }, []);

  if (isLoading || !isReady) {
    return (
      <div className="flex bg-background h-screen w-screen items-center justify-center">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <Wallet className="h-12 w-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'transactions':
        return <TransactionsView />;
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
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden">

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden touch-pan-y relative mt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full pb-[120px]"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Action Button (FAB) */}
      {currentView !== 'invoices' && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 pointer-events-none flex justify-end px-4">
          <button
            onClick={() => {
              if (currentView === 'cardDetails' && activeContextCardId) {
                setDefaultPaymentMethod(`card-${activeContextCardId}`);
              } else {
                setDefaultPaymentMethod(null);
              }
              setEditingTransactionId(null);
              setTransactionModalOpen(true);
            }}
            className="pointer-events-auto bg-primary text-primary-foreground h-12 w-12 rounded-[11px] flex items-center justify-center shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-95 transition-all"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full h-16 bg-background/95 backdrop-blur-xl border-t border-border z-40 px-4 safe-area-bottom shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between h-full max-w-md mx-auto">
          <NavItem icon={Home} label="Início" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon={Wallet} label="Transações" active={currentView === 'transactions'} onClick={() => setCurrentView('transactions')} />
          <NavItem icon={CreditCard} label="Cartões" active={currentView === 'cards'} onClick={() => setCurrentView('cards')} />
          <NavItem icon={Receipt} label="Faturas" active={currentView === 'invoices'} onClick={() => setCurrentView('invoices')} />
          <NavItem icon={PieChart} label="Relatórios" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} />
        </div>
      </nav>

      <TransactionModal />
      <CardModal />
      <CategoryModal />
      <AccountModal />
      <ConfirmPaymentModal />
      <ConfirmationModal />
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 w-12 transition-colors ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <div className="relative">
        <Icon className="h-5 w-5" />
        {active && (
          <motion.div
            layoutId="nav-indicator"
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
          />
        )}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">{label}</span>
    </button>
  );
}

