// Misst alle Autos (Serie und voll getunt) und gibt eine Tabelle aus.
// Aufruf: node scripts/autoMessung.js [--md]   (--md: Markdown-Tabelle für docs/AUTOS.md)
import { AUTOS } from '../shared/autos.js';
import { alleMessungen } from '../shared/physik/messung.js';
import { leistungsindex } from '../shared/leistungsindex.js';

const md = process.argv.includes('--md');
const VOLL = { motor: 5, turbo: 5, reifen: 5, fahrwerk: 5, sperre: 5, bremse: 5, gewicht: 5 };
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '∞');
const f0 = (x) => (Number.isFinite(x) ? x.toFixed(0) : '∞');

const zeilen = [];
for (const a of AUTOS) {
  const m = alleMessungen(a.id);
  const v = alleMessungen(a.id, { tuning: VOLL });
  zeilen.push({ a, m, v, pi: leistungsindex(a.id, {}), piVoll: leistungsindex(a.id, VOLL) });
}

if (md) {
  console.log('| Auto | PI | 0–100 (Soll) | Höchstg. (Soll) | Wendekreis | Bremsweg 100–0 | max. Driftwinkel | Driftstabilität |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const { a, m, pi } of zeilen) {
    console.log(`| ${a.name} | ${pi} | ${f1(m.nullHundert)} s (${a.soll.nullHundert} s) | ${f0(m.hoechstKmh)} km/h (${a.soll.hoechstKmh}) | ${f1(m.wendekreis)} m | ${f1(m.bremsweg)} m | ${f0(m.maxDriftWinkel)}° | ${f1(m.driftStabilitaet)} s |`);
  }
  console.log('\n**Voll getunt (alle Kategorien Stufe 5):**\n');
  console.log('| Auto | PI (Zuwachs) | 0–100 | Höchstg. | Bremsweg | max. Driftwinkel |');
  console.log('|---|---|---|---|---|---|');
  for (const { a, v, pi, piVoll } of zeilen) {
    console.log(`| ${a.name} | ${piVoll} (+${Math.round((piVoll / pi - 1) * 100)} %) | ${f1(v.nullHundert)} s | ${f0(v.hoechstKmh)} km/h | ${f1(v.bremsweg)} m | ${f0(v.maxDriftWinkel)}° |`);
  }
} else {
  for (const { a, m, v, pi, piVoll } of zeilen) {
    console.log(`${a.name.padEnd(13)} PI ${String(pi).padStart(3)}→${piVoll} | 0-100 ${f1(m.nullHundert).padStart(5)}s (Soll ${a.soll.nullHundert}) | Vmax ${f0(m.hoechstKmh).padStart(3)} (Soll ${a.soll.hoechstKmh}) | Wende ${f1(m.wendekreis)}m | Brems ${f1(m.bremsweg)}m | Drift ${f0(m.maxDriftWinkel)}° | Stab ${f1(m.driftStabilitaet)}s || voll: 0-100 ${f1(v.nullHundert)} Vmax ${f0(v.hoechstKmh)}`);
  }
}
