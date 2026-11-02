// Bearbeitungsschritte des Aufkleber-Editors als reine Funktionen auf der Aufkleber-Liste eines Looks
// (Reihenfolge = Ebenen, spätere Einträge liegen oben). Liefern den Index der betroffenen Ebene oder -1.
import { MAX_AUFKLEBER, ZONEN } from './look.js';
import { pruefeAufkleberText } from './wortfilter.js';

const GEGENSEITE = { seiteL: 'seiteR', seiteR: 'seiteL' };
const klemme = (x, a, b) => (x < a ? a : x > b ? b : x);
const runde = (x, n = 1000) => Math.round(x * n) / n;

/** Neuer Aufkleber mit Standardwerten in der Mitte der Zone. */
export function neuerAufkleber(id, zone = 'seiteL', { farbe = '#ffffff', text, schrift } = {}) {
  const seite = zone === 'seiteL' || zone === 'seiteR';
  const a = { id, zone: ZONEN.includes(zone) ? zone : 'seiteL', x: 0.5, y: seite ? 0.62 : 0.5, rot: 0, skala: 0.45, farbe, spiegel: false, deckkraft: 1 };
  if (id === 'text') {
    a.text = text;
    a.schrift = schrift;
    a.skala = 0.6;
  }
  return a;
}

/** Fügt einen Aufkleber als oberste Ebene hinzu (höchstens MAX_AUFKLEBER). */
export function hinzufuegen(liste, a) {
  if (liste.length >= MAX_AUFKLEBER) return -1;
  if (a.id === 'text' && pruefeAufkleberText(a.text)) return -1;
  liste.push(a);
  return liste.length - 1;
}

/** Duplikat direkt über dem Original, leicht versetzt. */
export function duplizieren(liste, i) {
  if (!liste[i] || liste.length >= MAX_AUFKLEBER) return -1;
  const k = { ...liste[i], x: klemme(runde(liste[i].x + 0.03), -0.5, 1.5), y: klemme(runde(liste[i].y + 0.03), -0.5, 1.5) };
  liste.splice(i + 1, 0, k);
  return i + 1;
}

export function loeschen(liste, i) {
  if (!liste[i]) return -1;
  liste.splice(i, 1);
  return Math.min(i, liste.length - 1);
}

/** Ändert die Ebenen-Reihenfolge (richtung +1 = nach oben). */
export function ebeneVerschieben(liste, i, richtung) {
  const z = i + richtung;
  if (!liste[i] || z < 0 || z >= liste.length) return i;
  const [a] = liste.splice(i, 1);
  liste.splice(z, 0, a);
  return z;
}

/**
 * Legt eine gespiegelte Kopie auf die andere Fahrzeugseite. Die Seiten-Zonen laufen im Atlas gegenläufig,
 * deshalb wird x gespiegelt und die Drehung umgekehrt. Formen werden gespiegelt, Text bleibt lesbar.
 * Auf Haube, Dach, Heck und Front wird an der Mittelachse gespiegelt.
 */
export function aufAndereSeite(liste, i) {
  const a = liste[i];
  if (!a || liste.length >= MAX_AUFKLEBER) return -1;
  const k = { ...a, x: runde(1 - a.x), rot: runde(-a.rot, 10), zone: GEGENSEITE[a.zone] || a.zone };
  if (a.id !== 'text') k.spiegel = !a.spiegel;
  delete k.gruppe;
  liste.push(k);
  return liste.length - 1;
}

/** Fasst Ebenen zu einer Gruppe zusammen (kleinste freie Nummer). */
export function gruppeSetzen(liste, indizes) {
  const belegt = new Set(liste.map((a) => a.gruppe).filter((g) => g !== undefined));
  let nr = 0;
  while (belegt.has(nr)) nr++;
  for (const i of indizes) if (liste[i]) liste[i].gruppe = nr;
  return nr;
}

export function gruppeLoesen(liste, i) {
  const g = liste[i]?.gruppe;
  if (g === undefined) return;
  for (const a of liste) if (a.gruppe === g) delete a.gruppe;
}

/** Verschiebt einen Aufkleber samt seiner Gruppe (dx, dy in Zonen-Anteilen). */
export function verschieben(liste, i, dx, dy) {
  const a = liste[i];
  if (!a) return;
  const ziele = a.gruppe === undefined ? [a] : liste.filter((x) => x.gruppe === a.gruppe);
  for (const z of ziele) {
    z.x = klemme(runde(z.x + dx), -0.5, 1.5);
    z.y = klemme(runde(z.y + dy), -0.5, 1.5);
  }
}
