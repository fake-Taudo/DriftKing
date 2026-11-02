// Tagesaufgaben: 3 Stück pro Tag aus einem Pool, Belohnung 100–400 Driftmünzen, Neustart um Mitternacht
// lokaler Zeit. Die Auswahl ist je Spieler und Datum fest (ändert sich beim Neuladen nicht). Die Geräteuhr
// wird bewusst nicht geprüft (siehe docs/ENTSCHEIDUNGEN.md, E5). Die Texte stehen in client/i18n/de.js.
import { buchen } from './oekonomie.js';
import { fnv1a } from './kodierung.js';
import { Zufall } from './zufall.js';

/**
 * ereignis: welches Spielereignis zählt.
 * art: 'summe' addiert die Werte, 'max' merkt den besten Wert.
 */
export const AUFGABEN_POOL = [
  { id: 'siege2', ereignis: 'battleSieg', art: 'summe', ziel: 2, belohnung: 300 },
  { id: 'battle1', ereignis: 'battleEnde', art: 'summe', ziel: 1, belohnung: 100 },
  { id: 'battles3', ereignis: 'battleEnde', art: 'summe', ziel: 3, belohnung: 250 },
  { id: 'drift50', ereignis: 'driftHoch', art: 'max', ziel: 5, belohnung: 300 },
  { id: 'drift8s', ereignis: 'driftDauer', art: 'max', ziel: 8, belohnung: 200 },
  { id: 'sauber3', ereignis: 'saubereRunde', art: 'summe', ziel: 3, belohnung: 300 },
  { id: 'runden5', ereignis: 'runde', art: 'summe', ziel: 5, belohnung: 100 },
  { id: 'punkte300', ereignis: 'punkte', art: 'summe', ziel: 300, belohnung: 200 },
  { id: 'fuehrer70', ereignis: 'fuehrerPunkte', art: 'max', ziel: 70, belohnung: 250 },
  { id: 'verfolger60', ereignis: 'verfolgerPunkte', art: 'max', ziel: 60, belohnung: 250 },
  { id: 'medaille', ereignis: 'medaille', art: 'summe', ziel: 1, belohnung: 200 },
  { id: 'combo2', ereignis: 'combo', art: 'max', ziel: 2, belohnung: 150 },
  { id: 'fluessig5', ereignis: 'fluessig', art: 'summe', ziel: 5, belohnung: 200 },
  { id: 'fahrzeit10', ereignis: 'fahrzeit', art: 'summe', ziel: 600, belohnung: 150 },
  { id: 'online1', ereignis: 'onlineDuell', art: 'summe', ziel: 1, belohnung: 400 }
];

const NACH_ID = new Map(AUFGABEN_POOL.map((a) => [a.id, a]));
export const AUFGABEN_JE_TAG = 3;

export function aufgabeDaten(id) {
  return NACH_ID.get(id) || null;
}

/** Lokales Datum als JJJJ-MM-TT. */
export function lokalesDatum(jetzt = new Date()) {
  const m = String(jetzt.getMonth() + 1).padStart(2, '0');
  const t = String(jetzt.getDate()).padStart(2, '0');
  return `${jetzt.getFullYear()}-${m}-${t}`;
}

/** Stellt die Aufgaben des Tages bereit. @returns {boolean} true, wenn neue ausgelost wurden */
export function aufgabenBereitstellen(daten, datum) {
  const ta = daten.tagesaufgaben;
  if (ta.datum === datum && ta.aufgaben.length === AUFGABEN_JE_TAG) return false;
  const z = new Zufall(fnv1a(`${daten.clientId}:${datum}`));
  ta.datum = datum;
  ta.aufgaben = z.gemischt(AUFGABEN_POOL).slice(0, AUFGABEN_JE_TAG).map((a) => ({ id: a.id, fortschritt: 0, erledigt: false, abgeholt: false }));
  return true;
}

/**
 * Meldet ein Spielereignis. Abgeschlossene Aufgaben werden sofort gutgeschrieben (je Tag höchstens einmal).
 * @returns {Array<{id:string, belohnung:number}>} gerade abgeschlossene Aufgaben
 */
export function aufgabenEreignis(daten, ereignis, wert = 1) {
  const ta = daten.tagesaufgaben;
  const fertig = [];
  if (!Number.isFinite(wert) || wert < 0) return fertig;
  for (const a of ta.aufgaben) {
    const d = NACH_ID.get(a.id);
    if (!d || d.ereignis !== ereignis || a.erledigt) continue;
    a.fortschritt = Math.min(d.ziel, d.art === 'max' ? Math.max(a.fortschritt, wert) : a.fortschritt + wert);
    if (a.fortschritt >= d.ziel) {
      a.erledigt = true;
      a.abgeholt = buchen(daten, { betrag: d.belohnung, id: `ta:${ta.datum}:${a.id}`, art: 'tagesaufgabe' }).ok;
      if (a.abgeholt) fertig.push({ id: a.id, belohnung: d.belohnung });
    }
  }
  return fertig;
}
