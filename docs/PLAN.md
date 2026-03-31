# ParkSaaS Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Multi-Tenant Parking Management SaaS — Parkplatzanbieter können sich registrieren,
Stellplaetze anlegen, und Mietzahlungen ueber Mollie Marketplace abwickeln.

**Architecture:**
- Node.js/Express Backend (basierend auf parken-gessental)
- PostgreSQL mit Multi-Tenancy via tenant_id auf allen Tabellen
- Mollie Marketplaces (Connect-Flow): Operator erhaelt direkte Zahlungen, Platform nimmt Commission
- React Frontend (Vite + Tailwind) fuer Operator-Dashboard und Public Booking Pages
- Supabase Auth fuer Operator-Login (oder JWT falls kein Supabase)

**Mollie Marketplace Flow:**
1. Operator registriert sich → Mollie OAuth-Onboarding (Mollie Connect)
2. Operator legt Stellplaetze an (Standort, Preis, Anzahl)
3. Mieter bucht → zahlt direkt an Operator via Mollie
4. Platform-Fee wird automatisch von Mollie einbehalten (splitPayments)

**Tech Stack:**
- Backend: Node.js 22, Express, PostgreSQL 16, @mollie/api-client
- Frontend: React 18, Vite, Tailwind CSS, React Router
- Auth: JWT + bcrypt fuer Operator-Login
- Payments: Mollie Marketplaces API (OAuth Connect + Split Payments)
- Infra: Docker Compose, nginx

---

## Phase 1: Fundament

### Task 1: Projektstruktur + package.json

**Objective:** Verzeichnisstruktur und Dependencies fuer Backend + Frontend anlegen.

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/server.js` (Skeleton)
- Create: `frontend/package.json`
- Create: `docker-compose.yml`
- Create: `.gitignore`
- Create: `.env.example`

**Backend-Dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "@mollie/api-client": "^4.0.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "dotenv": "^16.3.1",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.7",
    "axios": "^1.6.2",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

**Frontend-Dependencies:**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "@tanstack/react-query": "^5.17.0",
    "axios": "^1.6.2",
    "lucide-react": "^0.309.0"
  }
}
```

---

### Task 2: PostgreSQL Multi-Tenant Schema

**Objective:** Datenbankschema mit Multi-Tenancy fuer alle Kernentitaeten.

**File:** `backend/src/db/schema.sql`

**Schema:**

```sql
-- Tenants (Parkplatzbetreiber)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,           -- URL-Slug: /slug/buchen
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',             -- free | pro | enterprise
  commission_percent DECIMAL(5,2) DEFAULT 5.0, -- Platform-Fee
  -- Mollie Connect
  mollie_access_token TEXT,
  mollie_refresh_token TEXT,
  mollie_token_expires_at TIMESTAMPTZ,
  mollie_profile_id VARCHAR(100),              -- pfl_xxx
  mollie_onboarding_complete BOOLEAN DEFAULT FALSE,
  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Standorte (ein Tenant kann mehrere Standorte haben)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  postal_code VARCHAR(10) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stellplaetze
CREATE TABLE spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  spot_number VARCHAR(20) NOT NULL,
  label VARCHAR(100),
  monthly_rent_eur DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'available',     -- available | reserved | active | suspended
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, spot_number)
);

-- Kunden (pro Tenant isoliert)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_number VARCHAR(50),
  type VARCHAR(20) DEFAULT 'person',          -- person | company
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  mollie_customer_id VARCHAR(100),            -- cst_xxx (beim Tenant-Mollie-Account)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Vertraege
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  spot_id UUID NOT NULL REFERENCES spots(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  license_plate VARCHAR(20) NOT NULL,
  monthly_rent_eur DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'reserved',
  -- Mollie
  mollie_subscription_id VARCHAR(100),
  mollie_mandate_id VARCHAR(100),
  mollie_first_payment_id VARCHAR(100),
  -- Zeitraum
  start_date DATE,
  end_date DATE,
  reserved_until TIMESTAMPTZ,
  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zahlungen
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id),
  mollie_payment_id VARCHAR(100) UNIQUE NOT NULL,
  amount_eur DECIMAL(10,2) NOT NULL,
  platform_fee_eur DECIMAL(10,2),
  status VARCHAR(50) NOT NULL,
  payment_type VARCHAR(50),                  -- first | recurring | kaution
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signing Tokens fuer E-Signatur
CREATE TABLE signing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id),
  token VARCHAR(100) UNIQUE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes
CREATE INDEX idx_spots_tenant ON spots(tenant_id);
CREATE INDEX idx_spots_location ON spots(location_id);
CREATE INDEX idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX idx_contracts_spot ON contracts(spot_id);
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_tenants_slug ON tenants(slug);
```

---

### Task 3: DB-Verbindung + Tenant-Middleware

**Objective:** DB-Pool, Tenant-Lookup via Slug/JWT, Middleware fuer alle Routen.

**Files:**
- Create: `backend/src/db.js`
- Create: `backend/src/middleware/tenant.js`
- Create: `backend/src/middleware/auth.js`

**db.js:**
```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
module.exports = { pool, query: (text, params) => pool.query(text, params) };
```

**middleware/tenant.js:**
```javascript
// Liest tenant_slug aus URL-Param oder subdomain
// Ladet Tenant aus DB und haengt req.tenant an
async function resolveTenant(req, res, next) {
  const slug = req.params.tenantSlug || req.headers['x-tenant-slug'];
  if (!slug) return res.status(400).json({ error: 'Tenant not specified' });
  const { rows } = await db.query(
    'SELECT * FROM tenants WHERE slug = $1 AND is_active = TRUE', [slug]
  );
  if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
  req.tenant = rows[0];
  next();
}
```

**middleware/auth.js:**
```javascript
// JWT-Auth fuer Operator-Dashboard
// payload: { tenantId, email, role: 'operator' }
function requireOperator(req, res, next) { ... }
function requirePlatformAdmin(req, res, next) { ... }
```

---

## Phase 2: Operator-Onboarding

### Task 4: Tenant-Registrierung + Login

**Objective:** POST /api/operators/register + POST /api/operators/login

**File:** `backend/src/routes/operators.js`

```javascript
// POST /api/operators/register
// Body: { name, email, password, slug }
// 1. Slug-Validierung (lowercase, alphanumeric, hyphens, unique)
// 2. bcrypt.hash(password, 12)
// 3. INSERT INTO tenants
// 4. JWT zurueckgeben

// POST /api/operators/login
// Body: { email, password }
// 1. Tenant laden
// 2. bcrypt.compare
// 3. JWT (8h) zurueckgeben
```

---

### Task 5: Mollie Connect OAuth-Flow

**Objective:** Operator verbindet sein Mollie-Konto via OAuth.

**File:** `backend/src/routes/mollieConnect.js`

**Mollie Connect Flow:**
```
GET  /api/mollie/connect          → Redirect zu Mollie OAuth-URL
GET  /api/mollie/connect/callback → Code → Access Token → in tenants speichern
POST /api/mollie/connect/refresh  → Token erneuern
GET  /api/mollie/connect/status   → Onboarding-Status pruefen
```

**Mollie OAuth-URLs:**
```
Authorization: https://www.mollie.com/oauth2/authorize
Token:         https://api.mollie.com/oauth2/tokens
```

**Scopes benoetigt:**
```
payments.read payments.write subscriptions.read subscriptions.write
mandates.read mandates.write customers.read customers.write
profiles.read onboarding.read
```

**Token-Exchange:**
```javascript
async function exchangeCode(code) {
  const response = await axios.post('https://api.mollie.com/oauth2/tokens', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.MOLLIE_REDIRECT_URI,
    client_id: process.env.MOLLIE_CLIENT_ID,
    client_secret: process.env.MOLLIE_CLIENT_SECRET,
  });
  return response.data; // { access_token, refresh_token, expires_in }
}
```

---

## Phase 3: Standorte + Stellplaetze

### Task 6: Locations CRUD

**Objective:** Operator kann Standorte anlegen/bearbeiten/loeschen.

**File:** `backend/src/routes/locations.js`

```
GET    /api/operators/:tenantSlug/locations
POST   /api/operators/:tenantSlug/locations
PUT    /api/operators/:tenantSlug/locations/:id
DELETE /api/operators/:tenantSlug/locations/:id
```

Alle Routen: `requireOperator` Middleware + `tenant_id` Filter auf DB-Queries.

---

### Task 7: Spots CRUD

**Objective:** Operator kann Stellplaetze pro Standort verwalten.

**File:** `backend/src/routes/spots.js`

```
GET    /api/operators/:tenantSlug/spots          → alle Spots des Tenants
GET    /api/operators/:tenantSlug/spots/:locId   → Spots eines Standorts
POST   /api/operators/:tenantSlug/spots          → Spot anlegen
PUT    /api/operators/:tenantSlug/spots/:id      → Preis/Label aendern
DELETE /api/operators/:tenantSlug/spots/:id      → Spot deaktivieren
```

**Public Endpoint (fuer Buchungsseite):**
```
GET /park/:tenantSlug/spots → verfuegbare Spots (is_active + available)
```

---

## Phase 4: Buchungsflow

### Task 8: Booking API

**Objective:** Mieter bucht Stellplatz (adaptiert aus parken-gessental).

**File:** `backend/src/routes/booking.js`

**Flow:**
```
POST /park/:tenantSlug/book
Body: { spotId, name, email, phone, licensePlate, address }

1. Spot laden + pruefen (SELECT FOR UPDATE)
2. Spot reservieren (status='reserved', reserved_until = NOW() + 30min)
3. Customer anlegen (beim Tenant-Mollie-Account: createMollieCustomer)
4. Contract anlegen (status='reserved')
5. First Payment erstellen (0.01€ SEPA-Mandat via Marketplace-API)
6. Signing-Token generieren
7. Redirect-URL zurueckgeben
```

**Mollie Marketplace Split-Payment:**
```javascript
// Platform nimmt commission_percent vom monthly_rent_eur
const fee = (rent * tenant.commission_percent) / 100;

await mollieClient.payments.create({
  amount: { currency: 'EUR', value: '0.01' },
  customerId: customer.mollie_customer_id,
  sequenceType: 'first',
  description: `Stellplatz ${spot.spot_number} - ${tenant.name}`,
  webhookUrl: `${process.env.API_BASE}/webhooks/${tenant.slug}/mollie`,
  redirectUrl: `${process.env.FRONTEND_BASE}/park/${tenant.slug}/danke`,
  // Marketplace: Zahlung geht an Tenant-Account
  profileId: tenant.mollie_profile_id,
  applicationFee: {
    amount: { currency: 'EUR', value: fee.toFixed(2) },
    description: `ParkSaaS Platform Fee (${tenant.commission_percent}%)`
  }
});
```

---

### Task 9: Mollie Webhook Handler

**Objective:** Zahlungsevents verarbeiten (adaptiert aus parken-gessental).

**File:** `backend/src/routes/webhook.js`

```
POST /webhooks/:tenantSlug/mollie
```

Events:
- `payment.paid` (first) → Mandate speichern → Subscription anlegen → Contract aktiv
- `payment.paid` (recurring) → Payment loggen
- `payment.failed` → Contract/Spot suspended
- `subscription.canceled` → Contract ended, Spot available

Tenant-Kontext: Webhook URL enthaelt Slug → Tenant laden → Mollie-Client mit Tenant-Token.

---

## Phase 5: Operator-Dashboard (Frontend)

### Task 10: React App Grundgeruest

**Objective:** Vite + React + Tailwind + React Router Setup

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/vite.config.js`

**Routen:**
```
/                          → Landing Page
/register                  → Operator-Registrierung
/login                     → Operator-Login
/dashboard                 → Operator-Dashboard (requireAuth)
/dashboard/locations       → Standorte verwalten
/dashboard/spots           → Stellplaetze verwalten
/dashboard/contracts       → Vertraege Uebersicht
/dashboard/payments        → Zahlungen Uebersicht
/dashboard/settings        → Einstellungen + Mollie-Connect
/park/:slug                → Public Buchungsseite (fuer Mieter)
/park/:slug/buchen         → Buchungsformular
/park/:slug/danke          → Danke-Seite nach Buchung
```

---

### Task 11: Operator-Dashboard UI

**Objective:** Kompaktes Dashboard mit allen Key-Metriken.

**Files:**
- Create: `frontend/src/pages/Dashboard.jsx`
- Create: `frontend/src/pages/Locations.jsx`
- Create: `frontend/src/pages/Spots.jsx`
- Create: `frontend/src/pages/Contracts.jsx`
- Create: `frontend/src/pages/Payments.jsx`
- Create: `frontend/src/pages/Settings.jsx`
- Create: `frontend/src/components/Layout.jsx`
- Create: `frontend/src/components/StatsCard.jsx`
- Create: `frontend/src/components/SpotGrid.jsx`

**Dashboard Metrics:**
- Gesamt-Spots / Belegt / Verfuegbar
- Monatlicher Umsatz (aktive Vertraege)
- Ausstehende Zahlungen
- Mollie-Onboarding-Status

---

### Task 12: Public Buchungsseite

**Objective:** Mieter-Buchungsseite unter /park/:slug

**Files:**
- Create: `frontend/src/pages/PublicBooking.jsx`
- Create: `frontend/src/pages/BookingForm.jsx`
- Create: `frontend/src/pages/BookingSuccess.jsx`
- Create: `frontend/src/components/SpotSelector.jsx`

**Features:**
- Standort-Info + Karte (optional)
- Spot-Grid (verfuegbar/belegt/reserviert)
- Mehrstufiges Buchungsformular
- Weiterleitung zu Mollie-Zahlung

---

## Phase 6: Deployment

### Task 13: Docker Compose + nginx

**Objective:** Vollstaendige Docker-Konfiguration fuer Produktion.

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `nginx.conf`
- Create: `.env.example`

**Services:**
```yaml
services:
  db:      postgres:16
  backend: Node 22 app
  frontend: nginx serving built React
  nginx:   Reverse Proxy
```

---

## Umgebungsvariablen (.env.example)

```
# Database
DATABASE_URL=postgresql://parksaas:password@db:5432/parksaas

# JWT
JWT_SECRET=min-32-chars-random-secret

# Mollie Connect (Platform-Account)
MOLLIE_CLIENT_ID=app_xxx
MOLLIE_CLIENT_SECRET=app_secret_xxx
MOLLIE_REDIRECT_URI=https://yourdomain.com/api/mollie/connect/callback

# Platform
API_BASE=https://api.yourdomain.com
FRONTEND_BASE=https://yourdomain.com
PLATFORM_NAME=ParkSaaS

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Platform-Admin
ADMIN_EMAIL=admin@parksaas.com
ADMIN_PASSWORD_HASH=bcrypt-hash
```
