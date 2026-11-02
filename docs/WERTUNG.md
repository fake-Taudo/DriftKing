# Wertung (Jury-Logik)

Code: `shared/wertung.js` (Formeln), `shared/wertungsParameter.js` (alle Konstanten),
`shared/battle.js` (Läufe, Rollentausch, Gleichstand), `shared/simulation.js` (headless Durchgang),
Client: `client/modi/rennenWertung.js` (Takt, Anzeige), `client/modi/botBattle.js` (Bot-Battle).
Server (Phase 7) verwendet dieselben Module.

## Takt und Eingangsdaten

- Die Wertung tickt mit **festen 20 Ticks pro Sekunde** (alle 3 Physik-Schritte zu 1/60 s), in allen
  Modi gleich. Sie arbeitet nur auf Fahrzeugzuständen (`x, y, θ, vx, vy`) und erkennt Wand- und
  Autokontakte selbst (Kollisionskreise der Karosserie gegen das Wandgitter bzw. gegeneinander).
  Damit kann der Server im Online-Duell aus den gemeldeten Zuständen dieselben Punkte berechnen.
- Driftwinkel = Winkel zwischen Fahrzeuglängsachse und Bewegungsrichtung (unter 1 m/s: 0).
- Streckenposition per Projektion auf die Mittellinie; **Punkte gibt es nur auf neuem Boden**:
  Der stetige Fortschritt entlang der Strecke muss das bisherige Maximum übertreffen (kein Kreisen,
  kein Zurückfahren, keine Donuts in einer Zone). Sprünge über 40 m (Zurücksetzen) zählen nicht.

## Führer (und Einzel-Wertung im Zeitangriff/Training)

Pro Tick, nur wenn Tempo ≥ 40 km/h und 10° ≤ Driftwinkel ≤ 100° und die erste Drift-Zone erreicht ist:

```
roh += basis · f_winkel · f_tempo · f_zone · f_linie · combo
```

| Faktor | Definition | Konstanten |
|---|---|---|
| f_winkel | Trapez: 0 bei 10°, linear auf 1 bei 30°, 1 bis 55°, linear auf 0 bei 85° | `winkel` |
| f_tempo | v / Referenztempo der Zone (außerhalb: Ideallinien-Tempo), begrenzt auf 0…1,2 | `tempoMax` |
| f_zone | 1,0 in einer Drift-Zone, 0,25 außerhalb | `zoneInnen`, `zoneAussen` |
| f_linie | 1 − min(1, Abstand zur Ideallinie / 5 m) · 0,6 → 0,4…1,0 | `linienToleranz`, `linienAnteil` |
| combo | 1,0…3,0; +0,1 je Sekunde sauberen Driftens; fällt nach 1 s ohne Drift (Gnadenzeit für Übergänge) oder sofort bei einem Fehler auf 1,0 | `comboMin/Max`, `comboProSekunde`, `comboGnadenzeit` |

## Verfolger

Pro Tick, erst nach der **3-Sekunden-Aufschließphase** und ab 30 km/h:

```
roh += basis · f_abstand · f_gleichwinkel · f_linie · f_drift · combo
```

| Faktor | Definition |
|---|---|
| f_abstand | Mittelpunktsabstand zum Führer: 1,0 bei 5–10 m (Sweet-Spot 6–10 m), linear auf 0 bei 30 m; unter 5 m wieder fallend auf 0,5 bei 3 m, darunter weiter Richtung 0 (Drängeln bringt keine Höchstpunkte) |
| f_gleichwinkel | 1 − \|Winkeldifferenz zum Führer\| / 30°, begrenzt auf 0…1 |
| f_drift | 1,0 wenn der Verfolger selbst driftet (≥ 10°), sonst 0,2 |
| f_linie, combo | wie beim Führer |

## Abzüge und Boni (normierte Punkte, Skala 0–100)

| Ereignis | Wirkung |
|---|---|
| Wandkontakt | −3, Combo-Reset, 1 s Wertungssperre; erneut erst nach 0,3 s ohne Kontakt |
| Autokontakt | −1 (höchstens alle 0,6 s) |
| Dreher (Winkel > 100° oder Stillstand in einer Zone) | Combo-Reset |
| Zurücksetzen | −10, Combo-Reset |
| Flüssiger Übergang | +1,5, wenn zwischen zwei gegenläufigen Drifts weniger als 1,2 s liegen, das Tempo nicht unter 50 % des Zonentempos fällt, der vorige Drift mindestens 1 s mit mindestens 25° gehalten wurde und der letzte Bonus mindestens 2 s her ist (kein Zickzack-Farmen) |

## Normierung und Fairness

```
Punkte        = klemme(100 · roh / Referenz + Boni − Abzüge, 0, 100)
Verfolger-End = VerfolgerNorm · (0,5 + 0,5 · Führerpunkte / 100)
Lauf-Summe    = Führerpunkte + Verfolger-Endpunkte  (max. 200)
```

**Referenz je Strecke** (`referenzPunkte` in der Streckendatei, geschrieben von
`scripts/stufenKalibrierung.js`, 24 Läufe mit den Autos der Legende-Gegner):
- Führer: per Bisektion so gewählt, dass das Mittel der normierten, auf 0–100 begrenzten Punkte der
  Legende-Bots 91 beträgt (Mitte des Zielbereichs 85–97).
- Verfolger: mittlere Rohpunkte „Legende hinter Legende“ · 100 / 91.
Fehlt die Referenz, schätzt `schaetzeReferenz()` eine Idealfahrt (nur Rückfall).

| Strecke | Referenzzeit | Referenz Führer | Referenz Verfolger | Zeitlimit (150 %) |
|---|---|---|---|---|
| Industriehof | 53,1 s | 98,8 | 41,1 | 79,7 s |
| Küstenpass | 97,0 s | 145,2 | 77,5 | 145,5 s |
| Neon-Hafen | 67,7 s | 106,9 | 66,8 | 101,6 s |

## Battle-Ablauf (`shared/battle.js`)

- Durchgang = eine Runde; Lauf = zwei Durchgänge mit Rollentausch.
- Format „Schnell“ = 1 Lauf (halbe Belohnung), „Best of 3“ = wer zuerst 2 Läufe gewinnt.
- Startrolle des ersten Laufs: seedbar ausgelost; danach wechselt sie gegenüber dem Vorlauf.
- Gleichstand (Differenz der Lauf-Summen < 3): Lauf wird mit neu ausgeloster Startrolle wiederholt
  und zählt nicht zur Höchstzahl. Nach zwei Wiederholungen entscheidet die höhere Führer-Punktzahl
  des letzten Laufs, sonst ein seedbarer Münzwurf.
- Ein Durchgang beginnt, wenn der **Führer die Startlinie überfährt** (fliegender Start, Führer 15 m
  und Verfolger 25 m vor der Linie, also 10 m Versatz). Er endet, wenn der Führer die Runde beendet
  oder das Zeitlimit (150 % der Referenzzeit) abläuft. Danach rollt das Spielerauto noch 2,2 s frei
  aus, dann erscheint der Zwischenstand.
- Perfekter Durchgang: Führer-Punkte über 90 und kein Wandkontakt (Bonus siehe `docs/OEKONOMIE.md`).

## Zeitangriff und Training

- Zeitangriff: 3 Runden mit Einzel-Wertung (Führer-Formel ohne Gegner), jede Runde ab der Startlinie
  neu gewertet. Eine Runde über dem Zeitlimit wird abgebrochen; ihre bis dahin erreichten Punkte
  zählen. Medaille nach dem Durchschnitt der 3 Runden: Bronze ab 40, Silber ab 60, Gold ab 80,
  Champion ab 95.
- Freies Fahren: Punkte je Runde sichtbar; persönlicher Bestwert je Strecke; kleiner Bonus siehe
  `shared/oekonomie.js` (`trainingRundeAbschliessen`).

## Bots und Ziel-Punktebereiche

Die Stufen (`shared/bots/botStufen.js`) unterscheiden sich in Soll-Winkel, Linienabweichung,
Reaktionszeit, Fehlerquote, Verfolger-Genauigkeit und vor allem im **Anteil ausgelassener Zonen**
(Zone nur mit Grip durchfahren). Dieser Anteil ist der wirksamste Hebel, weil langsameres Driften
laut Formel kaum Punkte kostet (weniger Tempo = mehr Ticks in der Zone). Er ist **je Strecke
kalibriert** (`botAuslassen` in der Streckendatei, `scripts/stufenKalibrierung.js`, 24 Läufe je
Messpunkt), weil die Strecken unterschiedlich viele und unterschiedlich schwere Zonen haben.
Kalibriert und getestet wird jede Stufe mit den **Autos ihrer Pool-Gegner** (so wie sie im Spiel
antreten), weil der Bot-Regler je Auto sehr unterschiedlich gut fährt.

Ausgelassen wird nach einem **Plan je Runde**: Zonen in zufälliger Reihenfolge, bis ihr Gewicht
(Fahrzeit bei Referenztempo) den Anteil q erreicht. So fehlt einem Bot je Runde fast immer derselbe
Anteil, egal ob eine große oder kleine Zone getroffen wird.

| Stufe | Industriehof | Küstenpass | Neon-Hafen |
|---|---|---|---|
| Anfänger | 0,81 | 0,47 | 0,98 |
| Fahrer | 0,66 | 0,19 | 0,56 |
| Profi | 0,59 | 0,03 | 0,66 |
| Meister | 0,30 | 0,06 | 0,28 |
| Legende | 0,05 | 0,05 | 0,05 |

Die Quoten sind nicht monoton über die Stufen, weil die Stufen verschiedene Autos fahren
(z. B. Fahrer mit Hornet Wagon und Marlin 4D, Profi mit Vireo Turbo und Bastion GT).

Als Verfolger hält der Bot den Sollabstand von 8 m entlang der Strecke und hat einen
**Auffahrschutz**: Unter 5 m Luftlinie hinter dem Führer nimmt er Gas weg und bremst (auch im
Drift), damit ein langsamer oder stehender Spieler nicht angeschoben wird.

`tests/bots.test.js` prüft für alle 5 Stufen auf allen 3 Strecken je 20 Läufe (Autos der Pool-Gegner,
wechselnde Seeds): Runde beendet, Mittel im Zielbereich ±7, Rangfolge der Stufen, Anfänger schlagbar.

### Bekannte Abweichung

Auf dem **Küstenpass** liegt **Meister** knapp unter dem Zielbereich (Mittel ca. 63 statt 70–85) und
beendet nur 18 von 20 Testrunden im Zeitlimit: Im Bastion GT (Bruno Kessel) verunfallt der Bot in den
engen Haarnadeln häufig (bis 18 Wandkontakte und 6 Resets je Runde); Onyx RS und Vireo Turbo fahren
dort gut. Beide Prüfungen sind als „todo“ markiert. Im Spiel endet ein solcher Durchgang regulär über
das Zeitlimit; die Rangfolge der Stufen bleibt erhalten. Verbesserung: ein besserer Drift-Regler für
enge Kehren (siehe `docs/ENTSCHEIDUNGEN.md`, B5).

Außerdem **streuen die Bot-Punkte stark** von Durchgang zu Durchgang (Standardabweichung je nach
Stufe und Strecke etwa 15–30 Punkte), das Mittel liegt im Zielbereich. Ursache ist die Ausführung
des Drift-Reglers: Einige Autos rutschen auch in ausgelassenen Zonen quer (z. B. Vireo Turbo durch
das Turboloch), und gefahrene Zonen misslingen gelegentlich ganz. Die Planung je Runde (siehe oben)
entfernt nur den Anteil, der von der Zonenauswahl kommt. Folge im Spiel: Auch ein Anfänger hat
gelegentlich einen starken Durchgang; im Best-of-3 mittelt sich das. Verbesserung: ein robusterer
Drift-Regler (siehe `docs/ENTSCHEIDUNGEN.md`, B5).
