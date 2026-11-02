// Oberflächen-Test auf dem Produktionsbuild: alle wichtigen Bildschirme in allen Seitenverhältnissen.
// Prüft automatisch, dass nichts über den Bildschirm hinausragt und sich die Elemente im Rennen nicht überlappen,
// und legt von jedem Bildschirm ein Foto ab.
// Aufruf: node scripts/uiAblauf.js [ausgabeordner] [ansicht]   Vorher: npm run build
// Standard ist Software-Rendering (läuft auch ohne Grafikkarte, stürzte im Gesamtlauf bei 1080p aber mehrfach ab,
// siehe docs/PERFORMANCE.md). Mit GPU=1 läuft der Test auf der echten Grafikkarte, das ist die verlässliche Variante.
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { erzeugeApp } from '../server/app.js';
import { starteSpielServer } from '../server/spielServer.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ausgabe = process.argv[2] || path.join(wurzel, 'test-results', 'ui');
const nurAnsicht = process.argv[3] || null;
mkdirSync(ausgabe, { recursive: true });

const ANSICHTEN = [
  { name: 'handy-hoch', breite: 390, hoehe: 844, touch: true },
  { name: 'handy-quer', breite: 844, hoehe: 390, touch: true },
  { name: 'klein-hoch', breite: 360, hoehe: 640, touch: true },
  { name: 'klein-quer', breite: 667, hoehe: 375, touch: true },
  { name: 'ipad-hoch', breite: 820, hoehe: 1180, touch: true },
  { name: 'ipad-quer', breite: 1180, hoehe: 820, touch: true },
  { name: 'desktop', breite: 1920, hoehe: 1080, touch: false }
].filter((a) => !nurAnsicht || a.name === nurAnsicht);

let sp;
const app = erzeugeApp({ statusInfo: () => sp.status() });
const server = http.createServer(app);
sp = starteSpielServer(server);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const basis = `http://127.0.0.1:${server.address().port}`;

const edge = 'C:/Program Files (x86)/Microsoft/EdgeCore';
// Je Ansicht ein neuer Browser: Eine Ansicht soll die nächste nicht beeinflussen
const browserStarten = () => chromium.launch({
  executablePath: `${edge}/${readdirSync(edge).sort().pop()}/msedge.exe`,
  headless: true,
  args: process.env.GPU
    ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
});

const probleme = [];
const merken = (text) => {
  console.log('FEHLER ' + text);
  probleme.push(text);
};

/**
 * Prüfung im Browser: sichtbare Texte und Knöpfe dürfen nicht über den Bildschirm hinausragen.
 * Was in einem scrollbaren Bereich liegt, darf zum Scrollen hinausragen, muss dort aber die Breite einhalten.
 */
function ueberstand() {
  const B = window.innerWidth, H = window.innerHeight;
  const fehler = [];
  if (document.documentElement.scrollWidth > B + 1) fehler.push(`Seite ist breiter als der Bildschirm (${document.documentElement.scrollWidth} > ${B})`);
  const pfad = (el) => el.className && typeof el.className === 'string' ? el.tagName.toLowerCase() + '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase();
  // Liegt ein Bildschirm oder Dialog darüber, zählt nur dieser
  const oben = [...document.querySelectorAll('#overlay > .bildschirm, #overlay > .layout-editor, #overlay > .dialog-hintergrund, #ui > .dialog-hintergrund, body > .dialog-hintergrund')].pop();
  const elemente = oben
    ? oben.querySelectorAll('button, h2, h3, input, .zeile, .teil-karte')
    : document.querySelectorAll('#ui button, #overlay button, #ui h2, #overlay h2, #ui h3, #overlay h3, #overlay input, #overlay .zeile, #overlay .teil-karte');
  const scrollt = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return p;
      if (s.overflow === 'hidden' && p.classList.contains('touch-steuerung')) return p;
    }
    return null;
  };
  for (const el of elemente) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const box = scrollt(el);
    if (box) {
      const b = box.getBoundingClientRect();
      const quer = getComputedStyle(box).overflowX;
      if (!/(auto|scroll)/.test(quer) && (r.right > Math.min(B, b.right) + 2 || r.left < Math.max(0, b.left) - 2)) fehler.push(`${pfad(el)} ragt seitlich aus dem Bereich`);
      continue;
    }
    if (r.right > B + 2 || r.left < -2 || r.bottom > H + 2 || r.top < -2) fehler.push(`${pfad(el)} (${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}) ragt aus dem Bild`);
  }
  // Abgeschnittene Texte in Knöpfen
  for (const el of document.querySelectorAll('#overlay button.knopf, #ui button.knopf')) {
    if (el.offsetParent && el.scrollWidth > el.clientWidth + 2) fehler.push(`Text passt nicht in den Knopf: „${el.textContent.trim().slice(0, 24)}“`);
  }
  return [...new Set(fehler)].slice(0, 8);
}

/** Shop: Das „NEU“-Abzeichen darf keinen Text verdecken. Gemessen wird der Text selbst, nicht sein Kasten. */
function abzeichenUeberText() {
  const fehler = [];
  for (const b of document.querySelectorAll('.shop-neu')) {
    const r = b.getBoundingClientRect();
    if (r.width < 1) continue;
    for (const t of b.parentElement.querySelectorAll('.teil-name, .shop-unter, .teil-preis')) {
      const bereich = document.createRange();
      bereich.selectNodeContents(t);
      for (const z of bereich.getClientRects()) {
        const x = Math.min(r.right, z.right) - Math.max(r.left, z.left);
        const y = Math.min(r.bottom, z.bottom) - Math.max(r.top, z.top);
        if (x > 1 && y > 1) fehler.push(`„NEU“ verdeckt „${t.textContent.slice(0, 28)}“ (${Math.round(x)}×${Math.round(y)} px)`);
      }
    }
  }
  return [...new Set(fehler)];
}

/** Im Rennen: Die festen Elemente dürfen sich nicht überlappen. */
function hudUeberlappung() {
  const gruppen = ['.hud-minimap', '.hud-oben', '.hud-pause', '.hud-tacho', '.touch-knopf'];
  const teile = [];
  for (const g of gruppen) {
    for (const el of document.querySelectorAll(g)) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) teile.push({ g, r, el });
    }
  }
  const fehler = [];
  for (let i = 0; i < teile.length; i++) {
    for (let k = i + 1; k < teile.length; k++) {
      const a = teile[i], b = teile[k];
      if (a.g === b.g || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (x > 3 && y > 3) fehler.push(`${a.g} überlappt ${b.g} (${Math.round(x)}×${Math.round(y)} px)`);
    }
  }
  return [...new Set(fehler)];
}

for (const a of ANSICHTEN) {
  console.log(`--- ${a.name} (${a.breite}×${a.hoehe})`);
  const browser = await browserStarten();
  const k = await browser.newContext({ viewport: { width: a.breite, height: a.hoehe }, serviceWorkers: 'block', hasTouch: a.touch });
  const s = await k.newPage();
  const konsole = [];
  s.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text()); });
  s.on('pageerror', (e) => konsole.push('pageerror: ' + e.message));
  const fertig = async (name, { hud = false } = {}) => {
    await s.waitForTimeout(450);
    await s.screenshot({ path: path.join(ausgabe, `${a.name}-${name}.png`) });
    for (const f of await s.evaluate(ueberstand)) merken(`${a.name}/${name}: ${f}`);
    if (hud) for (const f of await s.evaluate(hudUeberlappung)) merken(`${a.name}/${name}: ${f}`);
  };
  const klick = async (text, wurzelSel = 'body') => s.locator(wurzelSel).getByText(text, { exact: true }).first().click();
  const zurueck = async () => s.locator('[aria-label="Zurück"], .wahl-kopf .knopf.geist.klein').first().click();

  await s.goto(basis + '/', { waitUntil: 'load' });
  await s.waitForSelector('.menue-knopf', { timeout: 60000 });
  await s.waitForTimeout(600);
  await fertig('willkommen');
  const w = s.locator('.dialog-hintergrund .knopf', { hasText: 'Überspringen' });
  if (await w.count()) await w.click();
  await s.evaluate(() => window.__driftkoenig.qualitaet.setzeEinstellung('niedrig'));
  await fertig('menue');

  await klick('Spielen');
  await s.waitForTimeout(200);
  await fertig('spielen');
  await klick('Tandem-Battle');
  await s.waitForSelector('.battle-wahl', { timeout: 15000 });
  await fertig('battle-wahl');
  await s.evaluate(() => { window.__driftkoenig.testAutopilot = 'profi'; });
  await s.locator('.battle-wahl .knopf.haupt.gross').click();
  await s.waitForSelector('.hud.battle', { timeout: 60000 });
  if (a.touch) await s.evaluate(() => window.__driftkoenig.eingabe.touch.zeigen(true));
  await s.waitForTimeout(2500);
  await fertig('hud-countdown', { hud: true });
  await s.waitForFunction(() => window.__driftkoenig.modus.zustand === 'laeuft', null, { timeout: 30000 });
  await s.waitForTimeout(5000);
  await fertig('hud-fahrt', { hud: true });
  await s.evaluate(() => window.__driftkoenig.modus.pause());
  await s.waitForSelector('.pause-menue');
  await fertig('pause');
  await s.locator('.pause-menue .knopf').first().click();
  await s.waitForTimeout(200);
  // Ergebnis mit Aufschlüsselung: Battle direkt beenden
  await s.evaluate(() => {
    const m = window.__driftkoenig.modus;
    m.ablauf.aufgeben('B');
    m._battleEnde();
  });
  await s.waitForSelector('.ergebnis-bildschirm h2', { timeout: 10000 });
  await s.waitForTimeout(1000);
  await fertig('ergebnis');
  await s.locator('.ergebnis-bildschirm .knopf', { hasText: 'Menü' }).click();
  await s.waitForSelector('.menue-knopf', { timeout: 30000 });

  await s.getByText('Online-Duell', { exact: true }).click();
  await s.waitForSelector('.code-eingabe', { timeout: 15000 });
  await fertig('online-start');
  await s.locator('.knopf.haupt', { hasText: 'Duell erstellen' }).click();
  await s.waitForSelector('.code-gross', { timeout: 15000 });
  await fertig('online-lobby');
  await zurueck();
  await s.waitForSelector('.menue-knopf', { timeout: 15000 });

  await s.getByText('Shop', { exact: true }).click();
  await s.waitForSelector('.shop-liste', { timeout: 60000 });
  await fertig('shop');
  for (const r of await s.locator('.garage-reiter-knopf').evaluateAll((l) => l.map((x) => x.dataset.reiter))) {
    await s.click(`.garage-reiter-knopf[data-reiter="${r}"]`);
    await s.waitForTimeout(120);
    for (const f of await s.evaluate(abzeichenUeberText)) merken(`${a.name}/shop-${r}: ${f}`);
  }
  await zurueck();
  await s.waitForSelector('.menue-knopf', { timeout: 30000 });

  await s.getByText('Garage', { exact: true }).click();
  await s.waitForSelector('.garage', { timeout: 60000 });
  await s.waitForTimeout(800);
  for (const r of await s.locator('.garage-reiter-knopf').evaluateAll((l) => l.map((x) => x.dataset.reiter))) {
    await s.click(`.garage-reiter-knopf[data-reiter="${r}"]`);
    await fertig('garage-' + r);
  }
  // Fotomodus
  await s.locator('.ansicht-knopf', { hasText: 'Foto' }).click();
  await fertig('garage-foto');
  await s.locator('.knopf.geist.klein', { hasText: '←' }).last().click();
  await s.waitForTimeout(200);
  await zurueck();
  await s.waitForSelector('.menue-knopf', { timeout: 30000 });

  await s.getByText('Einstellungen', { exact: true }).click();
  await s.waitForSelector('.einstellungen-bildschirm');
  const anzahl = await s.locator('.einst-reiter button').count();
  for (let i = 0; i < anzahl; i++) {
    await s.locator('.einst-reiter button').nth(i).click();
    await fertig('einstellungen-' + i);
    // Layout-Editor der Touch-Tasten
    const bearbeiten = s.locator('.einstellungen-bildschirm .knopf.klein', { hasText: 'Bearbeiten' });
    if (await bearbeiten.count()) {
      await bearbeiten.click();
      await s.waitForSelector('.layout-editor');
      await fertig('layout-editor');
      await s.locator('.layout-editor .knopf', { hasText: 'Abbrechen' }).click();
      await s.waitForTimeout(200);
    }
  }
  await zurueck();

  // Barrierefreiheit: größte Schrift, Farbenblind-Modus, reduzierte Effekte
  await s.evaluate(() => {
    const sp2 = window.__driftkoenig;
    const b = sp2.daten.einstellungen.barrierefreiheit;
    b.schriftgroesse = 2;
    b.farbenblind = true;
    b.reduzierteEffekte = true;
    sp2.einstellungenAnwenden();
  });
  await s.waitForSelector('.menue-knopf', { timeout: 15000 });
  await fertig('gross-menue');
  await s.getByText('Shop', { exact: true }).click();
  await s.waitForSelector('.shop-liste', { timeout: 60000 });
  for (const r of await s.locator('.garage-reiter-knopf').evaluateAll((l) => l.map((x) => x.dataset.reiter))) {
    await s.click(`.garage-reiter-knopf[data-reiter="${r}"]`);
    await s.waitForTimeout(120);
    for (const f of await s.evaluate(abzeichenUeberText)) merken(`${a.name}/gross-shop-${r}: ${f}`);
  }
  await fertig('gross-shop');
  await zurueck();
  await s.waitForSelector('.menue-knopf', { timeout: 30000 });
  await klick('Spielen');
  await s.waitForTimeout(200);
  await klick('Tandem-Battle');
  await s.waitForSelector('.battle-wahl', { timeout: 15000 });
  await fertig('gross-battle-wahl');
  await s.locator('.battle-wahl .knopf.haupt.gross').click();
  await s.waitForSelector('.hud.battle', { timeout: 60000 });
  if (a.touch) await s.evaluate(() => window.__driftkoenig.eingabe.touch.zeigen(true));
  await s.waitForFunction(() => window.__driftkoenig.modus.zustand === 'laeuft', null, { timeout: 30000 });
  await s.waitForTimeout(3000);
  await fertig('gross-hud', { hud: true });
  const zugang = await s.evaluate(() => {
    const sp2 = window.__driftkoenig;
    const m = sp2.modus;
    m.zeitlupe(1, 0.3);
    m.rennKamera.stoss(1);
    m.rennKamera.kamerafahrt(() => m.spieler.darstellung, 1);
    return {
      klassen: document.documentElement.className,
      vfx: m.vfx.reduziert,
      linien: m.vfx.linien.objekt.visible,
      vignette: m.vfx.mitVignette,
      zeitFaktor: sp2.schleife.zeitFaktor,
      fahrt: !!m.rennKamera.fahrt,
      wackeln: m.rennKamera.wackeln,
      symbol: document.querySelector('.hud-abstand .symbol')?.textContent
    };
  });
  if (!zugang.klassen.includes('reduziert') || !zugang.klassen.includes('farbenblind') || !zugang.klassen.includes('schrift-2')) merken(`${a.name}: Klassen fehlen: ${zugang.klassen}`);
  if (!zugang.vfx || zugang.linien || zugang.vignette) merken(`${a.name}: Reduzierte Effekte greifen nicht: ${JSON.stringify(zugang)}`);
  if (zugang.zeitFaktor !== 1 || zugang.fahrt || zugang.wackeln > 0) merken(`${a.name}: Zeitlupe, Kamerafahrt oder Wackeln trotz „reduziert“: ${JSON.stringify(zugang)}`);
  if (!zugang.symbol) merken(`${a.name}: Abstandsanzeige ohne Symbol`);

  for (const f of konsole) {
    if (/Failed to load resource|favicon/.test(f)) continue;
    merken(`${a.name}: Konsole: ${f.slice(0, 200)}`);
  }
  await browser.close();
}

console.log(probleme.length === 0 ? 'Alles in Ordnung.' : `${probleme.length} Probleme.`);
sp.beenden();
server.close();
process.exit(probleme.length ? 1 : 0);
