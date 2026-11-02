# Performance

Messung mit `node scripts/performance.js` (nach `npm run build`): Produktionsserver, Edge (Chromium) per `playwright-core`, Freies Fahren mit Autopilot (`?perf=1&strecke=…`), CPU-Drosselung über das DevTools-Protokoll (`Emulation.setCPUThrottlingRate`). Qualität „Automatisch“.

**Testsystem:** Windows 11, GPU NVIDIA GeForce RTX 3070 (ANGLE/Direct3D 11). Die FPS-Obergrenze 165 entspricht der Bildwiederholrate des Monitors.

## FPS und Draw Calls (Endstand mit allen Effekten)

| Profil | Strecke | CPU-Drosselung | FPS | Draw Calls (max.) | Qualität (Automatik) |
|---|---|---|---|---|---|
| Desktop 1280×720 | Industriehof | 1× | 164.9 | 47 | mittel |
| Desktop 1280×720 | Industriehof | 4× | 126.5 | 55 | mittel |
| Desktop 1280×720 | Industriehof | 6× | 45.1 | 64 | hoch |
| Desktop 1280×720 | Küstenpass | 1× | 165.1 | 47 | mittel |
| Desktop 1280×720 | Küstenpass | 4× | 152.4 | 46 | mittel |
| Desktop 1280×720 | Küstenpass | 6× | 56.2 | 68 | mittel |
| Desktop 1280×720 | Neon-Hafen | 1× | 165.0 | 62 | mittel |
| Desktop 1280×720 | Neon-Hafen | 4× | 135.8 | 62 | mittel |
| Desktop 1280×720 | Neon-Hafen | 6× | 52.5 | 76 | hoch |
| Handy 390×844 (DPR 3, Touch) | Industriehof | 4× | 125.7 | 48 | mittel |
| Handy 390×844 (DPR 3, Touch) | Industriehof | 6× | 65.7 | 55 | mittel |
| Handy 390×844 (DPR 3, Touch) | Küstenpass | 4× | 154.0 | 47 | mittel |
| Handy 390×844 (DPR 3, Touch) | Küstenpass | 6× | 82.7 | 47 | mittel |
| Handy 390×844 (DPR 3, Touch) | Neon-Hafen | 4× | 132.0 | 62 | mittel |
| Handy 390×844 (DPR 3, Touch) | Neon-Hafen | 6× | 68.7 | 62 | mittel |

Ziele: Desktop 60 FPS ✅, mindestens 30 FPS bei 4× CPU-Drosselung ✅ (auch bei 6× ✅), Draw Calls unter 150 ✅.

Im echten Battle mit Qualm, Spuren, Wetter und zwei Autos: 165 FPS und höchstens 94 Draw Calls auf „Hoch“, 77 auf „Niedrig“ (`scripts/effektBilder.js`).

Die Effekte kosten bei 4× Drosselung rund 10 bis 20 % gegenüber dem Stand vor Phase 8 (Industriehof 160 → 126 FPS). Der Abstand zum Ziel bleibt groß.

**Einschränkung:** Die Handy-Messung emuliert Bildschirm und CPU, nutzt aber die Desktop-GPU. Die tatsächliche GPU-Last eines Mittelklasse-Handys lässt sich so nicht messen. Dafür gibt es die Automatik, die die Stufe nach 2 s zu langsamer Bilder senkt, und den manuellen Gerätetest (`docs/TESTPLAN_MANUELL.md`). Besonders die Füllrate von Qualm und Regen ist dort zu prüfen.

## Speicher

Jeweils nach erzwungener Speicherbereinigung gemessen (`renderer.info.memory`, `performance.memory`).

**Neun Streckenwechsel:**

| Wechsel | Strecke | Geometrien | Texturen | JS-Heap (MB) |
|---|---|---|---|---|
| 1 | Küstenpass | 48 | 12 | 11.5 |
| 2 | Neon-Hafen | 58 | 16 | 12.4 |
| 3 | Industriehof | 50 | 16 | 13.4 |
| 4 | Küstenpass | 48 | 15 | 14.0 |
| 5 | Neon-Hafen | 58 | 16 | 13.0 |
| 6 | Industriehof | 50 | 16 | 13.7 |
| 7 | Küstenpass | 48 | 15 | 14.1 |
| 8 | Neon-Hafen | 58 | 16 | 13.2 |
| 9 | Industriehof | 50 | 16 | 14.0 |

**Fünf Runden Menü → Garage → Menü → Shop → Menü:**

| Runde | Texturen | JS-Heap (MB) | Lebende Modi |
|---|---|---|---|
| 1 | 8 | 8.2 | 1 |
| 2 | 8 | 8.6 | 1 |
| 3 | 8 | 8.7 | 1 |
| 4 | 8 | 8.8 | 1 |
| 5 | 8 | 8.9 | 1 |

Kein Anstieg der Texturen, und nur der aktuelle Modus bleibt im Speicher ✅.

Gefundene und behobene Lecks:

- Die Environment-Maps (PMREM) wurden nur über ihre Textur freigegeben, nicht über das Render-Target. Pro Streckenwechsel blieb eine Textur im Speicher.
- Die Schattenkarte des Hauptmenüs wurde nie freigegeben. Pro Moduswechsel blieben 2 Texturen mit 1024×1024 Pixeln auf der Grafikkarte, im langen Lauf stürzte das Software-Rendering dadurch ab.

**Messfalle:** `waitForSelector` von Playwright hält die zurückgegebenen Elemente fest und damit über deren Ereignis-Handler den alten Modus samt Szene. Das sieht aus wie ein großes Leck, ist aber keins. Die Speichermessung nutzt deshalb nur `locator()`.

## Online-Duell

Zwei Fenster mit echter GPU über ein Relais mit 200 ms Latenz je Richtung und 5 % verlorenen Fahrzuständen (`GPU=1 node scripts/onlineAblauf.js`):

| Messgröße | Wert |
|---|---|
| Bilder pro Sekunde | 165 |
| Ping (gemessen) | 458 ms |
| Gemessenes Alter eintreffender Zustände | 223 ms |
| Bilder mit extrapoliertem Gegner | 0,8 % |
| Sprünge in der Darstellung | 0 von 4.121 Bildern |
| Größter Weg des Gegners pro Bild | 0,17 m |

Auf einem Bandbreiten-Niveau von 25 Nachrichten pro Sekunde mit rund 70 Bytes je Spieler braucht ein Duell etwa 2 kB/s pro Richtung. Dazu kommen die Rahmen von TCP und WebSocket.

## Maßnahmen

- Wiederholte Objekte instanziert (Container, Reifen, Pfosten, Lampen, Bäume, Felsen, Räder), statische Geometrie je Material zusammengefügt.
- Räder aller vier Positionen als eine Instanz je Teil (5 Draw Calls pro Auto), Anbauteile als eine Geometrie mit Vertex-Farben.
- Schatten nur für Autos (kleine, mitwandernde Shadow-Map), auf „Niedrig“ Blob-Schatten.
- Livery-Textur wird nur bei Änderungen neu gezeichnet.
- Partikel als ein Draw Call je Schwarm, leere Schwärme kosten nichts, die Menge skaliert mit der Qualitätsstufe (25 %, 60 %, 100 %).
- Reifenspuren als Ringpuffer: Hochgeladen wird nur der neue Bereich, das Verblassen rechnet der Shader.
- Keine Nachbearbeitung außer Bloom auf „Hoch“ am Desktop.
- Physik ≈ 3 µs pro Schritt und Auto (Node, gemessen in den Tests).
