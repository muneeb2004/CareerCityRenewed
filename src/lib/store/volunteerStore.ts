import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface VolunteerSession {
  volunteerId: string;
  volunteerName: string;
  role: 'Captain' | 'Member';
}

export interface VolunteerStats {
  totalStudentFeedback: number;
  totalOrgFeedback: number;
}

interface VolunteerState {
  // Session data
  session: VolunteerSession | null;
  isLoggedIn: boolean;
  
  // Stats (cached, refreshed on demand)
  stats: VolunteerStats | null;
  statsLastFetched: number | null;
  
  // Actions
  login: (session: VolunteerSession) => void;
  logout: () => void;
  setStats: (stats: VolunteerStats) => void;
  clearStats: () => void;
}

export const useVolunteerStore = create<VolunteerState>()(
  persist(
    (set) => ({
      // Initial state
      session: null,
      isLoggedIn: false,
      stats: null,
      statsLastFetched: null,
      
      // Login action - stores volunteer session
      login: (session: VolunteerSession) => {
        set({
          session,
          isLoggedIn: true,
          stats: null, // Clear old stats on new login
          statsLastFetched: null,
        });
      },
      
      // Logout action - clears everything
      logout: () => {
        set({
          session: null,
          isLoggedIn: false,
          stats: null,
          statsLastFetched: null,
        });
      },
      
      // Update stats
      setStats: (stats: VolunteerStats) => {
        set({
          stats,
          statsLastFetched: Date.now(),
        });
      },
      
      // Clear stats (forces refresh on next fetch)
      clearStats: () => {
        set({
          stats: null,
          statsLastFetched: null,
        });
      },
    }),
    {
      name: 'volunteer-session', // localStorage key
      partialize: (state) => ({
        // Only persist session data, not stats
        session: state.session,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
);

// Selector hooks for convenience
export const useVolunteerSession = () => useVolunteerStore((state) => state.session);
export const useIsVolunteerLoggedIn = () => useVolunteerStore((state) => state.isLoggedIn);
export const useVolunteerStats = () => useVolunteerStore((state) => state.stats);
