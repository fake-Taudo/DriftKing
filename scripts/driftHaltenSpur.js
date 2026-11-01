// Diagnose: Drift-Halteregler (wie in messung.js) mit Ausgabe des Verlaufs.
// Aufruf: node scripts/driftHaltenSpur.js <autoId> <sollGrad>
import { Fahrzeug } from '../shared/physik/fahrzeug.js';
import { effektiveParameter } from '../shared/tuning.js';
import { GRAD, klemme } from '../shared/mathe.js';

const [autoId = 'hornet_wagon', sollS = '40'] = process.argv.slice(2);
const soll = Number(sollS);
const f = new Fahrzeug(effektiveParameter(autoId), { gegenlenken: 0.6 });
f.setzen(0, 0, 0, 50 / 3.6);
const DT = 1 / 60;
let vorher = 0;
for (let i = 0; i < 60 * 9; i++) {
  const t = i * DT;
  const w = f.driftWinkel / GRAD;
  let e;
  if (t < 0.45) e = { lenken: -1, gas: 0.5, bremse: 0, handbremse: 1 };
  else {
    const fehler = soll - w;
    const rate = (w - vorher) / DT;
    e = { lenken: klemme(-0.04 * fehler + 0.006 * rate, -1, 1), gas: klemme(0.55 + 0.03 * fehler - 0.004 * rate, 0, 1), bremse: 0, handbremse: 0 };
  }
  vorher = w;
  f.schritt(e, DT);
  if (i % 9 === 0) {
    const z = f.z;
    console.log(`t=${t.toFixed(2)} v=${(f.tempo * 3.6).toFixed(0)} w=${w.toFixed(0)} gas=${e.gas.toFixed(2)} lenk=${e.lenken.toFixed(2)} delta=${(z.delta / GRAD).toFixed(0)} r=${z.r.toFixed(2)} spin=${z.durchdrehen.toFixed(2)} gang=${z.gang} rpm=${z.drehzahl.toFixed(0)} sn=${z.schlupfNormH.toFixed(1)}`);
  }
}
