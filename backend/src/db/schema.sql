-- =============================================================================
-- ParkSaaS Database Schema
-- PostgreSQL >= 14
-- Run via: node src/db/migrate.js
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE spot_status AS ENUM ('available', 'reserved', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_status AS ENUM ('reserved', 'pending_mandate', 'active', 'suspended', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM ('first', 'recurring');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE customer_type AS ENUM ('private', 'business');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tenant_plan AS ENUM ('starter', 'growth', 'professional', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- TENANTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     VARCHAR(255)  NOT NULL,
  slug                     VARCHAR(100)  NOT NULL,
  email                    VARCHAR(255)  NOT NULL,
  password_hash            VARCHAR(255)  NOT NULL,
  plan                     tenant_plan   NOT NULL DEFAULT 'starter',
  commission_percent       NUMERIC(5,2)  NOT NULL DEFAULT 5.00
                             CHECK (commission_percent >= 0 AND commission_percent <= 100),
  -- Mollie OAuth tokens (encrypted at rest recommended)
  mollie_access_token      TEXT,
  mollie_refresh_token     TEXT,
  mollie_token_expires_at  TIMESTAMPTZ,
  mollie_profile_id        VARCHAR(100),
  mollie_onboarding_complete BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active                BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT tenants_slug_unique  UNIQUE (slug),
  CONSTRAINT tenants_email_unique UNIQUE (email),
  CONSTRAINT tenants_slug_format  CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug     ON tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_email    ON tenants (email);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON tenants (is_active);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- LOCATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS locations (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name         VARCHAR(255)  NOT NULL,
  address      VARCHAR(500)  NOT NULL,
  city         VARCHAR(100)  NOT NULL,
  postal_code  VARCHAR(20)   NOT NULL,
  description  TEXT,
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_tenant_id  ON locations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_is_active  ON locations (tenant_id, is_active);

DROP TRIGGER IF EXISTS locations_updated_at ON locations;
CREATE TRIGGER locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SPOTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS spots (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID          NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  location_id       UUID          NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  spot_number       VARCHAR(50)   NOT NULL,
  label             VARCHAR(255),
  monthly_rent_eur  NUMERIC(10,2) NOT NULL CHECK (monthly_rent_eur > 0),
  status            spot_status   NOT NULL DEFAULT 'available',
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT spots_number_unique_per_location UNIQUE (tenant_id, location_id, spot_number)
);

CREATE INDEX IF NOT EXISTS idx_spots_tenant_id    ON spots (tenant_id);
CREATE INDEX IF NOT EXISTS idx_spots_location_id  ON spots (location_id);
CREATE INDEX IF NOT EXISTS idx_spots_status       ON spots (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_spots_is_active    ON spots (tenant_id, is_active);

DROP TRIGGER IF EXISTS spots_updated_at ON spots;
CREATE TRIGGER spots_updated_at
  BEFORE UPDATE ON spots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- CUSTOMERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID          NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  customer_number    VARCHAR(50)   NOT NULL,
  type               customer_type NOT NULL DEFAULT 'private',
  name               VARCHAR(255)  NOT NULL,
  email              VARCHAR(255)  NOT NULL,
  phone              VARCHAR(50),
  address            TEXT,
  mollie_customer_id VARCHAR(100),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT customers_email_unique_per_tenant UNIQUE (tenant_id, email),
  CONSTRAINT customers_number_unique_per_tenant UNIQUE (tenant_id, customer_number)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_id  ON customers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_email      ON customers (tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_customers_number     ON customers (tenant_id, customer_number);
CREATE INDEX IF NOT EXISTS idx_customers_mollie_id  ON customers (mollie_customer_id) WHERE mollie_customer_id IS NOT NULL;

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- CONTRACTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS contracts (
  id                      UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID             NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  spot_id                 UUID             NOT NULL REFERENCES spots(id) ON DELETE RESTRICT,
  customer_id             UUID             NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  license_plate           VARCHAR(20)      NOT NULL,
  monthly_rent_eur        NUMERIC(10,2)    NOT NULL CHECK (monthly_rent_eur > 0),
  status                  contract_status  NOT NULL DEFAULT 'reserved',
  mollie_subscription_id  VARCHAR(100),
  mollie_mandate_id       VARCHAR(100),
  mollie_first_payment_id VARCHAR(100),
  start_date              DATE             NOT NULL,
  end_date                DATE,
  reserved_until          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT contracts_end_after_start CHECK (end_date IS NULL OR end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant_id    ON contracts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_spot_id      ON contracts (spot_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_id  ON contracts (customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status       ON contracts (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_subscription ON contracts (mollie_subscription_id) WHERE mollie_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_first_payment ON contracts (mollie_first_payment_id) WHERE mollie_first_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_reserved_until ON contracts (reserved_until) WHERE status = 'reserved';

DROP TRIGGER IF EXISTS contracts_updated_at ON contracts;
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PAYMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID          NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contract_id        UUID          NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  mollie_payment_id  VARCHAR(100)  NOT NULL,
  amount_eur         NUMERIC(10,2) NOT NULL CHECK (amount_eur > 0),
  platform_fee_eur   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (platform_fee_eur >= 0),
  status             VARCHAR(50)   NOT NULL,
  payment_type       payment_type  NOT NULL,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT payments_mollie_id_unique UNIQUE (mollie_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id     ON payments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract_id   ON payments (contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_mollie_id     ON payments (mollie_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status        ON payments (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at       ON payments (tenant_id, paid_at) WHERE paid_at IS NOT NULL;

DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SIGNING TOKENS
-- Contract signing link tokens (valid 7 days by default)
-- =============================================================================

CREATE TABLE IF NOT EXISTS signing_tokens (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  contract_id  UUID         NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  token        VARCHAR(128) NOT NULL,
  used         BOOLEAN      NOT NULL DEFAULT FALSE,
  used_at      TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT signing_tokens_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_signing_tokens_token       ON signing_tokens (token);
CREATE INDEX IF NOT EXISTS idx_signing_tokens_contract_id ON signing_tokens (contract_id);
CREATE INDEX IF NOT EXISTS idx_signing_tokens_expires_at  ON signing_tokens (expires_at) WHERE NOT used;

-- =============================================================================
-- AUDIT LOG (append-only, no updates/deletes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL    PRIMARY KEY,
  tenant_id    UUID         REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id     UUID,                    -- tenant or platform admin ID
  actor_type   VARCHAR(50)  NOT NULL,   -- 'tenant', 'platform_admin', 'system', 'webhook'
  action       VARCHAR(100) NOT NULL,   -- e.g. 'contract.created', 'payment.received'
  resource     VARCHAR(100),            -- e.g. 'contract', 'payment'
  resource_id  UUID,
  old_data     JSONB,
  new_data     JSONB,
  metadata     JSONB,                   -- IP, user-agent, request-id, etc.
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id    ON audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id     ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action       ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource     ON audit_log (resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at   ON audit_log (created_at);

-- Prevent modifications to audit_log
CREATE OR REPLACE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- =============================================================================
-- SCHEMA VERSION TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(255) PRIMARY KEY,
  applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
