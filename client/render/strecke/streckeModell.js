// 3D-Darstellung einer Strecke aus den Laufzeit-Daten (shared/strecken/streckenBau.js):
// Fahrbahn, Randlinien, Curbs in Drift-Zonen, Wände je Art, Hindernisse, Startportal, Untergrund,
// Wasser und Deko. Statische Teile werden je Material zusammengefügt, Wiederholtes instanziert.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { betonTextur, asphaltTextur, curbTextur, warnstreifenTextur, glowTextur } from '../texturen.js';
import { baueDeko } from './deko.js';
import { Zufall } from '../../../shared/zufall.js';

const BODEN_FARBE = {
  beton: { strasse: '#9a9da3', umgebung: '#8a8d92', rauheit: 0.9 },
  asphalt: { strasse: '#4a4c53', umgebung: '#5d6b45', rauheit: 0.85 },
  nass: { strasse: '#2a2c34', umgebung: '#1d1f26', rauheit: 0.32 }
};

/** Band entlang einer Punktliste (links/rechts-Paare) → Geometrie mit UV (u quer, v längs). */
function band(links, rechts, hoehe, vSkala, geschlossen = true) {
  const n = links.length;
  const pos = [], uv = [], idx = [];
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const k = i % n;
    if (i > 0) {
      const a = links[(i - 1) % n], b = links[k];
      s += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    pos.push(links[k][0], hoehe, -links[k][1], rechts[k][0], hoehe, -rechts[k][1]);
    uv.push(0, s / vSkala, 1, s / vSkala);
    if (i < n || geschlossen) {
      if (i > 0) {
        const a = (i - 1) * 2, b = i * 2;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Linie entlang des Rands mit Versatz nach innen (für Randmarkierungen). */
function versatzLinie(S, seite, abstandVomRand, breite) {
  const L = [], R = [];
  for (let i = 0; i < S.anzahl; i++) {
    const p = S.proben[i];
    const hb = p.breite / 2 - abstandVomRand;
    const a = hb, b = hb - breite;
    const sx = seite * p.nx, sy = seite * p.ny;
    if (seite > 0) {
      L.push([p.x + sx * a, p.y + sy * a]);
      R.push([p.x + sx * b, p.y + sy * b]);
    } else {
      L.push([p.x + sx * b, p.y + sy * b]);
      R.push([p.x + sx * a, p.y + sy * a]);
    }
  }
  return [L, R];
}

export class StreckeModell {
  /**
   * @param {object} S Laufzeit-Strecke (baueStrecke)
   * @param {{deko: number}} qualitaet
   */
  constructor(S, qualitaet) {
    this.S = S;
    this.def = S.def;
    this.objekt = new THREE.Group();
    this.objekt.name = 'strecke-' + S.id;
    this.geometrien = [];
    this.materialien = [];
    this.nacht = this.def.tageszeit === 'Nacht';
    this._fahrbahn();
    this._markierungen();
    this._waende();
    this._hindernisse();
    this._start();
    this._untergrund();
    this.deko = baueDeko(S, qualitaet ? qualitaet.deko : 1, this);
    this.objekt.add(this.deko.objekt);
  }

  _mat(m) {
    this.materialien.push(m);
    return m;
  }
  _netz(geo, mat, { schatten = false, empfangen = true } = {}) {
    this.geometrien.push(geo);
    const n = new THREE.Mesh(geo, mat);
    n.receiveShadow = empfangen;
    n.castShadow = schatten;
    n.matrixAutoUpdate = false;
    n.updateMatrix();
    this.objekt.add(n);
    return n;
  }

  _fahrbahn() {
    const S = this.S;
    const b = this.def.boden;
    const f = BODEN_FARBE[b] || BODEN_FARBE.asphalt;
    const tex = (b === 'beton' ? betonTextur('#9a9da3') : asphaltTextur(b === 'nass' ? '#2c2e36' : '#45474e')).clone();
    tex.needsUpdate = true;
    tex.repeat.set(2, 1);
    this.materialien.push({ dispose: () => tex.dispose() });
    const mat = this._mat(new THREE.MeshStandardMaterial({ map: tex, roughness: f.rauheit, metalness: b === 'nass' ? 0.15 : 0, envMapIntensity: b === 'nass' ? 1.6 : 0.6 }));
    const geo = band(S.randL, S.randR, 0.0, 12);
    this.fahrbahnMat = mat;
    this._netz(geo, mat);
  }

  _markierungen() {
    const S = this.S;
    const geos = [];
    for (const seite of [1, -1]) {
      const [L, R] = versatzLinie(S, seite, 0.35, 0.2);
      geos.push(band(L, R, 0.012, 10));
    }
    const linienMat = this._mat(new THREE.MeshStandardMaterial({ color: this.nacht ? '#d7dcff' : '#f2f2ee', roughness: 0.6, emissive: this.nacht ? '#3a3f66' : '#000000' }));
    this._netz(mergeGeometries(geos), linienMat);
    for (const g of geos) g.dispose();

    // Curbs (rot-weiß) an beiden Rändern der Drift-Zonen
    const curbGeos = [];
    for (const z of S.zonen) {
      const idx = [];
      let i = z.von;
      while (true) {
        idx.push(i);
        if (i === z.bis) break;
        i = (i + 1) % S.anzahl;
      }
      for (const seite of [1, -1]) {
        const L = [], R = [];
        for (const k of idx) {
          const p = S.proben[k];
          const a = p.breite / 2 + 0.05, bb = p.breite / 2 - 1.1;
          const sx = seite * p.nx, sy = seite * p.ny;
          if (seite > 0) { L.push([p.x + sx * a, p.y + sy * a]); R.push([p.x + sx * bb, p.y + sy * bb]); }
          else { L.push([p.x + sx * bb, p.y + sy * bb]); R.push([p.x + sx * a, p.y + sy * a]); }
        }
        curbGeos.push(band(L, R, 0.018, 2.4, false));
      }
    }
    if (curbGeos.length) {
      const tex = curbTextur(this.nacht ? '#e8e8ff' : '#efefef', this.nacht ? '#ff2a8a' : '#d62a2a');
      const curbMat = this._mat(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: this.nacht ? '#40102a' : '#000000' }));
      // Textur entlang der Länge wiederholen (u quer, v längs → drehen)
      this._netz(mergeGeometries(curbGeos), curbMat);
      for (const g of curbGeos) g.dispose();
    }
  }

  _waende() {
    const S = this.S;
    const z = new Zufall('waende-' + S.id);
    const betonGeos = [], felsGeos = [], schieneGeos = [];
    const pfosten = [], container = [], reifen = [];
    for (const seite of ['L', 'R']) {
      for (const ab of S.wandAbschnitte[seite]) {
        const pts = ab.punkte;
        if (ab.art === 'beton') {
          betonGeos.push(this._wandBand(pts, 0.95, 0.55, seite));
        } else if (ab.art === 'fels') {
          felsGeos.push(this._felsWand(pts, seite, z));
        } else if (ab.art === 'leitplanke') {
          schieneGeos.push(this._wandBand(pts, 0.75, 0.1, seite, 0.45));
          for (const [x, y, w] of this._entlang(pts, 3.2)) pfosten.push([x, y, w]);
        } else if (ab.art === 'container') {
          for (const [x, y, w] of this._entlang(pts, 6.3)) container.push([x, y, w, z.ganz(0, 5), z.chance(0.35) ? 2 : 1]);
        } else if (ab.art === 'reifen') {
          for (const [x, y, w] of this._entlang(pts, 0.85)) reifen.push([x, y, w]);
        }
      }
    }
    if (betonGeos.length) {
      const tex = warnstreifenTextur(this.nacht ? '#ff2a8a' : '#f2c230', '#22232a');
      const m = this._mat(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide, emissive: this.nacht ? '#2a0a1c' : '#000000' }));
      this._netz(mergeGeometries(betonGeos), m);
    }
    if (felsGeos.length) {
      const m = this._mat(new THREE.MeshStandardMaterial({ color: this.def.id === 'kuestenpass' ? '#8a6448' : '#6b6560', roughness: 0.95, flatShading: true }));
      this._netz(mergeGeometries(felsGeos), m);
    }
    if (schieneGeos.length) {
      const m = this._mat(new THREE.MeshStandardMaterial({ color: '#c9ced8', roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide }));
      this._netz(mergeGeometries(schieneGeos), m);
    }
    for (const g of [...betonGeos, ...felsGeos, ...schieneGeos]) g.dispose();
    if (pfosten.length) {
      const geo = new THREE.BoxGeometry(0.12, 0.8, 0.12);
      geo.translate(0, 0.4, 0);
      this._instanzen(geo, new THREE.MeshStandardMaterial({ color: '#8d929c', roughness: 0.5, metalness: 0.6 }), pfosten);
    }
    if (container.length) this._containerReihe(container);
    if (reifen.length) {
      const geo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
      const stapel = [];
      for (const [x, y, w] of reifen) for (let k = 0; k < 3; k++) stapel.push([x, y, w, k * 0.28 + 0.14]);
      this._instanzen(geo, new THREE.MeshStandardMaterial({ color: '#1d1e22', roughness: 0.9 }), stapel, true);
    }
  }

  /** Punkte im Abstand d entlang einer Polylinie mit Richtung. */
  _entlang(pts, d) {
    const aus = [];
    let rest = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const l = Math.hypot(bx - ax, by - ay);
      const w = Math.atan2(by - ay, bx - ax);
      let t = rest;
      while (t < l) {
        aus.push([ax + ((bx - ax) * t) / l, ay + ((by - ay) * t) / l, w]);
        t += d;
      }
      rest = t - l;
    }
    return aus;
  }

  /** Senkrechtes Wandband (Höhe h, Dicke d) entlang der Polylinie. */
  _wandBand(pts, h, d, seite, y0 = 0) {
    const pos = [], uv = [];
    let s = 0;
    const versatz = seite === 'L' ? 1 : -1;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const l = Math.hypot(bx - ax, by - ay) || 1;
      const nx = (-(by - ay) / l) * versatz * d * 0.5, ny = ((bx - ax) / l) * versatz * d * 0.5;
      const s2 = s + l;
      // Innenseite (zur Fahrbahn), Oberseite
      const quads = [
        [[ax - nx, y0, ay - ny], [bx - nx, y0, by - ny], [bx - nx, y0 + h, by - ny], [ax - nx, y0 + h, ay - ny]],
        [[ax - nx, y0 + h, ay - ny], [bx - nx, y0 + h, by - ny], [bx + nx, y0 + h, by + ny], [ax + nx, y0 + h, ay + ny]],
        [[ax + nx, y0 + h, ay + ny], [bx + nx, y0 + h, by + ny], [bx + nx, y0, by + ny], [ax + nx, y0, ay + ny]]
      ];
      for (const q of quads) {
        const [p1, p2, p3, p4] = q.map(([x, y, zz]) => [x, y, -zz]);
        pos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
        uv.push(s / 3, 0, s2 / 3, 0, s2 / 3, 1, s / 3, 0, s2 / 3, 1, s / 3, 1);
      }
      s = s2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }

  /** Zerklüftete Felswand (Höhe variiert). */
  _felsWand(pts, seite, z) {
    const pos = [];
    const versatz = seite === 'L' ? 1 : -1;
    let hVor = 4 + z.naechste() * 4;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const l = Math.hypot(bx - ax, by - ay) || 1;
      const nx = (-(by - ay) / l) * versatz, ny = ((bx - ax) / l) * versatz;
      const hNeu = 3.5 + z.naechste() * 6;
      const t = 2.5 + z.naechste() * 2;
      const a0 = [ax, 0, -ay], b0 = [bx, 0, -by];
      const a1 = [ax + nx * 0.8, hVor, -(ay + ny * 0.8)], b1 = [bx + nx * 0.8, hNeu, -(by + ny * 0.8)];
      const a2 = [ax + nx * t, hVor * 1.1, -(ay + ny * t)], b2 = [bx + nx * t, hNeu * 1.1, -(by + ny * t)];
      for (const [p1, p2, p3, p4] of [[a0, b0, b1, a1], [a1, b1, b2, a2]]) {
        pos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
        pos.push(...p1, ...p3, ...p2, ...p1, ...p4, ...p3);
      }
      hVor = hNeu;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.computeVertexNormals();
    return g;
  }

  _instanzen(geo, mat, liste, mitHoehe = false) {
    this.geometrien.push(geo);
    this._mat(mat);
    const m = new THREE.InstancedMesh(geo, mat, liste.length);
    const mx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    liste.forEach(([x, y, w, h], i) => {
      e.set(0, w, 0);
      q.setFromEuler(e);
      p.set(x, mitHoehe ? h : 0, -y);
      mx.compose(p, q, s);
      m.setMatrixAt(i, mx);
    });
    m.receiveShadow = true;
    m.computeBoundingSphere();
    this.objekt.add(m);
    return m;
  }

  /** Container-Reihe (Wand oder Hindernis), Farben per Instanz. */
  _containerReihe(liste) {
    const FARBEN = ['#2f7fd1', '#d14b2f', '#2fa36b', '#d1a52f', '#7a3fd1', '#3fb7c9'];
    const geo = new THREE.BoxGeometry(6.0, 2.55, 2.4);
    geo.translate(0, 1.275, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.3, flatShading: true });
    const anzahl = liste.reduce((a, c) => a + (c[4] || 1), 0);
    this.geometrien.push(geo);
    this._mat(mat);
    const m = new THREE.InstancedMesh(geo, mat, anzahl);
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const c = new THREE.Color();
    let i = 0;
    for (const [x, y, w, f, stapel = 1] of liste) {
      for (let k = 0; k < stapel; k++) {
        e.set(0, w + (k ? 0.04 : 0), 0);
        q.setFromEuler(e);
        p.set(x, k * 2.6, -y);
        mx.compose(p, q, s);
        m.setMatrixAt(i, mx);
        m.setColorAt(i, c.set(FARBEN[(f + k * 2) % FARBEN.length]));
        i++;
      }
    }
    m.receiveShadow = true;
    m.computeBoundingSphere();
    this.objekt.add(m);
  }

  _hindernisse() {
    const H = this.S.hindernisse;
    const reifen = [], pylonen = [], container = [], bloecke = [];
    for (const k of H.kreise) {
      if (k.art === 'pylon') pylonen.push(k);
      else reifen.push(k);
    }
    for (const r of H.rechtecke) {
      if (r.art === 'container') container.push([r.x, r.y, -r.winkel, 0, 1]);
      else bloecke.push(r);
    }
    if (reifen.length) {
      // Reifenstapel: mehrere Ringe von Reifen um den Mittelpunkt
      const geo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10);
      const liste = [];
      for (const k of reifen) {
        const n = Math.max(6, Math.round((k.r * Math.PI * 2) / 0.78));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          for (let h = 0; h < 4; h++) liste.push([k.x + Math.cos(a) * (k.r - 0.38), k.y + Math.sin(a) * (k.r - 0.38), a, h * 0.28 + 0.14]);
        }
      }
      this._instanzen(geo, new THREE.MeshStandardMaterial({ color: '#202126', roughness: 0.9 }), liste, true);
    }
    if (pylonen.length) {
      const geo = new THREE.ConeGeometry(0.35, 0.9, 10);
      geo.translate(0, 0.45, 0);
      this._instanzen(geo, new THREE.MeshStandardMaterial({ color: '#ff6a1f', roughness: 0.5, emissive: this.nacht ? '#ff4a00' : '#000000', emissiveIntensity: 0.4 }), pylonen.map((k) => [k.x, k.y, 0]));
    }
    if (container.length) this._containerReihe(container);
    if (bloecke.length) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      this.geometrien.push(geo);
      const mat = this._mat(new THREE.MeshStandardMaterial({ color: '#9a9ca2', roughness: 0.9 }));
      for (const r of bloecke) {
        const n = new THREE.Mesh(geo, mat);
        n.scale.set(r.hl * 2, 1, r.hb * 2);
        n.position.set(r.x, 0, -r.y);
        n.rotation.y = r.winkel;
        this.objekt.add(n);
      }
    }
  }

  _start() {
    const S = this.S;
    const p = S.proben[S.startIdx];
    // Schachbrett-Startlinie
    const c = document.createElement('canvas');
    c.width = 64; c.height = 8;
    const ctx = c.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
      ctx.fillRect(x * 4, y * 4, 4, 4);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.materialien.push({ dispose: () => tex.dispose() });
    const geo = new THREE.PlaneGeometry(p.breite, 1.2);
    geo.rotateX(-Math.PI / 2);
    const linie = this._netz(geo, this._mat(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })));
    linie.position.set(p.x, 0.015, -p.y);
    linie.rotation.y = p.richtung - Math.PI / 2 + Math.PI / 2;
    linie.rotation.y = p.richtung + Math.PI / 2;
    linie.updateMatrix();
    // Startportal
    const portal = new THREE.Group();
    const stuetzeGeo = new THREE.BoxGeometry(0.5, 6, 0.5);
    stuetzeGeo.translate(0, 3, 0);
    const balkenGeo = new THREE.BoxGeometry(p.breite + 3, 1.2, 0.6);
    this.geometrien.push(stuetzeGeo, balkenGeo);
    const portalMat = this._mat(new THREE.MeshStandardMaterial({ color: '#1d2040', roughness: 0.5, metalness: 0.4 }));
    const leuchtMat = this._mat(new THREE.MeshStandardMaterial({ color: '#ff3d6e', emissive: '#ff3d6e', emissiveIntensity: 1.4 }));
    for (const s of [1, -1]) {
      const st = new THREE.Mesh(stuetzeGeo, portalMat);
      st.position.set(0, 0, s * (p.breite / 2 + 1.4));
      portal.add(st);
    }
    const balken = new THREE.Mesh(balkenGeo, portalMat);
    balken.position.set(0, 6.3, 0);
    balken.rotation.y = Math.PI / 2;
    portal.add(balken);
    const leiste = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, p.breite + 2.4), leuchtMat);
    this.geometrien.push(leiste.geometry);
    leiste.position.set(0, 5.75, 0);
    portal.add(leiste);
    portal.position.set(p.x, 0, -p.y);
    portal.rotation.y = p.richtung;
    this.objekt.add(portal);
  }

  _untergrund() {
    const S = this.S;
    const g = S.grenze;
    const b = g.maxX - g.minX + 600, h = g.maxY - g.minY + 600;
    const art = this.def.boden;
    const f = BODEN_FARBE[art] || BODEN_FARBE.asphalt;
    let mat;
    if (art === 'beton') {
      const tex = betonTextur('#8c8f95').clone();
      tex.repeat.set(b / 20, h / 20);
      tex.needsUpdate = true;
      this.materialien.push({ dispose: () => tex.dispose() });
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    } else if (art === 'nass') {
      const tex = asphaltTextur('#202229').clone();
      tex.repeat.set(b / 14, h / 14);
      tex.needsUpdate = true;
      this.materialien.push({ dispose: () => tex.dispose() });
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.1, envMapIntensity: 1.3 });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: f.umgebung, roughness: 1 });
    }
    this._mat(mat);
    const geo = new THREE.PlaneGeometry(b, h);
    geo.rotateX(-Math.PI / 2);
    const boden = this._netz(geo, mat);
    boden.position.set((g.minX + g.maxX) / 2, -0.03, -(g.minY + g.maxY) / 2);
    boden.updateMatrix();
    // Wasser (Küstenpass: Meer südlich der Küstenstraße; Neon-Hafen: Hafenbecken außen herum)
    if (this.def.id === 'kuestenpass' || this.def.id === 'neonhafen') {
      const wasserMat = this._mat(new THREE.MeshStandardMaterial({
        color: this.def.id === 'kuestenpass' ? '#2b5f8f' : '#0a1030', roughness: 0.08, metalness: 0.3, envMapIntensity: 1.6
      }));
      const wGeo = new THREE.PlaneGeometry(4000, 4000);
      wGeo.rotateX(-Math.PI / 2);
      const wasser = this._netz(wGeo, wasserMat);
      wasser.position.set(0, -1.2, 0);
      if (this.def.id === 'kuestenpass') {
        // Meer beginnt knapp unterhalb der Küstenstraße
        boden.scale.set(1, 1, 1);
        boden.position.z = -(g.minY + g.maxY) / 2 - 0;
        const kante = g.minY + 8;
        const landH = g.maxY + 300 - kante;
        boden.geometry.dispose();
        const landGeo = new THREE.PlaneGeometry(b, landH);
        landGeo.rotateX(-Math.PI / 2);
        boden.geometry = landGeo;
        this.geometrien.push(landGeo);
        boden.position.set((g.minX + g.maxX) / 2, -0.03, -(kante + landH / 2));
      } else {
        wasser.position.y = -2;
      }
      wasser.updateMatrix();
      boden.updateMatrix();
    }
    // Leuchtende Bodenreflexe (nasser Asphalt): langgezogene Lichtstreifen statt Echtzeit-Spiegelung
    if (art === 'nass') this._lichtStreifen();
  }

  _lichtStreifen() {
    const S = this.S;
    const z = new Zufall('streifen-' + S.id);
    const geo = new THREE.PlaneGeometry(1.4, 9);
    geo.rotateX(-Math.PI / 2);
    this.geometrien.push(geo);
    const farben = ['#ff2a8a', '#2ee6ff', '#b15cff', '#ffd166'];
    const mats = farben.map((f) => this._mat(new THREE.MeshBasicMaterial({ map: glowTextur(), color: f, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })));
    const proFarbe = farben.map(() => []);
    for (let i = 0; i < S.anzahl; i += 18) {
      const p = S.proben[i];
      const q = (z.naechste() - 0.5) * p.breite * 0.8;
      proFarbe[z.ganz(0, farben.length - 1)].push([p.x + p.nx * q, p.y + p.ny * q, -p.richtung + Math.PI / 2]);
    }
    proFarbe.forEach((liste, i) => {
      if (!liste.length) return;
      const m = new THREE.InstancedMesh(geo, mats[i], liste.length);
      const mx = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), pp = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
      liste.forEach(([x, y, w], k) => {
        e.set(0, w, 0);
        qq.setFromEuler(e);
        pp.set(x, 0.02, -y);
        mx.compose(pp, qq, s);
        m.setMatrixAt(k, mx);
      });
      m.renderOrder = 1;
      m.computeBoundingSphere();
      this.objekt.add(m);
    });
  }

  freigeben() {
    this.deko.freigeben();
    for (const g of this.geometrien) g.dispose();
    for (const m of this.materialien) m.dispose();
    this.objekt.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  }
}
