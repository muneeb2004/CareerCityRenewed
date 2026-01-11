'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

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
  login: (data: any) => Promise<void>; // weak type here as login page handles API call directly usually, but we can standardize
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

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

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
      router.push('/staff/login');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout failed', error);
      toast.error('Logout failed');
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

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
