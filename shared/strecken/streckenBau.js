// Streckenbau: aus den Streckendaten (Segmente → Kontrollpunkte → geschlossener Catmull-Rom-Spline)
// entstehen Mittellinie, Ränder, Wände (Kollisionsraster), Ideallinie mit Zielgeschwindigkeit,
// Drift-Zonen, Checkpoints, Startaufstellung und Minimap-Daten.
//
// Segment-Typen (Streckendatei):
//   { typ: 'gerade', laenge, breite? }
//   { typ: 'bogen', radius, winkel (Grad, + = links), breite? }
//   { typ: 'schliessen' }   – glatter Übergang zurück zum Start (Hermite-Kurve)
// Optionale Felder je Segment: zone {...}, wandL/wandR (Art oder null), rand (Wandabstand), hindernisse [...]
import { KollisionsGitter } from '../physik/kollision.js';
import { klemme, GRAD, winkelNorm } from '../mathe.js';
import { PHYSIK } from '../physikParameter.js';

const PROBE_ABSTAND = 1.0; // m zwischen Mittellinien-Proben
const KONTROLL_ABSTAND = 6; // m zwischen erzeugten Kontrollpunkten

// ---------------------------------------------------------------------------
// 1) Segmente → Kontrollpunkte

/**
 * Wandelt die Segmentliste in Kontrollpunkte um. Jeder Punkt merkt sich das Segment (für Zonen,
 * Wände, Breite).
 * @returns {Array<{x:number, y:number, breite:number, seg:number}>}
 */
export function kontrollpunkte(def) {
  const punkte = [];
  let x = def.start?.x ?? 0;
  let y = def.start?.y ?? 0;
  let r = (def.start?.richtung ?? 0) * GRAD;
  let breite = def.breite ?? 20;
  const x0 = x, y0 = y, r0 = r;
  def.segmente.forEach((seg, i) => {
    const b0 = breite;
    const b1 = seg.breite ?? breite;
    breite = b1;
    if (seg.typ === 'gerade') {
      const n = Math.max(1, Math.round(seg.laenge / KONTROLL_ABSTAND));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        punkte.push({ x: x + Math.cos(r) * seg.laenge * t, y: y + Math.sin(r) * seg.laenge * t, breite: b0 + (b1 - b0) * t, seg: i });
      }
      x += Math.cos(r) * seg.laenge;
      y += Math.sin(r) * seg.laenge;
    } else if (seg.typ === 'bogen') {
      const w = seg.winkel * GRAD;
      const bogenLaenge = Math.abs(w) * seg.radius;
      const n = Math.max(2, Math.round(bogenLaenge / KONTROLL_ABSTAND));
      const seite = Math.sign(w); // +1 links
      const cx = x - Math.sin(r) * seg.radius * seite;
      const cy = y + Math.cos(r) * seg.radius * seite;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const a = r + w * t;
        punkte.push({
          x: cx + Math.sin(a) * seg.radius * seite,
          y: cy - Math.cos(a) * seg.radius * seite,
          breite: b0 + (b1 - b0) * t,
          seg: i
        });
      }
      r += w;
      x = cx + Math.sin(r) * seg.radius * seite;
      y = cy - Math.cos(r) * seg.radius * seite;
    } else if (seg.typ === 'schliessen') {
      // Hermite-Kurve von (x, y, r) zu (x0, y0, r0)
      const d = Math.hypot(x0 - x, y0 - y);
      const n = Math.max(2, Math.round(d / KONTROLL_ABSTAND));
      const m = d * 1.0;
      const t0x = Math.cos(r) * m, t0y = Math.sin(r) * m;
      const t1x = Math.cos(r0) * m, t1y = Math.sin(r0) * m;
      const bStart = def.segmente[0].breite ?? def.breite ?? 20;
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        punkte.push({
          x: h00 * x + h10 * t0x + h01 * x0 + h11 * t1x,
          y: h00 * y + h10 * t0y + h01 * y0 + h11 * t1y,
          breite: b0 + (bStart - b0) * t,
          seg: i
        });
      }
      x = x0; y = y0; r = r0;
    }
  });
  return { punkte, ende: { x, y, richtung: r }, versatz: Math.hypot(x - x0, y - y0), winkelFehler: winkelNorm(r - r0) };
}

// ---------------------------------------------------------------------------
// 2) Catmull-Rom (zentripetal) durch geschlossene Kontrollpunkte → dichte Proben

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function proben(kp) {
  const n = kp.length;
  const roh = [];
  for (let i = 0; i < n; i++) {
    const p0 = kp[(i - 1 + n) % n], p1 = kp[i], p2 = kp[(i + 1) % n], p3 = kp[(i + 2) % n];
    const l = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const schritte = Math.max(2, Math.ceil(l / (PROBE_ABSTAND * 0.5)));
    for (let k = 0; k < schritte; k++) {
      const t = k / schritte;
      roh.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
        breite: p1.breite + (p2.breite - p1.breite) * t,
        seg: p1.seg
      });
    }
  }
  // Gleichmäßig nach Bogenlänge neu abtasten
  const kum = [0];
  for (let i = 1; i <= roh.length; i++) {
    const a = roh[i - 1], b = roh[i % roh.length];
    kum.push(kum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const laenge = kum[roh.length];
  const anzahl = Math.round(laenge / PROBE_ABSTAND);
  const ds = laenge / anzahl;
  const aus = [];
  let j = 0;
  for (let i = 0; i < anzahl; i++) {
    const s = i * ds;
    while (kum[j + 1] < s) j++;
    const a = roh[j], b = roh[(j + 1) % roh.length];
    const t = (s - kum[j]) / Math.max(1e-9, kum[j + 1] - kum[j]);
    aus.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, breite: a.breite + (b.breite - a.breite) * t, seg: t < 0.5 ? a.seg : b.seg, s });
  }
  return { proben: aus, laenge, ds };
}

// ---------------------------------------------------------------------------
// 3) Aufbau der Laufzeit-Strecke

/**
 * Baut die Laufzeit-Daten einer Strecke.
 * @param {object} def Streckendefinition (shared/strecken/*.js)
 */
export function baueStrecke(def) {
  const kp = kontrollpunkte(def);
  const { proben: P, laenge, ds } = proben(kp.punkte);
  const n = P.length;

  // Tangenten, Normalen (links), Krümmung
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    const rx = b.x - a.x, ry = b.y - a.y;
    const l = Math.hypot(rx, ry) || 1;
    P[i].tx = rx / l; P[i].ty = ry / l;
    P[i].nx = -P[i].ty; P[i].ny = P[i].tx;
    P[i].richtung = Math.atan2(ry, rx);
  }
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    P[i].kruemmung = winkelNorm(b.richtung - a.richtung) / (2 * ds);
  }

  // Segment-Eigenschaften je Probe
  const segInfo = (i) => def.segmente[P[i].seg] || {};
  const standardRand = def.rand ?? 1.5;

  // Ränder und Wände
  const randL = [], randR = [], wandL = [], wandR = [];
  for (let i = 0; i < n; i++) {
    const p = P[i];
    const s = segInfo(i);
    const rand = s.rand ?? standardRand;
    const hb = p.breite / 2;
    randL.push([p.x + p.nx * hb, p.y + p.ny * hb]);
    randR.push([p.x - p.nx * hb, p.y - p.ny * hb]);
    wandL.push([p.x + p.nx * (hb + rand), p.y + p.ny * (hb + rand)]);
    wandR.push([p.x - p.nx * (hb + rand), p.y - p.ny * (hb + rand)]);
  }

  // Kollisionsgitter: Wände als Segmente (Art je Seite aus dem Segment), Hindernisse
  const segmente = [];
  const wandArtStandard = def.wand ?? 'beton';
  const schrittW = 3; // Wand-Segmentlänge in Proben
  const wandAbschnitte = { L: [], R: [] };
  for (const seite of ['L', 'R']) {
    const poly = seite === 'L' ? wandL : wandR;
    let aktuell = null;
    for (let i = 0; i < n; i += schrittW) {
      const s = segInfo(i);
      const art = s['wand' + seite] === undefined ? wandArtStandard : s['wand' + seite];
      const j = Math.min(n, i + schrittW) % n;
      if (art) {
        segmente.push({ ax: poly[i][0], ay: poly[i][1], bx: poly[j][0], by: poly[j][1], art });
        if (!aktuell || aktuell.art !== art) {
          aktuell = { art, punkte: [poly[i]] };
          wandAbschnitte[seite].push(aktuell);
        }
        aktuell.punkte.push(poly[j]);
      } else {
        aktuell = null;
      }
    }
  }
  // Unsichtbare Außengrenze (verhindert Verlassen der Spielfläche, z. B. bei fehlenden Wänden)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of [...wandL, ...wandR]) {
    minX = Math.min(minX, w[0]); maxX = Math.max(maxX, w[0]);
    minY = Math.min(minY, w[1]); maxY = Math.max(maxY, w[1]);
  }
  const rahmen = 25;
  const grenze = { minX: minX - rahmen, minY: minY - rahmen, maxX: maxX + rahmen, maxY: maxY + rahmen };
  const ecken = [[grenze.minX, grenze.minY], [grenze.maxX, grenze.minY], [grenze.maxX, grenze.maxY], [grenze.minX, grenze.maxY]];
  for (let i = 0; i < 4; i++) {
    segmente.push({ ax: ecken[i][0], ay: ecken[i][1], bx: ecken[(i + 1) % 4][0], by: ecken[(i + 1) % 4][1], art: 'grenze' });
  }
  const gitter = new KollisionsGitter(segmente, [], 8);

  // Hindernisse: absolut (def.hindernisse) oder relativ zum Segment (seg.hindernisse)
  const hindernisse = { kreise: [], rechtecke: [] };
  for (const k of def.hindernisse?.kreise || []) hindernisse.kreise.push({ ...k });
  for (const r of def.hindernisse?.rechtecke || []) hindernisse.rechtecke.push({ ...r });
  def.segmente.forEach((seg, si) => {
    for (const hd of seg.hindernisse || []) {
      // Position: Anteil t im Segment, seitlicher Versatz q (m, + = links)
      const idx = probeImSegment(P, si, hd.t ?? 0.5);
      if (idx < 0) continue;
      const p = P[idx];
      const x = p.x + p.nx * (hd.q ?? 0);
      const y = p.y + p.ny * (hd.q ?? 0);
      if (hd.form === 'rechteck') hindernisse.rechtecke.push({ x, y, hb: hd.hb, hl: hd.hl, winkel: p.richtung + (hd.winkel ?? 0) * GRAD, art: hd.art });
      else hindernisse.kreise.push({ x, y, r: hd.r, art: hd.art });
    }
  });
  for (const k of hindernisse.kreise) gitter.kreisHinzufuegen(k);
  for (const r of hindernisse.rechtecke) gitter.rechteckHinzufuegen(r);

  // Drift-Zonen aus den Segmenten (zusammenhängende Proben eines Segments mit „zone“)
  const zonen = [];
  def.segmente.forEach((seg, si) => {
    if (!seg.zone) return;
    const idx = [];
    for (let i = 0; i < n; i++) if (P[i].seg === si) idx.push(i);
    if (!idx.length) return;
    // Zone auf zusammenhängenden Bereich (über den Nullpunkt hinweg) bringen
    let start = idx[0], ende = idx[idx.length - 1];
    if (idx.length < ende - start + 1) {
      // umlaufend
      for (let k = 1; k < idx.length; k++) if (idx[k] !== idx[k - 1] + 1) { start = idx[k]; ende = idx[k - 1]; break; }
    }
    const vor = Math.round((seg.zone.vorlauf ?? 6) / ds);
    const nach = Math.round((seg.zone.nachlauf ?? 8) / ds);
    zonen.push({
      id: zonen.length,
      name: seg.zone.name || `Zone ${zonen.length + 1}`,
      art: seg.zone.art || 'kurve',
      von: (start - vor + n) % n,
      bis: (ende + nach) % n,
      winkelMin: seg.zone.winkel?.[0] ?? 25,
      winkelMax: seg.zone.winkel?.[1] ?? 55,
      gewicht: seg.zone.gewicht ?? 1,
      minTempo: (seg.zone.minTempo ?? 35) / 3.6,
      referenzTempo: 0 // wird unten aus der Ideallinie bestimmt
    });
  });
  const zoneVon = new Int16Array(n).fill(-1);
  for (const z of zonen) {
    let i = z.von;
    while (true) {
      zoneVon[i] = z.id;
      if (i === z.bis) break;
      i = (i + 1) % n;
    }
  }

  // Ideallinie
  const ideal = idealLinieBerechnen(P, def, zoneVon, zonen);
  for (const z of zonen) {
    let summe = 0, anz = 0, i = z.von;
    while (true) {
      summe += ideal.tempo[i]; anz++;
      if (i === z.bis) break;
      i = (i + 1) % n;
    }
    z.referenzTempo = summe / anz;
  }

  // Checkpoints (alle ~60 m) – müssen der Reihe nach passiert werden
  const cpAbstand = Math.max(1, Math.round(60 / ds));
  const checkpoints = [];
  for (let i = 0; i < n; i += cpAbstand) checkpoints.push(i);

  // Startlinie (Start/Ziel) liegt startVersatz Meter nach dem Streckenanfang
  const startIdx = Math.round(((def.startVersatz ?? 12) / ds)) % n;
  const startPos = (meterZurueck) => {
    const i = (startIdx - Math.round(meterZurueck / ds) + n * 4) % n;
    const p = P[i];
    return { x: p.x + p.nx * ideal.versatz[i] * 0.5, y: p.y + p.ny * ideal.versatz[i] * 0.5, theta: p.richtung, index: i };
  };

  return {
    id: def.id,
    name: def.name,
    def,
    proben: P,
    anzahl: n,
    ds,
    laenge,
    kontrollpunkte: kp.punkte,
    schliessFehler: { versatz: kp.versatz, winkel: kp.winkelFehler },
    randL, randR, wandL, wandR, wandAbschnitte,
    grenze,
    gitter,
    hindernisse,
    zonen,
    zoneVon,
    ideal,
    checkpoints,
    startIdx,
    // Fliegender Start: Führer 15 m vor der Startlinie, Verfolger 10 m dahinter
    start: { fuehrer: startPos(15), verfolger: startPos(25), einzel: startPos(15) },
    referenzZeit: def.referenzZeit ?? ideal.rundenzeit,
    zeitLimit: (def.referenzZeit ?? ideal.rundenzeit) * 1.5,
    referenzPunkte: def.referenzPunkte ?? null,
    projektion: (x, y, hinweis) => projiziere(P, x, y, hinweis)
  };
}

function probeImSegment(P, si, t) {
  const idx = [];
  for (let i = 0; i < P.length; i++) if (P[i].seg === si) idx.push(i);
  if (!idx.length) return -1;
  return idx[Math.min(idx.length - 1, Math.max(0, Math.round(t * (idx.length - 1))))];
}

/**
 * Ideallinie: Minimal-Krümmungs-Linie (iterative Glättung innerhalb der Fahrbahn), gemischt mit
 * der Mittellinie, plus optionale Handkorrekturen. Zielgeschwindigkeit aus der Krümmung mit
 * Brems-/Beschleunigungsgrenzen; Soll-Driftwinkel aus den Drift-Zonen.
 */
function idealLinieBerechnen(P, def, zoneVon, zonen) {
  const n = P.length;
  const versatz = new Float64Array(n);
  const rand = def.idealRand ?? 3.5;
  const grenzeA = (i) => Math.max(0, P[i].breite / 2 - rand);
  // Mehrstufige Relaxation (große Nachbarschaften zuerst → schnelle Konvergenz)
  for (const k of [24, 12, 6, 3]) {
    for (let it = 0; it < 120; it++) {
      for (let i = 0; i < n; i++) {
        const a = (i - k + n) % n, b = (i + k) % n;
        const pa = P[a], pb = P[b], p = P[i];
        const ax = pa.x + pa.nx * versatz[a], ay = pa.y + pa.ny * versatz[a];
        const bx = pb.x + pb.nx * versatz[b], by = pb.y + pb.ny * versatz[b];
        const mx = (ax + bx) / 2 - p.x, my = (ay + by) / 2 - p.y;
        const ziel = mx * p.nx + my * p.ny;
        const g = grenzeA(i);
        versatz[i] = klemme(versatz[i] + (ziel - versatz[i]) * 0.5, -g, g);
      }
    }
  }
  const mischung = def.idealMischung ?? 0.7;
  for (let i = 0; i < n; i++) versatz[i] *= mischung;
  // Handkorrekturen: { s (Anteil 0..1), versatz (m), breite (m) }
  for (const korr of def.idealKorrektur || []) {
    const mitte = Math.round(korr.s * n);
    const halb = Math.max(1, Math.round((korr.breite ?? 30) / 2));
    for (let d = -halb; d <= halb; d++) {
      const i = (mitte + d + n) % n;
      const w = 0.5 + 0.5 * Math.cos((Math.PI * d) / halb);
      versatz[i] = klemme(versatz[i] + korr.versatz * w, -grenzeA(i), grenzeA(i));
    }
  }
  // Positionen und Krümmung der Ideallinie
  const x = new Float64Array(n), y = new Float64Array(n), richtung = new Float64Array(n), kr = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = P[i].x + P[i].nx * versatz[i];
    y[i] = P[i].y + P[i].ny * versatz[i];
  }
  for (let i = 0; i < n; i++) {
    const a = (i - 2 + n) % n, b = (i + 2) % n;
    richtung[i] = Math.atan2(y[b] - y[a], x[b] - x[a]);
  }
  const abschnitt = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const b = (i + 1) % n;
    abschnitt[i] = Math.hypot(x[b] - x[i], y[b] - y[i]);
  }
  for (let i = 0; i < n; i++) {
    const a = (i - 3 + n) % n, b = (i + 3) % n;
    let l = 0;
    for (let k = -3; k < 3; k++) l += abschnitt[(i + k + n) % n];
    kr[i] = winkelNorm(richtung[b] - richtung[a]) / Math.max(0.5, l);
  }
  // Zielgeschwindigkeit: Kurvengrenze (Drift-Haftung) + Brems-/Beschleunigungsdurchläufe
  const mu = def.idealHaftung ?? 0.85;
  const vMax = (def.idealMaxKmh ?? 150) / 3.6;
  const tempo = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.abs(kr[i]);
    tempo[i] = Math.min(vMax, k > 1e-4 ? Math.sqrt((mu * PHYSIK.g) / k) : vMax);
    if (zoneVon[i] >= 0) {
      const z = zonen[zoneVon[i]];
      tempo[i] = Math.max(tempo[i], z.minTempo);
    }
  }
  const bremsen = def.idealBremsen ?? 6.0, beschl = def.idealBeschleunigen ?? 3.5;
  for (let runde = 0; runde < 2; runde++) {
    for (let i = n - 1; i >= 0; i--) {
      const b = (i + 1) % n;
      tempo[i] = Math.min(tempo[i], Math.sqrt(tempo[b] * tempo[b] + 2 * bremsen * abschnitt[i]));
    }
    for (let i = 0; i < n; i++) {
      const b = (i + 1) % n;
      tempo[b] = Math.min(tempo[b], Math.sqrt(tempo[i] * tempo[i] + 2 * beschl * abschnitt[i]));
    }
  }
  // Soll-Driftwinkel (Grad) mit Vorzeichen der Kurve: in Zonen aus dem Zonenbereich, sonst 0
  const sollWinkel = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const zi = zoneVon[i];
    if (zi < 0) continue;
    const z = zonen[zi];
    const anteil = klemme(Math.abs(kr[i]) * 25, 0, 1);
    sollWinkel[i] = (z.winkelMin + (z.winkelMax - z.winkelMin) * anteil) * Math.sign(kr[i] || 1);
  }
  let rundenzeit = 0;
  for (let i = 0; i < n; i++) rundenzeit += abschnitt[i] / Math.max(1, tempo[i]);
  return { versatz, x, y, richtung, kruemmung: kr, tempo, sollWinkel, rundenzeit };
}

/**
 * Nächste Mittellinien-Probe zu (x, y). Mit Hinweis-Index wird nur lokal gesucht (schnell).
 * @returns {{index:number, s:number, quer:number, richtung:number, abstandIdeal:number}}
 */
function projiziere(P, x, y, hinweis) {
  const n = P.length;
  let best = -1, bestD = Infinity;
  if (hinweis !== undefined && hinweis >= 0) {
    for (let d = -40; d <= 40; d++) {
      const i = (hinweis + d + n) % n;
      const p = P[i];
      const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dd < bestD) { bestD = dd; best = i; }
    }
    if (bestD > 30 * 30) best = -1; // zu weit weg → global suchen
  }
  if (best < 0) {
    bestD = Infinity;
    for (let i = 0; i < n; i += 2) {
      const p = P[i];
      const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dd < bestD) { bestD = dd; best = i; }
    }
    for (let d = -2; d <= 2; d++) {
      const i = (best + d + n) % n;
      const p = P[i];
      const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dd < bestD) { bestD = dd; best = i; }
    }
  }
  const p = P[best];
  const quer = (x - p.x) * p.nx + (y - p.y) * p.ny;
  return { index: best, s: p.s, quer, richtung: p.richtung };
}
