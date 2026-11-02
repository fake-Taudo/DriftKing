// Ökonomie: Buchungen (atomar, ohne Doppelbuchung), Belohnungen und Freischaltungen.
// Alle Funktionen arbeiten auf dem Spielstand-Objekt und ändern Guthaben und Besitz gemeinsam.
// Begründung der Werte: docs/OEKONOMIE.md.
import { BOT_STUFEN, MEDAILLEN, MAX_GUTHABEN, neuerAutoEintrag } from './spielstand.js';
import { teilInfo, QUALM } from './teile.js';
import { autoDaten, istAutoId } from './autos.js';
import { ONLINE_SIEG, MAX_BELOHNT_PRO_TAG, MAX_BELOHNT_PRO_GEGNER } from './netzwerkSchema.js';
import { standardLook } from './look.js';
import { aufkleberKaufId } from '../client/assets/aufkleber.js';

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
export const VERKAUF_ANTEIL = 0.5;
/** Geschenk-Codes in Großbuchstaben → Münzen. Jeder Code gilt je Spielstand einmal. */
export const GESCHENK_CODES = { RELEASE: 7500 };
export const MAX_CODE_LAENGE = 24;

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
 * Löst einen Geschenk-Code ein. Groß- und Kleinschreibung und Leerzeichen am Rand zählen nicht.
 * Die Liste `eingeloesteCodes` ist die Sperre, nicht `buchungen`: Dort fallen alte IDs nach 200 Einträgen heraus.
 * @returns {{ok: true, code: string, betrag: number, guthaben: number} | {ok: false, grund: 'leer'|'unbekannt'|'eingeloest'}}
 */
export function codeEinloesen(daten, eingabe) {
  const code = String(eingabe ?? '').trim().toUpperCase();
  if (!code) return { ok: false, grund: 'leer' };
  if (!Object.hasOwn(GESCHENK_CODES, code)) return { ok: false, grund: 'unbekannt' };
  if (daten.eingeloesteCodes.includes(code)) return { ok: false, grund: 'eingeloest' };
  const betrag = GESCHENK_CODES[code];
  const r = buchen(daten, { betrag, art: 'code' });
  daten.eingeloesteCodes.push(code);
  return { ok: true, code, betrag, guthaben: r.guthaben };
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

// ---------------------------------------------------------------------------
// Online-Duell

/**
 * Bucht das vom Server gemeldete Ergebnis eines Online-Duells: Statistik immer, Münzen nur innerhalb der
 * Tagesgrenzen (10 Duelle je Tag, 3 je Gegner) und nie mehr als der höchste vorgesehene Betrag.
 * @returns {{ok:boolean, betrag:number, grund?:string}}
 */
export function onlineErgebnisBuchen(daten, { duellId, gegnerId, betrag, sieg, datum }) {
  const o = daten.online;
  if (o.verarbeitet.includes(duellId)) return { ok: false, betrag: 0, grund: 'doppelt' };
  if (o.datum !== datum) {
    o.datum = datum;
    o.belohnt = 0;
    o.proGegner = {};
  }
  o.verarbeitet.push(duellId);
  if (o.verarbeitet.length > 200) o.verarbeitet.splice(0, o.verarbeitet.length - 200);
  daten.statistik.onlineDuelle++;
  if (sieg) daten.statistik.onlineSiege++;
  if (!(betrag > 0)) return { ok: true, betrag: 0, grund: 'keine' };
  if (o.belohnt >= MAX_BELOHNT_PRO_TAG) return { ok: true, betrag: 0, grund: 'tag' };
  if ((o.proGegner[gegnerId] || 0) >= MAX_BELOHNT_PRO_GEGNER) return { ok: true, betrag: 0, grund: 'gegner' };
  const wert = Math.min(ONLINE_SIEG, Math.round(betrag));
  o.belohnt++;
  o.proGegner[gegnerId] = (o.proGegner[gegnerId] || 0) + 1;
  buchen(daten, { betrag: wert, id: 'on:' + duellId, art: 'online' });
  return { ok: true, betrag: wert };
}

// ---------------------------------------------------------------------------
// Kaufen und Besitz

/** Auto-Eintrag aus dem Spielstand. */
function autoEintrag(daten, autoId) {
  return daten.autos.find((a) => a.id === autoId) || null;
}

/** Besitzt der Spieler diese Kauf-ID (global oder für dieses Auto)? */
export function besitzt(daten, kaufId, autoId) {
  const info = teilInfo(kaufId, autoId);
  if (!info) return false;
  if (info.preis === 0) return true;
  if (!info.autoGebunden) return daten.besitzGlobal.includes(kaufId);
  const a = autoEintrag(daten, autoId);
  return !!a && a.gekaufteTeile.includes(kaufId);
}

/**
 * Kauft ein oder mehrere Teile atomar: entweder alle (Guthaben und Besitz gemeinsam) oder keines.
 * Bereits besessene Teile werden übersprungen und nicht berechnet (kein Doppelkauf beim Doppelklick).
 * @returns {{ok:boolean, grund?:string, preis:number, fehlt?:number, gekauft:string[]}}
 */
export function kaufen(daten, kaufIds, autoId) {
  const offen = [];
  let preis = 0;
  for (const id of new Set(Array.isArray(kaufIds) ? kaufIds : [kaufIds])) {
    const info = teilInfo(id, autoId);
    if (!info) return { ok: false, grund: 'unbekannt', preis: 0, gekauft: [] };
    if (info.autoGebunden && !autoEintrag(daten, autoId)) return { ok: false, grund: 'auto', preis: 0, gekauft: [] };
    if (besitzt(daten, id, autoId)) continue;
    offen.push({ id, info });
    preis += info.preis;
  }
  if (preis > daten.waehrung) return { ok: false, grund: 'guthaben', preis, fehlt: preis - daten.waehrung, gekauft: [] };
  const b = buchen(daten, { betrag: -preis, art: 'kauf' });
  if (!b.ok) return { ok: false, grund: b.grund, preis, gekauft: [] };
  const a = autoEintrag(daten, autoId);
  for (const { id, info } of offen) {
    if (info.autoGebunden) a.gekaufteTeile.push(id);
    else daten.besitzGlobal.push(id);
  }
  return { ok: true, preis, gekauft: offen.map((o) => o.id) };
}

/**
 * Alle Kauf-IDs, die ein Look braucht. Serienwerte (Scheinwerfer usw.) kosten nichts.
 * @param {string} autoId
 * @param {object} look
 * @returns {string[]}
 */
export function lookKaufIds(autoId, look) {
  const ids = new Set();
  ids.add('finish:' + look.lack.finish);
  ids.add('muster:' + look.muster.id);
  ids.add('felge:' + look.felgen.design);
  for (const a of look.aufkleber) {
    const k = aufkleberKaufId(a.id);
    if (k) ids.add(k);
  }
  for (const [slot, teil] of Object.entries(look.teile)) ids.add(`teil:${slot}:${teil.variante}`);
  if (look.qualm === 'regenbogen') ids.add('qualm:regenbogen');
  else {
    const preset = QUALM.find((q) => q.farbe && q.farbe.toLowerCase() === String(look.qualm).toLowerCase());
    ids.add('qualm:' + (preset ? preset.id : 'frei'));
  }
  const serie = standardLook(autoId);
  if (look.neon.an) ids.add('extra:neon');
  if (look.scheiben > 0) ids.add('extra:toenung');
  if (look.scheinwerfer.toLowerCase() !== serie.scheinwerfer.toLowerCase()) ids.add('extra:lichtfarbe');
  if (look.rueck.toLowerCase() !== serie.rueck.toLowerCase() || look.rueckDesign !== serie.rueckDesign) ids.add('extra:ruecklicht');
  if (look.backfire > 0) ids.add('extra:backfire');
  return [...ids];
}

/**
 * Was am Look noch nicht gekauft ist (Anprobe): Liste mit Preisen und Summe.
 * @returns {{teile:Array<{id:string, name:string, preis:number}>, summe:number}}
 */
export function lookBedarf(daten, autoId, look) {
  const teile = [];
  let summe = 0;
  for (const id of lookKaufIds(autoId, look)) {
    if (besitzt(daten, id, autoId)) continue;
    const info = teilInfo(id, autoId);
    if (!info) continue;
    teile.push({ id, name: info.name, preis: info.preis });
    summe += info.preis;
  }
  return { teile, summe };
}

// ---------------------------------------------------------------------------
// Verkaufen und Autos

/** Verkaufswert: die Hälfte des Preises, abgerundet (Kauf und Verkauf ergeben immer einen Verlust). */
export function verkaufswert(preis) {
  return Math.floor(preis * VERKAUF_ANTEIL);
}

/** Verkauft ein gekauftes Teil für 50 %. Danach ist es aus allen betroffenen Looks und vom Auto entfernt. */
export function verkaufen(daten, kaufId, autoId) {
  const info = teilInfo(kaufId, autoId);
  if (!info) return { ok: false, grund: 'unbekannt', erloes: 0 };
  if (info.preis === 0) return { ok: false, grund: 'kostenlos', erloes: 0 };
  if (!besitzt(daten, kaufId, autoId)) return { ok: false, grund: 'kein_besitz', erloes: 0 };
  const erloes = verkaufswert(info.preis);
  if (info.autoGebunden) {
    const a = autoEintrag(daten, autoId);
    a.gekaufteTeile.splice(a.gekaufteTeile.indexOf(kaufId), 1);
    const [art, kat, stufe] = kaufId.split(':');
    if (art === 'tuning' && a.tuning[kat] === Number(stufe)) a.tuning[kat] = 1;
    for (const l of a.looks) if (lookKaufIds(a.id, l.look).includes(kaufId)) anprobeEntfernen(l.look, standardLook(a.id), [kaufId]);
  } else {
    daten.besitzGlobal.splice(daten.besitzGlobal.indexOf(kaufId), 1);
    for (const a of daten.autos) {
      for (const l of a.looks) if (lookKaufIds(a.id, l.look).includes(kaufId)) anprobeEntfernen(l.look, standardLook(a.id), [kaufId]);
    }
  }
  buchen(daten, { betrag: erloes, art: 'verkauf' });
  return { ok: true, erloes };
}

/** Kauft ein Auto (mit Serienausstattung, leeren Looks und Setups). */
export function autoKaufen(daten, autoId) {
  if (!istAutoId(autoId)) return { ok: false, grund: 'unbekannt', preis: 0 };
  if (autoEintrag(daten, autoId)) return { ok: false, grund: 'besitz', preis: 0 };
  const preis = autoDaten(autoId).preis;
  if (preis > daten.waehrung) return { ok: false, grund: 'guthaben', preis, fehlt: preis - daten.waehrung };
  const b = buchen(daten, { betrag: -preis, art: 'auto' });
  if (!b.ok) return { ok: false, grund: b.grund, preis };
  daten.autos.push(neuerAutoEintrag(autoId));
  return { ok: true, preis };
}

/** Wert eines Autos beim Verkauf: 50 % des Kaufpreises plus 50 % aller dafür gekauften Teile. */
export function autoVerkaufswert(daten, autoId) {
  const a = autoEintrag(daten, autoId);
  if (!a) return 0;
  let wert = verkaufswert(autoDaten(autoId).preis);
  for (const id of a.gekaufteTeile) wert += verkaufswert(teilInfo(id, autoId)?.preis ?? 0);
  return wert;
}

/** Verkauft ein Auto samt eingebauter Teile. Das letzte Auto lässt sich nie verkaufen. */
export function autoVerkaufen(daten, autoId) {
  const a = autoEintrag(daten, autoId);
  if (!a) return { ok: false, grund: 'kein_besitz', erloes: 0 };
  if (daten.autos.length <= 1) return { ok: false, grund: 'letztes', erloes: 0 };
  const erloes = autoVerkaufswert(daten, autoId);
  daten.autos.splice(daten.autos.indexOf(a), 1);
  if (daten.aktivesAuto === autoId) daten.aktivesAuto = daten.autos[0].id;
  buchen(daten, { betrag: erloes, art: 'autoverkauf' });
  return { ok: true, erloes };
}

/**
 * Setzt ein Teil zur Vorschau in einen Look (Shop). Liefert false, wenn es am Auto nichts zu zeigen gibt
 * (Aufkleber-Pakete und Tuning).
 */
export function anprobeAnwenden(look, kaufId) {
  const [art, a, b] = kaufId.split(':');
  if (art === 'finish') look.lack.finish = a;
  else if (art === 'muster') {
    look.muster.id = a;
    if (a !== 'keins' && look.muster.farbe.toLowerCase() === look.lack.farbe1.toLowerCase()) look.muster.farbe = '#ffffff';
  } else if (art === 'felge') look.felgen.design = a;
  else if (art === 'teil') {
    if (look.teile[a].variante === 0 && Number(b) > 0) look.teile[a].farbe = look.lack.farbe1;
    look.teile[a].variante = Number(b);
  } else if (art === 'qualm') {
    if (a === 'frei') look.qualm = '#ffb000';
    else look.qualm = QUALM.find((q) => q.id === a)?.farbe ?? look.qualm;
  } else if (kaufId === 'extra:neon') look.neon.an = true;
  else if (kaufId === 'extra:toenung') look.scheiben = Math.max(look.scheiben, 3);
  else if (kaufId === 'extra:lichtfarbe') look.scheinwerfer = '#ffd56a';
  else if (kaufId === 'extra:ruecklicht') look.rueckDesign = 1;
  else if (kaufId === 'extra:backfire') look.backfire = Math.max(look.backfire, 0.7);
  else return false;
  return true;
}

/**
 * Nimmt nicht gekaufte Anproben aus einem Look zurück: Jedes Teil geht auf den Stand des gespeicherten
 * Looks zurück, alle anderen Änderungen bleiben erhalten. Danach braucht der Look nichts mehr.
 * @param {object} look wird verändert
 * @param {object} gespeichert letzter gespeicherter Look (nur Gekauftes)
 * @param {string[]} kaufIds die zu entfernenden Kauf-IDs
 */
export function anprobeEntfernen(look, gespeichert, kaufIds) {
  const serie = standardLook(look.auto);
  for (const id of kaufIds) {
    const [art, a] = id.split(':');
    if (art === 'finish') look.lack.finish = gespeichert.lack.finish;
    else if (art === 'muster') look.muster = { ...gespeichert.muster };
    else if (art === 'felge') look.felgen.design = gespeichert.felgen.design;
    else if (art === 'teil') look.teile[a] = { ...gespeichert.teile[a] };
    else if (art === 'qualm') look.qualm = gespeichert.qualm;
    else if (art === 'aufkleber') look.aufkleber = look.aufkleber.filter((x) => aufkleberKaufId(x.id) !== id);
    else if (id === 'extra:neon') look.neon = { ...look.neon, an: false };
    else if (id === 'extra:toenung') look.scheiben = 0;
    else if (id === 'extra:lichtfarbe') look.scheinwerfer = serie.scheinwerfer;
    else if (id === 'extra:ruecklicht') { look.rueck = serie.rueck; look.rueckDesign = serie.rueckDesign; }
    else if (id === 'extra:backfire') look.backfire = 0;
  }
}

/** Baut eine gekaufte Tuningstufe ein (Stufe 1 = Serie ist immer möglich). */
export function tuningEinbauen(daten, autoId, kategorie, stufe) {
  const a = autoEintrag(daten, autoId);
  const kaufId = `tuning:${kategorie}:${stufe}`;
  if (!a || !teilInfo(kaufId, autoId) || !besitzt(daten, kaufId, autoId)) return false;
  a.tuning[kategorie] = stufe;
  return true;
}
