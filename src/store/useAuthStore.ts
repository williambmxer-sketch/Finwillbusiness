import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true, // Começa carregando até verificar a sessão
  setSession: (session) => set((state) => {
    // getSession() e o evento INITIAL_SESSION podem entregar a mesma sessão
    // em momentos diferentes. Evitamos disparar o carregamento dos dados duas
    // vezes nessa corrida inicial.
    if (
      state.session?.access_token === session?.access_token &&
      state.session?.user.id === session?.user.id &&
      state.isLoading === false
    ) {
      return state;
    }
    return { session, user: session?.user || null, isLoading: false };
  }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  }
}));
