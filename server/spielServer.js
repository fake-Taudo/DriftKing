// WebSocket-Spielserver (Phase 1: Verbindung, Heartbeat, Ping/Pong, Test-Echo).
// Lobbys, Einladungscodes und Match-Ablauf werden in Phase 7 ergänzt (lobbys.js, match.js).
import { WebSocketServer } from 'ws';

export const MAX_NACHRICHT_BYTES = 16 * 1024;
export const HEARTBEAT_MS = 25_000;

export function starteSpielServer(httpServer, optionen = {}) {
  const jetzt = optionen.jetzt || (() => Date.now());
  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: MAX_NACHRICHT_BYTES });
  let naechsteId = 1;

  wss.on('connection', (ws) => {
    ws.id = naechsteId++;
    ws.lebt = true;
    ws.on('pong', () => { ws.lebt = true; });
    ws.on('error', () => { /* Verbindungsfehler: Schließen folgt automatisch */ });
    ws.on('message', (roh, istBinaer) => {
      ws.lebt = true;
      if (istBinaer || roh.length > MAX_NACHRICHT_BYTES) return;
      let n;
      try {
        n = JSON.parse(roh.toString('utf8'));
      } catch {
        return senden(ws, { t: 'fehler', code: 'format' });
      }
      if (!n || typeof n !== 'object' || typeof n.t !== 'string') return senden(ws, { t: 'fehler', code: 'format' });
      switch (n.t) {
        case 'ping':
          return senden(ws, { t: 'pong', c: typeof n.c === 'number' ? n.c : 0, s: jetzt() });
        case 'echo':
          return senden(ws, { t: 'echo', d: typeof n.d === 'string' ? n.d.slice(0, 200) : '' });
        default:
          return senden(ws, { t: 'fehler', code: 'unbekannt' });
      }
    });
  });

  // Heartbeat: tote Verbindungen erkennen, Proxys wach halten
  const herzschlag = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.lebt) { ws.terminate(); continue; }
      ws.lebt = false;
      try { ws.ping(); } catch { /* ignorieren */ }
    }
  }, HEARTBEAT_MS);
  herzschlag.unref?.();

  return {
    wss,
    status: () => ({ verbindungen: wss.clients.size }),
    beenden() {
      clearInterval(herzschlag);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    }
  };
}

function senden(ws, nachricht) {
  if (ws.readyState === 1) {
    try { ws.send(JSON.stringify(nachricht)); } catch { /* Verbindung bereits weg */ }
  }
}
