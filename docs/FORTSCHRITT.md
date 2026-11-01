# Fortschritt

> Beim Neustart zuerst diese Datei und den Abschnitt der aktuellen Phase in `SPEC.md` lesen.

**Aktuelle Phase:** 2 – Fahrphysik und erstes Auto

## Phase 1: Fundament – ✅ abgeschlossen

- [x] `npm install`, `npm run dev`, `npm run build`, `npm start` laufen fehlerfrei
- [x] Canvas füllt jeden Bildschirm, Hoch- und Querformat und Größenänderung funktionieren (ResizeObserver, `100dvh/100dvw`, Safe-Area)
- [x] Eingaben von Tastatur, Touch (Mehrfach-Touch: Lenken + Gas + Handbremse gleichzeitig, Finger-Gleiten zwischen Pfeilen) und Gamepad kommen im Spiel an
- [x] Speichern, Laden, Migration und defekter Save sind getestet (`tests/spielstand.test.js`, `tests/speicher.test.js`)
- [x] `/healthz` antwortet, WebSocket-Verbindung (Test-Echo) funktioniert (`tests/server.test.js` + im Browser geprüft)

Gebaut: Projektstruktur, Vite-Build mit Service-Worker-Plugin, Express + ws auf einem Port, Sicherheits-Header (CSP ohne Inline-Skripte), Game-Loop mit festem Zeitschritt (1/60 s, max. 5 Schritte/Frame), Eingabe-Abstraktion (Tastatur frei belegbar, Touch mit Layouts für Quer/Hoch, Gamepad, Neigung mit iOS-Berechtigung), Qualitätsstufen mit Automatik und Hysterese, Spielstand (Schema, Prüfsumme, Migration, Backup, Arbeitsspeicher-Rückfall, Export/Import als Datei und Text-Code), globale Fehlerbehandlung, WebGL-Kontextverlust, Debug-Overlay mit Cheats (nur Dev), i18n-Datei, PWA (Manifest, Icons, versionierter Cache, Update-Hinweis, iOS-Home-Bildschirm-Tipp), `render.yaml`.

## Offen / bekannte Probleme

- Gamepad konnte mangels Gerät nur über den Code-Pfad geprüft werden (manueller Test in `docs/TESTPLAN_MANUELL.md`).
- `client/assets/aufkleber.js` ist bis Phase 5 leer.

## Wichtige Entscheidungen

Siehe `docs/ENTSCHEIDUNGEN.md` (T1–T16, W1).
