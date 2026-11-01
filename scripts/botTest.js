// Lässt Bots auf allen Strecken je eine Runde fahren und gibt Rundenzeit, Wandkontakte und Resets aus.
// Aufruf: node scripts/botTest.js [modus=grip|drift] [stufe] [autoId]
import { STRECKEN } from '../shared/strecken/index.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { botRunde } from '../shared/simulation.js';
import { AUTO_IDS } from '../shared/autos.js';

const [modus = 'grip', stufe = 'legende', autoArg] = process.argv.slice(2);
const autos = autoArg ? [autoArg] : AUTO_IDS;
for (const def of STRECKEN) {
  const S = baueStrecke(def);
  const zeilen = [];
  for (const autoId of autos) {
    const r = botRunde(S, { autoId, stufe, modus, seed: 7 });
    zeilen.push(`${autoId}: ${r.fertig ? r.zeit.toFixed(1) + ' s' : 'NICHT FERTIG'} W${r.wandkontakte} R${r.resets}`);
  }
  console.log(`${def.name.padEnd(12)} (${S.laenge.toFixed(0)} m, Ideal ${S.ideal.rundenzeit.toFixed(1)} s) | ${zeilen.join(' | ')}`);
}
