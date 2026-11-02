// Sucht Regler-Werte für den Drift-Bot (Idealfahrt): maximiert Führer-Punkte, bestraft Wandkontakte
// und nicht beendete Runden. Aufruf: node scripts/botKalibrierung.js [autos=kestrel_s,bastion_gt]
// Ausgabe: die besten Kandidaten (zum Übernehmen in STANDARD_REGLER, botFahrer.js).
import { STRECKEN } from '../shared/strecken/index.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { durchgangSimulieren } from '../shared/simulation.js';
import { STANDARD_REGLER } from '../shared/bots/botFahrer.js';

const autos = (process.argv[2] || 'kestrel_s,bastion_gt,onyx_rs').split(',');
const strecken = STRECKEN.map((d) => baueStrecke(d));

function bewerten(regler) {
  let summe = 0;
  const details = [];
  for (const S of strecken) {
    for (const autoId of autos) {
      const r = durchgangSimulieren(S, { fuehrer: { autoId, stufe: 'ideal', regler, seed: 1 } });
      const f = r.fuehrer;
      summe += f.punkte - 4 * f.wand - 3 * f.spins - 40 * (r.fertig ? 0 : 1);
      details.push(`${S.id.slice(0, 4)}/${autoId.slice(0, 4)}:${f.punkte.toFixed(0)}p W${f.wand} S${f.spins}${r.fertig ? '' : ' X'} ${r.zeit.toFixed(0)}s`);
    }
  }
  return { wert: summe / (strecken.length * autos.length), details };
}

const raster = {
  gasModus: ['tempo'],
  kl: [0.05, 0.09],
  kld: [0.005, 0.015],
  kPfadLenk: [0, 0.25],
  gasT0: [0.6, 0.8],
  kvT: [0.08, 0.2],
  kQuer: [0, 2.5],
  kpGas: [0, 0.015],
  driftTempo: [0.85],
  assistenz: [0.85],
  kTheta: [1.6], kR: [0.6], randAbstand: [2.0], vorFaktor: [0.3]
};
const schluessel = Object.keys(raster);
const kandidaten = [];
(function bauen(i, akt) {
  if (i === schluessel.length) { kandidaten.push({ ...STANDARD_REGLER, ...akt }); return; }
  for (const w of raster[schluessel[i]]) bauen(i + 1, { ...akt, [schluessel[i]]: w });
})(0, {});

const ergebnisse = [];
const start = Date.now();
for (const k of kandidaten) ergebnisse.push({ k, ...bewerten(k) });
ergebnisse.sort((a, b) => b.wert - a.wert);
console.log(`${kandidaten.length} Kandidaten in ${((Date.now() - start) / 1000).toFixed(0)} s`);
console.log('Standard:', bewerten(STANDARD_REGLER).wert.toFixed(1));
for (const e of ergebnisse.slice(0, 5)) {
  const auszug = Object.fromEntries(schluessel.map((s) => [s, e.k[s]]));
  console.log(e.wert.toFixed(1), JSON.stringify(auszug));
  console.log('   ', e.details.join(' | '));
}
