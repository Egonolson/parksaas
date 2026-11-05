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

## Reviewkorrektur: vollständiger Zielzustand und CI

Kurzplan vor Abschluss: konkret reproduzierte Guardlücken mit roten Verhaltensfällen festhalten, vollständige Ziel-Fingerprints und effektive geerbte ENV binden, nur explizite Recreate-/Versionsmetadaten eng normalisieren und die Guardtests in der vorhandenen Node-26-CI ausführen. Keine Trigger/Rechte oder Produktionsautomation ändern.

Gegenproben zunächst rot: 17 akzeptierte Änderungen in 22 Tests (CPU/Ulimits/LogConfig/User/Cmd/Ports vor/nach Cutover, MAIL_MODE/unbekannte/App-Version-Defaults, Kandidat-User/Cmd). Danach 28/28 Tests grün; zusätzliche positive dynamische Endpoint-/Hostname-Recreation und negative statische IP-/Hostname-, ENV-Duplikat-/Compose-Versions- und Netz-ID/Gateway/Alias/Präfixfälle. Vollständige effektive ENV, rohe Preflight-Zielhashes und normalisierte vollständige Post-Fingerprints; Format 2 erzwingt neuen Freeze. Genauer Allowlistvertrag im Runbook.

Bestehende Node-26-Test-CI bekommt ausschließlich einen Python-Guardtestschritt; keine Pfadfilter vorhanden/erforderlich, Trigger/Rechte unverändert. Produktionsworkflow unverändert. Diese Korrektur braucht erneutes unabhängiges Review des finalen Heads; kein Server-/Docker-/Deploymentlauf.

Belegte Abschlussausgaben der Korrektur:
```text
Rot: Ran 22 tests / FAILED (failures=17)
Grün: Ran 28 tests / OK (beide Repositories)
Python AST and profile JSON OK
CI parsed; only ops-test step differs; triggers, permissions and existing gates unchanged
ParkenGessental: production workflow byte-identical
```
Keine App-/Dependencyänderung; daher ausschließlich betroffene Python-Suite und AST/JSON/YAML-/Diffprüfung erneut ausgeführt, keine unveränderten Appbuilds oder echten Dockerläufe.

Zusätzliche eigene Abschlusskorrekturen ebenfalls rot→grün: manuelle User/Cmd/Entrypoint/WorkingDir-Werte ohne reproduzierbare Compose-/Imagebasis (vier zunächst akzeptierte Fälle), positive Rückwegprüfung mit tatsächlichem Config.Image (zunächst falscher Referenzvergleich), sowie CLI-Live-Postcheck mit gefrorenen alten Image-IDs (zunächst fehlende alte Metadaten nach Cutover). Jetzt werden alle gefrorenen Rückweg-/Kandidatenimage-IDs zusätzlich lesend inspiziert und Vorwärts-/Rückweg-Prozessreferenzen korrekt geprüft. Der Livepfadtest mockt ausschließlich die lesenden Docker-Probes und bestätigt alle Commands; kein echter Dockeraufruf.

## Betriebspräzisierung: gebundene private Basis-/ENV-Snapshots

Kurzplan: optionale --runtime-base-file/--runtime-env-file mit absoluten privaten Dateipfaden ergänzen, Pfade/Inhaltshashes/identischen Overlaypfad im neuen Freezeformat 3 binden; vor erster Mutation Originalbytegleichheit und Originalcontainerprovenienz verlangen, danach Snapshotbasis+Overlay ausschließlich für Ziele. Arbeitsverzeichnis/Peers/alle übrigen Gates bleiben gleich. Rückweg darf Originaldateien weder lesen müssen noch überschreiben. Ursprung ist laut Root ausdrücklich <project_dir>/.env.

Rot vor Umsetzung: Ran 31 tests / FAILED (failures=7, errors=1), erwartete noch fehlende Pfad-/Hash-/Originaldriftbindung und Snapshotprovenienz. Grün: Ran 33 tests / OK (beide Repositories). Zusätzlicher CLI-/Collect-Verhaltenstest mit temporären ausschließlich synthetischen 0600-Dateien: explizite gefrorene -f/--env-file, ursprüngliches --project-directory; fehlende Originalbasis+.env nach Swap, erfolgreicher Postcheck, Originale unverändert fehlend. Falsche Vor-/Nachprovenienz, Pfad-/Hashwechsel und Originaldrift vor Cutover stoppen. Relative/symlink-/unprivate Snapshotdateien stoppen. Keine echte .env oder Runtimekonfiguration gelesen, kein Docker-/Serverlauf. CI führt die erweiterte bestehende Python-Suite unverändert mit aus. Unabhängiges Review des neuen Heads bleibt erforderlich.

Abschluss-Snapshotprüfung: CLI-Fall zusätzlich mit tatsächlichem simuliertem Rückweg vor/nach Austausch grün, Originaldateien bleiben fehlend. Vollständige Python-Suite 33/33; AST/Profile-JSON und Diffcheck erfolgreich. Vorhandene Node-26-CI deckt die erweiterten Tests ohne weitere Workflowänderung ab.

## Standards-Nachkorrektur: eigenständige Snapshotdateien

Kurzplan: vor Freeze/erstem Cutover kanonische Snapshotpfade bestimmen und deren Dateisystemidentität (st_dev/st_ino) gegen die jeweilige Originaldatei vergleichen; Aliase und Hardlinks ablehnen, Collector/Operator auf denselben kanonischen Pfad binden. Keine Originalauflösung/-stat/-Lektüre nach Swap oder beim Rückweg.

Rot: Ran 35 tests / FAILED (failures=5): Originalbasis- und Original-ENV-Aliase mit .., jeweils Hardlinks und fehlende Kanonisierung eigenständiger Kopien. Grün: Ran 35 tests / OK pro Repository. Positiver Test entfernt anschließend beide Originaldateien und bestätigt unveränderte Snapshot-Metadaten; bestehender CLI-Post-/Rückwegfall bleibt grün. Keine echten Konfigurationen/Dateien gelesen, keine Server-/Dockeraktion. Bestehendes Freezeformat 3 bleibt bestehen; Operator verwendet kanonische Pfade aus frozen.runtime_files. Unabhängige Nachprüfung des neuen Heads offen.
