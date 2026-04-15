 
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  authApi, cartApi, wishlistApi, notificationApi,
  searchApi, productApi, orderApi,
} from '@/lib/api';
import { useAuthStore, useCartStore, useNotificationStore } from '@/store';

export function formatETB(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency', currency: 'ETB',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  confirmed:  'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped:    'bg-indigo-100 text-indigo-800',
  delivered:  'bg-green-100 text-green-800',
  cancelled:  'bg-red-100 text-red-800',
  returned:   'bg-gray-100 text-gray-600',
};

export function useAuth() {
  const { user, setAuth, clearAuth, isLoading, setLoading } = useAuthStore();
  const router = useRouter();

  const login = useCallback(async (
    email: string,
    password: string,
    rememberMe = false,
  ) => {
    setLoading(true);
    try {
      const res  = await authApi.login(email, password, rememberMe);
      const role = res.data.user.role;

      // Admin accounts belong in the admin panel only
      if (role === 'admin') {
        toast.error('Admin accounts must sign in at the admin panel.');
        return;
      }

      setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
      toast.success('Welcome back!');

      const redirectTo = (() => {
        if (typeof window === 'undefined') return null;
        return new URLSearchParams(window.location.search).get('redirect');
      })();

      if (redirectTo)           router.push(redirectTo);
      else if (role === 'seller') router.push('/seller/dashboard');
      else                        router.push('/');

    } catch (err: any) {
      if (!err.response) {
        toast.error('Cannot connect to the server. Please try again.');
        return;
      }

      const status  = err.response?.status;
      const message = err.response?.data?.message || '';
      const msgLower = message.toLowerCase();

      if (status === 403) {
        // Case 1: email not verified → redirect to verify-otp
        if (msgLower.includes('verify your email')) {
          toast.error('Please verify your email first. Redirecting…');
          router.push(`/verify-otp?purpose=email_verify&email=${encodeURIComponent(email)}`);
          return;
        }

        // Case 2: seller pending admin approval → stay on login, show info toast
        if (msgLower.includes('pending admin approval') || msgLower.includes('pending approval')) {
          toast.error(
            '⏳ Your seller account is pending admin approval. You will be notified by email once approved.',
            { duration: 6000 }
          );
          return;
        }

        // Case 3: seller rejected
        if (msgLower.includes('not approved') || msgLower.includes('rejected')) {
          toast.error(
            message || 'Your seller application was not approved. Please contact support.',
            { duration: 6000 }
          );
          return;
        }

        // Case 4: suspended or any other 403
        toast.error(message || 'Your account has been suspended. Please contact support.');
        return;
      }

      if (status === 401) {
        toast.error('Invalid email or password.');
        return;
      }

      toast.error(message || 'Login failed. Please try again.');

    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setAuth, setLoading, router]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* best-effort */ }
    clearAuth();
    router.push('/login');
    toast.success('Logged out');
  }, [clearAuth, router]);

  return { user, isLoading, login, logout, isAuthenticated: !!user };
}

// ── useCart ───────────────────────────────────────────────────────────────────
export function useCart() {
  const { cart, isOpen, setCart, openCart, closeCart, toggleCart } = useCartStore();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => {
      const data = await cartApi.getCart();
      setCart(data as any);
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const addItem = useMutation({
    mutationFn: ({ variantId, quantity = 1 }: { variantId: string; quantity?: number }) =>
      cartApi.addItem(variantId, quantity),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cart'] }); openCart(); toast.success('Added to cart'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to add item'),
  });

  const updateQty = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.updateQty(itemId, quantity),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => cartApi.removeItem(itemId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cart'] }); toast.success('Removed'); },
  });

  return {
    cart, itemCount: cart?.item_count ?? 0, subtotal: cart?.subtotal ?? 0,
    isLoading, isOpen, openCart, closeCart, toggleCart,
    addItem: addItem.mutate, updateQty: updateQty.mutate, removeItem: removeItem.mutate,
    isAdding: addItem.isPending,
  };
}

// ── useWishlist ───────────────────────────────────────────────────────────────
export function useWishlist() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['wishlist'],
    queryFn: wishlistApi.getWishlist,
    enabled: !!user,
    staleTime: 60_000,
  });

  const addItem = useMutation({
    mutationFn: (productId: string) => wishlistApi.addItem(productId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wishlist'] }); toast.success('Added to wishlist'); },
  });
  const removeItem = useMutation({
    mutationFn: (productId: string) => wishlistApi.removeItem(productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  });
  const moveToCart = useMutation({
    mutationFn: (productId: string) => wishlistApi.moveToCart(productId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wishlist', 'cart'] }); toast.success('Moved to cart'); },
  });

  const isInWishlist = useCallback(
    (productId: string) => (items as any[]).some((i: any) => i.product_id === productId),
    [items],
  );

  return { items, isInWishlist, addItem: addItem.mutate, removeItem: removeItem.mutate, moveToCart: moveToCart.mutate };
}

// ── useSearch ─────────────────────────────────────────────────────────────────
export function useSearch(initial = '') {
  const [query, setQuery] = useState(initial);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [debounced, setDebounced] = useState(query);

  useEffect(() => { const t = setTimeout(() => setDebounced(query), 280); return () => clearTimeout(t); }, [query]);
  useEffect(() => {
    if (debounced.trim().length < 2) { setSuggestions([]); return; }
    searchApi.suggest(debounced).then(setSuggestions).catch(() => {});
  }, [debounced]);

  return { query, setQuery, suggestions };
}

// ── useNotifications ──────────────────────────────────────────────────────────
export function useNotifications() {
  const { user } = useAuthStore();
  const store    = useNotificationStore();
  const qc       = useQueryClient();

  useQuery({
    queryKey: ['notifications'],
    queryFn: async () => { const data = await notificationApi.getAll(); store.setNotifications(data); return data; },
    enabled: !!user, refetchInterval: 30_000, staleTime: 15_000,
  });

  const markRead    = useCallback(async (id: string) => { store.markRead(id); await notificationApi.markRead(id).catch(() => {}); qc.invalidateQueries({ queryKey: ['notifications'] }); }, [store, qc]);
  const markAllRead = useCallback(async () => { store.markAllRead(); await notificationApi.markAllRead().catch(() => {}); qc.invalidateQueries({ queryKey: ['notifications'] }); }, [store, qc]);
  const deleteOne   = useCallback(async (id: string) => { store.setNotifications(store.notifications.filter((n: any) => n.id !== id)); await notificationApi.deleteOne(id).catch(() => {}); qc.invalidateQueries({ queryKey: ['notifications'] }); }, [store, qc]);
  const deleteAll   = useCallback(async () => { store.setNotifications([]); await notificationApi.deleteAll().catch(() => {}); qc.invalidateQueries({ queryKey: ['notifications'] }); }, [store, qc]);

  return { ...store, markRead, markAllRead, deleteOne, deleteAll };
}

export function useProductSearch(params: Record<string, any> = {}) {
  return useQuery({ queryKey: ['products', params], queryFn: () => productApi.search(params), staleTime: 60_000, placeholderData: (prev: any) => prev });
}

export function useProduct(slug: string) {
  return useQuery({ queryKey: ['product', slug], queryFn: () => productApi.getBySlug(slug), staleTime: 120_000, enabled: !!slug });
}

export function useOrders(page = 1) {
  return useQuery({ queryKey: ['orders', page], queryFn: () => orderApi.getOrders(page), staleTime: 30_000 });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: ['order', id], queryFn: () => orderApi.getOrder(id), enabled: !!id, staleTime: 15_000 });
}