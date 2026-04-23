-- Migration 0004: Onboarding, Legal Documents, and Booking Page Configuration
-- Created: 2026-04-01

-- Onboarding status tracking
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legal_agb_accepted_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legal_datenschutz_accepted_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legal_avv_accepted_at TIMESTAMPTZ;

-- Customer legal acceptance
ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_agb_accepted_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS legal_datenschutz_accepted_at TIMESTAMPTZ;

-- Booking page configuration per location
CREATE TABLE IF NOT EXISTS booking_page_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,
  primary_color VARCHAR(7) DEFAULT '#059669',
  accent_color VARCHAR(7) DEFAULT '#10b981',
  background_color VARCHAR(7) DEFAULT '#f9fafb',
  text_color VARCHAR(7) DEFAULT '#111827',
  button_text VARCHAR(50) DEFAULT 'Jetzt buchen',
  welcome_text TEXT DEFAULT 'Willkommen! Wählen Sie einen Stellplatz.',
  logo_url TEXT,
  custom_css TEXT,
  hide_branding BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id)
);
CREATE INDEX IF NOT EXISTS idx_booking_config_tenant ON booking_page_config(tenant_id);
