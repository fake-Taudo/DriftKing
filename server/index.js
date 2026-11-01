// Einstiegspunkt des Servers: HTTP (Express) und WebSocket auf demselben Port.
import http from 'node:http';
import { erzeugeApp } from './app.js';
import { starteSpielServer } from './spielServer.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

let spielServer = null;
const app = erzeugeApp({ statusInfo: () => (spielServer ? spielServer.status() : {}) });
const server = http.createServer(app);
spielServer = starteSpielServer(server);

server.listen(PORT, HOST, () => {
  console.log(`DRIFTKÖNIG-Server läuft auf http://${HOST}:${PORT} (WebSocket unter /ws)`);
});

// Der Server darf nie durch einen einzelnen Fehler abstürzen: protokollieren und weiterlaufen.
process.on('uncaughtException', (e) => {
  console.error('[Unbehandelter Fehler]', e);
});
process.on('unhandledRejection', (e) => {
  console.error('[Unbehandelte Promise-Ablehnung]', e);
});

function herunterfahren() {
  console.log('Server wird beendet …');
  spielServer.beenden();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', herunterfahren);
process.on('SIGINT', herunterfahren);
