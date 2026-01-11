'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

// Inactivity timeout: 30 minutes
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'staff' | 'volunteer';
  email?: string;
  type?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      // Don't fetch on login page to avoid race conditions or unnecessary 401s
      if (pathname?.startsWith('/staff/login')) {
        setIsLoading(false);
        return;
      }

      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      setUser(null);
      // 401 is handled by interceptor, but we catch here to stop loading state
    } finally {
      setIsLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (data: any) => {
     // This function is mostly a placeholder if you want to centralize login logic.
     // Currently, the Login page handles the API call and redirect.
     // But updating the user state immediately is good practice.
     await fetchUser();
  };

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
      router.push('/staff/login');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout failed', error);
      // Even if API fails, clear local state and redirect
      setUser(null);
      router.push('/staff/login');
    }
  }, [router]);

  const refreshUser = async () => {
    await fetchUser();
  };

  // Inactivity timeout - auto logout after 30 minutes of no activity
  useEffect(() => {
    // Only track inactivity when user is logged in
    if (!user) return;

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        toast.error('Session expired due to inactivity');
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    // Activity events to track
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    // Throttle the reset to avoid excessive timer resets
    let lastActivity = Date.now();
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastActivity > 1000) { // Only reset if more than 1 second since last reset
        lastActivity = now;
        resetInactivityTimer();
      }
    };

    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, throttledReset, { passive: true });
    });

    // Start the timer
    resetInactivityTimer();

    // Cleanup
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledReset);
      });
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
