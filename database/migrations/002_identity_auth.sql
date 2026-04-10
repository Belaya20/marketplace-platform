-- =============================================================================
-- MIGRATION 002: Identity & Authentication Tables
-- Depends on: 001_extensions_and_enums.sql
-- Covers requirements: 3.1.1 Registration, 3.1.2 Login, 3.1.3 Profile Management
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: users
-- Req 3.1.1: Customer registration (email/phone/password)
-- Req 3.1.1: Seller registration
-- Req 3.1.2: Secure login, Remember me option
-- Req 3.1.3: Update personal details, change password, upload profile image
-- Req 3.4.2: Suspend/activate users, edit user details
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(255)    NOT NULL,
    phone               VARCHAR(20),
    password_hash       VARCHAR(255)    NOT NULL,
    role                user_role       NOT NULL DEFAULT 'customer',

    -- Verification flags (Req 3.1.1: Email/OTP verification)
    email_verified      BOOLEAN         NOT NULL DEFAULT FALSE,
    phone_verified      BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Account state (Req 3.4.2: Suspend/activate users)
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    is_suspended        BOOLEAN         NOT NULL DEFAULT FALSE,
    suspension_reason   TEXT,

    -- Profile (Req 3.1.3: Upload profile image)
    first_name          VARCHAR(100),
    last_name           VARCHAR(100),
    profile_image_url   TEXT,

    -- Remember me / session tracking (Req 3.1.2)
    last_login_at       TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT users_email_unique   UNIQUE (email),
    CONSTRAINT users_phone_unique   UNIQUE (phone),
    CONSTRAINT users_email_format   CHECK (email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_phone_format   CHECK (phone ~ '^\+?[0-9]{7,15}$')
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: otp_tokens
-- Req 3.1.1: Email/OTP verification
-- Req 3.1.1: Password reset
-- ---------------------------------------------------------------------------
CREATE TABLE otp_tokens (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(64)     NOT NULL,                   -- hashed token
    purpose         token_purpose   NOT NULL,
    is_used         BOOLEAN         NOT NULL DEFAULT FALSE,
    attempts        SMALLINT        NOT NULL DEFAULT 0,         -- max 5 wrong attempts
    expires_at      TIMESTAMP WITH TIME ZONE    NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT otp_max_attempts CHECK (attempts <= 5)
);

-- ---------------------------------------------------------------------------
-- TABLE: user_addresses
-- Req 3.2.5: Shipping address entry
-- Req 3.1.3: Update personal details (addresses)
-- ---------------------------------------------------------------------------
CREATE TABLE user_addresses (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Address fields
    full_name       VARCHAR(200)    NOT NULL,
    phone           VARCHAR(20)     NOT NULL,
    country         VARCHAR(100)    NOT NULL DEFAULT 'Ethiopia',
    region          VARCHAR(100)    NOT NULL,
    city            VARCHAR(100)    NOT NULL,
    subcity         VARCHAR(100),
    woreda          VARCHAR(100),
    street_address  TEXT            NOT NULL,
    postal_code     VARCHAR(20),
    additional_info TEXT,

    is_default      BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_addresses_updated_at
    BEFORE UPDATE ON user_addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: seller_profiles
-- Req 3.1.1: Seller registration with business information
-- Req 3.3.1: Seller dashboard overview statistics
-- Req 3.3.5: Seller wallet / earnings (wallet_balance, pending_balance)
-- Req 3.4.2: Approve/reject sellers
-- ---------------------------------------------------------------------------
CREATE TABLE seller_profiles (
    id                          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                     UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Business identity (Req 3.1.1: business information)
    business_name               VARCHAR(255)    NOT NULL,
    business_registration_no    VARCHAR(100),
    tax_id                      VARCHAR(100),
    business_type               VARCHAR(100),
    business_description        TEXT,
    business_address            TEXT,
    business_logo_url           TEXT,

    -- Banking info for withdrawals (Req 3.3.5)
    bank_name                   VARCHAR(200),
    bank_account_no             VARCHAR(50),
    bank_account_name           VARCHAR(200),

    -- Financial (Req 3.3.5: View earnings, pending balance)
    commission_rate             DECIMAL(5,2)    NOT NULL DEFAULT 10.00, -- platform %
    wallet_balance              DECIMAL(14,2)   NOT NULL DEFAULT 0.00,
    pending_balance             DECIMAL(14,2)   NOT NULL DEFAULT 0.00,
    total_earned                DECIMAL(14,2)   NOT NULL DEFAULT 0.00,

    -- Approval workflow (Req 3.4.2: Approve/reject sellers)
    status                      seller_status   NOT NULL DEFAULT 'pending',
    rejection_reason            TEXT,
    approved_by                 UUID            REFERENCES users(id) ON DELETE SET NULL,
    approved_at                 TIMESTAMP WITH TIME ZONE,

    -- Store settings
    store_slug                  VARCHAR(100)    UNIQUE,
    return_policy               TEXT,

    created_at                  TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),

    CONSTRAINT seller_profiles_user_unique UNIQUE (user_id),
    CONSTRAINT seller_commission_range CHECK (commission_rate BETWEEN 0 AND 100),
    CONSTRAINT seller_wallet_non_negative CHECK (wallet_balance >= 0),
    CONSTRAINT seller_pending_non_negative CHECK (pending_balance >= 0)
);

CREATE TRIGGER trg_seller_profiles_updated_at
    BEFORE UPDATE ON seller_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TABLE: seller_documents
-- Req 3.1.1: Seller registration with business information
-- Req 3.4.2: Approve/reject sellers (docs required for review)
-- ---------------------------------------------------------------------------
CREATE TABLE seller_documents (
    id              UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id       UUID                NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    doc_type        seller_doc_type     NOT NULL,
    file_url        TEXT                NOT NULL,
    file_name       VARCHAR(255),
    file_size_bytes BIGINT,
    is_verified     BOOLEAN             NOT NULL DEFAULT FALSE,
    verified_by     UUID                REFERENCES users(id) ON DELETE SET NULL,
    verified_at     TIMESTAMP WITH TIME ZONE,
    uploaded_at     TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- END OF MIGRATION 002
-- =============================================================================
