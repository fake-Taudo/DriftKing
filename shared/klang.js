// Klangrechnung ohne WebAudio: Aus Drehzahl, Last und Schlupf entstehen Frequenzen und Pegel. Getrennt von der
// Tonerzeugung, damit sich das Verhalten testen lässt (tests/audio.test.js).

const klemme = (x, a, b) => Math.min(b, Math.max(a, x));

export const MOTOR = {
  pegelLeerlauf: 0.1, // Pegel ohne Gas im Leerlauf
  pegelLast: 0.34, // zusätzlich bei Vollgas
  pegelDrehzahl: 0.14, // zusätzlich bei Höchstdrehzahl
  filterDrehzahl: 2.6, // Faktor auf filterBasis bei Höchstdrehzahl
  filterLast: 0.9 // Faktor auf filterBasis bei Vollgas
};

/**
 * Motorklang eines Autos.
 * @param {{zylinder:number, grundton:number, rauheit:number, obertoene:number[], filterBasis:number}} k Klangdaten
 * @param {number} drehzahl U/min
 * @param {number} drehzahlMax U/min
 * @param {number} last 0..1 (Gas)
 * @returns {{grundFrequenz:number, frequenzen:number[], pegel:number[], gesamt:number, filter:number, rauheit:number}}
 */
export function motorKlang(k, drehzahl, drehzahlMax, last) {
  const anteil = klemme(drehzahl / drehzahlMax, 0, 1.1);
  const l = klemme(last, 0, 1);
  // Zündfrequenz eines Viertakters: Umdrehungen pro Sekunde mal halbe Zylinderzahl
  const grundFrequenz = (Math.max(300, drehzahl) / 60) * (k.zylinder / 2) * k.grundton;
  const gesamt = MOTOR.pegelLeerlauf + MOTOR.pegelLast * l + MOTOR.pegelDrehzahl * anteil;
  const frequenzen = k.obertoene.map((_, i) => grundFrequenz * (i + 1));
  // Bei Last treten die Obertöne stärker hervor, ohne Gas klingt der Motor weicher
  const pegel = k.obertoene.map((o, i) => o * (i === 0 ? 1 : 0.55 + 0.45 * l));
  const filter = k.filterBasis * (1 + MOTOR.filterDrehzahl * anteil + MOTOR.filterLast * l);
  const rauheit = k.rauheit * (0.25 + 0.75 * l) * (0.5 + 0.5 * anteil);
  return { grundFrequenz, frequenzen, pegel, gesamt, filter, rauheit };
}

/**
 * Reifenquietschen aus dem Schlupf.
 * @param {number} schlupf normierter Schlupf (1 = Haftgrenze)
 * @param {number} durchdrehen 0..1
 * @param {number} tempo m/s
 * @returns {{pegel:number, frequenz:number}}
 */
export function reifenKlang(schlupf, durchdrehen, tempo) {
  const ueber = Math.max(0, schlupf - 0.92) + durchdrehen * 0.45;
  const anTempo = klemme(tempo / 8, 0.15, 1);
  const pegel = klemme(ueber * 0.85, 0, 1) * anTempo * 0.34;
  const frequenz = 720 + klemme(ueber, 0, 1.4) * 760 + klemme(tempo / 40, 0, 1) * 320;
  return { pegel, frequenz };
}

/** Pfeifen des Turbos aus dem Ladedruck. */
export function turboKlang(ladedruck, drehzahlAnteil) {
  const l = klemme(ladedruck, 0, 1);
  return { pegel: l * l * 0.05, frequenz: 1800 + l * 3200 + klemme(drehzahlAnteil, 0, 1) * 900 };
}

/** Lautstärke eines anderen Autos nach Abstand. */
export function abstandsPegel(meter) {
  return klemme(1 - meter / 70, 0, 1) ** 2;
}
