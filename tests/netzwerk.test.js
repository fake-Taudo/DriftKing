// Online-Server mit echten WebSockets: Lobby, Codes, Rollen, Look-Sync, Wiederverbindung, Aufräumen,
// Fuzz- und Rate-Limit-Tests. Der Server darf durch nichts abstürzen.
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { erzeugeApp } from '../server/app.js';
import { starteSpielServer } from '../server/spielServer.js';
import { lookZuCode, standardLook } from '../shared/look.js';
import { pruefeNachricht, CLIENT_NACHRICHTEN, CODE_ALPHABET, CODE_LAENGE, PROTOKOLL_VERSION, FLAG, codeNormalisieren } from '../shared/netzwerkSchema.js';
import { Zufall } from '../shared/zufall.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { streckenDef } from '../shared/strecken/index.js';

const KURZ = { codeGueltigMs: 400, wiederverbindenMs: 300, inaktivMs: 500 };
const offene = [];

async function serverStarten(optionen = {}) {
  let sp;
  const app = erzeugeApp({ statusInfo: () => sp.status() });
  const server = http.createServer(app);
  sp = starteSpielServer(server, optionen);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return { port, sp, schliessen: async () => { sp.beenden(); await new Promise((r) => server.close(r)); } };
}

class Client {
  constructor(port) {
    this.port = port;
    this.alle = [];
    this.warter = [];
  }

  verbinden() {
    return new Promise((aufloesen, ablehnen) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.port}/ws`);
      this.offen = true;
      offene.push(this);
      this.ws.on('message', (roh, binaer) => {
        if (binaer) return;
        const n = JSON.parse(roh.toString());
        this.alle.push(n);
        for (const w of [...this.warter]) {
          if (w.typ === n.t && w.bed(n)) {
            this.warter.splice(this.warter.indexOf(w), 1);
            clearTimeout(w.zeit);
            w.ok(n);
          }
        }
      });
      this.ws.on('close', (code) => { this.offen = false; this.schlussCode = code; });
      this.ws.on('error', () => {});
      this.ws.once('open', () => aufloesen(this));
      setTimeout(() => ablehnen(new Error('Verbindung dauert zu lange')), 3000).unref();
    });
  }

  senden(n) {
    this.ws.send(typeof n === 'string' || Buffer.isBuffer(n) ? n : JSON.stringify(n));
  }

  /** Wartet auf eine Nachricht; schon empfangene zählen, solange `seit` nicht weiter ist. */
  warte(typ, bed = () => true, ms = 2500) {
    const schon = this.alle.find((n) => n.t === typ && !n._gesehen && bed(n));
    if (schon) {
      schon._gesehen = true;
      return Promise.resolve(schon);
    }
    return new Promise((ok, nein) => {
      const zeit = setTimeout(() => nein(new Error(`Keine Nachricht ${typ}, zuletzt: ${JSON.stringify(this.alle.slice(-3))}`)), ms);
      const w = { typ, bed, ok: (n) => { n._gesehen = true; ok(n); }, zeit };
      this.warter.push(w);
    });
  }

  schliessen() {
    try { this.ws.terminate(); } catch { /* egal */ }
    this.offen = false;
  }
}

let basisLook;
let code;
const halloDaten = async (name = 'Fahrer', o = {}) => ({
  t: 'hallo', v: PROTOKOLL_VERSION, clientId: (name.toLowerCase().replace(/[^a-z]/g, '') + 'abcdefghijklmnop').slice(0, 16) + (o.id ?? '0'),
  name, autoId: 'kestrel_s', look: basisLook, tuning: { motor: 2 }, strecken: ['industriehof', 'kuestenpass'], ...o.felder
});
async function angemeldet(port, name = 'Fahrer', o = {}) {
  const c = await new Client(port).verbinden();
  c.senden(await halloDaten(name, o));
  await c.warte('willkommen');
  return c;
}
async function lobbyPaar(port, namen = ['Anna', 'Bert']) {
  const a = await angemeldet(port, namen[0]);
  const b = await angemeldet(port, namen[1]);
  a.senden({ t: 'duellErstellen' });
  const e = await a.warte('duellErstellt');
  b.senden({ t: 'beitreten', code: e.code });
  const be = await b.warte('beigetreten');
  return { a, b, code: e.code, tokenA: e.token, tokenB: be.token };
}

let s;
before(async () => {
  basisLook = await lookZuCode(standardLook('kestrel_s'));
  s = await serverStarten({ beitritteProMinute: 1000 }); // Alle Tests kommen von derselben IP
  code = null;
  void code;
});
after(async () => { await s.schliessen(); });
afterEach(() => {
  for (const c of offene.splice(0)) c.schliessen();
});

test('Ohne gültiges „hallo“ geht nichts; Name, Look und Version werden geprüft', async () => {
  const c = await new Client(s.port).verbinden();
  c.senden({ t: 'duellErstellen' });
  assert.equal((await c.warte('fehler')).code, 'kein_hallo');
  c.senden({ ...(await halloDaten('Fahrer')), name: 'Arschloch' });
  assert.equal((await c.warte('fehler')).code, 'name_anstoessig');
  c.senden({ ...(await halloDaten('Fahrer')), look: 'kaputt' });
  assert.equal((await c.warte('fehler')).code, 'look_ungueltig');
  c.senden({ ...(await halloDaten('Fahrer')), autoId: 'onyx_rs' });
  assert.equal((await c.warte('fehler')).code, 'look_ungueltig', 'Look eines anderen Autos');
  c.senden({ ...(await halloDaten('Fahrer')), v: 999 });
  assert.equal((await c.warte('fehler')).code, 'felder');
  c.senden(await halloDaten('Fahrer'));
  await c.warte('willkommen');
});

test('Code: 6 Zeichen aus dem Alphabet ohne Verwechslungsgefahr, klein geschrieben geht auch', async () => {
  const a = await angemeldet(s.port, 'Anna');
  a.senden({ t: 'duellErstellen' });
  const e = await a.warte('duellErstellt');
  assert.equal(e.code.length, CODE_LAENGE);
  for (const z of e.code) assert.ok(CODE_ALPHABET.includes(z));
  for (const z of '01IO') assert.ok(!CODE_ALPHABET.includes(z));
  assert.ok(e.gueltigBis > Date.now() + 9 * 60 * 1000);
  const b = await angemeldet(s.port, 'Bert');
  b.senden({ t: 'beitreten', code: ` ${e.code.toLowerCase()} ` });
  await b.warte('beigetreten');
  assert.equal(codeNormalisieren('abc'), null);
  assert.equal(codeNormalisieren('ABC10I'), null);
});

test('Ungültige, benutzte und eigene Codes werden mit klarer Meldung abgelehnt', async () => {
  const { code: c1 } = await lobbyPaar(s.port);
  const x = await angemeldet(s.port, 'Xaver');
  x.senden({ t: 'beitreten', code: 'ZZZZZZ' });
  assert.equal((await x.warte('fehler')).code, 'code_ungueltig');
  x.senden({ t: 'beitreten', code: 'kurz' });
  assert.equal((await x.warte('fehler')).code, 'code_ungueltig');
  x.senden({ t: 'beitreten', code: c1 });
  assert.equal((await x.warte('fehler')).code, 'code_benutzt', 'Code ist nur einmal nutzbar');
  const y = await angemeldet(s.port, 'Yara');
  y.senden({ t: 'duellErstellen' });
  const e = await y.warte('duellErstellt');
  y.senden({ t: 'beitreten', code: e.code });
  assert.equal((await y.warte('fehler')).code, 'eigenes_duell');
});

test('Abgelaufene Codes und inaktive Lobbys werden aufgeräumt', async () => {
  const k = await serverStarten({ ...KURZ, beitritteProMinute: 1000 });
  try {
    const a = await angemeldet(k.port, 'Anna');
    a.senden({ t: 'duellErstellen' });
    const e = await a.warte('duellErstellt');
    const b = await angemeldet(k.port, 'Bert');
    assert.equal(k.sp.lobbys.anzahl, 1);
    assert.equal((await a.warte('lobbyEnde', () => true, 2000)).grund, 'code_abgelaufen');
    assert.equal(k.sp.lobbys.anzahl, 0, 'keine Speicherlecks');
    b.senden({ t: 'beitreten', code: e.code });
    assert.equal((await b.warte('fehler')).code, 'code_abgelaufen');
    // Inaktive Lobby mit zwei Spielern
    const p = await lobbyPaar(k.port);
    assert.equal(k.sp.lobbys.anzahl, 1);
    assert.equal((await p.a.warte('lobbyEnde', () => true, 2000)).grund, 'inaktiv');
    assert.equal(k.sp.lobbys.anzahl, 0);
  } finally {
    await k.schliessen();
  }
});

test('Beitrittsversuche sind begrenzt (5 pro Minute je Verbindung und IP)', async () => {
  const k = await serverStarten();
  try {
    const c = await angemeldet(k.port, 'Rate');
    for (let i = 0; i < 5; i++) {
      c.senden({ t: 'beitreten', code: 'ZZZZZZ' });
      assert.equal((await c.warte('fehler')).code, 'code_ungueltig');
    }
    c.senden({ t: 'beitreten', code: 'ZZZZZZ' });
    assert.equal((await c.warte('fehler')).code, 'zu_viele_versuche');
    // Auch eine neue Verbindung von derselben IP hilft nicht
    const d = await angemeldet(k.port, 'Rate');
    d.senden({ t: 'beitreten', code: 'ZZZZZZ' });
    assert.equal((await d.warte('fehler')).code, 'zu_viele_versuche');
  } finally {
    await k.schliessen();
  }
});

test('Lobby: beide sehen sich samt Look und PI; nur der Gastgeber stellt ein; gemeinsame Strecken', async () => {
  const a = await angemeldet(s.port, 'Anna');
  const b = await new Client(s.port).verbinden();
  b.senden({ ...(await halloDaten('Bert')), strecken: ['industriehof'] });
  await b.warte('willkommen');
  a.senden({ t: 'duellErstellen' });
  const e = await a.warte('duellErstellt');
  b.senden({ t: 'beitreten', code: e.code });
  const st = await b.warte('lobbyStatus', (n) => n.B !== null);
  assert.equal(st.seite, 'B');
  assert.equal(st.A.name, 'Anna');
  assert.equal(st.A.look, basisLook, 'Look-Sync');
  assert.ok(st.A.pi >= 100);
  assert.deepEqual(st.strecken, ['industriehof'], 'nur Strecken, die beide freigeschaltet haben');
  assert.equal(st.streckeId, 'industriehof');
  b.senden({ t: 'einstellungen', format: 'schnell' });
  assert.equal((await b.warte('fehler')).code, 'nur_gastgeber');
  a.senden({ t: 'einstellungen', streckeId: 'kuestenpass' });
  assert.equal((await a.warte('fehler')).code, 'strecke_gesperrt');
  a.senden({ t: 'einstellungen', format: 'schnell', einheit: true });
  const n = await b.warte('lobbyStatus', (x) => x.format === 'schnell' && x.einheit === true);
  assert.ok(n.einheitsPI >= 100);
});

test('Bereit: Beide bestätigen, dann startet das Duell mit fester Rollenverteilung', async () => {
  const { a, b } = await lobbyPaar(s.port);
  a.senden({ t: 'einstellungen', format: 'schnell' });
  await a.warte('lobbyStatus', (x) => x.format === 'schnell');
  a.senden({ t: 'bereit', an: true });
  await b.warte('lobbyStatus', (x) => x.A.bereit === true);
  // Geänderte Einstellungen setzen „bereit“ zurück
  a.senden({ t: 'einstellungen', einheit: true });
  await b.warte('lobbyStatus', (x) => x.A.bereit === false && x.einheit === true);
  a.senden({ t: 'bereit', an: true });
  b.senden({ t: 'bereit', an: true });
  const sa = await a.warte('duellStart');
  const sb = await b.warte('duellStart');
  assert.equal(sa.seite, 'A');
  assert.equal(sb.seite, 'B');
  assert.equal(sa.gegner.name, 'Bert');
  assert.equal(sa.einheitsPI, sb.einheitsPI);
  assert.ok(sa.einheitsPI >= 100);
  const ca = await a.warte('startCountdown');
  const cb = await b.warte('startCountdown');
  assert.notEqual(ca.rolle, cb.rolle);
  assert.equal(ca.startZeit, cb.startZeit, 'gemeinsamer Startzeitpunkt');
  assert.ok(ca.startZeit > Date.now());
  // Zustände werden weitergeleitet, unmögliche nicht
  const S = baueStrecke(streckenDef('industriehof'));
  const st = S.start.verfolger;
  a.senden({ t: 'zustand', d: [1, st.x, st.y, st.theta, 1, 0, 0, FLAG.GAS] });
  const g = await b.warte('gegner');
  assert.equal(g.d[0], 1);
  a.senden({ t: 'zustand', d: [2, 99999, 99999, 0, 1, 0, 0, FLAG.GAS] });
  b.senden({ t: 'emote', id: 'gg' });
  assert.equal((await a.warte('emote')).id, 'gg');
  assert.equal(b.alle.filter((n) => n.t === 'gegner').length, 1, 'Unmögliches wird nicht weitergeleitet');
  // Aufgeben: Der andere gewinnt, das Duell endet sofort
  a.senden({ t: 'aufgeben' });
  const eb = await b.warte('ergebnis');
  assert.equal(eb.sieg, true);
  assert.equal(eb.regulaer, false);
  assert.equal(eb.grund, 'aufgabe');
  assert.equal(eb.belohnung, 0, 'ohne Fahrzeit keine Belohnung');
  const ea = await a.warte('ergebnis');
  assert.equal(ea.sieg, false);
});

test('Wiederverbindung innerhalb der Frist mit einmaligem Token; danach gewinnt der andere', async () => {
  const k = await serverStarten({ wiederverbindenMs: 500 });
  try {
    const { a, b, tokenA, tokenB } = await lobbyPaar(k.port);
    a.senden({ t: 'einstellungen', format: 'schnell' });
    a.senden({ t: 'bereit', an: true });
    b.senden({ t: 'bereit', an: true });
    await a.warte('startCountdown');
    await b.warte('startCountdown');
    // A verliert die Verbindung und kommt rechtzeitig zurück
    a.schliessen();
    assert.equal((await b.warte('gegnerVerbindung', (n) => n.weg)).weg, true);
    const a2 = await new Client(k.port).verbinden();
    a2.senden({ t: 'wiederverbinden', token: 'falsch' });
    assert.equal((await a2.warte('fehler')).code, 'token_ungueltig');
    a2.senden({ t: 'wiederverbinden', token: tokenA });
    const w = await a2.warte('wiederverbunden');
    assert.equal(w.seite, 'A');
    assert.equal(w.imDuell, true);
    assert.notEqual(w.token, tokenA, 'neues Token');
    await b.warte('gegnerVerbindung', (n) => !n.weg);
    // Das alte Token gilt nicht mehr
    const a3 = await new Client(k.port).verbinden();
    a3.senden({ t: 'wiederverbinden', token: tokenA });
    assert.equal((await a3.warte('fehler')).code, 'token_ungueltig');
    // B geht und kommt nicht zurück
    void tokenB;
    b.schliessen();
    const e = await a2.warte('ergebnis', () => true, 2500);
    assert.equal(e.sieg, true);
    assert.equal(e.grund, 'verbindung');
    await a2.warte('lobbyEnde');
    assert.equal(k.sp.lobbys.anzahl, 0, 'Lobby ist aufgeräumt');
  } finally {
    await k.schliessen();
  }
});

test('Was während der Unterbrechung geschah, kommt nach der Rückkehr an (Durchgang und Ergebnis)', async () => {
  const k = await serverStarten({ wiederverbindenMs: 3000 });
  try {
    const { a, b, tokenA } = await lobbyPaar(k.port);
    a.senden({ t: 'bereit', an: true });
    b.senden({ t: 'bereit', an: true });
    const start = await a.warte('startCountdown');
    a.schliessen();
    await b.warte('gegnerVerbindung', (n) => n.weg);
    const a2 = await new Client(k.port).verbinden();
    a2.senden({ t: 'wiederverbinden', token: tokenA });
    const w = await a2.warte('wiederverbunden');
    const erneut = await a2.warte('startCountdown');
    assert.equal(erneut.dgNr, start.dgNr, 'Der laufende Durchgang wird erneut gemeldet');
    assert.equal(erneut.startZeit, start.startZeit);
    // A bricht wieder ab, B gibt in der Zwischenzeit auf: A gewinnt und erfährt es nach der Rückkehr
    a2.schliessen();
    await b.warte('gegnerVerbindung', (n) => n.weg && n.bis > 0);
    b.senden({ t: 'aufgeben' });
    assert.equal((await b.warte('ergebnis')).sieg, false);
    const a3 = await new Client(k.port).verbinden();
    a3.senden({ t: 'wiederverbinden', token: w.token });
    const w3 = await a3.warte('wiederverbunden');
    assert.equal(w3.imDuell, false);
    const e = await a3.warte('ergebnis');
    assert.equal(e.sieg, true);
    assert.equal(e.grund, 'aufgabe');
    // Das Ergebnis geht nur einmal raus
    a3.schliessen();
    const a4 = await new Client(k.port).verbinden();
    a4.senden({ t: 'wiederverbinden', token: w3.token });
    await a4.warte('wiederverbunden');
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(a4.alle.filter((n) => n.t === 'ergebnis').length, 0);
  } finally {
    await k.schliessen();
  }
});

test('Verlassen löst die Lobby auf, ohne etwas zurückzulassen', async () => {
  const k = await serverStarten();
  try {
    const { a, b } = await lobbyPaar(k.port);
    assert.equal(k.sp.lobbys.anzahl, 1);
    a.senden({ t: 'verlassen' });
    assert.equal((await b.warte('lobbyEnde')).grund, 'gegner_weg');
    assert.equal(k.sp.lobbys.anzahl, 0);
    assert.equal(k.sp.lobbys.tokens.size, 0);
    const c = await angemeldet(k.port, 'Carl');
    c.senden({ t: 'duellErstellen' });
    await c.warte('duellErstellt');
    c.senden({ t: 'duellErstellen' });
    await c.warte('duellErstellt');
    assert.equal(k.sp.lobbys.anzahl, 1, 'neues Duell ersetzt das alte');
    c.schliessen();
  } finally {
    await k.schliessen();
  }
});

test('Schema: Jede Nachricht wird streng geprüft', () => {
  assert.equal(pruefeNachricht(null), 'format');
  assert.equal(pruefeNachricht([]), 'format');
  assert.equal(pruefeNachricht({ t: 5 }), 'format');
  assert.equal(pruefeNachricht({ t: 'constructor' }), 'unbekannt');
  assert.equal(pruefeNachricht({ t: '__proto__' }), 'unbekannt');
  assert.equal(pruefeNachricht({ t: 'gibtsnicht' }), 'unbekannt');
  assert.equal(pruefeNachricht({ t: 'ping', c: 'x' }), 'felder');
  assert.equal(pruefeNachricht({ t: 'ping', c: 1, extra: 2 }), 'felder');
  assert.equal(pruefeNachricht({ t: 'zustand', d: [1, 2, 3] }), 'felder');
  assert.equal(pruefeNachricht({ t: 'zustand', d: [1, NaN, 0, 0, 0, 0, 0, 0] }), 'felder');
  assert.equal(pruefeNachricht({ t: 'zustand', d: [1, 0, 0, 0, 0, 0, 0, 999] }), 'felder');
  assert.equal(pruefeNachricht({ t: 'zustand', d: [1, 0, 0, 0, 0, 0, 0, 0] }), null);
  assert.equal(pruefeNachricht({ t: 'emote', id: 'beleidigung' }), 'felder');
  assert.equal(pruefeNachricht({ t: 'einstellungen', streckeId: 'mond' }), 'felder');
  assert.equal(pruefeNachricht({ t: 'bereit', an: 1 }), 'felder');
  assert.ok(CLIENT_NACHRICHTEN.length >= 10);
});

test('Fuzz: Kaputte, zu große und unerwartete Pakete bringen den Server nicht zum Absturz', async () => {
  const k = await serverStarten({ maxProSekunde: 100000 });
  try {
    const z = new Zufall(1234);
    const { a, b } = await lobbyPaar(k.port);
    a.senden({ t: 'bereit', an: true });
    b.senden({ t: 'bereit', an: true });
    await a.warte('startCountdown');
    const typen = [...CLIENT_NACHRICHTEN, 'x', '', 'constructor', '__proto__', 'hasOwnProperty', 'toString'];
    const werte = () => z.waehle([null, 0, -1, 1e308, -1e308, '', 'a', 'x'.repeat(500), [], {}, [[]], { a: { b: {} } }, true, false, 2 ** 53, 'ZZZZZZ', [1, 2, 3, 4, 5, 6, 7, 8], [1e308, 1e308, 1e308, 1e308, 1e308, 1e308, 1e308, 1e308], ['a', 'b'], { __proto__: { x: 1 } }]);
    const feld = () => z.waehle(['t', 'v', 'c', 'd', 'code', 'token', 'id', 'an', 'name', 'look', 'autoId', 'tuning', 'strecken', 'clientId', 'streckeId', 'format', 'einheit', '__proto__', 'constructor']);
    for (let i = 0; i < 3000; i++) {
      const wurf = z.naechste();
      const ziel = z.chance(0.5) ? a : b;
      if (!ziel.offen) continue;
      if (wurf < 0.15) {
        // Zufällige Bytes als Text und binär
        const n = z.ganz(0, 300);
        const bytes = Buffer.from(Array.from({ length: n }, () => z.ganz(0, 255)));
        ziel.senden(z.chance(0.5) ? bytes : bytes.toString('latin1'));
      } else if (wurf < 0.25) {
        ziel.senden(z.waehle(['{', '[', 'null', '1', '"x"', '{"t":', '{"t":null}', '[[[[', '{"t":"zustand","d":', 'true', '{"t":"hallo"}']));
      } else {
        const n = { t: z.waehle(typen) };
        const felder = z.ganz(0, 4);
        for (let f = 0; f < felder; f++) n[feld()] = werte();
        ziel.senden(n);
      }
    }
    // Zu groß: Die Verbindung wird getrennt, der Server lebt weiter
    const gross = await new Client(k.port).verbinden();
    gross.senden('x'.repeat(40 * 1024));
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(gross.offen, false, 'zu große Nachricht trennt die Verbindung');
    // Der Server antwortet weiterhin
    const c = await new Client(k.port).verbinden();
    c.senden({ t: 'echo', d: 'noch da' });
    assert.equal((await c.warte('echo')).d, 'noch da');
    const antwort = await fetch(`http://127.0.0.1:${k.port}/healthz`);
    assert.equal(antwort.status, 200);
  } finally {
    await k.schliessen();
  }
});

test('Rate-Limit: Überschuss wird verworfen, Dauerfeuer trennt die Verbindung; andere bleiben unberührt', async () => {
  const k = await serverStarten();
  try {
    const flut = await new Client(k.port).verbinden();
    const ruhig = await new Client(k.port).verbinden();
    for (let i = 0; i < 150; i++) flut.senden({ t: 'echo', d: String(i) });
    await new Promise((r) => setTimeout(r, 200));
    const antworten = flut.alle.filter((n) => n.t === 'echo').length;
    assert.ok(antworten <= 125, `${antworten} Antworten auf 150 Nachrichten`);
    assert.ok(antworten >= 40, `${antworten} Antworten`);
    // Dauerfeuer über das Limit hinaus trennt
    for (let i = 0; i < 1000 && flut.offen; i++) flut.senden({ t: 'echo', d: 'x' });
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(flut.offen, false, 'Dauerfeuer trennt');
    ruhig.senden({ t: 'echo', d: 'ok' });
    assert.equal((await ruhig.warte('echo')).d, 'ok');
  } finally {
    await k.schliessen();
  }
});

test('Tagesgrenzen auf dem Server: höchstens 3 belohnte Duelle je Gegner, keine Selbst-Duelle', async () => {
  const { LobbyVerwaltung } = await import('../server/lobbys.js');
  const l = new LobbyVerwaltung({ senden: () => {}, jetzt: () => Date.UTC(2026, 10, 2, 12) });
  assert.equal(l._belohnungPruefen('aaa', 'aaa', 400), 0, 'Selbst-Duell');
  for (let i = 0; i < 3; i++) assert.equal(l._belohnungPruefen('aaa', 'bbb', 400), 400);
  assert.equal(l._belohnungPruefen('aaa', 'bbb', 400), 0, 'vierter Gegner-Sieg');
  for (let i = 0; i < 7; i++) assert.equal(l._belohnungPruefen('aaa', 'g' + i, 100), 100);
  assert.equal(l._belohnungPruefen('aaa', 'neu', 100), 0, 'mehr als 10 am Tag');
  assert.equal(l._belohnungPruefen('aaa', 'neu', 0), 0);
});
