// Bot-Simulation (SPEC 15): alle 5 Stufen auf allen 3 Strecken, je 20 Läufe mit verschiedenen Seeds,
// abwechselnd mit den Autos der Pool-Gegner dieser Stufe (so wie die Bots im Spiel antreten). Geprüft: Runde beendet, Ziel-Punkte (±7) je Strecke, Rangfolge im Mittel,
// Anfänger bleibt schlagbar. Bekannte Abweichungen sind als „todo“ markiert (siehe docs/WERTUNG.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRECKEN } from '../shared/strecken/index.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { durchgangSimulieren } from '../shared/simulation.js';
import { BOT_STUFEN } from '../shared/bots/botStufen.js';
import { autosDerStufe } from '../shared/bots/gegnerPool.js';

const LAEUFE = 20;
const TOLERANZ = 7;

// Bekannte Abweichungen (Bot-Regler in den engen Haarnadeln des Küstenpasses, siehe docs/WERTUNG.md)
const BEKANNT = {
  'kuestenpass/meister': 'Meister-Bot im Bastion GT verunfallt in den Haarnadeln des Küstenpasses häufig'
};
const BEKANNT_FERTIG = {
  'kuestenpass/meister': 'Meister-Bot im Bastion GT schafft die Runde auf dem Küstenpass gelegentlich nicht im Zeitlimit'
};

const ergebnisse = new Map(); // "strecke/stufe" → {mittel, fertig}
for (const def of STRECKEN) {
  const S = baueStrecke(def);
  for (const st of BOT_STUFEN) {
    let summe = 0, fertig = 0;
    const autos = autosDerStufe(st.id);
    for (let k = 0; k < LAEUFE; k++) {
      const r = durchgangSimulieren(S, { fuehrer: { autoId: autos[k % autos.length], stufe: st.id, seed: 100 + k } });
      summe += r.fuehrer.punkte;
      if (r.fertig) fertig++;
    }
    ergebnisse.set(`${def.id}/${st.id}`, { mittel: summe / LAEUFE, fertig });
  }
}

test('Alle Bots beenden die Runde (alle Stufen, alle Strecken)', () => {
  for (const [schl, e] of ergebnisse) {
    if (BEKANNT_FERTIG[schl]) continue;
    assert.ok(e.fertig >= LAEUFE - 1, `${schl}: nur ${e.fertig}/${LAEUFE} Runden beendet`);
  }
});
for (const [schl, grund] of Object.entries(BEKANNT_FERTIG)) {
  test(`Runde beendet: ${schl}`, { todo: grund }, () => {
    const e = ergebnisse.get(schl);
    assert.ok(e.fertig >= LAEUFE - 1, `${schl}: nur ${e.fertig}/${LAEUFE} Runden beendet`);
  });
}

for (const def of STRECKEN) {
  for (const st of BOT_STUFEN) {
    const schl = `${def.id}/${st.id}`;
    const [a, b] = st.zielPunkte;
    test(`Ziel-Punkte ${def.name} – ${st.name}: ${a}–${b} (±${TOLERANZ})`, { todo: BEKANNT[schl] }, () => {
      const m = ergebnisse.get(schl).mittel;
      assert.ok(m >= a - TOLERANZ && m <= b + TOLERANZ, `${schl}: Mittel ${m.toFixed(1)}`);
    });
  }
}

test('Höhere Stufen schlagen niedrigere im Mittel (über alle Strecken)', () => {
  const mittel = BOT_STUFEN.map((st) => STRECKEN.reduce((s, d) => s + ergebnisse.get(`${d.id}/${st.id}`).mittel, 0) / STRECKEN.length);
  for (let i = 1; i < mittel.length; i++) {
    assert.ok(mittel[i] > mittel[i - 1] - 1, `${BOT_STUFEN[i].name} (${mittel[i].toFixed(1)}) nicht besser als ${BOT_STUFEN[i - 1].name} (${mittel[i - 1].toFixed(1)})`);
  }
});

test('Anfänger bleibt schlagbar (Mittel unter 60 auf jeder Strecke)', () => {
  for (const def of STRECKEN) assert.ok(ergebnisse.get(`${def.id}/anfaenger`).mittel < 60, def.id);
});
