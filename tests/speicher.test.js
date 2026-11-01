// Tests für die Browser-Ablage (localStorage-Attrappe): Laden, Speichern, Backup, defekte Saves,
// Arbeitsspeicher-Rückfall sowie Export/Import (Datei-Text und Text-Code).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class LocalStorageAttrappe {
  constructor() { this.m = new Map(); this.gesperrt = false; }
  getItem(k) { if (this.gesperrt) throw new Error('gesperrt'); return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.gesperrt) throw new Error('gesperrt'); this.m.set(k, String(v)); }
  removeItem(k) { if (this.gesperrt) throw new Error('gesperrt'); this.m.delete(k); }
}

globalThis.localStorage = new LocalStorageAttrappe();
const { Speicher } = await import('../client/core/speicher.js');
const { verpacke, neuerSpielstand } = await import('../shared/spielstand.js');

beforeEach(() => {
  globalThis.localStorage = new LocalStorageAttrappe();
});

test('Erster Start legt einen neuen Spielstand an und speichert ihn', () => {
  const s = new Speicher();
  const d = s.laden();
  assert.equal(d.waehrung, 5000);
  assert.ok(localStorage.getItem('driftkoenig.v1.spielstand'));
  assert.equal(s.meldungen.length, 0);
});

test('Speichern und erneutes Laden erhält Änderungen', () => {
  const s = new Speicher();
  s.laden();
  s.daten.waehrung = 4321;
  s.daten.spielerName = 'Tester';
  s.sofortSpeichern();
  const s2 = new Speicher();
  const d2 = s2.laden();
  assert.equal(d2.waehrung, 4321);
  assert.equal(d2.spielerName, 'Tester');
});

test('Tägliches Backup wird angelegt', () => {
  const s = new Speicher();
  s.laden();
  new Speicher().laden(); // zweiter Start am selben Tag
  assert.ok(localStorage.getItem('driftkoenig.backup'));
  assert.match(localStorage.getItem('driftkoenig.backupDatum'), /^\d{4}-\d{2}-\d{2}$/);
});

test('Defekter Spielstand → letzte gültige Sicherung wird geladen', () => {
  const s = new Speicher();
  s.laden();
  s.daten.waehrung = 999;
  s.sofortSpeichern();
  new Speicher().laden(); // Backup des gültigen Stands (999) entsteht beim Laden
  localStorage.setItem('driftkoenig.v1.spielstand', '{kaputt');
  const s3 = new Speicher();
  const d3 = s3.laden();
  assert.equal(d3.waehrung, 999);
  assert.equal(s3.meldungen[0].schluessel, 'speicher.backupGeladen');
});

test('Defekter Spielstand ohne Sicherung → neuer Spielstand mit Meldung', () => {
  localStorage.setItem('driftkoenig.v1.spielstand', '{"format":"driftkoenig","pruefsumme":"x","daten":{}}');
  const s = new Speicher();
  const d = s.laden();
  assert.equal(d.waehrung, 5000);
  assert.equal(s.meldungen[0].schluessel, 'speicher.neuerSpielstand');
});

test('Alte Version im alten Schlüssel wird gefunden und migriert', () => {
  const alt = neuerSpielstand('migration1234567890');
  alt.version = 0;
  alt.muenzen = 2468;
  delete alt.waehrung;
  localStorage.setItem('driftkoenig.v0.spielstand', verpacke(alt));
  const s = new Speicher();
  const d = s.laden();
  assert.equal(d.waehrung, 2468);
  assert.equal(d.version, 1);
  assert.ok(s.meldungen.some((m) => m.schluessel === 'speicher.migriert'));
  assert.ok(localStorage.getItem('driftkoenig.v1.spielstand'));
});

test('Ohne localStorage läuft das Spiel im Arbeitsspeicher mit Hinweis', () => {
  localStorage.gesperrt = true;
  const s = new Speicher();
  const d = s.laden();
  assert.equal(s.verfuegbar, false);
  assert.equal(d.waehrung, 5000);
  assert.equal(s.meldungen[0].schluessel, 'speicher.keinSpeicher');
  d.waehrung = 10;
  assert.doesNotThrow(() => s.sofortSpeichern());
});

test('Export/Import-Rundlauf über Datei-Text und Text-Code', async () => {
  const s = new Speicher();
  s.laden();
  s.daten.waehrung = 31337;
  s.sofortSpeichern();
  const text = s.exportText();
  const code = await s.exportCode();
  assert.match(code, /^[DR][A-Za-z0-9_-]+$/);

  const ziel = new Speicher();
  ziel.laden();
  const idVorher = ziel.daten.clientId;
  assert.deepEqual(await ziel.importieren(text), { ok: true });
  assert.equal(ziel.daten.waehrung, 31337);
  assert.equal(ziel.daten.clientId, idVorher, 'Client-ID des Geräts bleibt erhalten');

  const ziel2 = new Speicher();
  ziel2.laden();
  assert.deepEqual(await ziel2.importieren(code), { ok: true });
  assert.equal(ziel2.daten.waehrung, 31337);
});

test('Ungültige Importe werden ohne Absturz abgelehnt', async () => {
  const s = new Speicher();
  s.laden();
  for (const eingabe of ['', 'Dabc!!', 'Xabc', 'D' + 'A'.repeat(50), '{"a":1}', 'R' + Buffer.from('{"format":"driftkoenig"}').toString('base64url')]) {
    const r = await s.importieren(eingabe);
    assert.equal(r.ok, false, eingabe);
  }
  assert.equal(s.daten.waehrung, 5000, 'Spielstand bleibt unverändert');
});
