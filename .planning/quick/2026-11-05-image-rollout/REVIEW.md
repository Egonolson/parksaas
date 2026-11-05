# Unabhängiges Review ausstehend

Prüfen: Image-only-Scope, exakte Profile/Projektpfade, private Ports/Netzwerke, vollständige Zielcontainerzählung inklusive gestoppter Retains, unveränderte Nicht-Ziel-Peers, Geheimnisunterdrückung und ID-gebundener Vorwärts-/Rückweg.

Lokale Belege: 19/19 Verhaltenstests pro Repo, Python-/JSON-Syntax und Diffcheck erfolgreich. Kein echter Docker-/Serveraufruf durch den Umsetzer. Der --live-Pfad und reale Composeversionen bleiben vor Root-Ausführung unabhängig zu prüfen.

Backend/Frontend allein; Proxy/DB unverändert, möglicher nginx-Reload separat.

## Reviewkorrektur: vollständiger Zielzustand und CI

Kurzplan vor Abschluss: konkret reproduzierte Guardlücken mit roten Verhaltensfällen festhalten, vollständige Ziel-Fingerprints und effektive geerbte ENV binden, nur explizite Recreate-/Versionsmetadaten eng normalisieren und die Guardtests in der vorhandenen Node-26-CI ausführen. Keine Trigger/Rechte oder Produktionsautomation ändern.

Gegenproben zunächst rot: 17 akzeptierte Änderungen in 22 Tests (CPU/Ulimits/LogConfig/User/Cmd/Ports vor/nach Cutover, MAIL_MODE/unbekannte/App-Version-Defaults, Kandidat-User/Cmd). Danach 28/28 Tests grün; zusätzliche positive dynamische Endpoint-/Hostname-Recreation und negative statische IP-/Hostname-, ENV-Duplikat-/Compose-Versions- und Netz-ID/Gateway/Alias/Präfixfälle. Vollständige effektive ENV, rohe Preflight-Zielhashes und normalisierte vollständige Post-Fingerprints; Format 2 erzwingt neuen Freeze. Genauer Allowlistvertrag im Runbook.

Bestehende Node-26-Test-CI bekommt ausschließlich einen Python-Guardtestschritt; keine Pfadfilter vorhanden/erforderlich, Trigger/Rechte unverändert. Produktionsworkflow unverändert. Diese Korrektur braucht erneutes unabhängiges Review des finalen Heads; kein Server-/Docker-/Deploymentlauf.
