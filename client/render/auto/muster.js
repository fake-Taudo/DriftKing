// Muster der Lackierung: 12 selbst erzeugte Muster, deterministisch (gleicher Look = gleiches Bild).
// Gezeichnet wird je Zone in Metern auf der Karosserie (x: 0..masse.b, y: 0..masse.h, y nach unten), damit
// Muster unverzerrt und zwischen Haube, Dach und Heck in gleicher Breite durchlaufen.
// Lage der Zonen: siehe docs/LIVERY.md. Die Seiten sind so gespiegelt, dass x überall von vorne nach
// hinten läuft; lackiert ist dort der Bereich unterhalb der Scheiben (Seitenband).

/** Lackierter Bereich der Seitenzone in Anteilen der Zonenhöhe (oben = Dachhöhe, unten = Boden). */
const SEITE_OBEN = 0.34;
const SEITE_UNTEN = 0.92;

const istSeite = (z) => z === 'seiteL' || z === 'seiteR';
const istMitte = (z) => z === 'haube' || z === 'dach' || z === 'heck' || z === 'front';

/** Kleiner, fester Zufallsgenerator (Muster müssen auf jedem Gerät gleich aussehen). */
function zufall(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function abdunkeln(hex, faktor) {
  const n = parseInt(hex.slice(1), 16);
  const k = (x) => Math.round(x * faktor);
  return `rgb(${k((n >> 16) & 255)},${k((n >> 8) & 255)},${k(n & 255)})`;
}

const ZONEN_SEED = { seiteL: 11, seiteR: 11, haube: 23, dach: 37, heck: 41, front: 53 };

const MALER = {
  rennstreifen(ctx, zone, B, H, s) {
    if (!istMitte(zone)) return;
    const b = 0.42 * s;
    ctx.fillRect(B / 2 - b / 2, 0, b, H);
  },

  doppelstreifen(ctx, zone, B, H, s) {
    if (!istMitte(zone)) return;
    const b = 0.2 * s, luecke = 0.1 * s;
    ctx.fillRect(B / 2 - luecke / 2 - b, 0, b, H);
    ctx.fillRect(B / 2 + luecke / 2, 0, b, H);
  },

  karbon(ctx, zone, B, H, s) {
    const f = Math.max(0.025, 0.05 * s);
    ctx.fillStyle = 'rgba(14, 15, 18, 0.92)';
    ctx.fillRect(0, 0, B, H);
    ctx.fillStyle = 'rgba(70, 73, 82, 0.9)';
    for (let i = 0; i * f < B; i++) {
      for (let k = 0; k * f < H; k++) {
        if ((i + k) % 2) ctx.fillRect(i * f, k * f, f * 0.9, f * 0.42);
        else ctx.fillRect(i * f, k * f, f * 0.42, f * 0.9);
      }
    }
  },

  flammen(ctx, zone, B, H, s) {
    const tongue = (y0, dicke, laenge) => {
      ctx.beginPath();
      ctx.moveTo(0, y0 - dicke / 2);
      const n = 4;
      for (let i = 0; i < n; i++) {
        const a = y0 - dicke / 2 + (dicke * i) / n;
        const e = y0 - dicke / 2 + (dicke * (i + 0.5)) / n;
        const f = y0 - dicke / 2 + (dicke * (i + 1)) / n;
        const l = laenge * (i % 2 ? 0.72 : 1);
        ctx.bezierCurveTo(l * 0.35, a - dicke * 0.04, l * 0.7, e - dicke * 0.2, l, e);
        ctx.bezierCurveTo(l * 0.62, e + dicke * 0.12, l * 0.42, f - dicke * 0.04, l * 0.3, f);
      }
      ctx.lineTo(0, y0 + dicke / 2);
      ctx.closePath();
      ctx.fill();
    };
    if (istSeite(zone)) {
      tongue(H * (SEITE_OBEN + SEITE_UNTEN) * 0.5, H * (SEITE_UNTEN - SEITE_OBEN) * 0.92, Math.min(B, 2.3 * s));
    } else if (zone === 'haube') {
      ctx.save();
      ctx.translate(B / 2, 0);
      ctx.rotate(Math.PI / 2);
      tongue(0, B * 0.82, Math.min(H * 1.1, 1.6 * s));
      ctx.restore();
    } else if (zone === 'front') {
      ctx.fillRect(0, H * 0.72, B, H * 0.28);
    }
  },

  wellen(ctx, zone, B, H, s) {
    const welle = 0.7 * s, hoehe = 0.09 * s, abstand = 0.34 * s, band = 0.13 * s;
    ctx.beginPath();
    for (let y = -hoehe; y < H + abstand; y += abstand) {
      ctx.moveTo(0, y);
      for (let x = 0; x <= B + 0.05; x += 0.05) ctx.lineTo(x, y + Math.sin((x / welle) * Math.PI * 2) * hoehe);
      for (let x = B + 0.05; x >= 0; x -= 0.05) ctx.lineTo(x, y + band + Math.sin((x / welle) * Math.PI * 2) * hoehe);
      ctx.closePath();
    }
    ctx.fill();
  },

  tarnung(ctx, zone, B, H, s, m) {
    const r = zufall(ZONEN_SEED[zone]);
    const zelle = 0.46 * s;
    const fleck = (farbe) => {
      ctx.fillStyle = farbe;
      for (let x = -zelle / 2; x < B + zelle; x += zelle) {
        for (let y = -zelle / 2; y < H + zelle; y += zelle) {
          if (r() < 0.45) continue;
          const cx = x + r() * zelle, cy = y + r() * zelle, g = zelle * (0.4 + r() * 0.5);
          ctx.beginPath();
          const n = 7;
          for (let i = 0; i < n; i++) {
            const w = (i / n) * Math.PI * 2;
            const d = g * (0.65 + r() * 0.55);
            if (i) ctx.lineTo(cx + Math.cos(w) * d * 1.3, cy + Math.sin(w) * d);
            else ctx.moveTo(cx + Math.cos(w) * d * 1.3, cy + Math.sin(w) * d);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    };
    fleck(m.farbe);
    fleck(abdunkeln(m.farbe, 0.55));
  },

  geometrie(ctx, zone, B, H, s, m) {
    const f = 0.36 * s;
    const dunkel = abdunkeln(m.farbe, 0.6);
    for (let i = 0; i * f < B; i++) {
      for (let k = 0; k * f < H; k++) {
        const x = i * f, y = k * f, art = (i * 7 + k * 13) % 5;
        if (art === 4) continue;
        ctx.fillStyle = art % 2 ? m.farbe : dunkel;
        ctx.beginPath();
        if (art === 0) { ctx.moveTo(x, y); ctx.lineTo(x + f, y); ctx.lineTo(x, y + f); }
        else if (art === 1) { ctx.moveTo(x + f, y); ctx.lineTo(x + f, y + f); ctx.lineTo(x, y + f); }
        else if (art === 2) { ctx.moveTo(x, y); ctx.lineTo(x + f, y + f); ctx.lineTo(x, y + f); }
        else { ctx.moveTo(x, y); ctx.lineTo(x + f, y); ctx.lineTo(x + f, y + f); }
        ctx.closePath();
        ctx.fill();
      }
    }
  },

  retro(ctx, zone, B, H, s) {
    const dicke = [0.07, 0.045, 0.028].map((d) => d * s);
    if (istSeite(zone)) {
      let y = H * 0.56;
      for (const d of dicke) {
        ctx.fillRect(0, y, B * 0.62, d);
        // Knick zum Heck hin
        ctx.beginPath();
        ctx.moveTo(B * 0.62, y);
        ctx.lineTo(B * 0.74, y - 0.14 * s);
        ctx.lineTo(B, y - 0.14 * s);
        ctx.lineTo(B, y - 0.14 * s + d);
        ctx.lineTo(B * 0.74, y - 0.14 * s + d);
        ctx.lineTo(B * 0.62, y + d);
        ctx.closePath();
        ctx.fill();
        y += d + 0.04 * s;
      }
    } else if (zone === 'haube' || zone === 'dach' || zone === 'heck') {
      for (const seite of [0, 1]) {
        let x = B * 0.2;
        for (const d of dicke) {
          ctx.fillRect(seite ? B - x - d : x, 0, d, H);
          x += d + 0.04 * s;
        }
      }
    }
  },

  seitenblitz(ctx, zone, B, H, s) {
    if (!istSeite(zone)) return;
    const o = H * SEITE_OBEN, u = H * SEITE_UNTEN, d = u - o;
    const z = (x, y) => [x * B, o + y * d];
    const pts = [z(0.02, 0.5), z(0.34, 0.24), z(0.42, 0.42), z(0.98, 0.1), z(0.6, 0.62), z(0.5, 0.48), z(0.22, 0.74)];
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const yy = o + d / 2 + (y - o - d / 2) * s;
      if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
    });
    ctx.closePath();
    ctx.fill();
  },

  punkte(ctx, zone, B, H, s) {
    const f = 0.16 * s;
    let zeile = 0;
    ctx.beginPath();
    for (let y = 0; y < H + f; y += f * 0.87, zeile++) {
      for (let x = zeile % 2 ? f / 2 : 0; x < B + f; x += f) {
        const r = f * 0.3;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  },

  kacheln(ctx, zone, B, H, s) {
    const f = 0.28 * s, luecke = 0.035 * s;
    for (let i = 0; i * f < B; i++) {
      for (let k = 0; k * f < H; k++) {
        if ((i + k) % 2) ctx.fillRect(i * f + luecke / 2, k * f + luecke / 2, f - luecke, f - luecke);
      }
    }
  },

  verlauf(ctx, zone, B, H, s, m) {
    let g;
    const farbe = (a) => {
      const n = parseInt(m.farbe.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };
    if (istSeite(zone)) {
      g = ctx.createLinearGradient(0, H * SEITE_UNTEN, 0, H * (SEITE_UNTEN - (SEITE_UNTEN - SEITE_OBEN) * Math.min(1.4, s)));
      g.addColorStop(0, farbe(1));
      g.addColorStop(1, farbe(0));
    } else if (zone === 'haube') {
      g = ctx.createLinearGradient(0, 0, 0, H * Math.min(1.4, s));
      g.addColorStop(0, farbe(1));
      g.addColorStop(1, farbe(0));
    } else if (zone === 'front') {
      ctx.fillStyle = farbe(1);
      ctx.fillRect(0, 0, B, H);
      return;
    } else if (zone === 'heck') {
      g = ctx.createLinearGradient(0, H, 0, H - H * 0.6 * Math.min(1.4, s));
      g.addColorStop(0, farbe(1));
      g.addColorStop(1, farbe(0));
    } else {
      return;
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, B, H);
  }
};

/** Bekannte Muster-IDs (zur Prüfung, dass der Katalog in shared/teile.js vollständig bemalt ist). */
export const MUSTER_MALER = Object.keys(MALER);

/**
 * Zeichnet ein Muster in eine Zone.
 * @param {CanvasRenderingContext2D} ctx mit Ursprung in der oberen linken Zonenecke
 * @param {{id:string, farbe:string, deckkraft:number, skala:number}} muster
 * @param {string} zone
 * @param {number} b Zonenbreite in Pixeln
 * @param {number} h Zonenhöhe in Pixeln
 * @param {{b:number, h:number}} masse Zonengröße in Metern
 */
export function zeichneMuster(ctx, muster, zone, b, h, masse) {
  const maler = MALER[muster.id];
  if (!maler) return;
  ctx.save();
  ctx.scale(b / masse.b, h / masse.h);
  // Rechte Seite läuft im Atlas von hinten nach vorne: spiegeln, damit x überall von vorne beginnt
  if (zone === 'seiteR') {
    ctx.translate(masse.b, 0);
    ctx.scale(-1, 1);
  }
  ctx.globalAlpha = muster.deckkraft;
  ctx.fillStyle = muster.farbe;
  maler(ctx, zone, masse.b, masse.h, muster.skala, muster);
  ctx.restore();
}
