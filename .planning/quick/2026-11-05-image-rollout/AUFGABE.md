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

## Geprüfte Image-Quellrevision als eng begrenzte Metadatenausnahme

Kurzplan: ausschließlich org.opencontainers.image.revision normalisieren, wenn sie unverändert vom lokal per ID inspizierten Image geerbt wird und kein Compose-Runtimeoverride vorliegt. Keine allgemeine Labelfilterung; alle anderen Labels und rohen Preflight-Hashes behalten ihren Schutz.

Root-Metadatenbeleg outputs/rollout/remediation/parksaas-qa-image-label-diff.json (geschützter Taskbeleg, nicht hochgeladen): neue Parkimages besitzen zusätzlich das OCI-Quellrevisionslabel; Composeversion alt/aktuell jeweils 5.0.2. Die Quellinhalts-/Archivprüfung bleibt separat bei Root. OCI-Annotationsspezifikation und Docker-LABEL-Dokumentation konsultiert.

Rot: Ran 39 tests / FAILED (failures=1, errors=1): korrekter geerbter neuer Quellrevisionseintrag wurde abgewiesen; manueller Revisionseintrag ohne Image-Default zunächst akzeptiert. Grün: Ran 39 tests / OK. Positive alte-ohne/neue-geerbte-Revision und Rückweg; negative fehlende/manuelle Revision, Compose-Overrideänderung, zusätzliche OCI-Version/unbekannte/Routinglabels; roher Preflight-Hash bleibt wirksam. Umsetzung identisch in beiden Guards; keine Erweiterung für Peers, keine Workflow-/App-/Image-/Serveränderung. Neue unabhängige Nachprüfung erforderlich.

## Realer Docker-Leerwert: ausschließlich User

Kurzplan: nur im User-Prozessvergleich null und leeren String als keinen Override gleichsetzen, alle konkreten Benutzer und Cmd/Entrypoint/WorkingDir strikt lassen. Rohe vollständige Config-/Preflight-Fingerprints werden nicht normalisiert.

Root-Teilbeleg outputs/rollout/remediation/parksaas-process-default-diff.json (nicht ins Repo aufgenommen): ausschließlich Frontend-Config.User ist leerer String gegenüber ImageDefault.User=null, alle anderen Prozessfelder stimmen. Reale Form als synthetische Fixture reproduziert; Docker-USER-/Runtime-Dokumentation konsultiert.
Rot: Ran 41 tests / FAILED (errors=2), exakt unbegründete Ablehnung dieses User-Leerwerts und entsprechender leerer Kandidaten-Defaults. Grün: Ran 41 tests / OK. Vor-/Nachprüfung der realen Form, Ablehnung konkreter Benutzer root/node/0/Whitespace sowie unverändert strikte Cmd-/Entrypoint-/WorkingDir-Leerwertfälle. Bestehende Suite einschließlich aller Snapshot-/Label-/Rückwegfälle grün. Kein Workflow-/App-/Image-/Servereingriff. Gezielte unabhängige Peerprüfung bleibt erforderlich.

## Offizieller nginx-Modulversionsmarker ACME_VERSION

Kurzplan: ACME_VERSION zuerst anhand tatsächlichem Frontend und offiziellen nginx-Quellen klassifizieren, nur den belegten exakten Versionsmarker ergänzen; Defaultgleichheit, Compose-Overrides und alle unbekannten ENV weiter strikt.

Beleg: Park frontend/Dockerfile verwendet im Runtime-Stage nginx:alpine; kopiert statische Assets und nginx-frontend.conf, keine App-Templates. Begrenzte Quell-/Configsuche in frontend/src, Dockerfile, nginx-frontend.conf, deploy, scripts und tests/ops findet keine funktionale ACME_VERSION-Nutzung. Root-Metadaten outputs/rollout/remediation/parksaas-candidate-env-metadata.json melden ausschließlich diesen noch nicht erlaubten geerbten Versionsmarker, nicht explizit durch Compose gesetzt; keine privaten ENV-Werte gelesen oder ausgegeben. Das bestehende floating nginx:alpine erlaubt allein keinen historischen Imagebeweis; Root bindet die tatsächlichen geladenen Images/Archive/Quellbäume separat.

Primärquellen am 2026-11-05: https://github.com/nginx/docker-nginx/blob/master/mainline/alpine/Dockerfile und https://github.com/nginx/docker-nginx/blob/master/Dockerfile-alpine.template definieren ACME_VERSION als ENV und verwenden ihn im Paketversionsausdruck nginx-module-acme. https://github.com/nginx/docker-nginx/blob/master/README.md bestätigt das offizielle nginx-Imagerepository; https://nginx.org/en/docs/http/ngx_http_acme_module.html dokumentiert das Modul und seine eigenen Konfigurationsdirektiven. Der offizielle entrypoint/20-envsubst-on-templates.sh verwendet keine ACME_VERSION-spezifische Runtimefunktion, kann aber ENV generisch in vorhandene Templates substituieren; keine pauschale Wirkungslosigkeit von ENV behauptet.

Rot: Ran 43 tests / FAILED (errors=1), erwartetes candidate inherited environment changed bei belegtem geerbtem ACME-Versionwechsel. Grün: Ran 43 tests / OK. Vorwärts-/Rückweg mit exakten Image-Defaults, manueller abweichender Laufzeitwert und explizite Compose-Version weiter abgewiesen; zusätzliche ACME_VERSION_EXTRA/ACME_ISSUER/ACME_MODE negativ. Einziger Codeunterschied: exakter zusätzlicher VERSION_ENV-Name, keine Präfix- oder pauschale Defaultnormalisierung. Guards/Testdateien parallel identisch. Kein Docker-/Server-/Registry-Audit-/Deploymentlauf; Root prüft Belege/Peerreview vor Nutzung.
