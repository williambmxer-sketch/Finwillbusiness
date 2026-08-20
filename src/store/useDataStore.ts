import { create } from 'zustand';
import { Account, Card, Category, Contact, Transaction, CustomPaymentMethod } from '../db/db';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';

interface DataState {
  categories: Category[];
  contacts: Contact[];
  accounts: Account[];
  cards: Card[];
  transactions: Transaction[];
  customPaymentMethods: CustomPaymentMethod[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  clearData: () => void;
  setupSubscriptions: () => (() => void);
}

let fetchVersion = 0;

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

export const useDataStore = create<DataState>((set, get) => ({
  categories: [],
  contacts: [],
  accounts: [],
  cards: [],
  transactions: [],
  customPaymentMethods: [],
  isLoading: true,
  hasLoaded: false,
  error: null,

  fetchData: async () => {
    const requestVersion = ++fetchVersion;
    set({ isLoading: true, error: null });

    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const [categories, contacts, accounts, cards, transactions, customPaymentMethods] = await Promise.all([
          api.categories.list(),
          api.contacts.list(),
          api.accounts.list(),
          api.cards.list(),
          api.transactions.list(),
          api.paymentMethods.list()
        ]);

        // Uma resposta antiga não pode sobrescrever uma consulta mais nova.
        if (requestVersion !== fetchVersion) return;

        set({
          categories,
          contacts,
          accounts,
          cards,
          transactions,
          customPaymentMethods,
          isLoading: false,
          hasLoaded: true,
          error: null
        });
        return;
      } catch (err: any) {
        lastError = err;
        if (attempt < 2) await wait(250 * (attempt + 1));
      }
    }

    if (requestVersion === fetchVersion) {
      set({ error: lastError?.message || 'Não foi possível carregar seus dados.', isLoading: false });
    }
  },

  clearData: () => {
    fetchVersion += 1;
    set({
      categories: [],
      contacts: [],
      accounts: [],
      cards: [],
      transactions: [],
      customPaymentMethods: [],
      isLoading: false,
      hasLoaded: false,
      error: null
    });
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
