-- =============================================================================
-- MIGRATION 001: Extensions & Enums
-- E-Commerce Marketplace — PostgreSQL 15+
-- Run first. Everything else depends on these types.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- crypt(), gen_salt()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- trigram indexes for ILIKE search
CREATE EXTENSION IF NOT EXISTS "unaccent";        -- accent-insensitive search

-- ---------------------------------------------------------------------------
-- ENUM: user role
-- Req 2: Guest User, Registered Customer, Seller, Admin
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM (
    'guest',
    'customer',
    'seller',
    'admin'
);

-- ---------------------------------------------------------------------------
-- ENUM: seller approval status
-- Req 3.4.2: Approve/reject sellers, suspend/activate
-- ---------------------------------------------------------------------------
CREATE TYPE seller_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'suspended'
);

-- ---------------------------------------------------------------------------
-- ENUM: seller document type
-- Req 3.1.1: Seller registration with business information
-- ---------------------------------------------------------------------------
CREATE TYPE seller_doc_type AS ENUM (
    'business_registration',
    'tax_certificate',
    'national_id',
    'other'
);

-- ---------------------------------------------------------------------------
-- ENUM: OTP / token purpose
-- Req 3.1.1: Email/OTP verification  Req 3.1.1: Password reset
-- ---------------------------------------------------------------------------
CREATE TYPE token_purpose AS ENUM (
    'email_verify',
    'phone_verify',
    'password_reset'
);

-- ---------------------------------------------------------------------------
-- ENUM: product status workflow
-- Req 3.4.4: Approve seller products  Req 3.3.2: Add/edit/delete product
-- ---------------------------------------------------------------------------
CREATE TYPE product_status AS ENUM (
    'draft',
    'pending_review',
    'active',
    'rejected',
    'archived'
);

-- ---------------------------------------------------------------------------
-- ENUM: order master status
-- Req 3.2.7: Pending/Confirmed/Processing/Shipped/Delivered/Cancelled/Returned
-- ---------------------------------------------------------------------------
CREATE TYPE order_status AS ENUM (
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'returned'
);

-- ---------------------------------------------------------------------------
-- ENUM: per-item fulfillment status (seller-level)
-- Req 3.3.3: Accept/reject order, update order status
-- ---------------------------------------------------------------------------
CREATE TYPE item_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
);

-- ---------------------------------------------------------------------------
-- ENUM: payment status
-- Req 3.2.6: Chapa payment integration, verification, callback handling
-- ---------------------------------------------------------------------------
CREATE TYPE payment_status AS ENUM (
    'initiated',
    'pending',
    'success',
    'failed',
    'refunded'
);

-- ---------------------------------------------------------------------------
-- ENUM: order-level payment status
-- ---------------------------------------------------------------------------
CREATE TYPE order_payment_status AS ENUM (
    'unpaid',
    'paid',
    'partially_refunded',
    'fully_refunded'
);

-- ---------------------------------------------------------------------------
-- ENUM: return status
-- Req 3.8: Return request submission, approval workflow, status tracking
-- ---------------------------------------------------------------------------
CREATE TYPE return_status AS ENUM (
    'requested',
    'under_review',
    'approved',
    'rejected',
    'completed'
);

-- ---------------------------------------------------------------------------
-- ENUM: return resolution type
-- Req 3.8: Return approval workflow
-- ---------------------------------------------------------------------------
CREATE TYPE return_resolution AS ENUM (
    'refund',
    'replacement',
    'store_credit'
);

-- ---------------------------------------------------------------------------
-- ENUM: wallet transaction type
-- Req 3.3.5: View earnings, pending balance, withdraw request
-- ---------------------------------------------------------------------------
CREATE TYPE wallet_tx_type AS ENUM (
    'commission_credit',
    'withdrawal_debit',
    'refund_debit',
    'adjustment'
);

-- ---------------------------------------------------------------------------
-- ENUM: wallet transaction / withdrawal status
-- ---------------------------------------------------------------------------
CREATE TYPE wallet_tx_status AS ENUM (
    'pending',
    'completed',
    'failed'
);

CREATE TYPE withdrawal_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'paid'
);

-- ---------------------------------------------------------------------------
-- ENUM: stock change reason
-- Req 3.3.4: Stock history
-- ---------------------------------------------------------------------------
CREATE TYPE stock_reason AS ENUM (
    'sale',
    'restock',
    'manual_adjustment',
    'return',
    'damage',
    'flash_sale'
);

-- ---------------------------------------------------------------------------
-- ENUM: discount type
-- Req 3.3.6: Create discount offers
-- ---------------------------------------------------------------------------
CREATE TYPE discount_type AS ENUM (
    'percentage',
    'fixed_amount',
    'free_shipping'
);

-- ---------------------------------------------------------------------------
-- ENUM: notification channel
-- Req 3.5: Email notifications, SMS notifications, In-app notifications
-- ---------------------------------------------------------------------------
CREATE TYPE notification_channel AS ENUM (
    'in_app',
    'email',
    'sms'
);

-- ---------------------------------------------------------------------------
-- ENUM: notification type
-- Req 3.5: Order status alerts, Low stock alerts, Promotional notifications
-- ---------------------------------------------------------------------------
CREATE TYPE notification_type AS ENUM (
    'order_update',
    'low_stock',
    'payment',
    'promotion',
    'seller_approval',
    'return_update',
    'system'
);

-- ---------------------------------------------------------------------------
-- ENUM: attribute input rendering type
-- Req 3.4.4: Manage product attributes
-- ---------------------------------------------------------------------------
CREATE TYPE attribute_input_type AS ENUM (
    'select',
    'color_swatch',
    'button_group'
);

-- ---------------------------------------------------------------------------
-- ENUM: report type and format
-- Req 3.4.8: Sales report, product report, seller report — export PDF/Excel
-- ---------------------------------------------------------------------------
CREATE TYPE report_type AS ENUM (
    'sales',
    'products',
    'sellers',
    'orders',
    'inventory'
);

CREATE TYPE export_format AS ENUM (
    'pdf',
    'excel'
);

CREATE TYPE export_status AS ENUM (
    'queued',
    'processing',
    'ready',
    'failed'
);

-- ---------------------------------------------------------------------------
-- ENUM: blog post status
-- Req 3.4.7: Blog management (optional)
-- ---------------------------------------------------------------------------
CREATE TYPE blog_status AS ENUM (
    'draft',
    'published',
    'archived'
);

-- ---------------------------------------------------------------------------
-- Shared utility: updated_at auto-update function
-- Used by triggers across all tables that have updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================
