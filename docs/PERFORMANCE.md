# Performance

Messung mit `node scripts/performance.js` (nach `npm run build`): Produktionsserver, Edge (Chromium) per `playwright-core`, Freies Fahren mit Autopilot (`?perf=1&strecke=…`), CPU-Drosselung über das DevTools-Protokoll (`Emulation.setCPUThrottlingRate`). Qualität „Automatisch“.

**Testsystem:** Windows 11, GPU NVIDIA GeForce RTX 3070 (ANGLE/Direct3D 11). Die FPS-Obergrenze 165 entspricht der Bildwiederholrate des Monitors.

## FPS und Draw Calls (Stand Phase 3)

| Profil | Strecke | CPU-Drosselung | FPS | Draw Calls (max.) | Qualität (Automatik) |
|---|---|---|---|---|---|
| Desktop 1280×720 | Industriehof | 1× | 165.1 | 45 | mittel |
| Desktop 1280×720 | Industriehof | 4× | 160.2 | 52 | mittel |
| Desktop 1280×720 | Industriehof | 6× | 57.6 | 64 | hoch |
| Desktop 1280×720 | Küstenpass | 1× | 165.0 | 44 | mittel |
| Desktop 1280×720 | Küstenpass | 4× | 164.6 | 43 | mittel |
| Desktop 1280×720 | Küstenpass | 6× | 66.1 | 57 | hoch |
| Desktop 1280×720 | Neon-Hafen | 1× | 165.0 | 60 | mittel |
| Desktop 1280×720 | Neon-Hafen | 4× | 142.1 | 65 | mittel |
| Desktop 1280×720 | Neon-Hafen | 6× | 66.4 | 73 | hoch |
| Handy 390×844 (DPR 3, Touch) | Industriehof | 4× | 162.6 | 46 | mittel |
| Handy 390×844 (DPR 3, Touch) | Industriehof | 6× | 91.2 | 52 | mittel |
| Handy 390×844 (DPR 3, Touch) | Küstenpass | 4× | 163.0 | 44 | mittel |
| Handy 390×844 (DPR 3, Touch) | Küstenpass | 6× | 94.9 | 44 | mittel |
| Handy 390×844 (DPR 3, Touch) | Neon-Hafen | 4× | 138.4 | 60 | mittel |
| Handy 390×844 (DPR 3, Touch) | Neon-Hafen | 6× | 83.4 | 65 | mittel |

Ziele: Desktop 60 FPS ✅, ≥ 30 FPS bei 4× CPU-Drosselung ✅ (auch 6× ✅), Draw Calls < 150 ✅.

**Einschränkung:** Die Handy-Messung emuliert Bildschirm und CPU, nutzt aber die Desktop-GPU. Die tatsächliche GPU-Last eines Mittelklasse-Handys lässt sich so nicht messen – dafür sorgt die Automatik (senkt die Stufe nach 2 s zu langsamer Frames) und der manuelle Gerätetest (`docs/TESTPLAN_MANUELL.md`).

## Speicher bei wiederholtem Streckenwechsel

Neun Wechsel nacheinander, jeweils nach erzwungener Garbage Collection gemessen (`renderer.info.memory`, `performance.memory`):

| Wechsel | Strecke | Geometrien | Texturen | JS-Heap (MB) |
|---|---|---|---|---|
| 1 | Küstenpass | 45 | 12 | 11.9 |
| 2 | Neon-Hafen | 54 | 16 | 12.7 |
| 3 | Industriehof | 47 | 16 | 12.3 |
| 4 | Küstenpass | 45 | 15 | 13.0 |
| 5 | Neon-Hafen | 54 | 16 | 12.7 |
| 6 | Industriehof | 47 | 16 | 12.8 |
| 7 | Küstenpass | 45 | 15 | 13.2 |
| 8 | Neon-Hafen | 54 | 16 | 13.2 |
| 9 | Industriehof | 47 | 16 | 13.0 |

Kein Anstieg ✅. Gefundener und behobener Fehler: Die Environment-Maps (PMREM) wurden nur über ihre Textur freigegeben, nicht über das Render-Target; dadurch blieb pro Wechsel eine Textur im Speicher.

## Maßnahmen

- Wiederholte Objekte instanziert (Container, Reifen, Pfosten, Lampen, Bäume, Felsen, Räder), statische Geometrie je Material zusammengefügt.
- Räder aller vier Positionen als eine Instanz je Teil (5 Draw Calls pro Auto), Anbauteile als eine Geometrie mit Vertex-Farben.
- Schatten nur für Autos (kleine, mitwandernde Shadow-Map), auf „Niedrig“ Blob-Schatten.
- Livery-Textur wird nur bei Änderungen neu gezeichnet.
- Physik ≈ 3 µs pro Schritt und Auto (Node, gemessen in den Tests).
