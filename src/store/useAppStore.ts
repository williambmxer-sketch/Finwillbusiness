import { create } from 'zustand';

interface AppState {
  currentView: 'dashboard' | 'transactions' | 'cards' | 'invoices' | 'accounts' | 'accountDetails' | 'cardDetails' | 'reports';
  setCurrentView: (view: 'dashboard' | 'transactions' | 'cards' | 'invoices' | 'accounts' | 'accountDetails' | 'cardDetails' | 'reports') => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  confirmPaymentTransactionId: string | null;
  setConfirmPaymentTransactionId: (id: string | null) => void;

  isTransactionModalOpen: boolean;
  setTransactionModalOpen: (open: boolean) => void;
  editingTransactionId: string | null;
  setEditingTransactionId: (id: string | null) => void;
  activeContextCardId: string | null;
  setActiveContextCardId: (id: string | null) => void;
  defaultPaymentMethod: string | null;
  setDefaultPaymentMethod: (id: string | null) => void;

  isCardModalOpen: boolean;
  setCardModalOpen: (open: boolean) => void;
  editingCardId: string | null;
  setEditingCardId: (id: string | null) => void;

  isAccountModalOpen: boolean;
  setAccountModalOpen: (open: boolean) => void;
  editingAccountId: string | null;
  setEditingAccountId: (id: string | null) => void;
  
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;

  isCategoryModalOpen: boolean;
  setCategoryModalOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  isDarkMode: false,
  toggleDarkMode: () => set((state) => {
    const newMode = !state.isDarkMode;
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { isDarkMode: newMode };
  }),

  confirmPaymentTransactionId: null,
  setConfirmPaymentTransactionId: (id) => set({ confirmPaymentTransactionId: id }),

  isTransactionModalOpen: false,
  setTransactionModalOpen: (open) => set({ isTransactionModalOpen: open }),
  editingTransactionId: null,
  setEditingTransactionId: (id) => set({ editingTransactionId: id }),
  activeContextCardId: null,
  setActiveContextCardId: (id) => set({ activeContextCardId: id }),
  defaultPaymentMethod: null,
  setDefaultPaymentMethod: (id) => set({ defaultPaymentMethod: id }),

  isCardModalOpen: false,
  setCardModalOpen: (open) => set({ isCardModalOpen: open }),
  editingCardId: null,
  setEditingCardId: (id) => set({ editingCardId: id }),

  isAccountModalOpen: false,
  setAccountModalOpen: (open) => set({ isAccountModalOpen: open }),
  editingAccountId: null,
  setEditingAccountId: (id) => set({ editingAccountId: id }),
  activeAccountId: null,
  setActiveAccountId: (id) => set({ activeAccountId: id }),

  isCategoryModalOpen: false,
  setCategoryModalOpen: (open) => set({ isCategoryModalOpen: open }),
}));
