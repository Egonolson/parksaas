-- Add auth fields to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(20) DEFAULT 'private' CHECK (customer_type IN ('private', 'business'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS street VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  contract_id UUID REFERENCES contracts(id),
  payment_id UUID REFERENCES payments(id),
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_net NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) DEFAULT 19.00,
  amount_tax NUMERIC(10,2) NOT NULL,
  amount_gross NUMERIC(10,2) NOT NULL,
  platform_fee_eur NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
  description TEXT,
  tenant_name VARCHAR(255),
  tenant_address TEXT,
  tenant_tax_id VARCHAR(50),
  customer_name VARCHAR(255),
  customer_address TEXT,
  customer_tax_id VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
