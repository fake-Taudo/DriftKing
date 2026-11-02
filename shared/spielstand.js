// Spielstand (Single-Player): Schema, Standardwerte, Validierung, Migration, Prüfsumme.
// Reine Logik ohne Browser-Abhängigkeit – die Ablage in localStorage übernimmt client/core/speicher.js.
import { AUTO_IDS, START_AUTO, istAutoId } from './autos.js';
import { standardLook, pruefeLook } from './look.js';
import { standardSetup, SETUP_REGLER, TUNING_IDS, GRATIS_GLOBAL, gratisFuerAuto, teilInfo } from './teile.js';
import { fnv1a } from './kodierung.js';

export const SPIELSTAND_VERSION = 1;
export const START_GUTHABEN = 5000;
export const MAX_GUTHABEN = 999_999_999;
export const LOOK_SLOTS = 5;
export const SETUP_SLOTS = 3;
export const MAX_IMPORT_BYTES = 1_000_000;

export const STRECKEN_IDS = ['industriehof', 'kuestenpass', 'neonhafen'];
export const BOT_STUFEN = ['anfaenger', 'fahrer', 'profi', 'meister', 'legende'];
export const MEDAILLEN = ['bronze', 'silber', 'gold', 'champion'];

/** Standard-Tastenbelegung (KeyboardEvent.code). */
export const STANDARD_TASTEN = {
  gas: ['KeyW', 'ArrowUp'],
  bremse: ['KeyS', 'ArrowDown'],
  links: ['KeyA', 'ArrowLeft'],
  rechts: ['KeyD', 'ArrowRight'],
  handbremse: ['Space'],
  kupplung: ['ShiftLeft', 'ShiftRight'],
  hoch: ['KeyE'],
  runter: ['KeyQ'],
  kamera: ['KeyC'],
  zuruecksetzen: ['KeyR'],
  pause: ['Escape', 'KeyP']
};

/** Standard-Gamepad-Belegung (Standard-Mapping-Indizes). */
export const STANDARD_GAMEPAD = {
  handbremse: 0, // A / Kreuz
  kamera: 3, // Y / Dreieck
  kupplung: 2, // X / Quadrat
  zuruecksetzen: 1, // B / Kreis
  hoch: 5, // RB
  runter: 4, // LB
  pause: 9 // Start
};

export function standardEinstellungen() {
  return {
    grafik: { qualitaet: 'auto' },
    audio: { master: 0.8, effekte: 0.9, musik: 0.45, musikAn: true },
    steuerung: {
      touchModus: 'tasten',
      layout: null,
      transparenz: 0.65,
      linkshaender: false,
      kupplungsButton: false,
      vibration: true,
      gamepadTotzone: 0.12,
      neigungEmpfindlichkeit: 0.5,
      neigungTotzone: 0.04,
      tasten: JSON.parse(JSON.stringify(STANDARD_TASTEN)),
      gamepad: { ...STANDARD_GAMEPAD }
    },
    kamera: 'verfolger',
    assistenz: { gegenlenken: 60, driftHalten: 30, driftHaltenModus: 'auto' },
    getriebe: 'auto',
    barrierefreiheit: { farbenblind: false, schriftgroesse: 1, reduzierteEffekte: false },
    anzeige: { fps: false, namensTag: true }
  };
}

function neuerAutoEintrag(autoId) {
  const looks = [];
  for (let i = 0; i < LOOK_SLOTS; i++) looks.push({ name: `Look ${i + 1}`, look: standardLook(autoId) });
  const setups = [];
  for (let i = 0; i < SETUP_SLOTS; i++) setups.push(standardSetup(`Setup ${i + 1}`));
  const tuning = {};
  for (const t of TUNING_IDS) tuning[t] = 1;
  return {
    id: autoId,
    gekaufteTeile: gratisFuerAuto(),
    looks,
    setups,
    aktiverLook: 0,
    aktivesSetup: 0,
    tuning
  };
}
export { neuerAutoEintrag };

/** Erzeugt einen neuen Spielstand. */
export function neuerSpielstand(clientId) {
  return {
    version: SPIELSTAND_VERSION,
    clientId,
    erstellt: Date.now(),
    spielerName: 'Fahrer',
    waehrung: START_GUTHABEN,
    besitzGlobal: GRATIS_GLOBAL.slice(),
    autos: [neuerAutoEintrag(START_AUTO)],
    aktivesAuto: START_AUTO,
    fortschritt: {
      strecken: ['industriehof'],
      botStufen: ['anfaenger'],
      siegeStrecke: {},
      siegeStufe: {},
      erstSiege: {},
      bestwerte: {},
      medaillen: {},
      medaillenErhalten: {},
      tutorialFertig: false
    },
    tagesaufgaben: { datum: null, aufgaben: [] },
    online: { datum: null, belohnt: 0, proGegner: {}, verarbeitet: [] },
    statistik: {
      battles: 0, siege: 0, niederlagen: 0,
      onlineDuelle: 0, onlineSiege: 0,
      punkteGesamt: 0, fahrzeit: 0, laengsterDrift: 0, besterWinkel: 0,
      muenzenVerdient: 0, muenzenAusgegeben: 0, wandkontakte: 0
    },
    einstellungen: standardEinstellungen(),
    buchungen: []
  };
}

// ---------------------------------------------------------------------------
// Migration

/**
 * Migrationen: Schlüssel = Ausgangsversion. Jede Funktion hebt um genau eine Version an.
 * Version 0 war das Format der frühen Entwicklungsversion („muenzen“ statt „waehrung“,
 * ohne globalen Besitz und ohne Tagesaufgaben) – dient zugleich als Testfall.
 */
const MIGRATIONEN = {
  0: (d) => {
    const neu = { ...d };
    neu.waehrung = typeof d.muenzen === 'number' ? d.muenzen : START_GUTHABEN;
    delete neu.muenzen;
    neu.besitzGlobal = Array.isArray(d.besitzGlobal) ? d.besitzGlobal : GRATIS_GLOBAL.slice();
    neu.tagesaufgaben = d.tagesaufgaben || { datum: null, aufgaben: [] };
    neu.online = d.online || { datum: null, belohnt: 0, proGegner: {}, verarbeitet: [] };
    neu.buchungen = d.buchungen || [];
    neu.erstellt = d.erstellt || Date.now();
    neu.version = 1;
    return neu;
  }
};

/** Migriert ein Daten-Objekt auf die aktuelle Version. Wirft bei unbekannter Version. */
export function migriere(daten) {
  let d = daten;
  let v = typeof d.version === 'number' ? d.version : 0;
  if (v > SPIELSTAND_VERSION) throw new Error('version_neuer');
  while (v < SPIELSTAND_VERSION) {
    const m = MIGRATIONEN[v];
    if (!m) throw new Error('version_unbekannt');
    d = m(d);
    v = d.version;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Validierung

class SpeicherFehler extends Error {
  constructor(feld) {
    super(feld);
    this.feld = feld;
  }
}
const istObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
function ganzzahl(x, min, max, feld) {
  if (!Number.isInteger(x) || x < min || x > max) throw new SpeicherFehler(feld);
}
function zahlImBereich(x, min, max, feld) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max) throw new SpeicherFehler(feld);
}

/**
 * Prüft einen (bereits migrierten) Spielstand streng auf Schema und Wertebereiche.
 * @returns {{ok: true} | {ok: false, feld: string}}
 */
export function pruefeSpielstand(d, optionen = {}) {
  try {
    pruefeStreng(d, optionen);
    return { ok: true };
  } catch (e) {
    return { ok: false, feld: e instanceof SpeicherFehler ? e.feld : 'intern:' + (e && e.message) };
  }
}

function pruefeStreng(d, { aufkleberIds } = {}) {
  if (!istObj(d)) throw new SpeicherFehler('wurzel');
  if (d.version !== SPIELSTAND_VERSION) throw new SpeicherFehler('version');
  if (typeof d.clientId !== 'string' || !/^[a-z0-9]{12,40}$/.test(d.clientId)) throw new SpeicherFehler('clientId');
  if (typeof d.spielerName !== 'string' || d.spielerName.length > 24) throw new SpeicherFehler('spielerName');
  ganzzahl(d.waehrung, 0, MAX_GUTHABEN, 'waehrung');

  if (!Array.isArray(d.besitzGlobal) || d.besitzGlobal.length > 500) throw new SpeicherFehler('besitzGlobal');
  for (const id of d.besitzGlobal) {
    const info = teilInfo(id);
    if (!info || info.autoGebunden) throw new SpeicherFehler('besitzGlobal:' + id);
  }

  if (!Array.isArray(d.autos) || d.autos.length < 1 || d.autos.length > AUTO_IDS.length) throw new SpeicherFehler('autos');
  const gesehen = new Set();
  for (const a of d.autos) {
    if (!istObj(a) || !istAutoId(a.id) || gesehen.has(a.id)) throw new SpeicherFehler('autos.id');
    gesehen.add(a.id);
    if (!Array.isArray(a.gekaufteTeile) || a.gekaufteTeile.length > 200) throw new SpeicherFehler('autos.gekaufteTeile');
    for (const id of a.gekaufteTeile) {
      const info = teilInfo(id, a.id);
      if (!info || !info.autoGebunden) throw new SpeicherFehler('autos.gekaufteTeile:' + id);
    }
    if (!Array.isArray(a.looks) || a.looks.length !== LOOK_SLOTS) throw new SpeicherFehler('autos.looks');
    for (const l of a.looks) {
      if (!istObj(l) || typeof l.name !== 'string' || l.name.length > 24) throw new SpeicherFehler('autos.looks.name');
      const p = pruefeLook(l.look, { aufkleberIds });
      if (!p.ok) throw new SpeicherFehler('autos.looks.look.' + p.feld);
      if (l.look.auto !== a.id) throw new SpeicherFehler('autos.looks.auto');
    }
    if (!Array.isArray(a.setups) || a.setups.length !== SETUP_SLOTS) throw new SpeicherFehler('autos.setups');
    for (const s of a.setups) {
      if (!istObj(s) || typeof s.name !== 'string' || s.name.length > 24 || !istObj(s.werte)) throw new SpeicherFehler('autos.setups.eintrag');
      for (const r of SETUP_REGLER) zahlImBereich(s.werte[r.id], r.min, r.max, 'autos.setups.' + r.id);
    }
    ganzzahl(a.aktiverLook, 0, LOOK_SLOTS - 1, 'autos.aktiverLook');
    ganzzahl(a.aktivesSetup, 0, SETUP_SLOTS - 1, 'autos.aktivesSetup');
    if (!istObj(a.tuning)) throw new SpeicherFehler('autos.tuning');
    for (const t of TUNING_IDS) {
      ganzzahl(a.tuning[t], 1, 5, 'autos.tuning.' + t);
      if (a.tuning[t] > 1 && !a.gekaufteTeile.includes(`tuning:${t}:${a.tuning[t]}`)) throw new SpeicherFehler('autos.tuning.besitz');
    }
  }
  if (!gesehen.has(d.aktivesAuto)) throw new SpeicherFehler('aktivesAuto');

  const f = d.fortschritt;
  if (!istObj(f)) throw new SpeicherFehler('fortschritt');
  if (!Array.isArray(f.strecken) || !f.strecken.every((s) => STRECKEN_IDS.includes(s)) || !f.strecken.includes('industriehof')) throw new SpeicherFehler('fortschritt.strecken');
  if (!Array.isArray(f.botStufen) || !f.botStufen.every((s) => BOT_STUFEN.includes(s)) || !f.botStufen.includes('anfaenger')) throw new SpeicherFehler('fortschritt.botStufen');
  for (const k of ['siegeStrecke', 'siegeStufe', 'erstSiege', 'bestwerte', 'medaillen', 'medaillenErhalten']) {
    if (!istObj(f[k])) throw new SpeicherFehler('fortschritt.' + k);
  }
  for (const [k, v] of Object.entries(f.siegeStrecke)) {
    if (!STRECKEN_IDS.includes(k)) throw new SpeicherFehler('fortschritt.siegeStrecke.id');
    ganzzahl(v, 0, 1e7, 'fortschritt.siegeStrecke.wert');
  }
  for (const [k, v] of Object.entries(f.siegeStufe)) {
    if (!BOT_STUFEN.includes(k)) throw new SpeicherFehler('fortschritt.siegeStufe.id');
    ganzzahl(v, 0, 1e7, 'fortschritt.siegeStufe.wert');
  }
  for (const [k, v] of Object.entries(f.medaillen)) {
    if (!STRECKEN_IDS.includes(k) || !MEDAILLEN.includes(v)) throw new SpeicherFehler('fortschritt.medaillen');
  }
  for (const [k, v] of Object.entries(f.bestwerte)) {
    if (!STRECKEN_IDS.includes(k) || !istObj(v)) throw new SpeicherFehler('fortschritt.bestwerte');
    for (const [bk, bv] of Object.entries(v)) {
      if (!['training', 'trainingBelohnt', 'zeitangriff', 'runde'].includes(bk)) throw new SpeicherFehler('fortschritt.bestwerte.art');
      if (bv !== null) zahlImBereich(bv, 0, 1e7, 'fortschritt.bestwerte.wert');
    }
  }
  if (typeof f.tutorialFertig !== 'boolean') throw new SpeicherFehler('fortschritt.tutorialFertig');

  const ta = d.tagesaufgaben;
  if (!istObj(ta) || !Array.isArray(ta.aufgaben) || ta.aufgaben.length > 10) throw new SpeicherFehler('tagesaufgaben');
  if (ta.datum !== null && (typeof ta.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ta.datum))) throw new SpeicherFehler('tagesaufgaben.datum');
  for (const a of ta.aufgaben) {
    if (!istObj(a) || typeof a.id !== 'string') throw new SpeicherFehler('tagesaufgaben.eintrag');
    zahlImBereich(a.fortschritt, 0, 1e9, 'tagesaufgaben.fortschritt');
    if (typeof a.erledigt !== 'boolean' || typeof a.abgeholt !== 'boolean') throw new SpeicherFehler('tagesaufgaben.status');
  }

  const o = d.online;
  if (!istObj(o) || !istObj(o.proGegner) || !Array.isArray(o.verarbeitet) || o.verarbeitet.length > 200) throw new SpeicherFehler('online');
  ganzzahl(o.belohnt, 0, 1000, 'online.belohnt');

  if (!istObj(d.statistik)) throw new SpeicherFehler('statistik');
  for (const v of Object.values(d.statistik)) zahlImBereich(v, 0, 1e12, 'statistik.wert');

  if (!istObj(d.einstellungen)) throw new SpeicherFehler('einstellungen');
  if (!Array.isArray(d.buchungen) || d.buchungen.length > 500) throw new SpeicherFehler('buchungen');
}

/**
 * Ergänzt fehlende Einstellungen mit Standardwerten (vorwärtskompatibel) und verwirft
 * Werte mit falschem Typ. Verändert nur `einstellungen`.
 */
export function vervollstaendigeEinstellungen(e) {
  const std = standardEinstellungen();
  function mischen(ziel, quelle) {
    if (!istObj(quelle)) return ziel;
    for (const k of Object.keys(ziel)) {
      const zv = ziel[k];
      const qv = quelle[k];
      if (qv === undefined) continue;
      if (istObj(zv) && istObj(qv)) mischen(zv, qv);
      else if (zv === null && (qv === null || istObj(qv))) ziel[k] = qv;
      else if (Array.isArray(zv) && Array.isArray(qv)) ziel[k] = qv.slice(0, 8).filter((x) => typeof x === typeof zv[0]);
      else if (typeof zv === typeof qv && (typeof qv !== 'number' || Number.isFinite(qv))) ziel[k] = qv;
    }
    return ziel;
  }
  return mischen(std, e);
}

// ---------------------------------------------------------------------------
// Verpacken mit Prüfsumme

/** Spielstand → JSON-Text mit Prüfsumme. */
export function verpacke(daten) {
  const json = JSON.stringify(daten);
  return JSON.stringify({ format: 'driftkoenig', version: daten.version, pruefsumme: fnv1a(json), daten });
}

/**
 * JSON-Text → geprüfter, migrierter Spielstand.
 * @returns {{ok: true, daten: object, migriert: boolean} | {ok: false, fehler: string}}
 */
export function entpacke(text, optionen = {}) {
  if (typeof text !== 'string' || !text) return { ok: false, fehler: 'leer' };
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, fehler: 'zu_gross' };
  let huelle;
  try {
    huelle = JSON.parse(text);
  } catch {
    return { ok: false, fehler: 'json' };
  }
  if (!istObj(huelle) || huelle.format !== 'driftkoenig' || !istObj(huelle.daten)) return { ok: false, fehler: 'format' };
  if (typeof huelle.pruefsumme !== 'string' || fnv1a(JSON.stringify(huelle.daten)) !== huelle.pruefsumme) {
    return { ok: false, fehler: 'pruefsumme' };
  }
  let daten;
  const alteVersion = huelle.daten.version;
  try {
    daten = migriere(huelle.daten);
  } catch (e) {
    return { ok: false, fehler: e.message };
  }
  daten.einstellungen = vervollstaendigeEinstellungen(daten.einstellungen);
  const p = pruefeSpielstand(daten, optionen);
  if (!p.ok) return { ok: false, fehler: 'schema', feld: p.feld };
  return { ok: true, daten, migriert: alteVersion !== SPIELSTAND_VERSION };
}

/** Erzeugt eine zufällige Client-ID aus einer Zufallsquelle (liefert Bytes 0..255). */
export function erzeugeClientId(zufallsByte) {
  const zeichen = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) id += zeichen[zufallsByte() % zeichen.length];
  return id;
}
