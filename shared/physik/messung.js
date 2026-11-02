// Messgrößen der Fahrphysik (für Tests, Tuning und docs/AUTOS.md):
// 0–100 km/h, Höchstgeschwindigkeit, Wendekreis, maximaler stationärer Driftwinkel bei
// Halte-Kreisfahrt, Bremsweg aus 100 km/h, Driftstabilität.
import { Fahrzeug } from './fahrzeug.js';
import { effektiveParameter } from '../tuning.js';
import { PHYSIK } from '../physikParameter.js';
import { GRAD, klemme } from '../mathe.js';

const DT = PHYSIK.dt;

function neuesAuto(autoId, optionen = {}, assistenz = {}) {
  const f = new Fahrzeug(effektiveParameter(autoId, optionen), { gegenlenken: 0, driftHalten: 0, getriebe: 'auto', ...assistenz });
  f.setzen(0, 0, 0, 0);
  return f;
}

const E = (o = {}) => ({ lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0, ...o });

/**
 * Zeit von 0 auf 100 km/h (s) mit optimalem Start: Gas wird so dosiert, dass die Hinterräder
 * nahe am Haftmaximum bleiben (wie ein geübter Fahrer bzw. eine Messfahrt).
 */
export function nullAufHundert(autoId, optionen) {
  const f = neuesAuto(autoId, optionen);
  let gas = 1;
  for (let t = 0; t < 40; t += DT) {
    const schlupf = f.z.durchdrehen;
    gas = klemme(gas + (schlupf > 0.14 ? -4 : 3) * DT, 0.25, 1);
    f.schritt(E({ gas }), DT);
    if (f.z.vx >= 100 / 3.6) return t + DT;
  }
  return Infinity;
}

/** Höchstgeschwindigkeit (km/h) nach 120 s Vollgas geradeaus. */
export function hoechstgeschwindigkeit(autoId, optionen) {
  const f = neuesAuto(autoId, optionen);
  let max = 0;
  for (let t = 0; t < 120; t += DT) {
    f.schritt(E({ gas: 1 }), DT);
    max = Math.max(max, f.z.vx);
  }
  return max * 3.6;
}

/** Wendekreis-Durchmesser (m) bei Volleinschlag und ca. 12 km/h. */
export function wendekreis(autoId, optionen) {
  const f = neuesAuto(autoId, optionen);
  const ziel = 12 / 3.6;
  const werte = [];
  for (let t = 0; t < 14; t += DT) {
    const gas = klemme((ziel - f.z.vx) * 0.8, 0, 1);
    const bremse = klemme((f.z.vx - ziel) * 0.5, 0, 1);
    f.schritt(E({ gas, bremse, lenken: t > 2 ? -1 : 0 }), DT);
    if (t > 8 && Math.abs(f.z.r) > 1e-3) werte.push((2 * Math.hypot(f.z.vx, f.z.vy)) / Math.abs(f.z.r));
  }
  return werte.reduce((a, b) => a + b, 0) / werte.length;
}

/** Bremsweg aus 100 km/h bis zum Stillstand (m). */
export function bremsweg(autoId, optionen) {
  const f = neuesAuto(autoId, optionen);
  f.setzen(0, 0, 0, 100 / 3.6);
  for (let t = 0; t < 20; t += DT) {
    f.schritt(E({ bremse: 1 }), DT);
    if (f.z.vx < 0.05) return f.z.x;
  }
  return Infinity;
}

/**
 * Leitet einen Drift per Handbremse ein und hält ihn mit konstanter Gas- und Lenkeingabe.
 * Liefert den Verlauf des Driftwinkels.
 */
function driftVersuch(autoId, { gas, lenken, dauer = 10, assistenz = 0, optionen } = {}) {
  const f = neuesAuto(autoId, optionen, { gegenlenken: assistenz });
  f.setzen(0, 0, 0, 55 / 3.6);
  const winkel = [];
  let ausgebrochen = null;
  for (let t = 0; t < dauer + 1.2; t += DT) {
    let e;
    if (t < 0.45) e = E({ lenken: -1, gas: 0.4, handbremse: 1 });
    else if (t < 1.2) e = E({ lenken: -0.4, gas });
    else e = E({ lenken, gas });
    f.schritt(e, DT);
    if (t >= 1.2) {
      const w = f.driftWinkel / GRAD;
      winkel.push(w);
      if (ausgebrochen === null && (w > 100 || (w < 10 && t > 1.6) || f.tempo < 3)) ausgebrochen = t - 1.2;
    }
  }
  return { winkel, ausgebrochen };
}

/**
 * Hält per einfachem Regler (Gas steuert den Winkel, Gegenlenken bremst ihn) einen Soll-Driftwinkel
 * auf einer Kreisbahn. Liefert den mittleren Winkel der letzten 4 s oder null bei Ausbrechen.
 */
export function driftHalten(autoId, sollGrad, { optionen, assistenz = 0.6, dauer = 9 } = {}) {
  const f = neuesAuto(autoId, optionen, { gegenlenken: assistenz });
  f.setzen(0, 0, 0, 50 / 3.6);
  let vorher = 0;
  const werte = [];
  for (let t = 0; t < dauer; t += DT) {
    const w = f.driftWinkel / GRAD;
    let e;
    if (t < 0.45) e = E({ lenken: -1, gas: 0.5, handbremse: 1 });
    else {
      const fehler = sollGrad - w;
      const rate = (w - vorher) / DT;
      const gas = klemme(0.62 + 0.025 * fehler - 0.003 * rate, 0, 1);
      const lenken = klemme(-0.07 * fehler + 0.012 * rate, -1, 1);
      e = E({ lenken, gas });
    }
    vorher = w;
    f.schritt(e, DT);
    if (t > 1.5 && (w > 110 || f.tempo < 3)) return null;
    if (t > dauer - 4) werte.push(w);
  }
  const mittel = werte.reduce((a, b) => a + b, 0) / werte.length;
  const streuung = Math.sqrt(werte.reduce((a, b) => a + (b - mittel) ** 2, 0) / werte.length);
  return { mittel, streuung };
}

/**
 * Maximaler stationärer Driftwinkel (Grad) bei Halte-Kreisfahrt. Nach dem Einleiten per Handbremse
 * hält ein PI-Regler (Gas → Winkel, Lenkung über Gegenlenk-Assistenz 85 %) Soll-Winkel von 25° bis 70°.
 * Gewertet wird der größte Winkel, der in den letzten 4 s stabil gehalten wird
 * (Abweichung < 6°, Streuung < 4°, kein Dreher).
 */
export function maxDriftWinkel(autoId, optionen) {
  let best = 0;
  for (let soll = 25; soll <= 70; soll += 5) {
    const f = neuesAuto(autoId, optionen, { gegenlenken: 0.85 });
    f.setzen(0, 0, 0, 60 / 3.6);
    let integ = 0, vorher = 0, ok = true;
    const werte = [];
    for (let t = 0; t < 10; t += DT) {
      const b = -f.schwimmwinkel / GRAD;
      let e;
      if (t < 0.4) e = E({ lenken: -1, gas: 0.5, handbremse: 1 });
      else {
        const fehler = soll - b;
        const rate = (b - vorher) / DT;
        integ = klemme(integ + fehler * DT, -40, 40);
        e = E({ lenken: klemme(-0.08 * fehler + 0.01 * rate, -1, 1), gas: klemme(0.55 + 0.06 * fehler + 0.06 * integ - 0.002 * rate, 0, 1) });
      }
      vorher = b;
      f.schritt(e, DT);
      if (t > 1 && (Math.abs(b) > 110 || f.tempo < 4)) { ok = false; break; }
      if (t > 6) werte.push(b);
    }
    if (!ok) continue;
    const mittel = werte.reduce((x, y) => x + y, 0) / werte.length;
    const streuung = Math.sqrt(werte.reduce((x, y) => x + (y - mittel) ** 2, 0) / werte.length);
    if (Math.abs(mittel - soll) < 6 && streuung < 4) best = Math.max(best, mittel);
  }
  return best;
}

/**
 * Driftstabilität: Zeit (s), die ein per Handbremse eingeleiteter Drift bei konstanter Eingabe
 * (Gas 0,75, Lenkung neutral, Standard-Gegenlenk-Assistenz 60 %) im Bereich 10°–100° bleibt,
 * bevor das Auto ausbricht (Dreher) oder sich gerade stellt. Begrenzung auf 10 s.
 */
export function driftStabilitaet(autoId, optionen) {
  const r = driftVersuch(autoId, { gas: 0.75, lenken: 0, dauer: 10, assistenz: 0.6, optionen });
  return r.ausgebrochen === null ? 10 : r.ausgebrochen;
}

export function alleMessungen(autoId, optionen) {
  return {
    nullHundert: nullAufHundert(autoId, optionen),
    hoechstKmh: hoechstgeschwindigkeit(autoId, optionen),
    wendekreis: wendekreis(autoId, optionen),
    bremsweg: bremsweg(autoId, optionen),
    maxDriftWinkel: maxDriftWinkel(autoId, optionen),
    driftStabilitaet: driftStabilitaet(autoId, optionen)
  };
}
