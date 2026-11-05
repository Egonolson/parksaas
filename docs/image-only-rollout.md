# Kontrollierter Imagewechsel QA → Produktion

Dieser Ablauf ist vorbereitet, nicht ausgeführt. Root führt sämtliche Serveraktionen aus. Der Guard erteilt keine Betriebsfreigabe. Die geschützten bytegleichen Snapshots der bestehenden serverlokalen Compose-/ENV-Dateien bilden die ausführbare Basis; Repo-Defaults werden nicht synchronisiert.

## Verbindliche Voraussetzungen

- Unabhängiges Review, passende Linux/amd64-Artefakte mit Quellcommit/Prüfsumme, Sicherung und isolierter Restore-/Rollbacknachweis.
- QA-Daten und Mailzustellung positiv als isoliert belegen. Keine realen Buchungen, Zahlungen, Nachrichten oder neuen Konten als Test verwenden. Fehlende SMTP-ENV ist kein Isolationsnachweis.
- Sämtliche Container des Projekts einschließlich gestoppter retained Exemplare inventarisieren. Mehr als ein Container eines tatsächlich ausgewählten Zielservice bedeutet STOPP. Nicht löschen, nicht umbenennen, kein Cleanup.
- Retained Container unberührter Peer-Dienste dürfen bleiben. Guard und Postcheck verlangen unveränderte Peer-IDs, Starts, Restartzähler und Konfigurations-/Netzwerk-/Mountmetadaten. Genau ein laufender Peer muss existieren.
- Root stellt exklusiven Operatorzugriff sicher; keine parallelen Deployjobs oder Mutationen zwischen Preflight und Cutover. Ein lokaler Lock schützt nicht gegen einen unabhängigen alten CI-Deploy.
- Bei unklarer oder abweichender Runtime stoppt der Ablauf. Kein automatisches Reparieren von Ports, Netzwerken, Credentials, Rollen, Tabellen, Volumes oder App-Einstellungen.

## Geprüfte lokale Dateien

- `deploy/image-rollout/images.compose.yaml`: nur Zielimages und `pull_policy: never`.
- `deploy/image-rollout/profiles.json`: getrennte bekannte QA-/Prod-Identitäten und Bindungen.
- `scripts/check-image-rollout.py`: standardmäßig reine JSON-Prüfung; nur mit ausdrücklichem `--live` lesende Docker-Abfragen, keine Docker-Mutation.
- `tests/ops/test_image_rollout.py`: synthetische Verhaltensregressionen, keine echten Dienste.

## Artefakt und Sicherung

Vorhandene lokale Kandidatenimages prüfen und immutable Image-ID, Plattform und Quellstand protokollieren. Kein ungeprüftes `latest`, kein Remote-Pull und kein Build auf dem Server. Kandidat mit `docker save` als einzelnes Archiv transportieren, Prüfsumme vor/nach Transfer vergleichen und durch Root laden. Nur Imagearchiv und geprüfte kleine Rolloutdateien übertragen, keinen Repository-/Konfigurationsbaum.

Vorher die **tatsächlich laufenden** alten Zielimage-IDs samt Architektur sichern, lokal gegen Entfernen schützen und exportieren. Serverlokale Compose-/Proxydateien geschützt sichern; bestehende vertrauliche Umgebungsdateien bleiben privat auf dem Server, nicht im Repo/Chat/Inventarupload. DB-/Storage-Sicherung und Lesbarkeits-/Restoreprobe separat nachweisen; ein Webimage-Wechsel führt weder Migration noch Datenrestore aus. Vorhandene retained Container bleiben unangetastet; Rückweg basiert auf gesicherten Images, nicht auf einem neuen Git-Build.

## Gefrorener Plan und Preflight

Root legt die geprüften Rolloutdateien sowie bytegleiche Snapshots der vorhandenen Serverbasis und `<project_dir>/.env` in einem geschützten Releaseverzeichnis ab (`umask 077`) und setzt die unten benannten Imagevariablen auf vollständige lokal geprüfte `sha256:<64 hex>`-Image-IDs. Die Dateipfade/Projektkennung aus dem gewählten Profil müssen zur frischen Runtime passen. Basis-Snapshot, ENV-Snapshot und Kandidatenoverlay bleiben für sämtliche Prüfungen, Vorwärts- und Rückwege unter denselben absoluten Pfaden. Die ursprünglichen Basis-/ENV-Dateien werden niemals überschrieben. Snapshots müssen reguläre, nicht symbolisch verlinkte, dem ausführenden Operator gehörende Dateien ohne Gruppen-/Fremdrechte sein; geschützt ablegen und unveränderlich behandeln. Snapshotpfade werden kanonisch aufgelöst; vor Freeze und vor dem ersten Cutover werden sowohl Pfadidentität als auch st_dev/st_ino gegen die jeweilige Originaldatei geprüft. Aliase wie /projekt/../projekt und Hardlinks auf Originaldateien sind keine eigenständigen Sicherungen und stoppen. Cutover/Rückweg verwenden die kanonischen Basis-/ENV-Pfade aus frozen.runtime_files, damit Containerprovenienz und Guard exakt übereinstimmen. Nach dem Wechsel wird diese Originalprüfung nicht mehr ausgeführt; unveränderte private Snapshotdateien bleiben alleinige Eingabe.

Schema des ausschließlich durch Root auszuführenden Prüfaufrufs:

```sh
python3 -B scripts/check-image-rollout.py \
  --profiles deploy/image-rollout/profiles.json --environment qa \
  --live --candidate-file /ABSOLUTES-RELEASEVERZEICHNIS/images.compose.yaml \
  --runtime-base-file /GESCHUETZTER-CHECKPOINT/base.compose.yml \
  --runtime-env-file /GESCHUETZTER-CHECKPOINT/runtime.env \
  --freeze > /GESCHUETZTES-VERZEICHNIS/frozen-qa.json
```

Nur nach erfolgreicher Prüfung und privater Operatorbewertung den Freeze beibehalten. Er enthält ausschließlich Hashes, gebundene Dateipfade sowie Ziel-/Rückweg-Image-IDs und Zielcontainer-Identitäten, keine Umgebungswerte. `--live` löst serverlokale Konfiguration einschließlich env_file nur im Prozessspeicher auf und protokolliert keine Werte. Keine unredigierte `compose config`-/`docker inspect`-Ausgabe speichern, kein `set -x`, kein `tee` für diese Eingaben.

Vor Freeze und unmittelbar vor dem ersten Cutover müssen Originalbasis und ursprüngliche `<project_dir>/.env` noch bytegleich zu ihren Snapshots sein; jede Originaldrift stoppt. Der Guard hasht privat vor/nach der lesenden Metadatensammlung und bindet Snapshotpfade/-inhalte sowie Overlaypfad. Für diese abgesicherte Rückwegvariante immer **beide** optionalen Runtime-Dateiflags ausdrücklich setzen. Ohne sie bleibt nur der frühere Originaldateimodus; daraus folgt keine Recoverygarantie bei verlorenen Originaldateien.

Unmittelbar vor Cutover denselben Aufruf mit `--frozen /.../frozen-qa.json` statt `--freeze` ausführen. Guard prüft:

- vollständige Labelzählung aus `docker ps -aq`, inklusive gestoppter Container;
- Projekt, Namen, Basisdatei, Arbeitsverzeichnis und vollständige Service-Menge;
- tatsächliche und deklarierte Ports/Netzwerke/Mounts sowie vollständige Config-, HostConfig- und NetworkSettings-Fingerprints der Ziele; damit auch User/Cmd, CPU/Ulimits/Logging und effektive Ports;
- vollständige effektive Laufzeit-ENV einschließlich geerbter Image-Defaults; unbekannte oder veränderte App-/Mailwerte stoppen bereits bei der Kandidatenprüfung;
- ausschließlich freigegebene unveränderliche Zielimage-IDs, Linux/amd64 und keine Pulls;
- keine weitere Konfigurationsänderung und keine zwischenzeitlich ersetzten/neu gestarteten Ziel- oder Peer-Container.

Der Guard hat eine feste 30-Sekunden-Grenze je lesender Docker-Abfrage. Fehlerausgabe enthält keine Eingabewerte. Ein STOPP ist kein Anlass für einen erzwungenen Compose-Neustart.

### Eng begrenzte Normalisierung (Freezeformat 3)

Vor dem ersten Cutover werden die vollständigen rohen Ziel-Config/HostConfig/NetworkSettings/Mounts zusätzlich als Hash gebunden. Jede Änderung nach Freeze stoppt auch dann, wenn sie bei einem späteren Recreate normalerweise zulässig wäre. Formate 1 und 2 werden nicht mehr akzeptiert; mit diesem Guard neu einfrieren.

Zwischen alten und neuen Zielcontainern bleiben HostConfig, Mountmetadaten, effektive Ports, User/Cmd/Entrypoint, Netzidentitäten, Gateways/Präfixe, zusätzliche Aliase und sämtliche übrigen Configfelder eingefroren. Nur die separat ID-geprüfte Image-Referenz, der nachweislich aus der jeweiligen Container-ID erzeugte automatische Hostname und die vier Compose-Laufzeitlabels config-hash/image/replace/project.config_files werden beim Recreate normalisiert. Projekt-/Service-/Dateiprovenienz wird separat strikt geprüft. Geänderte Composeversion- oder andere Labels stoppen. Einzige zusätzliche Metadatenausnahme ist org.opencontainers.image.revision: Nur wenn der konkrete Laufzeitwert einschließlich Anwesenheit exakt dem Default des per ID geprüften jeweiligen Images entspricht und Compose diesen Schlüssel nicht als Runtime-Label deklariert, wird er im Recreate-Vergleich normalisiert. Explizite Compose-Revisionen bleiben vollständig eingefroren; manuelle Overrides oder fehlende Defaultlabels stoppen. Andere OCI-/Versions-/unbekannte/Routinglabels bleiben strikt. Rohe Preflight-Hashes schützen weiterhin auch sämtliche Quellrevisionswerte vor dem ersten Wechsel. Diese Metadatenregel beweist keinen Imageinhalt; Root verifiziert Image-ID, Archiv, Quellcommit und tatsächlichen Appbaum separat.

Netzwerkseitig dürfen nur SandboxID/SandboxKey, EndpointID, automatisch vergebene IP-/MAC-Adressen und Aliase exakt gleich der jeweiligen Container-ID/-Kurz-ID wechseln. Statisch deklarierte Adressen/Hostname und alle weiteren Netzfelder bleiben geschützt. Vor dem Cutover schützt zusätzlich der rohe Hash auch diese dynamischen Werte. Diese Ausnahmen betreffen ausschließlich aktualisierte Ziele; alle Peer-Metadaten bleiben vollständig unverändert.

ENV-Normalisierung erlaubt ausschließlich die benannten upstream Versionsmarker NODE_VERSION, YARN_VERSION, NGINX_VERSION, NJS_VERSION, NJS_RELEASE, PKG_RELEASE und DYNPKG_RELEASE, sofern sie nicht von Compose deklariert sind und exakt den lokal geprüften Image-Defaults entsprechen. App-Versionen, PATH, MAIL_MODE und unbekannte geerbte Variablen sind nicht ausgenommen. Doppelte ENV-Schlüssel stoppen. Manuell von Compose/Image abweichende User-/Cmd-/Entrypoint-/WorkingDir-Werte stoppen vor dem Recreate; Prozessarrays müssen aufgelöst vorliegen. Kandidaten müssen außerdem dieselben User-/Cmd-/Entrypoint-/WorkingDir-/StopSignal-/Healthcheck-/ExposedPorts-/Volumes-/Shell-Defaults wie das gesicherte alte Image haben. Absichtlich geänderte Startsemantik erfordert einen eigenen überprüften Plan, keine Erweiterung der Ausnahmen im Betrieb.

Der lesende Livepfad inspiziert zusätzlich immer alle gefrorenen Rückweg- und Kandidatenimage-IDs, damit die alten Defaults auch nach einem Swap verfügbar bleiben. Fehlende alte Images stoppen. Die bestehende Node-26-CI führt die Python-Guardtests aus. Ihre PR-/Push-Trigger und Rechte bleiben unverändert; vorhandene Workflows haben keine Pfadfilter, daher schließen sie Ops-/Dokumentationsänderungen bereits ein. Kein Produktionsworkflow wird angepasst.

## Eng begrenzter Cutover

Nur nach erfolgreichem Root-Preflight die unten projektspezifisch benannten Zielservices aufrufen. Immer die **gebundene eingefrorene Basis und ENV-Datei**, denselben Projektnamen und das **ursprüngliche** Arbeitsverzeichnis nutzen. Das erhält die Auflösung relativer Bind-/Volume-/Buildpfade; kein Umzug der Runtimeumgebung:

```sh
docker compose -p PROJEKT --project-directory BESTEHENDES-VERZEICHNIS \
  --env-file GEBUNDENER-ABSOLUTER-ENV-SNAPSHOT \
  -f GEBUNDENER-ABSOLUTER-BASIS-SNAPSHOT -f ABSOLUTER-IMAGE-OVERLAY \
  up -d --no-deps --no-build --pull never NUR-BENANNTE-ZIELSERVICES
```

Keine `down`-/`rm`-/`prune`-/`--remove-orphans`-/`--force-recreate`-/`--renew-anon-volumes`-Aktion. Insbesondere bedeutet `--no-deps` **nicht**, dass gleich gelabelte retained Zielcontainer geschützt wären; der Guard muss vorher abbrechen.

Direkt danach denselben Guard mit denselben beiden Runtime-Dateiflags und `--post --candidate-file <derselbe absolute Overlaypfad> --frozen <derselbe Freeze>` ausführen. Anschließend nur vereinbarte anonyme Status-/Health-GETs und Versions-/Image-ID-Prüfungen. Zielcontainer müssen laufen/gesund sein; Peer-Identitäten/Starts/Bindungen bleiben identisch. Keine Kunden-/Konten-/Mail-/Buchungs-/Zahlungsdaten als Smokeprobe.

## Rückweg

Bei Problemen alte gesicherte Ziel-Image-IDs aus `frozen.rollback_images` in dieselben Imagevariablen einsetzen. Nicht neu bauen und nicht das Checkout zurücksetzen. Erst Guard mit denselben beiden Runtime-Dateiflags und `--rollback` (ohne `--post`) ausführen: aktueller Vorwärtskandidat muss noch der erwartete sein, Peers unverändert, Rückweg exakt auf gefrorene alte IDs begrenzt. Danach derselbe eng begrenzte Compose-Aufruf mit **demselben gefrorenen Basis-/ENV-Snapshot und Overlaypfad**, anschließend Guard mit denselben Runtime-Dateiflags und `--rollback --post` und Status-GETs. Originalbasis oder Original-.env dürfen nach dem ersten Wechsel abweichen oder fehlen: Post-/Rückwegauflösung liest ausschließlich die gebundenen Snapshots; keine Originalüberschreibung oder Reparatur. Die Zielcontainerprovenienz muss nun exakt Snapshotbasis plus Overlay nennen, während alle unberührten Peers weiter ihre ursprüngliche Provenienz und Identitäten behalten. Vor dem ersten Cutover ist umgekehrt ausschließlich Originalbasis-Provenienz zulässig. Root vergleicht zusätzlich die vor dem Rückweg dokumentierten aktuellen Zielcontainer-IDs; der Freeze kann die zukünftigen Vorwärtscontainer-IDs noch nicht kennen.

Bei retained Zielduplikaten, Identitätsdrift oder verlorenen Sicherungen **kein Compose-Rückweg**. Root muss eine separat geprüfte ID-gebundene Engine-Methode ohne DELETE festlegen. Dieses Runbook liefert dafür keine ungetestete Abkürzung.

## Quellen und Grenzen

Docker-Dokumentation zu [up](https://docs.docker.com/reference/cli/docker/compose/up/), [config](https://docs.docker.com/reference/cli/docker/compose/config/) und [Merge](https://docs.docker.com/reference/compose-file/merge/) sowie [Netzwerk-/Adresszuweisung](https://docs.docker.com/engine/network/) und [Service-Konfiguration](https://docs.docker.com/reference/compose-file/services/), [ENV-Datei/Interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) und [Compose-Datei-/Projektverzeichnisauflösung](https://docs.docker.com/reference/cli/docker/compose/) geprüft. Shellvariablen haben weiter Vorrang; der gebundene aufgelöste Config-Hash muss deshalb bei jeder Prüfung gleich bleiben. --env-file betrifft Interpolation und ersetzt keine zusätzlichen service-env_file/include/extends-/Secret-/Config-Dateien; solche Quellen müssten separat eingefroren und geprüft werden. Ohne positiven Vollständigkeitsnachweis dieser Eingabequellen STOPP, keine behauptete Recoveryunabhängigkeit. Dass Compose beim Zielservice retained Dubletten entfernt, wurde im übergeordneten QA-Versuch tatsächlich beobachtet und hat Vorrang vor einer falschen Schutzannahme.

Lokal getestet sind synthetische JSON-/CLI-Verträge; kein Docker-/Server-/Compose-Ausführungstest. Der Guard ist bewusst streng, insbesondere bei nicht unterstützter Konfigurationsdarstellung. Abweichungen nachlesen und prüfen, nicht die Prüfung umgehen. Keine Aussage über vollständige Datensicherung, Mailisolation oder produktive Abnahme.

## ParkSaaS: konkrete Profile und Reihenfolge

| Umgebung | Projekt / bestehende Basis |
| --- | --- |
| QA | `parksaas`, `/mnt/HC_Volume_105075389/workspaces/project-manager/parksaas/docker-compose.yml` |
| Prod | `parksaas`, `/mnt/HC_Volume_105474481/workspaces/project-manager/parksaas/docker-compose.yml` |

Nur **`backend frontend`** aktualisieren. Imagevariablen: `PARKSAAS_BACKEND_IMAGE`, `PARKSAAS_FRONTEND_IMAGE`. Beide ohne Hostports im bestehenden `parksaas_default`. `nginx` und `db` bleiben unangetastet; Loopbackproxy `127.0.0.1:8400`, DB `127.0.0.1:5472` sind fest eingefroren. Kein Repo-Default `8400:80` darf diese Bindung ersetzen.

Bestehendes DEV-Runbook mit rsync, Rebuild und gleichzeitiger nginx-Recreation wird für diesen Wechsel ausdrücklich **nicht** verwendet. Root verwendet `--project-directory` jeweils das Elternverzeichnis der obigen Serverbasis und benennt am Ende ausschließlich `backend frontend`.

Proxy-DNS ist laut aktueller Root-Prüfung statisch: `backend:3000` und `frontend:80`. Nach Zielcontainerwechseln den exakt zuvor dokumentierten laufenden Proxycontainer anhand seiner ID verwenden: erst gleichen privaten Liveconfig-Hash bestätigen, dann durch Root `docker exec <EXAKTE-PROXY-ID> nginx -t` und nur bei Erfolg `docker exec <DIESELBE-PROXY-ID> nginx -s reload`. Vorher/nachher dieselben Peer-IDs, Starts, Restartzähler und Loopback8400 bestätigen. Kein nginx-`compose up`/Recreate oder Imagewechsel und keine Aktion gegen Proxy-Retains. Der Guard prüft Mountmetadaten, nicht den Inhalt der gemounteten nginx-Datei; der private Liveconfig-Hash ist deshalb ein eigener Pflichtnachweis. Bei 502 keine breite Stack-Neuerstellung.

Vorliegende Inventare haben für Backend/Frontend jeweils genau einen Container; ein alter gestoppter nginx-Retain auf QA ist kein Zielservice und darf unverändert bestehen bleiben. Diese Aussage ersetzt keine frische vollständige Labelzählung. Rollback betrifft wieder nur Backend/Frontendimages.

Öffentliche QA-Adresse aus bestehendem Runbook: `https://parking.visionmakegpt.work`. Status-/Healthpfade und aktuelle Prodadresse vor Root-Smoke anhand des realen Proxy-Kontexts bestätigen; keine Registrierungs-/Buchungs-/Payment-POSTs. Vorhandene Beispielmandanten sind kein Beleg für freigegebene synthetische Konten.

Root hat den Registrierungspfad zusätzlich geprüft: Er erzeugt Tenant, Passwort-Hash und JWT ohne SMTP-/Mollie-Aufruf. Nach positiver privater QA-DB-Isolation kann Root neue eindeutig synthetische QA-Tenants für Auth-/CRUD-Smokes verwenden; keine vorhandenen Datensätze lesen und keine echten Identitäten übernehmen. Der Umsetzer führt diese Liveaktionen nicht aus.
