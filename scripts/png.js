// Minimaler PNG-Encoder und Software-Rasterer für Hilfsskripte (Icons, Streckenvorschau).
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const td = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([laenge, td, crc]);
}

/** RGBA-Puffer → PNG-Datei (Buffer). */
export function pngKodieren(breite, hoehe, rgba) {
  const roh = Buffer.alloc((breite * 4 + 1) * hoehe);
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * breite * 4, breite * 4).copy(roh, y * (breite * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(roh, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** Einfaches Zeichenbrett mit Weltkoordinaten → Pixel. */
export class Zeichenbrett {
  constructor(breite, hoehe, welt, hintergrund = [20, 24, 40]) {
    this.b = breite;
    this.h = hoehe;
    this.px = new Uint8Array(breite * hoehe * 4);
    for (let i = 0; i < breite * hoehe; i++) {
      this.px[i * 4] = hintergrund[0]; this.px[i * 4 + 1] = hintergrund[1]; this.px[i * 4 + 2] = hintergrund[2]; this.px[i * 4 + 3] = 255;
    }
    const sx = (breite - 20) / (welt.maxX - welt.minX);
    const sy = (hoehe - 20) / (welt.maxY - welt.minY);
    this.s = Math.min(sx, sy);
    this.ox = 10 - welt.minX * this.s + ((breite - 20) - (welt.maxX - welt.minX) * this.s) / 2;
    this.oy = 10 + welt.maxY * this.s + ((hoehe - 20) - (welt.maxY - welt.minY) * this.s) / 2;
  }
  p(x, y) { return [this.ox + x * this.s, this.oy - y * this.s]; }
  setze(x, y, f, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.b || y >= this.h) return;
    const i = (y * this.b + x) * 4;
    this.px[i] = this.px[i] * (1 - a) + f[0] * a;
    this.px[i + 1] = this.px[i + 1] * (1 - a) + f[1] * a;
    this.px[i + 2] = this.px[i + 2] * (1 - a) + f[2] * a;
  }
  linie(x1, y1, x2, y2, f, dicke = 1) {
    const [a, b] = this.p(x1, y1);
    const [c, d] = this.p(x2, y2);
    const minX = Math.floor(Math.min(a, c) - dicke), maxX = Math.ceil(Math.max(a, c) + dicke);
    const minY = Math.floor(Math.min(b, d) - dicke), maxY = Math.ceil(Math.max(b, d) + dicke);
    const dx = c - a, dy = d - b, l2 = dx * dx + dy * dy || 1;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      let t = ((x - a) * dx + (y - b) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const ex = a + dx * t - x, ey = b + dy * t - y;
      const dist = Math.sqrt(ex * ex + ey * ey);
      if (dist <= dicke / 2 + 0.5) this.setze(x, y, f, Math.min(1, dicke / 2 + 0.5 - dist));
    }
  }
  viereck(punkte, f) {
    const pp = punkte.map(([x, y]) => this.p(x, y));
    const minX = Math.floor(Math.min(...pp.map((q) => q[0]))), maxX = Math.ceil(Math.max(...pp.map((q) => q[0])));
    const minY = Math.floor(Math.min(...pp.map((q) => q[1]))), maxY = Math.ceil(Math.max(...pp.map((q) => q[1])));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      let innen = false;
      for (let i = 0, j = pp.length - 1; i < pp.length; j = i++) {
        const [xi, yi] = pp[i], [xj, yj] = pp[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) innen = !innen;
      }
      if (innen) this.setze(x, y, f);
    }
  }
  kreis(x, y, r, f) {
    const [cx, cy] = this.p(x, y);
    const rp = r * this.s;
    for (let py = Math.floor(cy - rp); py <= cy + rp; py++) for (let px = Math.floor(cx - rp); px <= cx + rp; px++) {
      if ((px - cx) ** 2 + (py - cy) ** 2 <= rp * rp) this.setze(px, py, f);
    }
  }
  png() { return pngKodieren(this.b, this.h, this.px); }
}
