// Online-Protokoll: alle Nachrichten, Grenzwerte und die strenge Prüfung eingehender Nachrichten.
// Transport: JSON-Textnachrichten über einen WebSocket, Feld `t` = Nachrichtentyp. Dokumentation: docs/NETZWERK.md.
// Der Fahrzustand ist als Zahlenfeld kompakt gehalten (25 Nachrichten pro Sekunde je Spieler).
import { AUTO_IDS } from './autos.js';
import { TUNING_IDS } from './teile.js';
import { STRECKEN_IDS } from './strecken/index.js';

export const PROTOKOLL_VERSION = 1;

// Lobby
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LAENGE = 6;
export const CODE_GUELTIG_MS = 10 * 60 * 1000;
export const BEITRITTE_PRO_MINUTE = 5;
export const LOBBY_INAKTIV_MS = 5 * 60 * 1000;
export const WIEDERVERBINDEN_MS = 15 * 1000;
export const EMOTES = ['gg', 'respekt', 'lol', 'wow', 'nochmal', 'danke'];

// Fahrt
export const ZUSTAND_HZ = 25;
export const ZUSTAND_MS = 1000 / ZUSTAND_HZ;
export const INTERPOLATION_MS = 110;
export const LUECKE_MS = 200; // Größere Meldelücke: Wertungs-Tick entfällt für beide
export const AFK_MS = 20 * 1000;
export const VORLAUF_MS = 4600; // Ankündigung bis zum gemeinsamen Start

// Nachrichten pro Verbindung
export const MAX_NACHRICHT_BYTES = 16 * 1024;
export const MAX_NACHRICHTEN_PRO_SEKUNDE = 60;
export const MAX_VERSTOESSE_RATE = 200; // verworfene Nachrichten in 10 s, dann wird getrennt

// Belohnung
export const ONLINE_SIEG = 400;
export const ONLINE_NIEDERLAGE = 100;
export const MIN_FAHRZEIT_S = 90;
export const MIN_FAHRZEIT_AUFGABE_S = 30;
export const MAX_BELOHNT_PRO_TAG = 10;
export const MAX_BELOHNT_PRO_GEGNER = 3;

// Fahrzustand (Feld d von `zustand` und `gegner`)
export const ZUSTAND_FELDER = ['seq', 'x', 'y', 'theta', 'vx', 'vy', 'r', 'flags'];
export const FLAG = { GAS: 1, BREMSE: 2, HANDBREMSE: 4, LENKEN: 8 };
export const EINGABE_FLAGS = 15; // alle Bits, die eine Eingabe des Spielers bedeuten (für die AFK-Erkennung)
// Bits 5–7 zählen die Zurücksetzungen. Ein Zähler statt eines einmaligen Merkers: Jeder folgende Zustand trägt ihn
// weiter, der Server erfährt also auch dann vom Zurücksetzen, wenn genau dieses Paket verloren geht.
const RESET_BIT = 5;
const RESET_MASKE = 7;
export const resetZaehler = (flags) => (flags >> RESET_BIT) & RESET_MASKE;
export const mitResetZaehler = (flags, zaehler) => flags | ((zaehler & RESET_MASKE) << RESET_BIT);

const istObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const istZahl = (x) => typeof x === 'number' && Number.isFinite(x);
const istGanz = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
const istText = (x, max) => typeof x === 'string' && x.length <= max;
const nurFelder = (n, felder) => Object.keys(n).every((k) => k === 't' || felder.includes(k));

/** Prüfer je Nachrichtentyp (Client → Server). Liefern true, wenn alle Felder gültig sind. */
const PRUEFER = {
  hallo: (n) => nurFelder(n, ['v', 'clientId', 'name', 'autoId', 'look', 'tuning', 'strecken', 'setup'])
    && n.v === PROTOKOLL_VERSION
    && typeof n.clientId === 'string' && /^[a-z0-9]{12,40}$/.test(n.clientId)
    && istText(n.name, 24)
    && AUTO_IDS.includes(n.autoId)
    && istText(n.look, 8192) && n.look.length > 0
    && istObj(n.tuning) && Object.keys(n.tuning).length <= TUNING_IDS.length
    && Object.entries(n.tuning).every(([k, w]) => TUNING_IDS.includes(k) && istGanz(w, 1, 5))
    && Array.isArray(n.strecken) && n.strecken.length <= STRECKEN_IDS.length && n.strecken.every((s) => STRECKEN_IDS.includes(s))
    && (n.setup === undefined || (istObj(n.setup) && Object.keys(n.setup).length <= 8 && Object.values(n.setup).every((w) => istZahl(w) && w >= 0 && w <= 1))),
  duellErstellen: (n) => nurFelder(n, []),
  beitreten: (n) => nurFelder(n, ['code']) && typeof n.code === 'string' && n.code.length <= CODE_LAENGE * 2,
  einstellungen: (n) => nurFelder(n, ['streckeId', 'format', 'einheit'])
    && (n.streckeId === undefined || STRECKEN_IDS.includes(n.streckeId))
    && (n.format === undefined || n.format === 'schnell' || n.format === 'bo3')
    && (n.einheit === undefined || typeof n.einheit === 'boolean'),
  bereit: (n) => nurFelder(n, ['an']) && typeof n.an === 'boolean',
  zustand: (n) => nurFelder(n, ['d']) && Array.isArray(n.d) && n.d.length === ZUSTAND_FELDER.length
    && istGanz(n.d[0], 0, 2 ** 31) && n.d.slice(1, 7).every(istZahl) && istGanz(n.d[7], 0, 255),
  emote: (n) => nurFelder(n, ['id']) && EMOTES.includes(n.id),
  ping: (n) => nurFelder(n, ['c']) && istZahl(n.c),
  echo: (n) => nurFelder(n, ['d']) && (n.d === undefined || typeof n.d === 'string'),
  wiederverbinden: (n) => nurFelder(n, ['token']) && typeof n.token === 'string' && n.token.length <= 64,
  aufgeben: (n) => nurFelder(n, []),
  verlassen: (n) => nurFelder(n, [])
};

export const CLIENT_NACHRICHTEN = Object.keys(PRUEFER);

/**
 * Prüft eine eingehende Nachricht streng.
 * @returns {string|null} null, wenn gültig; sonst ein Fehlercode
 */
export function pruefeNachricht(n) {
  if (!istObj(n) || typeof n.t !== 'string') return 'format';
  const p = Object.prototype.hasOwnProperty.call(PRUEFER, n.t) ? PRUEFER[n.t] : null;
  if (!p) return 'unbekannt';
  try {
    return p(n) ? null : 'felder';
  } catch {
    return 'felder';
  }
}

/** Normalisiert einen eingegebenen Code; null, wenn er nicht aus dem Alphabet bestehen kann. */
export function codeNormalisieren(code) {
  if (typeof code !== 'string') return null;
  const c = code.trim().toUpperCase();
  if (c.length !== CODE_LAENGE) return null;
  for (const z of c) if (!CODE_ALPHABET.includes(z)) return null;
  return c;
}

/** Zustand eines Fahrzeugs → Zahlenfeld (gerundet, spart Bytes). */
export function zustandPacken(seq, z, flags) {
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return [seq, r3(z.x), r3(z.y), r3(z.theta), r3(z.vx), r3(z.vy), r3(z.r), flags];
}

/** Zahlenfeld → Zustandsobjekt. */
export function zustandEntpacken(d) {
  return { seq: d[0], x: d[1], y: d[2], theta: d[3], vx: d[4], vy: d[5], r: d[6], flags: d[7] };
}
