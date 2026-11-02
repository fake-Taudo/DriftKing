// Ökonomie: Buchungen (atomar, ohne Doppelbuchung), Belohnungen und Freischaltungen.
// Alle Funktionen arbeiten auf dem Spielstand-Objekt und ändern Guthaben und Besitz gemeinsam.
// Begründung der Werte: docs/OEKONOMIE.md.
import { BOT_STUFEN, MEDAILLEN, MAX_GUTHABEN } from './spielstand.js';

/** Belohnungen Bot-Battle (Best of 3); „Schnell“ zahlt die Hälfte. */
export const BATTLE_BELOHNUNG = {
  anfaenger: { sieg: 300, niederlage: 50 },
  fahrer: { sieg: 500, niederlage: 70 },
  profi: { sieg: 800, niederlage: 90 },
  meister: { sieg: 1100, niederlage: 120 },
  legende: { sieg: 1500, niederlage: 150 }
};
export const PERFEKT_BONUS = 100; // je perfektem Durchgang (Führer > 90, kein Wandkontakt)
export const PERFEKT_SCHWELLE = 90;
export const STRECKEN_FREISCHALTUNG = { kuestenpass: { nach: 'industriehof', siege: 3 }, neonhafen: { nach: 'kuestenpass', siege: 3 } };
export const MAX_BUCHUNGEN = 200;

/**
 * Bucht einen Betrag (positiv = Gutschrift, negativ = Ausgabe) atomar und höchstens einmal je ID.
 * @returns {{ok: boolean, grund?: string, guthaben: number}}
 */
export function buchen(daten, { betrag, id, art = 'sonstiges' }) {
  if (!Number.isInteger(betrag)) return { ok: false, grund: 'betrag', guthaben: daten.waehrung };
  if (id && daten.buchungen.includes(id)) return { ok: false, grund: 'doppelt', guthaben: daten.waehrung };
  const neu = daten.waehrung + betrag;
  if (neu < 0) return { ok: false, grund: 'guthaben', guthaben: daten.waehrung };
  daten.waehrung = Math.min(MAX_GUTHABEN, neu);
  if (betrag > 0) daten.statistik.muenzenVerdient += betrag;
  else daten.statistik.muenzenAusgegeben += -betrag;
  if (id) {
    daten.buchungen.push(id);
    if (daten.buchungen.length > MAX_BUCHUNGEN) daten.buchungen.splice(0, daten.buchungen.length - MAX_BUCHUNGEN);
  }
  void art;
  return { ok: true, guthaben: daten.waehrung };
}

/**
 * Wertet ein beendetes Bot-Battle aus: Belohnung, Erstsieg-Bonus, Perfekt-Boni, Statistik,
 * Freischaltungen (Strecken, Bot-Stufen). Doppelte Auswertung (gleiche battleId) wird abgelehnt.
 * @param {object} daten Spielstand
 * @param {{battleId:string, streckeId:string, stufe:string, format:'schnell'|'bo3', sieg:boolean, perfekt:number}} b
 * @returns {{ok:boolean, belohnung:number, posten:Array<{text:string, betrag:number}>, freischaltungen:Array<{art:string, id:string}>}}
 */
export function battleAbschliessen(daten, { battleId, streckeId, stufe, format, sieg, perfekt = 0 }) {
  const leer = { ok: false, belohnung: 0, posten: [], freischaltungen: [] };
  if (daten.buchungen.includes('battle:' + battleId)) return leer;
  const tabelle = BATTLE_BELOHNUNG[stufe];
  if (!tabelle) return leer;
  const faktor = format === 'schnell' ? 0.5 : 1;
  const posten = [];
  const f = daten.fortschritt;
  let basis = Math.round((sieg ? tabelle.sieg : tabelle.niederlage) * faktor);
  posten.push({ text: sieg ? 'sieg' : 'niederlage', betrag: basis });
  const erstKey = `${streckeId}:${stufe}`;
  if (sieg && !f.erstSiege[erstKey]) {
    posten.push({ text: 'erstsieg', betrag: basis });
    f.erstSiege[erstKey] = true;
  }
  if (perfekt > 0) posten.push({ text: 'perfekt', betrag: Math.round(PERFEKT_BONUS * faktor * perfekt) });
  const belohnung = posten.reduce((s, p) => s + p.betrag, 0);
  buchen(daten, { betrag: belohnung, id: 'battle:' + battleId, art: 'battle' });

  // Statistik und Fortschritt
  daten.statistik.battles++;
  if (sieg) daten.statistik.siege++;
  else daten.statistik.niederlagen++;
  const freischaltungen = [];
  if (sieg) {
    f.siegeStrecke[streckeId] = (f.siegeStrecke[streckeId] || 0) + 1;
    f.siegeStufe[stufe] = (f.siegeStufe[stufe] || 0) + 1;
    for (const [ziel, regel] of Object.entries(STRECKEN_FREISCHALTUNG)) {
      if (!f.strecken.includes(ziel) && f.strecken.includes(regel.nach) && (f.siegeStrecke[regel.nach] || 0) >= regel.siege) {
        f.strecken.push(ziel);
        freischaltungen.push({ art: 'strecke', id: ziel });
      }
    }
    const i = BOT_STUFEN.indexOf(stufe);
    const naechste = BOT_STUFEN[i + 1];
    if (naechste && !f.botStufen.includes(naechste)) {
      f.botStufen.push(naechste);
      freischaltungen.push({ art: 'stufe', id: naechste });
    }
  }
  return { ok: true, belohnung, posten, freischaltungen };
}

// ---------------------------------------------------------------------------
// Zeitangriff und Freies Fahren

/** Medaillen-Grenzen (durchschnittliche normierte Rundenpunktzahl) und Erst-Belohnungen. */
export const MEDAILLEN_GRENZEN = { bronze: 40, silber: 60, gold: 80, champion: 95 };
export const ZEITANGRIFF_BELOHNUNG = { bronze: 150, silber: 300, gold: 600, champion: 1000 };
export const ZEITANGRIFF_WIEDERHOLUNG = 0.25;
/** Trainings-Bonus: 50 + Punkte (max. 150), nur bei neuem Bestwert mit mindestens 5 Punkten Vorsprung. */
export const TRAINING_BONUS = { min: 50, max: 150, mindestPunkte: 20, mindestVorsprung: 5 };

/** Höchste erreichte Medaille für eine Durchschnittspunktzahl (oder null). */
export function medailleFuer(punkte) {
  let m = null;
  for (const id of MEDAILLEN) if (punkte >= MEDAILLEN_GRENZEN[id]) m = id;
  return m;
}

const runde1 = (x) => Math.round(x * 10) / 10;

/**
 * Wertet einen beendeten Zeitangriff aus: Bestwert, Medaille, Belohnung.
 * Jede Medaille zahlt je Strecke einmal den vollen Betrag; wer direkt eine höhere Medaille holt,
 * bekommt die übersprungenen niedrigeren mit (Gesamtsumme unabhängig vom Weg). Ist keine Medaille
 * neu, zahlt die erreichte Medaille 25 %.
 * @returns {{ok:boolean, medaille:string|null, belohnung:number, posten:Array<{text:string, medaille:string, betrag:number}>, neuerBestwert:boolean}}
 */
export function zeitangriffAbschliessen(daten, { laufId, streckeId, punkte }) {
  const f = daten.fortschritt;
  if (daten.buchungen.includes('za:' + laufId)) return { ok: false, medaille: null, belohnung: 0, posten: [], neuerBestwert: false };
  const best = (f.bestwerte[streckeId] ||= {});
  const neuerBestwert = best.zeitangriff === undefined || best.zeitangriff === null || punkte > best.zeitangriff;
  if (neuerBestwert) best.zeitangriff = runde1(punkte);
  const medaille = medailleFuer(punkte);
  const posten = [];
  if (medaille) {
    const bis = MEDAILLEN.indexOf(medaille);
    for (let i = 0; i <= bis; i++) {
      const m = MEDAILLEN[i];
      const key = `${streckeId}:${m}`;
      if (!f.medaillenErhalten[key]) {
        f.medaillenErhalten[key] = true;
        posten.push({ text: 'medailleNeu', medaille: m, betrag: ZEITANGRIFF_BELOHNUNG[m] });
      }
    }
    if (!posten.length) posten.push({ text: 'medailleWieder', medaille, betrag: Math.round(ZEITANGRIFF_BELOHNUNG[medaille] * ZEITANGRIFF_WIEDERHOLUNG) });
    const bisher = f.medaillen[streckeId];
    if (!bisher || MEDAILLEN.indexOf(medaille) > MEDAILLEN.indexOf(bisher)) f.medaillen[streckeId] = medaille;
  }
  const belohnung = posten.reduce((s, p) => s + p.betrag, 0);
  buchen(daten, { betrag: belohnung, id: 'za:' + laufId, art: 'zeitangriff' });
  return { ok: true, medaille, belohnung, posten, neuerBestwert };
}

/**
 * Freies Fahren: Rundenpunkte als persönlichen Bestwert eintragen; kleiner Bonus (50–150) nur,
 * wenn der zuletzt belohnte Bestwert um mindestens 5 Punkte übertroffen wird (kein Farmen in 0,1er-Schritten).
 * @returns {{ok:boolean, neuerBestwert:boolean, bonus:number}}
 */
export function trainingRundeAbschliessen(daten, { laufId, streckeId, punkte }) {
  if (daten.buchungen.includes('tr:' + laufId)) return { ok: false, neuerBestwert: false, bonus: 0 };
  const best = (daten.fortschritt.bestwerte[streckeId] ||= {});
  const neuerBestwert = punkte > 0 && (best.training === undefined || best.training === null || punkte > best.training);
  if (neuerBestwert) best.training = runde1(punkte);
  const B = TRAINING_BONUS;
  const basis = best.trainingBelohnt ?? null;
  let bonus = 0;
  if (punkte >= B.mindestPunkte && (basis === null || punkte >= basis + B.mindestVorsprung)) {
    bonus = Math.max(B.min, Math.min(B.max, Math.round(B.min + punkte)));
    best.trainingBelohnt = runde1(punkte);
    buchen(daten, { betrag: bonus, id: 'tr:' + laufId, art: 'training' });
  }
  return { ok: true, neuerBestwert, bonus };
}

/**
 * Bucht Fahrstatistik aus einer Wertungs-Aufschlüsselung (Punkte, Wandkontakte, Rekorde).
 * @param {object} daten Spielstand
 * @param {{punkte?:number, wand?:number, laengsterDrift?:number, besterWinkel?:number}} a
 */
export function statistikVerbuchen(daten, a) {
  const s = daten.statistik;
  s.punkteGesamt = Math.min(1e9, s.punkteGesamt + Math.max(0, Math.round(a.punkte || 0)));
  s.wandkontakte = Math.min(1e9, s.wandkontakte + (a.wand || 0));
  s.laengsterDrift = Math.max(s.laengsterDrift, runde1(a.laengsterDrift || 0));
  s.besterWinkel = Math.max(s.besterWinkel, Math.round(a.besterWinkel || 0));
}
