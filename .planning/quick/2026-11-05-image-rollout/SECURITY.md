# Sicherheitsnachweis und Grenzen

Ausschließlich Rollout-Vorbereitung: Image-Overlay, deklarative Profile, lesender Guard, synthetische Tests und Runbook. Keine Produkt-/Auth-/Schemaänderung und keine bestehende Infrastrukturdatei oder Automation geändert.

Der Guard gibt aufgelöste Umgebungswerte niemals aus, speichert keine rohe Inspect-/Composekonfiguration und führt keine mutierende Docker-/Shellaktion aus. Dockerlesezugriff ist ein ausdrücklicher --live-Modus; ohne ihn werden lokale JSON-Fixtures geprüft. Plattform- und konkrete Kandidaten-/Rückweg-IDs sind gebunden; Retain-Dubletten von Zielservices stoppen, unberührte Peers werden einschließlich gestoppter Retains geschützt.

Keine .env gelesen, keine realen Accounts, Nachrichten, Zahlungen, Datenbank- oder Kundendaten verwendet. Lokale Tests prüfen echte JSON-/CLI-Verträge; sie sind kein Linux-/Compose-/Server- oder Isolationsnachweis. Vorhandene Root-Metadaten sind zeitgebundene Teilbelege.

Staging-Prüfung abgeschlossen: 0 typisierte Funde, 1 Wortmuster-Treffer, 8 Dateien. Der Treffer ist ausschließlich der beschreibende Kommentar in scripts/check-image-rollout.py:256 zur Unterdrückung vertraulicher Fehlerausgaben, kein Wert. Kein unverändert grünes Scan-Gate behauptet (Exit 1 wegen Wortmuster); Triage vor Commit dokumentiert. Diffcheck erfolgreich.

## Reviewkorrektur: vollständiger Zielzustand und CI

Kurzplan vor Abschluss: konkret reproduzierte Guardlücken mit roten Verhaltensfällen festhalten, vollständige Ziel-Fingerprints und effektive geerbte ENV binden, nur explizite Recreate-/Versionsmetadaten eng normalisieren und die Guardtests in der vorhandenen Node-26-CI ausführen. Keine Trigger/Rechte oder Produktionsautomation ändern.

Gegenproben zunächst rot: 17 akzeptierte Änderungen in 22 Tests (CPU/Ulimits/LogConfig/User/Cmd/Ports vor/nach Cutover, MAIL_MODE/unbekannte/App-Version-Defaults, Kandidat-User/Cmd). Danach 28/28 Tests grün; zusätzliche positive dynamische Endpoint-/Hostname-Recreation und negative statische IP-/Hostname-, ENV-Duplikat-/Compose-Versions- und Netz-ID/Gateway/Alias/Präfixfälle. Vollständige effektive ENV, rohe Preflight-Zielhashes und normalisierte vollständige Post-Fingerprints; Format 2 erzwingt neuen Freeze. Genauer Allowlistvertrag im Runbook.

Bestehende Node-26-Test-CI bekommt ausschließlich einen Python-Guardtestschritt; keine Pfadfilter vorhanden/erforderlich, Trigger/Rechte unverändert. Produktionsworkflow unverändert. Diese Korrektur braucht erneutes unabhängiges Review des finalen Heads; kein Server-/Docker-/Deploymentlauf.

Nachscan der sieben Korrekturdateien: 0 typisierte Funde; 1 Wortmuster ausschließlich in scripts/check-image-rollout.py (abschließende Fehlerunterdrückung), beschreibender Kommentar zur Unterdrückung vertraulicher Fehlerausgaben. Kein Wert und kein neuer Fund. Scanexit 1 deshalb ausdrücklich triagiert, kein ungeprüftes Nulltreffer-Gate behauptet. CLI-Redaktion/Fixture-Werte bleiben getestet. CI-Parsevergleich bestätigt ausschließlich zusätzlichen Guardtestschritt, unveränderte Trigger/Rechte/sonstige Gates; Gessental deploy-prod.yml bytegleich.

## Betriebspräzisierung: gebundene private Basis-/ENV-Snapshots

Kurzplan: optionale --runtime-base-file/--runtime-env-file mit absoluten privaten Dateipfaden ergänzen, Pfade/Inhaltshashes/identischen Overlaypfad im neuen Freezeformat 3 binden; vor erster Mutation Originalbytegleichheit und Originalcontainerprovenienz verlangen, danach Snapshotbasis+Overlay ausschließlich für Ziele. Arbeitsverzeichnis/Peers/alle übrigen Gates bleiben gleich. Rückweg darf Originaldateien weder lesen müssen noch überschreiben. Ursprung ist laut Root ausdrücklich <project_dir>/.env.

Rot vor Umsetzung: Ran 31 tests / FAILED (failures=7, errors=1), erwartete noch fehlende Pfad-/Hash-/Originaldriftbindung und Snapshotprovenienz. Grün: Ran 33 tests / OK (beide Repositories). Zusätzlicher CLI-/Collect-Verhaltenstest mit temporären ausschließlich synthetischen 0600-Dateien: explizite gefrorene -f/--env-file, ursprüngliches --project-directory; fehlende Originalbasis+.env nach Swap, erfolgreicher Postcheck, Originale unverändert fehlend. Falsche Vor-/Nachprovenienz, Pfad-/Hashwechsel und Originaldrift vor Cutover stoppen. Relative/symlink-/unprivate Snapshotdateien stoppen. Keine echte .env oder Runtimekonfiguration gelesen, kein Docker-/Serverlauf. CI führt die erweiterte bestehende Python-Suite unverändert mit aus. Unabhängiges Review des neuen Heads bleibt erforderlich.

Snapshot-Korrektur, Gate-1-Triage: sechs Dateien geprüft, 0 typisierte Funde, zwei Wortmuster. docs/image-only-rollout.md:92 nennt ausschließlich zusätzliche vertrauliche Konfigurationsquellen als Prüfvoraussetzung; scripts/check-image-rollout.py:418 ist der unveränderte Kommentar zur Geheimnisunterdrückung. Beide beschreibend, keine Werte oder Zugangsdaten. Scanexit 1 wegen Wortmustern ausdrücklich dokumentiert. Tests lesen ausschließlich eigene synthetische Temporärdateien, keine echte .env. Positiver CLI-Test bestätigt auch Rollback-Preflight und Rollback-Postcheck bei fehlenden Originaldateien; kein Überschreiben oder Neuerstellen der Originale.

## Standards-Nachkorrektur: eigenständige Snapshotdateien

Kurzplan: vor Freeze/erstem Cutover kanonische Snapshotpfade bestimmen und deren Dateisystemidentität (st_dev/st_ino) gegen die jeweilige Originaldatei vergleichen; Aliase und Hardlinks ablehnen, Collector/Operator auf denselben kanonischen Pfad binden. Keine Originalauflösung/-stat/-Lektüre nach Swap oder beim Rückweg.

Rot: Ran 35 tests / FAILED (failures=5): Originalbasis- und Original-ENV-Aliase mit .., jeweils Hardlinks und fehlende Kanonisierung eigenständiger Kopien. Grün: Ran 35 tests / OK pro Repository. Positiver Test entfernt anschließend beide Originaldateien und bestätigt unveränderte Snapshot-Metadaten; bestehender CLI-Post-/Rückwegfall bleibt grün. Keine echten Konfigurationen/Dateien gelesen, keine Server-/Dockeraktion. Bestehendes Freezeformat 3 bleibt bestehen; Operator verwendet kanonische Pfade aus frozen.runtime_files. Unabhängige Nachprüfung des neuen Heads offen.

Alias-Korrektur abgeschlossen: AST/Profile-JSON und Diffcheck erfolgreich; alle bestehenden Workflows bytegleich. Gate 1 über sechs Dateien: 0 typisierte Funde und zwei bereits bekannte beschreibende Wortmuster (Runbookquellenabschnitt Zeile 92, Fehlerunterdrückungskommentar im Helper jetzt Zeile 437). Kein Wert, ausdrücklich triagiert; Scanexit 1 wird nicht als Nulltreffer dargestellt. Keine echte Konfiguration gelesen. Python-Primärdokumentation zu Path.resolve(strict=True) und st_dev/st_ino konsultiert.

## Geprüfte Image-Quellrevision als eng begrenzte Metadatenausnahme

Kurzplan: ausschließlich org.opencontainers.image.revision normalisieren, wenn sie unverändert vom lokal per ID inspizierten Image geerbt wird und kein Compose-Runtimeoverride vorliegt. Keine allgemeine Labelfilterung; alle anderen Labels und rohen Preflight-Hashes behalten ihren Schutz.

Root-Metadatenbeleg outputs/rollout/remediation/parksaas-qa-image-label-diff.json (geschützter Taskbeleg, nicht hochgeladen): neue Parkimages besitzen zusätzlich das OCI-Quellrevisionslabel; Composeversion alt/aktuell jeweils 5.0.2. Die Quellinhalts-/Archivprüfung bleibt separat bei Root. OCI-Annotationsspezifikation und Docker-LABEL-Dokumentation konsultiert.

Rot: Ran 39 tests / FAILED (failures=1, errors=1): korrekter geerbter neuer Quellrevisionseintrag wurde abgewiesen; manueller Revisionseintrag ohne Image-Default zunächst akzeptiert. Grün: Ran 39 tests / OK. Positive alte-ohne/neue-geerbte-Revision und Rückweg; negative fehlende/manuelle Revision, Compose-Overrideänderung, zusätzliche OCI-Version/unbekannte/Routinglabels; roher Preflight-Hash bleibt wirksam. Umsetzung identisch in beiden Guards; keine Erweiterung für Peers, keine Workflow-/App-/Image-/Serveränderung. Neue unabhängige Nachprüfung erforderlich.

Quellrevisions-Korrektur, Gate-1-Abschluss: sechs Dateien, 0 typisierte Funde, zwei unveränderte beschreibende Wortmuster (Runbookquellenabschnitt Zeile 92; Fehlerunterdrückungskommentar jetzt Helperzeile 447). Keine Werte, ausdrücklich triagiert; Scanexit 1 wegen Wortmustern. AST/Profile-JSON und Diffcheck erfolgreich, bestehende Workflows bytegleich. Synthetische Suite 39/39, kein echter Docker-/Serverlauf.

## Realer Docker-Leerwert: ausschließlich User

Kurzplan: nur im User-Prozessvergleich null und leeren String als keinen Override gleichsetzen, alle konkreten Benutzer und Cmd/Entrypoint/WorkingDir strikt lassen. Rohe vollständige Config-/Preflight-Fingerprints werden nicht normalisiert.

Root-Teilbeleg outputs/rollout/remediation/parksaas-process-default-diff.json (nicht ins Repo aufgenommen): ausschließlich Frontend-Config.User ist leerer String gegenüber ImageDefault.User=null, alle anderen Prozessfelder stimmen. Reale Form als synthetische Fixture reproduziert; Docker-USER-/Runtime-Dokumentation konsultiert.
Rot: Ran 41 tests / FAILED (errors=2), exakt unbegründete Ablehnung dieses User-Leerwerts und entsprechender leerer Kandidaten-Defaults. Grün: Ran 41 tests / OK. Vor-/Nachprüfung der realen Form, Ablehnung konkreter Benutzer root/node/0/Whitespace sowie unverändert strikte Cmd-/Entrypoint-/WorkingDir-Leerwertfälle. Bestehende Suite einschließlich aller Snapshot-/Label-/Rückwegfälle grün. Kein Workflow-/App-/Image-/Servereingriff. Gezielte unabhängige Peerprüfung bleibt erforderlich.

User-Leerwert-Korrektur, Gate 1: sechs Dateien, 0 typisierte Funde, zwei bekannte rein beschreibende Wortmuster (Runbookquellen Zeile 92, Fehlerunterdrückungskommentar jetzt Helperzeile 454). Keine Werte, ausdrücklich triagiert; Scanexit 1 wegen Wortmustern. AST/Profile-JSON und Diffcheck erfolgreich, Workflows unverändert; 41/41 synthetische Tests pro Repo. Kein Docker-/Serverlauf.
