-- =============================================================================
-- MIGRATION 007: Wallet, Reviews & Notifications
-- Depends on: 001, 002, 003, 004, 005, 006
-- Covers requirements: 3.3.5 Seller Wallet/Earnings, 3.2.9 Reviews & Ratings,
--   3.5 Notification System
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: wallet_transactions
-- Req 3.3.5: View earnings, Pending balance, Withdrawal history
-- Pure append-only financial ledger — rows are NEVER updated or deleted
-- Each order_item sale creates a commission_credit row
-- Each withdrawal creates a withdrawal_debit row
-- ---------------------------------------------------------------------------
CREATE TABLE wallet_transactions (
    id                  UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id           UUID                NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
    order_item_id       UUID                REFERENCES order_items(id) ON DELETE SET NULL,

    type                wallet_tx_type      NOT NULL,

    -- Financial breakdown
    gross_amount        DECIMAL(14,2)       NOT NULL,   -- full sale amount
    commission_amount   DECIMAL(14,2)       NOT NULL DEFAULT 0.00, -- platform fee
    net_amount          DECIMAL(14,2)       NOT NULL,   -- seller receives

    status              wallet_tx_status    NOT NULL DEFAULT 'pending',
    reference           VARCHAR(200),                   -- order_number, withdrawal_id, etc.
    note                TEXT,

    created_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT wallet_tx_gross_non_neg      CHECK (gross_amount >= 0),
    CONSTRAINT wallet_tx_commission_non_neg CHECK (commission_amount >= 0),
    CONSTRAINT wallet_tx_net_non_neg        CHECK (net_amount >= 0)
);

-- Immutable ledger — no updates or deletes
CREATE RULE wallet_transactions_no_update AS ON UPDATE TO wallet_transactions DO INSTEAD NOTHING;
CREATE RULE wallet_transactions_no_delete AS ON DELETE TO wallet_transactions DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------------
-- TABLE: withdrawal_requests
-- Req 3.3.5: Withdraw request, Withdrawal history
-- ---------------------------------------------------------------------------
CREATE TABLE withdrawal_requests (
    id                  UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id           UUID                NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT,
    wallet_tx_id        UUID                REFERENCES wallet_transactions(id) ON DELETE SET NULL,

    amount              DECIMAL(14,2)       NOT NULL,

    -- Bank details at time of request (may differ from profile later)
    bank_name           VARCHAR(200)        NOT NULL,
    account_number      VARCHAR(50)         NOT NULL,
    account_name        VARCHAR(200)        NOT NULL,

    status              withdrawal_status   NOT NULL DEFAULT 'pending',
    admin_note          TEXT,
    processed_by        UUID                REFERENCES users(id) ON DELETE SET NULL,

    requested_at        TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    processed_at        TIMESTAMP WITH TIME ZONE,

    CONSTRAINT withdrawal_amount_positive CHECK (amount > 0)
);

-- ---------------------------------------------------------------------------
-- TABLE: reviews
-- Req 3.2.9: Rate purchased products, Write review, Report inappropriate review
-- Req 3.4.4: Manage product attributes (admin can remove reviews)
-- is_verified_purchase enforced at API level by checking order history
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id              UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id                 UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id                UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    rating                  SMALLINT    NOT NULL,
    title                   VARCHAR(255),
    comment                 TEXT,

    -- Verified purchase flag (Req 3.2.9: Rate purchased products only)
    is_verified_purchase    BOOLEAN     NOT NULL DEFAULT TRUE,

    -- Moderation (Req 3.2.9: Report inappropriate review)
    is_approved             BOOLEAN     NOT NULL DEFAULT TRUE,
    is_reported             BOOLEAN     NOT NULL DEFAULT FALSE,
    report_reason           TEXT,
    moderated_by            UUID        REFERENCES users(id) ON DELETE SET NULL,
    moderated_at            TIMESTAMP WITH TIME ZONE,

    created_at              TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    -- One review per user per product per order
    CONSTRAINT reviews_unique_per_order UNIQUE (user_id, product_id, order_id),
    CONSTRAINT review_rating_range      CHECK (rating BETWEEN 1 AND 5)
);

CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: notifications
-- Req 3.5: Email notifications, SMS notifications, In-app notifications
-- Req 3.5: Order status alerts, Low stock alerts, Promotional notifications
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
    id              UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    type            notification_type       NOT NULL,
    channel         notification_channel    NOT NULL DEFAULT 'in_app',

    title           VARCHAR(255)            NOT NULL,
    body            TEXT                    NOT NULL,
    action_url      TEXT,               -- deep link: /orders/xyz, /products/abc

    -- Delivery state
    is_read         BOOLEAN                 NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMP WITH TIME ZONE,

    -- Email / SMS delivery receipt
    external_id     VARCHAR(255),       -- SES message ID or SMS gateway ID
    delivered_at    TIMESTAMP WITH TIME ZONE,
    failed_reason   TEXT,

    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- END OF MIGRATION 007
-- =============================================================================
