// src/lib/api.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'http://localhost:5000/api/v1';

// ── Axios instance ────────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL:         BASE_URL,
  timeout:         15_000,
  withCredentials: false,
});

// ── Request interceptor — inject admin JWT ────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('admin-auth');
      if (stored) {
        const token = JSON.parse(stored)?.state?.token;
        if (token) config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch { /* sessionStorage unavailable — SSR or private mode */ }
  }
  return config;
});

// ── Response interceptor — 401/403 → clear session + redirect ────────────────
api.interceptors.response.use(
  r => r,
  err => {
    if ([401, 403].includes(err.response?.status)) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        sessionStorage.removeItem('admin-auth');
        // Clear the edge cookie so middleware doesn't re-admit on next request
        document.cookie = 'admin_token=; path=/; max-age=0; SameSite=Strict';
        window.location.replace('/login');
      }
    }
    return Promise.reject(err);
  },
);

export default api;

// ────────────────────────────────────────────────────────────────────────────
// API modules
// Keep each module flat — no nested objects — so tree-shaking works.
// ────────────────────────────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:  (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout').catch(() => {}),
  me:     () => api.get('/users/me'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get('/admin/dashboard'),
};

// ── Admin — unified object ─────────────────────────────────────────────────────
export const adminApi = {

  // Dashboard
  getDashboard: () =>
    api.get('/admin/dashboard').then((r: any) => r.data),

  // Users
  getUsers: (params?: any) =>
    api.get('/admin/users', { params }).then((r: any) => r.data),
  toggleUser: (id: string, suspend: boolean, reason?: string) =>
    api.patch(`/admin/users/${id}/toggle`, { suspend, reason }),

  // Sellers
  getPendingSellers: () =>
    api.get('/admin/sellers/pending').then((r: any) => r.data.data ?? []),
  getAllSellers: (params?: any) =>
    api.get('/admin/sellers', { params }).then((r: any) => r.data),
  approveSeller: (id: string, approve: boolean, reason?: string) =>
    api.patch(`/admin/sellers/${id}/approve`, { approve, reason }),
  updateCommission: (id: string, rate: number) =>
    api.patch(`/admin/sellers/${id}/commission`, { commission_rate: rate }),

  // Reports
  getSalesReport: (params: Record<string, string>) =>
    api.get('/admin/reports/sales', { params }).then((r: any) => r.data.data ?? []),
  getSellerReport: (params?: any) =>
    api.get('/admin/reports/sellers', { params }).then((r: any) => r.data.data ?? []),
  exportReport: (format: 'excel' | 'pdf', params: Record<string, string>) =>
    api.get('/admin/reports/export', { params: { ...params, format }, responseType: 'blob' }),

  // Withdrawals
  getWithdrawals: (params?: any) =>
    api.get('/admin/wallet/withdrawals', { params }),
  processWithdrawal: (id: string, status: 'approved' | 'rejected', note?: string) =>
    api.patch(`/admin/wallet/withdrawals/${id}`, { status, note }),

  // Returns
  getReturns: (params?: any) =>
    api.get('/admin/returns', { params }),
  updateReturn: (id: string, status: string, note?: string) =>
    api.patch(`/admin/returns/${id}`, { status, note }),

  // Reviews
  updateReview: (id: string, approve: boolean) =>
    api.patch(`/admin/reviews/${id}`, { approve }),

  // Banners / CMS
  getAllBanners: () =>
    api.get('/admin/cms/banners').then((r: any) => r.data.data ?? []),
  updateBanner: (id: string, data: any) =>
    api.put(`/admin/cms/banners/${id}`, data),
  deleteBanner: (id: string) =>
    api.delete(`/admin/cms/banners/${id}`),

  // Flash sales
  // FIX: No parameters — plain function that returns a Promise<array>.
  // useQuery will call this as `() => adminApi.getFlashSales()`.
  // The old `async (params = {})` silently received a QueryFunctionContext
  // object {queryKey, signal} as the first argument, which was then spread
  // into axios params — this could cause subtle request failures.
  getFlashSales: () =>
    api.get('/admin/flash-sales').then((r: any) => r.data?.data ?? r.data ?? []),

  updateFlashSale: (id: string, data: any) =>
    api.put(`/admin/flash-sales/${id}`, data),

  // FIX: deleteFlashSale — now returns the full axios promise so useMutation
  // can await it and react to success/error correctly.
  deleteFlashSale: (id: string) =>
    api.delete(`/admin/flash-sales/${id}`),

  addFlashSaleItem: (saleId: string, data: any) =>
    api.post(`/admin/flash-sales/${saleId}/items`, data),

  removeFlashSaleItem: (saleId: string, itemId: string) =>
    api.delete(`/admin/flash-sales/${saleId}/items/${itemId}`),

  // Brands
  updateBrand: (id: string, data: any) =>
    api.put(`/admin/brands/${id}`, data),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productApi = {
  search: (params?: any) =>
    api.get('/products', { params }).then((r: any) => r.data),
  approveProduct: (id: string, approve: boolean, reason?: string) =>
    api.patch(`/admin/products/${id}/approve`, { approve, reason }),
  featureProduct: (id: string, is_featured: boolean) =>
    api.patch(`/admin/products/${id}/feature`, { is_featured }),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const orderApi = {
  getAllOrders: (params?: any) =>
    api.get('/admin/orders', { params }).then((r: any) => r.data),
  adminUpdateStatus: (id: string, status: string) =>
    api.patch(`/admin/orders/${id}/status`, { status }),
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const paymentApi = {
  getLogs: (page = 1) =>
    api.get('/admin/payments', { params: { page } }).then((r: any) => r.data),
};

// ── Catalog ───────────────────────────────────────────────────────────────────
export const catalogApi = {
  getCategories: () =>
    api.get('/categories').then((r: any) => r.data.data ?? r.data),
  createCategory: (data: any) =>
    api.post('/admin/categories', data),
  updateCategory: (id: string, data: any) =>
    api.put(`/admin/categories/${id}`, data),
  deleteCategory: (id: string) =>
    api.delete(`/admin/categories/${id}`),
};

// ── CMS ───────────────────────────────────────────────────────────────────────
export const cmsApi = {
  getPage:      (slug: string) =>
    api.get(`/cms/pages/${slug}`).then((r: any) => r.data.data),
  updatePage:   (slug: string, data: any) =>
    api.put(`/admin/cms/pages/${slug}`, data),
  createBanner: (data: any) =>
    api.post('/admin/cms/banners', data),
};

// ── Flash sales (standalone — for create form) ─────────────────────────────────
export const flashSaleApi = {
  create: (data: any) => api.post('/admin/flash-sales', data),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  sales: (params: Record<string, string>) =>
    api.get('/admin/reports/sales', { params }),
  sellers: (params?: any) =>
    api.get('/admin/reports/sellers', { params }),
  export: (format: 'excel' | 'pdf', params: Record<string, string>) =>
    api.get('/admin/reports/export', { params: { ...params, format }, responseType: 'blob' }),
};

// ── Withdrawals (standalone) ──────────────────────────────────────────────────
export const withdrawalsApi = {
  list: (params?: any) =>
    api.get('/admin/wallet/withdrawals', { params }),
  process: (id: string, status: 'approved' | 'rejected', note?: string) =>
    api.patch(`/admin/wallet/withdrawals/${id}`, { status, note }),
};

// ── Returns (standalone) ──────────────────────────────────────────────────────
export const returnsApi = {
  list: (params?: any) =>
    api.get('/admin/returns', { params }),
  update: (id: string, status: string, note?: string) =>
    api.patch(`/admin/returns/${id}`, { status, note }),
};

// ── Reviews (standalone) ──────────────────────────────────────────────────────
export const reviewsApi = {
  list: (params?: any) =>
    api.get('/admin/reviews', { params }),
  update: (id: string, approve: boolean) =>
    api.patch(`/admin/reviews/${id}`, { approve }),
};