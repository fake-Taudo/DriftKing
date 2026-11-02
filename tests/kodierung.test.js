// Tests für Text-Codes (Kompression + Base64URL) und den Wortfilter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kodiere, dekodiere, base64urlAusBytes, bytesAusBase64url, fnv1a } from '../shared/kodierung.js';
import { istAnstoessig, pruefeName, pruefeKennzeichen, pruefeAufkleberText } from '../shared/wortfilter.js';
import { deflateRawSync } from 'node:zlib';

test('Kodieren und Dekodieren ist verlustfrei', async () => {
  const objekt = { a: 1, text: 'Größe äöü ß – 🚗', liste: Array.from({ length: 50 }, (_, i) => i) };
  const code = await kodiere(objekt);
  assert.equal(code[0], 'D');
  assert.deepEqual(await dekodiere(code), objekt);
});

test('Base64URL-Rundlauf', () => {
  const bytes = new Uint8Array(256).map((_, i) => i);
  assert.deepEqual(bytesAusBase64url(base64urlAusBytes(bytes)), bytes);
});

test('Ungültige Codes werfen sprechende Fehler', async () => {
  await assert.rejects(dekodiere(''), /leer/);
  await assert.rejects(dekodiere('D***'), /ungueltige_zeichen/);
  await assert.rejects(dekodiere('Qabc'), /format/);
  await assert.rejects(dekodiere('Dabcdef'), /format/);
  await assert.rejects(dekodiere('R' + base64urlAusBytes(new TextEncoder().encode('{kein json'))), /json/);
});

test('Zip-Bombe wird begrenzt', async () => {
  const riesig = Buffer.alloc(5_000_000, 0x41);
  const code = 'D' + base64urlAusBytes(new Uint8Array(deflateRawSync(riesig)));
  await assert.rejects(dekodiere(code, { maxRohBytes: 100_000 }), /zu_gross/);
});

test('Prüfsumme ist stabil', () => {
  assert.equal(fnv1a('abc'), fnv1a('abc'));
  assert.notEqual(fnv1a('abc'), fnv1a('abd'));
  assert.equal(fnv1a('').length, 8);
});

test('Wortfilter erkennt Beleidigungen auch verschleiert', () => {
  for (const s of ['Arschloch', 'F1CK', 'fuuuuck', 'Sch3iße', 'b i t c h', 'NAZI']) assert.equal(istAnstoessig(s), true, s);
  for (const s of ['Drift King', 'Kestrel', 'Bastion', 'Speed 88', 'Grüße', 'Max Mustermann', 'Hasenbraten', 'KÖNIG', 'DRIFTKÖNIG', 'Honig', 'wenig', 'einig']) assert.equal(istAnstoessig(s), false, s);
  for (const s of ['niiigger', 'n1gg3r', 'SS88', 'HH88']) assert.equal(istAnstoessig(s), true, s);
});

test('Namen, Kennzeichen und Text-Aufkleber werden geprüft', () => {
  assert.equal(pruefeName('Driftfan'), null);
  assert.equal(pruefeName('a'), 'name_zu_kurz');
  assert.equal(pruefeName('x'.repeat(30)), 'name_zu_lang');
  assert.equal(pruefeName('<script>'), 'name_zeichen');
  assert.equal(pruefeKennzeichen('DRIFT1'), null);
  assert.equal(pruefeKennzeichen('VIELZULANG'), 'kennzeichen_zu_lang');
  assert.equal(pruefeKennzeichen('SS 88'), 'kennzeichen_anstoessig');
  assert.equal(pruefeAufkleberText('Team Seitwärts'), null);
  assert.equal(pruefeAufkleberText('x'.repeat(17)), 'text_zu_lang');
});
