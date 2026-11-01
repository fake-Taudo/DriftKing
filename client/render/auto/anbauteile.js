// Parametrische Anbauteile (Bodykit, Spoiler, Spiegel, Auspuff, Neon). Jedes Teil wird aus den
// Anker-Punkten und Maßen der Karosserie erzeugt und passt so an jedes der 6 Autos.
// Alle Teile eines Autos werden zu einer Geometrie mit Vertex-Farben zusammengefügt (1 Draw Call).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowTextur } from '../texturen.js';

const DUNKEL = '#16171c';
const METALL = '#b9bcc4';

/** Sammelt farbige Teilgeometrien. */
class TeileSammler {
  constructor() {
    this.teile = [];
  }
  _farbe(g, farbe) {
    const ni = g.index ? g.toNonIndexed() : g;
    if (ni !== g) g.dispose();
    const c = new THREE.Color(farbe);
    const n = ni.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    const k = new THREE.BufferGeometry();
    k.setAttribute('position', ni.attributes.position);
    if (!ni.attributes.normal) ni.computeVertexNormals();
    k.setAttribute('normal', ni.attributes.normal);
    k.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.teile.push(k);
  }
  /** Quader mit Mitte (x,y,z), Maßen (b,h,t), Drehung (rx,ry,rz). */
  quader(farbe, x, y, z, b, h, t, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(b, h, t);
    g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
    g.translate(x, y, z);
    this._farbe(g, farbe);
  }
  /** Zylinder entlang der Z-Achse (Rohre). */
  rohr(farbe, x, y, z, r, laenge, seg = 10, offen = false) {
    const g = new THREE.CylinderGeometry(r, r, laenge, seg, 1, offen);
    g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    this._farbe(g, farbe);
  }
  /** Profil (2D-Form in der x/y-Ebene) entlang z extrudiert. */
  profil(farbe, punkte, tiefe, x, y, z, ry = 0) {
    const form = new THREE.Shape(punkte.map(([a, b]) => new THREE.Vector2(a, b)));
    const g = new THREE.ExtrudeGeometry(form, { depth: tiefe, bevelEnabled: false });
    g.translate(0, 0, -tiefe / 2);
    g.rotateY(ry);
    g.translate(x, y, z);
    this._farbe(g, farbe);
  }
  /** Kotflügelbogen (Torus-Ausschnitt) an einem Rad. */
  bogen(farbe, x, y, z, radius, dicke, breite, seite) {
    const g = new THREE.TorusGeometry(radius, dicke, 4, 10, Math.PI);
    g.scale(1, 1, breite / dicke);
    g.rotateY(Math.PI / 2);
    g.translate(x + seite * breite * 0.3, y, z);
    this._farbe(g, farbe);
  }
  geometrie() {
    if (!this.teile.length) return null;
    const g = mergeGeometries(this.teile);
    for (const t of this.teile) t.dispose();
    return g;
  }
}

/**
 * Baut alle Anbauteile für ein Automodell.
 * @param {import('./autoModell.js').AutoModell} modell
 * @param {object} look
 * @returns {THREE.Group}
 */
export function baueAnbauteile(modell, look) {
  const gruppe = new THREE.Group();
  if (!look || !look.teile) return gruppe;
  const a = modell.anker;
  const m = modell.k.masse;
  const f = modell.form;
  const W = m.W;
  const t = look.teile;
  const farbe1 = look.lack.farbe1;
  const teilFarbe = (slot) => (t[slot].variante > 0 ? t[slot].farbe : farbe1);
  const S = new TeileSammler();

  // --- Frontstoßstange ---
  {
    const v = t.frontstoss.variante, c = teilFarbe('frontstoss');
    const fs = a.frontStoss;
    const b = fs.breite * 0.94;
    if (v === 1) {
      S.quader(c, 0, fs.y - 0.02, fs.z - 0.02, b, 0.035, 0.16, -0.1);
    } else if (v === 2) {
      S.quader(DUNKEL, 0, fs.y - 0.04, fs.z + 0.02, b * 1.04, 0.025, 0.24);
      for (const s of [1, -1]) S.quader(c, s * b * 0.47, fs.y + 0.07, fs.z - 0.02, 0.04, 0.12, 0.2, 0, 0, s * 0.3);
    } else if (v === 3) {
      S.quader(c, 0, fs.y + 0.05, fs.z + 0.03, b * 1.02, 0.18, 0.12);
      for (const s of [1, -1]) {
        S.quader(DUNKEL, s * b * 0.3, fs.y + 0.06, fs.z + 0.095, b * 0.22, 0.09, 0.01);
        S.quader(c, s * b * 0.5, fs.y + 0.17, fs.z, 0.16, 0.02, 0.12, 0, 0, s * -0.25);
      }
      S.quader(DUNKEL, 0, fs.y - 0.04, fs.z + 0.04, b * 1.05, 0.02, 0.22);
    }
  }

  // --- Heck / Diffusor ---
  {
    const v = t.heckstoss.variante, c = teilFarbe('heckstoss');
    const h = a.heck;
    const b = h.breite * 0.9;
    if (v >= 1) {
      const tief = v === 1 ? 0.18 : 0.28;
      S.quader(DUNKEL, 0, h.y - 0.02, h.z + 0.02, b * (v === 3 ? 1.1 : 0.8), 0.03, tief);
      const n = v === 1 ? 4 : 6;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - 0.5) * b * 0.7;
        S.quader(DUNKEL, x, h.y + 0.03, h.z - tief * 0.2, 0.02, 0.1, tief * 0.9);
      }
    }
    if (v === 2) S.quader(c, 0, h.y + 0.12, h.z - 0.04, b, 0.12, 0.1);
    if (v === 3) {
      for (const s of [1, -1]) S.quader(c, s * (b * 0.5 + 0.06), h.y + 0.1, h.z + 0.25, 0.14, 0.2, 0.5);
    }
  }

  // --- Seitenschweller ---
  {
    const v = t.schweller.variante, c = teilFarbe('schweller');
    const sw = a.schweller;
    const laenge = sw.zVorne - sw.zHinten;
    const zMitte = (sw.zVorne + sw.zHinten) / 2;
    if (v >= 1) {
      const dicke = [0, 0.05, 0.07, 0.12][v];
      const hoehe = [0, 0.08, 0.1, 0.13][v];
      for (const s of [1, -1]) {
        S.quader(c, s * (W * 0.96 + dicke / 2), sw.y + hoehe / 2 - 0.02, zMitte, dicke, hoehe, laenge * 0.98);
        if (v >= 2) S.quader(DUNKEL, s * (W * 0.96 + dicke), sw.y - 0.01, zMitte, 0.03, 0.02, laenge * 0.9);
      }
    }
  }

  // --- Kotflügelverbreiterung ---
  {
    const v = t.verbreiterung.variante, c = teilFarbe('verbreiterung');
    if (v >= 1) {
      const breite = [0, 0.04, 0.06, 0.1][v];
      for (const r of a.radhaeuser) {
        const s = Math.sign(r.x);
        S.bogen(c, s * (W * 0.98), r.y, r.z, m.radBogen + 0.02, 0.035, breite, s);
        if (v === 2) {
          for (let i = 0; i < 7; i++) {
            const w = (i / 6) * Math.PI;
            S.quader(METALL, s * (W * 0.98 + breite * 0.8), r.y + Math.sin(w) * (m.radBogen + 0.02), r.z + Math.cos(w) * (m.radBogen + 0.02), 0.012, 0.018, 0.018);
          }
        }
      }
    }
  }

  // --- Motorhaube ---
  {
    const v = t.haube.variante;
    const hb = a.haube;
    const c = t.haube.variante > 0 ? t.haube.farbe : look.lack.zweitHaube ? look.lack.farbe2 : farbe1;
    if (v === 1) {
      S.profil(c, [[-0.22, 0], [0.22, 0], [0.16, 0.09], [-0.16, 0.09]], hb.laenge * 0.45, 0, hb.y - 0.01, hb.z - hb.laenge * 0.05);
      S.quader(DUNKEL, 0, hb.y + 0.045, hb.z + hb.laenge * 0.18, 0.3, 0.06, 0.012);
    } else if (v === 2) {
      S.quader('#1c1d22', 0, hb.y + 0.006, hb.z, hb.breite * 0.8, 0.012, hb.laenge * 0.85, -hb.neigung);
    } else if (v === 3) {
      for (const s of [1, -1]) {
        for (let i = 0; i < 4; i++) S.quader(DUNKEL, s * hb.breite * 0.22, hb.y + 0.008, hb.z - hb.laenge * 0.1 + i * 0.07, hb.breite * 0.18, 0.012, 0.035, -hb.neigung);
      }
    }
  }

  // --- Dach ---
  {
    const v = t.dach.variante, c = teilFarbe('dach');
    const d = a.dach;
    if (v === 1) {
      S.quader(c, 0, d.y + 0.015, d.z - d.laenge * 0.5 - 0.04, d.breite * 0.95, 0.025, 0.18, 0.15);
    } else if (v === 2) {
      for (const s of [1, -1]) S.quader(DUNKEL, s * d.breite * 0.42, d.y + 0.04, d.z, 0.04, 0.04, d.laenge * 0.95);
      for (const z of [-0.3, 0, 0.3]) S.quader(METALL, 0, d.y + 0.065, d.z + z * d.laenge, d.breite * 0.9, 0.025, 0.04);
    } else if (v === 3) {
      S.profil(c, [[-0.18, 0], [0.18, 0], [0.13, 0.1], [-0.13, 0.1]], d.laenge * 0.35, 0, d.y - 0.005, d.z + d.laenge * 0.1);
      S.quader(DUNKEL, 0, d.y + 0.05, d.z + d.laenge * 0.28, 0.24, 0.07, 0.012);
    }
  }

  // --- Spiegel ---
  {
    const v = t.spiegel.variante;
    const sp = a.spiegel;
    const c = look.lack.zweitSpiegel ? look.lack.farbe2 : t.spiegel.variante > 0 ? t.spiegel.farbe : farbe1;
    for (const s of [1, -1]) {
      const x = s * sp.x;
      if (v === 0) {
        S.quader(DUNKEL, x - s * 0.03, sp.y - 0.03, sp.z, 0.06, 0.03, 0.05);
        S.quader(c, x + s * 0.04, sp.y, sp.z - 0.02, 0.12, 0.08, 0.07);
      } else if (v === 1) {
        S.quader(DUNKEL, x, sp.y - 0.02, sp.z, 0.1, 0.015, 0.03);
        S.quader(c, x + s * 0.06, sp.y + 0.01, sp.z - 0.02, 0.1, 0.05, 0.06);
      } else if (v === 2) {
        S.quader(c, x + s * 0.03, sp.y - 0.01, sp.z, 0.1, 0.012, 0.08, 0, 0, s * 0.2);
        S.quader(c, x + s * 0.08, sp.y + 0.01, sp.z - 0.02, 0.1, 0.06, 0.05, 0, s * 0.2, 0);
      } else {
        // Retro: runde Spiegel weit vorne auf dem Kotflügel
        const z = a.haube.z + a.haube.laenge * 0.25;
        const y = a.haube.y + 0.02;
        const xr = s * W * 0.8;
        S.quader(METALL, xr, y + 0.06, z, 0.015, 0.12, 0.015);
        const g = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12);
        g.rotateX(Math.PI / 2);
        g.translate(xr, y + 0.13, z);
        S._farbe(g, c);
      }
    }
  }

  // --- Auspuff ---
  {
    const v = t.auspuff.variante;
    const au = a.auspuff;
    const gr = t.auspuff.groesse;
    const c = v > 0 ? t.auspuff.farbe : METALL;
    if (v === 0) S.rohr(c, au.x, au.y, au.z - 0.03, 0.035 * gr, 0.16, 10, true);
    else if (v === 1) {
      S.rohr(c, au.x - 0.05, au.y, au.z - 0.03, 0.035 * gr, 0.18, 10, true);
      S.rohr(c, au.x + 0.05, au.y, au.z - 0.03, 0.035 * gr, 0.18, 10, true);
    } else if (v === 2) {
      S.rohr(c, au.x, au.y + 0.01, au.z - 0.04, 0.06 * gr, 0.2, 12, true);
      S.rohr(c, -au.x, au.y + 0.01, au.z - 0.04, 0.06 * gr, 0.2, 12, true);
    } else {
      // Seitenausgang vor dem Hinterrad (rechts)
      const zr = a.radhaeuser[2].z + m.radBogen + 0.12;
      const g = new THREE.CylinderGeometry(0.04 * gr, 0.04 * gr, 0.2, 10, 1, true);
      g.rotateZ(Math.PI / 2);
      g.translate(-W * 0.98, f.bodenHoehe + 0.06, zr);
      S._farbe(g, c);
    }
  }
  modell.auspuffPositionen = (() => {
    const v = t.auspuff.variante;
    const au = a.auspuff;
    if (v === 1) return [[au.x - 0.05, au.y, au.z - 0.1], [au.x + 0.05, au.y, au.z - 0.1]];
    if (v === 2) return [[au.x, au.y, au.z - 0.12], [-au.x, au.y, au.z - 0.12]];
    if (v === 3) return [[-W * 1.08, f.bodenHoehe + 0.06, a.radhaeuser[2].z + m.radBogen + 0.12]];
    return [[au.x, au.y, au.z - 0.1]];
  })();

  // --- Spoiler ---
  {
    const v = t.spoiler.variante, c = teilFarbe('spoiler');
    const k = a.kofferraum;
    const b = k.breite;
    if (v === 1) {
      S.profil(c, [[0, 0], [0.16, 0], [0.18, 0.07]], b * 0.95, 0, k.y - 0.01, k.z - 0.02, Math.PI / 2);
    } else if (v === 2) {
      S.quader(c, 0, k.y + 0.015, k.z + 0.03, b * 0.9, 0.03, 0.12, -0.25);
    } else if (v === 3) {
      for (const s of [1, -1]) S.quader(DUNKEL, s * b * 0.32, k.y + 0.08, k.z + 0.05, 0.03, 0.16, 0.08);
      S.quader(c, 0, k.y + 0.17, k.z + 0.04, b * 0.92, 0.025, 0.2, 0.1);
    } else if (v === 4) {
      for (const s of [1, -1]) {
        S.quader(DUNKEL, s * b * 0.3, k.y + 0.17, k.z + 0.05, 0.03, 0.34, 0.1, -0.15);
        S.quader(c, s * b * 0.53, k.y + 0.32, k.z, 0.015, 0.16, 0.32);
      }
      S.quader(c, 0, k.y + 0.34, k.z, b * 1.05, 0.03, 0.3, 0.14);
    } else if (v === 5) {
      for (const s of [1, -1]) {
        S.quader(DUNKEL, s * b * 0.3, k.y + 0.17, k.z + 0.05, 0.03, 0.34, 0.1, -0.1);
        S.quader(c, s * b * 0.53, k.y + 0.33, k.z - 0.02, 0.015, 0.24, 0.36);
      }
      S.quader(c, 0, k.y + 0.3, k.z + 0.02, b * 1.05, 0.028, 0.26, 0.1);
      S.quader(c, 0, k.y + 0.42, k.z - 0.1, b * 1.05, 0.024, 0.18, 0.3);
    }
  }

  const geo = S.geometrie();
  if (geo) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.25, flatShading: true });
    const netz = new THREE.Mesh(geo, mat);
    netz.castShadow = true;
    gruppe.add(netz);
  }

  // --- Neon-Unterboden (additives Leuchten unter dem Auto) ---
  if (look.neon && look.neon.an) {
    const ng = new THREE.PlaneGeometry(W * 2.6, (m.zFront - m.zHeck) * 1.05);
    ng.rotateX(-Math.PI / 2);
    ng.translate(0, 0.08, (m.zFront + m.zHeck) / 2); // über der maximalen Tieferlegung (0,07 m)
    const nm = new THREE.MeshBasicMaterial({ map: glowTextur(), color: look.neon.farbe, transparent: true, opacity: look.neon.helligkeit * 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const neon = new THREE.Mesh(ng, nm);
    neon.renderOrder = 2;
    neon.userData.schattenAus = true;
    gruppe.add(neon);
    gruppe.userData.neon = neon;
  }
  return gruppe;
}
