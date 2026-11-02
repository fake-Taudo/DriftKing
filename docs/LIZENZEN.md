# Lizenzen

Alle Inhalte des Spiels (Autos, Strecken, Teile, Aufkleber, Muster, Icons, Sounds, Texte) sind **selbst erfunden und selbst erzeugt**. Es werden keine echten Automarken, Modelle, Logos, Strecken oder Assets anderer Spiele verwendet. Audio wird zur Laufzeit prozedural per WebAudio erzeugt; es gibt keine Musik- oder Sounddateien.

## Abhängigkeiten (npm)

| Paket | Version | Lizenz | Zweck |
|---|---|---|---|
| three | 0.187.0 | MIT | 3D-Darstellung (WebGL) |
| vite | 8.3.5 | MIT | Bündeln des Clients |
| express | 5.3.0 | MIT | HTTP-Server |
| ws | 8.22.1 | MIT | WebSocket-Server |
| playwright-core | 1.64.1 | Apache-2.0 | Nur Entwicklung: Abläufe im Browser in `scripts/`, nicht Teil des Spiels |

## Schriften (lokal eingebunden über @fontsource, keine Anfragen an Dritte)

| Schrift | Paket | Lizenz | Verwendung |
|---|---|---|---|
| Lilita One | @fontsource/lilita-one 5.3.0 | SIL Open Font License 1.1 | Überschriften, Knöpfe, Text-Aufkleber |
| Rajdhani | @fontsource/rajdhani 5.3.0 | SIL Open Font License 1.1 | Fließtext der Oberfläche |
| Orbitron | @fontsource/orbitron 5.3.0 | SIL Open Font License 1.1 | Zahlen (Tacho, Punkte), Text-Aufkleber |
| Bungee | @fontsource/bungee 5.3.0 | SIL Open Font License 1.1 | Text-Aufkleber |
| Russo One | @fontsource/russo-one 5.3.0 | SIL Open Font License 1.1 | Text-Aufkleber |
| Audiowide | @fontsource/audiowide 5.3.0 | SIL Open Font License 1.1 | Text-Aufkleber |
| Teko | @fontsource/teko 5.3.0 | SIL Open Font License 1.1 | Text-Aufkleber |

Die SIL Open Font License erlaubt die Nutzung, Einbettung und Weitergabe der Schriften in Software; die Schriften selbst dürfen nicht einzeln verkauft werden. Die Lizenztexte liegen in den jeweiligen Paketen unter `node_modules/@fontsource/*/LICENSE`.

## Eigene Inhalte

- App-Icons (`client/public/icons/`): selbst gestaltet, erzeugt mit `scripts/icons.js`.
- Aufkleber (`client/assets/aufkleber.js`): selbst gezeichnete SVG-Pfade.
- Autos, Anbauteile, Felgen, Strecken: prozedural im Code erzeugt.
- Klang und Musik (`client/audio/`): zur Laufzeit per WebAudio erzeugt, es gibt keine Audiodateien.
- Effekte (`client/render/vfx/`): eigene Shader, keine Texturen von Dritten.
- Erfundene „Sponsoren“: Fantasienamen und -logos ohne Ähnlichkeit zu echten Marken.
