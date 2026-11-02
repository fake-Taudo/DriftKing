// Prozedurale Karosserie: Unterbau als Loft aus Querschnitten (mit Radhäusern und Kotflügeln),
// Kabine als eigener Loft (Scheiben, Dach), A/B/C-Säulen. Liefert Geometrien mit Zonen-UVs für die
// Livery sowie die Anker-Punkte für Anbauteile.
//
// Modell-Koordinaten: Ursprung = Schwerpunkt auf dem Boden, +Z = vorne, +X = links, +Y = oben.
import * as THREE from 'three';
import { zonenUV } from './liveryAtlas.js';

/** Sammelt Dreiecke (nicht indiziert → flache Low-Poly-Schattierung, UV-Nähte je Zone). */
export class GeoBauer {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.farbe = null;
  }
  dreieck(a, b, c, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  }
  /** Viereck a-b-c-d (gegen den Uhrzeigersinn von außen gesehen). */
  viereck(a, b, c, d, ua, ub, uc, ud) {
    this.dreieck(a, b, c, ua, ub, uc);
    this.dreieck(a, c, d, ua, uc, ud);
  }
  geometrie() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    return g;
  }
}

const glatt = (t) => t * t * (3 - 2 * t);
const klemme = (x, a, b) => (x < a ? a : x > b ? b : x);

/**
 * Baut die Karosserie.
 * @param {object} p Fahrzeugparameter (abmessungen, radstand, spurweite, radRadius, gewichtVorne)
 * @param {object} f Form (autoFormen.js)
 */
export function baueKarosserie(p, f) {
  const { laenge, breite, hoehe } = p.abmessungen;
  const L = p.radstand;
  const lv = L * (1 - p.gewichtVorne);
  const lh = L * p.gewichtVorne;
  const ueberhang = Math.max(0.4, laenge - L);
  const zFront = lv + ueberhang * f.ueberhangVorneAnteil;
  const zHeck = -(lh + ueberhang * (1 - f.ueberhangVorneAnteil));
  const Lb = zFront - zHeck;
  const W = breite / 2;
  const R = p.radRadius;
  const zAus = (anteil) => zHeck + ((anteil + 1) / 2) * Lb; // Anteil −1..1 → z
  const zWS = zAus(f.scheibeVorne);
  const zDV = zAus(f.dachVorne);
  const zDH = zAus(f.dachHinten);
  const zRW = zAus(f.scheibeHinten);
  const radV = lv, radH = -lh;
  const radBogen = R + 0.075; // Radhaus-Radius
  const radhausOben = R + radBogen; // Höhe des Radhausscheitels über dem Boden

  // --- Stationen entlang z (dicht an den Enden und an den Radhäusern) ---
  const anteile = [1, 0.99, 0.965, 0.93, 0.88, 0.8, 0.7, 0.58, 0.46, 0.34, 0.22, 0.1, -0.02, -0.14, -0.26, -0.38, -0.5, -0.62, -0.72, -0.8, -0.87, -0.92, -0.955, -0.98, -1];
  const zs = new Set(anteile.map(zAus));
  for (const zr of [radV, radH]) {
    for (let k = -4; k <= 4; k++) zs.add(zr + (k / 4) * radBogen * 1.02);
  }
  zs.add(zWS); zs.add(zRW);
  const stationen = [...zs].filter((z) => z <= zFront + 1e-6 && z >= zHeck - 1e-6).sort((a, b) => b - a);

  const randV = Math.max(0.05, f.nasenRundung);
  const randH = Math.max(0.05, f.heckRundung);

  function profil(z) {
    // Rundung an Nase und Heck
    const tV = klemme((zFront - z) / randV, 0, 1);
    const tH = klemme((z - zHeck) / randH, 0, 1);
    const rund = Math.min(glatt(Math.sqrt(tV)), glatt(Math.sqrt(tH)));
    // Obere Kante (Haube/Kofferraum/Gürtel)
    let oben;
    if (z >= zWS) {
      const t = klemme((zFront - z) / Math.max(0.01, zFront - zWS), 0, 1); // begrenzt: Rundungsfehler ergäben sonst NaN
      oben = f.haubeVorne + (f.guertel - f.haubeVorne) * Math.pow(t, 0.7) + f.keil * (1 - t) * 0;
    } else if (z <= zRW) {
      const t = klemme((z - zHeck) / Math.max(0.01, zRW - zHeck), 0, 1);
      oben = f.heckHinten + (f.heckOben - f.heckHinten) * Math.pow(t, 0.5);
    } else {
      oben = f.guertel;
    }
    // Kotflügel über den Rädern hochziehen, wo nötig (nur am Rand – die Haubenmitte bleibt glatt)
    let unten = f.bodenHoehe;
    let breitZuschlag = 0;
    let obenRand = oben;
    for (const [zr, hinten] of [[radV, false], [radH, true]]) {
      const d = Math.abs(z - zr);
      if (d < radBogen) {
        const bogenY = R + Math.sqrt(radBogen * radBogen - d * d);
        unten = Math.max(unten, bogenY);
      }
      const huegel = glatt(Math.max(0, 1 - d / (radBogen * 1.7)));
      obenRand = Math.max(obenRand, oben * (1 - huegel) + (radhausOben + 0.06) * huegel);
      if (hinten) breitZuschlag += f.kotfluegelHinten * huegel;
      else breitZuschlag += f.kotfluegelHinten * 0.4 * huegel;
    }
    oben -= (1 - rund) * 0.1;
    obenRand -= (1 - rund) * 0.1;
    obenRand = Math.max(obenRand, oben);
    unten = Math.min(unten, obenRand - 0.12);
    const unterBoden = f.bodenHoehe + (1 - rund) * 0.05;
    const w = W * (0.8 + 0.2 * rund) + breitZuschlag;
    const schulter = Math.max(unten + 0.12, obenRand - 0.07);
    return { z, oben, obenRand, unten, unterBoden, w, schulter, rund };
  }

  const P = stationen.map(profil);

  // Querschnitt (links = +X), Punkte von unten-links über die Mitte nach unten-rechts
  function ring(pr) {
    const { w, oben, obenRand, unten, schulter } = pr;
    const mitte = unten + (schulter - unten) * 0.5;
    const krone = 0.025 * pr.rund;
    const links = [
      [w * 0.95, unten],
      [w * (1 + f.bauch), mitte],
      [w * 0.97, schulter],
      [w * 0.85, obenRand]
    ];
    const pts = [];
    for (const [x, y] of links) pts.push([x, y]);
    pts.push([0, oben + krone]);
    for (let i = links.length - 1; i >= 0; i--) pts.push([-links[i][0], links[i][1]]);
    return pts;
  }

  const lack = new GeoBauer();
  const H = hoehe;
  const uvSeite = (x, y, z) => {
    const v = y / H;
    if (x >= 0) return zonenUV('seiteL', (zFront - z) / Lb, v);
    return zonenUV('seiteR', (z - zHeck) / Lb, v);
  };
  const uvOben = (x, y, z) => {
    const u = (W - x) / (2 * W);
    if (z >= zWS - 0.02) return zonenUV('haube', u, (z - zWS) / Math.max(0.01, zFront - zWS));
    if (z <= zRW + 0.02) return zonenUV('heck', 1 - u, 0.5 + 0.5 * (z - zHeck) / Math.max(0.01, zRW - zHeck));
    return zonenUV('dach', u, 0.02);
  };

  for (let k = 0; k < P.length - 1; k++) {
    const A = ring(P[k]), B = ring(P[k + 1]);
    const za = P[k].z, zb = P[k + 1].z;
    for (let i = 0; i < A.length - 1; i++) {
      const a = [A[i][0], A[i][1], za];
      const b = [B[i][0], B[i][1], zb];
      const c = [B[i + 1][0], B[i + 1][1], zb];
      const d = [A[i + 1][0], A[i + 1][1], za];
      const oberseite = i === 3 || i === 4; // Schulter → Mitte (obere Fläche)
      const uvf = oberseite ? uvOben : uvSeite;
      // Fläche nach außen orientieren: von außen gesehen gegen den Uhrzeigersinn
      lack.viereck(a, b, c, d, uvf(...a), uvf(...b), uvf(...c), uvf(...d));
    }
  }
  // Front- und Heckkappe (Fächer um den Mittelpunkt)
  function kappe(pr, vorne) {
    const pts = ring(pr);
    const z = pr.z;
    const cy = (pr.oben + pr.unterBoden) / 2;
    const mitte = [0, cy, z];
    const zone = vorne ? 'front' : 'heck';
    const uvk = (x, y) => (vorne ? zonenUV(zone, (x + W) / (2 * W), y / H) : zonenUV(zone, (W - x) / (2 * W), 0.5 * (y / H) / 0.75));
    // Umlauf: links unten → links hoch → Dach → rechts runter → rechts unten → (Unterkante) zurück
    const alle = [[pts[0][0], pr.unterBoden], ...pts, [pts[pts.length - 1][0], pr.unterBoden]];
    for (let i = 0; i < alle.length; i++) {
      const a = [alle[i][0], alle[i][1], z];
      const n2 = alle[(i + 1) % alle.length];
      const b = [n2[0], n2[1], z];
      if (vorne) lack.dreieck(mitte, a, b, uvk(0, cy), uvk(a[0], a[1]), uvk(b[0], b[1]));
      else lack.dreieck(mitte, b, a, uvk(0, cy), uvk(b[0], b[1]), uvk(a[0], a[1]));
    }
  }
  kappe(P[0], true);
  kappe(P[P.length - 1], false);

  // Unterboden zwischen den Radhäusern (dunkel), damit man nicht hineinsieht
  const unterboden = new GeoBauer();
  {
    const y = f.bodenHoehe + 0.02;
    const wb = W * 0.9;
    unterboden.viereck([wb, y, zFront - 0.1], [-wb, y, zFront - 0.1], [-wb, y, zHeck + 0.1], [wb, y, zHeck + 0.1]);
    // Seitliche Innenwände der Radhäuser
    for (const zr of [radV, radH]) {
      for (const s of [1, -1]) {
        const x = s * W * 0.6;
        const a = [x, R * 0.2, zr + radBogen], b = [x, R * 0.2, zr - radBogen], c = [x, radhausOben, zr - radBogen], d = [x, radhausOben, zr + radBogen];
        unterboden.viereck(a, b, c, d);
        unterboden.viereck(a, d, c, b);
      }
      // Radhaus-Decke
      unterboden.viereck([W * 0.95, radhausOben, zr + radBogen], [-W * 0.95, radhausOben, zr + radBogen], [-W * 0.95, radhausOben, zr - radBogen], [W * 0.95, radhausOben, zr - radBogen]);
    }
  }

  // --- Kabine ---
  const guertelBei = (z) => profil(z).obenRand;
  const glas = new GeoBauer();
  const kabStationen = [];
  const nK = 14;
  for (let i = 0; i <= nK; i++) kabStationen.push(zWS + (zRW - zWS) * (i / nK));
  if (!kabStationen.includes(zDV)) kabStationen.push(zDV);
  if (!kabStationen.includes(zDH)) kabStationen.push(zDH);
  kabStationen.sort((a, b) => b - a);
  const dachY = hoehe;
  function kabProfil(z) {
    let h;
    if (z >= zDV) h = (zWS - z) / Math.max(0.01, zWS - zDV);
    else if (z <= zDH) h = (z - zRW) / Math.max(0.01, zDH - zRW);
    else h = 1;
    h = klemme(h, 0, 1);
    const unten = guertelBei(z) - 0.01;
    const oben = unten + (dachY - unten) * (h < 1 ? Math.pow(h, 0.85) : 1);
    const wu = W * f.kabineBreite;
    const wo = wu + (W * f.dachBreite - wu) * h;
    return { z, unten, oben, wu, wo, h };
  }
  const K = kabStationen.map(kabProfil);
  const dachZone = (x, z) => zonenUV('dach', (W - x) / (2 * W), (z - zDH) / Math.max(0.01, zDV - zDH));
  for (let k = 0; k < K.length - 1; k++) {
    const a = K[k], b = K[k + 1];
    // Seitenscheiben links/rechts
    for (const s of [1, -1]) {
      const p1 = [s * a.wu, a.unten, a.z], p2 = [s * a.wo, a.oben, a.z], p3 = [s * b.wo, b.oben, b.z], p4 = [s * b.wu, b.unten, b.z];
      if (s > 0) glas.viereck(p1, p4, p3, p2); else glas.viereck(p1, p2, p3, p4);
    }
    // Oberseite: Dach (Lack) oder Front-/Heckscheibe (Glas)
    const istDach = a.h >= 0.999 && b.h >= 0.999;
    const q1 = [a.wo, a.oben, a.z], q2 = [-a.wo, a.oben, a.z], q3 = [-b.wo, b.oben, b.z], q4 = [b.wo, b.oben, b.z];
    if (istDach) {
      lack.viereck(q1, q4, q3, q2, dachZone(q1[0], q1[2]), dachZone(q4[0], q4[2]), dachZone(q3[0], q3[2]), dachZone(q2[0], q2[2]));
      // Dachkanten-Fase (wirkt wie ein Rahmen)
    } else {
      glas.viereck(q1, q4, q3, q2);
    }
  }

  // --- Säulen (A, B, C) als schmale Lackstreifen auf der Kabine ---
  const saeulen = new GeoBauer();
  function streifen(p1, p2, dicke, aussen) {
    // Schmales Band von p1 nach p2, leicht nach außen versetzt
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], dz = p2[2] - p1[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    const nx = aussen[0], ny = aussen[1], nz = aussen[2];
    // Quer-Richtung = Kreuzprodukt aus Richtung und Normale
    let qx = (dy / l) * nz - (dz / l) * ny, qy = (dz / l) * nx - (dx / l) * nz, qz = (dx / l) * ny - (dy / l) * nx;
    const ql = Math.hypot(qx, qy, qz) || 1;
    qx *= dicke / ql; qy *= dicke / ql; qz *= dicke / ql;
    const o = 0.008;
    const a = [p1[0] + qx + nx * o, p1[1] + qy + ny * o, p1[2] + qz + nz * o];
    const b = [p1[0] - qx + nx * o, p1[1] - qy + ny * o, p1[2] - qz + nz * o];
    const c = [p2[0] - qx + nx * o, p2[1] - qy + ny * o, p2[2] - qz + nz * o];
    const d = [p2[0] + qx + nx * o, p2[1] + qy + ny * o, p2[2] + qz + nz * o];
    saeulen.viereck(a, b, c, d);
    saeulen.viereck(a, d, c, b);
  }
  const kV = kabProfil(zWS), kDV = kabProfil(zDV), kDH = kabProfil(zDH), kRW = kabProfil(zRW);
  for (const s of [1, -1]) {
    streifen([s * kV.wu, kV.unten, kV.z], [s * kDV.wo, kDV.oben, kDV.z], 0.05, [s, 0.3, 0.2]); // A-Säule
    const zB = (zDV + zDH) / 2 + (zDV - zDH) * 0.08;
    const kB = kabProfil(zB);
    streifen([s * kB.wu, kB.unten, zB], [s * kB.wo, kB.oben, zB], 0.055, [s, 0.1, 0]); // B-Säule
    streifen([s * kDH.wo, kDH.oben, kDH.z], [s * kRW.wu, kRW.unten, kRW.z], 0.07, [s, 0.3, -0.2]); // C-Säule
    // Dachrahmen und Gürtellinie
    streifen([s * kDV.wo, kDV.oben, kDV.z], [s * kDH.wo, kDH.oben, kDH.z], 0.025, [s, 1, 0]);
  }

  // --- Anker-Punkte für Anbauteile ---
  const vorne = P[0], hinten = P[P.length - 1];
  const pMitte = profil((zWS + zRW) / 2);
  const anker = {
    frontStoss: { x: 0, y: f.bodenHoehe + 0.05, z: zFront, breite: vorne.w * 2, hoehe: vorne.oben - f.bodenHoehe },
    heck: { x: 0, y: f.bodenHoehe + 0.05, z: zHeck, breite: hinten.w * 2, hoehe: hinten.oben - f.bodenHoehe },
    dach: { x: 0, y: dachY, z: (zDV + zDH) / 2, breite: W * f.dachBreite * 2, laenge: zDV - zDH },
    haube: { x: 0, y: profil((zFront + zWS) / 2).oben, z: (zFront + zWS) / 2, breite: W * 1.6, laenge: zFront - zWS, neigung: Math.atan2(f.guertel - f.haubeVorne, zFront - zWS) },
    kofferraum: { x: 0, y: profil(zHeck + 0.12).oben, z: zHeck + 0.12, breite: hinten.w * 2 * 0.95 },
    schweller: { x: W, y: f.bodenHoehe, zVorne: radV - radBogen, zHinten: radH + radBogen },
    radhaeuser: [
      { x: W, y: R, z: radV, vorne: true }, { x: -W, y: R, z: radV, vorne: true },
      { x: W, y: R, z: radH, vorne: false }, { x: -W, y: R, z: radH, vorne: false }
    ],
    spiegel: { x: W * f.kabineBreite + 0.04, y: guertelBei(zWS) + 0.06, z: zWS - 0.12 },
    auspuff: { x: -W * 0.55, y: f.bodenHoehe + 0.06, z: zHeck },
    scheinwerfer: { y: Math.max(f.bodenHoehe + 0.15, vorne.oben - 0.12), x: vorne.w * 0.62, z: zFront },
    ruecklicht: { y: Math.max(f.bodenHoehe + 0.2, hinten.oben - 0.12), x: hinten.w * 0.66, z: zHeck },
    kennzeichen: { y: f.bodenHoehe + 0.22, z: zHeck - 0.005 },
    innenraum: { zVorne: zWS - 0.1, zHinten: zRW + 0.1, boden: f.bodenHoehe + 0.1, breite: W * f.kabineBreite * 2 * 0.9, guertel: f.guertel },
    mitteSchulter: pMitte.schulter
  };

  return {
    lack: lack.geometrie(),
    glas: glas.geometrie(),
    saeulen: saeulen.geometrie(),
    unterboden: unterboden.geometrie(),
    anker,
    masse: { zFront, zHeck, Lb, W, H: hoehe, zWS, zDV, zDH, zRW, radV, radH, radBogen, radhausOben },
    // Größe der Livery-Zonen auf der Karosserie (Meter), damit Aufkleber und Muster unverzerrt bleiben
    zonen: {
      seiteL: { b: Lb, h: hoehe },
      seiteR: { b: Lb, h: hoehe },
      haube: { b: 2 * W, h: Math.max(0.3, zFront - zWS) },
      dach: { b: 2 * W, h: Math.max(0.3, zDV - zDH) },
      heck: { b: 2 * W, h: Math.max(0.3, zRW - zHeck) + hoehe * 0.75 },
      front: { b: 2 * W, h: hoehe }
    }
  };
}
