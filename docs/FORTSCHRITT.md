# Fortschritt

> Beim Neustart zuerst diese Datei und den Abschnitt der aktuellen Phase in `SPEC.md` lesen.

**Aktuelle Phase:** 6 – Währung, Shop, Fortschritt

## Phase 1: Fundament – ✅ abgeschlossen

- [x] `npm install`, `npm run dev`, `npm run build`, `npm start` laufen fehlerfrei
- [x] Canvas füllt jeden Bildschirm, Hoch- und Querformat und Größenänderung funktionieren (ResizeObserver, `100dvh/100dvw`, Safe-Area)
- [x] Eingaben von Tastatur, Touch (Mehrfach-Touch: Lenken + Gas + Handbremse gleichzeitig, Finger-Gleiten zwischen Pfeilen) und Gamepad kommen im Spiel an
- [x] Speichern, Laden, Migration und defekter Save sind getestet (`tests/spielstand.test.js`, `tests/speicher.test.js`)
- [x] `/healthz` antwortet, WebSocket-Verbindung (Test-Echo) funktioniert (`tests/server.test.js` + im Browser geprüft)

## Phase 2: Fahrphysik und erstes Auto – ✅ abgeschlossen

- [x] Drift lässt sich per Handbremse, Lastwechsel (Scandinavian Flick), Gasüberschuss und Kupplungstritt zuverlässig einleiten, halten und beenden (`tests/physik.test.js`, im Browser per Tastatur geprüft)
- [x] Zufalls-Eingabetest (10 Minuten simulierte Zeit je Auto, fester Seed) ohne NaN und Ausreißer
- [x] Alle Extremfälle aus Abschnitt 2 bestanden (Dauer-Handbremse, Vollgas gegen Wand, Ecke, Volleinschlag bei Höchstgeschwindigkeit, Wechsellenken in Höchstfrequenz, dt 0,0001 … 1 s, ungültige Eingaben)
- [x] Fahrgefühl mit Touch-Steuerung und Assistenz: Gegenlenk-Assistenz (Standard 60 %) und Drift-Haltehilfe (Touch, 30 %) eingebaut und per Simulation geprüft; Feinabstimmung am echten Gerät steht im manuellen Testplan
- [x] Physik-Tests grün (18 Tests)

## Phase 3: Autos, Strecken, Rendering – ✅ abgeschlossen

- [x] Alle 6 Autos fahren sich spürbar unterschiedlich, Messwerte liegen im Rahmen von Abschnitt 4 (`docs/AUTOS.md`, Tests ±15 % für 0–100 und Vmax)
- [x] Alle 3 Strecken komplett befahrbar ohne Steckenbleiben (`tests/strecken.test.js`: jedes Auto fährt jede Strecke ohne Reset; keine Überschneidungen; Kamera mit Wand-Strahltest gegen Clipping)
- [x] 60 FPS Desktop, ≥ 30 FPS bei 4× CPU-Drosselung (`docs/PERFORMANCE.md`: 138–165 FPS bei 4×, 57–95 FPS bei 6×, max. 73 Draw Calls)
- [x] Kein Speicheranstieg bei wiederholtem Streckenwechsel (9 Wechsel, Texturen/Geometrien konstant; PMREM-Leck gefunden und behoben)

Gebaut: Streckenbau mit Ideallinie, 3 Strecken (Industriehof 893 m/6 Zonen, Küstenpass 1610 m/9 Zonen, Neon-Hafen 1264 m/8 Zonen), modulare Automodelle mit Ankern, 12 Felgen, alle Anbauteile, Innenraum, Lichter; Strecken-Renderer mit Deko je Strecke, Tageszeit/Licht, nasser Asphalt; Rennmodus, Freies Fahren, Zeitangriff (3 Runden, Zeitlimit; Ablauf headless bis zum Ergebnis geprüft), HUD, Minimap, Pause, Ergebnis, Hauptmenü, Streckenwahl, Einstellungen (inkl. Tastenbelegung, Layout-Editor, Export/Import, Zurücksetzen), Ladebildschirm, Qualitätsstufen, Speicherfreigabe.
Werkzeuge: `scripts/streckenVorschau.js`, `scripts/streckenPosen.js`, `scripts/botTest.js`, `scripts/autoMessung.js`, `scripts/performance.js`.

## Phase 4: Wertung und Tandem-Battle – ✅ abgeschlossen

- [x] Wertung ist deterministisch und durch Unit-Tests abgedeckt (`tests/wertung.test.js`: Formeln, Combo, Abzüge, Flüssigkeit, Aufschließphase, Determinismus, kein Punkte-Farmen)
- [x] Bot-Simulation: alle Stufen beenden alle Strecken und liegen im Ziel-Punktebereich (`tests/bots.test.js`, 20 Läufe je Stufe und Strecke mit den Autos der Pool-Gegner) – **Ausnahme Küstenpass/Meister** (Mittel ca. 63 statt 70–85, 18/20 Runden im Zeitlimit; als „todo“ markiert und in `docs/WERTUNG.md` begründet)
- [x] Ein Battle (Schnell und Best of 3) läuft komplett durch, inklusive Gleichstand (`tests/battle.test.js`; im Browser per Autopilot Schnell und Best of 3 bis zum Ergebnis durchgespielt)
- [x] Belohnung und Freischaltungen werden korrekt gebucht (`tests/battle.test.js`: Tabelle, Schnell halbiert, Erstsieg, Perfekt, keine Doppelbuchung, Strecken- und Stufen-Freischaltung, Zeitangriff-Medaillen, Trainings-Bonus)

Gebaut: `shared/wertung.js` + `wertungsParameter.js`, `shared/battle.js` (Läufe, Rollentausch, Gleichstand), `shared/oekonomie.js` (Buchungen, Battle-/Zeitangriff-/Trainings-Belohnungen, Freischaltungen, Statistik), Gegner-Pool mit 16 Fahrern (`shared/bots/gegnerPool.js`), Bot-Kalibrierung je Strecke (`scripts/stufenKalibrierung.js`), Client: Bot-Battle (`client/modi/botBattle.js`) mit Zwischenständen und Ergebnis, Battle-Auswahl mit Gegner-Vorschau auf der Drehscheibe, Battle-HUD (beide Punktestände, Rolle, Abstand mit Farbe und Symbol, Namensschild), Wertung im Freien Fahren und Zeitangriff (`client/modi/rennenWertung.js`), `docs/WERTUNG.md`, `docs/DEPLOY_RENDER.md`.

## Betrieb: Render und Produktionstest – ✅ erledigt

- [x] `render.yaml` geprüft und verbessert (Region Frankfurt, `npm ci`, Health-Check, Node 22); Anleitung in `docs/DEPLOY_RENDER.md`
- [x] Produktionstest wie auf Render: frischer Klon von GitHub, `npm ci` (90 Pakete), `npm run build`, `npm start` mit eigenem `PORT`: `/healthz`, Startseite, Service Worker, Manifest und WebSocket-Echo (2 ms) funktionieren, Sicherheits-Header und Cache-Regeln korrekt
- [x] Klickweg Menü → Tandem-Battle → Rennen im Produktionsbuild in echtem Edge ohne Konsolenfehler
- [ ] Veröffentlichung selbst: Der Dienst muss einmalig im Render-Dashboard angelegt werden (Schritte in `docs/DEPLOY_RENDER.md`); danach veröffentlicht jeder Push auf `main` automatisch

## Phase 5: Garage und Individualisierung – ✅ abgeschlossen

- [x] Jede Änderung ist live am 3D-Auto sichtbar (`scripts/garageAblauf.js`; höchstens eine Neuzeichnung pro Bild)
- [x] Aufkleber-Editor mit mindestens 30 Ebenen, Rückgängig/Wiederholen stabil (30 Ebenen geprüft, die 31. wird abgelehnt; 40 Schritte rückgängig stellen den Look exakt wieder her; 60 Schritte Verlauf)
- [x] Look-Code Export/Import fehlerfrei, ungültige Codes werden abgelehnt (`tests/garage.test.js`, auch 30 Text-Ebenen bleiben unter 8 KB; im Browser durchgeklickt)
- [x] Gespeicherte Looks erscheinen im Rennen exakt wie in der Garage (`scripts/garageAblauf.js`: Look im Rennen identisch, auch nach dem Neuladen; dasselbe Modell und dieselbe Livery)
- [x] Alle 6 Autos nehmen alle Teilearten korrekt an (`scripts/garageCheck.js`: 516 Kombinationen ohne ungültige Geometrie und innerhalb der Karosseriegrenzen; `scripts/garageBilder.js`: Sichtprüfung per Kontaktbogen)

Gebaut: Garage (`client/modi/garage.js`, `client/ui/garage/*`) mit Showroom in 5 Stimmungen, freier Kamera mit Schnellansichten, Farbwähler (Rad, Hex, Schnellfarben), 12 Mustern, 87 Aufklebern in 8 Paketen plus Text in 6 Schriften, Ebenen-Editor mit Zonen-Vorschau, Gruppen und „Auf andere Seite“, Felgen, Bodykit, Fahrwerk-Optik, Qualm, Neon, Scheiben, Licht, Backfire, Kennzeichen, Leistungs-Tuning mit Vorher/Nachher und PI, Setup- und Look-Slots, Look-Code, Fotomodus, Anprobe mit Kauf-Flow, `docs/LIVERY.md`.
Gefundene und behobene Fehler: Wortfilter sperrte „König“ (und damit den Spielnamen); Frontkappe des Onyx RS fehlte wegen eines NaN aus einem Rundungsfehler.

## Phase 6: Währung, Shop, Fortschritt – 🚧 als Nächstes

1. Shop-Bildschirm (Kategorien, Suche, Filter, Sortierung, Vorschau): Autos und Teile kaufen und verkaufen (50 %), letztes Auto nie.
2. Tagesaufgaben (≥ 12 im Pool, 3 je Tag, 100–400 DM), Anzeige im Hauptmenü.
3. Interaktives Tutorial beim ersten Start (überspringbar, in den Einstellungen wiederholbar).
4. `docs/OEKONOMIE.md` mit Balance-Tabelle und Tests gegen Währungs-Vermehrung.

## Offen / bekannte Probleme

- Gamepad konnte mangels Gerät nur über den Code-Pfad geprüft werden (manueller Test).
- Qualmfarbe und Backfire sind schon wählbar, die Effekte selbst kommen in Phase 8.
- HUD-Größen sind in px; auf sehr großen Fenstern wirkt das HUD klein (Politur in Phase 8).
- Bot-Punkte streuen stark von Durchgang zu Durchgang; Küstenpass/Meister unter Ziel (siehe `docs/WERTUNG.md`, Entscheidung B5).
- Phase 7: Beim Verbinden zum (ggf. schlafenden) Render-Server „Server wird gestartet …“ anzeigen und bis zu 90 s erneut versuchen.

## Wichtige Entscheidungen

Siehe `docs/ENTSCHEIDUNGEN.md` (T1–T16, P1–P11, D1–D10, W1–W2, B1–B12, E1–E4, R1–R2, G1–G8).
