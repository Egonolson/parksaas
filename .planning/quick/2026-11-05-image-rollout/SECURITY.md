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
