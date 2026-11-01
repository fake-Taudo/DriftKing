// Diagnose: Verlauf eines Drift-Versuchs (Winkel, Tempo, Gierrate, Lenkwinkel, Schlupf).
// Aufruf: node scripts/driftSpur.js <autoId> <gas> <lenken> [assistenz]
import { Fahrzeug } from '../shared/physik/fahrzeug.js';
import { effektiveParameter } from '../shared/tuning.js';
import { GRAD } from '../shared/mathe.js';

const [autoId = 'kestrel_s', gasS = '0.8', lenkS = '0', assS = '0.6'] = process.argv.slice(2);
const f = new Fahrzeug(effektiveParameter(autoId), { gegenlenken: Number(assS), driftHalten: 0 });
f.setzen(0, 0, 0, 55 / 3.6);
const dt = 1 / 60;
for (let i = 0; i < 60 * 8; i++) {
  const t = i * dt;
  let e;
  if (t < 0.45) e = { lenken: -1, gas: 0.4, bremse: 0, handbremse: 1 };
  else if (t < 1.2) e = { lenken: -0.4, gas: Number(gasS), bremse: 0, handbremse: 0 };
  else e = { lenken: Number(lenkS), gas: Number(gasS), bremse: 0, handbremse: 0 };
  f.schritt(e, dt);
  if (i % 6 === 0) {
    const z = f.z;
    console.log(`t=${t.toFixed(2)} v=${(f.tempo * 3.6).toFixed(0)} winkel=${(f.schwimmwinkel / GRAD).toFixed(0)} r=${z.r.toFixed(2)} delta=${(z.delta / GRAD).toFixed(0)} aV=${(z.schlupfV / GRAD).toFixed(0)} aH=${(z.schlupfH / GRAD).toFixed(0)} spin=${z.durchdrehen.toFixed(2)} gang=${z.gang} rpm=${z.drehzahl.toFixed(0)} glH=${z.gleitenH.toFixed(2)}`);
  }
}
