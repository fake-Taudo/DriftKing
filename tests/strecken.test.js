// Strecken-Tests: Geschlossenheit, Länge, Breite, Zonenanzahl, keine Überschneidungen,
// Wände ohne Selbstschnitt, Startaufstellung, Rundenlogik und eine Bot-Runde je Strecke und Auto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRECKEN } from '../shared/strecken/index.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { Rundenzaehler } from '../shared/rundenLogik.js';
import { botRunde } from '../shared/simulation.js';
import { AUTO_IDS } from '../shared/autos.js';

// Vorgaben aus SPEC.md Abschnitt 5 (Länge ±15 %, Breite, ca. Zonenanzahl ±1)
const VORGABE = {
  industriehof: { laenge: 900, breite: [18, 30], zonen: 6 },
  kuestenpass: { laenge: 1600, breite: [10, 14], zonen: 9 },
  neonhafen: { laenge: 1300, breite: [12, 20], zonen: 8 }
};

const gebaut = new Map(STRECKEN.map((d) => [d.id, baueStrecke(d)]));

test('Strecken sind geschlossen und entsprechen Länge, Breite und Zonenanzahl', () => {
  for (const [id, S] of gebaut) {
    const v = VORGABE[id];
    assert.ok(S.schliessFehler.versatz < 0.01, `${id}: nicht geschlossen`);
    assert.ok(Math.abs(S.laenge / v.laenge - 1) <= 0.15, `${id}: Länge ${S.laenge.toFixed(0)} m`);
    const breiten = S.proben.map((p) => p.breite);
    assert.ok(Math.min(...breiten) >= v.breite[0] - 0.01 && Math.max(...breiten) <= v.breite[1] + 0.01, `${id}: Breite außerhalb ${v.breite}`);
    assert.ok(Math.abs(S.zonen.length - v.zonen) <= 1, `${id}: ${S.zonen.length} Zonen`);
  }
});

test('Keine Überschneidung: entfernte Streckenteile halten Abstand (inkl. Wände)', () => {
  for (const [id, S] of gebaut) {
    const P = S.proben;
    const n = P.length;
    const rand = (p) => S.def.segmente[p.seg]?.rand ?? S.def.rand ?? 1.5;
    for (let i = 0; i < n; i += 2) {
      for (let j = i + 2; j < n; j += 2) {
        let bogen = Math.abs(i - j);
        bogen = Math.min(bogen, n - bogen) * S.ds;
        const a = P[i], b = P[j];
        const noetig = a.breite / 2 + b.breite / 2 + rand(a) + rand(b) + 1;
        if (bogen < noetig * 2.2) continue; // benachbarte Abschnitte
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(d >= noetig, `${id}: Proben ${i}/${j} nur ${d.toFixed(1)} m auseinander (nötig ${noetig.toFixed(1)})`);
      }
    }
  }
});

test('Innenwände schneiden sich nicht selbst (Kurvenradius größer als halbe Breite + Wandabstand)', () => {
  for (const [id, S] of gebaut) {
    for (const p of S.proben) {
      const rand = S.def.segmente[p.seg]?.rand ?? S.def.rand ?? 1.5;
      const r = 1 / Math.max(1e-6, Math.abs(p.kruemmung));
      assert.ok(r > p.breite / 2 + rand + 0.5, `${id}: Radius ${r.toFixed(1)} zu klein bei s=${p.s.toFixed(0)}`);
    }
  }
});

test('Hindernisse liegen außerhalb der Fahrbahn', () => {
  for (const [id, S] of gebaut) {
    for (const k of S.hindernisse.kreise) {
      const p = S.projektion(k.x, k.y);
      assert.ok(Math.abs(p.quer) - k.r >= S.proben[p.index].breite / 2 - 0.5, `${id}: Hindernis ${k.art} auf der Fahrbahn`);
    }
  }
});

test('Startaufstellung: auf der Strecke, Verfolger 10 m hinter dem Führer, kein Wandkontakt', () => {
  for (const [id, S] of gebaut) {
    const f = S.start.fuehrer, v = S.start.verfolger;
    const d = Math.hypot(f.x - v.x, f.y - v.y);
    assert.ok(d > 8 && d < 12, `${id}: Startabstand ${d.toFixed(1)} m`);
    for (const s of [f, v]) {
      assert.equal(S.gitter.kreisKontakt(s.x, s.y, 1.2), null, `${id}: Startposition berührt eine Wand`);
    }
  }
});

test('Rundenlogik: eine Runde entlang der Mittellinie wird erkannt, Abkürzungen nicht', () => {
  const S = gebaut.get('industriehof');
  const r = new Rundenzaehler(S, S.start.einzel);
  let runden = 0;
  let zeit = 0;
  const startI = S.start.einzel.index;
  for (let k = 0; k <= S.anzahl + 40; k++) {
    const p = S.proben[(startI + k) % S.anzahl];
    zeit += 1 / 60;
    for (const e of r.aktualisieren(p.x, p.y, zeit, 1 / 60)) if (e.art === 'runde') runden++;
  }
  assert.equal(runden, 1);
  // Sprung quer durchs Infield zählt nicht als Fortschritt
  const r2 = new Rundenzaehler(S, S.start.einzel);
  const weit = S.proben[(startI + Math.floor(S.anzahl / 2)) % S.anzahl];
  const ev = r2.aktualisieren(weit.x, weit.y, 1, 1 / 60);
  assert.ok(ev.some((e) => e.art === 'abkuerzung'));
  assert.ok(r2.weg < 50);
});

test('Jedes Auto fährt auf jeder Strecke eine komplette Runde (Grip-Bot, ohne Steckenbleiben)', () => {
  for (const [id, S] of gebaut) {
    for (const autoId of AUTO_IDS) {
      const r = botRunde(S, { autoId, stufe: 'legende', modus: 'grip', seed: 3 });
      assert.ok(r.fertig, `${id}/${autoId}: Runde nicht beendet`);
      assert.equal(r.resets, 0, `${id}/${autoId}: musste zurückgesetzt werden`);
    }
  }
});
