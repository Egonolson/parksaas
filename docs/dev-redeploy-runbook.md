# ParkSaaS DEV Redeploy Runbook (hetzner-claw)

## Ziel
Reproduzierbarer Redeploy des DEV-Stacks unter:
- Host: `hetzner-claw`
- Pfad: `/mnt/HC_Volume_105075389/workspaces/project-manager/parksaas`
- URL: `https://parking.visionmakegpt.work`

## 1) Code synchronisieren

```bash
rsync -az --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.env' \
  /Users/sebastianhendrich/parksaas/ \
  hetzner-claw:/mnt/HC_Volume_105075389/workspaces/project-manager/parksaas/
```

## 2) Container neu bauen/starten

```bash
ssh hetzner-claw '
  cd /mnt/HC_Volume_105075389/workspaces/project-manager/parksaas &&
  docker compose up -d --build --force-recreate backend frontend nginx
'
```

## 3) Technische Verifikation (Server intern)

```bash
ssh hetzner-claw '
  docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}" | grep parksaas &&
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8400/ &&
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8400/api/v1/health &&
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8400/api/public/test-park-20260423
'
```

Soll:
- Landing: `200`
- Health: `200`
- Public API (Beispiel-Slug): `200`

## 4) Externe Verifikation (Domain)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://parking.visionmakegpt.work/
curl -s -o /dev/null -w "%{http_code}\n" https://parking.visionmakegpt.work/api/v1/health
```

Soll:
- beide `200`

## 5) Smoke-Flows im Browser

- Betreiber-Registrierung: `/register`
- Kunden-Registrierung: `/kunde/registrieren` (mit/ohne Tenant-Auswahl)
- Public Booking: `/park/<slug>`

## 6) Typische Fehlerbilder

- `502` auf Domain:
  - Nginx-Upstream/Backend-Port prüfen (`backend:3000`)
  - Backend-Container-Health und Logs prüfen

- Kundenregistrierung fordert Tenant:
  - Bei mehreren Betreibern muss Kunde einen Betreiber auswählen

- Public Booking 404 auf `/api/public/...`:
  - Nginx-Route `/api/public/` -> `backend:3000/api/v1/public/` prüfen

## 7) Logs

```bash
ssh hetzner-claw 'docker logs parksaas-backend --tail 200'
ssh hetzner-claw 'docker logs parksaas-nginx --tail 200'
ssh hetzner-claw 'docker logs parksaas-frontend --tail 200'
```
