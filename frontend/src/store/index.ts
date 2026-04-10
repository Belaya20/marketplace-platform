'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Cart, Notification } from '@/types';

// ── AUTH STORE ───────────────────────────────────────────────────────────────
interface AuthState {
  user:         User | null;
  accessToken:  string | null;
  refreshToken: string | null;
  isLoading:    boolean;
  setAuth:    (user: User, at: string, rt: string) => void;
  clearAuth:  () => void;
  setUser:    (u: User) => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, 
      accessToken: null, 
      refreshToken: null, 
      isLoading: false,

      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', refreshToken);
          
          // Set cookies for middleware route protection
          // Using a template literal for the role to ensure it's a string
          document.cookie = `auth_token=${accessToken}; path=/; max-age=900; SameSite=Lax`;
          document.cookie = `auth_role=${user.role}; path=/; max-age=2592000; SameSite=Lax`;
        }
        set({ user, accessToken, refreshToken });
      },

      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          document.cookie = 'auth_token=; path=/; max-age=0';
          document.cookie = 'auth_role=; path=/; max-age=0';
        }
        set({ user: null, accessToken: null, refreshToken: null });
      },

      // This will now correctly accept the User object including profile_image_url
      setUser: (user) => set({ user }),
      
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage', // Named 'auth-storage' to be more explicit
      partialize: (s) => ({ 
        user: s.user, 
        accessToken: s.accessToken, 
        refreshToken: s.refreshToken 
      }),
    }
  )
);

// ── CART STORE ───────────────────────────────────────────────────────────────
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
  cart: null, 
  isOpen: false,
  setCart:    (cart)  => set({ cart }),
  clearCart:  ()      => set({ cart: null }),
  openCart:   ()      => set({ isOpen: true }),
  closeCart:  ()      => set({ isOpen: false }),
  toggleCart: ()      => set({ isOpen: !get().isOpen }),
}));

// ── NOTIFICATION STORE ───────────────────────────────────────────────────────
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
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter(n => !n.is_read).length }),
  
  addNotification: (n) => {
    const all = [n, ...get().notifications];
    set({ notifications: all, unreadCount: all.filter(x => !x.is_read).length });
  },
  
  markRead: (id) => {
    const notifications = get().notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
    set({ notifications, unreadCount: notifications.filter(n => !n.is_read).length });
  },
  
  markAllRead: () => {
    set({ 
      notifications: get().notifications.map(n => ({ ...n, is_read: true })), 
      unreadCount: 0 
    });
  },
}));

// ── UI STORE ─────────────────────────────────────────────────────────────────
interface UiState {
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav:() => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen:  false,
  openMobileNav:  () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
}));