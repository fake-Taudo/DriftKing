// Erzeugt die PNG-Icons (192 und 512 px) für das Web-App-Manifest – ohne externe Pakete.
// Zeichnet dasselbe Motiv wie client/public/icons/icon.svg per Software-Rasterung (4×4 Supersampling).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ziel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'public', 'icons');
mkdirSync(ziel, { recursive: true });

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
function png(breite, hoehe, rgba) {
  const roh = Buffer.alloc((breite * 4 + 1) * hoehe);
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 4 + 1)] = 0;
    rgba.copy(roh, y * (breite * 4 + 1) + 1, y * breite * 4, (y + 1) * breite * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(roh, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Punkt-in-Polygon (gerade/ungerade)
function inPoly(x, y, p) {
  let innen = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) innen = !innen;
  }
  return innen;
}
// Bézier-Band als Polygon annähern
function band(p0, p1, p2, p3, dicke) {
  const oben = [];
  const unten = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    oben.push([x, y]);
    unten.push([x, y + dicke]);
  }
  return oben.concat(unten.reverse());
}
const streifenCyan = band([60, 380], [170, 330], [300, 330], [452, 250], 40);
const streifenPink = band([60, 430], [170, 384], [300, 384], [452, 310], 36);
const krone = [[120, 300], [150, 140], [210, 220], [256, 110], [302, 220], [362, 140], [392, 300]];

function farbeBei(x, y) {
  // Abgerundetes Quadrat (Radius 112)
  const r = 112;
  const cx = Math.min(Math.max(x, r), 512 - r);
  const cy = Math.min(Math.max(y, r), 512 - r);
  if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return [0, 0, 0, 0];
  const t = (x + y) / 1024;
  let f = [28 + (11 - 28) * t, 34 + (14 - 34) * t, 70 + (28 - 70) * t, 255];
  if (inPoly(x, y, streifenCyan)) f = [46, 230, 255, 255];
  if (inPoly(x, y, streifenPink)) f = [255, 61, 110, 255];
  if (inPoly(x, y, krone)) {
    const k = (y - 110) / 190;
    f = [255, 255 - 47 * k, 255 - 35 * k, 255];
  }
  for (const [kx, ky, kr] of [[150, 132, 18], [256, 102, 20], [362, 132, 18]]) {
    if ((x - kx) ** 2 + (y - ky) ** 2 < kr * kr) f = [255, 209, 102, 255];
  }
  return f;
}

for (const groesse of [192, 512]) {
  const daten = Buffer.alloc(groesse * groesse * 4);
  const s = 512 / groesse;
  const SS = 4;
  for (let py = 0; py < groesse; py++) {
    for (let px = 0; px < groesse; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const f = farbeBei((px + (sx + 0.5) / SS) * s, (py + (sy + 0.5) / SS) * s);
          r += f[0] * f[3]; g += f[1] * f[3]; b += f[2] * f[3]; a += f[3];
        }
      }
      const i = (py * groesse + px) * 4;
      daten[i] = a ? Math.round(r / a) : 0;
      daten[i + 1] = a ? Math.round(g / a) : 0;
      daten[i + 2] = a ? Math.round(b / a) : 0;
      daten[i + 3] = Math.round(a / (SS * SS));
    }
  }
  writeFileSync(path.join(ziel, `icon-${groesse}.png`), png(groesse, groesse, daten));
  console.log(`icon-${groesse}.png geschrieben`);
}
