# MASTER-PROMPT v2: 3D-Drift-Spiel „DRIFTKÖNIG" (Arbeitstitel)

> Diese Datei liegt als `SPEC.md` im Projektordner. Ändere sie nicht. Sie ist die verbindliche Spezifikation. Wenn du etwas anders löst, als hier steht, trage es in `docs/ENTSCHEIDUNGEN.md` ein.

---

## 0. Rolle, Ziel, Rahmen

Du bist Lead Game Developer, Fahrphysik-Ingenieur, 3D-Grafiker, UI-Designer, Audio-Programmierer und Netzwerk-Entwickler in einer Person. Du baust ein komplettes, spielbares 3D-Drift-Spiel für den Browser. Es läuft auf Handy, iPad, Laptop und PC.

**Spielidee:** Ein Drift-Spiel mit Tandem-Battles (zwei Autos driften dicht hintereinander, eine Jury-Logik bewertet beide), extrem tiefer Auto-Individualisierung, Ingame-Währung und Online-Duellen per Einladungscode. Das Spielprinzip (Tandem-Battle, Drift-Punkte, Garage, Tuning) orientiert sich am Genre der mobilen Drift-Spiele.

**Rechtlicher Rahmen (verbindlich):**
- Das Spielprinzip ist Genre-Wissen und darf übernommen werden.
- KEINE Original-Assets, keine echten Automarken, keine echten Fahrzeugmodelle, keine Markenlogos, keine Namen, Strecken, Aufkleber oder Sounds aus anderen Spielen. Alles (Autos, Teile, Strecken, Namen, Icons, Aufkleber, Sounds) ist eigenständig erfunden und selbst erzeugt.
- Keine urheberrechtlich geschützte Musik. Audio wird prozedural per WebAudio erzeugt.
- Schriften nur frei lizenziert (z. B. Lilita One, Rajdhani, Orbitron, Bungee) und lokal eingebunden. Lizenzen in `docs/LIZENZEN.md` vermerken.
- Erfundene „Sponsoren" und Logos dürfen keinen echten Marken ähneln.

**Sprache:** Gesamte Spieloberfläche auf Deutsch. Code-Kommentare und Doku auf Deutsch. Alle Texte der Oberfläche stehen zentral in `client/i18n/de.js`, nicht verstreut im Code.

**Arbeitsweise (sehr wichtig):**
1. Stelle KEINE Rückfragen. Wo etwas offen ist, entscheidest du selbst nach bestem Wissen und trägst die Entscheidung mit kurzer Begründung in `docs/ENTSCHEIDUNGEN.md` ein.
2. **Einzige erlaubte Unterbrechung:** Fehlt notwendige Software (Node.js, npm, Git), erkläre kurz und genau, was installiert werden muss, und arbeite danach weiter.
3. Arbeite die Phasen aus Abschnitt 16 der Reihe nach ab. Teste nach jeder Phase, hake die Abnahme-Checkliste ab und gehe erst dann weiter.
4. Führe `docs/FORTSCHRITT.md` laufend: aktuelle Phase, was fertig ist, was offen ist, bekannte Probleme, wichtige Entscheidungen. Wenn dein Kontext knapp wird oder du neu startest, lies zuerst `docs/FORTSCHRITT.md` und den Abschnitt der aktuellen Phase in dieser Datei, dann arbeite weiter.
5. Committe nach jeder Phase mit klarer Nachricht (Git initialisieren, falls noch nicht vorhanden). Arbeite auf dem Hauptzweig, außer ich habe dir etwas anderes gesagt.
6. Baue nichts als Platzhalter. Was in dieser Spezifikation steht, wird vollständig gebaut. Ist etwas technisch nicht sinnvoll, setze die beste Alternative um und dokumentiere sie.

**Definition von „fertig":** Ein neuer Spieler startet das Spiel, absolviert das Tutorial, gewinnt ein Bot-Battle, kauft ein Teil, gestaltet sein Auto in der Garage, fährt mit dem Look im Rennen, spielt ein Online-Duell per Code gegen einen zweiten Browser und alles läuft ohne Fehler und mit den Performance-Zielen aus Abschnitt 14.

---

## 1. Technik und Architektur

**Feste Entscheidungen:**
- **Node.js LTS (mindestens Version 20)**, ES-Module (`"type": "module"`), Paketmanager npm.
- **Client:** Three.js (feste Version in `package.json` pinnen, ohne `^` oder `~`), gebündelt mit **Vite** (kein CDN, alles lokal, damit es offline und auf Render stabil läuft). WebGL2 wird vorausgesetzt. Ist WebGL nicht verfügbar, zeige eine verständliche deutsche Fehlermeldung.
- **Server:** Node.js mit `ws` (WebSocket) und `express` (liefert den Vite-Build aus, `/healthz`-Endpunkt).
- **Zielbrowser:** aktuelles Chrome, Edge, Firefox, Safari (iOS/iPadOS ab Version 16, macOS).
- **Skripte in `package.json`:** `dev` (Client + Server mit Neuladen), `build` (Vite-Build), `start` (Produktionsserver, liefert `dist` aus), `test` (alle Tests).
- **Port und Host:** `process.env.PORT` (Standard 3000), Server bindet an `0.0.0.0`. WebSocket läuft auf demselben Port wie HTTP. Der Client wählt `ws://` oder `wss://` anhand von `location.protocol`.
- **Render:** Lege `render.yaml` an (Web Service, Build: `npm install && npm run build`, Start: `npm start`, Health-Check `/healthz`). Beachte: Kostenlose Render-Instanzen schlafen nach Inaktivität ein. Der Client zeigt dann beim Verbinden „Server wird gestartet …" mit automatischem Wiederholen (bis zu 90 Sekunden) statt eines Fehlers. Der Single-Player-Teil muss auch ohne Server funktionieren.
- **Heartbeat:** Server und Client senden alle 25 Sekunden ein Ping, damit Proxys die Verbindung nicht wegen Inaktivität trennen.

**Ordnerstruktur (Vorschlag, begründete Abweichung erlaubt):**
- `/client` Rendering, Eingabe, UI, Audio, Garage, i18n
- `/shared` Physik-Kern, Fahrzeugdaten, Teile-Katalog, Streckendaten, Wertungslogik, Look-Schema, Netzwerk-Schema. Wird von Client UND Server importiert und darf keine Three.js- oder Browser-Abhängigkeit haben.
- `/server` Lobbys, Einladungscodes, Match-Ablauf, Validierung, Rate-Limits
- `/tests`, `/docs`

**Trennung:** Spiellogik und Physik (fester Zeitschritt, ohne Darstellung) sind strikt von der Darstellung getrennt. Die Darstellung interpoliert zwischen den Physik-Schritten.

**Zeitschritt:** Physik mit festem Schritt 1/60 s und Accumulator, maximal 5 Schritte pro Frame (danach Zeit verwerfen, damit das Spiel nach einem Hänger nicht explodiert). Bei Tab-Wechsel (`visibilitychange`) oder Fensterverlust pausiert das Spiel automatisch (im Online-Duell stattdessen: Verbindung halten, Auto rollt aus, Warnhinweis).

**Determinismus (präzise gemeint):** Gleiche Eingaben und gleicher Zufalls-Seed ergeben auf demselben System das gleiche Ergebnis. Zufall im Spiel läuft über einen seedbaren Zufallsgenerator (kein `Math.random()` in Physik, Wertung, Bots). Bitgenaue Gleichheit zwischen verschiedenen Geräten ist NICHT nötig, weil im Online-Modus jeder Client nur sein eigenes Auto simuliert (siehe Abschnitt 10).

**Einheiten:** Physik intern in SI (Meter, Sekunde, Kilogramm, Radiant). Die Anzeige rechnet in km/h und Grad um.

**Speicherung (Single-Player):**
- `localStorage` mit Schlüssel-Präfix und Versionsnummer, Migration zwischen Versionen, tägliches Backup der letzten gültigen Version in einem zweiten Schlüssel.
- Struktur (Auszug): `version`, `clientId` (zufällige ID, einmalig erzeugt), `waehrung`, `autos[]` (je Auto: `id`, `gekaufteTeile`, `looks[5]`, `setups[3]`, `aktiverLook`, `aktivesSetup`), `fortschritt` (freigeschaltete Strecken und Bot-Stufen, Bestwerte, Medaillen), `tagesaufgaben`, `statistik`, `einstellungen`.
- Ist `localStorage` nicht verfügbar (z. B. privater Modus), läuft das Spiel mit einem Speicher im Arbeitsspeicher weiter und zeigt einen deutlichen Hinweis, dass nichts gespeichert wird.
- **Spielstand-Export:** als Datei (`.json`) und zusätzlich als Text-Code (Kompression per `CompressionStream` oder lokal eingebundener Bibliothek, dann Base64URL). Der Import prüft Schema, Version und Größe und lehnt Ungültiges ohne Absturz ab.
- Fehlerhafte oder manipulierte Saves werden erkannt (Schema-Validierung, Wertebereiche, Prüfsumme). Bei Fehler: letzte gültige Sicherung laden, sonst neuer Spielstand mit klarer Meldung.

**Progressive Web App:** `manifest.webmanifest` und ein Service Worker, der Spiel-Dateien cached, damit der Single-Player offline läuft. Der Cache ist versioniert (Build-Hash), alte Caches werden beim Update gelöscht, und es gibt einen Hinweis „Neue Version verfügbar – neu laden". Online-Funktionen brauchen weiter die Verbindung. Auf dem iPhone fehlt die Fullscreen-API für Seiten: Zeige dort einen Hinweis „Zum Home-Bildschirm hinzufügen für Vollbild".

**Sicherheit:** Server setzt sinnvolle Header (Content-Security-Policy ohne Inline-Skripte, `X-Content-Type-Options`, `Referrer-Policy`). Kein `eval`. Keine externen Anfragen (keine CDNs, Fonts oder Tracker von Dritten).

**Fehlerbehandlung:** Globale Fehlerbehandlung (`error`, `unhandledrejection`) mit freundlichem Fehlerbildschirm und Option „Neu laden". WebGL-Kontextverlust (`webglcontextlost`/`webglcontextrestored`, häufig auf Handys) wird abgefangen: Spiel pausiert, Ressourcen werden bei Wiederherstellung neu aufgebaut.

**Debug-Modus:** Nur mit URL-Parameter `?debug=1` oder Taste F3 im Entwicklungsmodus: Overlay (FPS, Geschwindigkeit, Driftwinkel, Schlupf je Achse, Punkte-Rate, Ping) und Cheats (Münzen +10.000, alle Strecken freischalten, Bot-Stufen freischalten). Im Produktions-Build sind die Cheats deaktiviert.

---

## 2. Fahrphysik (Herzstück, höchste Priorität)

Die Fahrphysik rechnet auf einer **flachen 2D-Ebene** (Position x/z, Gierwinkel, Geschwindigkeitsvektor im Karosserie-Koordinatensystem, Gierrate) und wird nur in 3D dargestellt. Ziel ist ein **Arcade-Drift-Gefühl**: leicht einzuleiten, schwer zu perfektionieren, sehr befriedigend. Nicht-physikalische Hilfen sind erlaubt, solange sie das Gefühl verbessern und dokumentiert sind.

**Fahrzeugmodell:**
- Masse, Radstand, Schwerpunkthöhe, Schwerpunktlage (Gewichtsverteilung vorne/hinten), Trägheitsmoment um die Hochachse, Spurweite.
- Antrieb: Standard Hinterrad. Der Onyx RS darf einen Allrad mit starker Heckbetonung haben, die anderen fahren Heckantrieb.
- Motor: Drehmomentkurve über der Drehzahl (Leerlauf, Drehmoment-Maximum, Drehzahlbegrenzer), Schaltstufen (5 oder 6), Übersetzungen, Schaltzeit. **Getriebe automatisch als Standard**, optional manuell am PC (Tasten E hoch, Q runter). Mobil nur automatisch. Anzeige des Gangs im HUD.
- Turbo (Vireo Turbo stark, andere je nach Tuning): Ladedruck baut sich mit Zeit und Drehzahl auf (Turboloch), fällt beim Gaswegnehmen ab (Ablassgeräusch, siehe Audio).
- Bremse (Bremskraft, Balance vorne/hinten), **Handbremse** (blockiert die Hinterräder anteilig, regelbar), Rückwärtsfahren: Bremse gedrückt halten bis zum Stillstand schaltet nach 0,3 s in den Rückwärtsgang.

**Reifenmodell:**
- Seitenführungs- und Längskraft je Achse (vorne/hinten) über dem Schräglaufwinkel und Schlupf. Nutze eine vereinfachte Pacejka-Kurve oder ein Bürstenmodell mit Sättigung. Reibungskoeffizient im Bereich ca. 1,0 bis 1,2, Sättigung bei etwa 8–12° (vorne) und 10–14° (hinten) als Startwerte.
- **Kombinierter Schlupf** (Kamm'scher Kreis): Gas, Bremse und Lenken teilen sich das Haftungslimit. Durchdrehende Hinterräder verringern die Seitenführung hinten, das ist der Kern des Driftens.
- **Lastverlagerung:** Gasgeben verlagert Gewicht nach hinten, Bremsen nach vorne, Kurvenfahrt nach außen. Das verändert die Achslasten und damit den Grip.
- Reifenverschleiß gibt es NICHT.

**Driftcharakter und Hilfen:**
- Einleitung per Handbremse, Lastwechsel (Scandinavian Flick), Kupplungstritt (Clutch Kick: kurzer Drehzahlstoß, am PC Shift, mobil optionaler 4. Button, standardmäßig aus) und Gasüberschuss mit Gegenlenken.
- Lenkung: geschwindigkeitsabhängiger maximaler Lenkwinkel, Lenkung zentriert sich selbst, bei Touch Lenkrate glätten.
- **Gegenlenk-Assistenz** (Einstellung 0–100 %, Standard 60 %, gilt für alle Geräte und Modi): hilft, den Wagen im Drift aufzufangen, indem sie die Lenkung teilweise in Richtung der Bewegungsrichtung führt. Sie darf das Auto nie allein driften lassen, nur stabilisieren.
- Zusätzlich eine kleine **Drift-Haltehilfe** (nur Handy-Touch standardmäßig an, 30 %): minimale Gaskorrektur, die einen Drift hält. In den Einstellungen abschaltbar.

**Kollision:**
- Auto gegen Wand, Leitplanke und Hindernis: Kreis- oder Kapselmodell reicht. Reaktion mit Abprallen, Geschwindigkeitsverlust (stärker bei frontalem Aufprall), Gierrate-Störung. Kein Steckenbleiben in Ecken: Positionskorrektur schiebt das Auto immer sauber aus der Wand.
- Auto gegen Auto im Tandem: **weiche Kollision**. Kein harter Rückstoß, kein Festkleben, keine Rotation durch Berührung. Details im Netzwerkfall in Abschnitt 10.

**Hänger-Erkennung:** Steht das Auto länger als 4 Sekunden ohne Fahrt (z. B. in einem Hindernis), erscheint der Button „Zurücksetzen". Nach 8 Sekunden wird automatisch zur nächsten Position auf der Strecke zurückgesetzt (im Battle mit Punktabzug, im Training ohne).

**Stabilität (Pflicht):** Keine NaN, kein Aufschaukeln, keine unendliche Beschleunigung. Begrenze Gierrate und Geschwindigkeit sinnvoll, nutze Unterschritte (Substeps) falls nötig. Testfälle: Dauer-Handbremse, Vollgas gegen die Wand, Vollausschlag der Lenkung bei Höchstgeschwindigkeit, Wechselnder Lenkausschlag in Höchstfrequenz, sehr kleine und sehr große Frame-Zeiten.

**Messgrößen (für Tests und Tuning):** 0–100 km/h-Zeit, Höchstgeschwindigkeit, Wendekreis, maximaler stationärer Driftwinkel bei Halte-Kreisfahrt, Bremsweg aus 100 km/h, Driftstabilität (Zeit bis zum Ausbrechen bei konstanter Gas-/Lenk-Eingabe).

**Parameter-Datei:** Alle Werte stehen kommentiert in `shared/physikParameter.js` (global) und `shared/autos.js` (je Auto), damit man das Fahrgefühl leicht nachjustieren kann.

---

## 3. 3D-Darstellung und Kamera

**Stil:** Stylisiertes Low-Poly mit sauberen Flächen, kräftigen Farben, weichen Verläufen und Glow-Akzenten. Konsistent über Autos, Strecken und UI. Keine texturlastigen Assets, alles prozedural oder als kleine, selbst erzeugte Dateien.

**Verfolgerkamera (Standard):**
- Position ca. 6–8 m hinter und 2,5–3 m über dem Auto. Das Kamera-Blickziel liegt leicht vor dem Auto.
- **Drift-Verhalten:** Die Kamera richtet sich nicht stur nach dem Heck aus, sondern nach einer Mischung aus Fahrzeugausrichtung (ca. 35 %) und Bewegungsrichtung (ca. 65 %), geglättet mit einer Zeitkonstante von ca. 0,25 s. So sieht man das Auto im Drift seitlich, ohne dass die Kamera wild schwenkt.
- FOV steigt mit der Geschwindigkeit (ca. 60° im Stand bis ca. 75° bei Höchstgeschwindigkeit). Leichtes Wackeln bei Handbremse und Kontakt. Kamera darf nie durch Wände oder Hindernisse clippen (Kollisionsprüfung der Kameraposition, Annäherung statt Durchdringen).
- **Kameramodi** (umschaltbar im Rennen, Auswahl wird gespeichert): Verfolger (Standard), Weit-Verfolger, Dach/Top-Down-schräg (Vogelperspektive), Motorhaube.

**Beleuchtung:**
- Gerichtetes Hauptlicht, Hemisphärenlicht, Tageszeit je Strecke.
- **Schatten:** Nur Auto-Schatten (Spieler und Gegner) über eine kleine, dem Auto folgende Shadow-Map. Auf Qualität „Niedrig" stattdessen ein weicher Blob-Schatten.
- Scheinwerfer, Rücklichter und Neon sind hauptsächlich leuchtende Materialien (Emissive) und additive Lichtkegel-Meshes. Echte Lichtquellen nur wenige (maximal 4 gleichzeitig).
- Nasser Asphalt am Neon-Hafen: **keine** Echtzeit-Spiegelung. Nutze eine Environment-Map plus langgezogene Licht-Streifen-Decals auf dem Boden und leichten Glanz im Material.
- Nachbearbeitung (Bloom) nur auf Qualität „Hoch" und nur am Desktop. Auf Handys erzeugt man Glow über additive Sprites und Emissive.

**Qualitätsstufen** (Einstellung Niedrig/Mittel/Hoch/Automatisch):

| Merkmal | Niedrig | Mittel | Hoch |
|---|---|---|---|
| Pixel-Ratio (max.) | 1,0 | 1,5 | 2,0 |
| Schatten | Blob | Shadow-Map 1024 | Shadow-Map 2048 |
| Partikel-Menge | 25 % | 60 % | 100 % |
| Livery-Textur | 1024 | 1024 | 2048 |
| Bloom | aus | aus | an (nur Desktop) |
| Deko-Dichte | 50 % | 80 % | 100 % |

Bei „Automatisch" startet das Spiel auf Mittel, misst die durchschnittliche Frame-Zeit über 2 Sekunden und senkt die Stufe schnell, wenn sie zu hoch ist, erhöht sie aber erst nach 20 Sekunden stabiler Leistung (Hysterese, kein Hin-und-Her).

**Speicherverwaltung:** Geometrien, Materialien und Texturen, die nicht mehr gebraucht werden (Gegnerauto, nicht aktive Autos, Streckenwechsel), werden mit `dispose()` freigegeben. Es sind nie mehr als zwei Livery-Texturen gleichzeitig im Speicher (eigenes Auto und Gegner). Prüfe das mit einer Speichermessung beim wiederholten Streckenwechsel.

**Responsiv:** Canvas passt sich jeder Bildschirmgröße und Ausrichtung an (`100dvh`/`100dvw`, Safe-Area-Insets, Hoch- und Querformat, Größenänderung zur Laufzeit). Vollbild-Button (wo vom Browser unterstützt). Kein Pinch-Zoom, kein Pull-to-Refresh, kein ungewolltes Markieren oder Kontextmenü. Display-Wachhalten per Wake-Lock-API während der Fahrt, wo verfügbar.

---

## 4. Die 6 Autos (alle frei erfunden)

Jedes Auto wird **modular und prozedural** aufgebaut: Karosserie-Basis plus austauschbare Anbauteile. Die Anbauteile werden **parametrisch** erzeugt (Generator-Funktionen mit Parametern) und docken an definierte **Anker-Punkte** des jeweiligen Autos an (Frontstoßstange, Heck, Dach, Haube, Radhäuser, Seitenschweller, Kofferraum). So braucht man keine Hunderte Einzelmodelle, aber jedes Teil passt zu jedem Auto.

**Richtwerte** (Feintuning durch dich erlaubt, Unterschiede müssen aber deutlich spürbar bleiben):

| Auto | Charakter | Masse | Radstand | Arcade-PS | 0–100 | Höchstg. | Preis |
|---|---|---|---|---|---|---|---|
| **Kestrel S** | Kleines, leichtes Heck-Coupé. Einsteiger, wendig, verzeiht Fehler. | ca. 1000 kg | 2,45 m | ca. 160 | ca. 7,5 s | ca. 170 km/h | kostenlos (Startauto) |
| **Marlin 4D** | Ausgewogene Limousine. Stabil, gutmütig. | ca. 1350 kg | 2,80 m | ca. 220 | ca. 7,0 s | ca. 190 km/h | 8.000 |
| **Vireo Turbo** | Kompaktes Turbo-Coupé. Spritzig, nervös, deutlicher Turbolag, belohnt Timing. | ca. 1150 kg | 2,50 m | ca. 260 | ca. 5,5 s | ca. 200 km/h | 15.000 |
| **Hornet Wagon** | Langer Kombi, langer Radstand. Sehr stabile, lange Drifts, träges Einlenken. | ca. 1500 kg | 2,95 m | ca. 240 | ca. 7,0 s | ca. 195 km/h | 25.000 |
| **Bastion GT** | Schweres Muscle-Coupé, viel Drehmoment. Raucht gewaltig, schwer zu zähmen. | ca. 1650 kg | 2,75 m | ca. 420 | ca. 4,8 s | ca. 230 km/h | 40.000 |
| **Onyx RS** | Flacher Sportwagen, höchster Grip und Topspeed, Allrad mit Heckbetonung, schwieriger zu driften. | ca. 1250 kg | 2,60 m | ca. 380 | ca. 4,3 s | ca. 250 km/h | 60.000 |

Messwerte dürfen um ca. 15 % abweichen. Wichtig ist die Rangfolge und die Spürbarkeit.

**Wichtig zur Fairness:** Die Punktewertung hängt NICHT vom Auto ab, sondern nur vom Fahrverhalten (Winkel, Geschwindigkeit, Linie). Kein Auto bekommt Wertungs-Bonus.

**Bauteile jedes Autos:**
- Eigenes Karosseriemodell mit klarer, unterscheidbarer Silhouette, Scheiben, Scheinwerfer und Rücklichter (leuchten, Bremslicht reagiert auf Bremse), Spiegel, Räder mit Federung, Lenkeinschlag der Vorderräder, drehende Räder (bei hoher Geschwindigkeit Unschärfe-Effekt statt Speichen).
- Sichtbare Karosserie-Bewegung (Wanken, Nicken beim Beschleunigen und Bremsen), rein visuell.
- Vereinfachter Innenraum in Low-Poly (Sitze, Lenkrad, Armaturenbrett), sichtbar durch die Scheiben und in der Garagenansicht „Innen". Er ist nicht individualisierbar.

**Leistungsindex (PI):** Eine Zahl von 100 bis 999, berechnet aus einer dokumentierten Formel (Leistung, Gewicht, Grip, Stabilität, Tuningstufen) in `shared/leistungsindex.js`. Serien-PI liegt zwischen ca. 200 (Kestrel S) und ca. 600 (Onyx RS). Volles Tuning erhöht einen Wagen um ca. 35–50 %. Formel und Beispielwerte stehen in `docs/AUTOS.md`.

---

## 5. Die 3 Strecken (alle frei erfunden)

Alle Strecken sind **geschlossene Rundkurse**. Ein Durchgang im Tandem ist **eine Runde**. Strecken werden **datengetrieben** definiert (`shared/strecken/*.js`), damit sie später leicht erweiterbar sind.

**Streckendaten-Schema:**
- Mittellinie (Spline aus Kontrollpunkten) mit Breite pro Punkt
- Wände als Polylinien, Hindernisse (Kreise und gedrehte Rechtecke)
- **Drift-Zonen:** Bereiche entlang der Strecke mit Soll-Winkelbereich, Mindestgeschwindigkeit und Gewichtung
- **Ideallinie:** wird automatisch aus Mittellinie, Krümmung und Drift-Zonen erzeugt (optional per Hand nachjustierbar) und dient Wertung und Bots
- Checkpoints, Startaufstellung (Führer und Verfolger versetzt), Referenz-Zeiten, Minimap-Daten
- Deko (instanziert), Himmel, Licht, Wetter-Effekte, Boden-Material

**Kollision effizient:** Wände als Liniensegmente mit räumlichem Raster (Uniform Grid) für schnelle Abstandsabfragen, Hindernisse als Kreise/OBB. Unsichtbare Begrenzungswände verhindern das Verlassen der Spielfläche.

**Die drei Strecken:**

1. **Industriehof (Tag).** Große, flache Betonfläche mit Containern, Reifenstapeln, Paletten und einer technischen Schleife. Einsteigerfreundlich. Länge ca. 900 m, Rundenzeit ca. 50–60 s, Breite 18–30 m, ca. 6 Drift-Zonen (meist Kreis- und Slalom-Zonen um Hindernisse). Staub-Partikel in der Luft.
2. **Küstenpass (Sonnenuntergang).** Serpentinen am Meer mit Leitplanken, engen Kehren, einer langen Schnellkurve und Felswänden. Länge ca. 1600 m, Rundenzeit ca. 85–100 s, Breite 10–14 m, ca. 9 Drift-Zonen. Gischt-Partikel, tiefstehende Sonne mit warmem Licht. Mittelschwer.
3. **Neon-Hafen (Nacht).** Hafenanlage mit Kränen, Containern, Neonlicht, nassem Asphalt (siehe Abschnitt 3), engen Passagen und einer großen Drift-Schikane. Länge ca. 1300 m, Rundenzeit ca. 70–85 s, Breite 12–20 m, ca. 8 Drift-Zonen. Schwer und optisch spektakulär.

Jede Strecke hat: Minimap, Rundenzähler, persönliche Bestwerte (lokal gespeichert), Drift-Zonen-Anzeige auf der Minimap, Startaufstellung für Tandem, Zeitlimit pro Durchgang (150 % der Referenzzeit).

---

## 6. Spielmodi und Fortschritt

1. **Freies Fahren / Training:** Alle freigeschalteten Strecken, alle eigenen Autos, Drift-Punkte sichtbar, Neustart-Taste. Kleiner Münz-Bonus nur bei neuem persönlichem Bestwert.
2. **Drift-Zeitangriff:** 3 Runden auf einer Strecke, Wertung wie Führer-Wertung (Abschnitt 7) ohne Gegner. Medaillen nach durchschnittlicher normierter Rundenpunktzahl (0–100): Bronze ab 40, Silber ab 60, Gold ab 80, Champion ab 95.
3. **Tandem-Battle gegen Bots:** Hauptmodus für Währung (Abschnitt 7).
4. **Online-Duell per Einladungscode** (Abschnitt 10).
5. **Garage** (Abschnitt 8) und **Shop** (Abschnitt 9).

**Freischaltungen (der Reihe nach):**
- **Strecken:** Industriehof von Beginn an. **Küstenpass** nach 3 gewonnenen Bot-Battles (beliebige Stufe) auf dem Industriehof. **Neon-Hafen** nach 3 gewonnenen Bot-Battles auf dem Küstenpass.
- **Bot-Stufen:** Anfänger von Beginn an. Jede nächste Stufe (Fahrer, Profi, Meister, Legende) wird nach **1 Sieg** gegen die vorherige Stufe freigeschaltet (auf einer beliebigen freigeschalteten Strecke).
- **Autos und Teile:** nur durch Kauf. Das Startauto Kestrel S ist von Anfang an im Besitz.
- Der Online-Modus ist von Beginn an offen. Zeitangriff wird mit der jeweiligen Strecke freigeschaltet.
- Unter `?debug=1` lässt sich alles freischalten (Abschnitt 1).

---

## 7. Tandem-Battle (Regeln, Wertung, Bots)

### 7.1 Format und Ablauf
- **Durchgang:** eine Runde. Einer fährt als **Führer**, der andere als **Verfolger**.
- **Lauf:** zwei Durchgänge mit Rollentausch. Jeder Spieler hat danach einmal geführt und einmal verfolgt.
- **Battle-Format (wählbar):** „Schnell" = 1 Lauf (ca. 3 Minuten, halbe Belohnung), „Best of 3" = bis zu 3 Läufe, wer zuerst 2 Läufe gewinnt (ca. 6–10 Minuten, volle Belohnung, Standard).
- **Lauf-Ergebnis:** Gesamtpunktzahl eines Spielers = Führer-Punktzahl (0–100) plus Verfolger-Punktzahl (0–100), also maximal 200. Höhere Summe gewinnt den Lauf.
- **Wer zuerst führt:** Im ersten Lauf wird die Startrolle ausgelost (im Online-Duell vom Server, mit seedbarem Zufall). In den folgenden Läufen wechselt die Startrolle gegenüber dem Vorlauf.
- **Gleichstand:** Beträgt der Unterschied der Gesamtpunktzahl in einem Lauf weniger als 3 Punkte, wird dieser Lauf wiederholt („Noch einmal", mit neu ausgeloster Startrolle). Ein einzelner Durchgang kann nie über einen Gleichstand entscheiden, weil Führer- und Verfolger-Punkte nicht direkt vergleichbar sind. Bleibt es nach zwei Wiederholungen unentschieden, gewinnt der Spieler mit der höheren Führer-Punktzahl aus dem letzten Lauf, sonst entscheidet ein seedbarer Münzwurf. Wiederholungsläufe zählen nicht zur Höchstzahl von 3 Läufen.
- **Start:** Beide Autos stehen versetzt (Verfolger 8–12 m hinter dem Führer), Countdown 3-2-1, fliegender Start. Die Verfolger-Wertung beginnt erst nach einer **3-Sekunden-Aufschließphase**, die Führer-Wertung mit der ersten Drift-Zone.
- **Ende eines Durchgangs:** Ziellinie nach einer Runde oder Zeitlimit (150 % der Referenzzeit). Das Auto des Spielers darf danach im Auslauf frei weiterrollen, bis das Ergebnis erscheint.
- **Abbrüche:** Dreht sich ein Auto weg und steht länger als 4 s, erscheint die Zurücksetzen-Option (Abschnitt 2), mit Punktabzug.

### 7.2 Wertung (Jury-Logik in `shared/wertung.js`)
Die Wertung wird mit **festen 20 Ticks pro Sekunde** berechnet (alle Modi, auch Online, damit Ergebnisse vergleichbar sind). Alle Formeln und Konstanten stehen in `shared/wertungsParameter.js` und in `docs/WERTUNG.md`.

**Führer-Rohpunkte pro Tick** (nur wenn Geschwindigkeit ≥ 40 km/h und Driftwinkel ≥ 10°):
`basis × f_winkel × f_tempo × f_zone × f_linie × combo`
- `f_winkel`: Trapez über dem Driftwinkel. 0 bei 10°, linear auf 1,0 bei 30°, 1,0 bis 55°, linear zurück auf 0 bei 85°.
- `f_tempo`: Geschwindigkeit geteilt durch die Referenzgeschwindigkeit der jeweiligen Zone, begrenzt auf 0 bis 1,2.
- `f_zone`: 1,0 innerhalb einer Drift-Zone, 0,25 außerhalb (Übergangsdrifts zählen, aber weniger).
- `f_linie`: 1 minus (Abstand zur Ideallinie geteilt durch Toleranz, begrenzt auf 0 bis 1) mal 0,6. Der Wert liegt also zwischen 0,4 und 1,0.
- `combo`: Multiplikator von 1,0 bis 3,0, wächst mit ununterbrochen sauberem Driften (ca. +0,1 pro Sekunde), fällt bei Fehlern auf 1,0 zurück.
- **Abzüge:** Wandkontakt (Punktabzug plus Combo-Reset plus kurze Wertungssperre von 1 s), Spin-out (Driftwinkel über 100° oder Stillstand in einer Zone: Combo-Reset), Auto-Kontakt (kleiner Abzug), Zurücksetzen (großer Abzug).
- **Flüssigkeit:** Bonus für saubere Übergänge zwischen gegenläufigen Drifts (Winkelwechsel in unter 1,2 s ohne Verlust des Tempos unter 50 % der Zonengeschwindigkeit).

**Verfolger-Rohpunkte pro Tick:**
`basis × f_abstand × f_gleichwinkel × f_linie × f_drift × combo`
- `f_abstand`: Mittelpunktsabstand zum Führer. 1,0 im Bereich 6–10 m, linear fallend auf 0 bei 30 m. Unter 5 m fällt der Wert wieder ab (auf 0,5 bei 3 m), damit „Drängeln" keine Höchstpunkte gibt.
- `f_gleichwinkel`: 1 minus (Betrag der Winkeldifferenz zum Führer geteilt durch 30°), begrenzt auf 0 bis 1.
- `f_drift`: 1,0 wenn der Verfolger selbst driftet (Winkel ≥ 10°), sonst 0,2.
- `f_linie` und Abzüge wie beim Führer.

**Normierung und Fairness:**
- Rohpunkte werden je Strecke auf eine **Referenzpunktzahl** bezogen, die per Simulation mit dem Legende-Bot (Idealfahrt) ermittelt und in der Streckendatei gespeichert wird. Damit gilt: 100 Punkte entsprechen Legendenniveau. Werte werden auf 0–100 begrenzt.
- Damit ein schlechter Führer dem Verfolger nicht freie Punkte schenkt, gilt:
  `Verfolger-Punkte = Verfolger-Roh-Normiert × (0,5 + 0,5 × Führer-Punkte ÷ 100)`
- Die Formeln sind für beide Rollen und alle Spieler identisch.

**Anzeige im Rennen (Echtzeit):** beide Punktestände, Combo-Multiplikator, Driftwinkel (Bogenanzeige), Abstandsanzeige (Farbe Grün/Gelb/Rot plus Symbol für Farbenblinde), Rolle (Führer/Verfolger), Restzeit, Lauf- und Durchgangsstand, Minimap mit dem Gegner.

### 7.3 Bots (KI)
- **5 Stufen:** Anfänger, Fahrer, Profi, Meister, Legende. Sie unterscheiden sich in Linienqualität, Driftwinkel-Kontrolle, Fehlerquote, Reaktionszeit und Verfolger-Genauigkeit.
- **Bots fahren mit derselben Physik wie der Spieler**, ohne Geschwindigkeits-Boni oder Grip-Tricks. Sie steuern über virtuelle Eingaben (Lenken, Gas, Bremse, Handbremse).
- **Fahrlogik:** Wegpunkte entlang der Ideallinie mit Zielgeschwindigkeit und Soll-Driftwinkel je Abschnitt. Drift-Einleitungspunkte werden automatisch aus der Krümmung der Strecke bestimmt. Lenkung per Regler (PD-Regler) auf Schräglaufwinkel und Linienabstand, Gas per Regler auf Zielgeschwindigkeit.
- **Als Führer:** saubere Linie mit zufälligen kleinen Variationen (seedbar). **Als Verfolger:** hält den Sweet-Spot-Abstand und gleicht den Winkel dem Führer an.
- **Stufenparameter (Richtwerte):**

| Stufe | Soll-Winkel | Linienabweichung | Reaktionszeit | Fehlerquote | Ziel-Punkte als Führer |
|---|---|---|---|---|---|
| Anfänger | 20–30° | bis 3,0 m | ca. 350 ms | hoch | ca. 35–50 |
| Fahrer | 25–40° | bis 2,2 m | ca. 280 ms | mittel-hoch | ca. 40–55 |
| Profi | 30–45° | bis 1,5 m | ca. 200 ms | mittel | ca. 55–70 |
| Meister | 35–55° | bis 0,9 m | ca. 140 ms | gering | ca. 70–85 |
| Legende | 35–55° | bis 0,4 m | ca. 90 ms | sehr gering | ca. 85–97 |

Die Spalte „Ziel-Punkte" ist per Simulationstest zu erreichen (Mittel über viele Läufe, Toleranz ±7 Punkte, pro Strecke geprüft).
- **Gegner-Pool:** mindestens 15 erfundene Bot-Fahrer mit Name, Rangstufe, Auto und fertig gestaltetem Look (keine echten Personen, Marken oder Teamnamen). Der Gegner wird nach Fortschritt vorgeschlagen, die Stufe kann der Spieler frei wählen (soweit freigeschaltet).

### 7.4 Belohnungen (Bot-Battle)
Die Werte gelten für „Best of 3", bei „Schnell" die Hälfte.

| Stufe | Sieg | Niederlage |
|---|---|---|
| Anfänger | 300 | 50 |
| Fahrer | 500 | 70 |
| Profi | 800 | 90 |
| Meister | 1100 | 120 |
| Legende | 1500 | 150 |

**Erstsieg-Bonus:** Der erste Sieg je Stufe und Strecke zahlt das Doppelte. Hinzu kommen kleine Boni für perfekte Durchgänge (Führer-Punktzahl über 90, kein Wandkontakt).

---

## 8. Garage: Individualisierung und Tuning (extrem wichtig)

Die Garage ist ein eigener, sehr hochwertiger Bildschirm: 3D-Auto auf einer Drehscheibe in einem stimmungsvollen Showroom, freie Kamera per Wischen/Maus (Zoom begrenzt), Schnellwahl für Ansichten (Front, Seite, Heck, Felge, Innen). **Jede Änderung ist live sichtbar.** Teile lassen sich vor dem Kauf anprobieren. Der Showroom-Hintergrund und das Licht sind wählbar (mindestens 4 Varianten).

### 8.1 Lackierung
- **Grundlack:** freie Farbwahl (Farbrad plus Hex-Eingabe plus Schnellfarben). Finishs: Glanz, Matt, Satin, Metallic, Perleffekt (Farbverschiebung nach Blickwinkel), Chrom. Zweitfarbe getrennt wählbar für Dach, Haube und Spiegel.
- **Muster:** mindestens 12 selbst erzeugte Muster (Rennstreifen, Doppelstreifen, Karbon-Optik, Flammen, Wellen, Tarnung, Geometrie, Retro-Linien, Seitenblitz, Punkte, Kacheln, Farbverlauf), je mit einstellbarer Farbe, Deckkraft und Skalierung.

### 8.2 Aufkleber-Editor (Livery)
- Bibliothek mit **mindestens 60 selbst gezeichneten Vektor-Aufklebern**, als SVG-Pfad-Daten in `client/assets/aufkleber.js` gespeichert und per `Path2D` gezeichnet. Kategorien: Formen, Sterne und Blitze, Flammen, Streifen, Zahlen und Buchstaben, Flaggen-Muster, Symbole, erfundene „Sponsor"-Logos.
- Pro Aufkleber: Position, Drehung, Größe, Farbe, Spiegeln, Deckkraft, Ebenen-Reihenfolge, Zone (Seiten, Haube, Dach, Heck, Front).
- **Mindestens 30 Aufkleber-Ebenen pro Auto.** Rückgängig/Wiederholen (mindestens 30 Schritte), Duplizieren, Löschen, Gruppen-Verschieben, „Auf andere Seite spiegeln".
- **Text-Aufkleber** (maximal 16 Zeichen) mit mindestens 5 lokal eingebundenen Schriftarten.
- Wortfilter gegen Beleidigungen bei Text-Aufklebern, Kennzeichen und Spielernamen.

**Technische Umsetzung der Livery:**
- Pro Auto **eine Canvas-Textur** (Größe nach Qualitätsstufe, siehe Abschnitt 3) mit einem **Zonen-Atlas**: feste Bereiche für linke Seite, rechte Seite, Haube, Dach, Kofferraum/Heck, Front. Jede Zone wird planar auf das Karosserie-Mesh projiziert (UV-Koordinaten je Fläche automatisch erzeugt). Dokumentiere das Atlas-Layout in `docs/LIVERY.md`.
- Die Textur wird nur bei Änderungen neu gezeichnet, nie pro Frame. Beim Wechsel zu einem anderen Auto oder Verlassen der Garage wird nicht mehr gebrauchtes freigegeben.

### 8.3 Felgen und Reifen
- Mindestens 12 Felgendesigns (Mehrspeichen, Wabe, Turbine, Stahlfelge, Tiefbett, Sternform usw.), frei färbbar (Felgenfarbe, Zierring, Bolzen).
- Einstellbar: Felgengröße, Felgenbreite, Reifenflanke (Farbe/Linie), Reifenprofil (nur optisch). Bremssattel-Farbe.

### 8.4 Bodykit und Anbauteile
Je Auto mindestens **3 Varianten pro Slot**, alle farbig anpassbar, erzeugt über parametrische Generatoren und Anker-Punkte (Abschnitt 4):
- Frontstoßstange/Frontlippe/Frontsplitter, Heckstoßstange/Diffusor, Seitenschweller, Kotflügelverbreiterungen, Motorhaube (Lufthutze, Karbon), Dachaufsatz/Dachträger, Spiegel, Auspuffblenden (Größe, Form).
- **Spoiler:** mindestens 5 Designs (Bürzel, Lippe, kleiner Flügel, großer Heckflügel, Doppelflügel).
- Wirkung auf das Fahrverhalten ist klein, nachvollziehbar und dokumentiert (z. B. Spoiler: etwas mehr Stabilität bei hoher Geschwindigkeit, minimal weniger Topspeed). Der Fokus liegt klar auf der Optik.

### 8.5 Fahrwerk-Optik und Details
- **Tieferlegung** (stufenlos mit Anschlag, Mindest-Bodenfreiheit verhindert Boden-Clipping), **Sturz** vorne/hinten, **Spurverbreiterung**. Wirkt sichtbar am Modell, die Physikwirkung ist gering und klar erklärt.
- **Reifenqualm-Farbe:** Weiß, Schwarz, Rot, Blau, Lila, Grün, Orange, Regenbogen/Verlauf und frei wählbar per Farbwähler.
- **Neon-Unterboden:** Farbe, Helligkeit, Pulsieren.
- Scheibentönung (Stufen), Scheinwerferfarbe (Weiß, Gelb, Eisblau, frei), Rücklichtfarbe/-design.
- **Auspuff-Effekte:** Flammen beim Gaswegnehmen (Backfire) mit einstellbarer Intensität.
- **Kennzeichen** mit frei wählbarem Text (maximal 8 Zeichen, Wortfilter).
- Fahrername/Rangtitel-Tag über dem Auto im Battle (abschaltbar).

### 8.6 Leistungs-Tuning
Teile in **Stufen 1 bis 5**: Stufe 1 = Serie (vorinstalliert, kostenlos), Stufe 2 = Sport, 3 = Rennsport, 4 = Profi, 5 = Meister. Stufen 2–5 sind kaufbar, jeweils mit Preis und klarer Wirkung:
- **Motor** (Leistung), **Turbo/Ansaugung** (Leistung, Turbolag), **Reifen** (Grip, Driftverhalten), **Fahrwerk** (Stabilität, Wankneigung), **Differenzialsperre** (Driftkontrolle), **Bremse/Handbremse** (Bremskraft, Ansprechverhalten), **Gewichtsreduktion** (Gewicht).
- Anzeige als Balken mit Vorher/Nachher und dem **Leistungsindex (PI)** des Autos. Höhere Stufen kosten deutlich mehr als niedrige.

**Setup-Regler (kostenlos, ohne Kauf):** Sturz-Setup, Sperrgrad der Differenzialsperre, Lenkwinkel, Gaskennlinie, Bremsbalance, Federhärte. Mindestens **3 Setup-Slots** pro Auto.

### 8.7 Looks, Teilen, Fotomodus
- Pro Auto mindestens **5 Look-Slots** (Optik) und **3 Setup-Slots** (Leistung). Umbenennbar.
- **Look-Code:** Der Look wird als kompaktes Objekt (Schema unten) serialisiert, komprimiert und als Text-Code exportiert und importiert. Ein Look-Code darf höchstens **8 KB** (komprimiert) groß sein. Beim Import werden Schema, Wertebereiche, Anzahl der Aufkleber (≤ 30), Textlängen und unbekannte Teile geprüft. Ungültiges wird mit klarer Meldung abgelehnt, ohne Absturz.
- Look-Schema (Auszug):
```
{
  "v": 1,
  "auto": "kestrel_s",
  "lack": { "farbe1": "#RRGGBB", "farbe2": "#RRGGBB", "finish": "metallic" },
  "muster": { "id": "rennstreifen", "farbe": "#RRGGBB", "deckkraft": 0.9, "skala": 1.0 },
  "aufkleber": [ { "id": "blitz_03", "zone": "seiteL", "x": 0.4, "y": 0.5, "rot": 12, "skala": 0.8, "farbe": "#RRGGBB", "spiegel": false, "deckkraft": 1.0 } ],
  "felgen": { "design": "turbine", "farbe": "#RRGGBB", "zierring": "#RRGGBB", "groesse": 18, "breite": 8.5 },
  "teile": { "frontstoss": { "variante": 2, "farbe": "#RRGGBB" } },
  "fahrwerk": { "tiefe": 0.6, "sturzV": -2.0, "sturzH": -3.5, "spur": 0.3 },
  "qualm": "#RRGGBB", "neon": { "farbe": "#RRGGBB", "puls": true },
  "scheiben": 2, "scheinwerfer": "#RRGGBB", "rueck": "#RRGGBB",
  "backfire": 0.7, "kennzeichen": "DRIFT1"
}
```
- **Fotomodus:** frei bewegliche Kamera, Hintergrund wählbar, Qualität „Hoch" für das Foto. Rendere das Bild und lese es im selben Frame aus (`toBlob`), speichere es als Datei. Auf iOS über das Teilen-Menü (`navigator.share` mit Datei, mit Download als Rückfall).

---

## 9. Ingame-Währung, Shop und Ökonomie

**Währung:** „Driftmünzen". Ein einziger Währungstyp. Kein Echtgeld, keine Mikrotransaktionen, keine Werbung.

**Startguthaben:** 5.000 Driftmünzen (einmalig).

**Verdienen:**
- **Bot-Battle:** Tabelle in Abschnitt 7.4.
- **Zeitangriff:** Medaille zum ersten Mal: Bronze 150, Silber 300, Gold 600, Champion 1.000. Wiederholte Medaillen zahlen 25 %.
- **Freies Fahren:** kleiner Bonus (50–150) bei persönlichem Bestwert.
- **Online-Duell:** Sieg 400, Niederlage 100, nur wenn das Duell regulär zu Ende gespielt wurde (beide Durchgänge, mindestens 90 Sekunden reine Fahrzeit). **Maximal 10 belohnte Duelle pro Tag** und maximal 3 pro Tag gegen dieselbe Gegner-ID, damit man nicht durch Selbst-Duelle Währung farmt.
- **Tagesaufgaben:** 3 Stück pro Tag, aus einem Pool von mindestens 12 (z. B. „Halte einen Drift über 50° für 5 Sekunden", „Gewinne 2 Bot-Battles", „Fahre 3 Runden ohne Wandkontakt"). Belohnung 100–400 je Aufgabe, Neustart um Mitternacht lokaler Zeit. Das Ändern der Geräteuhr zum Mogeln wird nicht verhindert, aber die Tagesaufgaben sind der einzige Ort, an dem Zeit eine Rolle spielt (Entscheidung dokumentieren).

**Ausgeben:**
- **Autos:** Preise siehe Abschnitt 4. Autos lassen sich zu 50 % des Kaufpreises verkaufen (inklusive eingebauter Teile zu 50 % ihres Preises), das letzte Auto nie.
- **Teile:** Lackfinishs, Muster, Felgen, Bodykit, Neon, Qualmfarben, Leistungsteile mit gestaffelten Preisen (ca. 100 bis 12.000). Aufkleber-Pakete sind günstig (je Paket ca. 150–500). Gekaufte Teile gehören dem Spieler und können beliebig oft ein- und ausgebaut werden (pro Auto, wo nötig). Verkauf eines Teils: 50 %.
- **Kauf-Flow:** Anprobe, Preis, Bestätigungsdialog, Erfolgsanimation. Nicht leistbare Teile zeigen den fehlenden Betrag. Käufe sind atomar (Guthaben und Besitz werden gleichzeitig geändert, keine Doppelbuchungen bei schnellem Doppelklick).

**Balance-Ziele (in `docs/OEKONOMIE.md` ausführlich begründen und per Tabelle belegen):**
- Das erste neue Auto soll nach ca. 8–12 Bot-Siegen erreichbar sein (bei sparsamem Teilekauf).
- Alle Autos, Teile und Looks zusammen sollen ca. 25–40 Stunden Spielzeit brauchen, ohne dass es sich zäh anfühlt. Wirke Zähigkeit gezielt über kleine Belohnungen, sichtbare Fortschritts-Anzeigen und Tagesaufgaben entgegen.
- Es darf keinen Weg geben, Währung durch Fehler, Käufe-und-Verkäufe oder Mehrfach-Belohnungen zu vermehren (Tests dafür, siehe Abschnitt 15).

**Online-Belohnung und Sicherheit:** Der Server berechnet das Ergebnis und die Belohnung des Online-Duells und schickt sie dem Client, der sie bucht. Weil es keine Konten gibt und der Spielstand lokal liegt, kann ein Spieler seinen lokalen Stand technisch verändern. Das ist bewusst akzeptiert (nur ein Spiel unter Freunden) und wird in `docs/ENTSCHEIDUNGEN.md` vermerkt. Ein Online-Duell gewährt aber nie mehr als die oben festgelegte Belohnung.

---

## 10. Online-Multiplayer: Duell per Einladungscode

### 10.1 Lobby
- **Duell erstellen:** Spieler A erhält einen **6-stelligen Code** aus dem Alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (keine verwechselbaren Zeichen). Der Code ist 10 Minuten gültig und nur einmal nutzbar. Beitrittsversuche sind per IP und Verbindung begrenzt (maximal 5 pro Minute).
- **Beitreten:** Spieler B gibt den Code ein.
- **Lobby-Bildschirm:** Gastgeber wählt die Strecke (zur Auswahl stehen nur Strecken, die beide Spieler freigeschaltet haben; der Server prüft das anhand der gemeldeten Freischaltungen), beide sehen Name, Auto, Look-Vorschau und PI des anderen, Bereit-Knopf, Format (Schnell / Best of 3), Schalter „Einheits-Leistung" (beide fahren mit normiertem PI, nur die Optik bleibt). Sechs Emotes (Schnellnachrichten), kein freier Chat.

### 10.2 Netzwerkmodell
- **Jeder Client simuliert nur sein eigenes Auto** (verzögerungsfrei). Er sendet **25-mal pro Sekunde** einen komprimierten Zustand (Position, Gierwinkel, Geschwindigkeitsvektor, Gierrate, Eingabe-Flags, Sequenznummer). Binär-Format oder kompaktes JSON, dokumentiert.
- Das gegnerische Auto wird mit **Interpolation (ca. 100–120 ms Puffer)** und begrenzter Extrapolation dargestellt. Bei Paketverlust wird weich geblendet, nie gesprungen.
- **Der Server relayt, validiert und wertet:**
  - Plausibilitätsprüfung (maximale Geschwindigkeit je Auto-PI, Beschleunigung, Teleport-Erkennung, Streckenbegrenzung).
  - Er berechnet die **Wertung** aus den gemeldeten Zuständen mit derselben `shared/wertung.js` bei 20 Ticks pro Sekunde (pro Tick und Spieler wird der zeitlich letzte gemeldete Zustand verwendet; bei Meldelücken über 200 ms wird der Tick für beide Spieler ausgelassen, damit Verbindungsprobleme niemanden benachteiligen) und entscheidet Durchgangs-, Lauf- und Battle-Sieger sowie die Belohnung.
  - Er steuert den Ablauf: Countdown, Rollentausch, Rundenzähler, Wiederholungslauf bei Gleichstand.
- **Zeitsynchronisation:** Client und Server messen per Ping-Pong den Uhrenversatz und die Latenz (Mittel über mehrere Messungen). Der Countdown ist ein gemeinsamer Startzeitpunkt auf der Server-Zeit.
- **Auto-Kontakt online:** Kontakt wird lokal erkannt (Abstand zum interpolierten Gegner unter einem Schwellwert) und vom Server bestätigt. Beide Seiten bekommen einen kleinen Punktabzug. Eine physikalische Reaktion gibt es nur beim eigenen Auto: sanftes Auseinanderschieben, jeder Client schiebt nur sein eigenes Auto.
- **Look-Sync:** Beim Beitritt überträgt jeder seinen Look-Code (Schema-Prüfung und Größenlimit auf dem Server, siehe Abschnitt 8.7). Das Gegnerauto wird exakt gerendert, auch wenn der Spieler die Teile selbst nicht besitzt (reine Anzeige).
- **Einheits-Leistung:** Der Server legt den Normwert fest, beide Clients wenden ihn auf ihr Auto an. Der Server prüft die Plausibilität weiterhin gegen den Normwert.

### 10.3 Robustheit und Missbrauchsschutz
- **Verbindungsabbruch:** Wiederverbindung innerhalb von 15 Sekunden über ein einmaliges Wiederverbindungs-Token. Danach gewinnt der andere Spieler (mit klarer Meldung, mit halber Belohnung).
- Timeout-Erkennung, AFK-Erkennung (keine Eingaben über 20 s während eines Durchgangs).
- **Rate-Limits** pro Verbindung (Nachrichten pro Sekunde), maximale Nachrichtengröße (z. B. 16 KB), Schema-Validierung jeder eingehenden Nachricht, Zeichen- und Längenprüfung für Namen, Wortfilter.
- Lobbys werden nach Spielende oder Inaktivität (5 Minuten) aufgeräumt, keine Speicherlecks. Der Server darf durch fehlerhafte oder bösartige Pakete unter keinen Umständen abstürzen.
- Die Rollen „Gastgeber" und „Gast" sind serverseitig fest. Ein Client kann keine Serverentscheidungen beeinflussen.
- Anzeige von Ping und Verbindungsqualität im HUD, Warnhinweis bei schlechter Verbindung.

### 10.4 Protokoll
Dokumentiere alle Nachrichten (Name, Richtung, Felder, Wertebereiche, Beispiele) in `docs/NETZWERK.md` und in `shared/netzwerkSchema.js`. Mindestens: `hallo`, `duellErstellen`, `duellErstellt`, `beitreten`, `lobbyStatus`, `bereit`, `startCountdown`, `zustand`, `ereignis` (Kontakt, Wandkontakt, Spin), `durchgangEnde`, `ergebnis`, `emote`, `ping`/`pong`, `fehler`, `wiederverbinden`.

---

## 11. Steuerung (Handy, iPad, PC)

**Mobil (Touch), konfigurierbar:**
- **Lenken** (Auswahl in den Einstellungen): zwei große Pfeil-Tasten links/rechts, ODER ein Lenkrad/Schieber, ODER **Neigungssteuerung** (Gyroskop). Auf iOS braucht die Neigungssteuerung eine Berechtigungsabfrage (`DeviceOrientationEvent.requestPermission()`, ausgelöst durch einen Tipp) und eine sichere Verbindung (HTTPS). Mit Kalibrierung und Totzone. Fällt die Berechtigung weg, schaltet das Spiel auf Tasten zurück.
- **Rechts:** große Tasten für **Gas**, **Bremse/Rückwärts**, **Handbremse**. Optional ein 4. Button „Kupplung" (standardmäßig aus).
- **Layout-Editor:** Position und Größe der Tasten verschiebbar, Transparenz einstellbar, Linkshänder-Modus, Vorschau. Layouts werden gespeichert. Mehrfach-Touch (Lenken plus Gas plus Handbremse gleichzeitig) muss zuverlässig funktionieren.
- **Haptik:** Vibration (Vibration-API) optional, wo vom Gerät unterstützt (auf iPhone nicht verfügbar, dann stillschweigend aus).
- Touch-Ziele mindestens 44 px. Das HUD überlappt nie mit den Tasten.

**PC:**
- W/Pfeil hoch = Gas, S/Pfeil runter = Bremse/Rückwärts, A/D oder Pfeile links/rechts = Lenken, Leertaste = Handbremse, Shift = Kupplungstritt, E/Q = Schalten (nur bei manuellem Getriebe), C = Kamera wechseln, R = Neustart/Zurücksetzen, Esc oder P = Pause.
- **Gamepad** (Gamepad API): linker Stick = Lenken, rechter Trigger = Gas, linker Trigger = Bremse, eine Taste = Handbremse, eine Taste = Kamera, Start = Pause. Totzonen einstellbar.
- Alle Tasten sind in den Einstellungen frei belegbar. Das Spiel erkennt automatisch das zuletzt benutzte Eingabegerät und zeigt passende Hinweise.

**Gleiche Physik für alle Geräte:** Die Eingabe-Schicht liefert normierte Werte (Lenken −1 bis 1, Gas 0 bis 1, Bremse 0 bis 1, Handbremse 0/1). Es gibt keine gerätespezifischen Vorteile in der Wertung.

---

## 12. VFX, Audio und Spielgefühl (hohe Priorität)

### 12.1 VFX
- **Reifenqualm:** Partikelsystem mit Instancing. Menge und Dichte nach Schlupf, Farbe aus der Garage, Auflösen und Verwehen mit leichter Windrichtung. Menge skaliert mit der Qualitätsstufe.
- **Funken** bei Wand- und Unterbodenkontakt, **Backfire-Flammen** am Auspuff.
- **Reifenspuren (Skidmarks):** effizient über ein Ring-Buffer-Mesh, die Spuren verblassen langsam, begrenzte Anzahl.
- **Geschwindigkeits-Effekte:** Speedlines am Bildrand, FOV-Anstieg, Vignette. Keine teure Nachbearbeitung auf Handys.
- **Drift-Feedback:** Punkte-Popups, Combo-Leiste mit Glow, Farbwechsel bei höheren Multiplikatoren, Screen-Shake bei Kollision, kurze Zeitlupe bei knappen Entscheidungen.
- **Tandem-Visuals:** dezenter Leuchtfaden zwischen Führer und Verfolger, der bei idealem Abstand intensiver wird. Sieger-Zeitlupe mit Kamerafahrt am Ende eines Laufs.
- **Umgebungs-Effekte** je Strecke: Staub am Industriehof, Gischt am Küstenpass, Regenreflexe und Lichtkegel am Neon-Hafen.
- Alle Effekte skalieren mit der Qualitätsstufe (Abschnitt 3).

### 12.2 Audio (prozedural per WebAudio, keine geschützten Dateien)
- **Motor:** mehrere Oszillatoren und Filter, abhängig von Drehzahl und Last. Jedes Auto klingt unterscheidbar (Grundton, Obertöne, Rauheit).
- **Turbo:** Pfeifen (Spool) und Ablassgeräusch (Blow-off) beim Gaswegnehmen. **Backfire-Knall.**
- **Reifenquietschen:** gefiltertes Rauschen, Intensität und Tonhöhe aus dem Schlupf.
- Wandkontakt, Auto-Kontakt, Countdown-Töne, Rundenabschluss, UI-Klicks, Kaufen/Erfolg.
- Optionale einfache prozedurale Hintergrundmusik, abschaltbar.
- Lautstärke-Regler (Master, Effekte, Musik). Ein Kompressor am Master verhindert Übersteuern. Maximale Anzahl gleichzeitiger Stimmen begrenzen (Handy-Leistung).
- Audio startet erst nach der ersten Nutzereingabe (Browser-Regel, besonders iOS). Beim Zurückkehren in den Tab wird der Audio-Kontext bei Bedarf fortgesetzt.

---

## 13. UI/UX und Spielfluss

**Visueller Stil der UI:** Flaches Vektordesign mit klaren Formen, kräftigen Farbflächen, Glow-Akzenten und sauberen Konturen. Einheitliches Farbsystem (Hauptfarbe, Akzent, Erfolg, Gefahr) als Design-Tokens, einheitliche Schaltflächen, Übergänge (Fade/Slide, kurze Feder-Animationen). Alle UI-Elemente bleiben in jedem Seitenverhältnis sauber und überlappen nie.

**Bildschirme:**
1. **Ladebildschirm** mit Fortschrittsbalken und Tipps.
2. **Hauptmenü:** Spielen (Bot-Battle, Zeitangriff, Freies Fahren), Online-Duell, Garage, Shop, Einstellungen. Das aktuelle Auto dreht sich im Hintergrund, die Währung ist sichtbar, Tagesaufgaben als kleine Anzeige.
3. **Garage** und **Shop** mit Kategorien, Suche, Filter (gekauft, leistbar, neu), Sortierung, Vorschau.
4. **Battle-Auswahl:** Strecke, Gegner (mit Auto und Look-Vorschau), Schwierigkeit, Format, Belohnungsvorschau.
5. **HUD im Rennen:** Tacho und Drehzahl (stylisch, nicht überladen), Gang, Driftwinkel-Bogen, Punkte, Combo, Rolle, Abstand, Restzeit, Minimap, Pause-Knopf, FPS optional.
6. **Pause-Menü:** Fortsetzen, Neustart, Einstellungen, Beenden. (Im Online-Duell läuft das Spiel weiter, das Menü zeigt nur Einstellungen und „Aufgeben".)
7. **Ergebnisbildschirm:** Punkte-Aufschlüsselung (Winkel, Tempo, Linie, Combo, Abzüge), Belohnung mit Zähl-Animation, Freischaltungs-Meldungen, nächste Aktion (Revanche, Garage, Menü).
8. **Einstellungen:** Grafik, Audio, Steuerung (inkl. Layout-Editor), Kamera, Assistenz, Farbenblind-Modus, Spielstand Export/Import, „Fortschritt zurücksetzen" (mit doppelter Sicherheitsabfrage).
9. **Erster Start:** kurzes interaktives **Tutorial** (Gas, lenken, Handbremse, erster Drift, Tandem erklären), überspringbar, wiederholbar in den Einstellungen.

**Qualität der UI:** Alle Bildschirme funktionieren im Hoch- und Querformat. Fehlerfälle (Server weg, Server voll, ungültiger oder abgelaufener Code, ungültiger Look-Code, volle Aufkleber-Ebenen) zeigen verständliche deutsche Meldungen. Tastatur-Bedienung der Menüs am PC, sichtbarer Fokus.

---

## 14. Performance, Robustheit, Barrierefreiheit

**Performance-Ziele:**
- Desktop: 60 FPS auf aktueller Hardware.
- Handy (Mittelklasse): mindestens 30 stabile FPS. Da kein echtes Gerät zur Verfügung steht, misst du mit Chrome-Entwicklerwerkzeugen: Geräte-Emulation und **CPU-Drosselung 4×** (und 6× als Stresstest). Ich teste später am echten Gerät und melde Probleme.
- Draw Calls: Zielwert unter ca. 150 pro Frame im Rennen (Instancing und Zusammenführen von Geometrie für Deko, wiederverwendete Materialien). Keine Speicherlecks beim wiederholten Strecken- und Autowechsel. Messwerte in `docs/PERFORMANCE.md`.

**Robustheit:** Keine unbehandelten Fehler im normalen Spielablauf. Server stürzt nie durch fehlerhafte Eingaben ab. Fortsetzen nach Tab-Wechsel, Bildschirmsperre und Kontextverlust.

**Barrierefreiheit (im Rahmen des Möglichen):**
- Hohe Kontraste, skalierbare Schriftgröße (3 Stufen), Farbenblind-Modus (Symbole und Muster zusätzlich zu Farbe, Abstandsanzeige auch als Symbol/Text).
- Reduzierte Effekte (weniger Wackeln, Blitze, Zeitlupe) per Schalter, ebenso eine Einstellung für „weniger Bewegung" nach Systemvorgabe (`prefers-reduced-motion`).
- Keine Blitz-Effekte über 3 Hz.

**Datenschutz:** Keine Tracker, keine Konten, keine personenbezogenen Daten außer dem frei gewählten Spielernamen. Der Server speichert nichts dauerhaft (nur Lobby-Zustand im Arbeitsspeicher).

---

## 15. Teststrategie

Nutze den eingebauten Node-Testrunner (`node:test`) oder Vitest. `npm test` führt alles aus.

- **Physik-Tests:** Stabilität (Zufallseingaben mit festem Seed über 10 Minuten simulierte Zeit, danach keine NaN und keine unplausiblen Werte), Extremfälle aus Abschnitt 2, Messgrößen jedes Autos gegen die Richtwerte aus Abschnitt 4 (±15 %).
- **Wertungs-Tests:** feste Eingaben ergeben feste erwartete Punkte, Grenzfälle der Formeln (Winkel 10°/30°/55°/85°, Abstände), Normierung und Verfolger-Faktor.
- **Bot-Simulation:** alle 5 Stufen auf allen 3 Strecken je mindestens 20 Läufe mit verschiedenen Seeds. Prüfe: Bots beenden die Runde, bleiben im Durchschnitt innerhalb der Ziel-Punkte aus Abschnitt 7.3, höhere Stufen schlagen niedrigere im Mittel, Anfänger bleibt schlagbar.
- **Ökonomie-Tests:** Kauf, Verkauf, Rückerstattung, Doppelklick, negatives Guthaben unmöglich, keine Vermehrung durch Kauf-Verkauf-Kreisläufe, Tagesaufgaben, Online-Tageslimit.
- **Speicher-Tests:** Speichern, Laden, Migration alter Versionen, defekte Saves, Spielstand-Export/Import-Rundlauf, Look-Code-Rundlauf (Schema, Größenlimit, Ablehnung ungültiger Codes).
- **Netzwerk-Tests:** zwei simulierte Clients spielen ein komplettes Duell durch (auch mit künstlicher Latenz von 200 ms und 5 % Paketverlust), Wiederverbindung, abgelaufener und doppelt genutzter Code, **Fuzz-Test** mit fehlerhaften, zu großen und unerwarteten Paketen (Server darf nie abstürzen), Rate-Limit-Test.
- **Oberflächen-Test:** Wenn möglich ein Smoke-Test mit Playwright (headless Chromium) für den Menü-Durchlauf (Start, Tutorial überspringen, Battle starten, Garage öffnen, Kauf). Gelingt die Installation nicht, dokumentiere es und prüfe dies über eine manuelle Checkliste.
- **Manuelle Checkliste** für mich: `docs/TESTPLAN_MANUELL.md` mit konkreten Schritten für echte Geräte (Handy, iPad, PC, Gamepad, Online-Duell mit Freund).

---

## 16. Arbeitsphasen mit Abnahme-Checklisten

Arbeite strikt in dieser Reihenfolge. Nach jeder Phase: Tests laufen lassen, Checkliste prüfen, `docs/FORTSCHRITT.md` aktualisieren, committen.

### Phase 1: Fundament
Prüfe Node, npm, Git. Projektstruktur, Vite, Server, Three.js (gepinnt), Game-Loop mit festem Zeitschritt, Eingabe-Abstraktion (Tastatur, Touch, Gamepad), responsiver Canvas, Qualitätsstufen-Grundgerüst, Speichersystem mit Versionierung, Fehlerbehandlung, Debug-Overlay, i18n-Datei, PWA-Grundgerüst, Render-Konfiguration.
- [ ] `npm install`, `npm run dev`, `npm run build`, `npm start` laufen fehlerfrei
- [ ] Canvas füllt jeden Bildschirm, Hoch- und Querformat und Größenänderung funktionieren
- [ ] Eingaben von Tastatur, Touch (Mehrfach-Touch) und Gamepad kommen im Spiel an
- [ ] Speichern, Laden, Migration und defekter Save sind getestet
- [ ] `/healthz` antwortet, WebSocket-Verbindung (Test-Echo) funktioniert

### Phase 2: Fahrphysik und erstes Auto
Physik-Kern in `shared`, ein Testauto auf einer Testfläche, Verfolgerkamera mit Drift-Verhalten, Wandkollision, Hänger-Erkennung, Debug-Anzeigen.
- [ ] Drift lässt sich per Handbremse, Lastwechsel und Gasüberschuss zuverlässig einleiten, halten und beenden
- [ ] Zufalls-Eingabetest (10 Minuten, fester Seed) ohne NaN und Ausreißer
- [ ] Alle Extremfälle aus Abschnitt 2 bestanden
- [ ] Fahrgefühl mit Touch-Steuerung und Assistenz gut spielbar
- [ ] Physik-Tests grün

### Phase 3: Autos, Strecken, Rendering
Alle 6 modularen Autos mit Ankern und Innenraum, alle 3 Strecken nach Schema, Beleuchtung, Minimap, Startaufstellung, Checkpoints, Rundenzähler, Zeitangriff, Qualitätsstufen, Speicherfreigabe.
- [ ] Alle 6 Autos fahren sich spürbar unterschiedlich, Messwerte liegen im Rahmen von Abschnitt 4 (dokumentiert in `docs/AUTOS.md`)
- [ ] Alle 3 Strecken sind komplett befahrbar, ohne Steckenbleiben, Durchfallen oder Kamera-Clipping
- [ ] 60 FPS Desktop, mindestens 30 FPS bei 4× CPU-Drosselung (Messwerte in `docs/PERFORMANCE.md`)
- [ ] Kein Speicheranstieg bei wiederholtem Streckenwechsel

### Phase 4: Wertung und Tandem-Battle gegen Bots
Wertungslogik und Parameter, Rollentausch, Lauf- und Battle-Format, Wiederholungslauf bei Gleichstand, 5 Bot-Stufen, Gegner-Pool, HUD, Ergebnisbildschirm, Belohnungen, Freischaltungen.
- [ ] Wertung ist deterministisch und durch Unit-Tests abgedeckt
- [ ] Bot-Simulation: alle Stufen beenden alle Strecken und liegen im Ziel-Punktebereich
- [ ] Ein Battle (Schnell und Best of 3) läuft komplett durch, inklusive Gleichstand
- [ ] Belohnung und Freischaltungen werden korrekt gebucht

### Phase 5: Garage und Individualisierung
Showroom, Lack, Muster, Aufkleber-Editor mit Zonen-Atlas, Felgen, Bodykit, Fahrwerk-Optik, Neon, Qualm, Kennzeichen, Leistungs-Tuning, Setup- und Look-Slots, Look-Code, Fotomodus.
- [ ] Jede Änderung ist live am 3D-Auto sichtbar
- [ ] Aufkleber-Editor mit mindestens 30 Ebenen, Rückgängig/Wiederholen stabil
- [ ] Look-Code Export/Import fehlerfrei, ungültige Codes werden abgelehnt
- [ ] Gespeicherte Looks erscheinen im Rennen exakt wie in der Garage
- [ ] Alle 6 Autos nehmen alle Teilearten korrekt an (Ankerpunkte stimmen)

### Phase 6: Währung, Shop, Fortschritt
Münzsystem, Preise, Shop-UI, Anprobe, Kauf, Verkauf, Tagesaufgaben, Ökonomie-Tabelle, Tutorial.
- [ ] Kauf, Verkauf und Anprobe funktionieren ohne Fehlbuchungen (Tests)
- [ ] `docs/OEKONOMIE.md` belegt die Balance-Ziele aus Abschnitt 9
- [ ] Keine Möglichkeit, Währung durch Fehler oder Kreisläufe zu vervielfachen
- [ ] Tutorial führt einen Neuling zum ersten Drift

### Phase 7: Online-Duell per Einladungscode
Server, Lobby, Codes, Look-Sync, Zeitsynchronisation, Interpolation, serverseitige Wertung und Belohnung, Wiederverbindung, Absicherung, Rate-Limits.
- [ ] Zwei Browser-Fenster können per Code ein komplettes Duell spielen
- [ ] Gegnerauto wird flüssig und mit korrektem Look angezeigt, auch bei 200 ms Latenz und 5 % Paketverlust
- [ ] Abbruch, Wiederverbindung, ungültige und abgelaufene Codes funktionieren sauber
- [ ] Fuzz- und Rate-Limit-Tests bringen den Server nicht zum Absturz
- [ ] Belohnung nur nach regulärem Ende, Tageslimits greifen

### Phase 8: VFX, Audio, UI-Politur
Alle Effekte aus Abschnitt 12, prozedurales Audio, Einstellungen, Barrierefreiheit, Übergänge, Fotomodus-Feinschliff, Layout-Editor.
- [ ] Effekte skalieren mit der Qualitätsstufe, Performance-Ziele bleiben erreicht
- [ ] Audio reagiert glaubhaft auf Drehzahl, Last und Schlupf, jedes Auto klingt anders
- [ ] Alle Bildschirme sind in allen Seitenverhältnissen sauber (Handy hoch/quer, iPad, Desktop)
- [ ] Farbenblind-Modus und reduzierte Effekte funktionieren

### Phase 9: Abschluss und Deploy
Gesamttest, Fehlerbereinigung, README, Render-Anleitung, manuelle Test-Checkliste, Abschlussbericht.
- [ ] Alle automatisierten Tests grün
- [ ] Kompletter Durchlauf als neuer Spieler: Tutorial, erstes Battle, Kauf, Garage, Look im Rennen, Online-Duell
- [ ] README (Start, Steuerung, Tests, Deploy auf Render) vollständig
- [ ] `docs/ENTSCHEIDUNGEN.md`, `docs/FORTSCHRITT.md`, `docs/TESTPLAN_MANUELL.md`, `docs/LIZENZEN.md` vollständig

---

## 17. Dokumentation und Qualitätsregeln

**Dokumente (alle auf Deutsch):** `README.md`, `docs/ENTSCHEIDUNGEN.md`, `docs/FORTSCHRITT.md`, `docs/AUTOS.md`, `docs/WERTUNG.md`, `docs/OEKONOMIE.md`, `docs/LIVERY.md`, `docs/NETZWERK.md`, `docs/PERFORMANCE.md`, `docs/TESTPLAN_MANUELL.md`, `docs/LIZENZEN.md`.

**Regeln:**
- Sauberer, kommentierter, modularer Code. Magic Numbers stehen in Konfigurationsdateien.
- Fehlerbehandlung überall, wo Daten von außen kommen (Save-Daten, Codes, Netzwerkpakete, Eingaben).
- Keine toten Menüpunkte, keine „kommt später"-Buttons. Was sichtbar ist, funktioniert.
- Keine Werbung, keine Tracker, keine externen Anfragen außer dem eigenen Server.
- Abhängigkeiten sparsam halten, Lizenzen prüfen und dokumentieren.

---

## 18. Abschlussbericht

Wenn alle Phasen erledigt sind, liefere einen kurzen Bericht: Was wurde gebaut, wie startet man es, wie deployt man es auf Render, welche Entscheidungen wurden getroffen (Verweis auf `docs/ENTSCHEIDUNGEN.md`), welche Messwerte (FPS, Netzwerk) wurden erreicht, was ich auf echten Geräten prüfen soll, und welche zwei bis drei Erweiterungen sich als Nächstes am meisten lohnen würden.

**Beginne jetzt mit Phase 1.**
