// Kollision: Wände/Leitplanken als Liniensegmente in einem gleichmäßigen Raster (Uniform Grid),
// Hindernisse als Kreise oder gedrehte Rechtecke (OBB → 4 Segmente). Autos werden als drei Kreise
// entlang der Längsachse angenähert (Kapsel-Näherung).

export class KollisionsGitter {
  /**
   * @param {Array<{ax:number, ay:number, bx:number, by:number, art?:string}>} segmente
   * @param {Array<{x:number, y:number, r:number, art?:string}>} kreise
   * @param {number} zelle Zellgröße in m
   */
  constructor(segmente = [], kreise = [], zelle = 8) {
    this.zelle = zelle;
    this.segmente = [];
    this.kreise = [];
    this.zellen = new Map();
    this._stempel = new Uint32Array(0);
    this._kreisStempel = new Uint32Array(0);
    this._lauf = 1;
    for (const s of segmente) this.segmentHinzufuegen(s);
    for (const k of kreise) this.kreisHinzufuegen(k);
  }

  _schluessel(ix, iy) {
    return ix * 73856093 ^ iy * 19349663;
  }

  _eintragen(minX, minY, maxX, maxY, eintrag) {
    const z = this.zelle;
    const x0 = Math.floor(minX / z), x1 = Math.floor(maxX / z);
    const y0 = Math.floor(minY / z), y1 = Math.floor(maxY / z);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const k = this._schluessel(ix, iy);
        let liste = this.zellen.get(k);
        if (!liste) { liste = []; this.zellen.set(k, liste); }
        liste.push(eintrag);
      }
    }
  }

  segmentHinzufuegen(s) {
    const i = this.segmente.length;
    const dx = s.bx - s.ax, dy = s.by - s.ay;
    const len = Math.hypot(dx, dy) || 1e-6;
    this.segmente.push({ ...s, nx: -dy / len, ny: dx / len, laenge: len });
    this._eintragen(Math.min(s.ax, s.bx), Math.min(s.ay, s.by), Math.max(s.ax, s.bx), Math.max(s.ay, s.by), i);
    this._stempel = new Uint32Array(this.segmente.length);
  }

  kreisHinzufuegen(k) {
    const i = this.kreise.length;
    this.kreise.push({ ...k });
    this._eintragen(k.x - k.r, k.y - k.r, k.x + k.r, k.y + k.r, -(i + 1));
    this._kreisStempel = new Uint32Array(this.kreise.length);
  }

  /** Gedrehtes Rechteck (Mitte, halbe Breite/Länge, Winkel) als 4 Segmente eintragen. */
  rechteckHinzufuegen({ x, y, hb, hl, winkel, art = 'hindernis' }) {
    const c = Math.cos(winkel), s = Math.sin(winkel);
    const ecken = [[hl, hb], [-hl, hb], [-hl, -hb], [hl, -hb]].map(([lx, ly]) => [x + lx * c - ly * s, y + lx * s + ly * c]);
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = ecken[i];
      const [bx, by] = ecken[(i + 1) % 4];
      this.segmentHinzufuegen({ ax, ay, bx, by, art });
    }
  }

  /**
   * Ruft fn(segment) bzw. kreisFn(kreis) für alle Kandidaten im Umkreis auf (ohne Doppelte).
   */
  abfrage(x, y, r, segFn, kreisFn) {
    const z = this.zelle;
    const lauf = ++this._lauf;
    if (lauf >= 0xfffffff0) { this._stempel.fill(0); this._kreisStempel.fill(0); this._lauf = 1; }
    const x0 = Math.floor((x - r) / z), x1 = Math.floor((x + r) / z);
    const y0 = Math.floor((y - r) / z), y1 = Math.floor((y + r) / z);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const liste = this.zellen.get(this._schluessel(ix, iy));
        if (!liste) continue;
        for (const e of liste) {
          if (e >= 0) {
            if (this._stempel[e] === this._lauf) continue;
            this._stempel[e] = this._lauf;
            segFn(this.segmente[e]);
          } else if (kreisFn) {
            const ki = -e - 1;
            if (this._kreisStempel[ki] === this._lauf) continue;
            this._kreisStempel[ki] = this._lauf;
            kreisFn(this.kreise[ki]);
          }
        }
      }
    }
  }

  /**
   * Tiefster Kontakt eines Kreises (Mitte x,y, Radius r) mit Wänden und Hindernissen.
   * @returns {null | {tiefe:number, nx:number, ny:number, px:number, py:number, art:string}}
   */
  kreisKontakt(x, y, r) {
    let bester = null;
    this.abfrage(x, y, r + 0.5, (s) => {
      const abx = s.bx - s.ax, aby = s.by - s.ay;
      const len2 = abx * abx + aby * aby;
      let t = len2 > 1e-12 ? ((x - s.ax) * abx + (y - s.ay) * aby) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = s.ax + abx * t, qy = s.ay + aby * t;
      let dx = x - qx, dy = y - qy;
      const d = Math.hypot(dx, dy);
      if (d >= r) return;
      let nx, ny;
      if (d > 1e-6) { nx = dx / d; ny = dy / d; } else { nx = s.nx; ny = s.ny; }
      const tiefe = r - d;
      if (!bester || tiefe > bester.tiefe) bester = { tiefe, nx, ny, px: qx, py: qy, art: s.art || 'wand' };
    }, (k) => {
      const dx = x - k.x, dy = y - k.y;
      const d = Math.hypot(dx, dy);
      const tiefe = r + k.r - d;
      if (tiefe <= 0) return;
      const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
      if (!bester || tiefe > bester.tiefe) bester = { tiefe, nx, ny, px: k.x + nx * k.r, py: k.y + ny * k.r, art: k.art || 'hindernis' };
    });
    return bester;
  }

  /** Abstand eines Punkts zur nächsten Wand (für Kamera-Kollision), begrenzt auf maxR. */
  naechsteWand(x, y, maxR) {
    let best = maxR;
    this.abfrage(x, y, maxR, (s) => {
      const abx = s.bx - s.ax, aby = s.by - s.ay;
      const len2 = abx * abx + aby * aby;
      let t = len2 > 1e-12 ? ((x - s.ax) * abx + (y - s.ay) * aby) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - (s.ax + abx * t), y - (s.ay + aby * t));
      if (d < best) best = d;
    }, (k) => {
      const d = Math.hypot(x - k.x, y - k.y) - k.r;
      if (d < best) best = Math.max(0, d);
    });
    return best;
  }

  /**
   * Schnitt eines Strahls (von a nach b) mit Wänden: liefert Anteil t ∈ [0,1] des ersten Treffers
   * (1 = frei). Für die Kamera-Kollision.
   */
  strahl(ax, ay, bx, by) {
    let tMin = 1;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const r = Math.hypot(bx - ax, by - ay) / 2 + 0.5;
    const rx = bx - ax, ry = by - ay;
    this.abfrage(mx, my, r, (s) => {
      const sx = s.bx - s.ax, sy = s.by - s.ay;
      const nenner = rx * sy - ry * sx;
      if (Math.abs(nenner) < 1e-9) return;
      const t = ((s.ax - ax) * sy - (s.ay - ay) * sx) / nenner;
      const u = ((s.ax - ax) * ry - (s.ay - ay) * rx) / nenner;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < tMin) tMin = t;
    }, (k) => {
      // Strahl-Kreis-Schnitt
      const fx = ax - k.x, fy = ay - k.y;
      const a = rx * rx + ry * ry;
      const b = 2 * (fx * rx + fy * ry);
      const c = fx * fx + fy * fy - k.r * k.r;
      const disk = b * b - 4 * a * c;
      if (disk < 0 || a < 1e-9) return;
      const t = (-b - Math.sqrt(disk)) / (2 * a);
      if (t >= 0 && t <= 1 && t < tMin) tMin = t;
    });
    return tMin;
  }
}

/** Mittelpunkte und Radius der drei Kollisionskreise eines Autos (Karosserie-Koordinaten). */
export function autoKreise(abmessungen) {
  const r = (abmessungen.breite / 2) * 0.96;
  const versatz = Math.max(0, abmessungen.laenge / 2 - r);
  return { r, versaetze: [versatz, 0, -versatz] };
}
