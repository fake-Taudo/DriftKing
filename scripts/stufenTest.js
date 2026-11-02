// Prüft die Bot-Stufen: mittlere Führer-Punkte je Stufe und Strecke (mehrere Seeds, Autos der
// Pool-Gegner der Stufe) gegen die Zielbereiche aus SPEC.md 7.3. Aufruf: node scripts/stufenTest.js [laeufe=8]
import { STRECKEN } from '../shared/strecken/index.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { durchgangSimulieren } from '../shared/simulation.js';
import { BOT_STUFEN } from '../shared/bots/botStufen.js';
import { autosDerStufe } from '../shared/bots/gegnerPool.js';

const laeufe = Number(process.argv[2] || 8);
for (const def of STRECKEN) {
  const S = baueStrecke(def);
  const zeilen = [];
  for (const st of BOT_STUFEN) {
    let summe = 0, fertig = 0;
    const autos = autosDerStufe(st.id);
    for (let k = 0; k < laeufe; k++) {
      const r = durchgangSimulieren(S, { fuehrer: { autoId: autos[k % autos.length], stufe: st.id, seed: 100 + k } });
      summe += r.fuehrer.punkte;
      fertig += r.fertig ? 1 : 0;
    }
    const m = summe / laeufe;
    const [a, b] = st.zielPunkte;
    const ok = m >= a - 7 && m <= b + 7 ? 'ok' : 'XX';
    zeilen.push(`${st.id.slice(0, 5)} ${m.toFixed(0).padStart(3)} (${a}-${b}) ${ok} fertig ${fertig}/${laeufe}`);
  }
  console.log(def.id.padEnd(13), zeilen.join(' | '));
}
