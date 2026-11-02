// Aufkleber-Bibliothek: selbst gezeichnete Vektor-Aufkleber als SVG-Pfad-Daten (Ansichtsfenster 100 × 100,
// Mitte bei 50/50), gezeichnet per Path2D. Reine Daten ohne Browser-Abhängigkeit (auch vom Server für die
// Look-Prüfung verwendet). Alle Motive und „Sponsoren“ sind frei erfunden.
// Felder: id, name, paket (siehe AUFKLEBER_PAKETE in shared/teile.js), pfad, regel ('evenodd' für Löcher),
//         text (optional: Schriftzug eines Logos { wort, schrift, groesse, y }).

const zahl = (x) => Math.round(x * 100) / 100;

/** Geschlossener Polygonzug. */
function poly(punkte) {
  return 'M' + punkte.map(([x, y]) => `${zahl(x)} ${zahl(y)}`).join('L') + 'Z';
}
/** Vollkreis als zwei Bögen. */
function kreis(cx, cy, r) {
  return `M${zahl(cx - r)} ${zahl(cy)}A${zahl(r)} ${zahl(r)} 0 1 0 ${zahl(cx + r)} ${zahl(cy)}A${zahl(r)} ${zahl(r)} 0 1 0 ${zahl(cx - r)} ${zahl(cy)}Z`;
}
/** Regelmäßiges Vieleck. */
function vieleck(n, r, drehung = -90, cx = 50, cy = 50) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const w = ((drehung + (360 * i) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(w), cy + r * Math.sin(w)]);
  }
  return poly(pts);
}
/** Stern mit n Spitzen. */
function stern(n, aussen, innen, drehung = -90, cx = 50, cy = 50) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? innen : aussen;
    const w = ((drehung + (180 * i) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(w), cy + r * Math.sin(w)]);
  }
  return poly(pts);
}
/** Rechteck. */
function rechteck(x, y, b, h) {
  return poly([[x, y], [x + b, y], [x + b, y + h], [x, y + h]]);
}
/** Zahnrad-Umriss. */
function zahnrad(zaehne, aussen, innen, cx = 50, cy = 50) {
  const pts = [];
  const schritt = 360 / zaehne;
  for (let i = 0; i < zaehne; i++) {
    const w = i * schritt;
    for (const [d, r] of [[-0.3, innen], [-0.2, aussen], [0.2, aussen], [0.3, innen]]) {
      const a = ((w + d * schritt) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return poly(pts);
}

// ---------------------------------------------------------------------------
// Rennziffern und -buchstaben aus Segmenten mit abgeschrägten Enden
const L = 22, R = 78, O = 8, M = 50, U = 92, D = 13, G = 2.5;
const SEG = {
  a: poly([[L + G, O], [R - G, O], [R - G - D, O + D], [L + G + D, O + D]]),
  d: poly([[L + G + D, U - D], [R - G - D, U - D], [R - G, U], [L + G, U]]),
  f: poly([[L, O + G], [L + D, O + G + D], [L + D, M - D / 2 - G], [L, M - G]]),
  e: poly([[L, M + G], [L + D, M + D / 2 + G], [L + D, U - G - D], [L, U - G]]),
  b: poly([[R, O + G], [R, M - G], [R - D, M - D / 2 - G], [R - D, O + G + D]]),
  c: poly([[R, M + G], [R, U - G], [R - D, U - G - D], [R - D, M + D / 2 + G]]),
  g: poly([[L + G + 3, M], [L + D + G, M - D / 2], [R - D - G, M - D / 2], [R - G - 3, M], [R - D - G, M + D / 2], [L + D + G, M + D / 2]]),
  i: poly([[M - D / 2, O + D + G], [M + D / 2, O + D + G], [M + D / 2, U - G], [M - D / 2, U - G]]),
  // Diagonalen: h = Mitte → unten rechts, j = Mitte → oben rechts, k = oben links → unten rechts, l = unten links → oben rechts
  h: poly([[M - 6, M + D / 2 + G], [M + 8, M + D / 2 + G], [R, U - G], [R - 15, U - G]]),
  j: poly([[M - 6, M - D / 2 - G], [M + 8, M - D / 2 - G], [R, O + G], [R - 15, O + G]]),
  k: poly([[L, O + G], [L + 15, O + G], [R, U - G], [R - 15, U - G]]),
  l: poly([[R - 15, O + D + G], [R, O + D + G], [L + 15, U - D - G], [L, U - D - G]])
};
const zeichen = (segmente) => segmente.split('').map((s) => SEG[s]).join('');

const ZIFFERN = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
const BUCHSTABEN = { a: 'abcefg', e: 'adefg', h: 'bcefg', k: 'efjh', l: 'def', r: 'abefgh', t: 'ai', x: 'kl', z: 'adl' };

const FLAMME = 'M50 96C26 96 14 78 18 60C21 46 32 40 34 24C45 32 47 46 46 54C52 44 56 26 50 6C70 20 86 44 84 64C82 84 70 96 50 96Z';

/** Schachbrett als Pfad (nur die dunklen Felder). */
function karo(x, y, spalten, zeilen, feld) {
  let p = '';
  for (let s = 0; s < spalten; s++) {
    for (let z = 0; z < zeilen; z++) {
      if ((s + z) % 2 === 0) p += rechteck(x + s * feld, y + z * feld, feld, feld);
    }
  }
  return p;
}

export const AUFKLEBER = [
  // --- Formen (Grundausstattung) ---
  { id: 'kreis', name: 'Kreis', paket: 'formen', pfad: kreis(50, 50, 44) },
  { id: 'ring', name: 'Ring', paket: 'formen', pfad: kreis(50, 50, 44) + kreis(50, 50, 30), regel: 'evenodd' },
  { id: 'quadrat', name: 'Quadrat', paket: 'formen', pfad: rechteck(10, 10, 80, 80) },
  { id: 'rahmen', name: 'Rahmen', paket: 'formen', pfad: rechteck(8, 8, 84, 84) + rechteck(20, 20, 60, 60), regel: 'evenodd' },
  { id: 'dreieck', name: 'Dreieck', paket: 'formen', pfad: vieleck(3, 48, -90, 50, 58) },
  { id: 'raute', name: 'Raute', paket: 'formen', pfad: poly([[50, 4], [86, 50], [50, 96], [14, 50]]) },
  { id: 'sechseck', name: 'Sechseck', paket: 'formen', pfad: vieleck(6, 46, 0) },
  { id: 'achteck', name: 'Achteck', paket: 'formen', pfad: vieleck(8, 46, 22.5) },
  { id: 'pfeil', name: 'Pfeil', paket: 'formen', pfad: poly([[6, 38], [54, 38], [54, 16], [94, 50], [54, 84], [54, 62], [6, 62]]) },
  { id: 'doppelpfeil', name: 'Doppelpfeil', paket: 'formen', pfad: poly([[4, 50], [28, 22], [28, 38], [72, 38], [72, 22], [96, 50], [72, 78], [72, 62], [28, 62], [28, 78]]) },
  { id: 'chevron', name: 'Winkel', paket: 'formen', pfad: poly([[16, 10], [44, 10], [84, 50], [44, 90], [16, 90], [56, 50]]) },
  { id: 'doppelchevron', name: 'Doppelwinkel', paket: 'formen', pfad: poly([[6, 12], [26, 12], [60, 50], [26, 88], [6, 88], [40, 50]]) + poly([[40, 12], [60, 12], [94, 50], [60, 88], [40, 88], [74, 50]]) },
  { id: 'halbkreis', name: 'Halbkreis', paket: 'formen', pfad: 'M6 68A44 44 0 0 1 94 68Z' },
  { id: 'tropfen', name: 'Tropfen', paket: 'formen', pfad: 'M50 4C62 26 82 44 82 62A32 32 0 0 1 18 62C18 44 38 26 50 4Z' },
  { id: 'plus', name: 'Plus', paket: 'formen', pfad: poly([[38, 8], [62, 8], [62, 38], [92, 38], [92, 62], [62, 62], [62, 92], [38, 92], [38, 62], [8, 62], [8, 38], [38, 38]]) },
  { id: 'schild', name: 'Schild', paket: 'formen', pfad: 'M50 4L88 16V48C88 72 70 88 50 96C30 88 12 72 12 48V16Z' },

  // --- Sterne & Blitze ---
  { id: 'stern5', name: 'Stern', paket: 'sterne', pfad: stern(5, 48, 20) },
  { id: 'stern5_ring', name: 'Stern im Ring', paket: 'sterne', pfad: kreis(50, 50, 47) + kreis(50, 50, 38) + stern(5, 32, 13), regel: 'evenodd' },
  { id: 'stern4', name: 'Funkeln', paket: 'sterne', pfad: stern(4, 48, 11) },
  { id: 'stern6', name: 'Sechsstern', paket: 'sterne', pfad: stern(6, 48, 24) },
  { id: 'stern8', name: 'Sonnenstern', paket: 'sterne', pfad: stern(8, 48, 21, -67.5) },
  { id: 'stern_duo', name: 'Sternpaar', paket: 'sterne', pfad: stern(5, 32, 13, -90, 34, 40) + stern(5, 20, 8, -90, 72, 70) },
  { id: 'blitz1', name: 'Blitz', paket: 'sterne', pfad: poly([[58, 4], [20, 56], [46, 56], [38, 96], [80, 40], [54, 40]]) },
  { id: 'blitz2', name: 'Breiter Blitz', paket: 'sterne', pfad: poly([[66, 6], [14, 46], [40, 50], [24, 94], [86, 48], [58, 44]]) },
  { id: 'blitz3', name: 'Schmaler Blitz', paket: 'sterne', pfad: poly([[56, 2], [32, 54], [48, 52], [42, 98], [68, 42], [52, 44]]) },
  { id: 'doppelblitz', name: 'Doppelblitz', paket: 'sterne', pfad: poly([[38, 6], [12, 52], [30, 52], [24, 94], [52, 42], [34, 42]]) + poly([[74, 6], [48, 52], [66, 52], [60, 94], [88, 42], [70, 42]]) },
  { id: 'komet', name: 'Komet', paket: 'sterne', pfad: kreis(70, 68, 22) + poly([[52, 54], [6, 8], [58, 46]]) + poly([[49, 66], [14, 40], [54, 56]]) + poly([[62, 47], [46, 6], [70, 44]]) },

  // --- Flammen ---
  { id: 'flamme', name: 'Flamme', paket: 'flammen', pfad: FLAMME },
  { id: 'flamme_doppel', name: 'Hohle Flamme', paket: 'flammen', pfad: FLAMME + 'M50 88C38 88 32 78 35 68C38 60 45 56 47 48C55 54 60 62 63 70C65 80 60 88 50 88Z', regel: 'evenodd' },
  { id: 'flammenzunge', name: 'Flammenzunge', paket: 'flammen', pfad: 'M4 50C20 30 40 28 60 18C56 28 58 32 66 34C76 36 88 34 98 26C92 42 84 50 72 54C84 56 90 62 96 72C80 70 66 68 54 70C36 74 18 70 4 50Z' },
  { id: 'flammenband', name: 'Flammenband', paket: 'flammen', pfad: 'M2 64C12 64 14 46 28 40C26 50 32 54 38 50C46 44 46 32 58 24C56 36 62 42 70 38C78 34 84 28 98 26C92 40 88 52 78 60C70 66 62 68 52 68L2 74Z' },
  { id: 'feuerball', name: 'Feuerball', paket: 'flammen', pfad: 'M78 62A26 26 0 1 1 46 30C52 24 56 14 66 6C64 16 68 20 76 14C74 24 80 28 92 26C84 36 84 40 90 46C84 48 80 52 78 62Z' },
  { id: 'flammenseite', name: 'Seitenflamme', paket: 'flammen', pfad: 'M2 78V58C20 56 30 48 42 30C44 42 48 46 56 44C66 40 72 30 86 22C84 34 88 40 98 44C88 48 84 58 72 64C56 72 30 78 2 78Z' },

  // --- Streifen ---
  { id: 'band', name: 'Band', paket: 'streifen', pfad: rechteck(2, 40, 96, 20) },
  { id: 'band_schraeg', name: 'Schrägband', paket: 'streifen', pfad: poly([[2, 66], [62, 28], [98, 28], [38, 66]]) },
  { id: 'band_doppel', name: 'Doppelband', paket: 'streifen', pfad: rechteck(2, 30, 96, 14) + rechteck(2, 56, 96, 14) },
  { id: 'band_dreifach', name: 'Dreifachband', paket: 'streifen', pfad: rechteck(2, 26, 96, 12) + rechteck(2, 44, 96, 12) + rechteck(2, 62, 96, 12) },
  { id: 'tempolinien', name: 'Tempolinien', paket: 'streifen', pfad: poly([[2, 28], [98, 34], [2, 40]]) + poly([[14, 44], [98, 50], [14, 56]]) + poly([[2, 60], [98, 66], [2, 72]]) },
  { id: 'zacken', name: 'Zackenband', paket: 'streifen', pfad: poly([[2, 60], [20, 34], [36, 60], [52, 34], [68, 60], [84, 34], [98, 54], [98, 72], [84, 52], [68, 78], [52, 52], [36, 78], [20, 52], [2, 78]]) },
  { id: 'wellenband', name: 'Wellenband', paket: 'streifen', pfad: 'M2 56C18 34 34 34 50 50C66 66 82 66 98 44V60C82 82 66 82 50 66C34 50 18 50 2 72Z' },
  { id: 'karoband', name: 'Karoband', paket: 'streifen', pfad: karo(2, 36, 12, 4, 8) },

  // --- Zahlen & Buchstaben (Grundausstattung) ---
  ...Object.entries(ZIFFERN).map(([z, seg]) => ({ id: 'ziffer_' + z, name: 'Ziffer ' + z, paket: 'zahlen', pfad: zeichen(seg) })),
  ...Object.entries(BUCHSTABEN).map(([b, seg]) => ({ id: 'buchstabe_' + b, name: 'Buchstabe ' + b.toUpperCase(), paket: 'zahlen', pfad: zeichen(seg) })),

  // --- Flaggen-Muster (keine echten Landesflaggen) ---
  { id: 'zielflagge', name: 'Zielflagge', paket: 'flaggen', pfad: karo(10, 20, 8, 6, 10) },
  { id: 'karo_quadrat', name: 'Karofeld', paket: 'flaggen', pfad: karo(14, 14, 4, 4, 18) },
  { id: 'flagge_wehend', name: 'Wehende Flagge', paket: 'flaggen', pfad: rechteck(10, 8, 6, 86) + 'M16 12C34 2 50 22 68 14C76 10 84 10 90 14V58C76 50 66 62 50 62C38 62 28 50 16 58Z' },
  { id: 'drei_balken', name: 'Drei Balken', paket: 'flaggen', pfad: rechteck(8, 14, 84, 18) + rechteck(8, 41, 84, 18) + rechteck(8, 68, 84, 18) },
  { id: 'diagonalkreuz', name: 'Diagonalkreuz', paket: 'flaggen', pfad: poly([[8, 8], [24, 8], [92, 76], [92, 92], [76, 92], [8, 24]]) + poly([[76, 8], [92, 8], [92, 24], [24, 92], [8, 92], [8, 76]]) },
  { id: 'wimpel', name: 'Wimpel', paket: 'flaggen', pfad: poly([[10, 18], [92, 50], [10, 82]]) },
  { id: 'startlampen', name: 'Startlampen', paket: 'flaggen', pfad: kreis(14, 50, 11) + kreis(32, 50, 11) + kreis(50, 50, 11) + kreis(68, 50, 11) + kreis(86, 50, 11) },

  // --- Symbole ---
  { id: 'zahnrad', name: 'Zahnrad', paket: 'symbole', pfad: zahnrad(10, 47, 36) + kreis(50, 50, 16), regel: 'evenodd' },
  { id: 'kolben', name: 'Kolben', paket: 'symbole', pfad: rechteck(22, 6, 56, 14) + rechteck(22, 24, 56, 7) + rechteck(22, 35, 56, 16) + poly([[42, 55], [58, 55], [64, 80], [36, 80]]) + kreis(50, 86, 10) },
  { id: 'reifen', name: 'Reifen', paket: 'symbole', pfad: zahnrad(18, 48, 41) + kreis(50, 50, 26) + kreis(50, 50, 10), regel: 'evenodd' },
  { id: 'krone', name: 'Krone', paket: 'symbole', pfad: poly([[8, 28], [30, 50], [50, 14], [70, 50], [92, 28], [84, 78], [16, 78]]) + rechteck(16, 82, 68, 8) },
  { id: 'fluegel', name: 'Flügel', paket: 'symbole', pfad: 'M50 38C36 24 18 22 2 26C8 30 12 34 14 38C10 38 8 40 6 42C12 44 16 46 20 50C16 52 14 54 14 56C22 56 28 60 34 66C40 62 46 56 50 50C54 56 60 62 66 66C72 60 78 56 86 56C86 54 84 52 80 50C84 46 88 44 94 42C92 40 90 38 86 38C88 34 92 30 98 26C82 22 64 24 50 38Z' },
  { id: 'herz', name: 'Herz', paket: 'symbole', pfad: 'M50 90C22 66 6 50 6 32A22 22 0 0 1 50 24A22 22 0 0 1 94 32C94 50 78 66 50 90Z' },
  { id: 'pik', name: 'Pik', paket: 'symbole', pfad: 'M50 6C72 30 92 44 92 62A20 20 0 0 1 56 74C57 82 60 88 66 94H34C40 88 43 82 44 74A20 20 0 0 1 8 62C8 44 28 30 50 6Z' },
  { id: 'schaedel', name: 'Schädel', paket: 'symbole', pfad: 'M50 6C26 6 12 24 12 44C12 58 20 66 28 70V84H40V74H46V84H54V74H60V84H72V70C80 66 88 58 88 44C88 24 74 6 50 6Z' + kreis(34, 46, 10) + kreis(66, 46, 10) + poly([[50, 56], [56, 66], [44, 66]]), regel: 'evenodd' },
  { id: 'lenkrad', name: 'Lenkrad', paket: 'symbole', pfad: kreis(50, 50, 46) + kreis(50, 50, 36) + poly([[14, 44], [38, 44], [44, 38], [56, 38], [62, 44], [86, 44], [86, 54], [62, 54], [56, 66], [56, 86], [44, 86], [44, 66], [38, 54], [14, 54]]), regel: 'evenodd' },
  { id: 'turbolader', name: 'Turbolader', paket: 'symbole', pfad: kreis(50, 50, 46) + kreis(50, 50, 38) + [0, 60, 120, 180, 240, 300].map((w) => { const a = (w * Math.PI) / 180, b = ((w + 42) * Math.PI) / 180, c = ((w - 20) * Math.PI) / 180; return poly([[50 + 9 * Math.cos(c), 50 + 9 * Math.sin(c)], [50 + 35 * Math.cos(a), 50 + 35 * Math.sin(a)], [50 + 30 * Math.cos(b), 50 + 30 * Math.sin(b)], [50 + 9 * Math.cos(a + 0.7), 50 + 9 * Math.sin(a + 0.7)]]); }).join(''), regel: 'evenodd' },
  { id: 'auge', name: 'Auge', paket: 'symbole', pfad: 'M2 50C20 20 80 20 98 50C80 80 20 80 2 50Z' + kreis(50, 50, 20) + kreis(50, 50, 8), regel: 'evenodd' },
  { id: 'schraube', name: 'Schraubenkopf', paket: 'symbole', pfad: vieleck(6, 46, 0) + kreis(50, 50, 24) + rechteck(44, 30, 12, 40), regel: 'evenodd' },

  // --- Erfundene „Sponsoren“ (Symbol plus Schriftzug) ---
  { id: 'sp_gripfuchs', name: 'Gripfuchs', paket: 'sponsoren', pfad: poly([[34, 10], [50, 26], [66, 10], [66, 40], [50, 56], [34, 40]]), text: { wort: 'GRIPFUCHS', schrift: 'russo', groesse: 17, y: 78 } },
  { id: 'sp_kolbenkraft', name: 'Kolbenkraft', paket: 'sponsoren', pfad: rechteck(34, 12, 32, 9) + rechteck(34, 25, 32, 13) + poly([[44, 41], [56, 41], [60, 56], [40, 56]]), text: { wort: 'KOLBENKRAFT', schrift: 'orbitron', groesse: 13, y: 76 } },
  { id: 'sp_neonwerk', name: 'Neonwerk', paket: 'sponsoren', pfad: poly([[58, 6], [36, 36], [50, 36], [42, 60], [66, 28], [52, 28]]), text: { wort: 'NEONWERK', schrift: 'audiowide', groesse: 17, y: 80 } },
  { id: 'sp_turboloewe', name: 'Turbolöwe', paket: 'sponsoren', pfad: zahnrad(9, 26, 19, 50, 32) + kreis(50, 32, 8), regel: 'evenodd', text: { wort: 'TURBOLÖWE', schrift: 'bungee', groesse: 14, y: 78 } },
  { id: 'sp_schmierfink', name: 'Schmierfink Öl', paket: 'sponsoren', pfad: 'M50 6C56 18 68 28 68 40A18 18 0 0 1 32 40C32 28 44 18 50 6Z', text: { wort: 'SCHMIERFINK', schrift: 'teko', groesse: 24, y: 80 } },
  { id: 'sp_zuendkerle', name: 'Zündkerle', paket: 'sponsoren', pfad: rechteck(46, 6, 8, 12) + vieleck(6, 11, 0, 50, 28) + rechteck(44, 40, 12, 14), text: { wort: 'ZÜNDKERLE', schrift: 'lilita', groesse: 19, y: 78 } },
  { id: 'sp_querstrom', name: 'Querstrom', paket: 'sponsoren', pfad: poly([[10, 42], [40, 18], [40, 32], [90, 32], [60, 56], [60, 42]]), text: { wort: 'QUERSTROM', schrift: 'russo', groesse: 16, y: 78 } },
  { id: 'sp_rauchzeichen', name: 'Rauchzeichen', paket: 'sponsoren', pfad: kreis(36, 40, 13) + kreis(52, 28, 16) + kreis(68, 42, 12) + rechteck(30, 44, 44, 9), text: { wort: 'RAUCHZEICHEN', schrift: 'orbitron', groesse: 12, y: 76 } }
];

export const AUFKLEBER_IDS = new Set(AUFKLEBER.map((a) => a.id));
const NACH_ID = new Map(AUFKLEBER.map((a) => [a.id, a]));

export function aufkleberDaten(id) {
  return NACH_ID.get(id) || null;
}

/** Kauf-ID des Pakets, das einen Aufkleber freischaltet ('text' = Text-Aufkleber). */
export function aufkleberKaufId(id) {
  if (id === 'text') return 'aufkleber:text';
  const a = NACH_ID.get(id);
  return a ? 'aufkleber:' + a.paket : null;
}
