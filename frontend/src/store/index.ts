'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Cart, Notification } from '@/types';

// ── AUTH STORE ────────────────────────────────────────────────────────────────

interface AuthState {
  user:         User | null;
  accessToken:  string | null;
  refreshToken: string | null;
  // isLoading=true until Zustand has rehydrated from localStorage.
  // Components must wait for isLoading=false before making auth decisions.
  isLoading:    boolean;

  setAuth:    (user: User, at: string, rt: string) => void;
  clearAuth:  () => void;
  setUser:    (u: User) => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    true, // true until onRehydrateStorage fires

      setAuth: (user, accessToken, refreshToken) => {
        // Set thin cookies for Edge middleware (Next.js middleware cannot read
        // localStorage — it needs cookies for route protection at the edge).
        // max-age=900 matches the 15-minute JWT access token lifetime.
        // The token itself is the access_token (not the full JWT for security).
        if (typeof document !== 'undefined') {
          document.cookie = `auth_token=${accessToken}; path=/; max-age=900; SameSite=Lax`;
          document.cookie = `auth_role=${user.role}; path=/; max-age=900; SameSite=Lax`;
        }
        set({ user, accessToken, refreshToken, isLoading: false });
      },

      clearAuth: () => {
        // Expire both cookies immediately
        if (typeof document !== 'undefined') {
          document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
          document.cookie = 'auth_role=; path=/; max-age=0; SameSite=Lax';
        }
        set({ user: null, accessToken: null, refreshToken: null, isLoading: false });
      },

      setUser:    (user)      => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      // Use default localStorage storage
      storage: createJSONStorage(() => localStorage),
      // Only persist the auth payload — never persist isLoading
      partialize: (s) => ({
        user:         s.user,
        accessToken:  s.accessToken,
        refreshToken: s.refreshToken,
      }),
      // Called after Zustand has loaded state from localStorage.
      // Set isLoading=false so components know hydration is complete.
      onRehydrateStorage: () => (state) => {
        if (state) state.setLoading(false);
      },
    }
  )
);

// ── CART STORE ────────────────────────────────────────────────────────────────

interface CartState {
  cart:       Cart | null;
  isOpen:     boolean;
  setCart:    (c: Cart) => void;
  clearCart:  () => void;
  openCart:   () => void;
  closeCart:  () => void;
  toggleCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart:       null,
  isOpen:     false,
  setCart:    (cart)  => set({ cart }),
  clearCart:  ()      => set({ cart: null }),
  openCart:   ()      => set({ isOpen: true }),
  closeCart:  ()      => set({ isOpen: false }),
  toggleCart: ()      => set({ isOpen: !get().isOpen }),
}));

// ── NOTIFICATION STORE ────────────────────────────────────────────────────────

interface NotifState {
  notifications:    Notification[];
  unreadCount:      number;
  setNotifications: (n: Notification[]) => void;
  addNotification:  (n: Notification)   => void;
  markRead:         (id: string)        => void;
  markAllRead:      ()                  => void;
}

export const useNotificationStore = create<NotifState>((set, get) => ({
  notifications: [],
  unreadCount:   0,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter(n => !n.is_read).length,
    }),

  addNotification: (n) => {
    const all = [n, ...get().notifications];
    set({ notifications: all, unreadCount: all.filter(x => !x.is_read).length });
  },

  markRead: (id) => {
    const notifications = get().notifications.map(n =>
      n.id === id ? { ...n, is_read: true } : n
    );
    set({ notifications, unreadCount: notifications.filter(n => !n.is_read).length });
  },

  markAllRead: () =>
    set({
      notifications: get().notifications.map(n => ({ ...n, is_read: true })),
      unreadCount:   0,
    }),
}));

// ── UI STORE ──────────────────────────────────────────────────────────────────

interface UiState {
  mobileNavOpen:  boolean;
  openMobileNav:  () => void;
  closeMobileNav: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen:  false,
  openMobileNav:  () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
}));