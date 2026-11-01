// Räder: Reifen (Lathe-Profil mit Flanke und Profil), 12 parametrische Felgendesigns (Vertex-Farben
// für Felge, Zierring und Bolzen), Bremsscheibe und -sattel, Unschärfe-Scheibe bei hoher Drehzahl.
// Alle vier Räder eines Autos sind Instanzen (wenige Draw Calls).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ZOLL = 0.0254;

function faerben(geo, farbe) {
  const c = new THREE.Color(farbe);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function nichtIndiziert(g) {
  return g.index ? g.toNonIndexed() : g;
}

/** Speiche als Quader von Radius r1 bis r2 unter Winkel a (Felgenebene = YZ, Achse X). */
function speiche(r1, r2, a, breite, tiefe, xVersatz, drehung = 0) {
  const l = r2 - r1;
  const g = new THREE.BoxGeometry(tiefe, l, breite);
  g.translate(xVersatz, r1 + l / 2, 0);
  if (drehung) g.rotateY(drehung);
  g.rotateX(a);
  return g;
}

function ring(rAussen, rInnen, tiefe, x, segmente = 24) {
  const form = new THREE.Shape();
  form.absarc(0, 0, rAussen, 0, Math.PI * 2, false);
  const loch = new THREE.Path();
  loch.absarc(0, 0, rInnen, 0, Math.PI * 2, true);
  form.holes.push(loch);
  const g = new THREE.ExtrudeGeometry(form, { depth: tiefe, bevelEnabled: false, curveSegments: segmente });
  g.rotateY(Math.PI / 2);
  g.translate(x - tiefe, 0, 0);
  return g;
}

function scheibe(r, tiefe, x, segmente = 24) {
  const g = new THREE.CylinderGeometry(r, r, tiefe, segmente);
  g.rotateZ(Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

/**
 * Felgengeometrie (Vorderseite zeigt nach +X). Farben werden als Vertex-Farben eingebrannt.
 * @param {string} design
 * @param {number} rFelge Felgenradius (m)
 * @param {number} tiefe Felgenbreite (m)
 * @param {{farbe:string, zierring:string, bolzen:string}} farben
 */
export function felgenGeometrie(design, rFelge, tiefe, farben) {
  const teile = [];
  const F = (g) => teile.push(faerben(nichtIndiziert(g), farben.farbe));
  const Z = (g) => teile.push(faerben(nichtIndiziert(g), farben.zierring));
  const B = (g) => teile.push(faerben(nichtIndiziert(g), farben.bolzen));
  const dunkel = (g) => teile.push(faerben(nichtIndiziert(g), '#1a1b20'));
  const front = 0.0; // Felgen-Frontebene bei x = 0
  const r = rFelge;
  // Felgenbett (innen) und Zierring (Lippe)
  const bett = new THREE.CylinderGeometry(r * 0.98, r * 0.98, tiefe * 0.9, 20, 1, true);
  bett.rotateZ(Math.PI / 2);
  bett.translate(-tiefe * 0.45, 0, 0);
  dunkel(bett);
  const lippe = design === 'tiefbett' ? 0.16 : design === 'stahl' ? 0.04 : 0.07;
  Z(ring(r, r * (1 - lippe), 0.025, front + 0.012));
  // Nabe + Bolzen
  const nabeR = r * 0.2;
  F(scheibe(nabeR, 0.04, front - 0.005, 12));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const b = scheibe(0.011, 0.025, front + 0.018, 6);
    b.translate(0, Math.cos(a) * nabeR * 0.62, Math.sin(a) * nabeR * 0.62);
    B(b);
  }
  B(scheibe(nabeR * 0.35, 0.03, front + 0.02, 8));
  const rInnen = r * (1 - lippe);
  const sp = (n, breite, tiefeS = 0.03, x = front - 0.01, versatz = 0, dreh = 0) => {
    for (let i = 0; i < n; i++) F(speiche(nabeR * 0.8, rInnen, (i / n) * Math.PI * 2 + versatz, breite, tiefeS, x, dreh));
  };
  switch (design) {
    case 'fuenfspeichen':
      sp(5, r * 0.22, 0.035);
      break;
    case 'stahl': {
      F(ring(rInnen, nabeR, 0.03, front - 0.005));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const l = scheibe(r * 0.11, 0.032, front - 0.001, 8);
        l.translate(0, Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58);
        dunkel(l);
      }
      break;
    }
    case 'mehrspeichen':
      sp(10, r * 0.09, 0.03);
      break;
    case 'kreuzspeichen':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        F(speiche(nabeR * 0.8, rInnen, a, r * 0.07, 0.03, front - 0.01, 0.35));
        F(speiche(nabeR * 0.8, rInnen, a + 0.3, r * 0.07, 0.03, front - 0.01, -0.35));
      }
      break;
    case 'wabe': {
      F(ring(rInnen, nabeR, 0.025, front - 0.012));
      const sechseck = new THREE.CylinderGeometry(r * 0.13, r * 0.13, 0.03, 6);
      sechseck.rotateZ(Math.PI / 2);
      for (let k = 0; k < 2; k++) {
        const n = k === 0 ? 6 : 12;
        const rr = k === 0 ? r * 0.42 : r * 0.7;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + (k ? 0.26 : 0);
          const h = sechseck.clone();
          h.scale(1, k ? 0.62 : 0.85, k ? 0.62 : 0.85);
          h.translate(front + 0.001, Math.cos(a) * rr, Math.sin(a) * rr);
          dunkel(h);
        }
      }
      break;
    }
    case 'scheibe':
      F(ring(rInnen, nabeR, 0.03, front - 0.004, 32));
      Z(ring(r * 0.62, r * 0.56, 0.032, front - 0.002, 32));
      break;
    case 'turbine':
      for (let i = 0; i < 14; i++) F(speiche(nabeR * 0.9, rInnen, (i / 14) * Math.PI * 2, r * 0.09, 0.025, front - 0.008, 0.6));
      Z(ring(nabeR * 1.4, nabeR, 0.03, front - 0.002));
      break;
    case 'stern':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const form = new THREE.Shape();
        form.moveTo(-r * 0.16, nabeR * 0.8);
        form.lineTo(r * 0.16, nabeR * 0.8);
        form.lineTo(r * 0.04, rInnen);
        form.lineTo(-r * 0.04, rInnen);
        form.closePath();
        const g = new THREE.ExtrudeGeometry(form, { depth: 0.035, bevelEnabled: false });
        g.rotateY(Math.PI / 2);
        g.translate(front - 0.03, 0, 0);
        g.rotateX(a);
        F(g);
      }
      break;
    case 'tiefbett':
      sp(8, r * 0.1, 0.03, front - 0.05);
      break;
    case 'y_speichen':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        F(speiche(nabeR * 0.8, r * 0.55, a, r * 0.13, 0.035, front - 0.01));
        F(speiche(r * 0.5, rInnen, a + 0.17, r * 0.07, 0.03, front - 0.01));
        F(speiche(r * 0.5, rInnen, a - 0.17, r * 0.07, 0.03, front - 0.01));
      }
      break;
    case 'netz':
      sp(10, r * 0.05, 0.025, front - 0.01);
      sp(10, r * 0.05, 0.025, front - 0.01, Math.PI / 10);
      F(ring(r * 0.55, r * 0.5, 0.028, front - 0.008));
      break;
    case 'dreispeichen':
      sp(3, r * 0.34, 0.04);
      break;
    default:
      sp(5, r * 0.22, 0.035);
  }
  const g = mergeGeometries(teile.map((t) => {
    // Nur Position, Normale und Farbe behalten (einheitliche Attribute für das Zusammenfügen)
    const k = new THREE.BufferGeometry();
    k.setAttribute('position', t.attributes.position);
    if (!t.attributes.normal) t.computeVertexNormals();
    k.setAttribute('normal', t.attributes.normal);
    k.setAttribute('color', t.attributes.color);
    return k;
  }));
  for (const t of teile) t.dispose();
  return g;
}

/** Reifen als Rotationskörper (Achse X), mit Profilrillen je nach „profil“ (0–3). */
export function reifenGeometrie(rAussen, rFelge, breite, profil) {
  const h = breite / 2;
  const punkte = [
    [rFelge, -h], [rAussen - 0.03, -h], [rAussen - 0.005, -h + 0.025], [rAussen, -h + 0.05],
    [rAussen, h - 0.05], [rAussen - 0.005, h - 0.025], [rAussen - 0.03, h], [rFelge, h]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(punkte, 28 + profil * 4);
  g.rotateZ(Math.PI / 2);
  return g;
}

/** Textur für die Unschärfe-Scheibe (schnell drehendes Rad). */
function blurTextur(farbe) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  const f = new THREE.Color(farbe);
  const rgb = `${Math.round(f.r * 255)},${Math.round(f.g * 255)},${Math.round(f.b * 255)}`;
  grad.addColorStop(0, `rgba(${rgb},0.95)`);
  grad.addColorStop(0.25, `rgba(${rgb},0.75)`);
  grad.addColorStop(0.8, `rgba(${rgb},0.55)`);
  grad.addColorStop(0.93, `rgba(${rgb},0.85)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 63, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BLUR_AB = 32; // rad/s: ab dieser Raddrehzahl wird die Unschärfe-Scheibe gezeigt

export class Raeder {
  /**
   * @param {object} p Fahrzeugparameter
   * @param {object} anker Anker der Karosserie (radhaeuser)
   * @param {object} look
   */
  constructor(p, anker, look) {
    this.p = p;
    this.anker = anker;
    this.objekt = new THREE.Group();
    this.matrix = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._pos = new THREE.Vector3();
    this._skal = new THREE.Vector3();
    this.reifenMat = new THREE.MeshStandardMaterial({ color: '#1b1b1f', roughness: 0.92, metalness: 0, flatShading: true, side: THREE.DoubleSide });
    this.felgeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.75, side: THREE.DoubleSide });
    this.scheibeMat = new THREE.MeshStandardMaterial({ color: '#7d8088', roughness: 0.45, metalness: 0.8, side: THREE.DoubleSide });
    this.sattelMat = new THREE.MeshStandardMaterial({ color: '#9a1d1d', roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide });
    this.blurMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.netze = [];
    this.setzeLook(look);
  }

  /** (Neu-)Aufbau aus dem Look (Felgendesign, Größe, Breite, Farben, Fahrwerk). */
  setzeLook(look) {
    for (const n of this.netze) {
      this.objekt.remove(n);
      n.geometry.dispose();
      n.dispose?.();
    }
    this.netze = [];
    this.look = look;
    const fe = look.felgen;
    const R = this.p.radRadius;
    const rFelge = Math.min(R - 0.035, (fe.groesse * ZOLL) / 2 + 0.012);
    const breite = fe.breite * ZOLL + 0.04;
    this.breite = breite;
    this.reifenMat.color.set('#1b1b1f');
    const reifenGeo = reifenGeometrie(R, rFelge, breite, fe.profil);
    // Flanken-Linie als zusätzlicher Ring
    let linieGeo = null;
    if (fe.flankeLinie) {
      linieGeo = ring(rFelge + (R - rFelge) * 0.6, rFelge + (R - rFelge) * 0.5, 0.004, breite / 2 + 0.002, 28);
    }
    const felgeGeo = felgenGeometrie(fe.design, rFelge, breite * 0.9, fe);
    felgeGeo.translate(breite / 2 - 0.02, 0, 0);
    const scheibeGeo = scheibe(rFelge * 0.78, 0.03, breite * 0.05, 20);
    const sattelGeo = new THREE.BoxGeometry(0.06, rFelge * 0.5, rFelge * 0.35);
    sattelGeo.translate(breite * 0.12, rFelge * 0.55, -rFelge * 0.15);
    const blurGeo = new THREE.CircleGeometry(rFelge * 0.99, 24);
    blurGeo.rotateY(Math.PI / 2);
    blurGeo.translate(breite / 2 + 0.014, 0, 0);
    this.blurMat.map?.dispose();
    this.blurMat.map = blurTextur(fe.farbe);
    this.blurMat.needsUpdate = true;
    this.sattelMat.color.set(fe.sattel);
    const mk = (geo, mat, schatten) => {
      const m = new THREE.InstancedMesh(geo, mat, 4);
      m.castShadow = schatten;
      m.frustumCulled = false;
      this.objekt.add(m);
      this.netze.push(m);
      return m;
    };
    this.reifen = mk(reifenGeo, this.reifenMat, true);
    this.felge = mk(felgeGeo, this.felgeMat, false);
    this.scheibe = mk(scheibeGeo, this.scheibeMat, false);
    this.sattel = mk(sattelGeo, this.sattelMat, false);
    this.blur = mk(blurGeo, this.blurMat, false);
    if (linieGeo) {
      this.linieMat = this.linieMat || new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide });
      this.linieMat.color.set(fe.flanke);
      this.linie = mk(linieGeo, this.linieMat, false);
    } else {
      this.linie = null;
    }
    // Fahrwerk-Optik
    const fw = look.fahrwerk;
    this.sturzV = (fw.sturzV * Math.PI) / 180;
    this.sturzH = (fw.sturzH * Math.PI) / 180;
    this.spurZuschlag = fw.spur * 0.06;
    this.aktualisieren({ delta: 0, radWinkelV: 0, radWinkelH: 0, radGeschwV: 0, radGeschwH: 0 }, 0);
  }

  /** Pro Frame: Lenkeinschlag, Drehung, Unschärfe, Einfederung (feder: Array mit 4 Werten in m). */
  aktualisieren(z, _dt, feder = null) {
    const spur = this.p.spurweite / 2 + this.spurZuschlag;
    const R = this.p.radRadius;
    for (let i = 0; i < 4; i++) {
      const a = this.anker.radhaeuser[i];
      const links = i % 2 === 0;
      const vorne = a.vorne;
      const x = (links ? 1 : -1) * (spur - this.breite * 0.15);
      const y = R + (feder ? feder[i] : 0);
      const lenk = vorne ? z.delta : 0;
      const sturz = (vorne ? this.sturzV : this.sturzH) * (links ? -1 : 1);
      const dreh = vorne ? z.radWinkelV : z.radWinkelH;
      const geschw = Math.abs(vorne ? z.radGeschwV : z.radGeschwH);
      const unscharf = geschw > BLUR_AB;
      this._pos.set(x, y, a.z);
      // Gesamtrotation: Lenken (Y) · Sturz (Z) · Drehung (X)
      this._e.set(dreh, lenk, sturz, 'YZX');
      this._q.setFromEuler(this._e);
      this._skal.set(links ? 1 : -1, 1, 1);
      this.matrix.compose(this._pos, this._q, this._skal);
      this.reifen.setMatrixAt(i, this.matrix);
      if (this.linie) this.linie.setMatrixAt(i, this.matrix);
      this._skal.set(unscharf ? 0 : links ? 1 : -1, unscharf ? 0 : 1, unscharf ? 0 : 1);
      this.matrix.compose(this._pos, this._q, this._skal);
      this.felge.setMatrixAt(i, this.matrix);
      this.scheibe.setMatrixAt(i, this.matrix);
      // Sattel und Unschärfe drehen nicht mit
      this._e.set(0, lenk, sturz, 'YZX');
      this._q.setFromEuler(this._e);
      this._skal.set(links ? 1 : -1, 1, 1);
      this.matrix.compose(this._pos, this._q, this._skal);
      this.sattel.setMatrixAt(i, this.matrix);
      this._skal.set(unscharf ? (links ? 1 : -1) : 0, unscharf ? 1 : 0, unscharf ? 1 : 0);
      this.matrix.compose(this._pos, this._q, this._skal);
      this.blur.setMatrixAt(i, this.matrix);
    }
    for (const n of this.netze) n.instanceMatrix.needsUpdate = true;
  }

  freigeben() {
    for (const n of this.netze) {
      n.geometry.dispose();
      n.dispose?.();
    }
    for (const m of [this.reifenMat, this.felgeMat, this.scheibeMat, this.sattelMat, this.blurMat, this.linieMat]) {
      if (!m) continue;
      m.map?.dispose();
      m.dispose();
    }
  }
}

export { ring, scheibe };
