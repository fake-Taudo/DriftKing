// Prüft die Garage im installierten Edge gegen den laufenden Entwicklungsserver (npm run dev, Port 5173):
//  1. Alle Reiter öffnen sich fehlerfrei und ohne fehlende Texte.
//  2. Alle 6 Autos mit allen Varianten aller Slots und allen Felgen: Geometrie ohne NaN, Teile sitzen am Auto.
//  3. Alle Muster und Finishs lassen sich zeichnen; alle Aufkleber ergeben sichtbare Pixel.
// Aufruf: node scripts/garageCheck.js [ausgabeordner] [basisUrl]
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ausgabe = process.argv[2] || path.join(wurzel, 'test-results', 'garage');
const basis = process.argv[3] || 'http://localhost:5173';
mkdirSync(ausgabe, { recursive: true });

const edge = 'C:/Program Files (x86)/Microsoft/EdgeCore';
const browser = await chromium.launch({
  executablePath: `${edge}/${readdirSync(edge).sort().pop()}/msedge.exe`,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const seite = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const fehler = [];
seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));

await seite.goto(basis + '/', { waitUntil: 'load' });
await seite.waitForSelector('.menue-knopf', { timeout: 60000 });
await seite.waitForTimeout(400);
const willkommen = seite.locator('.dialog-hintergrund .knopf', { hasText: 'Überspringen' });
if (await willkommen.count()) await willkommen.click();
await seite.getByText('Garage', { exact: true }).click();
await seite.waitForSelector('.garage', { timeout: 60000 });
await seite.waitForTimeout(1500);

// 1. Alle Reiter
const reiter = await seite.$$eval('.garage-reiter-knopf', (k) => k.map((x) => x.dataset.reiter));
for (const r of reiter) {
  await seite.click(`.garage-reiter-knopf[data-reiter="${r}"]`);
  await seite.waitForTimeout(500);
  const text = await seite.$eval('.garage', (e) => e.innerText);
  if (text.includes('⟦')) fehler.push(`Reiter ${r}: fehlender Text: ` + text.match(/⟦[^⟧]*⟧/)[0]);
  await seite.screenshot({ path: path.join(ausgabe, `reiter-${r}.png`) });
}

// 2. und 3. Matrix im Browser
const pfad = '/@fs/' + wurzel.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/%3A/g, ':');
const ergebnis = await seite.evaluate(async (shared) => {
  const THREE = await import('/@id/three').catch(() => null);
  const { AutoModell } = await import('/render/auto/autoModell.js');
  const { AUTO_IDS } = await import(shared + '/shared/autos.js');
  const { standardLook } = await import(shared + '/shared/look.js');
  const { SLOTS, FELGEN, MUSTER, FINISHS } = await import(shared + '/shared/teile.js');
  const { AUFKLEBER } = await import('/assets/aufkleber.js');
  const { neuerAufkleber } = await import(shared + '/shared/aufkleberOps.js');
  const { zeichneAufkleber } = await import('/render/auto/aufkleberMaler.js');
  void THREE;
  const probleme = [];
  const zaehler = { kombinationen: 0, muster: 0, aufkleber: 0 };

  const box = (obj) => {
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], nan = 0;
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const a = o.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const w = a[i + k];
          if (!Number.isFinite(w)) nan++;
          else { if (w < min[k]) min[k] = w; if (w > max[k]) max[k] = w; }
        }
      }
    });
    return { min, max, nan };
  };

  for (const autoId of AUTO_IDS) {
    const look = standardLook(autoId);
    const m = new AutoModell(autoId, look, { qualitaet: { livery: 512, schatten: 'blob' } });
    const { W, H, zFront, zHeck } = m.k.masse;
    for (const s of SLOTS) {
      for (let v = 0; v < s.varianten.length; v++) {
        const l = standardLook(autoId);
        l.teile[s.id].variante = v;
        m.setzeLook(l);
        const b = box(m.teile);
        zaehler.kombinationen++;
        if (b.nan) probleme.push(`${autoId} ${s.id}:${v}: ${b.nan} ungültige Werte`);
        if (v > 0 && b.min[0] === Infinity && s.id !== 'spoiler') probleme.push(`${autoId} ${s.id}:${v}: keine Geometrie`);
        if (v > 0 && b.max[0] !== -Infinity) {
          const rand = 0.55;
          if (b.max[0] > W + rand || b.min[0] < -W - rand) probleme.push(`${autoId} ${s.id}:${v}: seitlich außerhalb (${b.min[0].toFixed(2)}…${b.max[0].toFixed(2)}, W=${W.toFixed(2)})`);
          if (b.max[2] > zFront + rand || b.min[2] < zHeck - rand) probleme.push(`${autoId} ${s.id}:${v}: längs außerhalb (${b.min[2].toFixed(2)}…${b.max[2].toFixed(2)})`);
          if (b.max[1] > H + 0.75 || b.min[1] < -0.02) probleme.push(`${autoId} ${s.id}:${v}: Höhe außerhalb (${b.min[1].toFixed(2)}…${b.max[1].toFixed(2)})`);
        }
      }
    }
    for (const f of FELGEN) {
      for (const groesse of [15, 20]) {
        for (const breite of [6.5, 11]) {
          const l = standardLook(autoId);
          l.felgen.design = f.id;
          l.felgen.groesse = groesse;
          l.felgen.breite = breite;
          l.felgen.flankeLinie = true;
          m.setzeLook(l);
          const b = box(m.raeder.objekt);
          zaehler.kombinationen++;
          if (b.nan) probleme.push(`${autoId} Felge ${f.id} ${groesse}/${breite}: ${b.nan} ungültige Werte`);
        }
      }
    }
    // Vollausstattung, Finishs
    const voll = standardLook(autoId);
    for (const s of SLOTS) voll.teile[s.id].variante = s.varianten.length - 1;
    voll.neon.an = true;
    for (const fin of FINISHS) {
      voll.lack.finish = fin.id;
      m.setzeLook(voll);
    }
    if (box(m.objekt).nan) probleme.push(`${autoId}: Vollausstattung mit ungültigen Werten`);
    m.freigeben();
  }

  // Muster: alle zeichnen und prüfen, dass sich die Textur ändert
  const mod = new AutoModell('kestrel_s', standardLook('kestrel_s'), { qualitaet: { livery: 512, schatten: 'blob' } });
  const summe = () => {
    const d = mod.livery.ctx.getImageData(0, 0, 512, 512).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 97) s += d[i];
    return s;
  };
  const basisSumme = summe();
  for (const mu of MUSTER) {
    if (mu.id === 'keins') continue;
    const l = standardLook('kestrel_s');
    l.muster = { id: mu.id, farbe: '#00ffff', deckkraft: 1, skala: 1 };
    mod.setzeLook(l);
    zaehler.muster++;
    if (summe() === basisSumme) probleme.push(`Muster ${mu.id}: zeichnet nichts`);
  }
  mod.freigeben();

  // Aufkleber: jeder muss sichtbare Pixel ergeben
  const c = document.createElement('canvas');
  c.width = c.height = 120;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  for (const a of AUFKLEBER) {
    ctx.clearRect(0, 0, 120, 120);
    const k = { ...neuerAufkleber(a.id, 'haube'), x: 0.5, y: 0.5, skala: 1 };
    zeichneAufkleber(ctx, k, 120, 120, { b: 1, h: 1 });
    const d = ctx.getImageData(0, 0, 120, 120).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
    zaehler.aufkleber++;
    if (n < 80) probleme.push(`Aufkleber ${a.id}: nur ${n} sichtbare Pixel`);
    if (n > 120 * 120 * 0.96) probleme.push(`Aufkleber ${a.id}: füllt die ganze Fläche (Pfad falsch?)`);
  }
  return { probleme, zaehler };
}, pfad);

console.log(JSON.stringify(ergebnis.zaehler));
for (const p of ergebnis.probleme) console.log('PROBLEM:', p);
for (const f of fehler) console.log('KONSOLE:', f.slice(0, 300));
console.log(ergebnis.probleme.length + fehler.length === 0 ? 'Alles in Ordnung.' : `${ergebnis.probleme.length} Probleme, ${fehler.length} Konsolenfehler.`);
await browser.close();
process.exit(ergebnis.probleme.length ? 1 : 0);
