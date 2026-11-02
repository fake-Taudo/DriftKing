// Kontaktbögen für die Sichtprüfung der Garage: alle 6 Autos mit Vollausstattung von vorne und hinten sowie
// alle Spoiler, Muster und Felgen. Braucht den Entwicklungsserver (npm run dev).
// Aufruf: node scripts/garageBilder.js [ausgabeordner] [basisUrl]
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
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
const seite = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const fehler = [];
seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
await seite.goto(basis + '/', { waitUntil: 'load' });
await seite.waitForSelector('.menue-knopf', { timeout: 60000 });

// Rendert im Browser ein Raster aus Einzelbildern auf eine 2D-Leinwand und legt es über die Seite.
const bogen = (aufgaben) => seite.evaluate(async ({ aufgaben, shared }) => {
  const THREE = await import('/@fs/C:/Users/Paul%20Matuszek/DriftKing/node_modules/.vite/deps/three.js').catch(() => null);
  void THREE;
  const spiel = window.__driftkoenig;
  const { Showroom } = await import('/render/showroom.js');
  const { GarageKamera } = await import('/render/garageKamera.js');
  const { AutoModell } = await import('/render/auto/autoModell.js');
  const { standardLook } = await import(shared + '/shared/look.js');
  const { SLOTS } = await import(shared + '/shared/teile.js');
  spiel.schleife.stop?.();
  document.getElementById('ui').style.display = 'none';
  const r = spiel.renderer;
  const showroom = new Showroom(r.renderer, 'studio');
  const kam = new GarageKamera(1);
  const spalten = aufgaben.spalten;
  const B = 1500, Z = Math.ceil(aufgaben.bilder.length / spalten);
  const bb = Math.floor(B / spalten), hh = Math.round(bb * 0.62);
  const ziel = document.createElement('canvas');
  ziel.width = bb * spalten;
  ziel.height = hh * Z;
  const ctx = ziel.getContext('2d');
  r.renderer.setPixelRatio(1);
  r.renderer.setSize(bb, hh, false);
  kam.kamera.aspect = bb / hh;
  kam.kamera.updateProjectionMatrix();
  let i = 0;
  for (const b of aufgaben.bilder) {
    const look = standardLook(b.auto);
    if (b.voll) {
      for (const s of SLOTS) { look.teile[s.id].variante = Math.min(s.varianten.length - 1, b.voll); look.teile[s.id].farbe = '#2c6be8'; }
    }
    for (const [slot, v] of Object.entries(b.teile || {})) { look.teile[slot].variante = v; look.teile[slot].farbe = '#2c6be8'; }
    if (b.muster) look.muster = { id: b.muster, farbe: '#ffffff', deckkraft: 1, skala: 1 };
    if (b.felge) look.felgen.design = b.felge;
    const m = new AutoModell(b.auto, look, { qualitaet: { livery: 1024, schatten: 'map' } });
    m.blob.visible = false;
    m.objekt.traverse((o) => { if (o.isMesh && o !== m.blob) o.castShadow = true; });
    showroom.drehteller.add(m.objekt);
    kam.az = kam.sollAz = (b.az * Math.PI) / 180;
    kam.el = kam.sollEl = ((b.el ?? 16) * Math.PI) / 180;
    kam.abstand = kam.sollAbstand = b.abstand ?? 7.4;
    if (b.ziel) { kam.ziel.set(...b.ziel); kam.sollZiel.set(...b.ziel); }
    else { kam.ziel.set(0, 0.6, 0); kam.sollZiel.set(0, 0.6, 0); }
    kam.frame(0.016);
    m.aktualisieren(0.016, { delta: 0, radWinkelV: 0, radWinkelH: 0, radGeschwV: 0, radGeschwH: 0 }, 0);
    r.renderer.render(showroom.szene, kam.kamera);
    ctx.drawImage(r.canvas, (i % spalten) * bb, Math.floor(i / spalten) * hh, bb, hh);
    ctx.fillStyle = '#000a';
    ctx.fillRect((i % spalten) * bb, Math.floor(i / spalten) * hh, bb, 22);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText(b.titel, (i % spalten) * bb + 6, Math.floor(i / spalten) * hh + 16);
    showroom.drehteller.remove(m.objekt);
    m.freigeben();
    i++;
  }
  showroom.freigeben();
  r.groesseAnpassen();
  return ziel.toDataURL('image/jpeg', 0.85);
}, { aufgaben, shared: '/@fs/' + wurzel.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/%3A/g, ':') });


const sichern = (name, daten) => writeFileSync(path.join(ausgabe, name + '.jpg'), Buffer.from(daten.split(',')[1], 'base64'));

const AUTOS = ['kestrel_s', 'marlin_4d', 'vireo_turbo', 'hornet_wagon', 'bastion_gt', 'onyx_rs'];
const auftrag = process.argv[4] || 'alles';
if (auftrag === 'alles' || auftrag === 'kit') {
  sichern('kit-voll', await bogen({
    spalten: 4,
    bilder: AUTOS.flatMap((auto) => [
      { auto, az: 40, titel: `${auto} Serie` },
      { auto, az: 40, voll: 9, titel: `${auto} Vollausstattung vorne` },
      { auto, az: 145, voll: 9, titel: `${auto} Vollausstattung hinten` },
      { auto, az: 145, voll: 1, titel: `${auto} Variante 1 hinten` }
    ])
  }));
}
if (auftrag === 'alles' || auftrag === 'spoiler') {
  sichern('spoiler', await bogen({
    spalten: 5,
    bilder: AUTOS.slice(0, 3).flatMap((auto) => [1, 2, 3, 4, 5].map((v) => ({ auto, az: 150, el: 18, teile: { spoiler: v }, titel: `${auto} Spoiler ${v}` })))
  }));
}
if (auftrag === 'alles' || auftrag === 'muster') {
  const muster = ['rennstreifen', 'doppelstreifen', 'karbon', 'flammen', 'wellen', 'tarnung', 'geometrie', 'retro', 'seitenblitz', 'punkte', 'kacheln', 'verlauf'];
  sichern('muster', await bogen({ spalten: 4, bilder: muster.map((m) => ({ auto: 'kestrel_s', az: 50, el: 22, muster: m, titel: m })) }));
}
if (auftrag === 'alles' || auftrag === 'felgen') {
  const felgen = ['fuenfspeichen', 'stahl', 'mehrspeichen', 'kreuzspeichen', 'wabe', 'scheibe', 'turbine', 'stern', 'tiefbett', 'y_speichen', 'netz', 'dreispeichen'];
  sichern('felgen', await bogen({ spalten: 4, bilder: felgen.map((f) => ({ auto: 'kestrel_s', az: 90, el: 3, abstand: 2.2, ziel: [0.8, 0.32, 1.2], felge: f, titel: f })) }));
}
for (const f of fehler) console.log('KONSOLE:', f.slice(0, 300));
console.log('Fertig.');
await browser.close();
