// Gibt die Lage (x, y, Richtung) nach jedem Segment einer Strecke aus – hilft beim Streckenentwurf.
// Aufruf: node scripts/streckenPosen.js <streckenId>
import { STRECKEN } from '../shared/strecken/index.js';
import { kontrollpunkte } from '../shared/strecken/streckenBau.js';

const def = STRECKEN.find((s) => s.id === (process.argv[2] || 'industriehof'));
let summe = 0;
for (let i = 1; i <= def.segmente.length; i++) {
  const teil = { ...def, segmente: def.segmente.slice(0, i).filter((s) => s.typ !== 'schliessen') };
  const seg = def.segmente[i - 1];
  if (seg.typ === 'schliessen') break;
  const { ende } = kontrollpunkte(teil);
  summe += seg.typ === 'bogen' ? Math.abs(seg.winkel) * (Math.PI / 180) * seg.radius : seg.laenge;
  console.log(`${String(i).padStart(2)} ${seg.typ.padEnd(7)} → x ${ende.x.toFixed(0).padStart(5)} y ${ende.y.toFixed(0).padStart(5)} Richtung ${((ende.richtung * 180) / Math.PI).toFixed(0).padStart(5)}°  (Länge bis hier ${summe.toFixed(0)} m)${seg.zone ? '  Zone: ' + seg.zone.name : ''}`);
}
