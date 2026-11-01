// Server-Grundtests: Health-Check, Sicherheits-Header, WebSocket-Echo, Ping/Pong,
// Robustheit gegen kaputte Nachrichten.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { erzeugeApp } from '../server/app.js';
import { starteSpielServer } from '../server/spielServer.js';

let server;
let spielServer;
let port;

before(async () => {
  const app = erzeugeApp({ statusInfo: () => spielServer.status() });
  server = http.createServer(app);
  spielServer = starteSpielServer(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(async () => {
  spielServer.beenden();
  await new Promise((r) => server.close(r));
});

function verbinde() {
  return new Promise((aufloesen, ablehnen) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.once('open', () => aufloesen(ws));
    ws.once('error', ablehnen);
  });
}
function naechste(ws, typ, bedingung = () => true) {
  return new Promise((aufloesen) => {
    const fn = (roh) => {
      const n = JSON.parse(roh.toString());
      if ((!typ || n.t === typ) && bedingung(n)) {
        ws.off('message', fn);
        aufloesen(n);
      }
    };
    ws.on('message', fn);
  });
}

test('/healthz antwortet mit ok', async () => {
  const antwort = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(antwort.status, 200);
  const json = await antwort.json();
  assert.equal(json.ok, true);
});

test('Sicherheits-Header sind gesetzt', async () => {
  const antwort = await fetch(`http://127.0.0.1:${port}/healthz`);
  const csp = antwort.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.equal(antwort.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(antwort.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(antwort.headers.get('x-powered-by'), null);
});

test('WebSocket-Echo und Ping/Pong funktionieren', async () => {
  const ws = await verbinde();
  const echo = naechste(ws, 'echo');
  ws.send(JSON.stringify({ t: 'echo', d: 'hallo' }));
  assert.equal((await echo).d, 'hallo');
  const pong = naechste(ws, 'pong');
  ws.send(JSON.stringify({ t: 'ping', c: 123 }));
  const p = await pong;
  assert.equal(p.c, 123);
  assert.equal(typeof p.s, 'number');
  ws.close();
});

test('Kaputte Nachrichten bringen den Server nicht zum Absturz', async () => {
  const ws = await verbinde();
  const muell = ['', '{', 'null', '42', '[]', '{"t":5}', '{"t":"gibtsnicht"}', 'x'.repeat(5000), JSON.stringify({ t: 'ping', c: 'abc' })];
  for (const m of muell) ws.send(m);
  ws.send(Buffer.from([1, 2, 3, 4]));
  const pong = naechste(ws, 'pong', (n) => n.c === 1);
  ws.send(JSON.stringify({ t: 'ping', c: 1 }));
  assert.equal((await pong).c, 1);
  ws.close();
});

test('Zu große Nachrichten trennen nur die betroffene Verbindung', async () => {
  const ws = await verbinde();
  const geschlossen = new Promise((r) => ws.once('close', r));
  ws.send('x'.repeat(20 * 1024));
  await geschlossen;
  const ws2 = await verbinde();
  const pong = naechste(ws2, 'pong');
  ws2.send(JSON.stringify({ t: 'ping', c: 2 }));
  assert.equal((await pong).c, 2);
  ws2.close();
});
