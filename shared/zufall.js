// Seedbarer Zufallsgenerator (sfc32). Wird in Physik, Wertung und Bots statt Math.random()
// verwendet, damit gleiche Eingaben + gleicher Seed auf demselben System gleiche Ergebnisse liefern.

/** Erzeugt aus einem beliebigen String/Zahl einen 32-Bit-Seed (FNV-1a + Mischung). */
export function seedAus(wert) {
  const s = String(wert);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

export class Zufall {
  /** @param {number|string} seed */
  constructor(seed = 1) {
    const s = typeof seed === 'number' ? seed >>> 0 : seedAus(seed);
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = s;
    // Aufwärmen, damit ähnliche Seeds verschiedene Folgen ergeben
    for (let i = 0; i < 15; i++) this.naechste();
  }

  /** Liefert eine gleichverteilte Zahl in [0, 1). */
  naechste() {
    let { a, b, c, d } = this;
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return (t >>> 0) / 4294967296;
  }

  /** Zahl in [min, max). */
  bereich(min, max) {
    return min + (max - min) * this.naechste();
  }

  /** Ganzzahl in [min, max] (inklusive). */
  ganz(min, max) {
    return min + Math.floor(this.naechste() * (max - min + 1));
  }

  /** true mit Wahrscheinlichkeit p. */
  chance(p) {
    return this.naechste() < p;
  }

  /** Normalverteilt (Box-Muller), Mittel 0, Standardabweichung 1. */
  normal() {
    let u = 0;
    while (u === 0) u = this.naechste();
    const v = this.naechste();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Zufälliges Element einer Liste. */
  waehle(liste) {
    return liste[Math.floor(this.naechste() * liste.length)];
  }

  /** Mischt eine Kopie der Liste (Fisher-Yates). */
  gemischt(liste) {
    const k = liste.slice();
    for (let i = k.length - 1; i > 0; i--) {
      const j = Math.floor(this.naechste() * (i + 1));
      [k[i], k[j]] = [k[j], k[i]];
    }
    return k;
  }

  /** Zustand sichern/wiederherstellen (z. B. für Wiederholungen). */
  zustand() {
    return [this.a, this.b, this.c, this.d];
  }

  setzeZustand(z) {
    [this.a, this.b, this.c, this.d] = z;
  }
}
