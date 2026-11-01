// Register aller Strecken (Reihenfolge = Freischalt-Reihenfolge).
import industriehof from './industriehof.js';
import kuestenpass from './kuestenpass.js';
import neonhafen from './neonhafen.js';

export const STRECKEN = [industriehof, kuestenpass, neonhafen];
export const STRECKEN_IDS = STRECKEN.map((s) => s.id);

export function streckenDef(id) {
  const s = STRECKEN.find((x) => x.id === id);
  if (!s) throw new Error('Unbekannte Strecke: ' + id);
  return s;
}
