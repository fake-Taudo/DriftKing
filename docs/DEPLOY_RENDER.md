# DRIFTKÖNIG auf Render veröffentlichen

DRIFTKÖNIG läuft auf Render als **ein Web Service**: Der Node-Server (`server/index.js`) liefert
das gebaute Spiel aus (`dist/`) und stellt auf demselben Port den WebSocket für Online-Duelle
bereit (`/ws`). Es gibt keine Datenbank und keine geheimen Schlüssel – Spielstände liegen im Browser
der Spieler, Lobbys nur im Arbeitsspeicher des Servers.

Die Konfiguration steht in `render.yaml` (Render-„Blueprint“):

| Einstellung | Wert | Bedeutung |
|---|---|---|
| Typ | Web Service, Runtime Node | HTTP + WebSocket auf einem Port |
| Plan | Free | kostenlos (Einschränkungen siehe unten) |
| Region | Frankfurt | kurze Wege für Spieler in Deutschland/Europa |
| Build | `npm ci && npm run build` | installiert exakt die Versionen aus `package-lock.json`, baut `dist/` |
| Start | `npm start` | startet `node server/index.js` auf dem von Render vorgegebenen `PORT` |
| Health-Check | `/healthz` | Render prüft damit, ob der Server läuft |
| Node-Version | 22 (Umgebungsvariable `NODE_VERSION`) | |
| Auto-Deploy | an | jeder Push auf `main` wird automatisch veröffentlicht |

## Einmalig einrichten (Blueprint, empfohlen)

1. Bei <https://render.com> anmelden (kostenloses Konto; Anmeldung mit GitHub ist am einfachsten).
2. Im Dashboard oben rechts **New → Blueprint** wählen.
3. Beim ersten Mal **GitHub verbinden** und Render den Zugriff auf das Repository
   `fake-Taudo/DriftKing` erlauben (es reicht, nur dieses eine Repository freizugeben).
4. Das Repository `DriftKing` auswählen. Render findet die Datei `render.yaml` und zeigt den
   Dienst **driftkoenig** an.
5. Einen Namen für die Blueprint-Gruppe vergeben (z. B. „DRIFTKÖNIG“) und auf
   **Apply** (bzw. **Deploy Blueprint**) klicken.
6. Der erste Build dauert einige Minuten. Im Reiter **Logs** erscheint am Ende
   `DRIFTKÖNIG-Server läuft auf http://0.0.0.0:10000 (WebSocket unter /ws)`.
7. Die Adresse steht oben im Dienst, z. B. `https://driftkoenig.onrender.com` (ist der Name schon
   vergeben, hängt Render eine Kennung an, z. B. `https://driftkoenig-ab12.onrender.com`).

### Alternative: Web Service von Hand anlegen

**New → Web Service** → Repository `DriftKing` wählen und eintragen:
Branch `main`, Region **Frankfurt**, Runtime **Node**, Build Command `npm ci && npm run build`,
Start Command `npm start`, Instance Type **Free**. Unter **Advanced**: Health Check Path `/healthz`,
Umgebungsvariable `NODE_VERSION` = `22`. Dann **Create Web Service**.

## Nach dem Deploy prüfen

1. `https://<deine-adresse>/healthz` öffnen → Antwort wie `{"ok":true,"laufzeit":…,"verbindungen":0}`.
2. `https://<deine-adresse>/` öffnen → Ladebildschirm, danach das Hauptmenü.
3. `https://<deine-adresse>/?test=eingabe` öffnen und auf **Server-Echo** tippen → „WebSocket-Echo
   erfolgreich (… ms)“. Damit ist die WebSocket-Verbindung über `wss://` bestätigt.
4. Auf dem Handy dieselbe Adresse öffnen (HTTPS ist bei Render automatisch aktiv; das braucht
   z. B. die Neigungssteuerung und die Installation als App).

## Updates veröffentlichen

Einfach Änderungen auf `main` pushen (`git push`). Render baut und startet automatisch neu; der alte
Stand bleibt online, bis der neue den Health-Check besteht. Im Reiter **Events** sieht man jeden
Deploy, mit **Manual Deploy → Deploy latest commit** lässt sich ein Deploy von Hand anstoßen, mit
**Rollback** ein früherer Stand zurückholen.

## Was der kostenlose Plan bedeutet

- **Einschlafen:** Nach ca. 15 Minuten ohne Aufrufe wird der Dienst angehalten. Der nächste Aufruf
  weckt ihn; das dauert bis zu etwa einer Minute. Das Spiel selbst ist nach dem ersten Laden als
  App zwischengespeichert (Service Worker) und läuft offline weiter; nur Online-Duelle brauchen den
  wachen Server.
- **Neustart = Lobbys weg:** Bei jedem Deploy oder Aufwachen sind offene Lobbys und Einladungscodes
  verloren (sie liegen nur im Arbeitsspeicher). Spielstände sind nicht betroffen, sie liegen im
  Browser.
- **Freistunden:** Render gewährt im Free-Plan ein monatliches Kontingent an Laufzeit-Stunden je
  Konto; ein einzelner Dienst kommt damit normalerweise aus. Für ein dauerhaft waches Spiel ohne
  Kaltstart den Instanztyp auf **Starter** (kostenpflichtig) umstellen – sonst ist nichts zu ändern.

## Fehlersuche

| Problem | Ursache und Lösung |
|---|---|
| Build bricht bei `npm ci` ab („lock file … not in sync“) | `package.json` und `package-lock.json` passen nicht zusammen. Lokal `npm install` ausführen, `package-lock.json` committen und pushen. |
| Build bricht bei `vite build` ab | Fehler im Code. Lokal `npm run build` ausführen, beheben, pushen. |
| Deploy hängt bei „In progress“ und schlägt dann fehl | Health-Check scheitert. In den **Logs** nach Fehlern beim Start suchen; lokal mit `npm run build` und `npm start` nachstellen. Der Server muss auf `process.env.PORT` lauschen (ist so eingebaut). |
| Seite lädt, aber Online-Duell verbindet nicht | Prüfen, ob die Seite über `https://` geöffnet ist und ob `?test=eingabe` → „Server-Echo“ funktioniert. Nach dem Aufwachen ein paar Sekunden warten. |
| Alte Version wird angezeigt | Der Service Worker liefert den Zwischenspeicher. Das Spiel meldet „Neue Version verfügbar – neu laden“; antippen oder die Seite zweimal neu laden. |
| Region ändern | Die Region eines bestehenden Dienstes lässt sich nicht ändern: neuen Dienst anlegen, alten löschen. |

## Produktionsstand lokal testen

```bash
npm ci
npm run build
npm start
```

Dann `http://localhost:3000` und `http://localhost:3000/healthz` öffnen. Mit `PORT=8080 npm start`
läuft der Server auf einem anderen Port (unter Windows/PowerShell: `$env:PORT=8080; npm start`).
