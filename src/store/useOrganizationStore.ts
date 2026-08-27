import { create } from 'zustand';
import { Organization, OrganizationMember } from '../db/db';
import { api } from '../services/api';
import { useDataStore } from './useDataStore';

interface OrganizationState {
  organizations: Organization[];
  currentOrganization: Organization | null;
  members: OrganizationMember[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshMembers: () => Promise<void>;
  clear: () => void;
}

export const useOrganizationStore = create<OrganizationState>((set, get) => ({
  organizations: [],
  currentOrganization: null,
  members: [],
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const organizations = await api.organizations.list();
      const currentOrganization = organizations.find(item => item.isDefault) || organizations[0] || null;
      const members = currentOrganization ? await api.organizations.members() : [];
      set({ organizations, currentOrganization, members, isLoading: false });
    } catch (error: any) {
      set({ error: error?.message || 'Não foi possível carregar a empresa.', isLoading: false });
      throw error;
    }
  },

  switchOrganization: async (organizationId: string) => {
    if (get().currentOrganization?.id === organizationId) return;
    set({ isLoading: true, error: null });
    try {
      await api.organizations.switch(organizationId);
      useDataStore.getState().clearData();
      await get().load();
      await useDataStore.getState().fetchData();
    } catch (error: any) {
      set({ error: error?.message || 'Não foi possível trocar de empresa.', isLoading: false });
      throw error;
    }
  },

  refreshMembers: async () => {
    const members = await api.organizations.members();
    set({ members });
  },

  clear: () => set({ organizations: [], currentOrganization: null, members: [], error: null, isLoading: false }),
}));
