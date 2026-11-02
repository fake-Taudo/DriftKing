// Tests für Spielstand-Schema, Prüfsumme, Migration und Validierung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  neuerSpielstand, verpacke, entpacke, pruefeSpielstand, migriere, SPIELSTAND_VERSION,
  vervollstaendigeEinstellungen, standardEinstellungen, START_GUTHABEN
} from '../shared/spielstand.js';

const ID = 'testclient1234567890';

test('neuer Spielstand ist gültig und hat Startguthaben', () => {
  const d = neuerSpielstand(ID);
  assert.equal(d.version, SPIELSTAND_VERSION);
  assert.equal(d.waehrung, START_GUTHABEN);
  assert.equal(d.autos.length, 1);
  assert.equal(d.autos[0].id, 'kestrel_s');
  assert.equal(d.autos[0].looks.length, 5);
  assert.equal(d.autos[0].setups.length, 3);
  assert.deepEqual(pruefeSpielstand(d), { ok: true });
});

test('Verpacken und Entpacken ergibt denselben Spielstand', () => {
  const d = neuerSpielstand(ID);
  d.waehrung = 12345;
  const r = entpacke(verpacke(d));
  assert.equal(r.ok, true);
  assert.equal(r.daten.waehrung, 12345);
  assert.deepEqual(r.daten, d);
});

test('Manipulierte Daten werden über die Prüfsumme erkannt', () => {
  const d = neuerSpielstand(ID);
  const text = verpacke(d).replace('"waehrung":5000', '"waehrung":999999');
  const r = entpacke(text);
  assert.equal(r.ok, false);
  assert.equal(r.fehler, 'pruefsumme');
});

test('Ungültige Werte werden trotz korrekter Prüfsumme abgelehnt', () => {
  const faelle = [
    (d) => { d.waehrung = -5; },
    (d) => { d.waehrung = 1.5; },
    (d) => { d.autos = []; },
    (d) => { d.autos[0].id = 'gibtsnicht'; },
    (d) => { d.autos[0].looks.pop(); },
    (d) => { d.autos[0].tuning.motor = 9; },
    (d) => { d.autos[0].tuning.motor = 3; }, // Stufe nicht gekauft
    (d) => { d.aktivesAuto = 'onyx_rs'; },
    (d) => { d.fortschritt.strecken = ['mond']; },
    (d) => { d.besitzGlobal.push('finish:gold'); },
    (d) => { d.autos[0].looks[0].look.lack.farbe1 = 'rot'; },
    (d) => { d.autos[0].looks[0].look.aufkleber = new Array(31).fill({}); },
    (d) => { d.statistik.siege = NaN; },
    (d) => { delete d.eingeloesteCodes; },
    (d) => { d.eingeloesteCodes = [5]; }
  ];
  for (const [i, aendern] of faelle.entries()) {
    const d = neuerSpielstand(ID);
    aendern(d);
    const r = entpacke(verpacke(d));
    assert.equal(r.ok, false, `Fall ${i} hätte abgelehnt werden müssen`);
  }
});

test('Kaputtes JSON und fremde Formate werden ohne Absturz abgelehnt', () => {
  for (const eingabe of ['', '{', 'null', '[]', '{"format":"anderes"}', 'x'.repeat(10), JSON.stringify({ format: 'driftkoenig', daten: 5 })]) {
    const r = entpacke(eingabe);
    assert.equal(r.ok, false);
  }
});

test('Migration von Version 0 auf aktuelle Version', () => {
  const d = neuerSpielstand(ID);
  // Altes Format nachbauen
  const alt = JSON.parse(JSON.stringify(d));
  alt.version = 0;
  alt.muenzen = 7777;
  delete alt.waehrung;
  delete alt.besitzGlobal;
  delete alt.tagesaufgaben;
  delete alt.online;
  delete alt.buchungen;
  const r = entpacke(verpacke(alt));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.migriert, true);
  assert.equal(r.daten.version, SPIELSTAND_VERSION);
  assert.equal(r.daten.waehrung, 7777);
  assert.ok(r.daten.besitzGlobal.includes('finish:glanz'));
});

test('Spielstand der Version 1 bekommt die Liste der eingelösten Codes', () => {
  const alt = neuerSpielstand(ID);
  alt.version = 1;
  alt.waehrung = 4321;
  delete alt.eingeloesteCodes;
  const r = entpacke(verpacke(alt));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.migriert, true);
  assert.equal(r.daten.waehrung, 4321);
  assert.deepEqual(r.daten.eingeloesteCodes, []);
});

test('Spielstand aus der Zukunft wird abgelehnt', () => {
  const d = neuerSpielstand(ID);
  d.version = SPIELSTAND_VERSION + 1;
  assert.throws(() => migriere(d), /version_neuer/);
  assert.equal(entpacke(verpacke(d)).fehler, 'version_neuer');
});

test('Fehlende oder falsche Einstellungen werden mit Standardwerten ergänzt', () => {
  const e = vervollstaendigeEinstellungen({ kamera: 'motorhaube', audio: { master: 'laut' }, unbekannt: 1 });
  assert.equal(e.kamera, 'motorhaube');
  assert.equal(e.audio.master, standardEinstellungen().audio.master);
  assert.equal(e.unbekannt, undefined);
  assert.equal(e.assistenz.gegenlenken, 60);
});
