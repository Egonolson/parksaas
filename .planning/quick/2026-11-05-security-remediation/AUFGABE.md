---
status: vorbereitet
basis: 7649daa76abe9f59eb820e9bb45cca896396b740
branch: chore/node26-framework-update-20261105
---
# Abhängigkeiten für den Node-26-Rollout absichern

Ziel: Bekannte Backend-/Frontend-Befunde kompatibel schließen und Vite auf die unterstützte Linie 6.4 anheben; Router bei Bedarf gezielt auf reparierte 7.x statt ungeprüft auf 8.x.
Dateien: Paketmanifeste/Locks, gezielte Backend-/Frontend-Verhaltenstests und eine CI-Datei; keine fachlichen Quellcode-, Compose-, Auth-, Schema- oder Infrastrukturänderungen.
Test zuerst: Reproduzierbare qs-/UUID-Sicherheitsregressionen vor dem Update; API-Interceptor- und echte App-Routing-Tests vor/nach der Migration, vorhandene Backendtests und Frontendbuild.
Risiko: UUID 10→11 und Vite 5→6 sind begrenzte Majorwechsel; Router 6→7 erhält die deklarativen APIs. Produktionsdaten, Konten, E-Mails, Zahlungen und Migrationen werden nicht benutzt.
Nicht im Umfang: Server/Docker, Push/PR/Merge/Deployment oder formale Freigabe. Die bestehende isolierte Projektkopie und der beauftragte Feature-Branch werden weiterverwendet. Unabhängiges Review erfolgt durch den Hauptagenten separat.

## Prüfwege und Entscheidungen
- Offizielle npm-Metadaten: Axios 1.21.0, UUID 11.1.1 (weiterhin CommonJS), qs 6.16.1, Vite 6.4.5 und React-Plugin 4.7.0. Vorhandene React-18-/Tailwind-3-Struktur bleibt erhalten. Router 7.18.5 schließt zusätzlich den im ersten freigegebenen Abschlussaudit gemeldeten RSC-CSRF-Bereich bis 7.18.1 (die Anwendung verwendet keine RSC-APIs).
- Nodemon bleibt auf der bisherigen, nun explizit gepinnten Version 3.1.11: das zunächst aufgelöste 3.1.14 führte neu eine betroffene Minimatch-10-Abhängigkeit ein. Kein erzwungener Major-Override des Watchers.
- https://github.com/uuidjs/uuid/blob/v11.1.1/README.md
- https://raw.githubusercontent.com/ljharb/qs/v6.16.1/CHANGELOG.md
- https://v6.vite.dev/guide/migration.html und https://vite.dev/releases
- https://raw.githubusercontent.com/remix-run/react-router/react-router@7.18.0/docs/upgrading/v6.md
- https://github.com/advisories/GHSA-qwww-vcr4-c8h2

## Audit-Grenze
Baseline-Audits wurden vor der anschließend gemeldeten automatischen Ablehnung ausgeführt und unter outputs/rollout/remediation/parksaas protokolliert. Während der Sperre keine weiteren Audit-Abfragen oder indirekten Installationsaudits. Nach ausdrücklicher Nutzerfreigabe zur Übertragung der Paket-/Versions-/Abhängigkeitsmetadaten wurden Backend/Frontend vollständig und für Produktion erneut geprüft. Der erste Abschlusslauf ergab Backend-Produktion 0, aber neue Entwicklungs-Minimatch- und Router-RSC-Befunde; diese werden vor Abschluss gezielt nachgebessert. Installationen/CI ausdrücklich mit --no-audit; kein automatischer CI-Audit-Auslöser ohne entsprechende gesonderte Festlegung. Bekannte Bereiche werden zusätzlich offline gegen die vorliegenden Auditdaten geprüft.

## Verifikation
- Rot: vor den Abhängigkeitsänderungen scheitern drei der fünf gezielten Backendregressionen (zwei qs-Serialisierungscrashes, ein zu kleiner UUID-Ausgabepuffer); zwei Kompatibilitätsfälle bestehen. API-Interceptor-Baseline: fünf Tests bestanden.
- Grün nach sauberem `npm ci --no-audit --no-fund` in beiden Teilprojekten: Backend neun Tests in drei Suites; Frontend 16 Tests, davon elf mit echtem App-Routenbaum/BrowserRouter und isolierten Seiten/Auth-Fixtures sowie fünf mit der echten API-Instanz. Keine echten Dienste benutzt.
- Produktionsbuild mit Vite 6.4.5 erfolgreich: 128 Module. Vite-Konfiguration, Produktquellcode, API-Pfade und Rollenwachen unverändert. Keine mehrsegmentigen Splat-Routen, keine RouterProvider-/Fetcher-/RSC-Nutzung, keine innerhalb von Komponenten erzeugten React.lazy-Instanzen: die einschlägigen v7-Migrationsänderungen greifen hier nicht.
- Abschlussaudits nach letzter materieller Paketänderung: Backend-Produktion 0, Frontend-Produktion 0, Frontend vollständig 0; Backend vollständig sechs Low-Befunde ausschließlich in Jest/deepmerge, keine Moderate/High/Critical. Alle vier Aufrufe mit Schwelle `moderate` Exit 0.
- CI mit gepinnten Actions-SHAs: PR und main-Push, Node 26.13.0, saubere Installation ohne impliziten Audit, Backend-/Frontendtests, Frontendbuild und explizite Audit-Gates ab Moderate. Schreibrechte nur `contents: read`, kein Zeitplan und kein Deployment. YAML/Scope lokal geprüft; Remote-CI nicht ausgeführt.
- `git diff --check` sauber. Secret-Scan/Triage siehe SECURITY.md. Vollständige Laufprotokolle außerhalb des Repos: `outputs/rollout/remediation/parksaas/`.

## Bewusster Restbefund
`jest-config` 29.7.0 verwendet `deepmerge` 4.3.1 zum Zusammenführen lokaler Jest-`globals` (`node_modules/jest-config/build/normalize.js:205`). GHSA-gcqx-w48m-w2h4 hat keinen reparierten Release; npm schlägt einen unpassenden Rückschritt auf Jest 25.1.0 vor. Kein solcher Downgrade und kein verstecktes Override. Die sechs Low-Einträge sind die zugehörige Entwicklungskette (@jest/core, create-jest, deepmerge, jest, jest-cli, jest-config), nicht sechs unabhängig belegte Produktionslücken. Produktionsinstallation/Audit enthält diese Kette nicht. Quelle: https://github.com/advisories/GHSA-gcqx-w48m-w2h4

## Offen
Unabhängiges Review, finaler Linuxbuild, tatsächlicher Remote-CI-Lauf und QA-Abnahme. Das schon vorher vorhandene Backend-Lintskript scheitert wegen fehlender ESLint-Flat-Konfiguration (Exit 2); keine Regeln abgeschaltet und keine grüne Lintaussage. Projekt hat keine versionierten Git-Hooks. QA-Isolation, Empfängerbeschränkung sowie Backup-/Restore-/Rollbacknachweise bleiben beim Hauptagenten. Keine Server-/Docker-/Datenbankaktion und kein Push/Merge/Deployment durchgeführt.
