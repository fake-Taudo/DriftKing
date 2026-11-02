# Livery (Lack, Muster, Aufkleber)

Code: `client/render/auto/livery.js` (Textur), `liveryAtlas.js` (Atlas), `muster.js`, `aufkleberMaler.js`,
`karosserie.js` (UV-Koordinaten, Zonenmaße). Bibliothek: `client/assets/aufkleber.js`.

## Prinzip

Jedes Auto hat **eine Canvas-Textur** mit festen Bereichen für die Fahrzeugzonen (Zonen-Atlas).
Größe nach Qualitätsstufe (1024 oder 2048 Pixel). Die Textur wird **nur bei Änderungen** neu gezeichnet,
nie pro Frame: `Livery.zeichnen()` vergleicht eine Signatur aus Lack, Muster und Aufklebern. In der Garage
wird höchstens einmal pro Bild neu gezeichnet, auch wenn ein Regler viele Ereignisse auslöst. Beim Wechsel
des Autos oder beim Verlassen wird die Textur freigegeben.

Zeichenreihenfolge: Grundfarbe → Zweitfarbe (Dach, Haube) → Muster je Zone → Aufkleber in Ebenen-Reihenfolge.

## Atlas-Layout

Anteile der Textur, Ursprung oben links:

```
 0,0 ┌──────────────────────────────────────────────┐
     │ seiteL  (linke Seite)                        │  y 0,00–0,30
 0,3 ├──────────────────────────────────────────────┤
     │ seiteR  (rechte Seite)                       │  y 0,30–0,60
 0,6 ├───────────────┬─────────────┬────────────────┤
     │ haube         │ dach        │ heck           │  y 0,60–0,82 (heck)
     │ x 0,00–0,34   │ x 0,34–0,64 │ x 0,64–1,00    │
0,82 │               │             ├────────────────┤
     │               │             │ front          │  y 0,82–1,00
 1,0 └───────────────┴─────────────┴────────────────┘
```

## Projektion auf die Karosserie

Jede Karosseriefläche wird planar in ihre Zone projiziert (`zonenUV`, `karosserie.js`). Koordinaten im Atlas
(x nach rechts, y nach unten):

| Zone | x läuft | y läuft | sichtbarer Lackbereich |
|---|---|---|---|
| `seiteL` | Front → Heck | Dachhöhe → Boden | unterhalb der Scheiben (y ca. 0,35–0,9) |
| `seiteR` | Heck → Front | Dachhöhe → Boden | wie oben |
| `haube` | von links nach rechts über die Breite | Nase → Windschutzscheibe | ganz |
| `dach` | über die Breite | vorne → hinten | ganz |
| `heck` | über die Breite | oben Heckscheibe → Kofferraumkante (bis 0,5), dann Heckfläche bis zum Boden | ganz |
| `front` | über die Breite | Dachhöhe → Boden | nur der untere Teil (y ca. 0,45–0,9) |

Die Seiten laufen gegenläufig, damit Text auf beiden Seiten lesbar ist. Deshalb spiegelt „Auf andere Seite“
die x-Koordinate (`x → 1 − x`), kehrt die Drehung um und spiegelt die Form; Text bleibt ungespiegelt.

## Unverzerrtes Zeichnen

Die Zonen im Atlas haben ein anderes Seitenverhältnis als die Flächen am Auto. Deshalb liefert
`baueKarosserie()` je Auto die **Zonenmaße in Metern** (`zonen`). Muster und Aufkleber zeichnen in Metern:
`ctx.scale(zonenbreitePx / breiteM, zonenhoehePx / hoeheM)`. So bleibt ein Kreis auf jeder Zone rund, und ein
Rennstreifen ist auf Haube, Dach und Heck gleich breit.

## Aufkleber

- Pfad-Daten im Ansichtsfenster 100 × 100, gezeichnet per `Path2D` (`evenodd` für Löcher).
- Look-Felder: `x`, `y` (Mitte, Anteil der Zone; −0,5 bis 1,5, damit Aufkleber über den Rand ragen dürfen),
  `rot` (Grad), `skala` (1 = 1 m Kantenlänge), `farbe`, `spiegel`, `deckkraft`, `zone`, optional `gruppe`,
  bei Text `text` und `schrift`.
- Höchstens 30 Ebenen; spätere Einträge liegen oben. Beschnitten wird an der Zone.
- Bibliothek: 87 Aufkleber in 8 Paketen (Formen, Sterne & Blitze, Flammen, Streifen, Zahlen & Buchstaben,
  Flaggen-Muster, Symbole, erfundene Sponsoren), dazu Text-Aufkleber mit 6 lokal eingebundenen Schriften.
- Schriften werden bei Bedarf nachgeladen; danach zeichnet die Livery neu (`_schriftenNachladen`).

## Muster

12 Muster, alle deterministisch (eigener kleiner Zufallsgenerator mit festem Startwert je Zone), damit derselbe
Look auf jedem Gerät gleich aussieht. Parameter: Farbe, Deckkraft, Skala. Die rechte Seite wird beim Zeichnen
gespiegelt, damit x überall von vorne beginnt (Flammen und Blitze laufen auf beiden Seiten nach hinten).

## Prüfung

- `tests/garage.test.js`: Bibliothek, Look-Code, Editor-Schritte.
- `scripts/garageCheck.js`: alle Autos, alle Teile und Felgen (Geometrie, Passform), alle Muster und Aufkleber
  ergeben sichtbare Pixel. `scripts/garageAblauf.js`: Bedienablauf mit echten Klicks.
  `scripts/garageBilder.js`: Kontaktbögen für die Sichtprüfung.
