// src/lib/api.ts
import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: BASE, timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem('access_token');
    if (t && cfg.headers) cfg.headers.Authorization = `Bearer ${t}`;
  }
  return cfg;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      try {
        const rt = localStorage.getItem('refresh_token');
        if (!rt) throw new Error('no refresh token');
        const { data } = await axios.post(`${BASE}/auth/refresh`, { refresh_token: rt });
        localStorage.setItem('access_token',  data.data.access_token);
        localStorage.setItem('refresh_token', data.data.refresh_token);
        orig.headers.Authorization = `Bearer ${data.data.access_token}`;
        return api(orig);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

const d = <T>(r: AxiosResponse): T => r.data.data as T;

// ── AUTH ────────────────────────────────────────────────────────────────────
export const authApi = {
  registerCustomer: (body: any)           => api.post('/auth/register/customer', body).then(d),
  registerSeller:   (body: any)           => api.post('/auth/register/seller',   body).then(d),
  login:     (email: string, password: string, remember_me = false) =>
    api.post('/auth/login', { email, password, remember_me }).then(r => r.data),
  logout:    ()                           => api.post('/auth/logout'),
  refresh:   (refresh_token: string)      => api.post('/auth/refresh', { refresh_token }).then(r => r.data),
  verifyOtp: (user_id: string, token: string, purpose: string) =>
    api.post('/auth/verify-otp', { user_id, token, purpose }).then(d),
  resendOtp:        (email: string, purpose: string) =>
    api.post('/auth/resend-otp', { email, purpose }).then(d),
  forgotPassword:   (email: string)       => api.post('/auth/forgot-password', { email }).then(r => r.data),
  resetPassword:    (user_id: string, token: string, new_password: string) =>
    api.post('/auth/reset-password', { user_id, token, new_password }),
};

// ── USERS ───────────────────────────────────────────────────────────────────
export const userApi = {
  getMe:          ()                    => api.get('/users/me').then(d),
  updateMe:       (body: any)           => api.put('/users/me', body).then(d),
  changePassword: (current_password: string, new_password: string) =>
    api.put('/users/me/password', { current_password, new_password }),
  getAddresses:   ()                    => api.get('/users/me/addresses').then(d<any[]>),
  addAddress:     (body: any)           => api.post('/users/me/addresses', body).then(d),
  updateAddress:  (id: string, b: any)  => api.put(`/users/me/addresses/${id}`, b).then(d),
  deleteAddress:  (id: string)          => api.delete(`/users/me/addresses/${id}`),
};

// ── CATALOGUE ───────────────────────────────────────────────────────────────
export const catalogApi = {
  getCategories:  ()                     => api.get('/categories').then(d<any[]>),
  getCategory:    (slug: string)         => api.get(`/categories/${slug}`).then(d),
  getBrands:      ()                     => api.get('/brands').then(d<any[]>),
  getAttributes:  ()                     => api.get('/attributes').then(d<any[]>),
  createCategory: (body: any)            => api.post('/admin/categories', body).then(d),
  updateCategory: (id: string, b: any)   => api.put(`/admin/categories/${id}`, b).then(d),
  deleteCategory: (id: string)           => api.delete(`/admin/categories/${id}`),
  createBrand:    (body: any)            => api.post('/admin/brands', body).then(d),
};

// ── PRODUCTS ────────────────────────────────────────────────────────────────
export const productApi = {
  search:          (params?: any)        => api.get('/products', { params }).then(r => r.data),
  getBySlug:       (slug: string)        => api.get(`/products/${slug}`).then(d),
  getMyProducts:   (params?: any)        => api.get('/seller/products', { params }).then(r => r.data),
  createProduct:   (body: any)           => api.post('/seller/products', body).then(d),
  updateProduct:   (id: string, b: any)  => api.put(`/seller/products/${id}`, b).then(d),
  deleteProduct:   (id: string)          => api.delete(`/seller/products/${id}`),
  updateStock:     (variantId: string, stock_qty: number, note?: string) =>
    api.patch(`/seller/products/${variantId}/stock`, { stock_qty, note }),
  approveProduct:  (id: string, approve: boolean, reason?: string) =>
    api.patch(`/admin/products/${id}/approve`, { approve, reason }),
  featureProduct:  (id: string, is_featured: boolean) =>
    api.patch(`/admin/products/${id}/feature`, { is_featured }),
};

// ── SEARCH ──────────────────────────────────────────────────────────────────
export const searchApi = {
  search:  (q: string) => api.get('/search', { params: { q } }).then(d<any[]>),
  suggest: (q: string) => api.get('/search/suggest', { params: { q } }).then(d<string[]>),
};

// ── CART ────────────────────────────────────────────────────────────────────
export const cartApi = {
  getCart:    ()                                   => api.get('/cart').then(d),
  addItem:    (variant_id: string, quantity = 1)   => api.post('/cart', { variant_id, quantity }).then(d),
  updateQty:  (id: string, quantity: number)       => api.put(`/cart/${id}`, { quantity }).then(d),
  removeItem: (id: string)                         => api.delete(`/cart/${id}`),
  clearCart:  ()                                   => api.delete('/cart'),
};

// ── WISHLIST ────────────────────────────────────────────────────────────────
export const wishlistApi = {
  getWishlist: ()                       => api.get('/wishlist').then(d<any[]>),
  addItem:     (product_id: string)     => api.post('/wishlist', { product_id }).then(d),
  removeItem:  (productId: string)      => api.delete(`/wishlist/${productId}`),
  moveToCart:  (productId: string)      => api.post(`/wishlist/${productId}/move-to-cart`).then(d),
};

// ── ORDERS ──────────────────────────────────────────────────────────────────
export const orderApi = {
  placeOrder:       (body: any)           => api.post('/orders', body).then(d),
  getOrders:        (page = 1)            => api.get('/orders', { params: { page } }).then(r => r.data),
  getOrder:         (id: string)          => api.get(`/orders/${id}`).then(d),
  cancelOrder:      (id: string)          => api.post(`/orders/${id}/cancel`),
  reorder:          (id: string)          => api.post(`/orders/${id}/reorder`).then(d),
  downloadInvoice:  (id: string)          => api.get(`/orders/${id}/invoice`, { responseType: 'blob' }),
  getSellerOrders:  (params?: any)        => api.get('/seller/orders', { params }).then(r => r.data),
  acceptItem:       (itemId: string)      => api.patch(`/seller/orders/${itemId}/accept`),
  rejectItem:       (itemId: string, reason: string) =>
    api.patch(`/seller/orders/${itemId}/reject`, { reason }),
  shipItem:         (itemId: string, tracking_number: string) =>
    api.patch(`/seller/orders/${itemId}/ship`, { tracking_number }),
  getAllOrders:      (params?: any)        => api.get('/admin/orders', { params }).then(r => r.data),
  adminUpdateStatus:(id: string, status: string) =>
    api.patch(`/admin/orders/${id}/status`, { status }),
};

// ── PAYMENTS (CHAPA) ─────────────────────────────────────────────────────────
export const paymentApi = {
  initiate: (order_id: string)    => api.post('/payments/initiate', { order_id }).then(d),
  verify:   (txRef: string)       => api.get(`/payments/verify/${txRef}`).then(d),
  getLogs:  (page = 1)            => api.get('/admin/payments', { params: { page } }).then(r => r.data),
};

// ── RETURNS ─────────────────────────────────────────────────────────────────
export const returnApi = {
  submit:          (body: any)                    => api.post('/returns', body).then(d),
  getMyReturns:    ()                             => api.get('/returns/mine').then(d<any[]>),
  sellerUpdate:    (id: string, body: any)        => api.patch(`/seller/returns/${id}`, body).then(d),
  getAdminReturns: (status?: string)              =>
    api.get('/admin/returns', { params: { status } }).then(d<any[]>),
};

// ── REVIEWS ─────────────────────────────────────────────────────────────────
export const reviewApi = {
  getProductReviews: (productId: string) =>
    api.get(`/reviews/product/${productId}`).then(d<any[]>),
  submitReview:      (productId: string, body: any) =>
    api.post(`/reviews/product/${productId}`, body).then(d),
  reportReview:      (reviewId: string, reason: string) =>
    api.post(`/reviews/${reviewId}/report`, { reason }),
};

// ── NOTIFICATIONS ───────────────────────────────────────────────────────────
export const notificationApi = {
  getAll:      ()           => api.get('/notifications').then(d<any[]>),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: ()           => api.patch('/notifications/read-all'),
  deleteOne:   (id: string) => api.delete(`/notifications/${id}`),
  deleteAll:   ()           => api.delete('/notifications/all'),
};

// ── WALLET ──────────────────────────────────────────────────────────────────
export const walletApi = {
  getSummary:  ()          => api.get('/wallet').then(d),
  withdraw:    (body: any) => api.post('/wallet/withdraw', body).then(d),
  getHistory:  ()          => api.get('/wallet/withdrawals').then(d<any[]>),
  processWithdrawal: (id: string, status: string, note?: string) =>
    api.patch(`/admin/wallet/withdrawals/${id}`, { status, note }),
};

// ── SHIPPING ────────────────────────────────────────────────────────────────
export const shippingApi = {
  getZones:   () => api.get('/shipping/zones').then(d<any[]>),
  calculate:  (zone_id: string, cart_total: number, total_weight: number) =>
    api.post('/shipping/calculate', { zone_id, cart_total, total_weight }).then(d),
};

// ── FLASH SALES ─────────────────────────────────────────────────────────────
export const flashSaleApi = {
  getActive: ()                              => api.get('/flash-sales/active').then(d<any[]>),
  create:    (body: any)                     => api.post('/admin/flash-sales', body).then(d),
  addItem:   (saleId: string, body: any)     =>
    api.post(`/admin/flash-sales/${saleId}/items`, body).then(d),
};

// ── CMS ─────────────────────────────────────────────────────────────────────
export const cmsApi = {
  getBanners:   ()                      => api.get('/cms/banners').then(d<any[]>),
  getPage:      (slug: string)          => api.get(`/cms/pages/${slug}`).then(d),
  updatePage:   (slug: string, b: any)  => api.put(`/admin/cms/pages/${slug}`, b).then(d),
  createBanner: (body: any)             => api.post('/admin/cms/banners', body).then(d),
};

// ── SELLER ──────────────────────────────────────────────────────────────────
export const sellerApi = {
  getProfile:            ()               => api.get('/seller/profile').then(d),
  updateProfile:         (body: any)      => api.put('/seller/profile', body).then(d),
  getDashboard:          ()               => api.get('/seller/dashboard').then(d),
  getSalesGraph:         (period = 'daily') =>
    api.get('/seller/sales-graph', { params: { period } }).then(d<any[]>),
  getInventory:          (page = 1)       =>
    api.get('/seller/inventory', { params: { page } }).then(r => r.data),
  getStockHistory:       (variantId: string) =>
    api.get(`/seller/inventory/${variantId}/history`).then(d),
  getProductPerformance: ()               => api.get('/seller/product-performance').then(d<any[]>),
};

// ── ADMIN ───────────────────────────────────────────────────────────────────
export const adminApi = {
  // Dashboard
  getDashboard:         ()                          => api.get('/admin/dashboard').then(d),

  // Users
  getUsers:             (params?: any)              => api.get('/admin/users', { params }).then(r => r.data),
  getUser:              (id: string)                => api.get(`/admin/users/${id}`).then(d),
  toggleUser:           (id: string, suspend: boolean, reason?: string) =>
    api.patch(`/admin/users/${id}/toggle`, { suspend, reason }),
  updateUserRole:       (id: string, role: string)  =>
    api.patch(`/admin/users/${id}/role`, { role }),

  // Sellers
  getPendingSellers:    ()                          => api.get('/admin/sellers/pending').then(d<any[]>),
  getAllSellers:         (params?: any)              => api.get('/admin/sellers', { params }).then(r => r.data),
  getSeller:            (id: string)                => api.get(`/admin/sellers/${id}`).then(d),
  approveSeller:        (id: string, approve: boolean, reason?: string) =>
    api.patch(`/admin/sellers/${id}/approve`, { approve, reason }),
  updateCommission:     (id: string, commission_rate: number) =>
    api.patch(`/admin/sellers/${id}/commission`, { commission_rate }),

  // Orders
  updateOrderStatus:    (id: string, status: string) =>
    api.patch(`/admin/orders/${id}/status`, { status }),
  getOrderDetail:       (id: string)                => api.get(`/admin/orders/${id}`).then(d),

  // Returns
  getReturns:           (params?: any)              => api.get('/admin/returns', { params }).then(r => r.data),
  updateReturn:         (id: string, status: string, note?: string) =>
    api.patch(`/admin/returns/${id}`, { status, note }),

  // Payments
  getPayments:          (params?: any)              => api.get('/admin/payments', { params }).then(r => r.data),

  // Withdrawals
  getWithdrawals:       (params?: any)              => api.get('/admin/wallet/withdrawals', { params }).then(r => r.data),
  processWithdrawal:    (id: string, status: string, note?: string) =>
    api.patch(`/admin/wallet/withdrawals/${id}`, { status, note }),

  // Flash sales
  getFlashSales:        ()                          => api.get('/admin/flash-sales').then(d<any[]>),
  updateFlashSale:      (id: string, body: any)     => api.put(`/admin/flash-sales/${id}`, body).then(d),
  deleteFlashSale:      (id: string)                => api.delete(`/admin/flash-sales/${id}`),
  addFlashSaleItem:     (saleId: string, body: any) =>
    api.post(`/admin/flash-sales/${saleId}/items`, body).then(d),
  removeFlashSaleItem:  (saleId: string, itemId: string) =>
    api.delete(`/admin/flash-sales/${saleId}/items/${itemId}`),

  // CMS
  getAllBanners:         ()                          => api.get('/admin/cms/banners').then(d<any[]>),
  updateBanner:         (id: string, body: any)     => api.put(`/admin/cms/banners/${id}`, body).then(d),
  deleteBanner:         (id: string)                => api.delete(`/admin/cms/banners/${id}`),

  // Brands
  updateBrand:          (id: string, body: any)     => api.put(`/admin/brands/${id}`, body).then(d),

  // Reviews
  updateReview:         (id: string, approve: boolean) =>
    api.patch(`/admin/reviews/${id}`, { approve }),

  // Reports
  getSalesReport:       (params: any)               => api.get('/admin/reports/sales', { params }).then(d<any[]>),
  getSellerReport:      ()                          => api.get('/admin/reports/sellers').then(d<any[]>),
  exportReport:         (format: 'pdf'|'excel', params: any) =>
    api.get('/admin/reports/export', { params: { format, ...params }, responseType: 'blob' }),
};

export default api;
