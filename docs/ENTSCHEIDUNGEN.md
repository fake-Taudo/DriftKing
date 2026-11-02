# Entscheidungen

Alle Stellen, an denen die Spezifikation (`SPEC.md`) offen war oder bewusst anders gelöst wurde – jeweils mit kurzer Begründung.

## Technik & Architektur

| # | Entscheidung | Begründung |
|---|---|---|
| T1 | **Node 26 / npm 11** lokal, auf Render `NODE_VERSION=22` (LTS). | Lokal war Node 26 vorhanden; Code nutzt nur Funktionen, die ab Node 20 verfügbar sind. Render bekommt eine LTS-Version. |
| T2 | **Alle Pakete als `dependencies`** (auch Vite, Three.js, Schriften). | Render führt `npm install` aus; je nach Umgebung werden `devDependencies` ausgelassen. So klappt `npm run build` immer. |
| T3 | **Gepinnte Versionen ohne `^`/`~`**: three 0.187.0, vite 8.3.5, express 5.3.0, ws 8.22.1, @fontsource/* 5.3.0. | Vorgabe der Spezifikation (reproduzierbarer Build). |
| T4 | **Relative Importe statt Pfad-Alias** für `/shared`. | Derselbe Code läuft im Browser (Vite), auf dem Server und in den Node-Tests ohne zusätzliche Auflösung. |
| T5 | **Eigenes Dev-Skript** (`scripts/dev.js`) statt `concurrently`. | Spart eine Abhängigkeit. Vite läuft auf `PORT` (Standard 5173), der Spielserver auf `SERVER_PORT` (Standard 3000); Vite leitet `/ws` und `/healthz` weiter. |
| T6 | **Service Worker wird beim Build erzeugt** (kleines Vite-Plugin in `vite.config.js`) mit Build-Hash als Cache-Version und vollständiger Dateiliste. | Kein Zusatzpaket (z. B. Workbox) nötig; alte Caches werden beim Aktivieren gelöscht. |
| T7 | **Seitenaufrufe „Cache zuerst“** im Service Worker. | Schneller Start, auch wenn der kostenlose Render-Server gerade schläft oder offline ist. Updates kommen über den neuen Service Worker mit Hinweis „Neue Version verfügbar – neu laden“. |
| T8 | **Im Entwicklungsmodus wird kein Service Worker benutzt** und vorhandene Registrierungen werden abgemeldet. | Sonst liefert ein alter Cache veraltete Dateien aus. |
| T9 | **CSP erlaubt `'unsafe-inline'` nur für Styles**, nicht für Skripte. | Spezifikation verlangt „ohne Inline-Skripte“. Die UI setzt Stile per JavaScript (Positionen der Touch-Tasten, Animationen); das ist mit `style-src 'self'` allein in Safari nicht zuverlässig. |
| T10 | **Text-Codes: `deflate-raw` per `CompressionStream`**, sonst unkomprimierter Rückfall (Präfix `R`). | iOS 16.0–16.3 kennt `CompressionStream` noch nicht. Codes mit Präfix `D` können dort nicht gelesen werden – es erscheint eine klare Meldung. Dekompression ist größenbegrenzt (Schutz vor „Zip-Bomben“). |
| T11 | **Spielstand-Schlüssel `driftkoenig.v<Version>.spielstand`**, Backup in `driftkoenig.backup` (+ Datum). | Erfüllt „Präfix und Versionsnummer“. Beim Laden wird zuerst die aktuelle, dann jede ältere Version gesucht und migriert. |
| T12 | **Prüfsumme FNV-1a (32 Bit)** über das Spielstand-JSON. | Erkennt Beschädigung und naive Manipulation. Kryptografischer Schutz ist ohne Server-Konto nicht möglich (siehe Ökonomie-Entscheidung Ö1). |
| T13 | **Version 0 als Migrationsquelle**: frühes Entwicklungsformat („muenzen“ statt „waehrung“). | Damit ist die Migrationskette von Anfang an echt getestet. |
| T14 | **Beim Import bleibt die Client-ID des Geräts erhalten.** | Sonst ließe sich das Online-Tageslimit durch Import fremder Spielstände umgehen. |
| T15 | **Debug-Overlay**: `?debug=1` funktioniert immer, Taste F3 nur im Entwicklungsmodus; **Cheats nur im Entwicklungs-Build**. | So steht es in Abschnitt 1; die Freischalt-Cheats aus Abschnitt 6 sind damit nur lokal (`npm run dev`) nutzbar. |
| T16 | **Touch-Layouts getrennt für Quer- und Hochformat.** | Im Hochformat ist zu wenig Breite für das Querformat-Layout; die Tasten würden sich überlappen. |

## Fahrphysik

| # | Entscheidung | Begründung |
|---|---|---|
| P1 | **Einspurmodell** (eine Vorder-, eine Hinterachse) mit Längs- und Querlastverlagerung statt Vierradmodell. | Reicht für ein Arcade-Driftgefühl, ist schnell (≈ 3 µs pro Schritt) und stabil. Querlastverlagerung wirkt als Grip-Verlust der Achse; die Verteilung (Wanksteifigkeit vorne/hinten) steuert Unter-/Übersteuern. |
| P2 | **Hinterrad-Drehzahl ω als eigener Zustand, implizit gelöst** (Newton mit Bisektions-Absicherung). | Mit einem reinen Kraftkreis ohne Raddrehzahl verhungert ein Drift, weil durchdrehende Räder keinen Vortrieb liefern. Mit ω zeigt die Reibkraft in Richtung der Rutschgeschwindigkeit – der Wagen schiebt im Drift nach vorne, genau wie in echt. Die implizite Lösung ist auch bei großer Motorträgheit stabil. Handbremse = großes Bremsmoment → blockierende Räder ergeben sich von selbst. |
| P3 | **Vorderachse ohne eigene Raddrehzahl** (Kraftkreis aus Seitenkraft + Bremse/Allrad-Anteil). | Vorderräder blockieren oder drehen im Spiel praktisch nie durch; spart Rechenzeit. |
| P4 | **Gleitreibung hinten 76 % statt 90 % der Spitzenkraft** (Arcade-Hilfe). | Das Heck bricht klar aus und der Drift lässt sich mit dem Gas halten („leicht einzuleiten, schwer zu perfektionieren“). |
| P5 | **Offenes vs. gesperrtes Differenzial** wird über einen Faktor auf den wirksamen Längsschlupf nachgebildet. | Ein starrer Hinterachs-Zustand kennt kein Innenrad. Mit offener Sperre „verpufft“ ein Teil des Schlupfs (Innenrad dreht durch), das Außenrad behält Seitenführung → schwerer zu driften. |
| P6 | **Automatik schaltet nach Fahrgeschwindigkeit**, nicht nach Raddrehzahl. | Im Drift drehen die Räder am Begrenzer; nach Raddrehzahl würde die Automatik ständig hochschalten. |
| P7 | **Gierdämpfung** (klein, je Auto einstellbar) und Zusatzdämpfung über 70° Driftwinkel. | Verhindert endloses Weiterdrehen und macht Dreher abfangbar, ohne das Driften zu verhindern. |
| P8 | **0–100-Messung mit optimalem Start** (Gas wird nahe am Haftmaximum dosiert). | Entspricht einer Messfahrt; mit stumpfem Vollgas würden starke Heckantriebler nur Rauch erzeugen. |
| P9 | **Luftwiderstand aus der Auslegungs-Höchstgeschwindigkeit** des Serienautos berechnet. | Höchstgeschwindigkeiten stimmen ohne Handarbeit; mehr Leistung durch Tuning erhöht sie automatisch. |
| P10 | **Leistungsindex = Basis-PI × (1 + Tuningzuschlag)**; Zuschlag maximal +45 %. | Eine rein physikalische Formel (Leistungsgewicht) würde getunte Einsteigerautos über die teuren Autos heben. Die Formel bewertet Leistung, Gewicht, Grip und Stabilität des Serienautos und addiert die Tuningstufen prozentual – genau wie in der Spezifikation gefordert. |
| P11 | **Weiche Auto-Auto-Kollision** über drei Kreise je Auto: nur Positions- und Geschwindigkeitsangleich, keine Drehung. | Spezifikation: kein harter Rückstoß, kein Festkleben, keine Rotation durch Berührung. |

## Autos, Strecken, Darstellung

| # | Entscheidung | Begründung |
|---|---|---|
| D1 | **Onyx RS: Allrad mit nur 12 % Frontanteil** (statt der zunächst angesetzten 30 %), Wankanteil vorne 0,47. | Mit 30 % Frontanteil ließ sich der Onyx in Simulationen überhaupt nicht im Drift halten. Mit 12 % bleibt er „Allrad mit Heckbetonung“ und schwerer zu driften, ist aber fahrbar (stationär bis ca. 55°). |
| D2 | **Strecken als Segmentlisten** (Gerade/Bogen/Schließen) statt handgesetzter Kontrollpunkte; daraus werden Kontrollpunkte und ein zentripetaler Catmull-Rom-Spline erzeugt. | Längen, Radien und Zonen lassen sich gezielt einstellen; neue Strecken sind leicht zu ergänzen. Drift-Zonen und Wandarten hängen am Segment und bleiben bei Änderungen richtig. |
| D3 | **Ideallinie = Minimal-Krümmungs-Linie** (mehrstufige Relaxation innerhalb der Fahrbahn), zu 65–70 % mit der Mitte gemischt, plus optionale Handkorrekturen. | Ergibt automatisch „außen–innen–außen“, ohne Handarbeit. Die Mischung hält die Linie driftfreundlich (nicht ganz am Rand). |
| D4 | **Fliegender Start:** Führer 15 m vor der Startlinie, Verfolger 10 m dahinter; eine Runde zählt ab dem Überfahren der Linie. | Spezifikation: versetzte Aufstellung + fliegender Start; so ist ein Durchgang genau eine volle Runde. |
| D5 | **Abkürzungsschutz:** Sprünge der Streckenposition um mehr als ca. 8 m pro Frame zählen nicht als Fortschritt; Checkpoints müssen in Reihenfolge passiert werden. | Verhindert Abkürzen durchs Infield (z. B. Industriehof), ohne echte Fahrt zu stören. |
| D6 | **Nasser Asphalt** (Neon-Hafen): Env-Map, geringe Rauheit und additive, langgezogene Lichtstreifen auf der Fahrbahn. | Vorgabe: keine Echtzeit-Spiegelung. |
| D7 | **Performance-Messung mit `playwright-core` und dem installierten Edge** statt eines heruntergeladenen Test-Browsers. | Kein großer Browser-Download, echte GPU. Handy-Profil emuliert CPU und Bildschirm, nicht die Handy-GPU (siehe docs/PERFORMANCE.md). |
| D8 | **Autopilot-Startparameter** `?perf=1&strecke=…` (Freies Fahren, ein Legende-Bot fährt das Spielerauto). | Reproduzierbare Messungen ohne Eingaben. Hat keinen Einfluss aufs normale Spiel. |
| D9 | **Messgröße „max. stationärer Driftwinkel“** mit einem PI-Halteregler, nicht mit konstanten Eingaben. | Ein Drift ist (auch real) kein stabiles Gleichgewicht bei konstanter Eingabe; gemessen wird, was ein geübter Fahrer halten kann. |
| D10 | **Küstenpass verbreitert:** Fahrbahn 13 m (Kehren 14 m), Kehrenradius 20 m statt 17–18 m. | Mit den engeren Kehren beendeten selbst die Bots in den schweren Autos die Runde nicht zuverlässig; für Menschen waren die Kehren mit Drift kaum fahrbar. Der Küstenpass bleibt die technischste Strecke (Schwierigkeit 2). |

## Wortfilter

| # | Entscheidung | Begründung |
|---|---|---|
| W1 | Normalisierung (Kleinschreibung, Umlaute, Leetspeak, Sonderzeichen entfernen) plus Liste von Wortstämmen; einige kurze Kürzel nur als ganzes Wort. | Fängt die üblichen Verschleierungen ab, ohne bei normalen Namen zu viele Fehlalarme zu erzeugen. Lieber einmal zu viel ablehnen. |
| W2 | Beim Zusammenziehen wiederholter Buchstaben wird ein Stamm nur verglichen, wenn danach noch mindestens 4 Zeichen übrig sind (Stämme ohne Doppelbuchstaben: 3). | Ein verkürzter Stamm traf harmlose Wörter wie „König“ und sperrte damit den Spielnamen. Tests prüfen jetzt beide Richtungen. |

## Wertung und Bots

| # | Entscheidung | Begründung |
|---|---|---|
| B1 | **Ein Durchgang beginnt, wenn der Führer die Startlinie überfährt**, und endet, wenn der Führer die Runde beendet oder das Zeitlimit (150 % der Referenzzeit) abläuft. Die Verfolger-Wertung endet mit dem Führer. Überfährt der Führer die Linie nach 12 s nicht, beginnt die Wertung trotzdem. | Fliegender Start wie in der Spezifikation; nach der Ziellinie des Führers gibt es nichts mehr zu verfolgen. Der Notfall-Start verhindert, dass ein Durchgang ewig hängt. |
| B2 | **Punkte nur auf neuem Boden:** Ein Tick zählt nur, wenn der stetige Streckenfortschritt das bisherige Maximum übertrifft. | Sonst ließen sich mit Donuts oder Hin- und Herfahren in einer Zone beliebig viele Punkte sammeln. |
| B3 | **Flüssigkeits-Bonus nur nach einem gehaltenen Drift** (mind. 1 s und 25°) und höchstens alle 2 s. | Ohne diese Bedingungen brachte schnelles Zickzack-Lenken mehr Punkte als sauberes Driften. |
| B4 | **Hauptstellhebel der Bot-Stufen ist der Anteil ausgelassener Zonen**, je Strecke kalibriert; ausgelassen wird nach einem **Plan je Runde**, gewichtet nach der Fahrzeit der Zonen. | Laut Formel kostet langsameres Driften kaum Punkte (mehr Ticks gleichen das kleinere f_tempo aus), Winkel und Linie wirken schwach. Der Plan je Runde verhindert, dass die Punkte allein von der Auswahl großer oder kleiner Zonen abhängen. |
| B5 | **Kalibrierung und Bot-Tests mit den Autos der Pool-Gegner der jeweiligen Stufe**; Kenji Aoba (Legende) fährt deshalb Vireo Turbo statt Hornet Wagon. | Der Bot-Regler fährt je Auto sehr unterschiedlich gut (auf dem Küstenpass z. B. Hornet Wagon ≈ 7, Onyx RS ≈ 95 Punkte als Legende). Entscheidend ist, wie stark die Gegner im Spiel sind, also mit ihren Autos. Bekannte Restschwäche: Die Punkte der Bots streuen von Durchgang zu Durchgang stark (siehe docs/WERTUNG.md); ein robusterer Drift-Regler wäre die nächste Verbesserung. |
| B6 | **Referenz Führer** per Bisektion so, dass das Mittel der auf 0–100 begrenzten Legende-Punkte 91 ist; **Referenz Verfolger** = mittlere Rohpunkte (Legende hinter Legende) · 100 / 91. | Beim Führer ist genau dieses Mittel die geprüfte Größe (Zielbereich 85–97). Beim Verfolger gibt es keinen Zielbereich; eine Bisektion würde die Referenz wegen der breiten Verteilung so weit senken, dass Menschen als Verfolger zu leicht 100 erreichen. |
| B7 | **Auffahrschutz des Verfolger-Bots:** unter 5 m Luftlinie hinter dem Führer Gas weg und bremsen, auch im Drift. | Ein langsamer Spieler (z. B. nach einem Dreher) soll vom Bot nicht angeschoben werden. |
| B8 | **Bots fahren ihr Auto in Serie (ohne Leistungstuning) mit ihrem Look.** Optikteile wirken wie beim Spieler minimal auf die Physik. | Gleiche Regeln für alle; die Kalibrierung gilt für die Autos, wie sie im Spiel antreten. |
| B9 | **Zwischen zwei Durchgängen rollen beide Autos ohne Eingabe aus**; der Zwischenstand wartet auf „Weiter“; die Pause ist währenddessen gesperrt. | Der Spieler bestimmt das Tempo; die Szene bleibt lebendig statt einzufrieren. |
| B10 | **Abbruch eines Bot-Battles** (Pause → Beenden, mit Rückfrage) zählt nicht: keine Belohnung, keine Niederlage in der Statistik. | Einfach und nicht ausnutzbar (ein Abbruch bringt nie etwas). |
| B11 | **Gegner-Vorschlag:** höchste freigeschaltete Stufe ohne Erstsieg auf der gewählten Strecke, sonst die höchste; innerhalb der Stufe wechselt der Gegner mit der Zahl gespielter Battles. | „Nach Fortschritt vorgeschlagen“ (Spezifikation 7.3); der Erstsieg-Bonus lenkt zur nächsten Herausforderung. |
| B12 | **Autopilot** (nur per URL-Parameter für Messungen und Tests) fährt im Battle die Rolle des jeweiligen Durchgangs. Autopilot-Fahrten werden **nie belohnt** und nicht in die Statistik gebucht. | Reproduzierbare Ablauftests ohne Eingaben; kein Weg, mit dem Parameter Münzen zu farmen. |

## Garage

| # | Entscheidung | Begründung |
|---|---|---|
| G1 | **Anprobe statt Kaufzwang:** Der bearbeitete Look darf ungekaufte Teile enthalten. Gespeichert wird automatisch, sobald er nur noch Gekauftes enthält; sonst zeigt eine Leiste, was fehlt, mit „Kaufen“ und „Verwerfen“. Verwerfen nimmt nur das Ungekaufte zurück, freie Änderungen bleiben. Beim Verlassen, Auto- oder Slot-Wechsel wird nachgefragt. | Spezifikation: Teile vor dem Kauf anprobieren. So kann ein Rennen nie mit ungekauften Teilen starten, und man verliert keine kostenlosen Änderungen. |
| G2 | **Rückgängig gilt für den ganzen Look** (60 Schritte), nicht nur für Aufkleber. Aufeinanderfolgende Änderungen desselben Reglers zählen als ein Schritt. | Mehr als gefordert (30 Schritte im Aufkleber-Editor), einfacher zu verstehen und mit derselben Technik gelöst. |
| G3 | **Ein neues Anbauteil startet in Wagenfarbe** statt im dunklen Serienton. | In dunklen Showrooms war ein dunkler Heckflügel kaum zu sehen und wirkte, als fehle er. |
| G4 | **Muster und Aufkleber werden in Metern gezeichnet** (Zonenmaße je Auto), Skala 1 = 1 m. | Die Atlas-Zonen haben andere Seitenverhältnisse als die Flächen am Auto; sonst wären Kreise auf der Haube Ellipsen. |
| G5 | **Kauf-Logik schon in Phase 5** (`kaufen`, `lookBedarf`, `anprobeEntfernen`); der Shop in Phase 6 nutzt sie mit. | Die Garage braucht Anprobe und Kauf bereits. |
| G6 | **Tuningstufen sind einzeln kaufbar**, ohne die niedrigeren zuerst kaufen zu müssen. | Die Spezifikation verlangt keine Reihenfolge; so zwingt das Spiel niemanden zu Zwischenkäufen. Höhere Stufen kosten ohnehin deutlich mehr. |
| G7 | **Showroom-Stimmung wird nur im Browser gemerkt**, nicht im Spielstand. | Sie ist eine reine Ansichtseinstellung und soll den Spielstand-Export nicht verändern. |
| G8 | **`shared/oekonomie.js` importiert die Aufkleber-Bibliothek aus `client/assets/`.** Die Datei enthält nur Daten. | Die Spezifikation legt den Ort der Bibliothek fest, der Server braucht dieselben IDs für die Look-Prüfung. |

## Ökonomie

| # | Entscheidung | Begründung |
|---|---|---|
| E1 | **Zeitangriff:** Jede Medaille zahlt je Strecke einmal den vollen Betrag. Wer direkt eine höhere Medaille holt, bekommt die übersprungenen niedrigeren mit. Ist keine Medaille neu, zahlt die erreichte Medaille 25 %. | Die Gesamtsumme je Strecke (2.050) hängt nicht davon ab, ob man sich schrittweise steigert oder direkt Gold holt. |
| E2 | **Abgebrochene Zeitangriff-Runde** (Zeitlimit) zählt mit den bis dahin erreichten Punkten. | Durchschnitt über genau 3 Runden, wie in der Spezifikation; die Punkte wurden fair erfahren. |
| E3 | **Trainings-Bonus** = 50 + Rundenpunkte (max. 150), nur ab 20 Punkten und nur, wenn der zuletzt **belohnte** Bestwert um mindestens 5 Punkte übertroffen wird. | „Kleiner Bonus bei Bestwert“ ohne Farmen in 0,1-Punkte-Schritten: höchstens ca. 17 Boni je Strecke. |
| E4 | **Jede Belohnung hat eine eindeutige Buchungs-ID** (`battle:…`, `za:…`, `tr:…`, `ta:…`); doppelte IDs werden abgelehnt. Gespeichert werden die letzten 200 IDs. | Keine Doppelbuchung durch doppelte Auswertung, Doppelklick oder erneutes Anzeigen des Ergebnisses. |
| E5 | **Tagesaufgaben nutzen die lokale Uhrzeit; ein Verstellen der Geräteuhr wird nicht verhindert.** Die Auswahl hängt fest von Spieler-ID und Datum ab, Belohnungen werden beim Abschluss sofort gutgeschrieben. | Vorgabe der Spezifikation: Die Tagesaufgaben sind der einzige Ort, an dem Zeit eine Rolle spielt. Ohne Konten ist eine echte Prüfung nicht möglich und bei einem Spiel unter Freunden unnötig. |
| E6 | **Teile und Tuning deutlich günstiger als zuerst angesetzt** (Gesamtkosten 268.720 statt ca. 380.000 DM). | Autopreise und Belohnungen sind vorgegeben; nur so sind 25–40 Stunden erreichbar. Rechnung in docs/OEKONOMIE.md, per Test begrenzt. |
| E7 | **Verkauf entfernt das Teil aus allen betroffenen Looks** (zurück auf Serie), eine verkaufte Tuningstufe wird ausgebaut. Beim Verkauf eines Autos gehen dessen Looks und Setups verloren. | Ein gespeicherter Look besteht immer nur aus Gekauftem. Der Dialog sagt das vorher deutlich. |
| E8 | **Globale Teile gehören zum Spieler, nicht zum Auto**: Sie bleiben beim Autoverkauf erhalten und werden nicht mit erstattet. | So beschreibt es die Spezifikation („pro Auto, wo nötig“), und es gibt keinen Weg, sie mehrfach anzurechnen. |

## Tutorial

| # | Entscheidung | Begründung |
|---|---|---|
| U1 | **Tutorial auf dem Industriehof** statt auf der Testfläche, mit dem aktiven Auto. | Es zeigt gleich die echte Strecke. Die Bedingungen hängen nicht vom Ort ab, und wer in die Wand fährt, wird wie im Spiel zurückgesetzt. |
| U2 | **Großzügige Hilfen nur im Tutorial** (Gegenlenken mindestens 75 %, Drift-Halten mindestens 30 %). Bedienhinweise passen sich dem Eingabegerät an. | Der erste Drift soll gelingen. Ein Test zeigt mit echter Physik, dass einfache Eingaben genügen (kurz Handbremse, dann Gas halten und Lenkung loslassen). |
| U3 | **Jeder Schritt lässt sich nach 45 Sekunden überspringen, das ganze Tutorial jederzeit.** Überspringen zählt als gesehen, wiederholen geht in den Einstellungen. | Niemand soll festhängen. |
| U4 | **Keine Münzen für das Tutorial.** | Es ist wiederholbar und soll kein Einkommen sein; die Balance rechnet ohnehin mit dem Startguthaben. |

## Online-Duell

| # | Entscheidung | Begründung |
|---|---|---|
| N1 | **Kein Betrugsschutz gegen Bots innerhalb der Physik.** Der Server erkennt unmögliche Fahrdaten, aber keinen Autopiloten, der sich an die Physik hält. | Die Spezifikation legt fest, dass jeder Client sein Auto selbst simuliert. Gespielt wird unter Freunden per Einladungscode, ohne Rangliste. Ein Server, der alles nachrechnet, wäre auf dem Free-Plan nicht tragbar. |
| N2 | **JSON statt Binärformat**, Fahrzustand als Zahlenfeld mit drei Nachkommastellen. | Die Spezifikation erlaubt beides. Rund 70 Bytes je Zustand reichen, und das Format lässt sich leichter prüfen und mitlesen. |
| N3 | **Der Server erkennt den Auto-Kontakt selbst aus beiden Zuständen**, statt eine Meldung des Clients zu bestätigen. | Die Spezifikation verlangt lokale Erkennung mit Bestätigung durch den Server. Punkte gibt es so nur durch die Rechnung des Servers, und `Wertung.tick` kennt beide Autos ohnehin. Lokal reagiert nur die Physik des eigenen Autos. |
| N4 | **Halbe Belohnung nach Abbruch erst ab 30 s Fahrzeit**, sonst nichts. | Die Spezifikation nennt die halbe Belohnung ohne Mindestzeit. Ohne Grenze ließen sich mit einem zweiten Fenster Münzen abholen, indem man sofort abbricht. |
| N5 | **Darstellungszeit aus dem gemessenen Alter der Zustände** (`Serverzeit − Alter − 110 ms`), nicht aus Serverzeit minus Puffer. | Bei 200 ms Latenz lag die Anzeigezeit sonst 90 ms hinter dem neuesten Zustand, das Auto wurde dauernd extrapoliert. So bleibt der Puffer bei jeder Latenz wirksam, und ein Fehler im Uhrenabgleich hebt sich auf. |
| N6 | **Der Server sendet nach einer Wiederverbindung den aktuellen Stand erneut** (Durchgang, letztes Ende, Ergebnis). Der Client sortiert über `dgNr` und `duellId` aus. | Über TCP gehen Nachrichten beim Abriss verloren. Ohne Nachsenden hätte der Zurückgekehrte die falsche Rolle oder verlöre seine Belohnung. |
| N7 | **Tagesgrenzen im Arbeitsspeicher des Servers und zusätzlich im Spielstand.** | Der Server speichert laut Spezifikation nichts dauerhaft. Ein Neustart setzt seinen Zähler zurück, die Prüfung im Spielstand greift dann weiter. |
| N8 | **Der Client bucht die Belohnung selbst**, der Server meldet nur den Betrag. | Spielstände liegen beim Spieler, ohne Konten. Doppelte Meldungen fängt `duellId` ab, und der Betrag ist beim Buchen gedeckelt. |
| N9 | **Warnhinweis ab 180 ms Ping oder 25 % Bildern ohne aktuellen Zustand**, einmal je Duell. Im HUD zeigt ein farbiger Punkt die Güte. | Spieler sollen wissen, warum das Gegnerauto ruckelt, ohne im Duell dauernd gestört zu werden. |
| N10 | **Der Gastgeber wählt nur Strecken, die beide freigeschaltet haben**, der Industriehof zählt immer dazu. | Sonst könnte es Duelle ohne gemeinsame Strecke geben. Die Freischaltungen meldet der Client, das Duell selbst bleibt fair, weil beide dieselbe Strecke fahren. |

## Betrieb

| # | Entscheidung | Begründung |
|---|---|---|
| R1 | **Render: Region Frankfurt, Build mit `npm ci`**, Free-Plan, Health-Check `/healthz`. | Kurze Latenz für Spieler in Deutschland; `npm ci` installiert exakt die Versionen aus `package-lock.json` (reproduzierbar). Anleitung: docs/DEPLOY_RENDER.md. |
| R2 | **Eingabe- und Verbindungstest unter `?test=eingabe`** (Würfel, Eingabewerte, Server-Echo). | Schnelle Prüfung auf echten Geräten und nach einem Deploy, ohne das Spiel zu verändern. |
