// Abnahmetest „Definition fertig“ auf dem Produktionsbuild, mit echter GPU: Ein neuer Spieler macht das Tutorial,
// gewinnt ein Bot-Battle, kauft ein Teil, gestaltet das Auto in der Garage, fährt mit dem Look und spielt per Code
// ein Online-Duell gegen ein zweites Browser-Fenster. Eingaben im Rennen kommen vom Autopiloten, sonst läuft der
// echte Client. Jeder Fehler in der Konsole lässt den Test scheitern.
// Aufruf: node scripts/gesamtAblauf.js [ausgabeordner]   Vorher: npm run build
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { erzeugeApp } from '../server/app.js';
import { starteSpielServer } from '../server/spielServer.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ausgabe = process.argv[2] || path.join(wurzel, 'test-results', 'gesamt');
mkdirSync(ausgabe, { recursive: true });

let sp;
const server = http.createServer(erzeugeApp({ statusInfo: () => sp.status() }));
// Der Autopilot steht manchmal hinter einem festgefahrenen Vordermann still; das wäre sonst AFK
sp = starteSpielServer(server, { afkMs: 300_000 });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const basis = `http://127.0.0.1:${server.address().port}`;

const probleme = [];
function pruefe(b, text) {
  console.log((b ? 'ok   ' : 'FEHLER ') + text);
  if (!b) probleme.push(text);
}

const edge = 'C:/Program Files (x86)/Microsoft/EdgeCore';
const browser = await chromium.launch({
  executablePath: `${edge}/${readdirSync(edge).sort().pop()}/msedge.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required']
});
async function neuesFenster() {
  const k = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const s = await k.newPage();
  s.fehler = [];
  s.on('console', (m) => { if (m.type() === 'error') s.fehler.push(m.text()); });
  s.on('pageerror', (e) => s.fehler.push('pageerror: ' + e.message));
  await s.goto(basis + '/', { waitUntil: 'load' });
  await s.waitForSelector('.menue-knopf', { timeout: 60000 });
  await s.waitForTimeout(500);
  return s;
}
const a = await neuesFenster();
const g = (fn, arg) => a.evaluate(fn, arg);
const foto = (s, n) => s.screenshot({ path: path.join(ausgabe, n + '.png') });
const dialogKnopf = (s, text) => s.locator('.dialog-hintergrund .knopf', { hasText: text }).click();
const muenzen = () => g(() => window.__driftkoenig.daten.waehrung);
const zumMenue = async () => {
  await a.waitForSelector('.menue-knopf', { timeout: 30000 });
  await a.waitForTimeout(300);
};

// ---- 1. Tutorial
const dialog = await a.locator('.dialog-hintergrund').innerText();
pruefe(dialog.includes('Willkommen'), 'Erster Start bietet das Tutorial an');
await dialogKnopf(a, 'Tutorial starten');
await a.waitForSelector('.tutorial-karte', { timeout: 60000 });
const tutorial = await g(() => {
  const spiel = window.__driftkoenig;
  const m = spiel.modus;
  spiel.schleife.physikAktiv = false;
  const werte = { lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0 };
  const echteWerte = spiel.eingabe.werte;
  Object.defineProperty(spiel.eingabe, 'werte', { get: () => werte, configurable: true });
  const setz = (o) => Object.assign(werte, { lenken: 0, gas: 0, bremse: 0, handbremse: 0 }, o);
  const lauf = (o, s) => { setz(o); for (let t = 0; t < s; t += 1 / 60) m.schritt(1 / 60); };
  const bis = (id, fn) => { for (let i = 0; i < 40 && m.ablauf.schritt.id === id; i++) fn(); };
  bis('gas', () => lauf({ gas: 1 }, 1));
  bis('lenken', () => { lauf({ gas: 0.5, lenken: 0.7 }, 0.5); lauf({ gas: 0.5, lenken: -0.7 }, 0.5); });
  bis('bremse', () => { lauf({ gas: 1 }, 2); lauf({ bremse: 1 }, 2); });
  bis('handbremse', () => { lauf({ gas: 1 }, 2); lauf({ handbremse: 1, gas: 0.3 }, 0.1); });
  const f = m.spieler.fahrzeug;
  const kick = () => {
    m.spielerZuruecksetzen(false);
    f.setzen(f.z.x, f.z.y, f.z.theta, 60 / 3.6);
    lauf({ lenken: -1, handbremse: 1, gas: 0.3 }, 0.35);
    lauf({ gas: 0.9 }, 3.5);
  };
  bis('drift', kick);
  bis('halten', kick);
  const b = m.botAuto.fahrzeug;
  setz({});
  for (let t = 0; t < 14 && m.ablauf.schritt.id === 'tandem'; t += 1 / 60) {
    f.setzen(b.z.x - Math.cos(b.z.theta) * 8, b.z.y - Math.sin(b.z.theta) * 8, b.z.theta, b.tempo);
    m.schritt(1 / 60);
  }
  Object.defineProperty(spiel.eingabe, 'werte', { value: echteWerte, writable: true, configurable: true, enumerable: true });
  return m.ablauf.schritt.id;
});
pruefe(tutorial === 'fertig', `Tutorial ist bis zum Ende spielbar (Schritt: ${tutorial})`);
await a.waitForSelector('.tutorial-schluss .knopf', { timeout: 10000 });
await a.locator('.tutorial-schluss .knopf').click();
await zumMenue();
pruefe(await g(() => window.__driftkoenig.daten.fortschritt.tutorialFertig) === true, 'Tutorial gilt als gesehen');
pruefe(await a.locator('.dialog-hintergrund').count() === 0, 'Das Tutorial wird nicht erneut angeboten');

// ---- 2. Bot-Battle gewinnen
const vorBattle = await muenzen();
await g(() => {
  const sp2 = window.__driftkoenig;
  sp2.testAutopilot = 'legende';
});
await a.getByText('Spielen', { exact: true }).first().click();
await a.getByText('Tandem-Battle', { exact: true }).first().click();
await a.waitForSelector('.battle-wahl', { timeout: 15000 });
await a.locator('.battle-wahl .auswahl-knopf', { hasText: 'Schnell' }).click();
await a.waitForTimeout(150);
await foto(a, 'battle-wahl');
await a.locator('.battle-wahl .knopf.haupt.gross').click();
await a.waitForSelector('.hud.battle', { timeout: 60000 });
// Das Ergebnis wird gebucht wie bei einem Menschen, nur das Lenken übernimmt der Autopilot
await g(() => {
  const m = window.__driftkoenig.modus;
  const alt = m._battleEnde.bind(m);
  m._battleEnde = () => { m.konfig.autopilot = null; alt(); };
  window.__driftkoenig.schleife.zeitFaktor = 2;
});
let battleFertig = false;
for (let i = 0; i < 12 && !battleFertig; i++) {
  await a.waitForSelector('.ergebnis-bildschirm', { timeout: 200000 });
  await a.waitForTimeout(400);
  if (await a.locator('.ergebnis-bildschirm .knopf', { hasText: 'Revanche' }).count()) battleFertig = true;
  else await a.locator('.ergebnis-bildschirm .knopf.haupt').click();
}
await a.waitForTimeout(1800);
await foto(a, 'battle-ergebnis');
const titel = await a.locator('.ergebnis-titel').innerText();
pruefe(titel === 'Sieg!', `Das Bot-Battle ist gewonnen (${titel})`);
const nachBattle = await muenzen();
pruefe(nachBattle > vorBattle, `Belohnung gebucht: ${vorBattle} → ${nachBattle} DM`);
pruefe(await g(() => window.__driftkoenig.daten.statistik.siege) === 1, 'Der Sieg steht in der Statistik');
await a.locator('.ergebnis-bildschirm .knopf', { hasText: 'Menü' }).click();
await zumMenue();
await g(() => { window.__driftkoenig.testAutopilot = null; });

// ---- 3. Teil im Shop kaufen
await a.getByText('Shop', { exact: true }).click();
await a.waitForSelector('.shop-liste', { timeout: 60000 });
await a.waitForTimeout(400);
await a.click('.garage-reiter-knopf[data-reiter="lack"]');
await a.waitForTimeout(250);
await a.locator('.shop-liste .teil-karte', { hasText: 'Metallic' }).first().click();
await a.waitForTimeout(600);
await foto(a, 'shop');
const vorKauf = await muenzen();
await a.locator('.shop-aktionen .knopf.haupt').click();
await a.waitForSelector('.dialog-hintergrund');
await dialogKnopf(a, 'Kaufen');
await a.waitForTimeout(300);
pruefe(await muenzen() === vorKauf - 700, 'Der Kauf bucht genau den Preis ab');
pruefe(await g(() => window.__driftkoenig.daten.besitzGlobal.some((x) => x.includes('metallic'))), 'Das Teil gehört dem Spieler');
await a.locator('[aria-label="Zurück"]').first().click();
await zumMenue();

// ---- 4. Auto in der Garage gestalten
await a.getByText('Garage', { exact: true }).click();
await a.waitForSelector('.garage', { timeout: 60000 });
await a.waitForTimeout(800);
await a.locator('.teil-karte', { hasText: 'Metallic' }).click();
await a.waitForTimeout(250);
await a.locator('.farb-zeile', { hasText: 'Lackfarbe' }).click();
await a.waitForSelector('.farbwaehler');
await a.locator('.farb-hex').fill('#1160d8');
await a.waitForTimeout(300);
await foto(a, 'garage');
const gespeichert = await g(() => {
  const d = window.__driftkoenig.daten;
  const auto = d.autos.find((x) => x.id === d.aktivesAuto);
  return auto.looks[auto.aktiverLook].look.lack;
});
pruefe(gespeichert.finish === 'metallic' && gespeichert.farbe1 === '#1160d8', `Der Look ist gespeichert (${gespeichert.finish}, ${gespeichert.farbe1})`);
await a.locator('[aria-label="Zurück"]').first().click();
await zumMenue();

// ---- 5. Mit dem Look fahren
await a.getByText('Spielen', { exact: true }).first().click();
await a.getByText('Freies Fahren', { exact: true }).first().click();
await a.waitForTimeout(400);
await a.getByText('Industriehof', { exact: true }).first().click();
await a.waitForTimeout(250);
const startFrei = a.locator('.wahl-bildschirm .knopf.haupt');
if (await startFrei.count()) await startFrei.first().click();
await a.waitForSelector('.hud', { timeout: 60000 });
const imRennen = await g(() => window.__driftkoenig.modus.spieler.modell.look.lack);
pruefe(imRennen.finish === 'metallic' && imRennen.farbe1 === '#1160d8', 'Im Rennen fährt das Auto mit dem Look');
await a.keyboard.down('KeyW');
await a.waitForTimeout(5000);
await a.keyboard.up('KeyW');
const fahrt = await g(() => {
  const sp2 = window.__driftkoenig;
  return { kmh: Math.round(sp2.modus.spieler.fahrzeug.tempo * 3.6), fps: Math.round(sp2.schleife.fps), draw: sp2.renderer.drawCalls };
});
await foto(a, 'fahrt');
pruefe(fahrt.kmh > 40, `Das Auto fährt mit echten Tasteneingaben (${fahrt.kmh} km/h)`);
pruefe(fahrt.fps >= 60, `Mindestens 60 FPS (${fahrt.fps} FPS, ${fahrt.draw} Draw Calls)`);
await a.keyboard.press('Escape');
await a.waitForSelector('.pause-menue');
await a.locator('.pause-menue .knopf', { hasText: 'Beenden' }).click();
await zumMenue();

// ---- 6. Online-Duell per Code gegen ein zweites Fenster
const b = await neuesFenster();
const uebersprungen = b.locator('.dialog-hintergrund .knopf', { hasText: 'Überspringen' });
if (await uebersprungen.count()) await uebersprungen.click();
for (const s of [a, b]) await s.evaluate(() => { window.__driftkoenig.testAutopilot = 'legende'; });
await b.evaluate(() => { window.__driftkoenig.daten.spielerName = 'Zweiter'; });
await a.getByText('Online-Duell', { exact: true }).click();
await a.waitForSelector('.online-bildschirm', { timeout: 30000 });
await a.locator('.knopf', { hasText: 'Duell erstellen' }).first().click();
await a.waitForSelector('.code-gross', { timeout: 15000 });
const code = await a.locator('.code-gross').innerText();
await b.getByText('Online-Duell', { exact: true }).click();
await b.waitForSelector('.code-eingabe', { timeout: 30000 });
await b.locator('.code-eingabe').fill(code.toLowerCase());
await b.locator('.knopf', { hasText: 'Beitreten' }).click();
await a.waitForSelector('.online-bereit', { timeout: 15000 });
await b.waitForSelector('.online-bereit', { timeout: 15000 });
await a.locator('.auswahl-knopf', { hasText: 'Schnell' }).click();
await a.waitForTimeout(500);
await foto(a, 'online-lobby');
await a.locator('.online-bereit').click();
await b.locator('.online-bereit').click();
await a.waitForSelector('.hud.battle', { timeout: 60000 });
await b.waitForSelector('.hud.battle', { timeout: 60000 });
await a.waitForFunction(() => window.__driftkoenig.modus.zustand === 'laeuft', null, { timeout: 30000 });
const lookBeiB = await b.evaluate(() => window.__driftkoenig.modus.gegnerAuto.modell.look.lack);
pruefe(lookBeiB.finish === 'metallic' && lookBeiB.farbe1 === '#1160d8', 'Der zweite Spieler sieht den Look, auch ohne das Teil zu besitzen');
await a.waitForTimeout(12000);
await foto(a, 'online-fahrt-a');
await foto(b, 'online-fahrt-b');
const onlineFps = await Promise.all([a, b].map((s) => s.evaluate(() => ({ fps: Math.round(window.__driftkoenig.schleife.fps), ping: window.__driftkoenig.netz.ping, alter: Math.round(window.__driftkoenig.modus.interp.alter), luecken: window.__driftkoenig.modus.interp.statistik }))));
console.log('     Online:', JSON.stringify(onlineFps));
const vorOnlineA = await muenzen();
await a.waitForSelector('.ergebnis-bildschirm h2', { timeout: 320000 });
await b.waitForSelector('.ergebnis-bildschirm h2', { timeout: 30000 });
await a.waitForTimeout(1500);
await foto(a, 'online-ergebnis-a');
const titelA = await a.locator('.ergebnis-titel').innerText();
const titelB = await b.locator('.ergebnis-titel').innerText();
pruefe(titelA !== titelB && [titelA, titelB].includes('Sieg!'), `Das Duell hat einen Sieger (${titelA} / ${titelB})`);
pruefe(await muenzen() > vorOnlineA, 'Die Online-Belohnung ist gebucht');
const st = await g(() => window.__driftkoenig.daten.statistik);
pruefe(st.onlineDuelle === 1, 'Das Duell steht in der Statistik');

// ---- Spielstand übersteht einen Neustart
await a.locator('.ergebnis-bildschirm .knopf', { hasText: 'Menü' }).click();
await zumMenue();
const vorNeuladen = await g(() => { window.__driftkoenig.speicher.sofortSpeichern(); return window.__driftkoenig.daten.waehrung; });
await a.reload({ waitUntil: 'load' });
await a.waitForSelector('.menue-knopf', { timeout: 60000 });
const nachNeuladen = await g(() => {
  const d = window.__driftkoenig.daten;
  const auto = d.autos.find((x) => x.id === d.aktivesAuto);
  return { w: d.waehrung, farbe: auto.looks[auto.aktiverLook].look.lack.farbe1, siege: d.statistik.siege };
});
pruefe(nachNeuladen.w === vorNeuladen && nachNeuladen.farbe === '#1160d8' && nachNeuladen.siege === 1, 'Geld, Look und Statistik überstehen das Neuladen');

// ---- Fehler in der Konsole
for (const [n, s] of [['A', a], ['B', b]]) {
  const f = s.fehler.filter((x) => !/favicon/.test(x));
  pruefe(f.length === 0, `Keine Fehler in der Konsole (Fenster ${n})${f.length ? ': ' + f.slice(0, 3).join(' | ').slice(0, 400) : ''}`);
}
console.log(probleme.length === 0 ? 'Alles in Ordnung.' : `${probleme.length} Probleme.`);
await browser.close();
sp.beenden();
server.close();
process.exit(probleme.length ? 1 : 0);
