// Look-Schema (Optik eines Autos): Standard-Look, Validierung, Look-Code (Export/Import).
// Wird von Client (Garage, Rennen) und Server (Look-Sync im Online-Duell) verwendet.
import { AUTO_IDS, istAutoId } from './autos.js';
import { FINISHS, MUSTER, FELGEN, QUALM, SLOTS, SLOT_IDS, maxVariante } from './teile.js';
import { pruefeKennzeichen, pruefeAufkleberText } from './wortfilter.js';
import { kodiere, dekodiere } from './kodierung.js';

export const LOOK_VERSION = 1;
export const MAX_AUFKLEBER = 30;
export const MAX_LOOK_CODE_BYTES = 8192; // 8 KB (komprimierter Text-Code)

export const ZONEN = ['seiteL', 'seiteR', 'haube', 'dach', 'heck', 'front'];
export const SCHRIFTEN = [
  { id: 'lilita', name: 'Lilita One', css: '"Lilita One"' },
  { id: 'bungee', name: 'Bungee', css: '"Bungee"' },
  { id: 'orbitron', name: 'Orbitron', css: '"Orbitron"' },
  { id: 'russo', name: 'Russo One', css: '"Russo One"' },
  { id: 'audiowide', name: 'Audiowide', css: '"Audiowide"' },
  { id: 'teko', name: 'Teko', css: '"Teko"' }
];
const SCHRIFT_IDS = SCHRIFTEN.map((s) => s.id);
const FINISH_IDS = FINISHS.map((f) => f.id);
const MUSTER_IDS = MUSTER.map((m) => m.id);
const FELGEN_IDS = FELGEN.map((f) => f.id);
const QUALM_PRESETS = QUALM.filter((q) => q.farbe && q.farbe.startsWith('#')).map((q) => q.farbe);

const FARBE = /^#[0-9a-fA-F]{6}$/;

/** Standardfarben je Auto (Werkslack). */
const WERKSFARBEN = {
  kestrel_s: '#e8452c',
  marlin_4d: '#2c6be8',
  vireo_turbo: '#f2c230',
  hornet_wagon: '#3fae6a',
  bastion_gt: '#1f1f26',
  onyx_rs: '#e9ecf2'
};

/** Erzeugt den Serien-Look für ein Auto. */
export function standardLook(autoId) {
  const teile = {};
  for (const s of SLOTS) {
    teile[s.id] = { variante: 0, farbe: '#202228' };
  }
  teile.auspuff.groesse = 1.0;
  return {
    v: LOOK_VERSION,
    auto: autoId,
    lack: { farbe1: WERKSFARBEN[autoId] || '#cccccc', farbe2: '#202228', finish: 'glanz', zweitDach: false, zweitHaube: false, zweitSpiegel: false },
    muster: { id: 'keins', farbe: '#ffffff', deckkraft: 0.9, skala: 1.0 },
    aufkleber: [],
    felgen: { design: 'fuenfspeichen', farbe: '#c9ccd2', zierring: '#c9ccd2', bolzen: '#7a7d84', groesse: 17, breite: 8, flanke: '#1a1a1c', flankeLinie: false, profil: 1, sattel: '#9a1d1d' },
    teile,
    fahrwerk: { tiefe: 0.3, sturzV: -1.0, sturzH: -1.5, spur: 0.2 },
    qualm: '#eeeeee',
    neon: { an: false, farbe: '#36e0ff', helligkeit: 0.8, puls: false },
    scheiben: 0,
    scheinwerfer: '#f4f6ff',
    rueck: '#ff2020',
    rueckDesign: 0,
    backfire: 0,
    kennzeichen: 'DK 001'
  };
}

// ---------------------------------------------------------------------------
// Validierung

class LookFehler extends Error {
  constructor(feld, grund) {
    super(`${feld}: ${grund}`);
    this.feld = feld;
    this.grund = grund;
  }
}

function istObjekt(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}
function nurSchluessel(obj, erlaubt, feld) {
  for (const k of Object.keys(obj)) if (!erlaubt.includes(k)) throw new LookFehler(feld + '.' + k, 'unbekannt');
}
function zahl(x, min, max, feld) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max) throw new LookFehler(feld, 'bereich');
  return x;
}
function ganz(x, min, max, feld) {
  zahl(x, min, max, feld);
  if (!Number.isInteger(x)) throw new LookFehler(feld, 'ganzzahl');
  return x;
}
function farbe(x, feld) {
  if (typeof x !== 'string' || !FARBE.test(x)) throw new LookFehler(feld, 'farbe');
  return x;
}
function bool(x, feld) {
  if (typeof x !== 'boolean') throw new LookFehler(feld, 'bool');
  return x;
}
function auswahl(x, liste, feld) {
  if (!liste.includes(x)) throw new LookFehler(feld, 'unbekannt');
  return x;
}

/**
 * Prüft einen Look streng (für Import und Netzwerk).
 * @param {object} look
 * @param {{aufkleberIds?: Set<string>}} [optionen] bekannte Aufkleber-IDs (Client und Server übergeben die Liste)
 * @returns {{ok: true} | {ok: false, feld: string, grund: string}}
 */
export function pruefeLook(look, optionen = {}) {
  try {
    pruefeLookStreng(look, optionen);
    return { ok: true };
  } catch (e) {
    if (e instanceof LookFehler) return { ok: false, feld: e.feld, grund: e.grund };
    return { ok: false, feld: '?', grund: 'intern' };
  }
}

function pruefeLookStreng(look, { aufkleberIds } = {}) {
  if (!istObjekt(look)) throw new LookFehler('look', 'typ');
  nurSchluessel(look, ['v', 'auto', 'lack', 'muster', 'aufkleber', 'felgen', 'teile', 'fahrwerk', 'qualm', 'neon', 'scheiben', 'scheinwerfer', 'rueck', 'rueckDesign', 'backfire', 'kennzeichen'], 'look');
  if (look.v !== LOOK_VERSION) throw new LookFehler('v', 'version');
  if (!istAutoId(look.auto)) throw new LookFehler('auto', 'unbekannt');

  const l = look.lack;
  if (!istObjekt(l)) throw new LookFehler('lack', 'typ');
  nurSchluessel(l, ['farbe1', 'farbe2', 'finish', 'zweitDach', 'zweitHaube', 'zweitSpiegel'], 'lack');
  farbe(l.farbe1, 'lack.farbe1');
  farbe(l.farbe2, 'lack.farbe2');
  auswahl(l.finish, FINISH_IDS, 'lack.finish');
  bool(l.zweitDach, 'lack.zweitDach');
  bool(l.zweitHaube, 'lack.zweitHaube');
  bool(l.zweitSpiegel, 'lack.zweitSpiegel');

  const m = look.muster;
  if (!istObjekt(m)) throw new LookFehler('muster', 'typ');
  nurSchluessel(m, ['id', 'farbe', 'deckkraft', 'skala'], 'muster');
  auswahl(m.id, MUSTER_IDS, 'muster.id');
  farbe(m.farbe, 'muster.farbe');
  zahl(m.deckkraft, 0, 1, 'muster.deckkraft');
  zahl(m.skala, 0.25, 4, 'muster.skala');

  if (!Array.isArray(look.aufkleber)) throw new LookFehler('aufkleber', 'typ');
  if (look.aufkleber.length > MAX_AUFKLEBER) throw new LookFehler('aufkleber', 'zu_viele');
  look.aufkleber.forEach((a, i) => {
    const f = `aufkleber[${i}]`;
    if (!istObjekt(a)) throw new LookFehler(f, 'typ');
    nurSchluessel(a, ['id', 'zone', 'x', 'y', 'rot', 'skala', 'farbe', 'spiegel', 'deckkraft', 'text', 'schrift', 'gruppe'], f);
    if (a.id === 'text') {
      if (pruefeAufkleberText(a.text)) throw new LookFehler(f + '.text', 'text');
      auswahl(a.schrift, SCHRIFT_IDS, f + '.schrift');
    } else {
      if (typeof a.id !== 'string' || !/^[a-z0-9_]{1,32}$/.test(a.id)) throw new LookFehler(f + '.id', 'format');
      if (aufkleberIds && !aufkleberIds.has(a.id)) throw new LookFehler(f + '.id', 'unbekannt');
      if (a.text !== undefined || a.schrift !== undefined) throw new LookFehler(f, 'text_unerwartet');
    }
    auswahl(a.zone, ZONEN, f + '.zone');
    zahl(a.x, -0.5, 1.5, f + '.x');
    zahl(a.y, -0.5, 1.5, f + '.y');
    zahl(a.rot, -360, 360, f + '.rot');
    zahl(a.skala, 0.03, 3, f + '.skala');
    farbe(a.farbe, f + '.farbe');
    bool(a.spiegel, f + '.spiegel');
    zahl(a.deckkraft, 0, 1, f + '.deckkraft');
    if (a.gruppe !== undefined) ganz(a.gruppe, 0, 99, f + '.gruppe');
  });

  const fe = look.felgen;
  if (!istObjekt(fe)) throw new LookFehler('felgen', 'typ');
  nurSchluessel(fe, ['design', 'farbe', 'zierring', 'bolzen', 'groesse', 'breite', 'flanke', 'flankeLinie', 'profil', 'sattel'], 'felgen');
  auswahl(fe.design, FELGEN_IDS, 'felgen.design');
  farbe(fe.farbe, 'felgen.farbe');
  farbe(fe.zierring, 'felgen.zierring');
  farbe(fe.bolzen, 'felgen.bolzen');
  ganz(fe.groesse, 15, 20, 'felgen.groesse');
  zahl(fe.breite, 6.5, 11, 'felgen.breite');
  farbe(fe.flanke, 'felgen.flanke');
  bool(fe.flankeLinie, 'felgen.flankeLinie');
  ganz(fe.profil, 0, 3, 'felgen.profil');
  farbe(fe.sattel, 'felgen.sattel');

  const t = look.teile;
  if (!istObjekt(t)) throw new LookFehler('teile', 'typ');
  nurSchluessel(t, SLOT_IDS, 'teile');
  for (const slot of SLOT_IDS) {
    const e = t[slot];
    const f = 'teile.' + slot;
    if (!istObjekt(e)) throw new LookFehler(f, 'typ');
    nurSchluessel(e, slot === 'auspuff' ? ['variante', 'farbe', 'groesse'] : ['variante', 'farbe'], f);
    ganz(e.variante, 0, maxVariante(slot), f + '.variante');
    farbe(e.farbe, f + '.farbe');
    if (slot === 'auspuff') zahl(e.groesse, 0.6, 1.5, f + '.groesse');
  }

  const fw = look.fahrwerk;
  if (!istObjekt(fw)) throw new LookFehler('fahrwerk', 'typ');
  nurSchluessel(fw, ['tiefe', 'sturzV', 'sturzH', 'spur'], 'fahrwerk');
  zahl(fw.tiefe, 0, 1, 'fahrwerk.tiefe');
  zahl(fw.sturzV, -8, 0, 'fahrwerk.sturzV');
  zahl(fw.sturzH, -10, 0, 'fahrwerk.sturzH');
  zahl(fw.spur, 0, 1, 'fahrwerk.spur');

  if (look.qualm !== 'regenbogen') farbe(look.qualm, 'qualm');

  const n = look.neon;
  if (!istObjekt(n)) throw new LookFehler('neon', 'typ');
  nurSchluessel(n, ['an', 'farbe', 'helligkeit', 'puls'], 'neon');
  bool(n.an, 'neon.an');
  farbe(n.farbe, 'neon.farbe');
  zahl(n.helligkeit, 0, 1, 'neon.helligkeit');
  bool(n.puls, 'neon.puls');

  ganz(look.scheiben, 0, 4, 'scheiben');
  farbe(look.scheinwerfer, 'scheinwerfer');
  farbe(look.rueck, 'rueck');
  ganz(look.rueckDesign, 0, 2, 'rueckDesign');
  zahl(look.backfire, 0, 1, 'backfire');
  if (pruefeKennzeichen(look.kennzeichen)) throw new LookFehler('kennzeichen', 'text');
}

/** Tiefe Kopie (Looks sind reine JSON-Daten). */
export function kopiereLook(look) {
  return JSON.parse(JSON.stringify(look));
}

/** Qualmfarbe ist eine Preset-Farbe (sonst „freie Farbe“ nötig)? */
export function istQualmPreset(farbeWert) {
  return farbeWert === 'regenbogen' || QUALM_PRESETS.includes(String(farbeWert).toLowerCase());
}

// ---------------------------------------------------------------------------
// Look-Code

/** Look → Text-Code (wirft 'zu_gross', wenn das 8-KB-Limit überschritten wird). */
export async function lookZuCode(look) {
  const code = await kodiere(look);
  if (code.length > MAX_LOOK_CODE_BYTES) throw new Error('zu_gross');
  return code;
}

/**
 * Text-Code → geprüfter Look.
 * @returns {Promise<{ok: true, look: object} | {ok: false, fehler: string}>}
 */
export async function codeZuLook(code, optionen = {}) {
  if (typeof code !== 'string' || !code.trim()) return { ok: false, fehler: 'leer' };
  if (code.trim().length > MAX_LOOK_CODE_BYTES) return { ok: false, fehler: 'zu_gross' };
  let objekt;
  try {
    objekt = await dekodiere(code, { maxCodeLaenge: MAX_LOOK_CODE_BYTES, maxRohBytes: 64 * 1024 });
  } catch (e) {
    return { ok: false, fehler: e.message || 'format' };
  }
  const p = pruefeLook(objekt, optionen);
  if (!p.ok) return { ok: false, fehler: 'schema', feld: p.feld, grund: p.grund };
  if (optionen.autoId && objekt.auto !== optionen.autoId) return { ok: false, fehler: 'falsches_auto', auto: objekt.auto };
  return { ok: true, look: objekt };
}

export { AUTO_IDS };
