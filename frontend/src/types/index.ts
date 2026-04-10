// src/types/index.ts
export type UserRole = 'guest' | 'customer' | 'seller' | 'admin';
export type OrderStatus = 'pending'|'confirmed'|'processing'|'shipped'|'delivered'|'cancelled'|'returned';
export type ItemStatus  = 'pending'|'accepted'|'rejected'|'processing'|'shipped'|'delivered'|'cancelled';
export type ProductStatus = 'draft'|'pending_review'|'active'|'rejected'|'archived';
export type ReturnStatus  = 'requested'|'under_review'|'approved'|'rejected'|'completed';

export interface User {
  id: string; email: string; phone?: string; role: UserRole;
  first_name?: string; last_name?: string; profile_image_url?: string;
  email_verified: boolean; is_active: boolean; is_suspended: boolean;
  created_at: string; updated_at: string;
}

export interface SellerProfile {
  id: string; user_id: string; business_name: string; store_slug?: string;
  business_description?: string; return_policy?: string;
  wallet_balance: number; pending_balance: number; total_earned: number;
  commission_rate: number; status: 'pending'|'approved'|'rejected'|'suspended';
  rejection_reason?: string;
}

export interface Category {
  id: string; parent_id?: string; name: string; slug: string;
  description?: string; image_url?: string; sort_order: number;
  is_active: boolean; children?: Category[];
}

export interface Brand {
  id: string; name: string; slug: string; logo_url?: string; is_active: boolean;
}

export interface ProductAttribute {
  id: string; name: string; display_name: string;
  input_type: 'select'|'color_swatch'|'button_group';
  values: AttributeValue[];
}

export interface AttributeValue {
  id: string; attribute_id: string; value: string;
  display_value: string; color_hex?: string; sort_order: number;
}

export interface ProductVariantAttribute {
  name: string; display_name: string; value: string;
  display_value: string; color_hex?: string;
}

export interface ProductVariant {
  id: string; product_id: string; sku: string;
  price: number; discount_price?: number;
  stock_qty: number; low_stock_threshold: number;
  weight_kg: number; length_cm?: number; width_cm?: number; height_cm?: number;
  is_active: boolean; is_default: boolean;
  attributes?: ProductVariantAttribute[];
}

export interface ProductImage {
  id: string; url: string; alt_text?: string;
  is_primary: boolean; sort_order: number;
}

export interface Product {
  id: string; seller_id: string; name: string; slug: string;
  short_description?: string; full_description?: string;
  status: ProductStatus; rejection_reason?: string;
  is_featured: boolean; avg_rating: number; review_count: number; total_sold: number;
  // Joined from search queries
  price?: number; discount_price?: number; stock_qty?: number; sku?: string;
  primary_image?: string; effective_price?: number;
  category_id?: string; category_name?: string; category_slug?: string;
  brand_id?: string; brand_name?: string;
  seller_name?: string; store_slug?: string;
  created_at: string; updated_at: string;
}

export interface ProductDetail extends Product {
  variants: ProductVariant[]; images: ProductImage[];
  tags: string[]; related: Product[];
  business_name: string; return_policy?: string;
}

// ── CartItem — includes flash sale price fields injected by cartService ──────
export interface CartItem {
  id: string; user_id: string; variant_id: string; quantity: number;
  // Joined from product_variants + products
  sku: string; price: number; discount_price?: number;
  stock_qty: number; weight_kg: number;
  product_id: string; name: string; slug: string;
  seller_name: string; seller_id?: string; image_url?: string;
  category_id?: string;
  // Flash sale fields — injected by shared.services.ts cartService.getCart
  flash_sale_price?: number;
  is_flash_sale:     boolean;
  // effective_price = flash_sale_price ?? discount_price ?? price
  effective_price:   number;
  line_total:        number;
}

// ── Cart — includes aggregate flash + discount scope fields ──────────────────
export interface Cart {
  items:      CartItem[];
  subtotal:   number;
  item_count: number;
  // Flash sale aggregate fields
  has_flash_items: boolean;
  // Scope arrays for discount code validation at checkout
  category_ids: string[];
  product_ids:  string[];
}

export interface ShippingAddress {
  full_name: string; phone: string; country: string; region: string;
  city: string; subcity?: string; woreda?: string;
  street_address: string; postal_code?: string; additional_info?: string;
}

export interface UserAddress extends ShippingAddress {
  id: string; user_id: string; is_default: boolean;
}

export interface OrderItem {
  id: string; order_id: string; variant_id: string; seller_id: string;
  product_name_snapshot: string; sku_snapshot: string;
  variant_attributes_snapshot: Record<string, string>;
  unit_price_snapshot: number; discount_price_snapshot?: number;
  quantity: number; line_total: number; status: ItemStatus;
  tracking_number?: string; rejection_reason?: string;
  commission_rate_snapshot: number; commission_amount: number; seller_earnings: number;
  seller_name?: string; store_slug?: string;
}

export interface OrderStatusHistory {
  id: string; order_id: string; changed_by?: string;
  from_status: OrderStatus | null; to_status: OrderStatus;
  note?: string; changed_at: string;
}

export interface Order {
  id: string; customer_id: string; order_number: string;
  status: OrderStatus;
  payment_status: 'unpaid'|'paid'|'partially_refunded'|'fully_refunded';
  shipping_address_snapshot: ShippingAddress;
  shipping_method?: string; tracking_number?: string;
  subtotal: number; shipping_cost: number; discount_amount: number;
  tax_amount: number; total: number;
  payment_method?: string; chapa_tx_ref?: string; invoice_url?: string;
  customer_note?: string; placed_at: string; updated_at: string;
  items?: OrderItem[]; history?: OrderStatusHistory[];
}

export interface ShippingZone {
  id: string; name: string; regions: string[];
  base_rate: number; per_kg_rate: number; free_above_amount: number;
  estimated_days_min: number; estimated_days_max: number; is_active: boolean;
}

export interface Review {
  id: string; product_id: string; user_id: string; order_id: string;
  rating: number; title?: string; comment?: string;
  is_verified_purchase: boolean; is_approved: boolean; is_reported: boolean;
  first_name?: string; last_name?: string; created_at: string;
}

export interface Notification {
  id: string; user_id: string;
  type: 'order_update'|'low_stock'|'payment'|'promotion'|'seller_approval'|'return_update'|'system'|'product_approved'|'product_rejected';
  channel: 'in_app'|'email'|'sms';
  title: string; body: string; action_url?: string;
  is_read: boolean; read_at?: string; created_at: string;
}

export interface Return {
  id: string; order_item_id: string; customer_id: string; seller_id: string;
  reason: string; evidence_urls: string[]; status: ReturnStatus;
  resolution?: 'refund'|'replacement'|'store_credit';
  refund_amount?: number; seller_note?: string; admin_note?: string;
  created_at: string; resolved_at?: string; updated_at: string;
}

export interface WalletTransaction {
  id: string; seller_id: string; type: string; gross_amount: number;
  commission_amount: number; net_amount: number; status: string;
  reference?: string; note?: string; created_at: string;
}

export interface WithdrawalRequest {
  id: string; seller_id: string; amount: number; bank_name: string;
  account_number: string; account_name: string;
  status: 'pending'|'approved'|'rejected'|'paid';
  admin_note?: string; requested_at: string; processed_at?: string;
}

export interface FlashSale {
  id: string; title: string; description?: string; banner_url?: string;
  starts_at: string; ends_at: string; is_active: boolean;
  items: FlashSaleItem[];
}

export interface FlashSaleItem {
  id: string; flash_sale_id: string; variant_id: string;
  sale_price: number; max_qty: number; sold_qty: number;
  // Joined fields from backend
  name: string; slug: string;
  image_url?: string; original_price?: number;
}

export interface Banner {
  id: string; title: string; subtitle?: string;
  image_url: string; mobile_image_url?: string;
  link_url?: string; cta_text?: string;
  sort_order: number; is_active: boolean;
}
  

// ADD THIS to src/types/index.ts — insert after the Category interface

export interface Brand {
  id:        string;
  name:      string;
  slug:      string;
  logo_url?: string;
  is_active: boolean;
}
export interface ApiMeta {
  total: number; page: number; limit: number;
  total_pages: number; has_next: boolean; has_prev: boolean;
}

export interface ApiResponse<T> {
  success: boolean; message: string; data?: T; meta?: ApiMeta;
}