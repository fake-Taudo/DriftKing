// Zonen-Atlas der Livery-Textur (eine Canvas-Textur pro Auto). Jede Zone ist ein festes Rechteck
// im Atlas (Anteile 0..1, Ursprung oben links). Die Karosserie-Flächen werden planar in ihre Zone
// projiziert (siehe karosserie.js). Dokumentation: docs/LIVERY.md.

export const ATLAS = {
  seiteL: { x: 0.0, y: 0.0, b: 1.0, h: 0.3, name: 'Linke Seite' },
  seiteR: { x: 0.0, y: 0.3, b: 1.0, h: 0.3, name: 'Rechte Seite' },
  haube: { x: 0.0, y: 0.6, b: 0.34, h: 0.4, name: 'Haube' },
  dach: { x: 0.34, y: 0.6, b: 0.3, h: 0.4, name: 'Dach' },
  heck: { x: 0.64, y: 0.6, b: 0.36, h: 0.22, name: 'Kofferraum/Heck' },
  front: { x: 0.64, y: 0.82, b: 0.36, h: 0.18, name: 'Front' }
};

/** Wandelt lokale Zonen-Koordinaten (u: 0..1 links→rechts, v: 0..1 unten→oben) in Textur-UV. */
export function zonenUV(zone, u, v) {
  const z = ATLAS[zone];
  const uu = Math.min(1, Math.max(0, u));
  const vv = Math.min(1, Math.max(0, v));
  // Textur-UV: v = 0 unten (Canvas-Texturen werden beim Hochladen gespiegelt)
  return [z.x + uu * z.b, 1 - (z.y + (1 - vv) * z.h)];
}
