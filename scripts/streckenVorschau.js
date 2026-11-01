// Zeichnet eine Strecke von oben als PNG (Fahrbahn, Drift-Zonen, Wände, Ideallinie, Hindernisse, Start).
// Aufruf: node scripts/streckenVorschau.js <streckenId> [ausgabe.png]
import { writeFileSync } from 'node:fs';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { STRECKEN } from '../shared/strecken/index.js';
import { Zeichenbrett } from './png.js';

const id = process.argv[2] || 'industriehof';
const ziel = process.argv[3] || `strecke-${id}.png`;
const def = STRECKEN.find((s) => s.id === id);
if (!def) throw new Error('Unbekannte Strecke ' + id);
const S = baueStrecke(def);
const z = new Zeichenbrett(1000, 1000, S.grenze);
const WAND = { beton: [200, 200, 210], leitplanke: [240, 240, 255], container: [60, 140, 230], fels: [150, 110, 80], reifen: [40, 40, 40], zaun: [120, 200, 120], grenze: [255, 0, 255] };
const n = S.anzahl;
for (let i = 0; i < n; i++) {
  const j = (i + 1) % n;
  const farbe = S.zoneVon[i] >= 0 ? [110, 60, 90] : [70, 74, 86];
  z.viereck([S.randL[i], S.randL[j], S.randR[j], S.randR[i]], farbe);
}
for (const seite of ['L', 'R']) {
  for (const ab of S.wandAbschnitte[seite]) {
    for (let k = 1; k < ab.punkte.length; k++) {
      const [a, b] = [ab.punkte[k - 1], ab.punkte[k]];
      z.linie(a[0], a[1], b[0], b[1], WAND[ab.art] || [255, 255, 255], 2);
    }
  }
}
const vMax = Math.max(...S.ideal.tempo);
for (let i = 0; i < n; i += 1) {
  const j = (i + 1) % n;
  const t = S.ideal.tempo[i] / vMax;
  z.linie(S.ideal.x[i], S.ideal.y[i], S.ideal.x[j], S.ideal.y[j], [255 * (1 - t), 255 * t, 60], 1.5);
}
for (const k of S.hindernisse.kreise) z.kreis(k.x, k.y, k.r, [30, 30, 30]);
for (const r of S.hindernisse.rechtecke) {
  const c = Math.cos(r.winkel), s = Math.sin(r.winkel);
  const e = [[r.hl, r.hb], [-r.hl, r.hb], [-r.hl, -r.hb], [r.hl, -r.hb]].map(([lx, ly]) => [r.x + lx * c - ly * s, r.y + lx * s + ly * c]);
  z.viereck(e, [60, 140, 230]);
}
for (const cp of S.checkpoints) {
  z.linie(S.randL[cp][0], S.randL[cp][1], S.randR[cp][0], S.randR[cp][1], [255, 255, 255], 1);
}
const st = S.start.fuehrer;
z.kreis(st.x, st.y, 2, [255, 255, 0]);
z.linie(st.x, st.y, st.x + Math.cos(st.theta) * 10, st.y + Math.sin(st.theta) * 10, [255, 255, 0], 2);
const v = S.start.verfolger;
z.kreis(v.x, v.y, 2, [255, 150, 0]);
writeFileSync(ziel, z.png());
console.log(`${def.name}: Länge ${S.laenge.toFixed(0)} m, Referenz-Rundenzeit ${S.ideal.rundenzeit.toFixed(1)} s, Zonen ${S.zonen.length}, Schließfehler ${S.schliessFehler.versatz.toFixed(1)} m / ${(S.schliessFehler.winkel * 57.3).toFixed(1)}°, Breite ${Math.min(...S.proben.map((p) => p.breite))}–${Math.max(...S.proben.map((p) => p.breite))} m → ${ziel}`);
