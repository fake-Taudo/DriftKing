# Netzwerk: Online-Duell

Alle Grenzwerte und die Prüfung eingehender Nachrichten stehen in `shared/netzwerkSchema.js`. Der Server liegt in `server/spielServer.js` (Verbindungen, Rate-Limits), `server/lobbys.js` (Codes, Lobbys, Wiederverbindung) und `server/match.js` (Ablauf und Wertung eines Duells).

## Grundprinzip

- **Transport:** WebSocket auf `/ws`, Textnachrichten mit JSON, Feld `t` ist der Nachrichtentyp. Binärnachrichten werden abgelehnt.
- **Jeder Client simuliert nur sein eigenes Auto** und meldet 25-mal pro Sekunde den Zustand. Das eigene Auto reagiert dadurch ohne Verzögerung.
- **Der Server relayt, prüft und wertet.** Er rechnet mit derselben `shared/wertung.js` wie das Bot-Battle, 20 Ticks pro Sekunde, aus dem jeweils letzten gemeldeten Zustand beider Spieler. Durchgangs-, Lauf- und Battle-Sieger sowie die Belohnung entscheidet nur er.
- **Das Gegnerauto** wird mit etwa 110 ms Puffer interpoliert und höchstens 250 ms extrapoliert (`shared/interpolator.js`). Sprünge werden über 180 ms weich abgebaut, nur ein Zurücksetzen (über 12 m) wird sofort übernommen.

## Zeit

- **Uhrenabgleich:** `ping`/`pong`. Der Client bildet aus den Messungen mit der kürzesten Laufzeit den Versatz zur Serveruhr und misst während des Duells alle 2 Sekunden nach.
- **Gemeinsamer Start:** `startCountdown.startZeit` ist Serverzeit, der Ablauf bis dahin dauert 4,6 Sekunden.
- **Darstellungszeit des Gegners:** `Serverzeit − gemessenes Alter eintreffender Zustände − 110 ms`. Das Alter wird fortlaufend geglättet (etwa 0,8 s Zeitkonstante). So bleibt die Darstellung auch bei hoher Latenz im Puffer, und ein Fehler im Uhrenabgleich hebt sich auf.

## Wertung und Meldelücken

Pro Tick verwendet der Server den zeitlich letzten Zustand je Spieler. Fehlt von einem Spieler seit über 200 ms eine Meldung, **entfällt der Tick für beide**, damit Verbindungsprobleme niemanden benachteiligen.

**Auto-Kontakt:** Der Server erkennt ihn in `Wertung.tick` aus beiden gemeldeten Zuständen und zieht beiden Seiten den kleinen Abzug ab (`ereignis` mit `art: 'kontakt'`). Der Client erkennt den Kontakt lokal am interpolierten Gegner und schiebt nur sein eigenes Auto sanft weg. Punkte kann er damit nicht beeinflussen.

## Plausibilitätsprüfung

Verworfen wird ein Zustand, wenn:

| Prüfung | Grenze |
|---|---|
| Höchsttempo | 1,7 × Höchstgeschwindigkeit des Autos (je Auto, unabhängig vom Tuning großzügig) |
| Beschleunigung | über 45 m/s² + 3 m/s Spielraum, außer nach dem Zurücksetzen |
| Teleport | Weg größer als `max(v, vAlt) · dt · 1,6 + 4 m`, außer nach dem Zurücksetzen |
| Streckenbegrenzung | über 40 m neben der Fahrbahn |
| Reihenfolge | Sequenznummer nicht neuer als die letzte |

Ein verworfener Zustand wird nicht gewertet und nicht weitergeleitet. Über 40 Verstöße je Durchgang verliert der Spieler das Duell (`grund: 'regelverstoss'`).

## Nachrichten vom Client an den Server

Jede Nachricht wird streng geprüft (nur bekannte Felder, Typen, Wertebereiche). Ungültiges führt zu `fehler`, nie zum Absturz.

| `t` | Felder | Wertebereich | Bedeutung |
|---|---|---|---|
| `hallo` | `v`, `clientId`, `name`, `autoId`, `look`, `tuning`, `strecken`, `setup?` | `v` = Protokollversion; `clientId` `[a-z0-9]{12,40}`; `name` 2–16 Zeichen, Wortfilter; `look` Look-Code ≤ 8 KB; `tuning` Stufen 1–5; `strecken` bekannte IDs | Anmeldung, Pflicht vor allem anderen |
| `duellErstellen` | – | – | Eröffnet eine Lobby |
| `beitreten` | `code` | 6 Zeichen aus dem Alphabet, Kleinschreibung erlaubt | Tritt per Code bei (5 Versuche pro Minute je Verbindung und IP) |
| `einstellungen` | `streckeId?`, `format?`, `einheit?` | Strecke beider Spieler; `schnell`/`bo3`; bool | Nur der Gastgeber |
| `bereit` | `an` | bool | Beide bereit: Duell startet |
| `zustand` | `d` | siehe unten | 25-mal pro Sekunde |
| `emote` | `id` | `gg`, `respekt`, `lol`, `wow`, `nochmal`, `danke` | Schnellnachricht, kein freier Chat |
| `ping` | `c` | Zahl | Uhrenabgleich, Herzschlag |
| `echo` | `d?` | Text | Verbindungstest (`?test=eingabe`) |
| `wiederverbinden` | `token` | ≤ 64 Zeichen | Rückkehr nach einem Abbruch |
| `aufgeben` | – | – | Duell verloren geben |
| `verlassen` | – | – | Lobby verlassen |

### Fahrzustand `d`

Kompaktes Zahlenfeld (JSON), je Nachricht rund 70 Bytes:

| Index | Name | Einheit | Bereich |
|---|---|---|---|
| 0 | `seq` | – | Ganzzahl, steigend |
| 1, 2 | `x`, `y` | m | endlich |
| 3 | `theta` | rad | endlich |
| 4, 5 | `vx`, `vy` | m/s im Fahrzeugsystem | endlich |
| 6 | `r` | rad/s | endlich |
| 7 | `flags` | Bits | 0–255: `GAS` 1, `BREMSE` 2, `HANDBREMSE` 4, `LENKEN` 8; Bits 5–7: Zähler der Zurücksetzungen |

Das Zurücksetzen steckt als Zähler in jedem Zustand. Ändert er sich, darf das Auto springen, und es fällt einmal der Abzug an. So geht die Information auch dann nicht verloren, wenn genau dieses Paket fehlt.

Beispiel: `{"t":"zustand","d":[812,-41.207,18.553,1.204,21.31,-6.02,0.41,9]}`

## Nachrichten vom Server an den Client

| `t` | Felder | Bedeutung |
|---|---|---|
| `willkommen` | `id`, `v`, `s` | Anmeldung gelungen |
| `fehler` | `code` | Siehe Fehlercodes |
| `pong` | `c`, `s` | Antwort auf `ping` mit Serverzeit |
| `duellErstellt` | `code`, `token`, `gueltigBis` | Code und Wiederverbindungs-Token des Gastgebers |
| `beigetreten` | `code`, `token`, `seite` | Beitritt gelungen |
| `lobbyStatus` | `code`, `A`, `B`, `streckeId`, `strecken`, `format`, `einheit`, `einheitsPI`, `seite` | Stand der Lobby; `A`/`B` = `{name, autoId, look, pi, bereit, weg}` oder `null` |
| `lobbyEnde` | `grund` | `gegner_weg`, `code_abgelaufen`, `inaktiv` |
| `duellStart` | `seite`, `streckeId`, `format`, `einheitsPI`, `gegner` | `gegner` = `{name, autoId, look}` |
| `startCountdown` | `dgNr`, `startZeit`, `laufNr`, `laufIndex`, `durchgangNr`, `wiederholung`, `rolle`, `siegeA`, `siegeB` | Durchgang angekündigt. `dgNr` zählt alle Durchgänge des Duells |
| `gegner` | `d`, `s` | Weitergeleiteter Zustand, `s` = Empfangszeit auf dem Server |
| `wertungStart` | `zeit`, `limit` | Der Führer hat die Startlinie überfahren |
| `ereignis` | `e` | Wertungsereignis des eigenen Autos: `art` (`wand`, `kontakt`, `zuruecksetzen`, `spin`, `zoneEnde`, `fluessig`), dazu `abzug?`, `bonus?`, `punkte?` |
| `punkte` | `du`, `gegner`, `combo`, `anteil`, `rest` | Zwischenstand, 4-mal pro Sekunde |
| `durchgangEnde` | `dgNr`, `grund`, `rolleDu`, `fuehrerPunkte`, `verfolgerPunkte`, `wertung`, `laufEnde`, `lauf`, `battleEnde`, `siegeA`, `siegeB`, `weiterIn` | Durchgang vorbei; `grund`: `ziel`, `zeit` |
| `ergebnis` | `duellId`, `seite`, `sieger`, `sieg`, `regulaer`, `grund`, `fahrzeit`, `zusammenfassung`, `belohnung`, `gegnerId` | Duell vorbei; `grund`: `null`, `aufgabe`, `verlassen`, `verbindung`, `afk`, `regelverstoss` |
| `emote` | `von`, `id` | Schnellnachricht |
| `gegnerVerbindung` | `weg`, `bis?` | Gegner unterbrochen oder zurück |
| `gegnerWeg` | – | Gegner hat die Lobby verlassen |
| `wiederverbunden` | `token`, `seite`, `imDuell`, `streckeId` | Rückkehr gelungen, mit neuem Token |
| `echo` | `d` | Antwort auf `echo` |

Beispiel:

```json
{"t":"startCountdown","dgNr":1,"startZeit":1793620000000,"laufNr":1,"laufIndex":0,"durchgangNr":1,"wiederholung":false,"rolle":"fuehrer","siegeA":0,"siegeB":0}
```

### Fehlercodes

`format`, `unbekannt`, `felder`, `kein_hallo`, `name_*` (Namensprüfung), `look_ungueltig`, `code_ungueltig`, `code_abgelaufen`, `code_benutzt`, `eigenes_duell`, `zu_viele_versuche`, `zu_viele_nachrichten`, `kein_lobby`, `nur_gastgeber`, `strecke_gesperrt`, `token_ungueltig`, `intern`.

## Ablauf

1. `hallo` → `willkommen`
2. A: `duellErstellen` → `duellErstellt` (Code 10 Minuten gültig, nur einmal nutzbar)
3. B: `beitreten` → `beigetreten`, beide bekommen `lobbyStatus`
4. A wählt Strecke, Format, Einheits-Leistung. Beide senden `bereit`.
5. `duellStart`, dann für jeden Durchgang `startCountdown` → `zustand`/`gegner` → `wertungStart` → `punkte`, `ereignis` → `durchgangEnde`
6. `ergebnis`, dann zurück in die Lobby (Revanche) oder `verlassen`

## Wiederverbindung

- Bricht die Verbindung ab, hat der Spieler **15 Sekunden**. Der Client versucht es selbsttätig mit seinem einmaligen Token und bekommt danach ein neues.
- Der Server sendet nach der Rückkehr nach, was verloren gegangen sein kann: den laufenden Durchgang (`startCountdown`, gegebenenfalls `wertungStart`), das letzte `durchgangEnde` oder das fertige `ergebnis`. Der Client sortiert Doppeltes über `dgNr` aus, die Buchung über `duellId`.
- Während der Unterbrechung fehlen Meldungen, also entfallen die Wertungs-Ticks für beide.
- Kommt der Spieler nicht zurück, gewinnt der andere mit klarer Meldung und halber Belohnung (`grund: 'verbindung'`).

## Missbrauchsschutz

| Schutz | Grenze |
|---|---|
| Nachrichtengröße | 16 KB, größere trennen die Verbindung |
| Nachrichtenrate | 60 pro Sekunde je Verbindung; über 200 verworfene in 10 Sekunden trennen |
| Beitrittsversuche | 5 pro Minute je Verbindung und je IP |
| Codes | 6 Zeichen aus `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 10 Minuten, einmalig |
| Inaktive Lobby | nach 5 Minuten aufgelöst |
| AFK | keine Eingabe über 20 Sekunden im Durchgang: Duell verloren |
| Namen | Zeichen- und Längenprüfung, Wortfilter |
| Look | Schema, Größenlimit; nur Anzeige, Besitz wird nicht vorausgesetzt |
| Rollen | Gastgeber und Gast liegen serverseitig fest |
| Fehler in einer Nachricht | werden abgefangen; der Fuzz-Test in `tests/netzwerk.test.js` schickt kaputte, zu große und unerwartete Pakete |

## Belohnung

| Fall | Sieg | Niederlage |
|---|---|---|
| Reguläres Ende mit mindestens 2 Durchgängen und 90 s Fahrzeit | 400 DM | 100 DM |
| Zu kurzes reguläres Ende | 0 | 0 |
| Abbruch (Aufgabe, Verbindung, AFK, Regelverstoß) nach mindestens 30 s Fahrzeit | 200 DM | 0 |
| Abbruch davor | 0 | 0 |

Grenzen: **10 belohnte Duelle pro Tag, 3 pro Gegner pro Tag.** Sie gelten zweimal: Der Server zählt je `clientId` im Speicher, und `onlineErgebnisBuchen` prüft sie beim Buchen im lokalen Spielstand noch einmal. Der Spielstand liegt beim Spieler, ein wirklich entschlossener Betrüger kann ihn also ändern. Die Grenzen schützen deshalb vor Abkürzungen, nicht vor Manipulation am eigenen Gerät.

## Grenzen des Modells

Der Client meldet seinen Zustand selbst. Der Server erkennt unmögliche Fahrdaten, aber keinen Bot, der sich innerhalb der Physik bewegt. Für ein Spiel unter Freunden mit Einladungscode ist das angemessen (Entscheidung N1).

## Prüfung

- `tests/match.test.js`: ganze Duelle mit echten Bots und simulierter Zeit, auch mit 200 ms Latenz und 5 % Paketverlust, Gleichstand, Plausibilität, AFK, Meldelücken, Belohnung, Interpolator.
- `tests/netzwerk.test.js`: echter Server mit WebSockets, Codes, Lobby, Wiederverbindung, Fuzz, Rate-Limit, Tagesgrenzen.
- `scripts/onlineAblauf.js`: zwei echte Browser-Fenster über ein Relais mit Latenz und Paketverlust, inklusive Look-Sync, Revanche, Wiederverbindung, Aufgabe und endgültigem Verbindungsverlust.

```bash
node scripts/onlineAblauf.js test-results/online 200 0.05
```
