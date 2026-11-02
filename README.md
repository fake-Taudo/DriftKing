# DRIFTKÖNIG

Ein 3D-Drift-Spiel für den Browser: Tandem-Battles gegen Bots, tiefgehende Auto-Individualisierung, eine Ingame-Währung mit Shop und Online-Duelle per Einladungscode. Läuft auf Handy, iPad und PC, ohne Installation. Alle Autos, Strecken und Inhalte sind frei erfunden, der Klang entsteht im Browser, und das Spiel fragt keine fremden Server an.

## Schnellstart

Voraussetzung: Node.js ab Version 20.

```bash
npm install
```

```bash
npm run dev
```

Das Spiel läuft dann unter <http://localhost:5173>. Der Entwicklungsserver startet Vite und den Spielserver zusammen.

## Produktion

```bash
npm run build
```

```bash
npm start
```

Das Spiel läuft dann unter <http://localhost:3000>. Der Node-Server liefert das gebaute Spiel aus und stellt auf demselben Port den WebSocket für Online-Duelle bereit (`/ws`). Der Health-Check liegt unter `/healthz`.

## Veröffentlichen auf Render

Die Konfiguration steht in `render.yaml`. Die Einrichtung dauert einmalig ein paar Minuten und ist Schritt für Schritt in [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md) beschrieben. Danach veröffentlicht jeder Push auf `main` automatisch.

## Steuerung

| Aktion | Tastatur | Gamepad |
|---|---|---|
| Gas / Bremse | W / S oder Pfeile | rechter / linker Trigger |
| Lenken | A, D oder Pfeile | linker Stick |
| Handbremse | Leertaste | A / Kreuz |
| Kupplung | Umschalt | X / Quadrat |
| Hoch- / Runterschalten | E / Q | RB / LB |
| Kamera wechseln | C | Y / Dreieck |
| Zurücksetzen | R | B / Kreis |
| Pause | Esc oder P | Start |

Auf dem Touchscreen gibt es Tasten, ein Lenkrad oder Neigungssteuerung. Das Layout lässt sich in den Einstellungen frei anpassen, Tasten und Gamepad-Knöpfe lassen sich neu belegen.

**Der erste Drift:** Gas geben, in die Kurve lenken, kurz die Handbremse ziehen, dann Gas halten und gegenlenken. Das Tutorial beim ersten Start zeigt das Schritt für Schritt.

## Inhalte

- **Modi:** Tandem-Battle gegen 16 Bots in 5 Stufen, Zeitangriff, Freies Fahren, Online-Duell, Tutorial, tägliche Aufgaben
- **6 Autos und 3 Strecken:** Industriehof, Küstenpass, Neon-Hafen
- **Garage:** Lackierung, Muster, Aufkleber-Editor, Felgen, Bodykit, Fahrwerk, Qualmfarbe, Neon, Tuning, Looks teilen per Code, Fotomodus
- **Online-Duell:** Code weitergeben, gemeinsam Strecke und Format wählen, Look-Sync, Wertung auf dem Server, Wiederverbindung
- **Barrierefreiheit:** 3 Schriftgrößen, Farbenblind-Modus, reduzierte Effekte, Bedienung komplett per Tastatur

## Tests

```bash
npm test
```

führt alle automatischen Tests aus: Physik, Wertung, Bots, Ökonomie, Spielstand, Garage, Netzwerk mit Fuzz- und Rate-Limit-Test, Klang und Effekte.

Dazu kommen Abläufe im echten Browser. Sie brauchen `npm run build` und ein installiertes Microsoft Edge:

| Skript | Prüft |
|---|---|
| `node scripts/gesamtAblauf.js` | Neuer Spieler: Tutorial, Battle gewinnen, kaufen, Garage, fahren, Online-Duell gegen ein zweites Fenster |
| `GPU=1 node scripts/onlineAblauf.js` | Online-Duell mit 200 ms Latenz und 5 % Paketverlust, Look-Sync, Wiederverbindung, Abbruch |
| `GPU=1 node scripts/uiAblauf.js` | Alle Bildschirme in 7 Bildschirmgrößen, Überlappungen, Barrierefreiheit |
| `node scripts/scrollAblauf.js` | Wischen in allen Menüs mit echten Touch-Ereignissen, dazu Regler, Aufkleber ziehen, Touch-Tasten |
| `node scripts/klangCheck.js` | Motor, Reifen, Klangunterschiede, Übersteuern, Regler |
| `node scripts/garageAblauf.js`, `node scripts/shopAblauf.js` | Garage und Shop im Detail |
| `node scripts/performance.js` | FPS, Draw Calls und Speicher |
| `node scripts/effektBilder.js` | Fotos der Effekte im Drift |

`GPU=1` nutzt die echte Grafikkarte. Ohne diese Angabe laufen beide Skripte im Software-Rendering: langsam, ohne verlässliche Zeitmessung und im Gesamtlauf bei 1080p nicht immer stabil.

Was nur mit echten Geräten geht, steht in [docs/TESTPLAN_MANUELL.md](docs/TESTPLAN_MANUELL.md).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `shared/` | Code für Client und Server: Physik, Wertung, Bots, Autos, Strecken, Ökonomie, Protokoll |
| `client/` | Darstellung (`render/`), Modi (`modi/`), Oberfläche (`ui/`), Klang (`audio/`), Eingabe, Texte (`i18n/de.js`) |
| `server/` | HTTP, WebSocket, Lobbys, Duell-Ablauf |
| `tests/` | Automatische Tests |
| `scripts/` | Browser-Abläufe, Messungen, Kalibrierung |
| `docs/` | Dokumentation |

## Dokumentation

- [Entscheidungen](docs/ENTSCHEIDUNGEN.md) und [Fortschritt](docs/FORTSCHRITT.md)
- [Autos](docs/AUTOS.md), [Wertung](docs/WERTUNG.md), [Ökonomie](docs/OEKONOMIE.md), [Livery](docs/LIVERY.md)
- [Netzwerk](docs/NETZWERK.md), [Performance](docs/PERFORMANCE.md)
- [Render-Anleitung](docs/DEPLOY_RENDER.md), [Testplan](docs/TESTPLAN_MANUELL.md), [Lizenzen](docs/LIZENZEN.md)

## Datenschutz

Keine Konten, keine Tracker, keine Werbung, keine Anfragen an fremde Server. Spielstände liegen im Browser und lassen sich in den Einstellungen exportieren. Der Server hält nur Lobbys im Arbeitsspeicher, gespeichert wird dort nichts dauerhaft.
