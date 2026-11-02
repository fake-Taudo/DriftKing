// Klangrechnung: Der Motor reagiert auf Drehzahl und Last, die Reifen auf den Schlupf, und jedes Auto klingt anders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motorKlang, reifenKlang, turboKlang, abstandsPegel } from '../shared/klang.js';
import { AUTOS } from '../shared/autos.js';

test('Motor: Tonhöhe, Filter und Pegel steigen mit der Drehzahl, ohne Sprünge', () => {
  for (const a of AUTOS) {
    let vorher = null;
    for (let rpm = a.leerlauf; rpm <= a.drehzahlMax; rpm += 100) {
      const m = motorKlang(a.klang, rpm, a.drehzahlMax, 0.6);
      if (vorher) {
        assert.ok(m.grundFrequenz > vorher.grundFrequenz, a.id);
        assert.ok(m.filter > vorher.filter, a.id);
        assert.ok(m.gesamt >= vorher.gesamt, a.id);
        assert.ok(m.grundFrequenz / vorher.grundFrequenz < 1.3, 'kein Tonsprung');
      }
      vorher = m;
    }
    // Der Ton bleibt im hörbaren, aber nicht schrillen Bereich
    const leer = motorKlang(a.klang, a.leerlauf, a.drehzahlMax, 0);
    const voll = motorKlang(a.klang, a.drehzahlMax, a.drehzahlMax, 1);
    assert.ok(leer.grundFrequenz > 20 && leer.grundFrequenz < 120, `${a.id} Leerlauf ${leer.grundFrequenz}`);
    assert.ok(voll.grundFrequenz > 150 && voll.grundFrequenz < 900, `${a.id} Vollgas ${voll.grundFrequenz}`);
  }
});

test('Motor: Last macht lauter, heller und rauer', () => {
  for (const a of AUTOS) {
    const ohne = motorKlang(a.klang, 5000, a.drehzahlMax, 0);
    const mit = motorKlang(a.klang, 5000, a.drehzahlMax, 1);
    assert.ok(mit.gesamt > ohne.gesamt * 1.5, a.id);
    assert.ok(mit.filter > ohne.filter, a.id);
    assert.ok(mit.rauheit > ohne.rauheit, a.id);
    assert.equal(mit.grundFrequenz, ohne.grundFrequenz, 'Die Tonhöhe hängt nur an der Drehzahl');
  }
});

test('Jedes Auto klingt unterscheidbar (Grundton, Obertöne, Rauheit)', () => {
  const merkmale = AUTOS.map((a) => {
    const m = motorKlang(a.klang, 5000, a.drehzahlMax, 1);
    return { id: a.id, f: m.grundFrequenz, filter: m.filter, rau: m.rauheit, ober: m.pegel[1] };
  });
  for (let i = 0; i < merkmale.length; i++) {
    for (let k = i + 1; k < merkmale.length; k++) {
      const a = merkmale[i], b = merkmale[k];
      const abstand = Math.abs(Math.log2(a.f / b.f)) * 12 + Math.abs(a.filter - b.filter) / 300 + Math.abs(a.rau - b.rau) * 10;
      assert.ok(abstand > 1, `${a.id} und ${b.id} klingen fast gleich (${abstand.toFixed(2)})`);
    }
  }
});

test('Reifen: still beim Haften, Quietschen wächst mit dem Schlupf, nur bei Fahrt', () => {
  assert.equal(reifenKlang(0.5, 0, 20).pegel, 0);
  const wenig = reifenKlang(1.1, 0, 20);
  const viel = reifenKlang(1.8, 0, 20);
  assert.ok(viel.pegel > wenig.pegel && wenig.pegel > 0);
  assert.ok(viel.frequenz > wenig.frequenz);
  assert.ok(reifenKlang(1.8, 0, 1).pegel < viel.pegel, 'Im Stand leiser');
  assert.ok(reifenKlang(0.5, 0.8, 5).pegel > 0, 'Durchdrehen quietscht auch');
  assert.ok(viel.pegel <= 0.34, 'nie übersteuern');
});

test('Turbo und Abstand: stetig und begrenzt', () => {
  assert.equal(turboKlang(0, 0.5).pegel, 0);
  assert.ok(turboKlang(1, 0.5).frequenz > turboKlang(0.3, 0.5).frequenz);
  assert.equal(abstandsPegel(0), 1);
  assert.equal(abstandsPegel(100), 0);
  assert.ok(abstandsPegel(10) > abstandsPegel(30));
});
