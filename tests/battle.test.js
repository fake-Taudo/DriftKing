// Battle-Ablauf (Läufe, Rollentausch, Gleichstand) und Battle-Belohnungen/Freischaltungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleAblauf } from '../shared/battle.js';
import { battleAbschliessen, buchen, BATTLE_BELOHNUNG, PERFEKT_BONUS } from '../shared/oekonomie.js';
import { neuerSpielstand } from '../shared/spielstand.js';

/** Spielt einen Lauf: A und B bekommen als Führer/Verfolger die angegebenen Punkte. */
function lauf(b, { aF, aV, bF, bV }) {
  for (let i = 0; i < 2; i++) {
    const d = b.naechsterDurchgang();
    const fuehrerPunkte = d.fuehrer === 'A' ? aF : bF;
    const verfolgerNorm = d.fuehrer === 'A' ? bV : aV;
    b.durchgangEintragen({ fuehrerPunkte, verfolgerNorm });
  }
}

test('Rollentausch: jeder führt einmal je Lauf, Startrolle wechselt zwischen Läufen', () => {
  const b = new BattleAblauf({ format: 'bo3', seed: 7 });
  const erster = b.naechsterDurchgang().fuehrer;
  b.durchgangEintragen({ fuehrerPunkte: 80, verfolgerNorm: 50 });
  assert.notEqual(b.naechsterDurchgang().fuehrer, erster);
  b.durchgangEintragen({ fuehrerPunkte: 40, verfolgerNorm: 30 });
  assert.equal(b.naechsterDurchgang().fuehrer, erster === 'A' ? 'B' : 'A', 'neuer Lauf beginnt mit der anderen Rolle');
});

test('Best of 3: wer zuerst 2 Läufe gewinnt; Schnell: 1 Lauf', () => {
  const b = new BattleAblauf({ format: 'bo3', seed: 1 });
  lauf(b, { aF: 90, aV: 80, bF: 50, bV: 50 });
  assert.equal(b.fertig, false);
  lauf(b, { aF: 90, aV: 80, bF: 50, bV: 50 });
  assert.equal(b.fertig, true);
  assert.equal(b.sieger, 'A');
  assert.equal(b.siegeA, 2);
  const s = new BattleAblauf({ format: 'schnell', seed: 1 });
  lauf(s, { aF: 40, aV: 40, bF: 70, bV: 60 });
  assert.equal(s.fertig, true);
  assert.equal(s.sieger, 'B');
});

test('Verfolger-Punkte mit Fairness-Faktor; Laufsumme = Führer + Verfolger', () => {
  const b = new BattleAblauf({ format: 'schnell', seed: 3 });
  lauf(b, { aF: 100, aV: 80, bF: 0, bV: 80 });
  const e = b.zusammenfassung().laeufe[0];
  // A verfolgt B (Führer 0) → 80 · 0,5 = 40; B verfolgt A (Führer 100) → 80
  assert.equal(e.a.summe, 100 + 40);
  assert.equal(e.b.summe, 0 + 80);
});

test('Gleichstand (< 3 Punkte): Lauf wird wiederholt und zählt nicht zur Höchstzahl', () => {
  const b = new BattleAblauf({ format: 'schnell', seed: 5 });
  lauf(b, { aF: 60, aV: 60, bF: 60, bV: 60 });
  assert.equal(b.fertig, false);
  assert.equal(b.aktuellerLauf.wiederholung, true);
  lauf(b, { aF: 80, aV: 70, bF: 60, bV: 60 });
  assert.equal(b.fertig, true);
  assert.equal(b.sieger, 'A');
  assert.equal(b.zusammenfassung().laeufe.length, 2);
});

test('Nach zwei Wiederholungen: höhere Führer-Punktzahl entscheidet, sonst Münzwurf', () => {
  const b = new BattleAblauf({ format: 'schnell', seed: 9 });
  lauf(b, { aF: 60, aV: 60, bF: 60, bV: 60 });
  lauf(b, { aF: 60, aV: 60, bF: 60, bV: 60 });
  assert.equal(b.fertig, false);
  // Dritter Gleichstand: A führt mit 62, B mit 61 (Summen gleich genug)
  lauf(b, { aF: 62, aV: 59, bF: 61, bV: 60 });
  assert.equal(b.fertig, true);
  assert.equal(b.sieger, 'A');
  assert.equal(b.entscheidung, 'fuehrerpunkte');
  const c = new BattleAblauf({ format: 'schnell', seed: 11 });
  for (let i = 0; i < 3; i++) lauf(c, { aF: 50, aV: 50, bF: 50, bV: 50 });
  assert.equal(c.fertig, true);
  assert.equal(c.entscheidung, 'muenzwurf');
  assert.ok(['A', 'B'].includes(c.sieger));
});

test('Startrolle des ersten Laufs ist seedbar ausgelost (deterministisch)', () => {
  const a = new BattleAblauf({ seed: 'x' }).naechsterDurchgang().fuehrer;
  assert.equal(new BattleAblauf({ seed: 'x' }).naechsterDurchgang().fuehrer, a);
  const verteilung = new Set();
  for (let i = 0; i < 20; i++) verteilung.add(new BattleAblauf({ seed: i }).naechsterDurchgang().fuehrer);
  assert.equal(verteilung.size, 2);
});

const neu = () => neuerSpielstand('battletest1234567890');

test('Belohnung: Tabelle, Schnell halbiert, Erstsieg doppelt, Perfekt-Bonus', () => {
  const d = neu();
  const start = d.waehrung;
  const r = battleAbschliessen(d, { battleId: 'b1', streckeId: 'industriehof', stufe: 'profi', format: 'bo3', sieg: true, perfekt: 1 });
  assert.equal(r.belohnung, BATTLE_BELOHNUNG.profi.sieg * 2 + PERFEKT_BONUS);
  const r2 = battleAbschliessen(d, { battleId: 'b2', streckeId: 'industriehof', stufe: 'profi', format: 'schnell', sieg: true, perfekt: 0 });
  assert.equal(r2.belohnung, BATTLE_BELOHNUNG.profi.sieg / 2, 'kein zweiter Erstsieg, Schnell halbiert');
  const r3 = battleAbschliessen(d, { battleId: 'b3', streckeId: 'industriehof', stufe: 'legende', format: 'bo3', sieg: false });
  assert.equal(r3.belohnung, BATTLE_BELOHNUNG.legende.niederlage);
  assert.equal(d.waehrung, start + r.belohnung + r2.belohnung + r3.belohnung);
});

test('Doppelte Auswertung desselben Battles bucht nichts', () => {
  const d = neu();
  battleAbschliessen(d, { battleId: 'x', streckeId: 'industriehof', stufe: 'anfaenger', format: 'bo3', sieg: true });
  const g = d.waehrung;
  const r = battleAbschliessen(d, { battleId: 'x', streckeId: 'industriehof', stufe: 'anfaenger', format: 'bo3', sieg: true });
  assert.equal(r.ok, false);
  assert.equal(d.waehrung, g);
});

test('Freischaltungen: Küstenpass nach 3 Siegen auf dem Industriehof, Stufe nach 1 Sieg', () => {
  const d = neu();
  const r1 = battleAbschliessen(d, { battleId: 'f1', streckeId: 'industriehof', stufe: 'anfaenger', format: 'bo3', sieg: true });
  assert.deepEqual(r1.freischaltungen, [{ art: 'stufe', id: 'fahrer' }]);
  battleAbschliessen(d, { battleId: 'f2', streckeId: 'industriehof', stufe: 'anfaenger', format: 'bo3', sieg: false });
  battleAbschliessen(d, { battleId: 'f3', streckeId: 'industriehof', stufe: 'fahrer', format: 'bo3', sieg: true });
  assert.ok(!d.fortschritt.strecken.includes('kuestenpass'));
  const r4 = battleAbschliessen(d, { battleId: 'f4', streckeId: 'industriehof', stufe: 'fahrer', format: 'schnell', sieg: true });
  assert.ok(r4.freischaltungen.some((f) => f.art === 'strecke' && f.id === 'kuestenpass'));
  assert.ok(d.fortschritt.botStufen.includes('profi'));
  assert.ok(!d.fortschritt.strecken.includes('neonhafen'));
});

test('Buchen: kein negatives Guthaben, keine Doppelbuchung', () => {
  const d = neu();
  assert.equal(buchen(d, { betrag: -999999, id: 'k1' }).ok, false);
  assert.equal(buchen(d, { betrag: -100, id: 'k2' }).ok, true);
  assert.equal(buchen(d, { betrag: -100, id: 'k2' }).ok, false);
  assert.equal(d.waehrung, 4900);
});

import { medailleFuer, zeitangriffAbschliessen, trainingRundeAbschliessen, statistikVerbuchen, ZEITANGRIFF_BELOHNUNG } from '../shared/oekonomie.js';
import { pruefeSpielstand } from '../shared/spielstand.js';
import { GEGNER, gegnerVorschlag } from '../shared/bots/gegnerPool.js';
import { pruefeLook } from '../shared/look.js';
import { BOT_STUFEN as STUFEN_DEF } from '../shared/bots/botStufen.js';

test('Medaillen-Grenzen: 40/60/80/95', () => {
  assert.equal(medailleFuer(39.9), null);
  assert.equal(medailleFuer(40), 'bronze');
  assert.equal(medailleFuer(60), 'silber');
  assert.equal(medailleFuer(80), 'gold');
  assert.equal(medailleFuer(95), 'champion');
});

test('Zeitangriff: Erstbelohnung je Medaille, übersprungene mit, Wiederholung 25 %, keine Doppelbuchung', () => {
  const d = neu();
  const g0 = d.waehrung;
  const r1 = zeitangriffAbschliessen(d, { laufId: 'z1', streckeId: 'industriehof', punkte: 65 });
  assert.equal(r1.medaille, 'silber');
  assert.equal(r1.belohnung, ZEITANGRIFF_BELOHNUNG.bronze + ZEITANGRIFF_BELOHNUNG.silber);
  const r2 = zeitangriffAbschliessen(d, { laufId: 'z2', streckeId: 'industriehof', punkte: 62 });
  assert.equal(r2.belohnung, Math.round(ZEITANGRIFF_BELOHNUNG.silber * 0.25));
  assert.equal(r2.neuerBestwert, false);
  const r3 = zeitangriffAbschliessen(d, { laufId: 'z3', streckeId: 'industriehof', punkte: 96 });
  assert.equal(r3.belohnung, ZEITANGRIFF_BELOHNUNG.gold + ZEITANGRIFF_BELOHNUNG.champion);
  assert.equal(d.fortschritt.medaillen.industriehof, 'champion');
  const r4 = zeitangriffAbschliessen(d, { laufId: 'z3', streckeId: 'industriehof', punkte: 96 });
  assert.equal(r4.ok, false);
  assert.equal(d.waehrung, g0 + r1.belohnung + r2.belohnung + r3.belohnung);
  // Weg-unabhängig: direkt Champion zahlt dieselbe Summe wie schrittweise
  const e = neu();
  const direkt = zeitangriffAbschliessen(e, { laufId: 'x', streckeId: 'industriehof', punkte: 99 });
  assert.equal(direkt.belohnung, r1.belohnung + r3.belohnung);
  // Schlechte Medaille nach besserer: nur 25 % der erreichten
  const r5 = zeitangriffAbschliessen(e, { laufId: 'y', streckeId: 'industriehof', punkte: 45 });
  assert.equal(r5.belohnung, Math.round(ZEITANGRIFF_BELOHNUNG.bronze * 0.25));
  assert.equal(e.fortschritt.medaillen.industriehof, 'champion');
  assert.equal(pruefeSpielstand(d).ok, true);
});

test('Training: Bonus 50–150 nur bei Bestwert mit ≥ 5 Punkten Vorsprung', () => {
  const d = neu();
  const g0 = d.waehrung;
  assert.equal(trainingRundeAbschliessen(d, { laufId: 't1', streckeId: 'industriehof', punkte: 15 }).bonus, 0, 'unter 20 Punkten kein Bonus');
  const a = trainingRundeAbschliessen(d, { laufId: 't2', streckeId: 'industriehof', punkte: 42 });
  assert.equal(a.bonus, 92);
  assert.equal(trainingRundeAbschliessen(d, { laufId: 't3', streckeId: 'industriehof', punkte: 45 }).bonus, 0, 'nur 3 Punkte besser');
  assert.equal(trainingRundeAbschliessen(d, { laufId: 't4', streckeId: 'industriehof', punkte: 47.5 }).bonus, 98);
  assert.equal(trainingRundeAbschliessen(d, { laufId: 't5', streckeId: 'industriehof', punkte: 100 }).bonus, 150);
  assert.equal(trainingRundeAbschliessen(d, { laufId: 't5', streckeId: 'industriehof', punkte: 100 }).ok, false);
  assert.equal(d.waehrung, g0 + 92 + 98 + 150);
  assert.equal(d.fortschritt.bestwerte.industriehof.training, 100);
  assert.equal(pruefeSpielstand(d).ok, true);
});

test('Statistik wird aufsummiert und bleibt gültig', () => {
  const d = neu();
  statistikVerbuchen(d, { punkte: 71.6, wand: 2, laengsterDrift: 4.24, besterWinkel: 51.2 });
  statistikVerbuchen(d, { punkte: 50, wand: 1, laengsterDrift: 3, besterWinkel: 60 });
  assert.equal(d.statistik.punkteGesamt, 122);
  assert.equal(d.statistik.wandkontakte, 3);
  assert.equal(d.statistik.laengsterDrift, 4.2);
  assert.equal(d.statistik.besterWinkel, 60);
  assert.equal(pruefeSpielstand(d).ok, true);
});

test('Gegner-Pool: ≥ 15 Fahrer, jede Stufe besetzt, gültige Looks, eindeutige IDs und Namen', () => {
  assert.ok(GEGNER.length >= 15);
  assert.equal(new Set(GEGNER.map((g) => g.id)).size, GEGNER.length);
  assert.equal(new Set(GEGNER.map((g) => g.name)).size, GEGNER.length);
  for (const st of STUFEN_DEF) assert.ok(GEGNER.filter((g) => g.stufe === st.id).length >= 3, st.id);
  for (const g of GEGNER) {
    assert.equal(g.look.auto, g.autoId);
    assert.deepEqual(pruefeLook(g.look), { ok: true }, g.id);
  }
});

test('Gegner-Vorschlag folgt dem Fortschritt', () => {
  const d = neu();
  assert.equal(gegnerVorschlag(d, 'industriehof').stufe, 'anfaenger');
  battleAbschliessen(d, { battleId: 'v1', streckeId: 'industriehof', stufe: 'anfaenger', format: 'bo3', sieg: true });
  assert.equal(gegnerVorschlag(d, 'industriehof').stufe, 'fahrer');
  // Auf einer anderen Strecke fehlt der Erstsieg gegen Anfänger noch
  assert.equal(gegnerVorschlag(d, 'kuestenpass').stufe, 'anfaenger');
});
