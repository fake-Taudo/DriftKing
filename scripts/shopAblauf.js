// Spielt Phase 6 im installierten Edge durch (Entwicklungsserver, npm run dev): erster Start mit Tutorial bis zum
// Ende (Eingaben per Skript), Hauptmenü mit Tagesaufgaben, Shop mit Suche, Filter, Sortierung, Kauf und Verkauf.
// Aufruf: node scripts/shopAblauf.js [ausgabeordner] [basisUrl]
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ausgabe = process.argv[2] || path.join(wurzel, 'test-results', 'shop');
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
const probleme = [];
seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
function pruefe(b, text) {
  console.log((b ? 'ok   ' : 'FEHLER ') + text);
  if (!b) probleme.push(text);
}
const g = (fn, arg) => seite.evaluate(fn, arg);
const foto = (name) => seite.screenshot({ path: path.join(ausgabe, name + '.png') });
const dialogKnopf = (text) => seite.locator('.dialog-hintergrund .knopf', { hasText: text }).click();
const muenzen = () => g(() => window.__driftkoenig.daten.waehrung);
const kategorie = async (k) => {
  await seite.click(`.garage-reiter-knopf[data-reiter="${k}"]`);
  await seite.waitForTimeout(150);
};
const karte = (name) => seite.locator('.shop-liste .teil-karte', { hasText: name }).first();

await seite.goto(basis + '/', { waitUntil: 'load' });
await seite.waitForSelector('.menue-knopf', { timeout: 60000 });
await seite.waitForSelector('.dialog-hintergrund', { timeout: 10000 });
await foto('willkommen');
pruefe((await seite.locator('.dialog-hintergrund').innerText()).includes('Willkommen'), 'Erster Start bietet das Tutorial an');
await dialogKnopf('Tutorial starten');
await seite.waitForSelector('.tutorial-karte', { timeout: 60000 });
await seite.waitForTimeout(500);
await foto('tutorial-gas');

// Tutorial mit echter Physik durchfahren: Eingaben setzen und Schritte takten
const verlauf = await g(async () => {
  const spiel = window.__driftkoenig;
  const m = spiel.modus;
  spiel.schleife.physikAktiv = false;
  const e = spiel.eingabe;
  const werte = { lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0 };
  Object.defineProperty(e, 'werte', { get: () => werte, configurable: true });
  const setz = (o) => Object.assign(werte, { lenken: 0, gas: 0, bremse: 0, handbremse: 0 }, o);
  const lauf = (o, s) => { setz(o); for (let t = 0; t < s; t += 1 / 60) m.schritt(1 / 60); };
  const log = [];
  const bis = (id, fn) => {
    for (let i = 0; i < 40 && m.ablauf.schritt.id === id; i++) fn();
    log.push(`${id} → ${m.ablauf.schritt.id}`);
  };
  bis('gas', () => lauf({ gas: 1 }, 1));
  bis('lenken', () => { lauf({ gas: 0.5, lenken: 0.7 }, 0.5); lauf({ gas: 0.5, lenken: -0.7 }, 0.5); });
  bis('bremse', () => { lauf({ gas: 1 }, 2); lauf({ bremse: 1 }, 2); });
  bis('handbremse', () => { lauf({ gas: 1 }, 2); lauf({ handbremse: 1, gas: 0.3 }, 0.1); });
  const kick = () => { m.spielerZuruecksetzen(false); m.spieler.fahrzeug.setzen(m.spieler.fahrzeug.z.x, m.spieler.fahrzeug.z.y, m.spieler.fahrzeug.z.theta, 60 / 3.6); lauf({ lenken: -1, handbremse: 1, gas: 0.3 }, 0.35); lauf({ gas: 0.9 }, 3.5); };
  bis('drift', kick);
  bis('halten', kick);
  return { log, schritt: m.ablauf.schritt.id, bot: !!m.botAuto };
});
console.log('     ' + verlauf.log.join(', '));
pruefe(verlauf.schritt === 'tandem' && verlauf.bot, 'Tutorial kommt mit echter Physik bis zum Tandem, der Führer fährt vor');
await seite.waitForTimeout(600);
await foto('tutorial-tandem');
const nachTandem = await g(() => {
  const m = window.__driftkoenig.modus;
  const f = m.spieler.fahrzeug, b = m.botAuto.fahrzeug;
  // Spieler bleibt dicht hinter dem Führer (Bot fährt, Spieler wird mitgeführt)
  const werte = window.__driftkoenig.eingabe.werte;
  werte.gas = 0; werte.lenken = 0;
  for (let t = 0; t < 14 && m.ablauf.schritt.id === 'tandem'; t += 1 / 60) {
    f.setzen(b.z.x - Math.cos(b.z.theta) * 8, b.z.y - Math.sin(b.z.theta) * 8, b.z.theta, b.tempo);
    m.schritt(1 / 60);
  }
  return m.ablauf.schritt.id;
});
pruefe(nachTandem === 'fertig', 'Tandem-Schritt wird geschafft');
await seite.waitForTimeout(400);
await foto('tutorial-fertig');
pruefe(await g(() => window.__driftkoenig.daten.fortschritt.tutorialFertig) === true, 'Tutorial ist als gesehen gespeichert');
await seite.locator('.tutorial-schluss .knopf').click();
await seite.waitForSelector('.menue-knopf', { timeout: 30000 });
await seite.waitForTimeout(600);
pruefe(await seite.locator('.dialog-hintergrund').count() === 0, 'Danach kein erneutes Angebot');

// Menü und Tagesaufgaben
await foto('menue');
pruefe(await seite.locator('.tages-box .tages-aufgabe').count() === 3, 'Hauptmenü zeigt 3 Tagesaufgaben');
const aufgabenTest = await g(() => {
  const s = window.__driftkoenig;
  const d = s.daten;
  const vor = d.waehrung;
  d.tagesaufgaben.aufgaben = [{ id: 'battle1', fortschritt: 0, erledigt: false, abgeholt: false }, { id: 'fuehrer70', fortschritt: 0, erledigt: false, abgeholt: false }, { id: 'punkte300', fortschritt: 0, erledigt: false, abgeholt: false }];
  s.ereignisse.senden('battleEnde', { sieg: false });
  s.ereignisse.senden('fahrtGewertet', { rolle: 'fuehrer', wertung: { punkte: 75, comboMax: 1.5, fluessig: 0 } });
  return { zuwachs: d.waehrung - vor, erledigt: d.tagesaufgaben.aufgaben.map((a) => a.erledigt), punkte: d.tagesaufgaben.aufgaben[2].fortschritt };
});
pruefe(aufgabenTest.zuwachs === 350 && aufgabenTest.erledigt[0] && aufgabenTest.erledigt[1] && aufgabenTest.punkte === 75, `Tagesaufgaben zählen und zahlen (+${aufgabenTest.zuwachs} DM)`);

// Shop
await seite.getByText('Shop', { exact: true }).click();
await seite.waitForSelector('.shop-liste', { timeout: 60000 });
await seite.waitForTimeout(500);
await foto('shop-autos');
const karten = await seite.locator('.shop-liste .teil-karte').count();
pruefe(karten === 6, `Alle 6 Autos im Shop (${karten})`);
for (const k of ['lack', 'muster', 'felgen', 'bodykit', 'aufkleber', 'qualm', 'extras', 'tuning', 'autos']) {
  await kategorie(k);
  const text = await seite.locator('.garage').innerText();
  if (text.includes('⟦')) pruefe(false, `Kategorie ${k}: fehlender Text ${text.match(/⟦[^⟧]*⟧/)[0]}`);
}
pruefe(true, 'Alle Kategorien öffnen ohne fehlende Texte');

// Auto: nicht leistbar, dann kaufen, fahren, verkaufen
await g(() => { window.__driftkoenig.daten.waehrung = 1000; });
await karte('Marlin').click();
await seite.waitForTimeout(600);
await foto('shop-auto-detail');
pruefe((await seite.locator('.shop-fehlt').innerText()).includes('7.000'), 'Nicht leistbares Auto zeigt den fehlenden Betrag');
await seite.locator('.shop-aktionen .knopf.haupt').click();
await seite.waitForSelector('.dialog-hintergrund');
await dialogKnopf('OK');
pruefe(await g(() => window.__driftkoenig.daten.autos.length) === 1, 'Nicht leistbares Auto wird nicht gekauft');
await g(() => { window.__driftkoenig.daten.waehrung = 100000; });
await kategorie('autos');
await karte('Marlin').click();
await seite.locator('.shop-aktionen .knopf.haupt').click();
await seite.waitForSelector('.dialog-hintergrund');
await dialogKnopf('Kaufen');
await seite.waitForTimeout(400);
pruefe(await muenzen() === 92000, 'Autokauf bucht 8.000 DM ab');
pruefe(await g(() => window.__driftkoenig.daten.aktivesAuto) === 'marlin_4d', 'Neues Auto wird aktiv');

// Teile für dieses Auto: Suche, Filter, Vorschau, Kauf, Verkauf
await kategorie('bodykit');
await seite.locator('.shop-suche').fill('flügel');
await seite.waitForTimeout(150);
const treffer = await seite.locator('.shop-liste .teil-karte').count();
pruefe(treffer === 6, `Suche findet Flügel und Kotflügel (${treffer})`);
await seite.locator('.shop-suche').fill('');
const preisPruefung = async () => g(() => [...document.querySelectorAll('.shop-liste .teil-preis')].map((e) => Number(e.textContent.replace(/\D/g, ''))));
await seite.selectOption('.shop-sortierung', 'preisAb');
await seite.waitForTimeout(100);
const preise = await preisPruefung();
pruefe(preise.every((p, i) => i === 0 || p <= preise[i - 1]), 'Sortierung nach Preis');
await karte('Großer Heckflügel').click();
await seite.waitForTimeout(900);
await foto('shop-teil-vorschau');
pruefe(await g(() => window.__driftkoenig.modus.modell.look.teile.spoiler.variante) === 4, 'Vorschau zeigt das Teil am Auto');
pruefe(await g(() => { const d = window.__driftkoenig.daten; return d.autos.find((a) => a.id === 'marlin_4d').looks[0].look.teile.spoiler.variante; }) === 0, 'Vorschau ändert keinen gespeicherten Look');
const vorKauf = await muenzen();
await seite.locator('.shop-aktionen .knopf.haupt').click();
await seite.waitForSelector('.dialog-hintergrund');
await foto('shop-kaufdialog');
await dialogKnopf('Kaufen');
await seite.waitForTimeout(300);
const preis = vorKauf - await muenzen();
pruefe(preis > 0, `Teilekauf bucht ab (${preis} DM)`);
await seite.locator('.auswahl-knopf', { hasText: 'Gekauft' }).click();
await seite.waitForTimeout(150);
pruefe(await seite.locator('.shop-liste .teil-karte').count() === 1, 'Filter „Gekauft“ zeigt das Teil');
await seite.locator('.shop-aktionen .knopf.geist').click();
await seite.waitForSelector('.dialog-hintergrund');
await dialogKnopf('Verkaufen');
await seite.waitForTimeout(300);
pruefe((await muenzen()) === vorKauf - preis + Math.floor(preis / 2), 'Verkauf bringt 50 %');
await seite.locator('.auswahl-knopf', { hasText: 'Alle' }).click();

// Autoverkauf
await kategorie('autos');
await karte('Marlin').click();
const vorVerkauf = await muenzen();
await seite.locator('.shop-aktionen .knopf.geist').click();
await seite.waitForSelector('.dialog-hintergrund');
await dialogKnopf('Verkaufen');
await seite.waitForTimeout(400);
pruefe((await muenzen()) === vorVerkauf + 4000, 'Autoverkauf bringt 50 %');
pruefe(await g(() => window.__driftkoenig.daten.aktivesAuto) === 'kestrel_s', 'Nach dem Verkauf ist wieder das Startauto aktiv');
await karte('Kestrel').click();
await seite.waitForTimeout(200);
pruefe(await seite.locator('.shop-aktionen .knopf.geist').count() === 0, 'Das letzte Auto hat keinen Verkaufen-Knopf');

// Spielstand gültig nach allem
const gueltig = await g(async () => {
  const { pruefeSpielstand } = await import('/@fs/C:/Users/Paul%20Matuszek/DriftKing/shared/spielstand.js');
  const { AUFKLEBER_IDS } = await import('/assets/aufkleber.js');
  return pruefeSpielstand(window.__driftkoenig.daten, { aufkleberIds: AUFKLEBER_IDS });
});
pruefe(gueltig.ok, 'Spielstand bleibt gültig ' + JSON.stringify(gueltig));

await seite.locator('.garage-kopf .knopf.geist').first().click();
await seite.waitForSelector('.menue-knopf', { timeout: 30000 });

// Handy-Ansichten
await seite.setViewportSize({ width: 390, height: 844 });
await seite.waitForTimeout(600);
await foto('menue-hoch');
await seite.getByText('Shop', { exact: true }).click();
await seite.waitForSelector('.shop-liste', { timeout: 60000 });
await karte('Vireo').click();
await seite.waitForTimeout(600);
await foto('shop-hoch');
await seite.setViewportSize({ width: 844, height: 390 });
await seite.waitForTimeout(600);
await foto('shop-quer');

for (const f of fehler) console.log('KONSOLE:', f.slice(0, 300));
console.log(probleme.length + fehler.length === 0 ? 'Alles in Ordnung.' : `${probleme.length} Probleme, ${fehler.length} Konsolenfehler.`);
await browser.close();
process.exit(probleme.length ? 1 : 0);
