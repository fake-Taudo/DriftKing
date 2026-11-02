// Texte: Jeder im Code verwendete Schlüssel steht in client/i18n/de.js, und im Code gibt es keine Platzhalter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXTE } from '../client/i18n/de.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function dateien(ordner, liste = []) {
  for (const n of readdirSync(ordner)) {
    const p = path.join(ordner, n);
    if (statSync(p).isDirectory()) dateien(p, liste);
    else if (n.endsWith('.js')) liste.push(p);
  }
  return liste;
}
const quellen = dateien(path.join(wurzel, 'client')).filter((d) => !d.endsWith(path.join('i18n', 'de.js')));
const hat = (schluessel) => schluessel.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), TEXTE) !== undefined;

test('Alle festen Textschlüssel im Code gibt es wirklich', () => {
  const fehlend = [];
  let anzahl = 0;
  for (const d of quellen) {
    const code = readFileSync(d, 'utf8');
    // Zusammengesetzte Schlüssel ('…toenung' + s) lassen sich so nicht prüfen und zählen nicht
    for (const m of code.matchAll(/\bt\('([a-zA-Z_]+(?:\.[a-zA-Z0-9_]+)+)'(?!\s*\+)/g)) {
      anzahl++;
      if (!hat(m[1])) fehlend.push(`${path.relative(wurzel, d)}: ${m[1]}`);
    }
  }
  assert.ok(anzahl > 300, `nur ${anzahl} Schlüssel gefunden`);
  assert.deepEqual(fehlend, []);
});

test('Zusammengesetzte Schlüssel des Online-Duells sind vollständig', () => {
  const k = TEXTE.online;
  for (const g of ['aufgabe', 'verbindung', 'afk', 'regelverstoss', 'verlassen']) {
    assert.ok(k.grund[g + 'Sieg'], g + 'Sieg');
    assert.ok(k.grund[g + 'Niederlage'], g + 'Niederlage');
  }
  for (const f of ['code_ungueltig', 'code_abgelaufen', 'code_benutzt', 'eigenes_duell', 'zu_viele_versuche', 'zu_viele_nachrichten', 'look_ungueltig', 'strecke_gesperrt', 'nur_gastgeber', 'kein_hallo', 'kein_lobby', 'felder', 'format', 'keine_verbindung', 'unbekannt']) {
    assert.ok(k.fehler[f], f);
  }
  for (const g of ['gegner_weg', 'code_abgelaufen', 'inaktiv']) assert.ok(k.lobbyEnde[g], g);
  for (const e of ['gg', 'respekt', 'lol', 'wow', 'nochmal', 'danke']) assert.ok(k.emote[e], e);
});

test('Keine Platzhalter und keine toten Einträge im Code', () => {
  const treffer = [];
  for (const d of quellen) {
    const code = readFileSync(d, 'utf8');
    for (const z of code.split('\n')) {
      if (/kommt später|coming soon|\bTODO\b|\bFIXME\b|lorem ipsum/i.test(z)) treffer.push(`${path.relative(wurzel, d)}: ${z.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(treffer, []);
  const texte = JSON.stringify(TEXTE);
  assert.ok(!/kommt später|coming soon|lorem ipsum/i.test(texte), 'Platzhalter in den Texten');
});
