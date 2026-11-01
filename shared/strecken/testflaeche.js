// Testfläche: große, ummauerte Betonfläche mit einigen Hindernissen (Kreise und gedrehte Rechtecke).
// Dient Physik-Tests und dem freien Ausprobieren der Fahrphysik.
import { KollisionsGitter } from '../physik/kollision.js';

export const TESTFLAECHE = {
  id: 'testflaeche',
  name: 'Testfläche',
  breite: 240,
  hoehe: 240,
  hindernisseKreis: [
    { x: 40, y: 30, r: 3.5, art: 'reifenstapel' },
    { x: -45, y: -35, r: 3.5, art: 'reifenstapel' },
    { x: 0, y: 70, r: 2.2, art: 'pylon' },
    { x: 70, y: -60, r: 6, art: 'reifenstapel' }
  ],
  hindernisseRechteck: [
    { x: -60, y: 50, hb: 1.3, hl: 6.1, winkel: 0.4, art: 'container' },
    { x: 60, y: 80, hb: 1.3, hl: 6.1, winkel: -0.8, art: 'container' },
    { x: -20, y: -80, hb: 0.6, hl: 4, winkel: 1.2, art: 'betonblock' }
  ],
  start: { x: 0, y: -20, theta: Math.PI / 2 }
};

/** Baut das Kollisionsgitter der Testfläche. */
export function testflaecheGitter(def = TESTFLAECHE) {
  const hb = def.breite / 2, hh = def.hoehe / 2;
  const ecken = [[-hb, -hh], [hb, -hh], [hb, hh], [-hb, hh]];
  const segmente = [];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = ecken[i];
    const [bx, by] = ecken[(i + 1) % 4];
    segmente.push({ ax, ay, bx, by, art: 'wand' });
  }
  const g = new KollisionsGitter(segmente, def.hindernisseKreis, 8);
  for (const r of def.hindernisseRechteck) g.rechteckHinzufuegen(r);
  return g;
}
