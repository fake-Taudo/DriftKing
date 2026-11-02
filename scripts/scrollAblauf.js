// Scrollen per Touch auf dem Produktionsbuild: echte Berührungen (Input.dispatchTouchEvent) auf allen Bildschirmen
// mit langem Inhalt, im Hoch- und Querformat und mit großer Schrift. Geprüft wird, dass sich jeder überlaufende
// Bereich wirklich bewegt und sein Ende erreichbar ist, und dass die Spielfläche im Rennen nicht scrollt.
// Input.synthesizeScrollGesture taugt dafür nicht: Es erzeugt hier kein touchmove und scrollt nie.
// Dazu: Tippen, Schieberegler, Aufkleber ziehen und die Touch-Tasten im Rennen funktionieren weiter.
// Aufruf: node scripts/scrollAblauf.js [ausgabeordner] [ansicht]   Vorher: npm run build
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { erzeugeApp } from '../server/app.js';
import { starteSpielServer } from '../server/spielServer.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ausgabe = process.argv[2] || path.join(wurzel, 'test-results', 'scroll');
mkdirSync(ausgabe, { recursive: true });

const ANSICHTEN = [
  { name: 'klein-hoch', breite: 360, hoehe: 640 },
  { name: 'klein-quer', breite: 667, hoehe: 375 },
  { name: 'handy-hoch', breite: 390, hoehe: 844 },
  { name: 'handy-quer', breite: 844, hoehe: 390 },
  { name: 'gross-hoch', breite: 360, hoehe: 640, schrift: 2 },
  { name: 'gross-quer', breite: 667, hoehe: 375, schrift: 2 }
].filter((a) => !process.argv[3] || a.name === process.argv[3]);

let sp;
const server = http.createServer(erzeugeApp({ statusInfo: () => sp.status() }));
sp = starteSpielServer(server);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const basis = `http://127.0.0.1:${server.address().port}`;
const edge = 'C:/Program Files (x86)/Microsoft/EdgeCore';

const probleme = [];
let geprueft = 0;
const merken = (t) => {
  console.log('FEHLER ' + t);
  probleme.push(t);
};

/** Alle sichtbaren Bereiche, die senkrecht überlaufen, auf dem obersten Bildschirm. Liefert Bildmitte und Kennung. */
function bereiche() {
  const oben = [...document.querySelectorAll('#overlay > .bildschirm, #overlay > .dialog-hintergrund, body > .dialog-hintergrund')].filter((e) => getComputedStyle(e).display !== 'none').pop();
  const wurzelEl = oben || document.querySelector('#ui');
  const liste = [];
  document.querySelectorAll('[data-scroll-test]').forEach((e) => delete e.dataset.scrollTest);
  for (const el of [wurzelEl, ...wurzelEl.querySelectorAll('*')]) {
    const s = getComputedStyle(el);
    const senkrecht = /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2;
    const quer = /(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 2;
    if (!senkrecht && !quer) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 20 || s.visibility === 'hidden') continue;
    // Eine Stelle im Bereich, die wirklich oben liegt (kein Schieber, kein Eingabefeld)
    let punkt = null;
    for (let y = r.top + r.height * 0.75; y > r.top + 4 && !punkt; y -= 12) {
      for (const fx of [0.5, 0.12, 0.88]) {
        const x = r.left + r.width * fx;
        const t = document.elementFromPoint(x, y);
        if (t && el.contains(t) && !t.closest('input, textarea, select, canvas')) { punkt = { x, y }; break; }
      }
    }
    el.dataset.scrollTest = String(liste.length);
    liste.push({
      nr: liste.length,
      name: (el.className || el.tagName).toString().trim().split(/\s+/).slice(0, 2).join('.'),
      punkt,
      kasten: { top: r.top, left: r.left, breite: r.width, hoehe: r.height },
      quer: !senkrecht,
      ueberlauf: senkrecht ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth,
      sichtbar: r.top >= -1 && r.bottom <= innerHeight + 1
    });
  }
  return liste;
}

for (const a of ANSICHTEN) {
  console.log(`--- ${a.name} (${a.breite}×${a.hoehe})`);
  const browser = await chromium.launch({
    executablePath: `${edge}/${readdirSync(edge).sort().pop()}/msedge.exe`,
    headless: true,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11']
  });
  const k = await browser.newContext({ viewport: { width: a.breite, height: a.hoehe }, serviceWorkers: 'block', hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const s = await k.newPage();
  const cdp = await k.newCDPSession(s);
  const konsole = [];
  s.on('pageerror', (e) => konsole.push(e.message));
  s.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|Service Worker/.test(m.text())) konsole.push(m.text()); });

  /** Echte Berührung: drücken, in kleinen Schritten ziehen, loslassen. */
  const ziehen = async (x0, y0, x1, y1, halten = false) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 8, y: y0 + ((y1 - y0) * i) / 8 }] });
      await s.waitForTimeout(16);
    }
    if (!halten) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };

  /** Wischt über jeden überlaufenden Bereich, bis sein Ende erreicht ist. */
  const pruefen = async (name) => {
    await s.waitForTimeout(350);
    await s.screenshot({ path: path.join(ausgabe, `${a.name}-${name}.png`) });
    const liste = await s.evaluate(bereiche);
    for (const b of liste) {
      geprueft++;
      const stelle = `${a.name}/${name}/${b.name}`;
      if (!b.sichtbar) merken(`${stelle}: Der Bereich ragt selbst aus dem Bild`);
      if (!b.punkt) { merken(`${stelle}: Keine Stelle zum Anfassen`); continue; }
      const stand = () => s.evaluate(({ nr, quer }) => {
        const el = document.querySelector(`[data-scroll-test="${nr}"]`);
        return quer ? { top: el.scrollLeft, max: el.scrollWidth - el.clientWidth } : { top: el.scrollTop, max: el.scrollHeight - el.clientHeight };
      }, b);
      // Immer am Anfang beginnen: Der aktive Reiter rückt seine Leiste sonst schon ans Ende
      await s.evaluate((nr) => {
        const el = document.querySelector(`[data-scroll-test="${nr}"]`);
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }, b.nr);
      await s.waitForTimeout(40);
      const vorher = await stand();
      const verlauf = [];
      for (let i = 0; i < 40; i++) {
        const st = await stand();
        verlauf.push(Math.round(st.top));
        if (st.top >= st.max - 2) break;
        if (b.quer) await ziehen(b.punkt.x, b.punkt.y, Math.max(b.kasten.left + 4, b.punkt.x - b.kasten.breite * 0.6), b.punkt.y);
        else await ziehen(b.punkt.x, b.punkt.y, b.punkt.x, Math.max(b.kasten.top + 4, b.punkt.y - b.kasten.hoehe * 0.6));
        await s.waitForTimeout(60);
        // Ist nach zwei Versuchen nichts passiert, bewegt es sich auch später nicht
        if (i === 1 && (await stand()).top <= vorher.top + 1) break;
      }
      const nachher = await stand();
      if (nachher.top <= vorher.top + 1) merken(`${stelle}: Wischen bewegt nichts (Überlauf ${b.ueberlauf} px)`);
      else if (nachher.top < nachher.max - 3) merken(`${stelle}: Ende nicht erreichbar (${Math.round(nachher.top)} von ${Math.round(nachher.max)} px, Punkt ${Math.round(b.punkt.y)}, Kasten ${Math.round(b.kasten.top)}+${Math.round(b.kasten.hoehe)}, Verlauf ${verlauf.slice(0, 14).join(' ')})`);
      // Das letzte Element muss nun im Bild liegen
      const ende = b.quer || await s.evaluate((nr) => {
        const el = document.querySelector(`[data-scroll-test="${nr}"]`);
        const letztes = [...el.querySelectorAll('button, input, select, h3, .zeile')].filter((x) => x.getBoundingClientRect().height > 0).pop();
        if (!letztes) return true;
        const r = letztes.getBoundingClientRect();
        return r.bottom <= innerHeight + 1;
      }, b.nr);
      if (!ende) merken(`${stelle}: Das letzte Element bleibt unter dem Bildrand`);
      await s.evaluate((nr) => {
        const el = document.querySelector(`[data-scroll-test="${nr}"]`);
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }, b.nr);
    }
    console.log(`     ${name}: ${liste.length ? liste.map((b) => `${b.name} (+${b.ueberlauf})`).join(', ') : 'passt ohne Scrollen'}`);
  };
  const bereitsSichtbar = (sel) => s.locator(sel).first().scrollIntoViewIfNeeded();
  const zurueck = () => s.locator('[aria-label="Zurück"], .wahl-kopf .knopf.geist.klein').first().click();
  const menue = () => s.locator('.menue-knopf').first().waitFor({ timeout: 30000 });

  await s.goto(basis + '/', { waitUntil: 'load' });
  await menue();
  await s.waitForTimeout(500);
  const w = s.locator('.dialog-hintergrund .knopf', { hasText: 'Überspringen' });
  if (await w.count()) await w.click();
  await s.evaluate((schrift) => {
    const sp2 = window.__driftkoenig;
    sp2.daten.fortschritt.strecken = ['industriehof', 'kuestenpass', 'neonhafen'];
    if (schrift !== undefined) sp2.daten.einstellungen.barrierefreiheit.schriftgroesse = schrift;
    sp2.einstellungenAnwenden();
    sp2.qualitaet.setzeEinstellung('niedrig');
    sp2.testAutopilot = 'profi';
  }, a.schrift);
  await s.waitForTimeout(300);
  await pruefen('menue');
  await s.getByText('Spielen', { exact: true }).first().click();
  await s.waitForTimeout(250);
  await pruefen('spielen');

  await s.getByText('Zeitangriff', { exact: true }).first().click();
  await s.locator('.strecken-liste').first().waitFor({ timeout: 15000 });
  await pruefen('streckenwahl');
  await zurueck();
  await s.waitForTimeout(250);

  await s.getByText('Tandem-Battle', { exact: true }).first().click();
  await s.locator('.battle-wahl').first().waitFor({ timeout: 15000 });
  await pruefen('battle-wahl');
  await s.locator('.battle-wahl .knopf.haupt.gross').click();
  await s.locator('.hud.battle').first().waitFor({ timeout: 60000 });
  await s.waitForTimeout(1500);
  // Im Rennen darf nichts scrollen
  const vorRennen = await s.evaluate(() => [scrollX, scrollY, document.documentElement.scrollTop, document.body.scrollTop].join());
  await ziehen(a.breite / 2, a.hoehe * 0.5, a.breite / 2, a.hoehe * 0.2);
  const nachRennen = await s.evaluate(() => [scrollX, scrollY, document.documentElement.scrollTop, document.body.scrollTop].join());
  if (vorRennen !== nachRennen) merken(`${a.name}/rennen: Die Seite scrollt im Rennen (${vorRennen} → ${nachRennen})`);
  // Die Touch-Tasten fahren weiter: Gas halten und dabei mit dem Finger leicht wandern
  const gas = await s.locator('.touch-knopf.gas').first().boundingBox();
  if (!gas) merken(`${a.name}/rennen: Keine Gas-Taste sichtbar`);
  else {
    await ziehen(gas.x + gas.width / 2, gas.y + gas.height / 2, gas.x + gas.width / 2 + 6, gas.y + gas.height / 2 - 6, true);
    const wertGas = await s.evaluate(() => window.__driftkoenig.eingabe.touch.werteAktuell.gas);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (!(wertGas > 0.5)) merken(`${a.name}/rennen: Die Gas-Taste reagiert nicht mehr (${wertGas})`);
  }
  await s.evaluate(() => window.__driftkoenig.modus.pause());
  await s.locator('.pause-menue').first().waitFor();
  await pruefen('pause');
  await s.locator('.pause-menue .knopf').first().click();
  await s.evaluate(() => {
    const m = window.__driftkoenig.modus;
    m.spielerFahrten = [{ winkelMittel: 30, tempoMittel: 60, linieMittel: 80, comboMittel: 1.2, comboMax: 2, abzuege: 0, fluessig: 1, wand: 0, kontakte: 0, resets: 0, spins: 0, besterWinkel: 40, laengsterDrift: 3, abstand: null, punkte: 50 }];
    m.ablauf.aufgeben('B');
    m._battleEnde();
  });
  await s.locator('.ergebnis-bildschirm h2').first().waitFor({ timeout: 10000 });
  await s.waitForTimeout(800);
  await pruefen('ergebnis');
  await s.locator('.ergebnis-bildschirm .knopf', { hasText: 'Menü' }).click();
  await menue();

  await s.getByText('Online-Duell', { exact: true }).click();
  await s.locator('.code-eingabe').first().waitFor({ timeout: 15000 });
  await pruefen('online-start');
  await s.locator('.knopf.haupt', { hasText: 'Duell erstellen' }).click();
  await s.locator('.code-gross').first().waitFor({ timeout: 15000 });
  await pruefen('online-lobby');
  await zurueck();
  await menue();

  await s.getByText('Shop', { exact: true }).click();
  await s.locator('.shop-liste').first().waitFor({ timeout: 60000 });
  for (const r of ['lack', 'bodykit', 'tuning']) {
    await s.click(`.garage-reiter-knopf[data-reiter="${r}"]`);
    await pruefen('shop-' + r);
  }
  await s.locator('.shop-liste .teil-karte').first().click();
  await pruefen('shop-detail');
  await zurueck();
  await menue();

  await s.getByText('Garage', { exact: true }).click();
  await s.locator('.garage').first().waitFor({ timeout: 60000 });
  await s.waitForTimeout(500);
  // Aufkleber ziehen: Der Finger verschiebt den Aufkleber, nicht die Liste
  await s.click('.garage-reiter-knopf[data-reiter="aufkleber"]');
  await s.waitForTimeout(200);
  await s.locator('[data-fokus="neu"]').first().click();
  await s.locator('.aufkleber-knopf').first().waitFor({ timeout: 5000 });
  await s.locator('.aufkleber-knopf').first().click();
  await s.locator('.zonen-vorschau').first().waitFor({ timeout: 5000 });
  await bereitsSichtbar('.zonen-vorschau');
  await s.waitForTimeout(200);
  const leinwand = await s.locator('.zonen-vorschau').first().boundingBox();
  const lage = () => s.evaluate(() => {
    const m = window.__driftkoenig.modus;
    return { y: m.look.aufkleber[0].y, scroll: document.querySelector('.garage-inhalt').scrollTop };
  });
  const startMitte = { x: leinwand.x + leinwand.width * 0.5, y: Math.min(leinwand.y + leinwand.height * 0.3, a.hoehe - 30) };
  await ziehen(startMitte.x, startMitte.y, startMitte.x, startMitte.y + leinwand.height * 0.25);
  await s.waitForTimeout(100);
  const nachZiehen = await lage();
  await ziehen(startMitte.x, startMitte.y + leinwand.height * 0.25, startMitte.x, startMitte.y);
  await s.waitForTimeout(100);
  const zurueckGezogen = await lage();
  if (Math.abs(nachZiehen.y - zurueckGezogen.y) < 0.02) merken(`${a.name}/garage: Aufkleber lässt sich per Touch nicht ziehen`);
  if (nachZiehen.scroll !== zurueckGezogen.scroll) merken(`${a.name}/garage: Beim Ziehen scrollt die Liste`);
  await s.evaluate(() => { const m = window.__driftkoenig.modus; m.aendern((l) => { l.aufkleber.length = 0; }); });
  for (const r of await s.locator('.garage-reiter-knopf').evaluateAll((l) => l.map((x) => x.dataset.reiter))) {
    await s.click(`.garage-reiter-knopf[data-reiter="${r}"]`);
    await pruefen('garage-' + r);
  }
  await zurueck();
  await menue();

  await s.getByText('Einstellungen', { exact: true }).click();
  await s.locator('.einstellungen-bildschirm').first().waitFor();
  const anzahl = await s.locator('.einst-reiter button').count();
  for (let i = 0; i < anzahl; i++) {
    await s.locator('.einst-reiter button').nth(i).click();
    await pruefen('einstellungen-' + i);
  }
  // Schieberegler: waagerecht ziehen ändert den Wert, und Tippen wirkt nach dem Scrollen weiter
  await s.locator('.einst-reiter button').nth(1).click();
  await s.waitForTimeout(250);
  const regler = await s.locator('.einst-inhalt input[type="range"]').first().boundingBox();
  const master = () => s.evaluate(() => window.__driftkoenig.daten.einstellungen.audio.master);
  const vorRegler = await master();
  await ziehen(regler.x + regler.width * 0.8, regler.y + regler.height / 2, regler.x + regler.width * 0.2, regler.y + regler.height / 2);
  await s.waitForTimeout(100);
  if (Math.abs((await master()) - vorRegler) < 0.05) merken(`${a.name}/einstellungen: Der Regler reagiert nicht auf Touch`);
  await s.locator('.einst-reiter button').first().tap();
  await s.waitForTimeout(150);
  if (!(await s.locator('.einst-reiter button').first().evaluate((e) => e.getAttribute('aria-selected') === 'true' || e.classList.contains('aktiv')))) merken(`${a.name}/einstellungen: Tippen auf den Reiter wirkt nicht`);
  for (const f of konsole) merken(`${a.name}: Konsole: ${f.slice(0, 200)}`);
  await browser.close();
}

console.log(`${geprueft} Bereiche geprüft.`);
console.log(probleme.length === 0 ? 'Alles in Ordnung.' : `${probleme.length} Probleme.`);
sp.beenden();
server.close();
process.exit(probleme.length ? 1 : 0);
