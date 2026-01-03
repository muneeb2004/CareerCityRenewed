import { create } from 'zustand';
import { Organization } from '../../types';
import { getAllOrganizations } from '../../actions/organizations';

interface OrganizationState {
  organizations: Organization[];
  lastFetched: number | null;
  fetchOrganizations: (force?: boolean) => Promise<void>;
}

export const useOrganizationStore = create<OrganizationState>((set, get) => ({
  organizations: [],
  lastFetched: null,
  fetchOrganizations: async (force = false) => {
    const now = Date.now();
    const state = get();
    
    // Cache for 5 minutes unless forced
    if (!force && state.lastFetched && now - state.lastFetched < 5 * 60 * 1000 && state.organizations.length > 0) {
      return;
    }

    try {
      const data = await getAllOrganizations();
      set({ organizations: data as unknown as Organization[], lastFetched: now });
    } catch (error) {
      console.error('Failed to fetch organizations store:', error);
      throw error;
    }
  },
}));
