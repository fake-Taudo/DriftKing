# Manueller Testplan

Diese Punkte lassen sich nur mit echten Geräten prüfen: Fahrgefühl, Klang, Touch, echte Mobilfunknetze und ein echter Mitspieler. Alles andere prüfen die automatischen Tests (`npm test` und die Skripte in `scripts/`).

**Vorbereitung:** Das Spiel auf Render veröffentlichen (`docs/DEPLOY_RENDER.md`) und die Adresse auf dem Gerät öffnen. Einen Fehler bitte mit Gerät, Browser und Schritt notieren. Das Debug-Overlay mit Messwerten erscheint, wenn man `?debug=1` an die Adresse anhängt.

## 1. Handy, hochkant und quer

- [ ] Das Spiel lädt, der Ladebalken läuft, das Menü erscheint in unter 10 Sekunden
- [ ] Das Willkommensfenster bietet das Tutorial an, es lässt sich bis zum Ende spielen
- [ ] Lenken, Gas und Handbremse gleichzeitig funktionieren, auch wenn der Finger zwischen den Pfeilen gleitet
- [ ] Der erste Drift gelingt ohne Vorwissen nach wenigen Versuchen
- [ ] Beim Drehen des Geräts bleibt alles sauber, nichts überlappt, das laufende Rennen geht weiter
- [ ] Touch-Modus „Lenkrad“ und „Neigung“ ausprobieren (Neigung fragt auf dem iPhone nach einer Erlaubnis)
- [ ] Layout-Editor in den Einstellungen: Tasten verschieben, speichern, im Rennen prüfen
- [ ] Sound setzt nach dem ersten Tippen ein, auch auf dem iPhone. Stummschalter und Regler wirken
- [ ] Nach Tab-Wechsel und Bildschirmsperre geht es weiter, inklusive Ton
- [ ] Ein längeres Rennen läuft flüssig, das Gerät wird nicht übermäßig heiß. Bitte die FPS notieren (Einstellungen → Grafik → FPS anzeigen)
- [ ] Zum Home-Bildschirm hinzufügen und von dort starten

## 2. iPad

- [ ] Alle Bildschirme in beiden Ausrichtungen: Menü, Garage, Shop, Battle-Auswahl, Einstellungen
- [ ] Aufkleber-Editor mit dem Finger: verschieben, drehen, skalieren, Ebenen sortieren

## 3. PC

- [ ] Tastatur: WASD oder Pfeile, Leertaste Handbremse, Umschalt Kupplung, E/Q Schalten, C Kamera, R Zurücksetzen, Esc Pause
- [ ] Menüs komplett mit Tastatur bedienbar (Tab, Pfeile, Enter, Esc), Fokus immer sichtbar
- [ ] Tasten neu belegen und im Rennen prüfen
- [ ] 60 FPS auf Hoch

## 4. Gamepad

- [ ] Ein Controller wird erkannt, Lenken und Pedale fühlen sich feinfühlig an
- [ ] Rumble bei Wandkontakt, falls das Gerät es kann
- [ ] Knöpfe neu belegen, Totzone einstellen
- [ ] Menüs mit dem Gamepad bedienen

## 5. Fahrgefühl und Klang

Diese Punkte sind Geschmackssache, Rückmeldungen lassen sich direkt in `shared/autos.js` und `shared/physikParameter.js` einstellen.

- [ ] Alle 6 Autos fahren sich spürbar unterschiedlich
- [ ] Drift halten und Übergänge fühlen sich kontrollierbar an, Dreher sind nachvollziehbar
- [ ] Der Motor klingt bei jedem Auto anders und folgt Gas und Drehzahl. Turbo-Pfeifen und Abblasen beim Vireo Turbo
- [ ] Reifenquietschen setzt im Drift ein und wirkt nicht nervig
- [ ] Backfire-Auspuff kaufen: Flammen und Knall beim Gaswegnehmen aus hoher Drehzahl
- [ ] Menümusik gefällt oder lässt sich abstellen

## 6. Effekte

- [ ] Qualm in gekaufter Farbe, auch Regenbogen. Er verdeckt das Auto nicht zu sehr
- [ ] Reifenspuren entstehen im Drift und verblassen langsam
- [ ] Funken an der Wand, Tempolinien bei hohem Tempo
- [ ] Leuchtfaden im Battle wird bei idealem Abstand stärker
- [ ] Zeitlupe und Kamerafahrt am Ende eines Laufs wirken gut, nicht störend
- [ ] Wetter je Strecke: Staub, Gischt, Regen mit Lichtkegeln
- [ ] „Reduzierte Effekte“: kein Wackeln, keine Zeitlupe, keine Tempolinien

## 7. Online-Duell mit einem Freund

Am besten über verschiedene Netze, etwa WLAN gegen Mobilfunk.

- [ ] Der erste Aufruf nach einer Pause zeigt „Server wird gestartet …“ und klappt innerhalb einer Minute
- [ ] Duell erstellen, Code weitergeben, beitreten. Beide sehen Name, Auto, Look und Leistungsindex des anderen
- [ ] Der Gastgeber wählt Strecke, Format und Einheits-Leistung, beide klicken „Bereit“
- [ ] Ein ganzes Duell: Der Countdown läuft bei beiden fast gleichzeitig ab, das Gegnerauto fährt flüssig
- [ ] Punkte und Sieger stimmen auf beiden Geräten überein, die Belohnung wird gebucht
- [ ] Emotes kommen an
- [ ] Flugmodus für 5 Sekunden: Das Spiel verbindet sich wieder, das Duell läuft weiter
- [ ] Flugmodus für über 15 Sekunden: Der andere gewinnt mit klarer Meldung
- [ ] Eigener Look mit vielen Aufklebern erscheint beim Gegner genauso
- [ ] Revanche führt zurück in die Lobby
- [ ] Ping-Anzeige wirkt plausibel, bei schlechter Verbindung kommt ein Hinweis

## 8. Barrierefreiheit

- [ ] Farbenblind-Modus: Abstandsanzeige und Bewertung sind auch ohne Farbe erkennbar
- [ ] Schriftgröße „Groß“ in allen Menüs
- [ ] Systemeinstellung „Bewegung reduzieren“ wird übernommen

## 9. Spielstand

- [ ] Spielstand exportieren, in einem anderen Browser importieren, alles ist da
- [ ] „Fortschritt zurücksetzen“ fragt zweimal nach
- [ ] Browser schließen und neu öffnen: Geld, Autos und Looks sind noch da
