// Leistungsindex (PI, 100–999). Formel (dokumentiert in docs/AUTOS.md):
//
//   PI_basis = c1 · (kW pro Tonne) + c2 · (Auslegungs-Höchstgeschwindigkeit in km/h)
//            + c3 · (Grip − 1) + Allradbonus + Stabilitätsbonus + Versatz
//   PI       = PI_basis · (1 + Σ g_k · (Stufe_k − 1) / 4)
//
// PI_basis bewertet Leistung, Gewicht, Grip und Stabilität des Serienautos; die Tuningstufen
// erhöhen den Wert prozentual (volles Tuning = +45 %). So bleibt die Rangfolge der Autos
// erhalten und die Wirkung des Tunings ist klar nachvollziehbar.
import { autoDaten } from './autos.js';
import { TUNING_IDS } from './teile.js';

export const PI_KONSTANTEN = {
  c1: 1.236, // je kW/t
  c2: 2.0, // je km/h Auslegungs-Höchstgeschwindigkeit
  c3: 600, // je Grip-Einheit über 1,0
  allradBonus: 25,
  stabilitaetBonus: 20, // je Stabilitäts-Einheit über 1,0
  versatz: -285.8
};

/** Gewicht jeder Tuning-Kategorie am prozentualen Zuschlag (Summe 0,45). */
export const PI_TUNING_GEWICHT = {
  motor: 0.12,
  turbo: 0.06,
  reifen: 0.08,
  fahrwerk: 0.05,
  sperre: 0.04,
  bremse: 0.03,
  gewicht: 0.07
};

/** Basis-PI eines Autos aus seinen Seriendaten (optional mit Leistungsfaktor, z. B. Einheits-Leistung). */
export function basisPI(autoId, leistungsFaktor = 1) {
  const a = autoDaten(autoId);
  const k = PI_KONSTANTEN;
  const kWproT = (a.leistungPS * 0.7355 * leistungsFaktor) / (a.masse / 1000);
  return (
    k.c1 * kWproT +
    k.c2 * a.soll.hoechstKmh +
    k.c3 * (a.grip - 1) +
    (a.antrieb === 'allrad' ? k.allradBonus : 0) +
    k.stabilitaetBonus * (a.stabilitaet - 1) +
    k.versatz
  );
}

/** Prozentualer Zuschlag durch Tuningstufen (0 … 0,45). */
export function tuningZuschlag(tuning) {
  let z = 0;
  for (const id of TUNING_IDS) {
    const stufe = tuning && Number.isInteger(tuning[id]) ? tuning[id] : 1;
    z += PI_TUNING_GEWICHT[id] * (Math.min(5, Math.max(1, stufe)) - 1) / 4;
  }
  return z;
}

/** Leistungsindex eines Autos mit Tuning, begrenzt auf 100–999. */
export function leistungsindex(autoId, tuning, leistungsFaktor = 1) {
  const pi = basisPI(autoId, leistungsFaktor) * (1 + tuningZuschlag(tuning));
  return Math.max(100, Math.min(999, Math.round(pi)));
}

/**
 * Leistungsfaktor, mit dem ein Auto (Serien-Tuning) genau den Ziel-PI erreicht
 * (für „Einheits-Leistung“ im Online-Duell). Ergebnis auf 0,4 … 3 begrenzt.
 */
export function leistungsFaktorFuerPI(autoId, zielPI) {
  const a = autoDaten(autoId);
  const kWproT = (a.leistungPS * 0.7355) / (a.masse / 1000);
  const differenz = zielPI - basisPI(autoId, 1);
  const faktor = (kWproT + differenz / PI_KONSTANTEN.c1) / kWproT;
  return Math.max(0.4, Math.min(3, faktor));
}

/** Klassenbuchstabe für die Anzeige. */
export function piKlasse(pi) {
  if (pi >= 800) return 'X';
  if (pi >= 650) return 'S';
  if (pi >= 500) return 'A';
  if (pi >= 380) return 'B';
  if (pi >= 260) return 'C';
  return 'D';
}
