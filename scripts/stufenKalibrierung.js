// Kalibriert je Strecke die Referenzwerte und die Bot-Stufen und schreibt sie in shared/strecken/*.js.
// Gefahren wird je Stufe abwechselnd mit den Autos der Pool-Gegner dieser Stufe (wie im Spiel).
//  1. Referenz Führer: Legende-Bots allein. Die Referenzpunktzahl wird per Bisektion so gesetzt, dass
//     das Mittel der normierten, auf 0–100 begrenzten Punkte 91 beträgt (Mitte des Zielbereichs
//     85–97) – genau die Größe, die tests/bots.test.js prüft.
//     Referenz Verfolger: Legende hinter Legende; mittlere Rohpunkte · 100 / 91 (für den Verfolger gibt
//     es keinen Zielbereich; die Bisektion würde die Referenz wegen der breiten Verteilung so weit
//     senken, dass menschliche Verfolger zu leicht 100 erreichen).
//  2. Stufen Anfänger–Meister: Die Quote ausgelassener Zonen wird per Bisektion so gewählt, dass die
//     mittlere Führer-Punktzahl die Mitte des jeweiligen Zielbereichs trifft.
// Aufruf: node scripts/stufenKalibrierung.js [laeufe=12]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRECKEN } from '../shared/strecken/index.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { durchgangSimulieren } from '../shared/simulation.js';
import { BOT_STUFEN } from '../shared/bots/botStufen.js';
import { autosDerStufe } from '../shared/bots/gegnerPool.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAEUFE = Number(process.argv[2] || 12);
const LEGENDE_ZIEL = 91;

function mittel(S, stufe, laeufe, mitVerfolger = false, auslassen) {
  let rohF = 0, rohV = 0, zeit = 0, punkte = 0;
  const autos = autosDerStufe(stufe);
  const einzelF = [], einzelV = [];
  for (let k = 0; k < laeufe; k++) {
    const autoId = autos[k % autos.length];
    const r = durchgangSimulieren(S, {
      fuehrer: { autoId, stufe, seed: 500 + k, auslassen },
      verfolger: mitVerfolger ? { autoId, stufe, seed: 900 + k } : null
    });
    rohF += r.fuehrer.roh;
    punkte += r.fuehrer.punkte;
    zeit += r.zeit;
    einzelF.push(r.fuehrer);
    if (r.verfolger) { rohV += r.verfolger.roh; einzelV.push(r.verfolger); }
  }
  return { rohF: rohF / laeufe, rohV: rohV / laeufe, zeit: zeit / laeufe, punkte: punkte / laeufe, einzelF, einzelV };
}

/** Referenz R, bei der das Mittel von klemme(100·roh/R + boni − abzüge, 0, 100) dem Ziel entspricht. */
function referenzFuer(laeufe, ziel) {
  const m = (R) => laeufe.reduce((s, l) => s + Math.min(100, Math.max(0, (100 * l.roh) / R + l.boni - l.abzuege)), 0) / laeufe.length;
  let lo = 1, hi = 1e5;
  for (let i = 0; i < 80; i++) {
    const R = (lo + hi) / 2;
    if (m(R) > ziel) lo = R; else hi = R;
  }
  return (lo + hi) / 2;
}

for (const def of STRECKEN) {
  // 1. Referenz aus der Legende
  let S = baueStrecke({ ...def, referenzZeit: null, referenzPunkte: null, botAuslassen: null });
  const legF = mittel(S, 'legende', LAEUFE, false);
  const legV = mittel(S, 'legende', LAEUFE, true);
  const ref = {
    zeit: Math.round(legF.zeit * 10) / 10,
    fuehrer: Math.round(referenzFuer(legF.einzelF, LEGENDE_ZIEL) * 10) / 10,
    verfolger: Math.round(((legV.rohV * 100) / LEGENDE_ZIEL) * 10) / 10
  };
  S = baueStrecke({ ...def, referenzZeit: ref.zeit, referenzPunkte: { fuehrer: ref.fuehrer, verfolger: ref.verfolger }, botAuslassen: null });
  console.log(`${def.name}: Referenzzeit ${ref.zeit} s, Rohpunkte Führer ${ref.fuehrer}, Verfolger ${ref.verfolger}`);

  // 2. Auslass-Quote je Stufe (Bisektion; mehr Auslassen → weniger Punkte)
  const quoten = {};
  for (const st of BOT_STUFEN) {
    if (st.id === 'legende') { quoten[st.id] = st.auslassen; continue; }
    const ziel = (st.zielPunkte[0] + st.zielPunkte[1]) / 2;
    let lo = 0, hi = 1, bestes = { q: st.auslassen, abw: Infinity };
    for (let it = 0; it < 6; it++) {
      const q = (lo + hi) / 2;
      const m = mittel(S, st.id, LAEUFE, false, q).punkte;
      if (Math.abs(m - ziel) < bestes.abw) bestes = { q, abw: Math.abs(m - ziel), m };
      if (m > ziel) lo = q; else hi = q;
    }
    quoten[st.id] = Math.round(bestes.q * 100) / 100;
    console.log(`  ${st.name.padEnd(9)} Auslassen ${quoten[st.id]} → Ø ${bestes.m?.toFixed(1)} (Ziel ${ziel})`);
  }

  const datei = path.join(wurzel, 'shared', 'strecken', `${def.id}.js`);
  let text = readFileSync(datei, 'utf8');
  text = text.replace(/referenzZeit: [^,\n]+,/, `referenzZeit: ${ref.zeit},`);
  text = text.replace(/referenzPunkte: (null|\{[^}]*\}),/, `referenzPunkte: { fuehrer: ${ref.fuehrer}, verfolger: ${ref.verfolger} },`);
  const ausl = `botAuslassen: { ${Object.entries(quoten).map(([k, v]) => `${k}: ${v}`).join(', ')} },`;
  if (/botAuslassen: \{[^}]*\},/.test(text)) text = text.replace(/botAuslassen: \{[^}]*\},/, ausl);
  else text = text.replace(/(referenzPunkte: \{[^}]*\},)/, `$1\n  ${ausl}`);
  writeFileSync(datei, text);
}
