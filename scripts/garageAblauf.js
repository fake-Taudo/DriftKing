// Spielt den Bedienablauf der Garage im installierten Edge mit echten Klicks durch (Entwicklungsserver,
// npm run dev): Anprobe und Kauf, Aufkleber-Editor mit Rückgängig, 30 Ebenen, Wortfilter, Look-Code,
// Foto, gespeicherter Look im Rennen. Aufruf: node scripts/garageAblauf.js [ausgabeordner] [basisUrl]
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
const kontext = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const seite = await kontext.newPage();
const fehler = [];
const probleme = [];
seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));

function pruefe(bedingung, text) {
  console.log((bedingung ? 'ok   ' : 'FEHLER ') + text);
  if (!bedingung) probleme.push(text);
}
const g = (fn, arg) => seite.evaluate(fn, arg);
const foto = (name) => seite.screenshot({ path: path.join(ausgabe, name + '.png') });
const reiter = async (r) => {
  await seite.click(`.garage-reiter-knopf[data-reiter="${r}"]`);
  await seite.waitForTimeout(250);
};
const dialogKnopf = (text) => seite.locator('.dialog-hintergrund .knopf', { hasText: text }).click();
const muenzen = () => g(() => window.__driftkoenig.daten.waehrung);

await seite.goto(basis + '/', { waitUntil: 'load' });
await seite.waitForSelector('.menue-knopf', { timeout: 60000 });
await seite.getByText('Garage', { exact: true }).click();
await seite.waitForSelector('.garage', { timeout: 60000 });
await seite.waitForTimeout(800);

// --- Anprobe und Kauf ---
const start = await muenzen();
await seite.locator('.teil-karte', { hasText: 'Metallic' }).click();
await seite.waitForTimeout(200);
pruefe(await seite.locator('.garage-anprobe.sichtbar').count() === 1, 'Anprobe-Leiste erscheint');
pruefe(await g(() => window.__driftkoenig.modus.slot.look.lack.finish) === 'glanz', 'Anprobe wird nicht gespeichert');
pruefe(await g(() => window.__driftkoenig.modus.modell.look.lack.finish) === 'metallic', 'Anprobe ist am Auto sichtbar');
await seite.locator('.garage-anprobe .knopf.geist').click();
await seite.waitForTimeout(200);
pruefe(await g(() => window.__driftkoenig.modus.look.lack.finish) === 'glanz', 'Verwerfen nimmt die Anprobe zurück');
await seite.locator('.teil-karte', { hasText: 'Metallic' }).click();
await seite.locator('.garage-anprobe .knopf.haupt').click();
await seite.waitForSelector('.dialog-hintergrund');
await foto('kaufdialog');
await dialogKnopf('Kaufen');
await seite.waitForTimeout(250);
pruefe(await muenzen() === start - 700, 'Kauf bucht genau den Preis ab');
pruefe(await g(() => window.__driftkoenig.modus.slot.look.lack.finish) === 'metallic', 'Gekauftes wird gespeichert');
pruefe(await seite.locator('.garage-anprobe.sichtbar').count() === 0, 'Anprobe-Leiste verschwindet');
// Nicht leistbar
await seite.locator('.teil-karte', { hasText: 'Chrom' }).click();
await g(() => { window.__driftkoenig.daten.waehrung = 100; });
await seite.locator('.garage-anprobe .knopf.haupt').click();
await seite.waitForSelector('.dialog-hintergrund');
const text = await seite.locator('.dialog-hintergrund').innerText();
pruefe(text.includes('3.900'), 'Nicht leistbar zeigt den fehlenden Betrag: ' + text.replace(/\s+/g, ' ').slice(0, 90));
await dialogKnopf('OK');
await seite.locator('.garage-anprobe .knopf.geist').click();
await g((m) => { window.__driftkoenig.daten.waehrung = m; }, 50000);

// --- Farbwähler ---
await seite.locator('.farb-zeile', { hasText: 'Lackfarbe' }).click();
await seite.waitForSelector('.farbwaehler');
await seite.locator('.farb-hex').fill('#112233');
await seite.waitForTimeout(100);
pruefe(await g(() => window.__driftkoenig.modus.look.lack.farbe1) === '#112233', 'Hex-Eingabe färbt den Lack');
await seite.locator('.farb-hex').fill('#2c6be8');
const box = await seite.locator('.farb-rad').boundingBox();
await seite.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.5);
await seite.waitForTimeout(100);
pruefe(await g(() => window.__driftkoenig.modus.look.lack.farbe1) !== '#2c6be8', 'Farbrad ändert die Farbe');
await foto('farbwaehler');
await seite.locator('.farb-zeile', { hasText: 'Lackfarbe' }).click();

// --- Muster ---
await seite.locator('.teil-karte', { hasText: 'Flammen' }).click();
await seite.waitForTimeout(300);
await g(() => window.__driftkoenig.modus.ansicht('seite'));
await seite.waitForTimeout(900);
await foto('muster-flammen');

// --- Aufkleber ---
await reiter('aufkleber');
await seite.locator('.knopf', { hasText: '+ Aufkleber' }).click();
await seite.waitForSelector('.aufkleber-bibliothek');
await foto('bibliothek');
await seite.locator('.aufkleber-knopf').first().click();
await seite.waitForSelector('.ebene');
pruefe(await g(() => window.__driftkoenig.modus.look.aufkleber.length) === 1, 'Aufkleber wird als Ebene hinzugefügt');
const vorschau = await seite.locator('.zonen-vorschau').boundingBox();
await seite.mouse.move(vorschau.x + vorschau.width * 0.5, vorschau.y + vorschau.height * 0.5);
await seite.mouse.down();
await seite.mouse.move(vorschau.x + vorschau.width * 0.25, vorschau.y + vorschau.height * 0.6, { steps: 4 });
await seite.mouse.up();
await seite.waitForTimeout(200);
const pos = await g(() => { const a = window.__driftkoenig.modus.look.aufkleber[0]; return [a.x, a.y]; });
pruefe(Math.abs(pos[0] - 0.25) < 0.02, `Ziehen verschiebt die Ebene (x = ${pos[0]})`);
await seite.locator('.knopf', { hasText: 'Auf andere Seite' }).click();
await seite.waitForTimeout(200);
const seiten = await g(() => window.__driftkoenig.modus.look.aufkleber.map((a) => [a.zone, a.x, a.spiegel]));
pruefe(seiten.length === 2 && seiten[1][0] === 'seiteR' && Math.abs(seiten[1][1] - 0.75) < 0.02 && seiten[1][2] === true, 'Auf andere Seite spiegeln');
await g(() => window.__driftkoenig.modus.ansicht('seite'));
await seite.waitForTimeout(900);
await foto('aufkleber-editor');

// Text und Wortfilter
await seite.locator('.knopf', { hasText: '+ Text' }).click();
await seite.waitForSelector('.text-dialog');
await seite.locator('.text-feld').fill('Arschloch');
await dialogKnopf('OK');
await seite.waitForTimeout(150);
pruefe((await seite.locator('.text-dialog .einst-fehler').innerText()).length > 0, 'Wortfilter lehnt ab');
await seite.locator('.text-feld').fill('DRIFTKÖNIG');
await seite.locator('.text-dialog .auswahl-knopf', { hasText: 'Bungee' }).click();
await dialogKnopf('OK');
await seite.waitForTimeout(400);
pruefe(await g(() => window.__driftkoenig.modus.look.aufkleber.at(-1).text) === 'DRIFTKÖNIG', 'Text-Aufkleber wird hinzugefügt');
await foto('aufkleber-text');
pruefe(await seite.locator('.garage-anprobe.sichtbar').count() === 1, 'Text-Paket ist Anprobe');

// Rückgängig über mehr als 30 Schritte und wieder vor
const vorher = await g(() => JSON.stringify(window.__driftkoenig.modus.look));
await g(() => {
  const m = window.__driftkoenig.modus;
  for (let i = 0; i < 40; i++) m.aendern((l) => { l.lack.farbe1 = '#0000' + (10 + i); });
});
await seite.waitForTimeout(100);
await g(() => { const m = window.__driftkoenig.modus; for (let i = 0; i < 40; i++) m.rueckgaengig(); });
await seite.waitForTimeout(100);
pruefe(await g(() => JSON.stringify(window.__driftkoenig.modus.look)) === vorher, '40 Schritte rückgängig stellen den Look exakt wieder her');
await seite.locator('button[aria-label="Wiederholen"]').click();
await seite.waitForTimeout(100);
pruefe(await g(() => window.__driftkoenig.modus.look.lack.farbe1) === '#000010', 'Wiederholen geht einen Schritt vor');
await seite.locator('button[aria-label="Rückgängig"]').click();

// 30 Ebenen: der 31. wird abgelehnt, alles bleibt stabil
const n = await g(async () => {
  const m = window.__driftkoenig.modus;
  const ops = await import('/@fs/C:/Users/Paul%20Matuszek/DriftKing/shared/aufkleberOps.js');
  const ergebnisse = [];
  for (let i = m.look.aufkleber.length; i < 31; i++) {
    let r = -1;
    m.aendern((l) => { r = ops.hinzufuegen(l.aufkleber, { ...ops.neuerAufkleber('stern5', 'seiteL'), x: (i % 10) / 10, y: 0.5, skala: 0.3 }); });
    ergebnisse.push(r);
  }
  return { anzahl: m.look.aufkleber.length, letztes: ergebnisse.at(-1) };
});
pruefe(n.anzahl === 30 && n.letztes === -1, `Maximal 30 Ebenen (${n.anzahl}), die 31. wird abgelehnt`);
await reiter('lack');
await reiter('aufkleber');
await seite.waitForTimeout(500);
await foto('aufkleber-30-ebenen');
await g(() => window.__driftkoenig.modus.anprobeVerwerfen());
await g(() => { const m = window.__driftkoenig.modus; m.aendern((l) => { l.aufkleber.length = Math.min(l.aufkleber.length, 3); }); });
await seite.waitForTimeout(200);

// --- Look-Code ---
await reiter('looks');
await seite.locator('.knopf', { hasText: 'Code erzeugen' }).click();
await seite.waitForSelector('.code-feld');
const code = await seite.locator('.code-feld').inputValue();
pruefe(code.length > 20 && code.length <= 8192, `Look-Code erzeugt (${code.length} Zeichen)`);
await dialogKnopf('Schließen');
await seite.waitForTimeout(100);
const lookVorImport = await g(() => JSON.stringify(window.__driftkoenig.modus.look));
await seite.locator('.knopf', { hasText: 'Code einfügen' }).click();
await seite.waitForSelector('.code-feld');
await seite.locator('.code-feld').fill('das ist kein gültiger code');
await dialogKnopf('Code einfügen');
await seite.waitForTimeout(200);
const meldung = await seite.locator('.dialog-hintergrund .einst-fehler').innerText();
pruefe(meldung.length > 0, 'Ungültiger Code wird abgelehnt: ' + meldung);
await seite.locator('.code-feld').fill(code);
await dialogKnopf('Code einfügen');
await seite.waitForTimeout(250);
pruefe(await g(() => JSON.stringify(window.__driftkoenig.modus.look)) === lookVorImport, 'Gültiger Code stellt den Look wieder her');

// --- Felgen, Bodykit, Details als Anprobe am Modell ---
await reiter('bodykit');
await seite.locator('.teil-karte', { hasText: 'Großer Heckflügel' }).click();
await seite.waitForTimeout(300);
pruefe(await g(() => window.__driftkoenig.modus.modell.look.teile.spoiler.variante) === 4, 'Spoiler erscheint am Modell');
await g(() => window.__driftkoenig.modus.ansicht('heck'));
await seite.waitForTimeout(900);
await foto('bodykit-spoiler');
await g(() => window.__driftkoenig.modus.anprobeVerwerfen());

// --- Tuning ---
await reiter('tuning');
await seite.locator('.stufe-knopf[data-fokus="tuning:motor:2"]').click();
await seite.waitForTimeout(150);
await foto('tuning-vorschau');
await seite.locator('.knopf.haupt', { hasText: 'kaufen und einbauen' }).click();
await seite.waitForSelector('.dialog-hintergrund');
await dialogKnopf('Kaufen');
await seite.waitForTimeout(300);
pruefe(await g(() => window.__driftkoenig.modus.auto.tuning.motor) === 2, 'Tuningstufe gekauft und eingebaut');

// --- Showroom und Foto ---
await seite.locator('.ansicht-knopf', { hasText: 'Showroom' }).click();
await seite.waitForSelector('.showroom-menue');
await seite.locator('.showroom-menue .ansicht-knopf', { hasText: 'Studio' }).click();
await seite.waitForTimeout(500);
await foto('showroom-studio');
await seite.locator('.ansicht-knopf', { hasText: 'Foto' }).click();
await seite.waitForSelector('.foto-leiste');
const download = seite.waitForEvent('download', { timeout: 60000 });
await seite.locator('.foto-leiste .knopf.haupt').click();
const datei = await download;
await datei.saveAs(path.join(ausgabe, 'foto.png'));
pruefe(datei.suggestedFilename().endsWith('.png'), 'Foto wird als Datei gespeichert: ' + datei.suggestedFilename());
await seite.waitForTimeout(300);
await foto('fotomodus');
await seite.locator('.foto-leiste .knopf.geist').click();

// --- Gespeicherter Look im Rennen ---
const gespeichert = await g(() => JSON.stringify(window.__driftkoenig.modus.slot.look));
await seite.locator('.garage-kopf .knopf.geist').first().click();
await seite.waitForSelector('.menue-knopf', { timeout: 30000 });
await seite.waitForTimeout(400);
const imRennen = await g(async () => {
  const spiel = window.__driftkoenig;
  const { FreiesFahren } = await import('/modi/freiesFahren.js');
  const { aktivesAutoKonfig } = await import('/spielerDaten.js');
  const r = new FreiesFahren({ streckeId: 'industriehof', spieler: aktivesAutoKonfig(spiel.daten) });
  await spiel.wechsleModus(r);
  return JSON.stringify(r.spieler.modell.look);
});
pruefe(imRennen === gespeichert, 'Gespeicherter Look erscheint im Rennen unverändert');
await seite.waitForTimeout(800);
await foto('look-im-rennen');
// Nach dem Neuladen noch vorhanden
await g(() => window.__driftkoenig.speicher.sofortSpeichern());
await seite.reload({ waitUntil: 'load' });
await seite.waitForSelector('.menue-knopf', { timeout: 60000 });
const nachLaden = await g(() => {
  const d = window.__driftkoenig.daten;
  const a = d.autos.find((x) => x.id === d.aktivesAuto);
  return JSON.stringify(a.looks[a.aktiverLook].look);
});
pruefe(nachLaden === gespeichert, 'Look ist nach dem Neuladen noch da');

for (const f of fehler) console.log('KONSOLE:', f.slice(0, 300));
console.log(probleme.length + fehler.length === 0 ? 'Alles in Ordnung.' : `${probleme.length} Probleme, ${fehler.length} Konsolenfehler.`);
await browser.close();
process.exit(probleme.length ? 1 : 0);
