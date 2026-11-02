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

## Fahrphysik

| # | Entscheidung | Begründung |
|---|---|---|
| P1 | **Einspurmodell** (eine Vorder-, eine Hinterachse) mit Längs- und Querlastverlagerung statt Vierradmodell. | Reicht für ein Arcade-Driftgefühl, ist schnell (≈ 3 µs pro Schritt) und stabil. Querlastverlagerung wirkt als Grip-Verlust der Achse; die Verteilung (Wanksteifigkeit vorne/hinten) steuert Unter-/Übersteuern. |
| P2 | **Hinterrad-Drehzahl ω als eigener Zustand, implizit gelöst** (Newton mit Bisektions-Absicherung). | Mit einem reinen Kraftkreis ohne Raddrehzahl verhungert ein Drift, weil durchdrehende Räder keinen Vortrieb liefern. Mit ω zeigt die Reibkraft in Richtung der Rutschgeschwindigkeit – der Wagen schiebt im Drift nach vorne, genau wie in echt. Die implizite Lösung ist auch bei großer Motorträgheit stabil. Handbremse = großes Bremsmoment → blockierende Räder ergeben sich von selbst. |
| P3 | **Vorderachse ohne eigene Raddrehzahl** (Kraftkreis aus Seitenkraft + Bremse/Allrad-Anteil). | Vorderräder blockieren oder drehen im Spiel praktisch nie durch; spart Rechenzeit. |
| P4 | **Gleitreibung hinten 76 % statt 90 % der Spitzenkraft** (Arcade-Hilfe). | Das Heck bricht klar aus und der Drift lässt sich mit dem Gas halten („leicht einzuleiten, schwer zu perfektionieren“). |
| P5 | **Offenes vs. gesperrtes Differenzial** wird über einen Faktor auf den wirksamen Längsschlupf nachgebildet. | Ein starrer Hinterachs-Zustand kennt kein Innenrad. Mit offener Sperre „verpufft“ ein Teil des Schlupfs (Innenrad dreht durch), das Außenrad behält Seitenführung → schwerer zu driften. |
| P6 | **Automatik schaltet nach Fahrgeschwindigkeit**, nicht nach Raddrehzahl. | Im Drift drehen die Räder am Begrenzer; nach Raddrehzahl würde die Automatik ständig hochschalten. |
| P7 | **Gierdämpfung** (klein, je Auto einstellbar) und Zusatzdämpfung über 70° Driftwinkel. | Verhindert endloses Weiterdrehen und macht Dreher abfangbar, ohne das Driften zu verhindern. |
| P8 | **0–100-Messung mit optimalem Start** (Gas wird nahe am Haftmaximum dosiert). | Entspricht einer Messfahrt; mit stumpfem Vollgas würden starke Heckantriebler nur Rauch erzeugen. |
| P9 | **Luftwiderstand aus der Auslegungs-Höchstgeschwindigkeit** des Serienautos berechnet. | Höchstgeschwindigkeiten stimmen ohne Handarbeit; mehr Leistung durch Tuning erhöht sie automatisch. |
| P10 | **Leistungsindex = Basis-PI × (1 + Tuningzuschlag)**; Zuschlag maximal +45 %. | Eine rein physikalische Formel (Leistungsgewicht) würde getunte Einsteigerautos über die teuren Autos heben. Die Formel bewertet Leistung, Gewicht, Grip und Stabilität des Serienautos und addiert die Tuningstufen prozentual – genau wie in der Spezifikation gefordert. |
| P11 | **Weiche Auto-Auto-Kollision** über drei Kreise je Auto: nur Positions- und Geschwindigkeitsangleich, keine Drehung. | Spezifikation: kein harter Rückstoß, kein Festkleben, keine Rotation durch Berührung. |

## Autos, Strecken, Darstellung

| # | Entscheidung | Begründung |
|---|---|---|
| D1 | **Onyx RS: Allrad mit nur 12 % Frontanteil** (statt der zunächst angesetzten 30 %), Wankanteil vorne 0,47. | Mit 30 % Frontanteil ließ sich der Onyx in Simulationen überhaupt nicht im Drift halten. Mit 12 % bleibt er „Allrad mit Heckbetonung“ und schwerer zu driften, ist aber fahrbar (stationär bis ca. 55°). |
| D2 | **Strecken als Segmentlisten** (Gerade/Bogen/Schließen) statt handgesetzter Kontrollpunkte; daraus werden Kontrollpunkte und ein zentripetaler Catmull-Rom-Spline erzeugt. | Längen, Radien und Zonen lassen sich gezielt einstellen; neue Strecken sind leicht zu ergänzen. Drift-Zonen und Wandarten hängen am Segment und bleiben bei Änderungen richtig. |
| D3 | **Ideallinie = Minimal-Krümmungs-Linie** (mehrstufige Relaxation innerhalb der Fahrbahn), zu 65–70 % mit der Mitte gemischt, plus optionale Handkorrekturen. | Ergibt automatisch „außen–innen–außen“, ohne Handarbeit. Die Mischung hält die Linie driftfreundlich (nicht ganz am Rand). |
| D4 | **Fliegender Start:** Führer 15 m vor der Startlinie, Verfolger 10 m dahinter; eine Runde zählt ab dem Überfahren der Linie. | Spezifikation: versetzte Aufstellung + fliegender Start; so ist ein Durchgang genau eine volle Runde. |
| D5 | **Abkürzungsschutz:** Sprünge der Streckenposition um mehr als ca. 8 m pro Frame zählen nicht als Fortschritt; Checkpoints müssen in Reihenfolge passiert werden. | Verhindert Abkürzen durchs Infield (z. B. Industriehof), ohne echte Fahrt zu stören. |
| D6 | **Nasser Asphalt** (Neon-Hafen): Env-Map, geringe Rauheit und additive, langgezogene Lichtstreifen auf der Fahrbahn. | Vorgabe: keine Echtzeit-Spiegelung. |
| D7 | **Performance-Messung mit `playwright-core` und dem installierten Edge** statt eines heruntergeladenen Test-Browsers. | Kein großer Browser-Download, echte GPU. Handy-Profil emuliert CPU und Bildschirm, nicht die Handy-GPU (siehe docs/PERFORMANCE.md). |
| D8 | **Autopilot-Startparameter** `?perf=1&strecke=…` (Freies Fahren, ein Legende-Bot fährt das Spielerauto). | Reproduzierbare Messungen ohne Eingaben. Hat keinen Einfluss aufs normale Spiel. |
| D9 | **Messgröße „max. stationärer Driftwinkel“** mit einem PI-Halteregler, nicht mit konstanten Eingaben. | Ein Drift ist (auch real) kein stabiles Gleichgewicht bei konstanter Eingabe; gemessen wird, was ein geübter Fahrer halten kann. |

## Wortfilter

| # | Entscheidung | Begründung |
|---|---|---|
| W1 | Normalisierung (Kleinschreibung, Umlaute, Leetspeak, Sonderzeichen entfernen) plus Liste von Wortstämmen; einige kurze Kürzel nur als ganzes Wort. | Fängt die üblichen Verschleierungen ab, ohne bei normalen Namen zu viele Fehlalarme zu erzeugen. Lieber einmal zu viel ablehnen. |
