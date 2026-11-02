# Fortschritt

> Beim Neustart zuerst diese Datei und den Abschnitt der aktuellen Phase in `SPEC.md` lesen.

**Aktuelle Phase:** 5 – Garage und Individualisierung

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

## Phase 5: Garage und Individualisierung – 🚧 als Nächstes

1. Aufkleber-Bibliothek (≥ 60, eigene Vektorgrafiken) in `client/assets/aufkleber.js`, 12 Muster (`render/auto/muster.js`), Aufkleber-Zeichnen auf die Livery (`render/auto/aufkleberMaler.js`).
2. Garage-Modus: Lack, Muster, Aufkleber-Editor (Ebenen, Spiegeln, Text), Felgen/Reifen, Bodykit, Fahrwerk-Optik, Details, Leistungs-Tuning, Setup-Regler; Anprobe vor dem Kauf.
3. Look-Slots, Look-Code (Export/Import), Fotomodus, Showroom.
4. Menüeintrag „Garage“ und Knopf „Garage“ im Battle-Ergebnis.

## Offen / bekannte Probleme

- Gamepad konnte mangels Gerät nur über den Code-Pfad geprüft werden (manueller Test).
- `client/assets/aufkleber.js`, Muster und Aufkleber-Zeichnen folgen in Phase 5.
- HUD-Größen sind in px; auf sehr großen Fenstern wirkt das HUD klein (Politur in Phase 8).
- Bot-Punkte streuen stark von Durchgang zu Durchgang; Küstenpass/Meister unter Ziel (siehe `docs/WERTUNG.md`, Entscheidung B5).
- Phase 7: Beim Verbinden zum (ggf. schlafenden) Render-Server „Server wird gestartet …“ anzeigen und bis zu 90 s erneut versuchen.

## Wichtige Entscheidungen

Siehe `docs/ENTSCHEIDUNGEN.md` (T1–T16, P1–P11, D1–D10, W1, B1–B12, E1–E4, R1–R2).
