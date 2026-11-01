// Umrechnung Physik (2D: x, y, theta) ↔ Three.js-Welt (X rechts, Y oben, Z).
// Welt-X = x, Welt-Z = −y (damit die Karte von oben nicht gespiegelt ist).
// Automodelle sind mit der Front in +Z gebaut (links = +X); rotation.y = theta + π/2.

export const HALB_PI = Math.PI / 2;

/** Setzt einen THREE.Vector3 auf die Weltposition eines Physik-Punkts. */
export function zuWelt(x, y, hoehe, ziel) {
  return ziel.set(x, hoehe, -y);
}

/** Rotation um die Hochachse für ein Modell mit Front in +Z. */
export function gierZuRotY(theta) {
  return theta + HALB_PI;
}

/** Interpolation zweier Winkel auf dem kürzesten Weg. */
export function winkelLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
