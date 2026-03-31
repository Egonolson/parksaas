# ParkSaaS — Multi-Tenant Parking Management Platform

Parkplatz-Verwaltung als SaaS. Betreiber melden sich an, legen Stellplaetze und Standorte an,
und rechnen automatisch per SEPA via **Mollie Marketplace Payments** ab.

## Features

- **Multi-Tenant:** Jeder Parkplatzbetreiber hat sein eigenes Dashboard unter `/park/{slug}`
- **Mollie Marketplaces:** Mieter zahlen direkt an den Betreiber — ParkSaaS nimmt automatisch eine konfigurierbare Plattform-Gebühr (Standard: 5%)
- **SEPA Direct Debit:** Wiederkehrende monatliche Abbuchungen via Mollie Subscriptions
- **Multi-Standort:** Ein Betreiber kann beliebig viele Standorte mit je eigenen Stellplaetzen verwalten
- **Oeffentliche Buchungsseite:** Mieter buchen unter `yourdomain.com/park/{betreiber-slug}`
- **Vollstaendiges Dashboard:** Spots, Vertraege, Zahlungen, Auswertungen

## Mollie Marketplace Flow

```
1. Betreiber registriert sich → Mollie-Konto verbinden (OAuth Connect)
2. Betreiber legt Stellplaetze an
3. Mieter besucht /park/{slug} und bucht
4. Erster Mollie-Payment (0.01€ SEPA-Mandat) → nach Zahlung: monatliche Subscription
5. ParkSaaS behält applicationFee automatisch ein
6. Betreiber erhält Netto-Betrag direkt auf sein Mollie-Konto
```

## Tech Stack

- **Backend:** Node.js 22, Express, PostgreSQL 16
- **Frontend:** React 18, Vite, Tailwind CSS
- **Payments:** Mollie Marketplaces API
- **Infra:** Docker Compose, nginx

## Setup

### 1. Voraussetzungen

- Docker + Docker Compose
- Mollie Partner-Account (fuer Connect/Marketplace)
- Domain mit SSL

### 2. Mollie App anlegen

Unter https://www.mollie.com/dashboard/developers/applications eine neue App anlegen:
- Redirect URI: `https://yourdomain.com/api/mollie/connect/callback`
- Scopes: payments, subscriptions, mandates, customers, profiles, onboarding

### 3. Konfiguration

```bash
cp .env.example .env
# .env anpassen: MOLLIE_CLIENT_ID, MOLLIE_CLIENT_SECRET, JWT_SECRET, etc.
```

### 4. Starten

```bash
docker compose up -d
# Datenbank-Schema anlegen:
docker compose exec backend node src/db/migrate.js
```

### 5. Erster Betreiber

```bash
curl -X POST http://localhost:8000/api/v1/operators/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Mein Parkhaus GmbH","email":"admin@meinparkhaus.de","password":"sicher123!","slug":"mein-parkhaus"}'
```

Danach unter `/dashboard/settings` Mollie-Konto verbinden.

## Entwicklung

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend  
cd frontend && npm install && npm run dev
```

## API-Dokumentation

### Operator API (auth required)

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| POST | /api/v1/operators/register | Registrierung |
| POST | /api/v1/operators/login | Login |
| GET | /api/v1/operators/me | Eigene Daten |
| GET | /api/v1/operators/locations | Standorte |
| POST | /api/v1/operators/locations | Standort anlegen |
| GET | /api/v1/operators/spots | Stellplaetze |
| POST | /api/v1/operators/spots | Stellplatz anlegen |
| GET | /api/v1/operators/contracts | Vertraege |
| GET | /api/v1/operators/payments | Zahlungen |
| GET | /api/v1/operators/stats | Dashboard-Metriken |

### Mollie Connect

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | /api/mollie/connect | Mollie OAuth starten |
| GET | /api/mollie/connect/callback | OAuth Callback |
| GET | /api/mollie/connect/status | Onboarding-Status |
| DELETE | /api/mollie/connect | Verbindung trennen |

### Public API (kein Auth)

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | /park/:slug/info | Betreiber-Info |
| GET | /park/:slug/spots | Verfügbare Spots |
| POST | /park/:slug/book | Buchung starten |

### Webhooks

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| POST | /webhooks/:slug/mollie | Mollie Payment-Events |
| POST | /webhooks/:slug/mollie/subscription | Mollie Subscription-Events |

## Lizenz

MIT
