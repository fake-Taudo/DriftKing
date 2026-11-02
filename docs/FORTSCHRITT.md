# Fortschritt

> Beim Neustart zuerst diese Datei und den Abschnitt der aktuellen Phase in `SPEC.md` lesen.

**Aktuelle Phase:** 4 – Wertung und Tandem-Battle gegen Bots

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

Gebaut: `shared/physik/fahrzeug.js` (Einspurmodell, Lastverlagerung, Pacejka vorne, Hinterachse mit Raddrehzahl-Zustand, Kamm'scher Kreis, Sperre, Turbo, Kupplungstritt, Rückwärtsgang, Automatik/manuell, Wandkollision mit Impuls, weiche Auto-Auto-Kollision), `kollision.js` (Uniform Grid, Kreise, OBB, Strahl für Kamera), `haenger.js`, `messung.js` (0–100, Vmax, Wendekreis, Bremsweg, Driftwinkel, Driftstabilität), `tuning.js`, `leistungsindex.js`; Client: Verfolgerkamera mit Drift-Verhalten und 4 Modi, Umgebung (Himmel-Shader, Env-Map, mitwandernde Shadow-Map), prozedurale Texturen, Testfahrt-Modus mit Autowahl.

## Phase 3: Autos, Strecken, Rendering – ✅ abgeschlossen

- [x] Alle 6 Autos fahren sich spürbar unterschiedlich, Messwerte liegen im Rahmen von Abschnitt 4 (, Tests ±15 % für 0–100 und Vmax)
- [x] Alle 3 Strecken komplett befahrbar ohne Steckenbleiben (: jedes Auto fährt jede Strecke ohne Reset; keine Überschneidungen; Kamera mit Wand-Strahltest gegen Clipping)
- [x] 60 FPS Desktop, ≥ 30 FPS bei 4× CPU-Drosselung (: 138–165 FPS bei 4×, 57–95 FPS bei 6×, max. 73 Draw Calls)
- [x] Kein Speicheranstieg bei wiederholtem Streckenwechsel (9 Wechsel, Texturen/Geometrien konstant; PMREM-Leck gefunden und behoben)

Gebaut: Streckenbau mit Ideallinie, 3 Strecken (Industriehof 893 m/6 Zonen, Küstenpass 1568 m/9 Zonen, Neon-Hafen 1264 m/8 Zonen), modulare Automodelle mit Ankern, 12 Felgen, alle Anbauteile, Innenraum, Lichter; Strecken-Renderer mit Deko je Strecke, Tageszeit/Licht, nasser Asphalt; Rennmodus, Freies Fahren, Zeitangriff (3 Runden, Zeitlimit), HUD, Minimap, Pause, Ergebnis, Hauptmenü, Streckenwahl, Einstellungen (inkl. Tastenbelegung, Layout-Editor, Export/Import, Zurücksetzen), Ladebildschirm, Qualitätsstufen, Speicherfreigabe. Werkzeuge: , , , , .

## Phase 4: Wertung und Tandem-Battle – 🚧 als Nächstes

1.  +  (20 Ticks/s, Führer/Verfolger-Formeln, Combo, Abzüge, Flüssigkeit, Normierung) + Unit-Tests, .
2. Drift-Bot () abstimmen: weniger Wandkontakte, Stufen-Zielpunkte erreichen; Referenzpunkte und Referenzzeiten je Strecke per Legende-Simulation () in die Streckendateien schreiben.
3. Battle-Ablauf (: Läufe, Rollentausch, Gleichstand), Battle-Modus im Client, Gegner-Pool (15 Fahrer), Battle-Auswahl, HUD-Battle-Teile, Ergebnis, Belohnungen, Freischaltungen.
4. Wertung im Freien Fahren / Zeitangriff einhängen (Punkte, Medaillen).

## Offen / bekannte Probleme

- Gamepad konnte mangels Gerät nur über den Code-Pfad geprüft werden (manueller Test).
- `client/assets/aufkleber.js` ist bis Phase 5 leer.
- Messgröße „max. stationärer Driftwinkel“ nutzt noch einen einfachen Regler; in Phase 4 wird der Bot-Regler dafür verwendet.

## Wichtige Entscheidungen

Siehe `docs/ENTSCHEIDUNGEN.md` (T1–T16, P1–P11, W1).
