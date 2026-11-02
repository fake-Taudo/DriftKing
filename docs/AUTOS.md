# Autos

Alle sechs Autos sind frei erfunden (Namen, Formen, Daten). Die Fahrphysik-Parameter stehen in `shared/autos.js`, die globalen Werte in `shared/physikParameter.js`, die Darstellung in `client/render/auto/autoFormen.js`.

## Charakter

| Auto | Klasse | Antrieb | Charakter (Ziel) | Wodurch er entsteht |
|---|---|---|---|---|
| Kestrel S | Heck-Coupé | Heck | leicht, wendig, verzeiht Fehler | geringe Masse, kleines Trägheitsmoment, großer Lenkeinschlag |
| Marlin 4D | Limousine | Heck | stabil, gutmütig | hohe Gierdämpfung und Stabilität, mehr Wankanteil vorne |
| Vireo Turbo | Turbo-Coupé | Heck | spritzig, nervös, Turboloch | 42 % der Leistung hängen am Ladedruck (Aufbauzeit 0,85 s), kleine Gierdämpfung |
| Hornet Wagon | Kombi | Heck | lange, stabile Drifts, träges Einlenken | langer Radstand, hohes Trägheitsmoment, höchste Stabilität |
| Bastion GT | Muscle-Coupé | Heck | viel Drehmoment, raucht, schwer zu zähmen | 420 PS bei 1650 kg, flache V8-Kurve, hohe Sperre |
| Onyx RS | Sportwagen | Allrad (88 % hinten) | höchster Grip und Topspeed, schwerer zu driften | Grip 1,14, Allrad mit nur 12 % Frontanteil |

## Messwerte (Serie)

Erzeugt mit `node scripts/autoMessung.js --md`. Die Tests (`tests/physik.test.js`) prüfen 0–100 und Höchstgeschwindigkeit gegen die Richtwerte (±15 %) sowie die Rangfolge.

| Auto | PI | 0–100 (Soll) | Höchstg. (Soll) | Wendekreis | Bremsweg 100–0 | max. Driftwinkel | Driftstabilität |
|---|---|---|---|---|---|---|---|
| Kestrel S | 200 | 7.8 s (7.5 s) | 164 km/h (170) | 5.6 m | 38.5 m | 42° | 1.1 s |
| Marlin 4D | 258 | 7.0 s (7 s) | 185 km/h (190) | 6.7 m | 37.7 m | 42° | 10.0 s |
| Vireo Turbo | 317 | 5.9 s (5.5 s) | 198 km/h (200) | 5.6 m | 37.7 m | 22° | 0.6 s |
| Hornet Wagon | 271 | 7.1 s (7 s) | 191 km/h (195) | 7.3 m | 38.5 m | 39° | 2.2 s |
| Bastion GT | 435 | 5.3 s (4.8 s) | 223 km/h (230) | 6.6 m | 38.9 m | 49° | 1.0 s |
| Onyx RS | 602 | 4.2 s (4.3 s) | 241 km/h (250) | 6.4 m | 32.4 m | 55° | 1.2 s |

**Messverfahren**

- **0–100:** optimaler Start (Gas wird so dosiert, dass der Hinterradschlupf nahe am Haftmaximum bleibt), Automatik.
- **Höchstgeschwindigkeit:** 120 s Vollgas geradeaus.
- **Wendekreis:** Durchmesser bei Volleinschlag und ca. 12 km/h.
- **Bremsweg:** Vollbremsung aus 100 km/h bis zum Stillstand.
- **Max. Driftwinkel:** Halte-Kreisfahrt mit PI-Regler (Gas → Winkel, Gegenlenk-Assistenz 85 %), größter Soll-Winkel, der 4 s stabil gehalten wird.
- **Driftstabilität:** Handbremsen-Drift, danach konstant Gas 0,75 und Lenkung neutral (Assistenz 60 %): Zeit, bis das Auto ausbricht (> 100°) oder sich gerade stellt (< 10°). Höher = gutmütiger.

## Voll getunt (alle Kategorien Stufe 5)

| Auto | PI (Zuwachs) | 0–100 | Höchstg. | Bremsweg |
|---|---|---|---|---|
| Kestrel S | 289 (+45 %) | 5.2 s | 196 km/h | 32.6 m |
| Marlin 4D | 375 (+45 %) | 5.0 s | 220 km/h | 32.3 m |
| Vireo Turbo | 459 (+45 %) | 5.1 s | 230 km/h | 32.8 m |
| Hornet Wagon | 392 (+45 %) | 5.0 s | 223 km/h | 32.4 m |
| Bastion GT | 630 (+45 %) | 4.5 s | 257 km/h | 31.6 m |
| Onyx RS | 872 (+45 %) | 2.6 s | 289 km/h | 29.4 m |

## Leistungsindex (PI)

Formel in `shared/leistungsindex.js`:

```
PI_basis = 1,236 · (kW pro Tonne) + 2,0 · (Auslegungs-Höchstgeschwindigkeit in km/h)
         + 600 · (Grip − 1) + 25 (Allrad) + 20 · (Stabilität − 1) − 285,8
PI       = PI_basis · (1 + Σ g_k · (Stufe_k − 1) / 4)        begrenzt auf 100 … 999
```

Gewichte der Tuning-Kategorien g_k: Motor 0,12 · Turbo/Ansaugung 0,06 · Reifen 0,08 · Fahrwerk 0,05 · Differenzialsperre 0,04 · Bremse 0,03 · Gewicht 0,07 (Summe 0,45 → volles Tuning = +45 %).

Beispiel Kestrel S: 160 PS = 117,7 kW bei 1,0 t → 1,236 · 117,7 + 2,0 · 170 + 0 + 0 + 0 − 285,8 ≈ 200.

**Einheits-Leistung (Online):** Beide Autos fahren mit Serien-Tuning; die Leistung wird so skaliert, dass der Basis-PI dem vom Server gesetzten Normwert entspricht (`leistungsFaktorFuerPI`).

## Wirkung der Leistungsteile (Stufe 1 → 5)

| Kategorie | Wirkung |
|---|---|
| Motor | Leistung ×1,00 → ×1,34 |
| Turbo/Ansaugung | Leistung ×1,00 → ×1,17, Turboloch (Ladedruck-Aufbauzeit) ×1,00 → ×0,52 |
| Reifen | Grip ×1,00 → ×1,10, Gleitreibung +0 → +0,032 (kontrollierbareres Rutschen) |
| Fahrwerk | Stabilität ×1,00 → ×1,16, Wanken ×1,00 → ×0,60 |
| Differenzialsperre | Sperrgrad +0 → +0,24 |
| Bremse/Handbremse | Bremskraft ×1,00 → ×1,32, Handbremse ×1,00 → ×1,24 |
| Gewichtsreduktion | Masse ×1,00 → ×0,88 |

## Setup-Regler (kostenlos)

| Regler | Wirkung (0 … 1, Mitte = neutral) |
|---|---|
| Sturz-Setup | ±3 % Seitenhalt gegen Längsgrip |
| Sperrgrad | ±0,2 Sperrgrad |
| Lenkwinkel | ±7° maximaler Einschlag |
| Gaskennlinie | Exponent 1,74 (sanft) … 0,57 (direkt) |
| Bremsbalance | ±8 % Bremskraft nach vorne/hinten |
| Federhärte | ±3 % Stabilität, ±12,5 % Wanken, ±3 % Wankanteil vorne |

## Kleine Wirkungen der Optik (bewusst gering)

| Teil | Wirkung |
|---|---|
| Spoiler | Stabilität +2 … +8 % (wirkt ab ca. 40 m/s als etwas mehr Grip hinten), Luftwiderstand +0,5 … +3 % (minimal weniger Topspeed) |
| Motorhaube | Lufthutze +2 kg, Karbonhaube −9 kg, Lüftungshaube −4 kg |
| Frontstoßstange / Verbreiterung | Luftwiderstand +0,3 … +1,4 % |
| Tieferlegung | Schwerpunkt bis 5 cm tiefer (weniger Lastverlagerung) |
| Sturz (Optik) | etwas mehr Seitenhalt; extremer Sturz hinten (über −3°) kostet Traktion |
| Spurverbreiterung | Spurweite bis +8 cm (weniger Querlastverlagerung) |

## Modularer Aufbau der Modelle

Jedes Auto wird zur Laufzeit erzeugt (`karosserie.js`): Querschnitt-Loft entlang der Länge mit Radhausausschnitten und Kotflügelwölbung, eigene Kabine (Scheiben, Dach), Säulen. Daraus entstehen **Anker-Punkte** (Frontstoßstange, Heck, Dach, Haube, Radhäuser, Schweller, Kofferraum, Spiegel, Auspuff, Scheinwerfer, Rücklichter, Kennzeichen, Innenraum). Alle Anbauteile (`anbauteile.js`) werden parametrisch aus diesen Ankern erzeugt und passen deshalb an jedes Auto.
