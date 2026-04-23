-- =============================================================================
-- Migration: 0001_parking_durations
-- Adds parking_durations table for flexible parking duration pricing
-- =============================================================================

CREATE TABLE IF NOT EXISTS parking_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  duration_type VARCHAR(20) NOT NULL,
  label VARCHAR(50) NOT NULL,
  price_eur NUMERIC(10,2) NOT NULL CHECK (price_eur > 0),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, duration_type)
);

CREATE INDEX IF NOT EXISTS idx_parking_durations_location_id ON parking_durations (location_id);
CREATE INDEX IF NOT EXISTS idx_parking_durations_tenant_id ON parking_durations (tenant_id);
