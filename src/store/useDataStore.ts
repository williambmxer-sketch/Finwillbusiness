import { create } from 'zustand';
import { Account, Card, Category, Transaction, CustomPaymentMethod } from '../db/db';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';

interface DataState {
  categories: Category[];
  accounts: Account[];
  cards: Card[];
  transactions: Transaction[];
  customPaymentMethods: CustomPaymentMethod[];
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  setupSubscriptions: () => (() => void);
}

export const useDataStore = create<DataState>((set, get) => ({
  categories: [],
  accounts: [],
  cards: [],
  transactions: [],
  customPaymentMethods: [],
  isLoading: true,
  error: null,

  fetchData: async () => {
    try {
      set({ isLoading: true, error: null });
      const [categories, accounts, cards, transactions, customPaymentMethods] = await Promise.all([
        api.categories.list(),
        api.accounts.list(),
        api.cards.list(),
        api.transactions.list(),
        api.paymentMethods.list()
      ]);
      console.log('[DEBUG fetchData] categories:', JSON.stringify(categories));
      console.log('[DEBUG fetchData] categories.length:', categories.length);
      set({ categories, accounts, cards, transactions, customPaymentMethods, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setupSubscriptions: () => {
    let timeoutId: number | null = null;
    const handleLocalMutation = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        get().fetchData();
        timeoutId = null;
      }, 500);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('db_mutation', handleLocalMutation);
    }

    // Escuta mudanças em qualquer tabela do Supabase para manter a tela sempre atualizada
    const channelName = 'db-changes-' + Math.random().toString(36).substring(7);
    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          handleLocalMutation();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('db_mutation', handleLocalMutation);
      }
    };
  }
}));
