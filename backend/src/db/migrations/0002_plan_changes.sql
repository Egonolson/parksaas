-- =============================================================================
-- Migration: 0002_plan_changes
-- Remove Mollie dependency, update plans, add invoice fields
-- =============================================================================

-- Update existing tenants to valid plans
UPDATE tenants SET plan = 'professional' WHERE plan IN ('starter', 'growth');

-- We can't easily alter enums in PostgreSQL, so we'll just ensure new registrations use correct plans
-- The app will validate on registration

-- Add invoice-related fields
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS invoice_prefix VARCHAR(10) DEFAULT 'RE';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS next_invoice_number INTEGER DEFAULT 1;
