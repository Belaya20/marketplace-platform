// src/types/index.ts
// Central type definitions covering every entity in the requirements

import { Request } from 'express';

// ─── Auth ────────────────────────────────────────────────────────────────────
export type UserRole = 'guest' | 'customer' | 'seller' | 'admin';
export type SellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface AuthUser {
  userId:   string;
  email:    string;
  role:     UserRole;
  sellerId?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// ─── User ────────────────────────────────────────────────────────────────────
export interface User {
  id:               string;
  email:            string;
  phone?:           string;
  role:             UserRole;
  email_verified:   boolean;
  phone_verified:   boolean;
  is_active:        boolean;
  is_suspended:     boolean;
  first_name?:      string;
  last_name?:       string;
  profile_image_url?: string;
  last_login_at?:   Date;
  created_at:       Date;
  updated_at:       Date;
}

// ─── Seller ───────────────────────────────────────────────────────────────────
export interface SellerProfile {
  id:                       string;
  user_id:                  string;
  business_name:            string;
  business_registration_no?: string;
  tax_id?:                  string;
  business_address?:        string;
  bank_name?:               string;
  bank_account_no?:         string;
  bank_account_name?:       string;
  commission_rate:          number;
  wallet_balance:           number;
  pending_balance:          number;
  total_earned:             number;
  status:                   SellerStatus;
  rejection_reason?:        string;
  store_slug?:              string;
  created_at:               Date;
}

// ─── Product ──────────────────────────────────────────────────────────────────
export type ProductStatus = 'draft' | 'pending_review' | 'active' | 'rejected' | 'archived';

export interface Product {
  id:                string;
  seller_id:         string;
  category_id:       string;
  brand_id?:         string;
  name:              string;
  slug:              string;
  short_description?: string;
  full_description?: string;
  status:            ProductStatus;
  rejection_reason?: string;
  is_featured:       boolean;
  avg_rating:        number;
  review_count:      number;
  total_sold:        number;
  // Search result extras
  primary_image?:    string;
  effective_price?:  number;
  price?:            number;
  discount_price?:   number;
  stock_qty?:        number;
  variant_id?:       string;
  category_name?:    string;
  brand_name?:       string;
  seller_name?:      string;
  created_at:        Date;
  updated_at:        Date;
}

export interface ProductVariant {
  id:                   string;
  product_id:           string;
  sku:                  string;
  price:                number;
  discount_price?:      number;
  stock_qty:            number;
  low_stock_threshold:  number;
  weight_kg:            number;
  length_cm?:           number;
  width_cm?:            number;
  height_cm?:           number;
  is_active:            boolean;
  is_default:           boolean;
  attributes?:          ProductAttribute[];
}

export interface ProductAttribute {
  name:          string;
  display_name:  string;
  value:         string;
  display_value: string;
  color_hex?:    string;
}

export interface ProductImage {
  id:         string;
  url:        string;
  alt_text?:  string;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductDetail extends Product {
  variants:       ProductVariant[];
  images:         ProductImage[];
  tags:           string[];
  related:        Product[];
  category_slug?: string;
  business_name?: string;
  return_policy?: string;
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
export interface CartItem {
  id:                string;
  variant_id:        string;
  quantity:          number;
  sku:               string;
  price:             number;           // original regular price
  discount_price:    number | null;    // seller discount price
  flash_sale_price:  number | null;    // flash sale price (highest priority)
  effective_price:   number;           // final price used: flash > discount > regular
  is_flash_sale:     boolean;          // true when flash_sale_price is active
  line_total:        number;           // effective_price × quantity
  stock_qty:         number;
  weight_kg:         number;
  product_id:        string;
  name:              string;
  slug:              string;
  category_id:       string;
  seller_name:       string;
  image_url?:        string;
}

export interface Cart {
  items:           CartItem[];
  subtotal:        number;             // sum of line_totals (uses flash/discount prices)
  item_count:      number;
  has_flash_items: boolean;            // true if any item is on flash sale
  category_ids:    string[];           // for discount code scope validation
  product_ids:     string[];           // for discount code scope validation
}

// ─── Flash Sale ───────────────────────────────────────────────────────────────
export interface FlashSaleItem {
  id:             string;
  variant_id:     string;
  sale_price:     number;
  original_price: number;
  max_qty:        number;
  sold_qty:       number;
  name?:          string;
  slug?:          string;
  image_url?:     string;
  sku?:           string;
}

export interface FlashSale {
  id:          string;
  title:       string;
  description?: string;
  banner_url?: string;
  starts_at:   string;
  ends_at:     string;
  is_active:   boolean;
  items?:      FlashSaleItem[];
}

// ─── Banner / CMS ─────────────────────────────────────────────────────────────
export interface Banner {
  id:          string;
  title:       string;
  subtitle?:   string;
  image_url:   string;
  link_url?:   string;
  cta_text?:   string;
  sort_order:  number;
  is_active:   boolean;
}

export interface Category {
  id:         string;
  name:       string;
  slug:       string;
  image_url?: string;
  parent_id?: string;
  children?:  Category[];
}

// ─── Order ────────────────────────────────────────────────────────────────────
export type OrderStatus =
  'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type ItemStatus =
  'pending' | 'accepted' | 'rejected' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type OrderPaymentStatus = 'unpaid' | 'paid' | 'partially_refunded' | 'fully_refunded';

export interface OrderItem {
  id:                           string;
  order_id:                     string;
  variant_id:                   string;
  seller_id:                    string;
  product_name_snapshot:        string;
  sku_snapshot:                 string;
  variant_attributes_snapshot:  Record<string, string>;
  unit_price_snapshot:          number;
  discount_price_snapshot?:     number;
  quantity:                     number;
  line_total:                   number;
  status:                       ItemStatus;
  rejection_reason?:            string;
  tracking_number?:             string;
  seller_name?:                 string;
  store_slug?:                  string;
}

export interface Order {
  id:                           string;
  customer_id:                  string;
  order_number:                 string;
  status:                       OrderStatus;
  payment_status:               OrderPaymentStatus;
  shipping_address_snapshot:    ShippingAddress;
  shipping_method?:             string;
  tracking_number?:             string;
  subtotal:                     number;
  shipping_cost:                number;
  discount_amount:              number;
  tax_amount:                   number;
  total:                        number;
  payment_method?:              string;
  chapa_tx_ref?:                string;
  invoice_url?:                 string;
  placed_at:                    Date;
  items?:                       OrderItem[];
  history?:                     any[];
}

export interface ShippingAddress {
  full_name:      string;
  phone:          string;
  country:        string;
  region:         string;
  city:           string;
  street_address: string;
  postal_code?:   string;
}

// ─── Review ───────────────────────────────────────────────────────────────────
export interface Review {
  id:                   string;
  product_id:           string;
  user_id:              string;
  rating:               number;
  title?:               string;
  comment?:             string;
  is_verified_purchase: boolean;
  is_approved:          boolean;
  created_at:           string;
  first_name?:          string;
  last_name?:           string;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export type NotificationChannel = 'in_app' | 'email' | 'sms';
export type NotificationType =
  'order_update' | 'low_stock' | 'payment' | 'promotion' |
  'seller_approval' | 'return_update' | 'system' |
  'product_approved' | 'product_rejected';

export interface Notification {
  id:         string;
  user_id:    string;
  type:       NotificationType;
  channel:    NotificationChannel;
  title:      string;
  body:       string;
  is_read:    boolean;
  read_at?:   string;
  created_at: string;
}

// ─── Payment ──────────────────────────────────────────────────────────────────
export type PaymentStatus = 'initiated' | 'pending' | 'success' | 'failed' | 'refunded';

export interface ChapaInitRequest {
  amount:         number;
  currency:       string;
  email:          string;
  first_name:     string;
  last_name:      string;
  tx_ref:         string;
  callback_url:   string;
  return_url:     string;
  customization?: { title?: string; description?: string };
}

export interface ChapaInitResponse {
  message:  string;
  status:   string;
  data: { checkout_url: string };
}

export interface ChapaVerifyResponse {
  message: string;
  status:  string;
  data: {
    first_name:  string;
    last_name:   string;
    email:       string;
    currency:    string;
    amount:      string;
    charge:      string;
    status:      string;
    reference:   string;
    tx_ref:      string;
    created_at:  string;
    updated_at:  string;
  };
}

// ─── Return ───────────────────────────────────────────────────────────────────
export type ReturnStatus = 'requested' | 'under_review' | 'approved' | 'rejected' | 'completed';
export type ReturnResolution = 'refund' | 'replacement' | 'store_credit';

// ─── Search ───────────────────────────────────────────────────────────────────
export interface ProductSearchQuery {
  q?:           string;
  category?:    string;
  brand?:       string;
  status?:      string;
  seller_id?:   string;
  min_price?:   number;
  max_price?:   number;
  min_rating?:  number;
  in_stock?:    boolean;
  attributes?:  Record<string, string>;
  sort?:        'price_asc' | 'price_desc' | 'newest' | 'popularity' | 'rating';
  page?:        number;
  limit?:       number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResult<T> {
  data:         T[];
  total:        number;
  page:         number;
  limit:        number;
  total_pages:  number;
  has_next:     boolean;
  has_prev:     boolean;
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T = any> {
  success:  boolean;
  message:  string;
  data?:    T;
  errors?:  any[];
  meta?:    any;
}