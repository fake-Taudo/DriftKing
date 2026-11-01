// Kleine Mathe-Hilfen ohne Browser- oder Three.js-Abhängigkeit.

export const PI = Math.PI;
export const ZWEI_PI = Math.PI * 2;
export const GRAD = Math.PI / 180; // 1 Grad in Radiant
export const KMH = 3.6; // m/s → km/h

/** Begrenzt x auf [a, b]. */
export function klemme(x, a, b) {
  return x < a ? a : x > b ? b : x;
}

/** Lineare Interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Inverse lineare Interpolation, begrenzt auf [0, 1]. */
export function invLerp(a, b, x) {
  if (a === b) return x >= b ? 1 : 0;
  return klemme((x - a) / (b - a), 0, 1);
}

/** Bildet einen Winkel auf (-PI, PI] ab. */
export function winkelNorm(w) {
  w = w % ZWEI_PI;
  if (w <= -PI) w += ZWEI_PI;
  else if (w > PI) w -= ZWEI_PI;
  return w;
}

/** Kürzeste Winkeldifferenz b - a. */
export function winkelDiff(a, b) {
  return winkelNorm(b - a);
}

/** Bewegt einen Wert mit maximaler Rate auf ein Ziel zu. */
export function naehern(wert, ziel, maxSchritt) {
  if (wert < ziel) return Math.min(ziel, wert + maxSchritt);
  return Math.max(ziel, wert - maxSchritt);
}

/** Exponentielle Glättung, unabhängig von der Schrittweite (Zeitkonstante tau in s). */
export function glaetten(wert, ziel, tau, dt) {
  if (tau <= 0) return ziel;
  return ziel + (wert - ziel) * Math.exp(-dt / tau);
}

/** Glatter Übergang (smoothstep) zwischen a und b. */
export function glattStufe(a, b, x) {
  const t = invLerp(a, b, x);
  return t * t * (3 - 2 * t);
}

/** Vorzeichen mit 0 → 1 (für Richtungsberechnungen). */
export function vorzeichen(x) {
  return x < 0 ? -1 : 1;
}

/** Prüft, ob alle übergebenen Werte endliche Zahlen sind. */
export function alleEndlich(...werte) {
  for (const w of werte) if (!Number.isFinite(w)) return false;
  return true;
}

/** Abstand zweier Punkte. */
export function abstand(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Rundet auf n Nachkommastellen. */
export function runden(x, n = 0) {
  const f = 10 ** n;
  return Math.round(x * f) / f;
}

/** Abstand Punkt P zu Segment AB, liefert {d, t, px, py} (t = Anteil auf AB). */
export function punktSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 1e-12 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
  t = klemme(t, 0, 1);
  const qx = ax + abx * t;
  const qy = ay + aby * t;
  const dx = px - qx;
  const dy = py - qy;
  return { d: Math.sqrt(dx * dx + dy * dy), t, px: qx, py: qy };
}
