// Geschenk-Code im echten Spiel: Symbol unter dem Logo, Dialog, falscher Code, „Release“, zweiter Versuch, Neuladen.
// Prüft außerdem, dass das Symbol nichts verdeckt und alle Menüpunkte erreichbar bleiben.
// Aufruf: node scripts/codeAblauf.js [ausgabeordner] [ansicht]   Vorher: npm run build
// Standard ist die echte Grafikkarte, mit GPU=0 Software-Rendering.
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { erzeugeApp } from '../server/app.js';
import { starteSpielServer } from '../server/spielServer.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ausgabe = process.argv[2] || path.join(wurzel, 'test-results', 'code');
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

const server = http.createServer(erzeugeApp());
const sp = starteSpielServer(server);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const basis = `http://127.0.0.1:${server.address().port}`;
const edge = 'C:/Program Files (x86)/Microsoft/EdgeCore';
const browser = await chromium.launch({
  executablePath: `${edge}/${readdirSync(edge).sort().pop()}/msedge.exe`,
  headless: true,
  args: process.env.GPU === '0' ? ['--enable-unsafe-swiftshader'] : ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11']
});

const probleme = [];
const merken = (t) => { console.log('FEHLER ' + t); probleme.push(t); };
const pruefe = (bedingung, t) => { if (!bedingung) merken(t); };

/** Symbol unter dem Logo, im Bild, von nichts verdeckt; es verdeckt nichts; jeder Menüpunkt lässt sich anklicken. */
function lage() {
  const fehler = [];
  const k = document.querySelector('.menue-geschenk').getBoundingClientRect();
  const logo = document.querySelector('.menue-logo').getBoundingClientRect();
  if (k.top < logo.bottom - 1) fehler.push(`Symbol nicht unter dem Logo (${Math.round(k.top)} < ${Math.round(logo.bottom)})`);
  if (Math.abs(k.left - logo.left) > 6) fehler.push(`Symbol nicht links am Logo (${Math.round(k.left)} / ${Math.round(logo.left)})`);
  if (document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2)?.closest('.menue-geschenk') == null) fehler.push('Symbol wird verdeckt');
  for (const el of document.querySelectorAll('.menue-titel, .menue-knopf, .tages-box, .menue-muenzen, .menue-auto-info')) {
    const r = el.getBoundingClientRect();
    const x = Math.min(k.right, r.right) - Math.max(k.left, r.left);
    const y = Math.min(k.bottom, r.bottom) - Math.max(k.top, r.top);
    if (x > 1 && y > 1) fehler.push(`Symbol überlappt ${el.className}`);
  }
  const liste = document.querySelector('.menue-liste');
  return { fehler, scrollt: liste.scrollHeight > liste.clientHeight + 1, knopf: Math.round(k.width) + '×' + Math.round(k.height) };
}

for (const a of ANSICHTEN) {
  console.log(`--- ${a.name} (${a.breite}×${a.hoehe})`);
  const k = await browser.newContext({ viewport: { width: a.breite, height: a.hoehe }, serviceWorkers: 'block', hasTouch: a.touch });
  const s = await k.newPage();
  const konsole = [];
  s.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text()); });
  s.on('pageerror', (e) => konsole.push('pageerror: ' + e.message));
  const geld = () => s.evaluate(() => window.__driftkoenig.daten.waehrung);
  const anzeige = async () => Number((await s.locator('.menue-muenzen').textContent()).replace(/\D/g, ''));
  const bild = (name) => s.screenshot({ path: path.join(ausgabe, `${a.name}-${name}.png`) });
  const klick = async (sel) => { if (a.touch) await s.locator(sel).tap(); else await s.locator(sel).click(); };

  await s.goto(basis + '/', { waitUntil: 'load' });
  await s.locator('.menue-knopf').first().waitFor({ timeout: 60000 });
  const w = s.locator('.dialog-hintergrund .knopf', { hasText: 'Überspringen' });
  await w.waitFor({ timeout: 5000 }).catch(() => {});
  if (await w.count()) await w.click();
  await s.waitForTimeout(600);

  for (const ansicht of ['haupt', 'spielen']) {
    const l = await s.evaluate(lage);
    for (const f of l.fehler) merken(`${a.name}/${ansicht}: ${f}`);
    if (l.scrollt) merken(`${a.name}/${ansicht}: Die Menüliste muss scrollen`);
    console.log(`  ${ansicht}: Knopf ${l.knopf}`);
    await bild('menue-' + ansicht);
    if (ansicht === 'haupt') {
      await s.getByText('Spielen', { exact: true }).click();
      await s.waitForTimeout(500);
    }
  }
  await s.getByText('Zurück', { exact: true }).click();
  await s.waitForTimeout(300);

  const start = await geld();
  await klick('.menue-geschenk');
  await s.locator('.code-feld').waitFor();
  await s.waitForTimeout(100);
  pruefe((await s.locator('.code-feld').getAttribute('placeholder')) === 'CODE EINGEBEN', `${a.name}: Feld zeigt nicht CODE EINGEBEN`);
  pruefe(await s.evaluate(() => document.activeElement?.classList.contains('code-feld')), `${a.name}: Feld hat keinen Fokus`);
  await bild('dialog');

  // Leer, dann falsch: Dialog bleibt offen, Geld unverändert
  await klick('.dialog .knopf.haupt');
  pruefe((await s.locator('.code-meldung').textContent()).includes('gib einen Code'), `${a.name}: keine Meldung bei leerer Eingabe`);
  await s.locator('.code-feld').pressSequentially('Falsch');
  await klick('.dialog .knopf.haupt');
  pruefe((await s.locator('.code-meldung').textContent()).includes('gibt es nicht'), `${a.name}: keine Meldung bei falschem Code`);
  pruefe((await geld()) === start, `${a.name}: falscher Code hat das Guthaben geändert`);
  await bild('falsch');

  // Richtig, mit echten Tastendrücken und Enter
  await s.locator('.code-feld').fill('');
  pruefe((await s.locator('.code-meldung').textContent()) === '', `${a.name}: Meldung bleibt beim Tippen stehen`);
  await s.locator('.code-feld').pressSequentially('Release');
  pruefe((await s.locator('.code-feld').inputValue()) === 'Release', `${a.name}: Eingabe kam nicht vollständig an`);
  await s.keyboard.press('Enter');
  await s.locator('.dialog-hintergrund').waitFor({ state: 'detached' });
  pruefe((await geld()) === start + 7500, `${a.name}: Guthaben ${await geld()} statt ${start + 7500}`);
  pruefe((await anzeige()) === start + 7500, `${a.name}: Anzeige ${await anzeige()} statt ${start + 7500}`);
  pruefe(await s.locator('.toast', { hasText: '+7.500 Driftmünzen' }).count(), `${a.name}: keine Erfolgsmeldung`);
  await bild('erfolg');

  // Bleibt nach dem Neuladen gebucht und gesperrt
  await s.reload({ waitUntil: 'load' });
  await s.locator('.menue-knopf').first().waitFor({ timeout: 60000 });
  await w.waitFor({ timeout: 3000 }).catch(() => {});
  if (await w.count()) await w.click();
  await s.waitForTimeout(300);
  pruefe((await geld()) === start + 7500, `${a.name}: Nach Neuladen ${await geld()} statt ${start + 7500}`);
  await klick('.menue-geschenk');
  await s.locator('.code-feld').pressSequentially('release');
  await klick('.dialog .knopf.haupt');
  pruefe((await s.locator('.code-meldung').textContent()).includes('schon eingelöst'), `${a.name}: zweite Einlösung nicht abgelehnt`);
  pruefe((await geld()) === start + 7500, `${a.name}: zweite Einlösung hat gebucht`);
  await bild('schon-eingeloest');

  // Abbrechen schließt, Esc auch, und der Rest des Menüs funktioniert danach
  await klick('.dialog .knopf.geist');
  await s.locator('.dialog-hintergrund').waitFor({ state: 'detached' });
  await klick('.menue-geschenk');
  await s.locator('.code-feld').waitFor();
  await s.keyboard.press('Escape');
  await s.locator('.dialog-hintergrund').waitFor({ state: 'detached' });
  await s.getByText('Shop', { exact: true }).click();
  await s.locator('.shop-liste').waitFor({ timeout: 60000 });

  for (const f of konsole) merken(`${a.name}: Konsole: ${f}`);
  await k.close();
}

await browser.close();
sp.schliessen?.();
server.close();
console.log(probleme.length ? `\n${probleme.length} Probleme` : '\nGeschenk-Code ohne Probleme');
process.exit(probleme.length ? 1 : 0);
