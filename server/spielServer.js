// WebSocket-Spielserver: Verbindungen, Heartbeat, Zeitabgleich, Rate-Limits und strenge Prüfung jeder Nachricht.
// Lobbys und Duelle stehen in lobbys.js und match.js. Der Server darf durch fehlerhafte oder bösartige Pakete
// unter keinen Umständen abstürzen: Jede Verarbeitung ist abgesichert.
import { WebSocketServer } from 'ws';
import { LobbyVerwaltung } from './lobbys.js';
import { pruefeNachricht, BEITRITTE_PRO_MINUTE, MAX_NACHRICHT_BYTES, MAX_NACHRICHTEN_PRO_SEKUNDE, MAX_VERSTOESSE_RATE, PROTOKOLL_VERSION } from '../shared/netzwerkSchema.js';
import { pruefeName } from '../shared/wortfilter.js';
import { codeZuLook } from '../shared/look.js';
import { AUFKLEBER_IDS } from '../client/assets/aufkleber.js';

export { MAX_NACHRICHT_BYTES };
export const HEARTBEAT_MS = 25_000;
const TICK_MS = 50;
const IP_MERKER_MS = 60_000;

/**
 * @param {import('node:http').Server} httpServer
 * @param {{jetzt?:()=>number, codeGueltigMs?:number, wiederverbindenMs?:number, inaktivMs?:number, maxProSekunde?:number, beitritteProMinute?:number, tick?:boolean}} [optionen]
 */
export function starteSpielServer(httpServer, optionen = {}) {
  const jetzt = optionen.jetzt || (() => Date.now());
  const maxProSekunde = optionen.maxProSekunde ?? MAX_NACHRICHTEN_PRO_SEKUNDE;
  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: MAX_NACHRICHT_BYTES });
  const lobbys = new LobbyVerwaltung({
    jetzt,
    senden,
    codeGueltigMs: optionen.codeGueltigMs,
    wiederverbindenMs: optionen.wiederverbindenMs,
    inaktivMs: optionen.inaktivMs,
    afkMs: optionen.afkMs
  });
  const beitritteProIp = new Map();
  let naechsteId = 1;

  /** Beitrittsversuche: höchstens 5 pro Minute je Verbindung und je IP. */
  function beitrittErlaubt(ws) {
    const t = jetzt();
    const pruefen = (liste) => {
      while (liste.length && t - liste[0] > IP_MERKER_MS) liste.shift();
      return liste.length < (optionen.beitritteProMinute ?? BEITRITTE_PRO_MINUTE);
    };
    let ip = beitritteProIp.get(ws.ip);
    if (!ip) {
      ip = [];
      beitritteProIp.set(ws.ip, ip);
    }
    ws.beitritte ||= [];
    if (!pruefen(ws.beitritte) || !pruefen(ip)) return false;
    ws.beitritte.push(t);
    ip.push(t);
    return true;
  }

  /** Nachrichten pro Sekunde je Verbindung; wer dauerhaft flutet, wird getrennt. */
  function rateErlaubt(ws) {
    const t = jetzt();
    if (t - ws.fensterStart >= 1000) {
      ws.fensterStart = t;
      ws.fensterAnzahl = 0;
    }
    if (t - ws.verstossStart >= 10000) {
      ws.verstossStart = t;
      ws.verstoesse = 0;
    }
    ws.fensterAnzahl++;
    if (ws.fensterAnzahl <= maxProSekunde) return true;
    if (++ws.verstoesse > MAX_VERSTOESSE_RATE) {
      fehler(ws, 'zu_viele_nachrichten');
      ws.close(4008, 'rate');
    }
    return false;
  }

  async function hallo(ws, n) {
    const nameFehler = pruefeName(n.name);
    if (nameFehler) return fehler(ws, nameFehler);
    const look = await codeZuLook(n.look, { aufkleberIds: AUFKLEBER_IDS, autoId: n.autoId });
    if (!look.ok) return fehler(ws, 'look_ungueltig');
    ws.profil = {
      clientId: n.clientId,
      name: n.name.trim(),
      autoId: n.autoId,
      look: n.look,
      tuning: n.tuning,
      strecken: n.strecken.includes('industriehof') ? n.strecken : ['industriehof', ...n.strecken]
    };
    senden(ws, { t: 'willkommen', id: ws.id, v: PROTOKOLL_VERSION, s: jetzt() });
    return undefined;
  }

  function verarbeiten(ws, n) {
    switch (n.t) {
      case 'ping':
        return senden(ws, { t: 'pong', c: n.c, s: jetzt() });
      case 'echo':
        return senden(ws, { t: 'echo', d: typeof n.d === 'string' ? n.d.slice(0, 200) : '' });
      case 'hallo':
        return hallo(ws, n);
      case 'wiederverbinden': {
        const f = lobbys.wiederverbinden(ws, n.token);
        return f ? fehler(ws, f) : undefined;
      }
      default:
    }
    if (!ws.profil) return fehler(ws, 'kein_hallo');
    switch (n.t) {
      case 'duellErstellen':
        return lobbys.erstellen(ws);
      case 'beitreten': {
        if (!beitrittErlaubt(ws)) return fehler(ws, 'zu_viele_versuche');
        const f = lobbys.beitreten(ws, n.code);
        return f ? fehler(ws, f) : undefined;
      }
      case 'einstellungen': {
        const f = lobbys.einstellungen(ws, n);
        return f ? fehler(ws, f) : undefined;
      }
      case 'bereit': {
        const f = lobbys.bereit(ws, n.an);
        return f ? fehler(ws, f) : undefined;
      }
      case 'zustand':
        return lobbys.zustand(ws, n.d);
      case 'emote':
        return lobbys.emote(ws, n.id);
      case 'aufgeben':
        return lobbys.aufgeben(ws);
      case 'verlassen':
        return lobbys.verlassen(ws);
      default:
        return fehler(ws, 'unbekannt');
    }
  }

  wss.on('connection', (ws, req) => {
    ws.id = naechsteId++;
    ws.lebt = true;
    ws.ip = String(req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '?').split(',')[0].trim();
    ws.fensterStart = jetzt();
    ws.fensterAnzahl = 0;
    ws.verstossStart = jetzt();
    ws.verstoesse = 0;
    ws.on('pong', () => { ws.lebt = true; });
    ws.on('error', () => { /* Verbindungsfehler und zu große Pakete: Schließen folgt automatisch */ });
    ws.on('close', () => {
      try {
        lobbys.verbindungWeg(ws);
      } catch (e) {
        console.error('[Server] Fehler beim Trennen', e);
      }
    });
    ws.on('message', (roh, istBinaer) => {
      ws.lebt = true;
      if (!rateErlaubt(ws)) return;
      if (istBinaer || roh.length > MAX_NACHRICHT_BYTES) return;
      let n;
      try {
        n = JSON.parse(roh.toString('utf8'));
      } catch {
        return fehler(ws, 'format');
      }
      const f = pruefeNachricht(n);
      if (f) return fehler(ws, f);
      // Auch ein Programmierfehler in der Verarbeitung darf den Server nicht stoppen
      Promise.resolve().then(() => verarbeiten(ws, n)).catch((e) => {
        console.error('[Server] Fehler bei', n.t, e);
        fehler(ws, 'intern');
      });
    });
  });

  // Takt für Duelle und Aufräumen
  const takt = optionen.tick === false ? null : setInterval(() => {
    try {
      lobbys.tick();
    } catch (e) {
      console.error('[Server] Fehler im Takt', e);
    }
  }, TICK_MS);
  takt?.unref?.();

  // Merker für Beitritte aufräumen
  const putzen = setInterval(() => {
    const t = jetzt();
    for (const [ip, liste] of beitritteProIp) {
      while (liste.length && t - liste[0] > IP_MERKER_MS) liste.shift();
      if (!liste.length) beitritteProIp.delete(ip);
    }
  }, IP_MERKER_MS);
  putzen.unref?.();

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
    lobbys,
    status: () => ({ verbindungen: wss.clients.size, lobbys: lobbys.anzahl }),
    beenden() {
      clearInterval(herzschlag);
      clearInterval(putzen);
      if (takt) clearInterval(takt);
      lobbys.beenden();
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    }
  };
}

function senden(ws, nachricht) {
  if (ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(nachricht));
    } catch { /* Verbindung bereits weg */ }
  }
}

function fehler(ws, code) {
  senden(ws, { t: 'fehler', code });
}
