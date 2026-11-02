// Garage-Logik: Aufkleber-Bibliothek, Kaufen und Anprobe, Editor-Schritte, Verlauf, Look-Code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUFKLEBER, AUFKLEBER_IDS, aufkleberKaufId } from '../client/assets/aufkleber.js';
import { AUFKLEBER_PAKETE, MUSTER, FELGEN, FINISHS, teilInfo, SLOTS } from '../shared/teile.js';
import { neuerSpielstand, pruefeSpielstand } from '../shared/spielstand.js';
import { standardLook, pruefeLook, lookZuCode, codeZuLook, MAX_AUFKLEBER, MAX_LOOK_CODE_BYTES, ZONEN, kopiereLook } from '../shared/look.js';
import { kaufen, besitzt, lookBedarf, lookKaufIds, tuningEinbauen, anprobeEntfernen } from '../shared/oekonomie.js';
import { Verlauf } from '../shared/verlauf.js';
import * as ops from '../shared/aufkleberOps.js';
import { kodiere } from '../shared/kodierung.js';
import { AUTO_IDS } from '../shared/autos.js';

const neu = () => neuerSpielstand('garagetest1234567890');
const OPT = { aufkleberIds: AUFKLEBER_IDS };

test('Bibliothek: mindestens 60 Aufkleber, eindeutige IDs, alle Kategorien besetzt, gültige Pfade', () => {
  assert.ok(AUFKLEBER.length >= 60, `nur ${AUFKLEBER.length}`);
  assert.equal(AUFKLEBER_IDS.size, AUFKLEBER.length);
  const pakete = new Set(AUFKLEBER_PAKETE.map((p) => p.id));
  for (const a of AUFKLEBER) {
    assert.ok(/^[a-z0-9_]{1,32}$/.test(a.id), a.id);
    assert.ok(pakete.has(a.paket), a.id);
    assert.ok(a.pfad.length > 5 && /^[MLHVCQAZ0-9 .\-]+$/.test(a.pfad), `Pfad von ${a.id}`);
    assert.ok(teilInfo(aufkleberKaufId(a.id)), a.id);
  }
  for (const p of pakete) if (p !== 'text') assert.ok(AUFKLEBER.some((a) => a.paket === p), p);
});

test('Katalog: mindestens 12 Muster und Felgen, 6 Finishs, je Slot mindestens 3 Varianten, 5 Spoiler', () => {
  assert.ok(MUSTER.filter((m) => m.id !== 'keins').length >= 12);
  assert.ok(FELGEN.length >= 12);
  assert.equal(FINISHS.length, 6);
  for (const s of SLOTS) assert.ok(s.varianten.length - 1 >= 3, s.id);
  assert.ok(SLOTS.find((s) => s.id === 'spoiler').varianten.length - 1 >= 5);
});

test('Kaufen: atomar, kein Doppelkauf, nicht leistbar zeigt den fehlenden Betrag', () => {
  const d = neu();
  const g = d.waehrung;
  const r = kaufen(d, 'finish:matt', 'kestrel_s');
  assert.equal(r.ok, true);
  assert.equal(d.waehrung, g - teilInfo('finish:matt').preis);
  assert.ok(d.besitzGlobal.includes('finish:matt'));
  const g2 = d.waehrung;
  const nochmal = kaufen(d, 'finish:matt', 'kestrel_s');
  assert.equal(nochmal.ok, true);
  assert.equal(nochmal.preis, 0, 'schon im Besitz: kostet nichts');
  assert.equal(d.waehrung, g2);
  d.waehrung = 100;
  const teuer = kaufen(d, 'finish:chrom', 'kestrel_s');
  assert.equal(teuer.ok, false);
  assert.equal(teuer.grund, 'guthaben');
  assert.equal(teuer.fehlt, teilInfo('finish:chrom').preis - 100);
  assert.ok(!d.besitzGlobal.includes('finish:chrom'));
  assert.equal(d.waehrung, 100);
  assert.equal(pruefeSpielstand(d, OPT).ok, true);
});

test('Kaufen mehrerer Teile: alles oder nichts; unbekannte IDs werden abgelehnt', () => {
  const d = neu();
  d.waehrung = 500;
  const r = kaufen(d, ['finish:matt', 'finish:chrom'], 'kestrel_s');
  assert.equal(r.ok, false);
  assert.ok(!d.besitzGlobal.includes('finish:matt'), 'kein Teilkauf');
  assert.equal(d.waehrung, 500);
  assert.equal(kaufen(d, 'finish:gibtsnicht', 'kestrel_s').grund, 'unbekannt');
  assert.equal(kaufen(d, 'teil:spoiler:1', 'onyx_rs').grund, 'auto', 'Teil für ein nicht besessenes Auto');
});

test('Autogebundene Teile gelten nur für dieses Auto', () => {
  const d = neu();
  assert.equal(kaufen(d, 'teil:spoiler:1', 'kestrel_s').ok, true);
  assert.equal(besitzt(d, 'teil:spoiler:1', 'kestrel_s'), true);
  assert.equal(besitzt(d, 'teil:spoiler:1', 'onyx_rs'), false);
  assert.equal(besitzt(d, 'teil:spoiler:0', 'onyx_rs'), true, 'Serie ist kostenlos');
});

test('Serien-Look braucht nichts; Anprobe listet genau die fehlenden Teile mit Summe', () => {
  const d = neu();
  for (const id of AUTO_IDS) assert.deepEqual(lookBedarf(d, id, standardLook(id)).teile, [], id);
  const l = standardLook('kestrel_s');
  l.lack.finish = 'metallic';
  l.teile.spoiler.variante = 4;
  l.neon.an = true;
  const b = lookBedarf(d, 'kestrel_s', l);
  assert.deepEqual(b.teile.map((t) => t.id).sort(), ['extra:neon', 'finish:metallic', 'teil:spoiler:4'].sort());
  assert.equal(b.summe, b.teile.reduce((s, t) => s + t.preis, 0));
  assert.equal(kaufen(d, b.teile.map((t) => t.id), 'kestrel_s').ok, true);
  assert.deepEqual(lookBedarf(d, 'kestrel_s', l).teile, []);
});

test('Anprobe verwerfen: nur Ungekauftes geht zurück, freie Änderungen bleiben, danach kein Bedarf', () => {
  const d = neu();
  const gespeichert = standardLook('kestrel_s');
  const l = kopiereLook(gespeichert);
  l.lack.farbe1 = '#123456'; // kostenlos
  l.lack.finish = 'chrom';
  l.muster = { id: 'flammen', farbe: '#ff0000', deckkraft: 0.5, skala: 2 };
  l.felgen.design = 'netz';
  l.felgen.farbe = '#00ff00'; // kostenlos
  l.teile.spoiler = { variante: 5, farbe: '#ffffff' };
  l.qualm = '#123456';
  l.neon.an = true;
  l.scheiben = 3;
  l.scheinwerfer = '#ffee00';
  l.rueckDesign = 2;
  l.backfire = 1;
  l.aufkleber.push(ops.neuerAufkleber('kreis'), ops.neuerAufkleber('flamme'));
  const b = lookBedarf(d, 'kestrel_s', l);
  assert.ok(b.teile.length >= 9);
  anprobeEntfernen(l, gespeichert, b.teile.map((t) => t.id));
  assert.deepEqual(lookBedarf(d, 'kestrel_s', l).teile, []);
  assert.equal(l.lack.farbe1, '#123456');
  assert.equal(l.felgen.farbe, '#00ff00');
  assert.deepEqual(l.aufkleber.map((a) => a.id), ['kreis'], 'kostenlose Aufkleber bleiben');
  assert.deepEqual(pruefeLook(l, OPT), { ok: true });
});

test('Look-Kaufkennungen: Qualm, Licht, Rücklicht, Tönung, Backfire, Aufkleber-Pakete', () => {
  const l = standardLook('marlin_4d');
  l.qualm = '#123456';
  l.scheinwerfer = '#ffee00';
  l.rueckDesign = 1;
  l.scheiben = 2;
  l.backfire = 0.5;
  l.aufkleber.push(ops.neuerAufkleber('stern5'), ops.neuerAufkleber('text', 'haube', { text: 'HALLO', schrift: 'bungee' }));
  const ids = lookKaufIds('marlin_4d', l);
  for (const x of ['qualm:frei', 'extra:lichtfarbe', 'extra:ruecklicht', 'extra:toenung', 'extra:backfire', 'aufkleber:sterne', 'aufkleber:text']) assert.ok(ids.includes(x), x);
  const m = standardLook('marlin_4d');
  m.qualm = 'regenbogen';
  assert.ok(lookKaufIds('marlin_4d', m).includes('qualm:regenbogen'));
  m.qualm = '#FF3B3B';
  assert.ok(lookKaufIds('marlin_4d', m).includes('qualm:rot'), 'Preset unabhängig von Groß-/Kleinschreibung');
});

test('Tuning: nur gekaufte Stufen lassen sich einbauen, Serie immer', () => {
  const d = neu();
  assert.equal(tuningEinbauen(d, 'kestrel_s', 'motor', 3), false);
  assert.equal(d.autos[0].tuning.motor, 1);
  assert.equal(kaufen(d, 'tuning:motor:3', 'kestrel_s').ok, true);
  assert.equal(tuningEinbauen(d, 'kestrel_s', 'motor', 3), true);
  assert.equal(d.autos[0].tuning.motor, 3);
  assert.equal(tuningEinbauen(d, 'kestrel_s', 'motor', 1), true);
  assert.equal(pruefeSpielstand(d, OPT).ok, true);
});

test('Editor: Ebenen-Grenze, Duplizieren, Löschen, Reihenfolge', () => {
  const l = [];
  for (let i = 0; i < MAX_AUFKLEBER; i++) assert.equal(ops.hinzufuegen(l, ops.neuerAufkleber('kreis')), i);
  assert.ok(MAX_AUFKLEBER >= 30);
  assert.equal(ops.hinzufuegen(l, ops.neuerAufkleber('kreis')), -1, 'mehr als das Maximum geht nicht');
  assert.equal(ops.duplizieren(l, 0), -1);
  ops.loeschen(l, 0);
  assert.equal(ops.duplizieren(l, 0), 1);
  assert.equal(l.length, MAX_AUFKLEBER);
  l[0].farbe = '#111111';
  assert.equal(ops.ebeneVerschieben(l, 0, 1), 1);
  assert.equal(l[1].farbe, '#111111');
  assert.equal(ops.ebeneVerschieben(l, 0, -1), 0, 'unterste Ebene bleibt');
});

test('Auf andere Seite spiegeln: Zone, x, Drehung; Formen gespiegelt, Text lesbar', () => {
  const l = [{ ...ops.neuerAufkleber('blitz1', 'seiteL'), x: 0.2, rot: 15 }];
  const i = ops.aufAndereSeite(l, 0);
  assert.equal(l[i].zone, 'seiteR');
  assert.equal(l[i].x, 0.8);
  assert.equal(l[i].rot, -15);
  assert.equal(l[i].spiegel, true);
  l.push(ops.neuerAufkleber('text', 'seiteR', { text: 'DRIFT', schrift: 'teko' }));
  const j = ops.aufAndereSeite(l, l.length - 1);
  assert.equal(l[j].zone, 'seiteL');
  assert.equal(l[j].spiegel, false);
  const look = standardLook('kestrel_s');
  look.aufkleber = l;
  assert.deepEqual(pruefeLook(look, OPT), { ok: true });
});

test('Gruppen: gemeinsames Verschieben, Lösen, Werte bleiben im gültigen Bereich', () => {
  const l = [ops.neuerAufkleber('kreis'), ops.neuerAufkleber('ring'), ops.neuerAufkleber('plus')];
  ops.gruppeSetzen(l, [0, 1]);
  ops.verschieben(l, 0, 0.1, -0.2);
  assert.equal(l[1].x, 0.6);
  assert.equal(l[2].x, 0.5, 'nicht in der Gruppe');
  ops.verschieben(l, 2, 5, 5);
  assert.equal(l[2].x, 1.5);
  ops.gruppeLoesen(l, 0);
  assert.equal(l[0].gruppe, undefined);
  assert.equal(l[1].gruppe, undefined);
});

test('Text-Aufkleber mit Wortfilter: Ungültiges wird nicht hinzugefügt', () => {
  const l = [];
  assert.equal(ops.hinzufuegen(l, ops.neuerAufkleber('text', 'haube', { text: '', schrift: 'teko' })), -1);
  assert.equal(ops.hinzufuegen(l, ops.neuerAufkleber('text', 'haube', { text: 'ZU LANGER TEXT FÜR DAS FELD', schrift: 'teko' })), -1);
  assert.equal(ops.hinzufuegen(l, ops.neuerAufkleber('text', 'haube', { text: 'KÖNIG 7', schrift: 'teko' })), 0);
});

test('Verlauf: mindestens 30 Schritte rückgängig und wieder vor; neue Änderung löscht Wiederholen', () => {
  const v = new Verlauf();
  let z = { n: 0 };
  for (let i = 1; i <= 35; i++) { v.merken(z); z = { n: i }; }
  for (let i = 34; i >= 0; i--) { z = v.rueckgaengig(z); assert.equal(z.n, i); }
  assert.equal(v.rueckgaengig(z), null);
  z = v.wiederholen(z);
  assert.equal(z.n, 1);
  v.merken(z);
  assert.equal(v.kannVor, false);
});

test('Verlauf-Abbilder sind unabhängig von späteren Änderungen', () => {
  const v = new Verlauf();
  const look = standardLook('kestrel_s');
  v.merken(look);
  look.lack.farbe1 = '#000000';
  assert.notEqual(v.rueckgaengig(look).lack.farbe1, '#000000');
});

test('Look-Code: Rundreise mit Aufklebern; auch 30 Text-Ebenen bleiben unter 8 KB', async () => {
  const l = standardLook('onyx_rs');
  const zufall = (i) => ((i * 2654435761) >>> 0) / 4294967296;
  for (let i = 0; i < MAX_AUFKLEBER; i++) {
    l.aufkleber.push({
      id: 'text', text: 'FAHRER ' + (i % 90 + 10), schrift: 'bungee', zone: ZONEN[i % ZONEN.length],
      x: Math.round(zufall(i) * 1000) / 1000, y: Math.round(zufall(i + 40) * 1000) / 1000,
      rot: Math.round(zufall(i + 80) * 3600) / 10, skala: Math.round(zufall(i + 120) * 1000 + 100) / 1000,
      farbe: '#' + ((zufall(i + 160) * 0xffffff) >>> 0).toString(16).padStart(6, '0'),
      spiegel: i % 2 === 0, deckkraft: Math.round(zufall(i + 200) * 100) / 100
    });
  }
  const code = await lookZuCode(l);
  assert.ok(code.length <= MAX_LOOK_CODE_BYTES, `Code ist ${code.length} Zeichen lang`);
  const r = await codeZuLook(code, { ...OPT, autoId: 'onyx_rs' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.look, l);
});

test('Look-Code: ungültige Eingaben werden mit Grund abgelehnt, ohne Absturz', async () => {
  const gut = await lookZuCode(standardLook('kestrel_s'));
  assert.equal((await codeZuLook('', OPT)).fehler, 'leer');
  assert.equal((await codeZuLook('das ist kein code', OPT)).ok, false);
  assert.equal((await codeZuLook(gut.slice(0, gut.length - 5), OPT)).ok, false);
  assert.equal((await codeZuLook('x'.repeat(MAX_LOOK_CODE_BYTES + 1), OPT)).fehler, 'zu_gross');
  assert.equal((await codeZuLook(gut, { ...OPT, autoId: 'onyx_rs' })).fehler, 'falsches_auto');
  for (const aendern of [
    (l) => { l.aufkleber = new Array(MAX_AUFKLEBER + 1).fill(ops.neuerAufkleber('kreis')); },
    (l) => { l.aufkleber = [ops.neuerAufkleber('gibtsnicht')]; },
    (l) => { l.aufkleber = [ops.neuerAufkleber('text', 'haube', { text: 'A'.repeat(17), schrift: 'teko' })]; },
    (l) => { l.felgen.groesse = 99; },
    (l) => { l.teile.spoiler.variante = 99; },
    (l) => { l.fremd = 1; },
    (l) => { l.kennzeichen = 'VIEL ZU LANGES SCHILD'; }
  ]) {
    const l = kopiereLook(standardLook('kestrel_s'));
    aendern(l);
    const r = await codeZuLook(await kodiere(l), OPT);
    assert.equal(r.ok, false);
    assert.equal(r.fehler, 'schema');
  }
});
