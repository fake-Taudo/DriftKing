// Fotos der Effekte im echten Drift: Tandem-Battle mit Autopilot auf allen Strecken, mit echter GPU.
// Fotografiert, sobald das Auto weit quer steht, dazu Funken und Backfire in eingefrorener Zeit.
// Aufruf: node scripts/effektBilder.js [ausgabeordner]   Vorher: npm run build
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { erzeugeApp } from '../server/app.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ausgabe = process.argv[2] || path.join(wurzel, 'test-results', 'effekte');
mkdirSync(ausgabe, { recursive: true });
const server = http.createServer(erzeugeApp({ statusInfo: () => ({}) }));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const edge = 'C:/Program Files (x86)/Microsoft/EdgeCore';
const browser = await chromium.launch({
  executablePath: `${edge}/${readdirSync(edge).sort().pop()}/msedge.exe`,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11']
});
const s = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const meldungen = [];
s.on('pageerror', (e) => meldungen.push('pageerror ' + e.message));
s.on('console', (m) => { if (m.type() === 'error') meldungen.push(m.text().slice(0, 300)); });
await s.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
await s.waitForSelector('.menue-knopf', { timeout: 60000 });
await s.waitForTimeout(500);
const wk = s.locator('.dialog-hintergrund .knopf', { hasText: 'Überspringen' });
if (await wk.count()) await wk.click();

const LAEUFE = [
  { strecke: 'Industriehof', stufe: 'hoch', qualm: '#eeeeee' },
  { strecke: 'Küstenpass', stufe: 'hoch', qualm: 'regenbogen' },
  { strecke: 'Neon-Hafen', stufe: 'hoch', qualm: '#a24bff' },
  { strecke: 'Industriehof', stufe: 'niedrig', qualm: '#ff3b3b' }
];
for (const l of LAEUFE) {
  await s.evaluate(({ stufe, qualm }) => {
    const sp = window.__driftkoenig;
    const d = sp.daten;
    d.fortschritt.strecken = ['industriehof', 'kuestenpass', 'neonhafen'];
    d.einstellungen.grafik.qualitaet = stufe;
    sp.einstellungenAnwenden();
    const a = d.autos.find((x) => x.id === d.aktivesAuto);
    const look = a.looks[a.aktiverLook].look;
    look.qualm = qualm;
    look.backfire = 1;
    sp.testAutopilot = 'legende';
  }, l);
  await s.getByText('Spielen', { exact: true }).first().click();
  await s.getByText('Tandem-Battle', { exact: true }).first().click();
  await s.waitForSelector('.battle-wahl', { timeout: 15000 });
  await s.locator('.battle-wahl').getByText(l.strecke, { exact: false }).first().click();
  await s.waitForTimeout(300);
  await s.locator('.battle-wahl .knopf.haupt.gross').click();
  await s.waitForSelector('.hud.battle', { timeout: 60000 });
  await s.waitForFunction(() => window.__driftkoenig.modus.zustand === 'laeuft', null, { timeout: 30000 });
  const name = `${l.strecke.replace(/[^A-Za-zü]/g, '')}-${l.stufe}`;
  // Warten, bis das Auto wirklich driftet, und ein paar Sekunden Spuren sammeln
  await s.waitForFunction(() => {
    const f = window.__driftkoenig.modus.spieler.fahrzeug;
    return f.driftWinkel > 0.45 && f.tempo > 12 && window.__driftkoenig.modus.vfx.spuren.schreib > 60;
  }, null, { timeout: 90000, polling: 50 }).catch(() => console.log(name, 'kein tiefer Drift gefunden'));
  await s.screenshot({ path: path.join(ausgabe, name + '-drift.png') });
  const info = await s.evaluate(() => {
    const sp = window.__driftkoenig;
    const m = sp.modus;
    const f = m.spieler.fahrzeug;
    return { fps: Math.round(sp.schleife.fps), draw: sp.renderer.drawCalls, rauch: m.vfx.rauch.n, umwelt: m.vfx.umwelt.n, spuren: m.vfx.spuren.schreib, kmh: Math.round(f.tempo * 3.6), winkel: Math.round(f.driftWinkel * 57.3) };
  });
  console.log(name, JSON.stringify(info));
  // Funken und Backfire: Zeit fast anhalten, damit sie auf dem Foto stehen
  await s.evaluate(() => {
    const sp = window.__driftkoenig;
    const m = sp.modus;
    sp.schleife.zeitFaktor = 0.02;
    const a = m.spieler;
    const d = a.darstellung;
    const c = Math.cos(d.theta), n = Math.sin(d.theta);
    m.vfx.fahrzeugEreignis(a, { art: 'fehlzuendung', staerke: 1 });
    // Zwischen Kamera und Auto, damit die Funken nicht verdeckt sind
    const b = m.rennKamera.richtung;
    m.vfx.fahrzeugEreignis(a, { art: 'wand', staerke: 14, x: d.x - b.x * 2.6 + b.y * 1.5, y: d.y - b.y * 2.6 - b.x * 1.5, nx: -b.y, ny: b.x });
  });
  await s.waitForTimeout(150);
  await s.screenshot({ path: path.join(ausgabe, name + '-funken.png') });
  await s.evaluate(() => {
    const sp = window.__driftkoenig;
    sp.schleife.zeitFaktor = 1;
    sp.modus.beenden();
  });
  await s.waitForSelector('.menue-knopf', { timeout: 30000 });
  await s.waitForTimeout(400);
}
console.log('Meldungen:', meldungen.length ? meldungen.join('\n') : 'keine');
await browser.close();
server.close();
process.exit(meldungen.length ? 1 : 0);
