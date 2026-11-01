// Übersetzt Auto-Grunddaten + Tuningstufen + Setup-Regler + Optik (Look) in die effektiven
// Parameter der Fahrphysik. Alle Wirkungen sind klein, nachvollziehbar und in docs/AUTOS.md erklärt.
import { autoDaten } from './autos.js';
import { PHYSIK } from './physikParameter.js';
import { TUNING, OPTIK_WIRKUNG, SETUP_REGLER } from './teile.js';
import { leistungsFaktorFuerPI } from './leistungsindex.js';

const PS_ZU_WATT = 735.5;

function stufe(tuning, id) {
  const s = tuning && tuning[id];
  return Number.isInteger(s) && s >= 1 && s <= 5 ? s : 1;
}
function tuningWert(id, feld, s) {
  const t = TUNING.find((x) => x.id === id);
  return t.werte[feld][s - 1];
}
function setupWert(setup, id) {
  const r = SETUP_REGLER.find((x) => x.id === id);
  const v = setup && setup.werte ? setup.werte[id] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(r.max, Math.max(r.min, v)) : r.standard;
}

/**
 * Berechnet die effektiven Fahrzeugparameter.
 * @param {string} autoId
 * @param {{tuning?: object, setup?: object, look?: object, einheitsPI?: number}} [o]
 */
export function effektiveParameter(autoId, { tuning, setup, look, einheitsPI } = {}) {
  const a = autoDaten(autoId);
  // Bei Einheits-Leistung: Serien-Tuning, Leistung auf den Norm-PI skaliert
  const tun = einheitsPI ? {} : tuning || {};
  const leistungsFaktorNorm = einheitsPI ? leistungsFaktorFuerPI(autoId, einheitsPI) : 1;

  // --- Leistung ---
  const sMotor = stufe(tun, 'motor');
  const sTurbo = stufe(tun, 'turbo');
  const leistung = a.leistungPS * PS_ZU_WATT * tuningWert('motor', 'leistung', sMotor) * tuningWert('turbo', 'leistung', sTurbo) * leistungsFaktorNorm;
  const turbo = a.turbo
    ? { ...a.turbo, aufbauZeit: a.turbo.aufbauZeit * tuningWert('turbo', 'turboLoch', sTurbo) }
    : null;

  // --- Masse (Gewichtsreduktion + Optikteile) ---
  let masse = a.masse * tuningWert('gewicht', 'masse', stufe(tun, 'gewicht'));
  let luftZuschlag = 0;
  let stabilitaetZuschlag = 0;
  if (look && look.teile) {
    for (const [slot, wirkungen] of Object.entries(OPTIK_WIRKUNG)) {
      const v = look.teile[slot] ? look.teile[slot].variante : 0;
      const w = wirkungen[v] || wirkungen[0];
      if (w.masse) masse += w.masse;
      if (w.luftwiderstand) luftZuschlag += w.luftwiderstand;
      if (w.stabilitaet) stabilitaetZuschlag += w.stabilitaet;
    }
  }

  // --- Setup-Regler (normiert 0..1, 0,5 = neutral) ---
  const sturz = setupWert(setup, 'sturz') - 0.5; // + = mehr Seitenhalt, − = mehr Längsgrip
  const sperrgrad = setupWert(setup, 'sperrgrad') - 0.5;
  const lenk = setupWert(setup, 'lenkwinkel') - 0.5;
  const gaskennlinie = setupWert(setup, 'gaskennlinie') - 0.5;
  const balance = setupWert(setup, 'bremsbalance') - 0.5;
  const feder = setupWert(setup, 'federhaerte') - 0.5;

  // --- Fahrwerk-Optik (Look): Tieferlegung senkt Schwerpunkt, Sturz/Spur wirken minimal ---
  const fw = look && look.fahrwerk ? look.fahrwerk : { tiefe: 0.3, sturzV: -1, sturzH: -1.5, spur: 0.2 };
  const tiefe = fw.tiefe;
  const sturzOptik = (-fw.sturzV - 1) * 0.004 + (-fw.sturzH - 1.5) * 0.002; // etwas mehr Seitenhalt, …
  const sturzLaengsVerlust = Math.max(0, -fw.sturzH - 3) * 0.006; // … aber zu viel Sturz hinten kostet Traktion

  const gripTuning = tuningWert('reifen', 'grip', stufe(tun, 'reifen'));
  const grip = a.grip * gripTuning * (1 + 0.03 * sturz + sturzOptik);
  const gripLaengs = a.grip * gripTuning * (1 - 0.03 * sturz - sturzLaengsVerlust);
  const gleitZuschlag = tuningWert('reifen', 'gleiten', stufe(tun, 'reifen'));
  const gleitAnteil = PHYSIK.reifen.gleitAnteil + gleitZuschlag;
  const gleitAnteilHinten = PHYSIK.reifen.gleitAnteilHinten + gleitZuschlag;

  const sFahrwerk = stufe(tun, 'fahrwerk');
  const stabilitaet = a.stabilitaet * tuningWert('fahrwerk', 'stabilitaet', sFahrwerk) * (1 + stabilitaetZuschlag) * (1 + 0.06 * feder);
  const wankFaktor = tuningWert('fahrwerk', 'wanken', sFahrwerk) * (1 - 0.25 * feder);

  const sperre = Math.min(1, Math.max(0.2, a.sperre + tuningWert('sperre', 'sperre', stufe(tun, 'sperre')) + 0.4 * sperrgrad));
  const sBremse = stufe(tun, 'bremse');

  return {
    id: a.id,
    name: a.name,
    masse,
    radstand: a.radstand,
    spurweite: a.spurweite + fw.spur * 0.08,
    schwerpunktHoehe: Math.max(0.3, a.schwerpunktHoehe - tiefe * 0.05),
    gewichtVorne: a.gewichtVorne,
    traegheitFaktor: a.traegheitFaktor,
    abmessungen: a.abmessungen,
    antrieb: a.antrieb,
    allradVorneAnteil: a.allradVorneAnteil,
    leistungWatt: leistung,
    leistungWattSerie: a.leistungPS * PS_ZU_WATT,
    drehmomentKurve: a.drehmomentKurve,
    leerlauf: a.leerlauf,
    drehzahlMax: a.drehzahlMax,
    gaenge: a.gaenge,
    achsUebersetzung: a.achsUebersetzung,
    radRadius: a.radRadius,
    schaltzeit: a.schaltzeit,
    turbo,
    grip,
    gripLaengs,
    gleitAnteil,
    gleitAnteilHinten,
    bremskraft: a.bremskraft * tuningWert('bremse', 'bremse', sBremse),
    bremsBalance: Math.min(0.78, Math.max(0.45, a.bremsBalance + 0.16 * balance)),
    handbremse: a.handbremse * tuningWert('bremse', 'handbremse', sBremse),
    sperre,
    wankVorne: Math.min(0.7, Math.max(0.4, a.wankVorne + 0.06 * feder)),
    wankFaktor,
    lenkwinkelMax: a.lenkwinkelMax + 14 * lenk,
    gasExponent: Math.pow(2, -gaskennlinie * 1.6), // 0 → 1,74 (sanft), 1 → 0,57 (direkt)
    stabilitaet,
    gierDaempfung: a.gierDaempfung,
    hoechstKmhAuslegung: a.soll.hoechstKmh,
    luftZuschlag,
    klang: a.klang
  };
}
