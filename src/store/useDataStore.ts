import { create } from 'zustand';
import { Account, Card, Category, Transaction } from '../db/db';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';

interface DataState {
  categories: Category[];
  accounts: Account[];
  cards: Card[];
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  setupSubscriptions: () => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  categories: [],
  accounts: [],
  cards: [],
  transactions: [],
  isLoading: true,
  error: null,

  fetchData: async () => {
    try {
      set({ isLoading: true, error: null });
      const [categories, accounts, cards, transactions] = await Promise.all([
        api.categories.list(),
        api.accounts.list(),
        api.cards.list(),
        api.transactions.list()
      ]);
      set({ categories, accounts, cards, transactions, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  setupSubscriptions: () => {
    const handleLocalMutation = () => get().fetchData();
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
          // Por simplicidade, ao invés de calcular o delta, recarregamos os dados. 
          // Como o volume de dados costuma ser gerenciável por usuário, é seguro.
          get().fetchData();
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
