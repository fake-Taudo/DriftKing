// Prozedural erzeugte Texturen (Canvas): Beton, Asphalt, Markierungen, weicher Schattenfleck usw.
// Keine Bilddateien – alles wird beim Laden selbst gezeichnet und zwischengespeichert.
import * as THREE from 'three';
import { Zufall } from '../../shared/zufall.js';

const cache = new Map();

function leinwand(b, h) {
  const c = document.createElement('canvas');
  c.width = b;
  c.height = h;
  return c;
}

function alsTextur(c, { wiederholen = true, srgb = true, anisotropie = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (wiederholen) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropie;
  t.needsUpdate = true;
  return t;
}

/** Körniges Rauschen auf ein Canvas legen. */
function rauschen(ctx, b, h, z, staerke, anzahl) {
  for (let i = 0; i < anzahl; i++) {
    const x = z.naechste() * b, y = z.naechste() * h;
    const hell = z.naechste() < 0.5;
    ctx.fillStyle = hell ? `rgba(255,255,255,${staerke * z.naechste()})` : `rgba(0,0,0,${staerke * z.naechste()})`;
    const s = 1 + z.naechste() * 2.5;
    ctx.fillRect(x, y, s, s);
  }
}

/** Betonplatten mit Fugen (Industriehof, Testfläche). */
export function betonTextur(grund = '#8d9096') {
  const schl = 'beton' + grund;
  if (cache.has(schl)) return cache.get(schl);
  const g = 512;
  const c = leinwand(g, g);
  const ctx = c.getContext('2d');
  const z = new Zufall('beton');
  ctx.fillStyle = grund;
  ctx.fillRect(0, 0, g, g);
  // Flecken
  for (let i = 0; i < 40; i++) {
    const x = z.naechste() * g, y = z.naechste() * g, r = 20 + z.naechste() * 70;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dunkel = z.naechste() < 0.6;
    grad.addColorStop(0, dunkel ? 'rgba(40,40,45,0.13)' : 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  rauschen(ctx, g, g, z, 0.12, 9000);
  // Fugen (Plattenraster 2×2 pro Kachel)
  ctx.strokeStyle = 'rgba(30,30,34,0.55)';
  ctx.lineWidth = 3;
  for (const p of [0, g / 2]) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, g); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(g, p); ctx.stroke();
  }
  const t = alsTextur(c);
  cache.set(schl, t);
  return t;
}

/** Asphalt (Küstenpass, Neon-Hafen). */
export function asphaltTextur(grund = '#3b3d44') {
  const schl = 'asphalt' + grund;
  if (cache.has(schl)) return cache.get(schl);
  const g = 512;
  const c = leinwand(g, g);
  const ctx = c.getContext('2d');
  const z = new Zufall('asphalt');
  ctx.fillStyle = grund;
  ctx.fillRect(0, 0, g, g);
  rauschen(ctx, g, g, z, 0.18, 22000);
  for (let i = 0; i < 25; i++) {
    const x = z.naechste() * g, y = z.naechste() * g, r = 30 + z.naechste() * 90;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(0,0,0,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = alsTextur(c);
  cache.set(schl, t);
  return t;
}

/** Weicher runder Schattenfleck (Blob-Schatten auf Qualität „Niedrig“). */
export function blobTextur() {
  if (cache.has('blob')) return cache.get('blob');
  const g = 128;
  const c = leinwand(g, g);
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(g / 2, g / 2, 0, g / 2, g / 2, g / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, g, g);
  const t = alsTextur(c, { wiederholen: false, srgb: false });
  cache.set('blob', t);
  return t;
}

/** Weicher Leuchtpunkt (für additive Glow-Sprites, Partikel). */
export function glowTextur() {
  if (cache.has('glow')) return cache.get('glow');
  const g = 128;
  const c = leinwand(g, g);
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(g / 2, g / 2, 0, g / 2, g / 2, g / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, g, g);
  const t = alsTextur(c, { wiederholen: false, srgb: false });
  cache.set('glow', t);
  return t;
}

/** Rot-weiße Randsteine (Curbs). */
export function curbTextur(a = '#e8e8e8', b = '#d62a2a') {
  const schl = 'curb' + a + b;
  if (cache.has(schl)) return cache.get(schl);
  const c = leinwand(64, 16);
  const ctx = c.getContext('2d');
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 64, 16);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 32, 16);
  const t = alsTextur(c, { anisotropie: 2 });
  cache.set(schl, t);
  return t;
}

/** Leitplanken-/Wandmuster mit Warnstreifen. */
export function warnstreifenTextur(a = '#f2c230', b = '#1d1d22') {
  const schl = 'warn' + a + b;
  if (cache.has(schl)) return cache.get(schl);
  const c = leinwand(128, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = b;
  for (let x = -32; x < 160; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 32); ctx.lineTo(x + 16, 32); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 16, 0);
    ctx.closePath();
    ctx.fill();
  }
  const t = alsTextur(c, { anisotropie: 2 });
  cache.set(schl, t);
  return t;
}

/** Gibt alle zwischengespeicherten Texturen frei (z. B. nach Kontextverlust neu erzeugen). */
export function texturenNeuHochladen() {
  for (const t of cache.values()) t.needsUpdate = true;
}
