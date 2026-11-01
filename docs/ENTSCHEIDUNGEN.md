# Entscheidungen

Alle Stellen, an denen die Spezifikation (`SPEC.md`) offen war oder bewusst anders gelöst wurde – jeweils mit kurzer Begründung.

## Technik & Architektur

| # | Entscheidung | Begründung |
|---|---|---|
| T1 | **Node 26 / npm 11** lokal, auf Render `NODE_VERSION=22` (LTS). | Lokal war Node 26 vorhanden; Code nutzt nur Funktionen, die ab Node 20 verfügbar sind. Render bekommt eine LTS-Version. |
| T2 | **Alle Pakete als `dependencies`** (auch Vite, Three.js, Schriften). | Render führt `npm install` aus; je nach Umgebung werden `devDependencies` ausgelassen. So klappt `npm run build` immer. |
| T3 | **Gepinnte Versionen ohne `^`/`~`**: three 0.187.0, vite 8.3.5, express 5.3.0, ws 8.22.1, @fontsource/* 5.3.0. | Vorgabe der Spezifikation (reproduzierbarer Build). |
| T4 | **Relative Importe statt Pfad-Alias** für `/shared`. | Derselbe Code läuft im Browser (Vite), auf dem Server und in den Node-Tests ohne zusätzliche Auflösung. |
| T5 | **Eigenes Dev-Skript** (`scripts/dev.js`) statt `concurrently`. | Spart eine Abhängigkeit. Vite läuft auf `PORT` (Standard 5173), der Spielserver auf `SERVER_PORT` (Standard 3000); Vite leitet `/ws` und `/healthz` weiter. |
| T6 | **Service Worker wird beim Build erzeugt** (kleines Vite-Plugin in `vite.config.js`) mit Build-Hash als Cache-Version und vollständiger Dateiliste. | Kein Zusatzpaket (z. B. Workbox) nötig; alte Caches werden beim Aktivieren gelöscht. |
| T7 | **Seitenaufrufe „Cache zuerst“** im Service Worker. | Schneller Start, auch wenn der kostenlose Render-Server gerade schläft oder offline ist. Updates kommen über den neuen Service Worker mit Hinweis „Neue Version verfügbar – neu laden“. |
| T8 | **Im Entwicklungsmodus wird kein Service Worker benutzt** und vorhandene Registrierungen werden abgemeldet. | Sonst liefert ein alter Cache veraltete Dateien aus. |
| T9 | **CSP erlaubt `'unsafe-inline'` nur für Styles**, nicht für Skripte. | Spezifikation verlangt „ohne Inline-Skripte“. Die UI setzt Stile per JavaScript (Positionen der Touch-Tasten, Animationen); das ist mit `style-src 'self'` allein in Safari nicht zuverlässig. |
| T10 | **Text-Codes: `deflate-raw` per `CompressionStream`**, sonst unkomprimierter Rückfall (Präfix `R`). | iOS 16.0–16.3 kennt `CompressionStream` noch nicht. Codes mit Präfix `D` können dort nicht gelesen werden – es erscheint eine klare Meldung. Dekompression ist größenbegrenzt (Schutz vor „Zip-Bomben“). |
| T11 | **Spielstand-Schlüssel `driftkoenig.v<Version>.spielstand`**, Backup in `driftkoenig.backup` (+ Datum). | Erfüllt „Präfix und Versionsnummer“. Beim Laden wird zuerst die aktuelle, dann jede ältere Version gesucht und migriert. |
| T12 | **Prüfsumme FNV-1a (32 Bit)** über das Spielstand-JSON. | Erkennt Beschädigung und naive Manipulation. Kryptografischer Schutz ist ohne Server-Konto nicht möglich (siehe Ökonomie-Entscheidung Ö1). |
| T13 | **Version 0 als Migrationsquelle**: frühes Entwicklungsformat („muenzen“ statt „waehrung“). | Damit ist die Migrationskette von Anfang an echt getestet. |
| T14 | **Beim Import bleibt die Client-ID des Geräts erhalten.** | Sonst ließe sich das Online-Tageslimit durch Import fremder Spielstände umgehen. |
| T15 | **Debug-Overlay**: `?debug=1` funktioniert immer, Taste F3 nur im Entwicklungsmodus; **Cheats nur im Entwicklungs-Build**. | So steht es in Abschnitt 1; die Freischalt-Cheats aus Abschnitt 6 sind damit nur lokal (`npm run dev`) nutzbar. |
| T16 | **Touch-Layouts getrennt für Quer- und Hochformat.** | Im Hochformat ist zu wenig Breite für das Querformat-Layout; die Tasten würden sich überlappen. |

## Wortfilter

| # | Entscheidung | Begründung |
|---|---|---|
| W1 | Normalisierung (Kleinschreibung, Umlaute, Leetspeak, Sonderzeichen entfernen) plus Liste von Wortstämmen; einige kurze Kürzel nur als ganzes Wort. | Fängt die üblichen Verschleierungen ab, ohne bei normalen Namen zu viele Fehlalarme zu erzeugen. Lieber einmal zu viel ablehnen. |
