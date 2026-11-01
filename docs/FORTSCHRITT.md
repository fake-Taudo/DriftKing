# Fortschritt

> Beim Neustart zuerst diese Datei und den Abschnitt der aktuellen Phase in `SPEC.md` lesen.

**Aktuelle Phase:** 3 – Autos, Strecken, Rendering

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

## Offen / bekannte Probleme

- Gamepad konnte mangels Gerät nur über den Code-Pfad geprüft werden (manueller Test).
- `client/assets/aufkleber.js` ist bis Phase 5 leer.
- Messgröße „max. stationärer Driftwinkel“ nutzt noch einen einfachen Regler; in Phase 4 wird der Bot-Regler dafür verwendet.

## Wichtige Entscheidungen

Siehe `docs/ENTSCHEIDUNGEN.md` (T1–T16, P1–P11, W1).
