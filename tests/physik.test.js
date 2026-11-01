// Physik-Tests: Stabilität (Zufallseingaben, 10 min simulierte Zeit), Extremfälle, Determinismus,
// Drift-Einleitung (Handbremse, Gasüberschuss, Lastwechsel, Kupplungstritt), Messgrößen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Fahrzeug, autoKontakt } from '../shared/physik/fahrzeug.js';
import { effektiveParameter } from '../shared/tuning.js';
import { AUTOS } from '../shared/autos.js';
import { Zufall } from '../shared/zufall.js';
import { PHYSIK } from '../shared/physikParameter.js';
import { testflaecheGitter, TESTFLAECHE } from '../shared/strecken/testflaeche.js';
import { KollisionsGitter } from '../shared/physik/kollision.js';
import { HaengerErkennung } from '../shared/physik/haenger.js';
import { nullAufHundert, hoechstgeschwindigkeit, bremsweg } from '../shared/physik/messung.js';
import { GRAD } from '../shared/mathe.js';

const DT = PHYSIK.dt;
const E = (o = {}) => ({ lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0, ...o });

function auto(id = 'kestrel_s', assistenz = {}) {
  return new Fahrzeug(effektiveParameter(id), { gegenlenken: 0.6, driftHalten: 0, ...assistenz });
}

function pruefeGueltig(f, text) {
  const z = f.z;
  for (const k of ['x', 'y', 'theta', 'vx', 'vy', 'r', 'drehzahl', 'delta', 'omegaH']) {
    assert.ok(Number.isFinite(z[k]), `${text}: ${k} ist nicht endlich (${z[k]})`);
  }
  assert.ok(Math.hypot(z.vx, z.vy) <= PHYSIK.maxTempo + 1e-6, `${text}: Tempo zu hoch`);
  assert.ok(Math.abs(z.r) <= PHYSIK.maxGierrate + 1e-6, `${text}: Gierrate zu hoch`);
}

test('Zufallseingaben über 10 Minuten (fester Seed): keine NaN, keine Ausreißer – alle Autos', () => {
  const gitter = testflaecheGitter();
  const grenze = TESTFLAECHE.breite / 2;
  for (const a of AUTOS) {
    const z = new Zufall('stabilitaet-' + a.id);
    const f = auto(a.id);
    f.setzen(0, 0, 0, 0);
    let e = E();
    for (let i = 0; i < 60 * 600; i++) {
      // Eingaben wechseln zufällig alle 0,1–1 s
      if (i % Math.floor(z.bereich(6, 60)) === 0) {
        e = E({
          lenken: z.bereich(-1, 1),
          gas: z.chance(0.7) ? z.bereich(0, 1) : 0,
          bremse: z.chance(0.2) ? z.bereich(0, 1) : 0,
          handbremse: z.chance(0.15) ? 1 : 0,
          kupplung: z.chance(0.05) ? 1 : 0
        });
      }
      f.schritt(e, DT, gitter);
      if (i % 600 === 0) pruefeGueltig(f, a.id);
    }
    pruefeGueltig(f, a.id);
    assert.ok(Math.abs(f.z.x) < grenze && Math.abs(f.z.y) < grenze, `${a.id}: Auto hat die Fläche verlassen`);
  }
});

test('Extremfall: Dauer-Handbremse mit Vollgas und Volleinschlag', () => {
  const f = auto('bastion_gt');
  f.setzen(0, 0, 0, 30);
  for (let i = 0; i < 60 * 60; i++) f.schritt(E({ handbremse: 1, gas: 1, lenken: 1 }), DT, testflaecheGitter());
  pruefeGueltig(f, 'Handbremse');
});

test('Extremfall: Vollgas gegen die Wand – kein Durchdringen, kein Steckenbleiben', () => {
  const gitter = new KollisionsGitter([{ ax: 30, ay: -50, bx: 30, by: 50 }]);
  for (const a of AUTOS) {
    const f = auto(a.id);
    f.setzen(0, 0, 0, 0);
    let maxX = -Infinity;
    let wandEreignisse = 0;
    for (let i = 0; i < 60 * 20; i++) {
      f.schritt(E({ gas: 1 }), DT, gitter);
      wandEreignisse += f.ereignisse.filter((e) => e.art === 'wand').length;
      const vorne = f.z.x + Math.cos(f.z.theta) * (a.abmessungen.laenge / 2);
      maxX = Math.max(maxX, vorne);
      pruefeGueltig(f, a.id);
    }
    assert.ok(maxX < 30.3, `${a.id}: Front steckt in der Wand (${maxX.toFixed(2)})`);
    assert.ok(wandEreignisse > 0, `${a.id}: kein Wandkontakt gemeldet`);
    // Rückwärts wieder weg: Bremse halten → Rückwärtsgang
    for (let i = 0; i < 60 * 3; i++) f.schritt(E({ bremse: 1 }), DT, gitter);
    assert.equal(f.gangAnzeige, 'R');
    assert.ok(f.z.x < 30 - a.abmessungen.laenge / 2 - 1, `${a.id}: kommt nicht rückwärts von der Wand weg`);
  }
});

test('Extremfall: Schräg in eine Ecke – Positionskorrektur schiebt sauber heraus', () => {
  const gitter = new KollisionsGitter([
    { ax: 20, ay: -40, bx: 20, by: 20 },
    { ax: -40, ay: 20, bx: 20, by: 20 }
  ]);
  const f = auto('hornet_wagon');
  f.setzen(0, 0, Math.PI / 4, 0);
  for (let i = 0; i < 60 * 15; i++) f.schritt(E({ gas: 1, lenken: (i % 120) < 60 ? 0.6 : -0.6 }), DT, gitter);
  pruefeGueltig(f, 'Ecke');
  assert.ok(f.z.x < 20 && f.z.y < 20);
});

test('Extremfall: Volleinschlag bei Höchstgeschwindigkeit', () => {
  for (const id of ['onyx_rs', 'kestrel_s']) {
    const f = auto(id);
    f.setzen(0, 0, 0, 65);
    for (let i = 0; i < 60 * 10; i++) {
      f.schritt(E({ gas: 1, lenken: 1 }), DT);
      pruefeGueltig(f, id);
    }
  }
});

test('Extremfall: wechselnder Lenkausschlag in Höchstfrequenz', () => {
  const f = auto('vireo_turbo');
  f.setzen(0, 0, 0, 45);
  for (let i = 0; i < 60 * 30; i++) {
    f.schritt(E({ gas: 1, lenken: i % 2 ? 1 : -1, handbremse: i % 37 === 0 ? 1 : 0 }), DT);
    pruefeGueltig(f, 'Wechsellenken');
  }
});

test('Extremfall: sehr kleine und sehr große Zeitschritte', () => {
  for (const dt of [1e-4, 1e-3, 0.05, 0.25, 1.0]) {
    const f = auto('bastion_gt');
    f.setzen(0, 0, 0, 20);
    for (let i = 0; i < 200; i++) f.schritt(E({ gas: 1, lenken: i % 50 < 25 ? 1 : -1, handbremse: i % 30 === 0 ? 1 : 0 }), dt);
    pruefeGueltig(f, 'dt=' + dt);
  }
  // Ungültige Eingaben werden ignoriert
  const f = auto();
  f.schritt({ lenken: NaN, gas: Infinity, bremse: -5, handbremse: 'ja' }, DT);
  f.schritt(E(), NaN);
  f.schritt(E(), -1);
  pruefeGueltig(f, 'Ungültige Eingaben');
});

test('Determinismus: gleiche Eingaben + gleicher Seed → gleiches Ergebnis', () => {
  const lauf = () => {
    const z = new Zufall(42);
    const f = auto('vireo_turbo');
    const gitter = testflaecheGitter();
    f.setzen(0, 0, 0, 10);
    for (let i = 0; i < 60 * 30; i++) {
      f.schritt(E({ lenken: z.bereich(-1, 1), gas: z.naechste(), handbremse: z.chance(0.05) ? 1 : 0 }), DT, gitter);
    }
    return f.momentaufnahme();
  };
  assert.deepEqual(lauf(), lauf());
});

/** Höchster Driftwinkel (Grad) innerhalb der ersten n Sekunden eines Manövers. */
function maxWinkel(f, manoever, sekunden = 3) {
  let max = 0;
  for (let i = 0; i < 60 * sekunden; i++) {
    f.schritt(manoever(i * DT, f), DT);
    if (f.tempo > 3) max = Math.max(max, f.driftWinkel / GRAD);
  }
  return max;
}

test('Drift-Einleitung per Handbremse (alle Autos)', () => {
  for (const a of AUTOS) {
    const f = auto(a.id);
    f.setzen(0, 0, 0, 60 / 3.6);
    const w = maxWinkel(f, (t) => (t < 0.5 ? E({ lenken: -1, handbremse: 1 }) : E({ lenken: 0, gas: 0.7 })));
    assert.ok(w > 20, `${a.id}: Handbremsen-Drift nur ${w.toFixed(0)}°`);
  }
});

test('Drift-Einleitung per Gasüberschuss (starke Heckantriebler)', () => {
  for (const id of ['bastion_gt', 'vireo_turbo', 'kestrel_s']) {
    const f = auto(id, { gegenlenken: 0.6 });
    f.setzen(0, 0, 0, 40 / 3.6);
    const w = maxWinkel(f, () => E({ lenken: -1, gas: 1 }), 4);
    assert.ok(w > 20, `${id}: Power-Drift nur ${w.toFixed(0)}°`);
  }
});

test('Drift-Einleitung per Lastwechsel (Scandinavian Flick)', () => {
  // Hornet (sehr stabil) und Onyx (Allrad) sind bewusst schwerer per Lastwechsel zu driften
  for (const id of ['kestrel_s', 'marlin_4d', 'vireo_turbo', 'bastion_gt']) {
    const f = auto(id);
    f.setzen(0, 0, 0, 70 / 3.6);
    const w = maxWinkel(f, (t) => {
      if (t < 0.35) return E({ lenken: 0.6, gas: 0.4 }); // kurz weg von der Kurve
      if (t < 0.7) return E({ lenken: -1, bremse: 0.3 }); // umlenken, Gas weg → Last nach vorne
      return E({ lenken: -0.2, gas: 1 });
    });
    assert.ok(w > 20, `${id}: Lastwechsel-Drift nur ${w.toFixed(0)}°`);
  }
});

test('Drift-Einleitung per Kupplungstritt', () => {
  const f = auto('kestrel_s');
  f.setzen(0, 0, 0, 45 / 3.6);
  const w = maxWinkel(f, (t) => E({ lenken: -0.8, gas: 1, kupplung: t > 0.3 && t < 0.4 ? 1 : 0 }));
  const ohne = auto('kestrel_s');
  ohne.setzen(0, 0, 0, 45 / 3.6);
  const w0 = maxWinkel(ohne, () => E({ lenken: -0.8, gas: 1 }));
  assert.ok(w > 20 && w >= w0, `Kupplungstritt: ${w.toFixed(0)}° (ohne: ${w0.toFixed(0)}°)`);
});

test('Drift lässt sich beenden (Gas weg, Lenkung gerade)', () => {
  const f = auto('kestrel_s');
  f.setzen(0, 0, 0, 60 / 3.6);
  maxWinkel(f, (t) => (t < 0.5 ? E({ lenken: -1, handbremse: 1 }) : E({ gas: 0.8 })), 1.5);
  for (let i = 0; i < 60 * 4; i++) f.schritt(E({ lenken: 0, gas: 0.2 }), DT);
  assert.ok(f.driftWinkel / GRAD < 8, `Auto fängt sich nicht (${(f.driftWinkel / GRAD).toFixed(0)}°)`);
});

test('Messgrößen 0–100 und Höchstgeschwindigkeit liegen im Rahmen (±15 %)', () => {
  for (const a of AUTOS) {
    const t = nullAufHundert(a.id);
    const v = hoechstgeschwindigkeit(a.id);
    assert.ok(Math.abs(t / a.soll.nullHundert - 1) <= 0.15, `${a.id}: 0–100 ${t.toFixed(1)} s (Soll ${a.soll.nullHundert})`);
    assert.ok(Math.abs(v / a.soll.hoechstKmh - 1) <= 0.15, `${a.id}: Vmax ${v.toFixed(0)} (Soll ${a.soll.hoechstKmh})`);
  }
  // Rangfolge: Onyx am schnellsten, Kestrel am langsamsten
  const zeiten = AUTOS.map((a) => nullAufHundert(a.id));
  assert.equal(Math.min(...zeiten), zeiten[AUTOS.findIndex((a) => a.id === 'onyx_rs')]);
  assert.equal(Math.max(...zeiten), zeiten[AUTOS.findIndex((a) => a.id === 'kestrel_s')]);
  const vmax = AUTOS.map((a) => hoechstgeschwindigkeit(a.id));
  assert.equal(Math.max(...vmax), vmax[AUTOS.findIndex((a) => a.id === 'onyx_rs')]);
});

test('Bremsweg aus 100 km/h ist plausibel (25–50 m)', () => {
  for (const a of AUTOS) {
    const s = bremsweg(a.id);
    assert.ok(s > 25 && s < 50, `${a.id}: Bremsweg ${s.toFixed(1)} m`);
  }
});

test('Tuning wirkt: voll getuntes Auto ist schneller', () => {
  const voll = { motor: 5, turbo: 5, reifen: 5, fahrwerk: 5, sperre: 5, bremse: 5, gewicht: 5 };
  for (const id of ['kestrel_s', 'bastion_gt']) {
    assert.ok(nullAufHundert(id, { tuning: voll }) < nullAufHundert(id));
    assert.ok(hoechstgeschwindigkeit(id, { tuning: voll }) > hoechstgeschwindigkeit(id));
  }
});

test('Weiche Auto-Auto-Kollision: kein Festkleben, keine Rotation', () => {
  const a = auto('kestrel_s');
  const b = auto('marlin_4d');
  a.setzen(0, 0, 0, 20);
  b.setzen(6, 0.3, 0, 10);
  let kontakt = false;
  for (let i = 0; i < 120; i++) {
    a.schritt(E({ gas: 1 }), DT);
    b.schritt(E({ gas: 0.3 }), DT);
    const rA = a.z.r, rB = b.z.r;
    if (autoKontakt(a, b)) {
      kontakt = true;
      assert.equal(a.z.r, rA, 'Kontakt darf keine Drehung erzeugen');
      assert.equal(b.z.r, rB);
    }
  }
  assert.ok(kontakt);
  // Danach getrennt (kein Festkleben)
  for (let i = 0; i < 120; i++) {
    a.schritt(E({ bremse: 1 }), DT);
    b.schritt(E({ gas: 1 }), DT);
    autoKontakt(a, b);
  }
  assert.ok(Math.hypot(a.z.x - b.z.x, a.z.y - b.z.y) > 5);
});

test('Hänger-Erkennung: Knopf nach 4 s, automatisch nach 8 s', () => {
  const h = new HaengerErkennung();
  let r;
  for (let i = 0; i < 60 * 3.9; i++) r = h.aktualisieren(0, DT);
  assert.equal(r.knopf, false);
  for (let i = 0; i < 60 * 0.2; i++) r = h.aktualisieren(0, DT);
  assert.equal(r.knopf, true);
  assert.equal(r.automatisch, false);
  for (let i = 0; i < 60 * 4.1; i++) r = h.aktualisieren(0, DT);
  assert.equal(r.automatisch, true);
  r = h.aktualisieren(10, DT);
  assert.equal(r.knopf, false);
});
