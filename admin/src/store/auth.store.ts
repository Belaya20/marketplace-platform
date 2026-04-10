'use client';
// src/store/auth.store.ts
// SSR-safe: no sessionStorage access at module load time.
// Uses zustand persist with a lazy storage getter.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AdminUser {
  id:         string;
  email:      string;
  first_name: string;
  last_name:  string;
  role:       'admin';
}

interface AuthState {
  user:       AdminUser | null;
  token:      string | null;
  isLoading:  boolean;
  setAuth:    (user: AdminUser, token: string) => void;
  clearAuth:  () => void;
  setLoading: (v: boolean) => void;
}

// SSR-safe storage — only accessed when window is available
const safeStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    try {
      const item = sessionStorage.getItem(name);
      return item ? JSON.parse(item) : null;
    } catch { return null; }
  },
  setItem: (name: string, value: any): void => {
    if (typeof window === 'undefined') return;
    try { sessionStorage.setItem(name, JSON.stringify(value)); } catch { /* ignore */ }
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;
    try { sessionStorage.removeItem(name); } catch { /* ignore */ }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:      null,
      token:     null,
      isLoading: true,

      setAuth: (user, token) => {
        // Set cookie for middleware edge validation
        if (typeof document !== 'undefined') {
          document.cookie = `admin_token=${token}; path=/; SameSite=Strict; max-age=86400`;
        }
        set({ user, token, isLoading: false });
      },

      clearAuth: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'admin_token=; path=/; max-age=0';
        }
        set({ user: null, token: null, isLoading: false });
      },

      setLoading: (v) => set({ isLoading: v }),
    }),
    {
      name:    'admin-auth',
      storage: safeStorage,
      // Only persist user + token
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        // Called after rehydration — set isLoading to false
        if (state) state.setLoading(false);
      },
    }
  )
);