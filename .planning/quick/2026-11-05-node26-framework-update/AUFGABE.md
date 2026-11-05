---
status: vorbereitet
basis: fadb67d727a379d001f89f42dfe3a2919a4f47e7
branch: chore/node26-framework-update-20261105
---
# Node.js 26 und Framework-Aktualisierung

Ziel: Node.js 26.13.0 im Docker-Build und in der Laufzeit vorbereiten. Bestehende Next.js-16-Anwendungen auf Next.js 16.4.5 und React 19.3.1 anheben.
Dateien: backend/Dockerfile, frontend/Dockerfile sowie die zugehörigen npm-Lockdateien.
Verifikation: Installation mit Node 26, vorhandene Tests/Typecheck/Lint/Build soweit ohne reale Dienste ausführbar.
Risiko: Keine Auth-, Schema-, Rechte- oder Datenänderung. Keine Server-, Merge- oder Deployment-Aktion.
Testausnahme: Reine Versions-/Containerkonfiguration; kein zusätzlicher Test, der nur die gesetzte Versionsnummer nachbildet. Vorhandene Verhaltenstests und echte Builds sind maßgeblich.

## Offen
Linux-/musl-Containerbuild und QA-Laufzeitnachweis, unabhängiges Review, Merge und Deployment.

## Sicherheits-Patchrunde
Nur bestehende Versionsbereiche automatisch reparieren, keine erzwungenen Majorwechsel. Zod4.6.7, bei Chapter Nodemailer10.3.1 und bei Eschrich PostCSS8.5.32 sind gezielte Patches. Eschrich erhält die von Next16 erforderlichen JSX-/Typinclude-Einstellungen. Verbleibende Majorupdates und Lintbefunde werden vor einer Freigabe offengelegt.
