// Wertungs-Tests: Formeln und Grenzfälle, Normierung, Verfolger-Faktor, Combo, Abzüge, Determinismus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fWinkel, fAbstand, fGleichwinkel, fLinie, fTempo, verfolgerEndpunkte, Wertung, abstandsBewertung } from '../shared/wertung.js';
import { WERTUNG as W } from '../shared/wertungsParameter.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import industriehof from '../shared/strecken/industriehof.js';
import { autoDaten } from '../shared/autos.js';

const nah = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const S = baueStrecke(industriehof);
const AB = autoDaten('kestrel_s').abmessungen;

/** Zustand auf der Ideallinie an Probe i mit Driftwinkel (Grad, + = links) und Tempo (m/s). */
function zustand(i, winkelGrad, tempo, querVersatz = 0) {
  const p = S.proben[i];
  const x = S.ideal.x[i] + p.nx * querVersatz, y = S.ideal.y[i] + p.ny * querVersatz;
  const b = (winkelGrad * Math.PI) / 180;
  // Bewegungsrichtung = Streckenrichtung; Nase um +winkel gedreht → Schwimmwinkel = −winkel
  const theta = p.richtung + b;
  return { x, y, theta, vx: tempo * Math.cos(-b), vy: tempo * Math.sin(-b) };
}

function ersteZonenProbe() {
  const z = S.zonen[0];
  return (z.von + 15) % S.anzahl;
}

test('f_winkel: Trapez 10°/30°/55°/85°', () => {
  assert.equal(fWinkel(10), 0);
  assert.ok(nah(fWinkel(20), 0.5));
  assert.equal(fWinkel(30), 1);
  assert.equal(fWinkel(42), 1);
  assert.equal(fWinkel(55), 1);
  assert.ok(nah(fWinkel(70), 0.5));
  assert.equal(fWinkel(85), 0);
  assert.equal(fWinkel(-40), 1);
  assert.equal(fWinkel(5), 0);
});

test('f_tempo: begrenzt auf 0 … 1,2', () => {
  assert.equal(fTempo(10, 20), 0.5);
  assert.equal(fTempo(40, 20), 1.2);
  assert.equal(fTempo(5, 0), 0);
});

test('f_linie: 1,0 auf der Linie, 0,4 ab Toleranz', () => {
  assert.equal(fLinie(0), 1);
  assert.ok(nah(fLinie(W.linienToleranz / 2), 0.7));
  assert.ok(nah(fLinie(W.linienToleranz), 0.4));
  assert.ok(nah(fLinie(-50), 0.4));
});

test('f_abstand: Sweet-Spot 6–10 m, 0 bei 30 m, 0,5 bei 3 m', () => {
  for (const d of [5, 6, 8, 10]) assert.equal(fAbstand(d), 1, `d=${d}`);
  assert.ok(nah(fAbstand(20), 0.5));
  assert.equal(fAbstand(30), 0);
  assert.equal(fAbstand(45), 0);
  assert.ok(nah(fAbstand(4), 0.75));
  assert.ok(nah(fAbstand(3), 0.5));
  assert.equal(fAbstand(0), 0);
  assert.equal(abstandsBewertung(8), 'gut');
  assert.equal(abstandsBewertung(25), 'schlecht');
});

test('f_gleichwinkel: 1 − |Δ| / 30°', () => {
  assert.equal(fGleichwinkel(0), 1);
  assert.ok(nah(fGleichwinkel(15), 0.5));
  assert.equal(fGleichwinkel(-30), 0);
  assert.equal(fGleichwinkel(60), 0);
});

test('Verfolger-Faktor: Norm · (0,5 + 0,5 · Führer / 100)', () => {
  assert.equal(verfolgerEndpunkte(80, 100), 80);
  assert.equal(verfolgerEndpunkte(80, 0), 40);
  assert.equal(verfolgerEndpunkte(80, 50), 60);
  assert.equal(verfolgerEndpunkte(150, 100), 100);
});

test('Führer: feste Eingaben ergeben feste Punkte (Rohwert = Produkt der Faktoren × Combo)', () => {
  const w = new Wertung(S, 'fuehrer', { abmessungen: AB, referenz: 100 });
  const i = ersteZonenProbe();
  const zone = S.zonen[S.zoneVon[i]];
  const v = zone.referenzTempo; // f_tempo = 1
  w.tick(zustand(i, 40, v), null, 0);
  // 1. Tick: Combo wächst vor der Wertung um 0,1/20
  const combo1 = 1 + W.comboProSekunde / W.tickRate;
  assert.ok(nah(w.roh, combo1 * fWinkel(40) * 1 * W.zoneInnen * 1, 1e-6), `roh=${w.roh}`);
  // Kein Drift → keine Punkte
  const w2 = new Wertung(S, 'fuehrer', { abmessungen: AB, referenz: 100 });
  w2.tick(zustand(i, 5, v), null, 0);
  assert.equal(w2.roh, 0);
  // Zu langsam → keine Punkte
  w2.tick(zustand(i, 40, 30 / 3.6), null, 0.05);
  assert.equal(w2.roh, 0);
});

test('Normierung: Punkte = 100 · Roh / Referenz, begrenzt auf 0–100', () => {
  const w = new Wertung(S, 'fuehrer', { abmessungen: AB, referenz: 50 });
  w.roh = 25;
  assert.equal(w.punkte, 50);
  w.roh = 500;
  assert.equal(w.punkte, 100);
  w.roh = 0;
  w.abzuege = 10;
  assert.equal(w.punkte, 0);
});

test('Combo wächst ca. 0,1/s bei sauberem Driften und fällt nach Pausen zurück', () => {
  const w = new Wertung(S, 'fuehrer', { abmessungen: AB, referenz: 100 });
  const zone = S.zonen[0];
  let i = zone.von;
  for (let k = 0; k < 10 * W.tickRate; k++) {
    w.tick(zustand(i, 40, 15), null, k / W.tickRate);
    i = (i + 1) % S.anzahl;
  }
  assert.ok(nah(w.combo, 2.0, 1e-6), `Combo ${w.combo}`);
  for (let k = 0; k < 1.5 * W.tickRate; k++) w.tick(zustand(i, 0, 15), null, 10 + k / W.tickRate);
  assert.equal(w.combo, 1);
});

test('Wandkontakt: Abzug, Combo-Reset, 1 s Wertungssperre', () => {
  const w = new Wertung(S, 'fuehrer', { abmessungen: AB, referenz: 100 });
  const i = ersteZonenProbe();
  for (let k = 0; k < 40; k++) w.tick(zustand(i + k, 40, 15), null, k / 20);
  assert.ok(w.combo > 1);
  // Auto direkt an die Wand setzen
  const p = S.proben[i];
  const rand = S.def.segmente[p.seg]?.rand ?? S.def.rand;
  const aussen = { ...zustand(i, 40, 15) };
  aussen.x = p.x + p.nx * (p.breite / 2 + rand - 0.5);
  aussen.y = p.y + p.ny * (p.breite / 2 + rand - 0.5);
  // Wand nahe der aktuellen Position (Probe i + 41)
  const pw = S.proben[i + 41];
  aussen.x = pw.x + pw.nx * (pw.breite / 2 + rand - 0.5);
  aussen.y = pw.y + pw.ny * (pw.breite / 2 + rand - 0.5);
  const ev = w.tick(aussen, null, 2.0);
  assert.ok(ev.some((e) => e.art === 'wand'));
  assert.equal(w.abzuege, W.abzugWand);
  assert.equal(w.combo, 1);
  const vorher = w.roh;
  w.tick(zustand(i + 43, 40, 15), null, 2.5);
  assert.equal(w.roh, vorher, 'während der Sperre keine Punkte');
  w.tick(zustand(i + 46, 40, 15), null, 3.2);
  assert.ok(w.roh > vorher, 'nach der Sperre wieder Punkte');
});

test('Dreher setzt die Combo zurück, Zurücksetzen kostet großen Abzug', () => {
  const w = new Wertung(S, 'fuehrer', { abmessungen: AB, referenz: 100 });
  const i = ersteZonenProbe();
  for (let k = 0; k < 40; k++) w.tick(zustand(i, 40, 15), null, k / 20);
  const ev = w.tick(zustand(i, 120, 15), null, 2.05);
  assert.ok(ev.some((e) => e.art === 'spin'));
  assert.equal(w.combo, 1);
  w.tick({ ...zustand(i, 0, 5), zurueckgesetzt: true }, null, 3);
  assert.equal(w.abzuege, W.abzugZuruecksetzen);
  const t = new Wertung(S, 'einzel', { abmessungen: AB, referenz: 100, resetStrafe: false });
  t.tick({ ...zustand(i, 0, 5), zurueckgesetzt: true }, null, 3);
  assert.equal(t.abzuege, 0, 'im Training ohne Abzug');
});

test('Flüssigkeit: Wechsel nach gehaltenem Drift gibt Bonus, Zickzack-Wackeln nicht', () => {
  const i = ersteZonenProbe();
  const w = new Wertung(S, 'fuehrer', { abmessungen: AB, referenz: 100 });
  let t = 0, k = 0;
  for (; t < 1.5; t += 0.05) w.tick(zustand(i + k++, 40, 15), null, t); // 1,5 s Linksdrift
  w.tick(zustand(i + k++, 2, 15), null, t); t += 0.4;
  const ev = w.tick(zustand(i + k++, -40, 15), null, t);
  assert.ok(ev.some((e) => e.art === 'fluessig'));
  assert.equal(w.boni, W.fluessigBonus);
  // Zu langsamer Wechsel: kein Bonus
  const w2 = new Wertung(S, 'fuehrer', { abmessungen: AB, referenz: 100 });
  k = 0;
  for (t = 0; t < 1.5; t += 0.05) w2.tick(zustand(i + k++, 40, 15), null, t);
  w2.tick(zustand(i + k++, -40, 15), null, t + 2.0);
  assert.equal(w2.boni, 0);
  // Schnelles Hin-und-her ohne gehaltenen Drift: kein Bonus
  const w3 = new Wertung(S, 'fuehrer', { abmessungen: AB, referenz: 100 });
  k = 0;
  for (t = 0; t < 6; t += 0.05) w3.tick(zustand(i + k++, Math.sin(t * 6) > 0 ? 20 : -20, 15), null, t);
  assert.equal(w3.boni, 0);
});

test('Verfolger: keine Punkte in der Aufschließphase, danach Abstand × Gleichwinkel', () => {
  const w = new Wertung(S, 'verfolger', { abmessungen: AB, referenz: 100 });
  const i = ersteZonenProbe();
  const fuehrer = zustand((i + 8) % S.anzahl, 40, 15);
  w.tick(zustand(i, 40, 15), fuehrer, 1.0);
  assert.equal(w.roh, 0);
  w.tick(zustand(i + 1, 40, 15), fuehrer, 3.1);
  assert.ok(w.roh > 0.9 && w.roh < 1.1, `roh=${w.roh}`);
  // Gegenläufiger Winkel → Gleichwinkel 0
  const w2 = new Wertung(S, 'verfolger', { abmessungen: AB, referenz: 100 });
  w2.tick(zustand(i, -40, 15), fuehrer, 4);
  w2.tick(zustand(i + 1, -40, 15), fuehrer, 4.05);
  assert.equal(w2.roh, 0);
});

test('Autokontakt: kleiner Abzug, nicht mehrfach pro Berührung', () => {
  const w = new Wertung(S, 'verfolger', { abmessungen: AB, referenz: 100 });
  const i = ersteZonenProbe();
  const a = zustand(i, 20, 15);
  w.tick(a, { ...a, x: a.x + 0.5 }, 4);
  w.tick(a, { ...a, x: a.x + 0.5 }, 4.05);
  assert.equal(w.statistik.kontakte, 1);
  assert.equal(w.abzuege, W.abzugAutoKontakt);
});

test('Determinismus: gleiche Zustandsfolge → gleiche Punkte', () => {
  const lauf = () => {
    const w = new Wertung(S, 'fuehrer', { abmessungen: AB });
    let i = S.zonen[0].von;
    for (let k = 0; k < 400; k++) {
      w.tick(zustand(i, 25 + 20 * Math.sin(k / 15), 14 + Math.cos(k / 9), Math.sin(k / 20) * 3), null, k / 20);
      i = (i + 2) % S.anzahl;
    }
    return w.aufschluesselung();
  };
  assert.deepEqual(lauf(), lauf());
});

test('Kein Punkte-Farmen: Kreisen oder Zurückfahren in einer Zone bringt keine weiteren Punkte', () => {
  const w = new Wertung(S, 'fuehrer', { abmessungen: AB, referenz: 100 });
  const zone = S.zonen[0];
  let zeit = 0;
  // 20 m vorwärts durch die Zone driften
  for (let k = 0; k < 20; k++) { w.tick(zustand((zone.von + k) % S.anzahl, 40, 15), null, zeit); zeit += 0.05; }
  const nachVorwaerts = w.roh;
  // Wieder zurück und erneut über denselben Abschnitt (wie bei Donuts)
  for (let runde = 0; runde < 3; runde++) {
    for (let k = 19; k >= 0; k--) { w.tick(zustand((zone.von + k) % S.anzahl, 40, 15), null, zeit); zeit += 0.05; }
    for (let k = 0; k < 20; k++) { w.tick(zustand((zone.von + k) % S.anzahl, 40, 15), null, zeit); zeit += 0.05; }
  }
  assert.ok(w.roh - nachVorwaerts < 0.5, `Farmen brachte ${(w.roh - nachVorwaerts).toFixed(2)} Rohpunkte`);
  // Weiterfahren über neuen Abschnitt zählt wieder
  for (let k = 20; k < 30; k++) { w.tick(zustand((zone.von + k) % S.anzahl, 40, 15), null, zeit); zeit += 0.05; }
  assert.ok(w.roh > nachVorwaerts + 1);
});
