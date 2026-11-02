// Klangtest im echten Browser: Das WebAudio-Netz wird mit Testwerten betrieben und am Ausgang gemessen.
// Prüft: Motor reagiert auf Drehzahl und Last, Reifen auf Schlupf, jedes Auto klingt anders, nichts übersteuert,
// die Stimmenzahl bleibt begrenzt, Musik und Lautstärke-Regler wirken.
// Aufruf: node scripts/klangCheck.js   Vorher: npm run build
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
import http from 'node:http';
import { erzeugeApp } from '../server/app.js';
import { AUTOS } from '../shared/autos.js';

const server = http.createServer(erzeugeApp({ statusInfo: () => ({}) }));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const edge = 'C:/Program Files (x86)/Microsoft/EdgeCore';
const browser = await chromium.launch({
  executablePath: `${edge}/${readdirSync(edge).sort().pop()}/msedge.exe`,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
});
const s = await browser.newPage({ viewport: { width: 480, height: 270 } });
const fehler = [];
s.on('pageerror', (e) => fehler.push(e.message));
await s.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
await s.waitForSelector('.menue-knopf', { timeout: 60000 });
await s.waitForTimeout(500);
const w = s.locator('.dialog-hintergrund .knopf', { hasText: 'Überspringen' });
if (await w.count()) await w.click();
await s.mouse.click(200, 100); // erste Nutzereingabe
await s.waitForFunction(() => window.__driftkoenig.audio.ctx?.state === 'running', null, { timeout: 10000 });

const probleme = [];
const pruefe = (b, text) => {
  console.log((b ? 'ok   ' : 'FEHLER ') + text);
  if (!b) probleme.push(text);
};

const daten = AUTOS.map((a) => ({ id: a.id, klang: a.klang, leerlauf: a.leerlauf, drehzahlMax: a.drehzahlMax, turbo: !!a.turbo }));

/** Betreibt das Fahrgeräusch eines Autos eine Weile und misst Pegel und Klangfarbe. */
const messen = (auto, { anteil = 0.6, gas = 1, schlupf = 0, dreht = 0, tempo = 25, ladedruck = 0 }) => s.evaluate(async ({ auto, anteil, gas, schlupf, dreht, tempo, ladedruck }) => {
  const a = window.__driftkoenig.audio;
  a.menueMusik(false);
  a.rennenEnde();
  const f = {
    p: { klang: auto.klang, drehzahlMax: auto.drehzahlMax, leerlauf: auto.leerlauf, turbo: auto.turbo ? {} : null },
    z: { drehzahl: auto.leerlauf + anteil * (auto.drehzahlMax - auto.leerlauf), schlupfNormH: schlupf, durchdrehen: dreht, ladedruck },
    tempo
  };
  const e = { fahrzeug: f, darstellung: { x: 0, y: 0 } };
  const ende = performance.now() + 900;
  let spitze = 0, rms = 0, zp = 0, n = 0;
  while (performance.now() < ende) {
    a.fahrt([e], e, gas);
    await new Promise((r) => setTimeout(r, 30));
    if (performance.now() > ende - 450) {
      const p = a.pegel();
      spitze = Math.max(spitze, p.spitze);
      rms += p.rms;
      zp += a.schwerpunkt();
      n++;
    }
  }
  a.rennenEnde();
  return { spitze, rms: rms / n, schwerpunkt: zp / n };
}, { auto, anteil, gas, schlupf, dreht, tempo, ladedruck });

const kestrel = daten[0];
const ruhig = await messen(kestrel, { anteil: 0, gas: 0, tempo: 0 });
const voll = await messen(kestrel, { anteil: 0.8, gas: 1 });
const hoch = await messen(kestrel, { anteil: 1, gas: 1 });
console.log('     Leerlauf', JSON.stringify(ruhig), '\n     Vollgas', JSON.stringify(voll));
pruefe(ruhig.rms > 0.002, 'Der Leerlauf ist hörbar');
pruefe(voll.rms > ruhig.rms * 1.6, 'Vollgas ist deutlich lauter als der Leerlauf');
pruefe(hoch.schwerpunkt > ruhig.schwerpunkt, 'Hohe Drehzahl klingt heller');
const ohne = await messen(kestrel, { anteil: 0.5, gas: 0.3, schlupf: 0 });
const quietscht = await messen(kestrel, { anteil: 0.5, gas: 0.3, schlupf: 1.8 });
console.log('     Ohne Schlupf', JSON.stringify(ohne), '\n     Mit Schlupf', JSON.stringify(quietscht));
pruefe(quietscht.rms > ohne.rms * 1.15 && quietscht.schwerpunkt > ohne.schwerpunkt, 'Schlupf hört man als helles Quietschen');

const proAuto = [];
for (const a of daten) {
  const m = await messen(a, { anteil: 0.7, gas: 1, schlupf: 0.5 });
  proAuto.push({ id: a.id, ...m });
  console.log(`     ${a.id.padEnd(14)} Schwerpunkt ${m.schwerpunkt.toFixed(0).padStart(5)} Hz, RMS ${m.rms.toFixed(3)}, Spitze ${m.spitze.toFixed(2)}`);
  pruefe(m.spitze <= 1.0, `${a.id}: Kein Übersteuern`);
}
const klangfarben = proAuto.map((m) => m.schwerpunkt).sort((x, y) => x - y);
let kleinster = Infinity;
for (let i = 1; i < klangfarben.length; i++) kleinster = Math.min(kleinster, klangfarben[i] - klangfarben[i - 1]);
pruefe(klangfarben[klangfarben.length - 1] / klangfarben[0] > 1.25, `Die Autos unterscheiden sich in der Klangfarbe (${klangfarben[0].toFixed(0)}–${klangfarben[klangfarben.length - 1].toFixed(0)} Hz)`);

// Stimmenbegrenzung und Kompressor: viele Knaller auf einmal
const salve = await s.evaluate(async () => {
  const a = window.__driftkoenig.audio;
  let maxStimmen = 0, spitze = 0;
  const f = { modell: { look: { backfire: 1 } } };
  for (let i = 0; i < 60; i++) {
    a.fahrzeugEreignis(f, { art: 'wand', staerke: 15 });
    a.fahrzeugEreignis(f, { art: 'fehlzuendung', staerke: 1 });
    a.ton('kasse');
    maxStimmen = Math.max(maxStimmen, a.stimmen);
    await new Promise((r) => setTimeout(r, 8));
    spitze = Math.max(spitze, a.pegel().spitze);
  }
  return { maxStimmen, spitze };
});
console.log('     Salve', JSON.stringify(salve));
pruefe(salve.maxStimmen <= 10, `Stimmen bleiben begrenzt (${salve.maxStimmen})`);
pruefe(salve.spitze <= 1.05, `Der Kompressor fängt die Salve ab (Spitze ${salve.spitze.toFixed(2)})`);
await s.waitForTimeout(800);

// Regler: Master 0 ist still, Musik läuft nur, wenn sie an ist
const regler = await s.evaluate(async () => {
  const sp = window.__driftkoenig;
  const a = sp.audio;
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  const e = sp.daten.einstellungen.audio;
  a.menueMusik(true);
  e.musikAn = true;
  e.musik = 1;
  e.master = 1;
  a.einstellungen(e);
  await warte(2500);
  let an = 0;
  for (let i = 0; i < 12; i++) { an = Math.max(an, a.pegel().rms); await warte(120); }
  e.musikAn = false;
  a.einstellungen(e);
  await warte(1800);
  let aus = 0;
  for (let i = 0; i < 6; i++) { aus = Math.max(aus, a.pegel().rms); await warte(100); }
  e.musikAn = true;
  e.master = 0;
  a.einstellungen(e);
  await warte(800);
  let stumm = 0;
  for (let i = 0; i < 6; i++) { stumm = Math.max(stumm, a.pegel().rms); await warte(100); }
  return { an, aus, stumm };
});
console.log('     Regler', JSON.stringify(regler));
pruefe(regler.an > 0.003, 'Die Menümusik spielt');
pruefe(regler.aus < regler.an * 0.2, 'Musik aus ist still');
pruefe(regler.stumm < 0.0005, 'Master 0 ist stumm');

pruefe(fehler.length === 0, 'Keine Fehler im Browser ' + fehler.join(' | ').slice(0, 200));
console.log(probleme.length === 0 ? 'Alles in Ordnung.' : `${probleme.length} Probleme.`);
await browser.close();
server.close();
process.exit(probleme.length ? 1 : 0);
