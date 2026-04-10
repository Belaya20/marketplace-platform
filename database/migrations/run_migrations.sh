#!/bin/bash
# =============================================================================
# run_migrations.sh — Execute all migrations in exact dependency order
# Usage:
#   chmod +x run_migrations.sh
#   ./run_migrations.sh
#
# Environment variables (set before running):
#   DB_HOST     PostgreSQL host        (default: localhost)
#   DB_PORT     PostgreSQL port        (default: 5432)
#   DB_NAME     Database name          (default: ecommerce_db)
#   DB_USER     Superuser username     (default: postgres)
#   DB_PASSWORD Superuser password
# =============================================================================

set -euo pipefail   # Exit on error, undefined var, or pipe failure

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ecommerce_db}"
DB_USER="${DB_USER:-postgres}"
MIGRATIONS_DIR="$(dirname "$0")/migrations"

export PGPASSWORD="${DB_PASSWORD:-}"

# ---------------------------------------------------------------------------
# Colour output
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight: check psql is available
# ---------------------------------------------------------------------------
command -v psql >/dev/null 2>&1 || error "psql not found. Install PostgreSQL client tools."

# ---------------------------------------------------------------------------
# Step 1: Create database if it doesn't exist
# ---------------------------------------------------------------------------
info "Checking if database '${DB_NAME}' exists..."
DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")

if [ "$DB_EXISTS" != "1" ]; then
    info "Creating database '${DB_NAME}'..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
        -c "CREATE DATABASE ${DB_NAME} ENCODING='UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8' TEMPLATE=template0;"
    info "Database created."
else
    warn "Database '${DB_NAME}' already exists — skipping creation."
fi

# ---------------------------------------------------------------------------
# Step 2: Create migration tracking table
# ---------------------------------------------------------------------------
info "Ensuring migration tracking table exists..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id              SERIAL PRIMARY KEY,
    filename        VARCHAR(255) NOT NULL UNIQUE,
    applied_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum        VARCHAR(64)
);
SQL

# ---------------------------------------------------------------------------
# Step 3: Run each migration file in order
# ---------------------------------------------------------------------------
MIGRATION_FILES=(
    "001_extensions_and_enums.sql"
    "002_identity_auth.sql"
    "003_catalogue.sql"
    "004_products_variants.sql"
    "005_cart_wishlist_promotions.sql"
    "006_orders_payments_returns.sql"
    "007_wallet_reviews_notifications.sql"
    "008_cms_search_analytics.sql"
    "009_indexes.sql"
    "010_triggers_functions.sql"
    "011_rls_policies.sql"
    "012_seed_data.sql"
)

for FILE in "${MIGRATION_FILES[@]}"; do
    FILEPATH="${MIGRATIONS_DIR}/${FILE}"

    if [ ! -f "$FILEPATH" ]; then
        error "Migration file not found: ${FILEPATH}"
    fi

    # Check if already applied
    APPLIED=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -tAc "SELECT 1 FROM schema_migrations WHERE filename='${FILE}'")

    if [ "$APPLIED" = "1" ]; then
        warn "Already applied: ${FILE} — skipping."
        continue
    fi

    info "Applying: ${FILE}..."

    # Compute checksum
    CHECKSUM=$(sha256sum "$FILEPATH" | awk '{print $1}')

    # Run inside a transaction — if it fails, the whole file rolls back
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --set ON_ERROR_STOP=on \
        -f "$FILEPATH"

    # Record as applied
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -c "INSERT INTO schema_migrations (filename, checksum) VALUES ('${FILE}', '${CHECKSUM}');"

    info "Done: ${FILE}"
done

info ""
info "============================================="
info " All migrations applied successfully."
info " Database '${DB_NAME}' is ready."
info "============================================="
info ""
info "NEXT STEPS:"
info "  1. Set a strong password for ecom_api role:"
info "     ALTER ROLE ecom_api PASSWORD 'your_strong_password';"
info "  2. Change the admin user password via the application."
info "  3. Set DB_PASSWORD env var in your API .env file."
info "  4. Verify with: psql -d ${DB_NAME} -c '\dt'"
