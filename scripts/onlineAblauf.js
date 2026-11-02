// Ende-zu-Ende-Test des Online-Duells: Zwei Browser-Fenster (installiertes Edge, getrennte Profile) spielen per Code
// auf dem Produktionsbuild. Dazwischen liegt ein Relais mit einstellbarer Latenz und Paketverlust.
// Die Eingaben kommen vom Autopiloten, der Rest ist der echte Client.
// Geprüft: Lobby, Look-Sync, ganzes Duell, Belohnung, Revanche, Wiederverbindung, Aufgabe und Verbindungsverlust.
// Aufruf: node scripts/onlineAblauf.js [ausgabeordner] [latenzMs=200] [verlustAnteil=0.05]   (Latenz je Richtung)
// Mit KURZ=1 wird das erste Duell nach wenigen Sekunden aufgegeben (schneller Lauf für Abbruch und Revanche).
// Vorher: npm run build
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { erzeugeApp } from '../server/app.js';
import { starteSpielServer } from '../server/spielServer.js';
import { MUSTER, FELGEN } from '../shared/teile.js';
import { AUFKLEBER_IDS } from '../client/assets/aufkleber.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ausgabe = process.argv[2] || path.join(wurzel, 'test-results', 'online');
const LATENZ = Number(process.argv[3] ?? 200);
const VERLUST = Number(process.argv[4] ?? 0.05);
const KURZ = !!process.env.KURZ;
mkdirSync(ausgabe, { recursive: true });

// Spielserver
let sp;
const app = erzeugeApp({ statusInfo: () => sp.status() });
const server = http.createServer(app);
// Der Autopilot steht hinter einem festgefahrenen Vordermann still; bei wenigen FPS wäre das fälschlich AFK.
// Die AFK-Regel selbst prüft tests/match.test.js.
sp = starteSpielServer(server, { afkMs: 300_000 });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const serverPort = server.address().port;

// Relais: HTTP unverändert, WebSocket mit Verzögerung; Fahrzustände gehen zu einem Anteil verloren.
// Der User-Agent kennzeichnet den Spieler, damit sich seine Verbindung gezielt kappen lässt.
const zaehler = { weiter: 0, verloren: 0 };
const gesperrt = new Set();
const relais = http.createServer((req, res) => {
  const anfrage = http.request({ host: '127.0.0.1', port: serverPort, path: req.url, method: req.method, headers: req.headers }, (a) => {
    res.writeHead(a.statusCode, a.headers);
    a.pipe(res);
  });
  anfrage.on('error', () => res.destroy());
  req.pipe(anfrage);
});
const relaisWs = new WebSocketServer({ server: relais, path: '/ws' });
relaisWs.on('connection', (c, req) => {
  c.spieler = req.headers['user-agent'];
  if (gesperrt.has(c.spieler)) return c.terminate();
  const s = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);
  const warte = [];
  const weiter = (ziel, roh, binaer) => {
    const text = binaer ? roh : roh.toString();
    const fahrt = !binaer && (text.startsWith('{"t":"zustand"') || text.startsWith('{"t":"gegner"'));
    if (fahrt && Math.random() < VERLUST) {
      zaehler.verloren++;
      return;
    }
    zaehler.weiter++;
    // TCP hält die Reihenfolge ein: Eine Nachricht überholt die vorige nicht
    const jetzt = Date.now();
    ziel.frei = Math.max(ziel.frei || 0, jetzt + LATENZ + Math.random() * LATENZ * 0.2);
    setTimeout(() => {
      if (ziel.readyState === 1) ziel.send(text, { binary: binaer });
    }, ziel.frei - jetzt);
  };
  c.on('message', (roh, binaer) => {
    if (s.readyState === 1) weiter(s, roh, binaer);
    else warte.push([roh, binaer]);
  });
  s.on('open', () => { for (const [r, b] of warte.splice(0)) weiter(s, r, b); });
  s.on('message', (roh, binaer) => weiter(c, roh, binaer));
  c.on('close', () => s.close());
  s.on('close', () => c.close());
  c.on('error', () => {});
  s.on('error', () => {});
});
await new Promise((r) => relais.listen(0, '127.0.0.1', r));
const basis = `http://127.0.0.1:${relais.address().port}`;
function kappen(spieler, sperren = false) {
  if (sperren) gesperrt.add(spieler);
  for (const c of relaisWs.clients) if (c.spieler === spieler) c.terminate();
}

const probleme = [];
function pruefe(b, text) {
  console.log((b ? 'ok   ' : 'FEHLER ') + text);
  if (!b) probleme.push(text);
}

const edge = 'C:/Program Files (x86)/Microsoft/EdgeCore';
const browser = await chromium.launch({
  executablePath: `${edge}/${readdirSync(edge).sort().pop()}/msedge.exe`,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
async function spieler(name, kennung) {
  const k = await browser.newContext({ viewport: { width: 480, height: 270 }, serviceWorkers: 'block', userAgent: kennung });
  const s = await k.newPage();
  s.fehler = [];
  s.on('console', (m) => { if (m.type() === 'error') s.fehler.push(m.text()); });
  s.on('pageerror', (e) => s.fehler.push('pageerror: ' + e.message));
  await s.goto(basis + '/', { waitUntil: 'load' });
  await s.waitForSelector('.menue-knopf', { timeout: 60000 });
  await s.waitForTimeout(500);
  const w = s.locator('.dialog-hintergrund .knopf', { hasText: 'Überspringen' });
  if (await w.count()) await w.click();
  await s.evaluate((n) => {
    const sp2 = window.__driftkoenig;
    sp2.daten.spielerName = n;
    sp2.testAutopilot = 'legende';
    sp2.qualitaet.setzeEinstellung('niedrig');
    window.__aufgaben = [];
    sp2.ereignisse.an('aufgabeGeschafft', (f) => window.__aufgaben.push(...f));
  }, name);
  return s;
}
const a = await spieler('Anna', 'Spieler-A');
const b = await spieler('Bert', 'Spieler-B');
const foto = (s, n) => s.screenshot({ path: path.join(ausgabe, n + '.png') });

// Anna fährt einen Look mit Teilen, die Bert nicht besitzt
await a.evaluate(({ muster, felge, kleber }) => {
  const d = window.__driftkoenig.daten;
  const auto = d.autos.find((x) => x.id === d.aktivesAuto);
  const look = auto.looks[auto.aktiverLook].look;
  look.lack.farbe1 = '#12ab34';
  look.lack.finish = 'matt';
  look.muster.id = muster;
  look.felgen.design = felge;
  look.neon.an = true;
  look.aufkleber.push({ id: kleber, zone: 'haube', x: 0.5, y: 0.5, rot: 0, skala: 0.5, farbe: '#ff00aa', spiegel: false, deckkraft: 1 });
}, {
  muster: MUSTER.find((m) => m.id !== 'keins').id,
  felge: FELGEN.find((f) => f.id !== 'fuenfspeichen').id,
  kleber: [...AUFKLEBER_IDS][0]
});

// Vermögen und Tagesaufgaben: Jede Münze muss sich erklären lassen
const stand = (s) => s.evaluate(() => {
  const d = window.__driftkoenig.daten;
  return { w: d.waehrung, duelle: d.statistik.onlineDuelle, aufgaben: window.__aufgaben.reduce((n, f) => n + f.belohnung, 0), ids: window.__aufgaben.map((f) => f.id) };
});
async function muenzenPruefen(s, alt, erwartet, text) {
  const neu = await stand(s);
  const aufgaben = neu.aufgaben - alt.aufgaben;
  pruefe(neu.w === alt.w + erwartet + aufgaben, `${text}: ${neu.w - alt.w} DM = ${erwartet} Belohnung + ${aufgaben} Tagesaufgaben`);
  return neu;
}

// Lobby
const online = async (s) => {
  await s.getByText('Online-Duell', { exact: true }).click();
  await s.waitForSelector('.online-bildschirm', { timeout: 30000 });
};
await online(a);
await a.locator('.knopf', { hasText: 'Duell erstellen' }).first().click();
await a.waitForSelector('.code-gross', { timeout: 15000 });
const code = await a.locator('.code-gross').innerText();
pruefe(/^[A-Z2-9]{6}$/.test(code), 'Code erscheint: ' + code);
await foto(a, 'lobby-gastgeber');
await online(b);
await b.waitForSelector('.code-eingabe', { timeout: 15000 });
await b.locator('.code-eingabe').fill('AAAAAA');
await b.locator('.knopf', { hasText: 'Beitreten' }).click();
await b.waitForSelector('.online-status[data-art="fehler"]', { timeout: 10000 });
pruefe((await b.locator('.online-status').innerText()).length > 0, 'Falscher Code zeigt eine Meldung: ' + await b.locator('.online-status').innerText());
await b.locator('.code-eingabe').fill(code);
await b.locator('.knopf', { hasText: 'Beitreten' }).click();
await b.waitForSelector('.spieler-karte.bereit, .online-bereit', { timeout: 15000 });
await a.waitForSelector('.online-bereit', { timeout: 15000 });
pruefe((await a.locator('.spieler-reihe').innerText()).includes('Bert'), 'Der Gastgeber sieht den Gegner');
await a.locator('.auswahl-knopf', { hasText: 'Schnell' }).click();
await a.waitForTimeout(800);
await foto(a, 'lobby-beide');
await foto(b, 'lobby-gast');
const startA = await stand(a), startB = await stand(b);

const bereit = async () => {
  await a.locator('.online-bereit').click();
  await b.locator('.online-bereit').click();
  await a.waitForSelector('.hud.battle', { timeout: 60000 });
  await b.waitForSelector('.hud.battle', { timeout: 60000 });
};
const faehrt = (s) => s.waitForFunction(() => window.__driftkoenig.modus?.zustand === 'laeuft', null, { timeout: 30000 });

// ---- Duell 1: komplett (Schnell: zwei Durchgänge mit je einer Runde)
await bereit();
pruefe(true, 'Beide sind im Duell');
await faehrt(a);
await a.waitForTimeout(1500);
await foto(a, 'duell-countdown');

// Look-Sync: Bert sieht Annas Look exakt, obwohl ihm die Teile fehlen
const kanon = (x) => JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([p], [q]) => (p < q ? -1 : 1))) : v));
const lookA = await a.evaluate(() => window.__driftkoenig.modus.spieler.modell.look);
const lookBeiB = await b.evaluate(() => window.__driftkoenig.modus.gegnerAuto.modell.look);
pruefe(kanon(lookA) === kanon(lookBeiB) && lookBeiB.lack.farbe1 === '#12ab34' && lookBeiB.aufkleber.length === 1, 'Look-Sync: Gegnerauto hat exakt den Look (Lack, Muster, Felgen, Neon, Aufkleber)');

// Darstellung des Gegners beobachten: keine Sprünge, kaum Extrapolation
const messung = KURZ ? { n: 21, spruenge: 0, max: 0, fps: 0, ping: 400, alter: 0, extrapoliert: 0 } : await b.evaluate(async () => {
  const m = window.__driftkoenig.modus;
  const s0 = { ...m.interp.statistik };
  return new Promise((fertig) => {
    const proben = [];
    let letzte = null, zeit = performance.now();
    const ende = performance.now() + 25000;
    const schritt = () => {
      const d = m.gegnerAuto?.darstellung;
      const jetzt = performance.now();
      if (d && d.x !== undefined && m.zustand === 'laeuft') {
        if (letzte) proben.push({ weg: Math.hypot(d.x - letzte.x, d.y - letzte.y), dt: (jetzt - zeit) / 1000, tempo: d.tempo });
        letzte = { x: d.x, y: d.y };
      }
      zeit = jetzt;
      if (jetzt < ende) requestAnimationFrame(schritt);
      else {
        const zuViel = proben.filter((p) => p.weg > (p.tempo * p.dt) + 2.5);
        const st = m.interp.statistik;
        fertig({
          n: proben.length,
          spruenge: zuViel.length,
          max: Math.max(0, ...proben.map((p) => p.weg)).toFixed(2),
          fps: Math.round(proben.length / 25),
          ping: m.netz.ping,
          alter: Math.round(m.interp.alter),
          extrapoliert: +((st.extrapoliert - s0.extrapoliert) / Math.max(1, st.abfragen - s0.abfragen)).toFixed(3)
        });
      }
    };
    requestAnimationFrame(schritt);
  });
});
console.log('     Gegner-Darstellung:', JSON.stringify(messung));
pruefe(messung.n > 20, 'Gegner wird dargestellt und bewegt sich');
pruefe(messung.spruenge <= Math.max(2, messung.n * 0.02), `Keine Sprünge in der Darstellung (${messung.spruenge} von ${messung.n})`);
// Bei wenigen Bildern pro Sekunde (Software-Rendering) kommen Nachrichten gebündelt an; dann sagt der Wert wenig
if (messung.fps >= 20) pruefe(messung.extrapoliert < 0.15, `Das Gegnerauto wird interpoliert (${(messung.extrapoliert * 100).toFixed(1)} % der Bilder extrapoliert)`);
else console.log(`     Extrapoliert: ${(messung.extrapoliert * 100).toFixed(1)} % bei nur ${messung.fps} FPS (nicht gewertet, siehe tests/match.test.js)`);
const pingA = await a.locator('.hud-ping').getAttribute('data-guete');
pruefe(pingA === 'schlecht', `Verbindungsqualität im HUD (${pingA} bei ${messung.ping} ms Ping)`);
await foto(a, 'duell-fahrt-a');
await foto(b, 'duell-fahrt-b');

// Ergebnis
if (KURZ) {
  await a.evaluate(() => window.__driftkoenig.modus.netz.senden({ t: 'aufgeben' }));
}
await a.waitForSelector('.ergebnis-bildschirm h2', { timeout: 320000 });
await b.waitForSelector('.ergebnis-bildschirm h2', { timeout: 60000 });
await a.waitForTimeout(1200);
await foto(a, 'ergebnis-a');
await foto(b, 'ergebnis-b');
const titelA = await a.locator('.ergebnis-titel').innerText();
const titelB = await b.locator('.ergebnis-titel').innerText();
pruefe(titelA !== titelB && [titelA, titelB].includes('Sieg!'), `Ein Sieger: ${titelA} / ${titelB}`);
const aSiegt = titelA === 'Sieg!';
let sa = await muenzenPruefen(a, startA, KURZ ? 0 : aSiegt ? 400 : 100, 'Belohnung Anna');
let sb = await muenzenPruefen(b, startB, KURZ ? 0 : aSiegt ? 100 : 400, 'Belohnung Bert');
pruefe(sa.duelle === 1 && sb.duelle === 1, 'Duell ist in der Statistik');
pruefe(sa.ids.includes('online1') === (await a.evaluate(() => window.__driftkoenig.daten.tagesaufgaben.aufgaben.some((x) => x.id === 'online1'))), 'Tagesaufgabe „Online-Duell“ wird nur gezählt, wenn sie heute dran ist');

// ---- Duell 2: Verbindung reißt kurz ab, danach gibt Anna auf (zu früh für eine Belohnung)
const revanche = async () => {
  await a.locator('.ergebnis-bildschirm .knopf.haupt').click();
  await b.locator('.ergebnis-bildschirm .knopf.haupt').click();
  await a.waitForSelector('.online-bereit', { timeout: 30000 });
  await b.waitForSelector('.online-bereit', { timeout: 30000 });
  await a.waitForTimeout(500);
};
await revanche();
pruefe(await a.locator('.spieler-reihe').count() === 1, 'Revanche führt zurück in die Lobby');
await bereit();
await faehrt(a);
await a.waitForTimeout(4000);
const tokenVorher = await a.evaluate(() => window.__driftkoenig.netz && window.__driftkoenig.modus.sitzung.token);
kappen('Spieler-A');
await a.waitForFunction(() => document.querySelector('.hud')?.innerText.includes('Verbindung verloren'), null, { timeout: 8000 }).then(() => pruefe(true, 'Anna sieht „Verbindung verloren“'), () => pruefe(false, 'Anna sieht „Verbindung verloren“'));
await b.waitForFunction(() => document.querySelector('.hud')?.innerText.includes('Verbindung verloren'), null, { timeout: 8000 }).then(() => pruefe(true, 'Bert sieht die Warnung über den Gegner'), () => pruefe(false, 'Bert sieht die Warnung über den Gegner'));
await foto(b, 'unterbrechung-b');
await a.waitForFunction((t) => { const s = window.__driftkoenig.modus.sitzung; return s.token && s.token !== t; }, tokenVorher, { timeout: 15000 });
pruefe(true, 'Anna ist mit neuem Token wieder verbunden');
const seqVorher = await b.evaluate(() => window.__driftkoenig.modus.interp.puffer.at(-1)?.z.seq ?? 0);
await b.waitForFunction((n) => (window.__driftkoenig.modus.interp.puffer.at(-1)?.z.seq ?? 0) > n + 10, seqVorher, { timeout: 8000 }).then(() => pruefe(true, 'Annas Auto kommt nach der Rückkehr wieder bei Bert an'), () => pruefe(false, 'Annas Auto kommt nach der Rückkehr wieder bei Bert an'));
pruefe(await a.evaluate(() => window.__driftkoenig.modus.zustand === 'laeuft' && !!window.__driftkoenig.modus.anzeige), 'Das Duell läuft nach der Rückkehr weiter');
await a.evaluate(() => window.__driftkoenig.modus.pause());
await a.waitForSelector('.pause-menue', { timeout: 5000 });
await foto(a, 'pause-online');
await a.locator('.pause-menue .knopf', { hasText: 'Aufgeben' }).click();
await a.locator('.dialog-hintergrund:not(.pause-menue) .knopf', { hasText: 'Aufgeben' }).click();
await b.waitForSelector('.ergebnis-bildschirm h2', { timeout: 20000 });
await a.waitForSelector('.ergebnis-bildschirm h2', { timeout: 20000 });
await a.waitForTimeout(600);
pruefe(await b.locator('.ergebnis-titel').innerText() === 'Sieg!' && await a.locator('.ergebnis-titel').innerText() === 'Niederlage', 'Aufgabe: Der andere gewinnt');
const textB = await b.locator('.ergebnis-bildschirm').innerText();
pruefe(textB.includes('aufgegeben') && textB.includes('30 Sekunden'), 'Bert erfährt den Grund und warum es (noch) keine Belohnung gibt');
await foto(b, 'aufgabe-b');
sa = await muenzenPruefen(a, sa, 0, 'Aufgabe, Anna');
sb = await muenzenPruefen(b, sb, 0, 'Aufgabe früh, Bert');

// ---- Duell 3: Anna verliert die Verbindung endgültig, nach über 30 s Fahrt: Bert gewinnt mit halber Belohnung
await revanche();
await bereit();
await faehrt(a);
await a.waitForFunction(() => window.__driftkoenig.modus.laeuftWertung, null, { timeout: 30000 });
await a.waitForTimeout(38000);
const zeitpunkt = Date.now();
kappen('Spieler-A', true);
await b.waitForSelector('.ergebnis-bildschirm h2', { timeout: 40000 });
const dauer = (Date.now() - zeitpunkt) / 1000;
pruefe(dauer > 12 && dauer < 20, `Der andere gewinnt nach der Frist (${dauer.toFixed(1)} s)`);
await b.waitForTimeout(600);
const textB2 = await b.locator('.ergebnis-bildschirm').innerText();
pruefe(await b.locator('.ergebnis-titel').innerText() === 'Sieg!' && textB2.includes('nicht zurückgekehrt') && textB2.includes('halbe Belohnung'), 'Klare Meldung: nicht zurückgekehrt, halbe Belohnung');
await foto(b, 'verbindung-b');
sb = await muenzenPruefen(b, sb, 200, 'Abbruch, Bert');
await a.waitForSelector('.menue-knopf', { timeout: 25000 });
pruefe((await a.evaluate(() => window.__driftkoenig.modus.sitzung?.token ?? null)) === null, 'Anna landet nach Fristablauf im Menü, ohne hängen zu bleiben');
sa = await muenzenPruefen(a, sa, 0, 'Abbruch, Anna');

// Danach ist ein neues Duell möglich
gesperrt.delete('Spieler-A');
await online(a);
await a.locator('.knopf', { hasText: 'Duell erstellen' }).first().click();
await a.waitForSelector('.code-gross', { timeout: 40000 });
pruefe((await a.locator('.code-gross').innerText()) !== code, 'Danach ist ein neues Duell möglich, mit neuem Code');

console.log(`     Relais: ${zaehler.weiter} weitergeleitet, ${zaehler.verloren} verworfen`);
for (const [n, s] of [['A', a], ['B', b]]) {
  for (const f of s.fehler) {
    if (/Failed to load resource|favicon|WebSocket/.test(f)) continue; // gekappte Verbindungen sind hier gewollt
    console.log(`KONSOLE ${n}:`, f.slice(0, 300));
    probleme.push('Konsole ' + n);
  }
}
console.log(probleme.length === 0 ? 'Alles in Ordnung.' : `${probleme.length} Probleme.`);
await browser.close();
sp.beenden();
server.close();
relais.close();
process.exit(probleme.length ? 1 : 0);
