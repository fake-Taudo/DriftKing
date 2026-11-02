// Deko einer Strecke (instanziert, außerhalb der Fahrbahn und Wände): Container, Reifenstapel,
// Paletten, Lampen, Hallen, Kräne, Bäume, Felsen, Neon-Schilder, Leuchtturm.
// Platzierung deterministisch (seedbarer Zufall), Menge skaliert mit der Qualitätsstufe.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Zufall } from '../../../shared/zufall.js';
import { glowTextur } from '../texturen.js';

/** Abstand eines Punkts zur Mittellinie (grob über jede 3. Probe) minus halbe Breite und Wandabstand. */
function freiraum(S, x, y) {
  let best = Infinity, bi = 0;
  for (let i = 0; i < S.anzahl; i += 3) {
    const p = S.proben[i];
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  const p = S.proben[bi];
  const rand = (S.def.segmente[p.seg]?.rand ?? S.def.rand ?? 1.5);
  return Math.sqrt(best) - p.breite / 2 - rand;
}

function faerben(geo, farbe) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(farbe);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  const k = new THREE.BufferGeometry();
  k.setAttribute('position', g.attributes.position);
  k.setAttribute('normal', g.attributes.normal);
  k.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return k;
}

/** Lichtkegel ohne harte Kanten: blendet zum Rand und nach unten aus. */
function lichtkegelMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vV = normalize(-mv.xyz);
        vY = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        float kante = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.66), kante * vY * vY * 0.22);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
}

export function baueDeko(S, dichte, modell) {
  const def = S.def;
  const d = def.deko || {};
  const z = new Zufall('deko-' + S.id);
  const objekt = new THREE.Group();
  const geos = [];
  const mats = [];
  const nacht = def.tageszeit === 'Nacht';
  const g = S.grenze;
  const kante = def.id === 'kuestenpass' ? g.minY + 8 : -Infinity; // Meer südlich davon

  /** Sucht n freie Plätze mit Mindestabstand zur Fahrbahn. */
  function plaetze(n, minFrei, maxFrei = 80) {
    const aus = [];
    let versuche = 0;
    while (aus.length < n && versuche < n * 60) {
      versuche++;
      const x = g.minX - 40 + z.naechste() * (g.maxX - g.minX + 80);
      const y = g.minY - 40 + z.naechste() * (g.maxY - g.minY + 80);
      if (y < kante) continue;
      const f = freiraum(S, x, y);
      if (f < minFrei || f > maxFrei) continue;
      if (aus.some((q) => (q[0] - x) ** 2 + (q[1] - y) ** 2 < 36)) continue;
      aus.push([x, y, z.naechste() * Math.PI * 2]);
    }
    return aus;
  }

  function instanziert(geo, mat, liste, { farben = null, skal = null, hoehe = null } = {}) {
    if (!liste.length) return null;
    geos.push(geo);
    mats.push(mat);
    const m = new THREE.InstancedMesh(geo, mat, liste.length);
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const c = new THREE.Color();
    liste.forEach((it, i) => {
      e.set(0, it[2], 0);
      q.setFromEuler(e);
      p.set(it[0], hoehe ? hoehe(it, i) : 0, -it[1]);
      const k = skal ? skal(it, i) : 1;
      if (Array.isArray(k)) s.set(k[0], k[1], k[2]); else s.set(k, k, k);
      mx.compose(p, q, s);
      m.setMatrixAt(i, mx);
      if (farben) m.setColorAt(i, c.set(farben(it, i)));
    });
    m.receiveShadow = true;
    m.computeBoundingSphere();
    objekt.add(m);
    return m;
  }

  const anz = (n) => Math.round((n || 0) * dichte);

  // Container-Stapel
  if (d.container) {
    const liste = plaetze(anz(d.container), 6, 70).map(([x, y, w]) => [x, y, Math.round(w / (Math.PI / 2)) * (Math.PI / 2), z.ganz(0, 5), z.ganz(1, 3)]);
    modell._containerReihe(liste);
  }
  // Reifenstapel
  if (d.reifenstapel) {
    const liste = [];
    for (const [x, y] of plaetze(anz(d.reifenstapel), 3, 40)) {
      const h = z.ganz(3, 6);
      for (let k = 0; k < h; k++) liste.push([x, y, 0, k]);
    }
    const geo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 10);
    instanziert(geo, new THREE.MeshStandardMaterial({ color: '#1f2025', roughness: 0.9 }), liste, { hoehe: (it) => it[3] * 0.28 + 0.14 });
  }
  // Paletten
  if (d.paletten) {
    const liste = [];
    for (const [x, y, w] of plaetze(anz(d.paletten), 3, 40)) {
      const h = z.ganz(1, 5);
      for (let k = 0; k < h; k++) liste.push([x, y, w, k]);
    }
    const geo = new THREE.BoxGeometry(1.2, 0.15, 0.8);
    instanziert(geo, new THREE.MeshStandardMaterial({ color: '#a7804f', roughness: 0.9, flatShading: true }), liste, { hoehe: (it) => it[3] * 0.16 + 0.075 });
  }
  // Lampen (Mast + Leuchte, nachts mit Leuchthof)
  if (d.lampen) {
    const liste = [];
    for (let i = 0; i < S.anzahl && liste.length < anz(d.lampen); i += Math.floor(S.anzahl / Math.max(1, anz(d.lampen)))) {
      const p = S.proben[i];
      const rand = def.segmente[p.seg]?.rand ?? def.rand ?? 1.5;
      const seite = (i / Math.floor(S.anzahl / Math.max(1, anz(d.lampen)))) % 2 ? 1 : -1;
      const a = p.breite / 2 + rand + 1.5;
      const x = p.x + p.nx * a * seite, y = p.y + p.ny * a * seite;
      if (y < kante) continue;
      liste.push([x, y, Math.atan2(p.ny * seite, p.nx * seite) + Math.PI]);
    }
    const mast = new THREE.CylinderGeometry(0.09, 0.12, 8, 6);
    mast.translate(0, 4, 0);
    const kopf = new THREE.BoxGeometry(1.4, 0.18, 0.45);
    kopf.translate(0.55, 8, 0);
    const mastGeo = mergeGeometries([faerben(mast, '#3a3e48'), faerben(kopf, '#2a2d35')]);
    instanziert(mastGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 }), liste.map(([x, y, w]) => [x, y, -w]));
    const licht = new THREE.BoxGeometry(1.2, 0.05, 0.36);
    licht.translate(0.55, 7.9, 0);
    instanziert(licht, new THREE.MeshStandardMaterial({ color: '#fff5d8', emissive: '#fff1c4', emissiveIntensity: nacht ? 2.2 : 0.4 }), liste.map(([x, y, w]) => [x, y, -w]));
    if (nacht) {
      const hof = new THREE.PlaneGeometry(9, 9);
      hof.rotateX(-Math.PI / 2);
      const m = instanziert(hof, new THREE.MeshBasicMaterial({ map: glowTextur(), color: '#ffd9a0', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), liste.map(([x, y, w]) => [x + Math.cos(-w) * 0.55, y - Math.sin(-w) * 0.55, 0]), { hoehe: () => 0.03 });
      if (m) m.renderOrder = 1;
      // Lichtkegel: nach unten auslaufend, im Regen sichtbar
      const kegel = new THREE.ConeGeometry(2.8, 7.6, 20, 1, true);
      kegel.translate(0.55, 3.9, 0);
      const km = instanziert(kegel, lichtkegelMaterial(), liste.map(([x, y, w]) => [x, y, -w]));
      if (km) {
        km.renderOrder = 3;
        km.castShadow = false;
        km.receiveShadow = false;
      }
    }
  }
  // Hallen
  if (d.hallen) {
    const liste = plaetze(anz(d.hallen), 25, 120).map(([x, y, w]) => [x, y, Math.round(w / (Math.PI / 2)) * (Math.PI / 2)]);
    const korpus = new THREE.BoxGeometry(30, 10, 18);
    korpus.translate(0, 5, 0);
    const dach = new THREE.BoxGeometry(31, 1, 19);
    dach.translate(0, 10.5, 0);
    const tor = new THREE.BoxGeometry(8, 6, 0.2);
    tor.translate(0, 3, 9.05);
    const hallenGeo = mergeGeometries([faerben(korpus, nacht ? '#262a3a' : '#c3c7cf'), faerben(dach, nacht ? '#1a1d28' : '#7d828c'), faerben(tor, nacht ? '#3a2f55' : '#5b6170')]);
    instanziert(hallenGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }), liste);
  }
  // Kräne (Hafen)
  if (d.kraene) {
    const liste = plaetze(anz(d.kraene), 15, 90);
    const teile = [];
    for (const [x, zz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      const bein = new THREE.BoxGeometry(0.8, 26, 0.8);
      bein.translate(x, 13, zz);
      teile.push(faerben(bein, '#d1532f'));
    }
    const quer = new THREE.BoxGeometry(9, 1.2, 9);
    quer.translate(0, 26, 0);
    teile.push(faerben(quer, '#d1532f'));
    const ausleger = new THREE.BoxGeometry(46, 1.6, 2);
    ausleger.translate(10, 28, 0);
    teile.push(faerben(ausleger, '#e0b33a'));
    const kabine = new THREE.BoxGeometry(4, 3, 3);
    kabine.translate(0, 24, 3);
    teile.push(faerben(kabine, '#2a2d35'));
    const kranGeo = mergeGeometries(teile);
    instanziert(kranGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4, flatShading: true }), liste);
    // Warnlichter oben
    const warn = new THREE.SphereGeometry(0.5, 6, 4);
    warn.translate(32, 29, 0);
    instanziert(warn, new THREE.MeshBasicMaterial({ color: '#ff2020' }), liste);
  }
  // Bäume (Küste)
  if (d.baeume) {
    const liste = plaetze(anz(d.baeume), 4, 70);
    const stamm = new THREE.CylinderGeometry(0.18, 0.26, 2, 5);
    stamm.translate(0, 1, 0);
    const krone1 = new THREE.ConeGeometry(1.8, 4, 7);
    krone1.translate(0, 3.6, 0);
    const krone2 = new THREE.ConeGeometry(1.3, 3, 7);
    krone2.translate(0, 5.6, 0);
    const baumGeo = mergeGeometries([faerben(stamm, '#5a3d28'), faerben(krone1, '#2f6a3a'), faerben(krone2, '#3a7d44')]);
    instanziert(baumGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), liste, { skal: () => 0.8 + z.naechste() * 0.7 });
  }
  // Felsen
  if (d.felsen) {
    const liste = plaetze(anz(d.felsen), 3, 70);
    const fels = new THREE.IcosahedronGeometry(1.5, 0);
    const pos = fels.attributes.position;
    const zf = new Zufall('fels');
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.8 + zf.naechste() * 0.4), pos.getY(i) * (0.6 + zf.naechste() * 0.3), pos.getZ(i) * (0.8 + zf.naechste() * 0.4));
    fels.computeVertexNormals();
    instanziert(fels, new THREE.MeshStandardMaterial({ color: '#8a7466', roughness: 0.95, flatShading: true }), liste, { skal: () => [1 + z.naechste() * 2.5, 0.8 + z.naechste() * 2, 1 + z.naechste() * 2.5] });
  }
  // Neon-Schilder (Hafen)
  if (d.neon) {
    const farben = ['#ff2a8a', '#2ee6ff', '#b15cff', '#ffd166', '#39e08a'];
    const liste = plaetze(anz(d.neon), 2.5, 25);
    const schild = new THREE.BoxGeometry(5, 1.2, 0.25);
    schild.translate(0, 4, 0);
    // Unbeleuchtetes Material: Instanzfarbe = Leuchtfarbe (Bloom auf Desktop, Glow-Fläche überall)
    instanziert(schild, new THREE.MeshBasicMaterial({ color: '#ffffff' }), liste, { farben: (_it, i) => farben[i % farben.length] });
    const pfosten = new THREE.CylinderGeometry(0.08, 0.08, 4, 5);
    pfosten.translate(0, 2, 0);
    instanziert(pfosten, new THREE.MeshStandardMaterial({ color: '#2a2d35' }), liste);
    const glow = new THREE.PlaneGeometry(9, 4);
    glow.translate(0, 4, 0.2);
    const gm = instanziert(glow, new THREE.MeshBasicMaterial({ map: glowTextur(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), liste, { farben: (_it, i) => farben[i % farben.length] });
    if (gm) gm.renderOrder = 2;
  }
  // Leuchtturm (Küstenpass)
  if (def.id === 'kuestenpass') {
    const p = S.proben[Math.floor(S.anzahl * 0.93)];
    const x = p.x + p.nx * -30, y = Math.max(kante + 6, p.y + p.ny * -30);
    const turm = new THREE.CylinderGeometry(1.8, 2.6, 18, 10);
    turm.translate(0, 9, 0);
    const streifen = new THREE.CylinderGeometry(2.0, 2.15, 3, 10);
    streifen.translate(0, 9, 0);
    const kopf = new THREE.CylinderGeometry(2.2, 2.2, 2.6, 10);
    kopf.translate(0, 19.3, 0);
    const geo = mergeGeometries([faerben(turm, '#f2efe8'), faerben(streifen, '#d23a3a'), faerben(kopf, '#2a2d35')]);
    instanziert(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true }), [[x, y, 0]]);
    const licht = new THREE.SphereGeometry(1.4, 8, 6);
    licht.translate(0, 19.5, 0);
    instanziert(licht, new THREE.MeshBasicMaterial({ color: '#fff2c0' }), [[x, y, 0]]);
  }

  return {
    objekt,
    freigeben() {
      for (const ge of geos) ge.dispose();
      for (const m of mats) { m.dispose(); }
      objekt.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    }
  };
}
