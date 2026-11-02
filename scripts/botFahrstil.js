// Sucht je Auto einen Bot-Fahrstil (Gas-Grundwert, Gas-Verstärkung, Winkel-Vorhalt, Drift-Tempo),
// der mit der Idealfahrt viele Punkte bei wenig Wandkontakt erzielt. Ergebnis zum Übernehmen in
// AUTO_FAHRSTIL (shared/bots/botFahrer.js). Aufruf: node scripts/botFahrstil.js
import { STRECKEN } from '../shared/strecken/index.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { durchgangSimulieren } from '../shared/simulation.js';
import { AUTO_IDS } from '../shared/autos.js';

const strecken = STRECKEN.map((d) => baueStrecke(d));
const raster = { gas0: [0.5, 0.65, 0.8], kpGas: [0.02, 0.04], sollFaktor: [1.0, 1.25], driftTempo: [0.72, 0.84] };
const keys = Object.keys(raster);
const kandidaten = [];
(function bauen(i, akt) {
  if (i === keys.length) return kandidaten.push(akt);
  for (const w of raster[keys[i]]) bauen(i + 1, { ...akt, [keys[i]]: w });
})(0, {});

const ergebnis = {};
for (const autoId of AUTO_IDS) {
  let best = null;
  for (const k of kandidaten) {
    let wert = 0, roh = 0;
    for (const S of strecken) {
      for (const seed of [1, 2]) {
        const r = durchgangSimulieren(S, { fuehrer: { autoId, stufe: 'ideal', seed, regler: { ...k } } });
        wert += r.fuehrer.roh / 100 * 60 - 3 * r.fuehrer.wand - 4 * r.fuehrer.spins - 30 * (r.fertig ? 0 : 1);
        roh += r.fuehrer.roh;
      }
    }
    if (!best || wert > best.wert) best = { wert, k, roh: roh / (strecken.length * 2) };
  }
  ergebnis[autoId] = best.k;
  console.log(autoId.padEnd(13), JSON.stringify(best.k), `Ø roh ${best.roh.toFixed(0)}`, `Wert ${best.wert.toFixed(0)}`);
}
console.log('\nexport const AUTO_FAHRSTIL = ' + JSON.stringify(ergebnis, null, 2) + ';');
