# Unabhängiges Review ausstehend

Prüfen: Image-only-Scope, exakte Profile/Projektpfade, private Ports/Netzwerke, vollständige Zielcontainerzählung inklusive gestoppter Retains, unveränderte Nicht-Ziel-Peers, Geheimnisunterdrückung und ID-gebundener Vorwärts-/Rückweg.

Lokale Belege: 19/19 Verhaltenstests pro Repo, Python-/JSON-Syntax und Diffcheck erfolgreich. Kein echter Docker-/Serveraufruf durch den Umsetzer. Der --live-Pfad und reale Composeversionen bleiben vor Root-Ausführung unabhängig zu prüfen.

Backend/Frontend allein; Proxy/DB unverändert, möglicher nginx-Reload separat.

## Reviewkorrektur: vollständiger Zielzustand und CI

Kurzplan vor Abschluss: konkret reproduzierte Guardlücken mit roten Verhaltensfällen festhalten, vollständige Ziel-Fingerprints und effektive geerbte ENV binden, nur explizite Recreate-/Versionsmetadaten eng normalisieren und die Guardtests in der vorhandenen Node-26-CI ausführen. Keine Trigger/Rechte oder Produktionsautomation ändern.

Gegenproben zunächst rot: 17 akzeptierte Änderungen in 22 Tests (CPU/Ulimits/LogConfig/User/Cmd/Ports vor/nach Cutover, MAIL_MODE/unbekannte/App-Version-Defaults, Kandidat-User/Cmd). Danach 28/28 Tests grün; zusätzliche positive dynamische Endpoint-/Hostname-Recreation und negative statische IP-/Hostname-, ENV-Duplikat-/Compose-Versions- und Netz-ID/Gateway/Alias/Präfixfälle. Vollständige effektive ENV, rohe Preflight-Zielhashes und normalisierte vollständige Post-Fingerprints; Format 2 erzwingt neuen Freeze. Genauer Allowlistvertrag im Runbook.

Bestehende Node-26-Test-CI bekommt ausschließlich einen Python-Guardtestschritt; keine Pfadfilter vorhanden/erforderlich, Trigger/Rechte unverändert. Produktionsworkflow unverändert. Diese Korrektur braucht erneutes unabhängiges Review des finalen Heads; kein Server-/Docker-/Deploymentlauf.

## Betriebspräzisierung: gebundene private Basis-/ENV-Snapshots

Kurzplan: optionale --runtime-base-file/--runtime-env-file mit absoluten privaten Dateipfaden ergänzen, Pfade/Inhaltshashes/identischen Overlaypfad im neuen Freezeformat 3 binden; vor erster Mutation Originalbytegleichheit und Originalcontainerprovenienz verlangen, danach Snapshotbasis+Overlay ausschließlich für Ziele. Arbeitsverzeichnis/Peers/alle übrigen Gates bleiben gleich. Rückweg darf Originaldateien weder lesen müssen noch überschreiben. Ursprung ist laut Root ausdrücklich <project_dir>/.env.

Rot vor Umsetzung: Ran 31 tests / FAILED (failures=7, errors=1), erwartete noch fehlende Pfad-/Hash-/Originaldriftbindung und Snapshotprovenienz. Grün: Ran 33 tests / OK (beide Repositories). Zusätzlicher CLI-/Collect-Verhaltenstest mit temporären ausschließlich synthetischen 0600-Dateien: explizite gefrorene -f/--env-file, ursprüngliches --project-directory; fehlende Originalbasis+.env nach Swap, erfolgreicher Postcheck, Originale unverändert fehlend. Falsche Vor-/Nachprovenienz, Pfad-/Hashwechsel und Originaldrift vor Cutover stoppen. Relative/symlink-/unprivate Snapshotdateien stoppen. Keine echte .env oder Runtimekonfiguration gelesen, kein Docker-/Serverlauf. CI führt die erweiterte bestehende Python-Suite unverändert mit aus. Unabhängiges Review des neuen Heads bleibt erforderlich.

## Standards-Nachkorrektur: eigenständige Snapshotdateien

Kurzplan: vor Freeze/erstem Cutover kanonische Snapshotpfade bestimmen und deren Dateisystemidentität (st_dev/st_ino) gegen die jeweilige Originaldatei vergleichen; Aliase und Hardlinks ablehnen, Collector/Operator auf denselben kanonischen Pfad binden. Keine Originalauflösung/-stat/-Lektüre nach Swap oder beim Rückweg.

Rot: Ran 35 tests / FAILED (failures=5): Originalbasis- und Original-ENV-Aliase mit .., jeweils Hardlinks und fehlende Kanonisierung eigenständiger Kopien. Grün: Ran 35 tests / OK pro Repository. Positiver Test entfernt anschließend beide Originaldateien und bestätigt unveränderte Snapshot-Metadaten; bestehender CLI-Post-/Rückwegfall bleibt grün. Keine echten Konfigurationen/Dateien gelesen, keine Server-/Dockeraktion. Bestehendes Freezeformat 3 bleibt bestehen; Operator verwendet kanonische Pfade aus frozen.runtime_files. Unabhängige Nachprüfung des neuen Heads offen.
