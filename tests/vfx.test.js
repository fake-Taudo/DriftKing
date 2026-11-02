// Effekte ohne Grafikkarte: Partikel und Reifenspuren bleiben in ihren Grenzen, und die Menge skaliert mit der
// Qualitätsstufe. „Reduzierte Effekte“ nimmt Tempolinien und Vignette heraus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PartikelSchwarm } from '../client/render/vfx/partikel.js';
import { Reifenspuren } from '../client/render/vfx/reifenspuren.js';
import { RennVfx } from '../client/render/vfx/rennVfx.js';
import { Tempolinien, Leuchtfaden } from '../client/render/vfx/bildEffekte.js';

globalThis.document ??= { createElement: () => ({ style: {}, remove() {} }) };

test('Partikel: nie mehr als die Höchstzahl, gestorbene verschwinden, keine ungültigen Werte', () => {
  const p = new PartikelSchwarm({ max: 50 });
  for (let i = 0; i < 500; i++) {
    p.ausstossen({ x: i, y: 1, z: 0, vx: 1, vy: 2, dauer: 0.5 + (i % 10) * 0.1, groesse: 0.3, groesseEnde: 1, r: 1, g: 1, b: 1, deckkraft: 0.5, zug: 1, auftrieb: 0.2 });
  }
  assert.equal(p.n, 50);
  p.aktualisieren(0.1, 1, 0.5);
  assert.equal(p.geo.instanceCount, 50);
  for (let i = 0; i < p.n; i++) {
    for (let k = 0; k < 4; k++) {
      assert.ok(Number.isFinite(p.pos[i * 4 + k]));
      assert.ok(Number.isFinite(p.farbe[i * 4 + k]));
    }
    assert.ok(p.farbe[i * 4 + 3] <= 0.5, 'Deckkraft bleibt in der Grenze');
    assert.ok(p.pos[i * 4 + 1] >= 0.03, 'nicht unter der Fahrbahn');
  }
  let vorher = p.n;
  for (let t = 0; t < 3; t += 0.1) {
    p.aktualisieren(0.1);
    assert.ok(p.n <= vorher);
    vorher = p.n;
  }
  assert.equal(p.n, 0);
  assert.equal(p.objekt.visible, false, 'Leer kostet keinen Draw Call');
});

test('Partikel: Auch mit einem riesigen Zeitschritt bleibt alles endlich', () => {
  const p = new PartikelSchwarm({ max: 10 });
  p.ausstossen({ x: 0, y: 1, z: 0, vx: 500, vy: 500, vz: -500, dauer: 100, groesse: 1, r: 1, g: 1, b: 1, zug: 50, auftrieb: -9 });
  p.aktualisieren(5);
  for (const w of p.pos.slice(0, 4)) assert.ok(Number.isFinite(w));
});

test('Reifenspuren: Ring läuft über, ohne die Grenzen zu verlassen; Abriss und Sprung unterbrechen', () => {
  const s = new Reifenspuren(20);
  for (let i = 0; i < 400; i++) {
    s.rad('a', i * 0.5, 0, 0.5);
    s.aktualisieren(1 / 60);
    for (const a of [s.aPos, s.aZeit, s.aStaerke]) {
      for (const r of a.updateRanges) {
        assert.ok(r.start >= 0 && r.start + r.count <= a.array.length, 'Upload bleibt im Puffer');
        assert.ok(r.count > 0);
      }
    }
  }
  assert.ok(s.schreib >= 0 && s.schreib < 20);
  assert.ok(s.posit.every(Number.isFinite));
  // Spur endet: kein neuer Abschnitt
  const stand = s.schreib;
  s.rad('a', 500, 0, 0);
  s.rad('a', 501, 0, 0);
  assert.equal(s.schreib, stand);
  // Neu ansetzen: Der erste Punkt zeichnet noch nichts
  s.rad('a', 600, 0, 0.5);
  assert.equal(s.schreib, stand);
  // Zurücksetzen über viele Meter zeichnet keinen Strich quer über die Strecke
  s.rad('a', 700, 0, 0.5);
  assert.equal(s.schreib, stand);
  s.rad('a', 700.5, 0, 0.5);
  assert.equal(s.schreib, (stand + 1) % 20);
  // Verblassen läuft im Shader: Es braucht nur die Zeit
  assert.ok(s.mat.uniforms.uZeit.value > 0);
});

/** Ein driftendes Auto ohne Grafik. */
function testAuto() {
  const f = {
    lh: 1.2, lv: 1.2, p: { spurweite: 1.5, hoechstKmhAuslegung: 180, radRadius: 0.3 },
    tempo: 45,
    z: { schlupfNormH: 1.8, durchdrehen: 0.3, schlupfV: 0.05, axGl: 0, handbremse: false },
    weltGeschwindigkeit: { x: 45, y: 0 }
  };
  const objekt = new THREE.Object3D();
  return { name: 'Test', fahrzeug: f, modell: { look: { qualm: '#eeeeee', backfire: 1, fahrwerk: { tiefe: 0.3 } }, objekt, auspuffPositionen: [[0.4, 0.2, -2]] }, darstellung: { x: 0, y: 0, theta: 0, tempo: 45 } };
}
function testRennen(stufe, partikel, reduziert = false, wetter = 'regen') {
  const auto = testAuto();
  return {
    S: { def: { wetter, tageszeit: 'Nacht' } },
    szene: new THREE.Scene(),
    kamera: { position: new THREE.Vector3() },
    autos: [auto],
    spieler: auto,
    zustand: 'laeuft',
    istBattle: false,
    spiel: {
      qualitaet: { aktuell: { id: stufe, partikel } },
      wenigerEffekte: reduziert,
      uiWurzel: { prepend() {} },
      schleife: { zeitFaktor: 1 }
    }
  };
}
function laufen(r, sekunden = 3) {
  const v = new RennVfx(r);
  for (let t = 0; t < sekunden; t += 1 / 60) {
    r.autos[0].darstellung.x += 45 / 60;
    v.frame(1 / 60, r);
  }
  return v;
}

test('Effekte skalieren mit der Qualitätsstufe', () => {
  const n = { niedrig: laufen(testRennen('niedrig', 0.25)), mittel: laufen(testRennen('mittel', 0.6)), hoch: laufen(testRennen('hoch', 1)) };
  assert.ok(n.niedrig.rauch.n < n.mittel.rauch.n && n.mittel.rauch.n < n.hoch.rauch.n, `Qualm ${n.niedrig.rauch.n}/${n.mittel.rauch.n}/${n.hoch.rauch.n}`);
  assert.ok(n.niedrig.umwelt.n < n.mittel.umwelt.n && n.mittel.umwelt.n < n.hoch.umwelt.n, 'Regen');
  assert.ok(n.niedrig.spuren.max < n.mittel.spuren.max && n.mittel.spuren.max < n.hoch.spuren.max, 'Spuren');
  assert.ok(n.hoch.rauch.n > 50, 'Qualm ist bei Hoch deutlich');
  assert.ok(n.hoch.spuren.schreib > 50, 'Spuren entstehen');
  assert.ok(n.hoch.linien.objekt.visible, 'Tempolinien bei hohem Tempo');
  assert.ok(n.hoch.mitVignette && !n.niedrig.mitVignette, 'Vignette nicht auf Niedrig');
});

test('Reduzierte Effekte: keine Tempolinien und keine Vignette, weniger Partikel', () => {
  const normal = laufen(testRennen('hoch', 1));
  const r = laufen(testRennen('hoch', 1, true));
  assert.equal(r.linien.objekt.visible, false);
  assert.equal(r.mitVignette, false);
  assert.ok(r.rauch.n < normal.rauch.n);
});

test('Kein Qualm und keine Spur beim Haften', () => {
  const r = testRennen('hoch', 1);
  Object.assign(r.autos[0].fahrzeug.z, { schlupfNormH: 0.5, durchdrehen: 0 });
  const v = laufen(r);
  assert.equal(v.rauch.n, 0);
  assert.equal(v.spuren.schreib, 0);
});

test('Backfire nur mit dem Backfire-Auspuff; Funken wachsen mit der Stärke', () => {
  const r = testRennen('hoch', 1);
  const v = new RennVfx(r);
  const a = r.autos[0];
  a.modell.look.backfire = 0;
  v.fahrzeugEreignis(a, { art: 'fehlzuendung', staerke: 1 });
  assert.equal(v.glut.n, 0);
  a.modell.look.backfire = 1;
  v.fahrzeugEreignis(a, { art: 'fehlzuendung', staerke: 1 });
  assert.ok(v.glut.n > 5);
  v.fahrzeugEreignis(a, { art: 'wand', staerke: 1, x: 0, y: 0, nx: 1, ny: 0 });
  assert.equal(v.funken.n, 0, 'Leichtes Streifen ohne Funken');
  v.fahrzeugEreignis(a, { art: 'wand', staerke: 3, x: 0, y: 0, nx: 1, ny: 0 });
  const wenig = v.funken.n;
  v.fahrzeugEreignis(a, { art: 'wand', staerke: 12, x: 0, y: 0, nx: 1, ny: 0 });
  assert.ok(v.funken.n - wenig > wenig);
  v.leeren();
  assert.equal(v.funken.n, 0);
  v.freigeben();
});

test('Leuchtfaden wird bei idealem Abstand intensiver, Tempolinien aus bei Stillstand', () => {
  const f = new Leuchtfaden();
  const a = { x: 0, y: 0 }, b = { x: 8, y: 0 };
  for (let i = 0; i < 120; i++) f.aktualisieren(1 / 60, a, b, 0.75);
  const hell = f.mat.uniforms.uStaerke.value;
  for (let i = 0; i < 120; i++) f.aktualisieren(1 / 60, a, b, 0.1);
  assert.ok(hell > f.mat.uniforms.uStaerke.value * 3);
  const l = new Tempolinien(10);
  l.aktualisieren(1 / 60, 0, 1);
  assert.equal(l.objekt.visible, false);
  l.aktualisieren(1 / 60, 0.5, 0.4);
  assert.equal(l.geo.instanceCount, 4);
});
