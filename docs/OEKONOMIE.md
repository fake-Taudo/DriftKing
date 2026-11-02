# Ökonomie: Driftmünzen, Preise, Balance

Code: `shared/oekonomie.js` (Buchen, Kaufen, Verkaufen, Belohnungen), `shared/teile.js` (Katalog und Preise),
`shared/tagesaufgaben.js`. Tabellen erzeugt `scripts/oekonomieTabelle.js` aus den echten Spieldaten, geprüft
von `tests/oekonomie.test.js`. Es gibt genau eine Währung, kein Echtgeld, keine Mikrotransaktionen, keine Werbung.

## Einnahmen

| Quelle | Betrag | Grenze |
|---|---|---|
| Startguthaben | 5.000 DM | einmalig |
| Bot-Battle (Best of 3) | Sieg 300 / 500 / 800 / 1.100 / 1.500, Niederlage 50 / 70 / 90 / 120 / 150 (Anfänger … Legende) | „Schnell“ zahlt die Hälfte |
| Erstsieg je Stufe und Strecke | Sieg-Betrag noch einmal | 15-mal im ganzen Spiel |
| Perfekter Durchgang (Führer über 90, keine Wand) | +100 DM (bei „Schnell“ +50) | je Durchgang |
| Zeitangriff-Medaille | Bronze 150, Silber 300, Gold 600, Champion 1.000 | je Strecke einmal voll, danach 25 % |
| Freies Fahren | 50–150 DM bei neuem Bestwert | nur mit mindestens 5 Punkten Vorsprung auf den letzten belohnten Wert |
| Tagesaufgaben | 3 je Tag, je 100–400 DM (Ø 223 DM) | Neustart um Mitternacht |
| Online-Duell (Phase 7) | Sieg 400, Niederlage 100 | 10 je Tag, 3 je Gegner |
| Geschenk-Code „Release“ | 7.500 DM | einmal je Spielstand |

## Katalog

| Inhalt | Anzahl | Summe (DM) | Preisspanne |
|---|---:|---:|---|
| Lack-Finishs | 5 | 6.350 | 400–3.000 |
| Muster | 12 | 6.200 | 250–900 |
| Felgen | 11 | 9.150 | 150–1.200 |
| Aufkleber-Pakete | 7 | 1.950 | 150–500 |
| Reifenqualm | 8 | 4.750 | 200–1.800 |
| Extras | 5 | 2.650 | 200–900 |
| **Für alle Autos zusammen** | | **31.050** | |

| Auto | Preis | Bodykit komplett | Tuning komplett | Zusammen |
|---|---:|---:|---:|---:|
| Kestrel S | 0 | 5.470 | 5.600 | 11.070 |
| Marlin 4D | 8.000 | 6.520 | 6.140 | 20.660 |
| Vireo Turbo | 15.000 | 7.630 | 6.770 | 29.400 |
| Hornet Wagon | 25.000 | 8.040 | 7.020 | 40.060 |
| Bastion GT | 40.000 | 9.120 | 7.790 | 56.910 |
| Onyx RS | 60.000 | 10.700 | 8.870 | 79.570 |
| **Summe** | **148.000** | **47.480** | **42.190** | **237.670** |

**Gesamtkosten aller Inhalte: 268.720 DM.**

Teile für ein bestimmtes Auto kosten je nach Auto mehr (Faktor 0,7 beim Kestrel S bis 1,4 beim Onyx RS). Kein
Anbauteil kostet unter 100 DM. Tuningstufen haben Mindestpreise (100, 140, 200, 300 DM), damit höhere Stufen auch
in günstigen Kategorien deutlich mehr kosten (mindestens das 1,3-fache der Stufe davor, per Test geprüft).

### Warum die Teile günstiger sind als zuerst angesetzt

Die Autopreise und Battle-Belohnungen gibt die Spezifikation fest vor. Allein die Autos (148.000 DM) brauchen
damit rund die Hälfte der Zielzeit. In der ersten Fassung kostete der Katalog ca. 380.000 DM, das wären mehr als
60 Stunden gewesen. Deshalb sind Bodykit und Tuning deutlich günstiger, und die teuersten Lacke und Extras wurden
gesenkt. Die Preisspanne der Spezifikation (ca. 100 bis 12.000) wird nach oben nicht ausgereizt.

## Ziel 1: Erstes neues Auto nach ca. 8–12 Bot-Siegen

Simulation mit `battleAbschliessen` (400 Durchläufe je Zeile): Der Spieler fährt Best of 3 auf der zuletzt
freigeschalteten Strecke gegen die zweithöchste freigeschaltete Stufe.

| Vorher für Teile ausgegeben | Siegquote | Ø Siege | Ø Battles | ca. Spielzeit |
|---:|---:|---:|---:|---:|
| 0 DM | 70 % | 7,0 | 10,1 | 70 min |
| 1.000 DM | 70 % | 10,0 | 14,4 | 101 min |
| 2.000 DM | 70 % | 13,1 | 18,9 | 133 min |
| 1.000 DM | 50 % | 9,2 | 18,3 | 128 min |
| 2.000 DM | 50 % | 12,0 | 24,2 | 169 min |
| 3.000 DM | 60 % | 15,6 | 26,3 | 184 min |

Bei „sparsamem Teilekauf“ (1.000–2.000 DM) sind es 9–13 Siege. Ziel erfüllt; wer gar nichts ausgibt, schafft es
schon nach 7 Siegen, wer viel ausgibt, braucht länger. Ein Test prüft die Spanne.

## Ziel 2: Alles zusammen in ca. 25–40 Stunden

Einkommen je Stunde. Ein Best of 3 dauert aus den echten Rundenzeiten (53–97 s je Durchgang, 2–3 Läufe)
einschließlich Countdown und Zwischenständen ca. 7 Minuten:

| Stufe | Sieg | Niederlage | Siegquote (Annahme) | Ø je Battle | Ø je Stunde |
|---|---:|---:|---:|---:|---:|
| Anfänger | 300 | 50 | 80 % | 260 | 2.229 |
| Fahrer | 500 | 70 | 70 % | 381 | 3.266 |
| Profi | 800 | 90 | 65 % | 562 | 4.813 |
| Meister | 1.100 | 120 | 60 % | 718 | 6.154 |
| Legende | 1.500 | 150 | 50 % | 835 | 7.157 |

Einmalig kommen hinzu: Erstsieg-Boni 12.600 DM, Medaillen 6.150 DM, Start 5.000 DM. Tagesaufgaben bringen ca.
670 DM je Tag (bei 1,5 Stunden je Spieltag also ca. 450 DM je Stunde).

| Spielertyp | Verlauf | Dauer bis alles gekauft ist |
|---|---|---|
| Durchschnitt | 5 h Anfänger/Fahrer, 10 h Profi, 10 h Meister, danach Meister/Legende | **ca. 40 Stunden** |
| Geübt | früh auf Meister/Legende, 70 % Siege, viel „Schnell“ (ca. 3 min, halbe Belohnung, ca. 11.000 DM/h) | **ca. 25 Stunden** |

Das liegt im Zielrahmen. Ein Test begrenzt die Gesamtkosten auf 160.000–270.000 DM. Wer nur die Lieblingsautos
ausstattet, ist deutlich früher am Ziel. Gegen Zähigkeit wirken die Erstsieg-Boni (viele frühe, große Sprünge),
Tagesaufgaben, Medaillen, die Fortschrittsanzeigen (Siege bis zur nächsten Strecke, Tuning-Vorher/Nachher) und die
kleinen Beträge für Lack- und Felgenteile, die sich schon nach einem Battle leisten lassen.

## Sicherheit gegen Vermehrung

Alle Regeln liegen in einer Stelle (`shared/oekonomie.js`) und sind getestet (`tests/oekonomie.test.js`):

- **Verkauf bringt immer weniger als der Kauf:** 50 % abgerundet. Geprüft für jede Kauf-ID bei jedem Auto.
- **Zufallstest:** 5.000 zufällige Käufe und Verkäufe von Teilen und Autos; das Vermögen (Guthaben plus
  Wiederverkaufswert) steigt in keinem einzigen Schritt, der Spielstand bleibt gültig.
- **Atomar:** Guthaben und Besitz ändern sich gemeinsam; bei mehreren Teilen alles oder nichts.
- **Kein Doppelkauf:** Was schon gehört, kostet nichts (Doppelklick). Kein negatives Guthaben, nur ganze Beträge.
- **Keine Doppelbuchung von Belohnungen:** eindeutige Buchungs-IDs (`battle:`, `za:`, `tr:`, `ta:`).
- **Geschenk-Codes nur einmal:** eigene Liste `eingeloesteCodes`, die anders als die Buchungen nie gekürzt wird.
- **Verkauf entfernt das Teil aus allen Looks**, und eine verkaufte Tuningstufe wird ausgebaut: Ein Rennen startet nie
  mit Ungekauftem. Das letzte Auto lässt sich nicht verkaufen.
- **Autopilot-Fahrten** (nur für Messungen) werden nie belohnt.

Weil es keine Konten gibt und der Spielstand lokal liegt, kann jemand seinen eigenen Stand verändern. Das ist laut
Spezifikation akzeptiert (Spiel unter Freunden). Ein Online-Duell zahlt trotzdem nie mehr als festgelegt.
