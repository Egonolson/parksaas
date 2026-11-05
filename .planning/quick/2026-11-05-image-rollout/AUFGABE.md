---
status: umgesetzt-review-offen
basis: e30d01a326f106ec8b21588b52f969a417bae8d2
---
# Gezielten QA→Prod-Imagewechsel vorbereiten

Ziel: vorhandene gehärtete Stacks durch einen versionierten Image-only-Overlay und einen rein lesenden lokalen Guard vor unbeabsichtigtem Port-/Netzwerk-/Konfigurationswechsel schützen.
Dateien: Overlay, deklarative QA-/Prod-Profile, Vergleichshelper; Verhaltenstests, Runbook und Quick-Nachweise. Keine Produktlogik, Auth, Schemas, Datenbanken oder bestehenden Workflows ändern.
Test zuerst: synthetische Compose-/Inspect-Daten für erlaubten Imagewechsel sowie Drift, öffentliche Ports, falsche Netzwerke, mutable Images und insbesondere gestoppte retained Container mit identischen Service-Labels. Keine echten Dienste oder Zugangsdaten.
Risiko: Compose entfernt unter Umständen Zielservice-Dubletten selbst mit --no-deps; bei mehr als einem Zielcontainer zwingender Abbruch, niemals löschen oder automatisch bereinigen.
Nicht im Umfang: Servermutation, Dockeraktion, Push, Merge oder Deployment. Root führt alle späteren Aktionen kontrolliert aus. QA-Mail-/Datenisolation bleibt bis zu positivem Nachweis offen; fehlende SMTP-Umgebungsvariablen sind kein Nachweis.

## Ausgangspunkte

Vorhandene Inventare vom 2026-11-05 und gefilterte Root-Leseprobe `outputs/rollout/remediation/park-gessental-runtime-safe.json` bilden die benannte Ausgangsbasis, keine Behauptung einer künftig unveränderten Runtime.
Vor jeder Aktion vollständige aktuelle Containerliste inklusive gestoppter retained Container lesen, gefrorene Config/Topologie erneut vergleichen und bei Drift abbrechen. Keine Repo-Compose-Defaults auf den Server kopieren.
Versionswechsel ausschließlich über lokal geladene, per ID geprüfte Linux/amd64-Images; Rückweg über die gesicherten alten Image-IDs und dieselbe Config, nicht über einen ungeprüften Git-Rebuild.

## Offen

Lokale Umsetzung und Prüfungen abgeschlossen; unabhängiges Review, Sicherung/Restoreprobe, QA-Isolation und Serverausführung bleiben bei Root.

## Umsetzung und lokaler Nachweis

- Versionierter Image-only-Overlay und getrennte bekannte QA-/Prod-Profile erstellt. Der Helper sammelt mit ausdrücklichem --live ausschließlich lesende Docker-Metadaten, hält aufgelöste private Config im Prozessspeicher und gibt nur Hashes/Identitäten oder redigierte Stop-Meldungen aus.
- Baseline: ohne Guards elf negative Fälle erwartungsgemäß rot (RolloutError nicht ausgelöst); zusätzlicher Kandidaten-ID-Fall vor Korrektur rot. Nach Präzisierung der Peer-Regel auch Ziel-Identitätsdrift zuerst rot, danach behoben.
- Finale Prüfung: 19/19 synthetische Verhaltenstests pro Repository bestanden, keine übersprungen. Enthalten sind Zielretains, Erhalt von Nicht-Ziel-Retains/Peer-Starts, Ports/Netzwerke/Mounts/Hardening/ENV, freigegebene Image-ID/Plattform, konkurrierender Austausch, CLI-Redaktion und Vorwärts-/Rückweg.
- Python-AST und Profile-JSON erfolgreich geprüft; git diff --check sauber. Keine Produktdatei, Abhängigkeit, bestehende CI/Hook- oder Composebasis geändert. Kein Build oder echter Docker-/Serverlauf ausgeführt.
- Root-Präzisierung: nur Mehrfachbelegung tatsächlich aktualisierter Zielservices ist eine harte Compose-Sperre. Nicht-Ziel-Retains dürfen unverändert bestehen; sämtliche Peers werden eingefroren und nachher gegen IDs/Starts sowie Metadaten geprüft.
- Park nur backend/frontend; nginx bleibt mit Loopback8400 erhalten, DB mit Loopback5472. Alter nginx-Retain ist kein Ziel. Ein eventuell nötiger gezielter Proxy-Reload ist eine separate Root-Aktion.
- Ausführliche lokale Belege: outputs/rollout/remediation/park-gessental-plan/ in der Taskwurzel. Dort auch ausschließlich aus vorhandenen Metadaten abgeleitete retained-Zählungen mit Zeitstempel; keine aktuelle Serverprüfung daraus behauptet.

## Noch offen

Unabhängiges Review, echte lesende Root-Vorprüfung inklusive aller Container, passende Artefaktprovenienz, Sicherung/isolierte Restoreprobe, positive QA-Mail-/Datenisolation und sämtliche tatsächlichen Serveraktionen. Kein Blocker durch retained Nicht-Ziel-Proxy allein; frische Zielzählung bleibt erforderlich.
