// Bestimmt je Strecke die Referenzwerte per Simulation der Idealfahrt (Legende ohne Fehler/Streuung):
//   referenzZeit             – mittlere Rundenzeit (Zeitlimit = 150 %)
//   referenzPunkte.fuehrer   – mittlere Führer-Rohpunkte  (= 100 normierte Punkte)
//   referenzPunkte.verfolger – mittlere Verfolger-Rohpunkte hinter einem idealen Führer
// Mittel über alle 6 Autos (Wertung ist autounabhängig). Schreibt die Werte in shared/strecken/*.js.
// Aufruf: node scripts/referenz.js [--trocken]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRECKEN } from '../shared/strecken/index.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { durchgangSimulieren } from '../shared/simulation.js';
import { AUTO_IDS } from '../shared/autos.js';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const trocken = process.argv.includes('--trocken');

for (const def of STRECKEN) {
  // Ohne alte Referenzwerte bauen (sonst würde die Zeitgrenze die Simulation beeinflussen)
  const S = baueStrecke({ ...def, referenzZeit: null, referenzPunkte: null });
  let zeit = 0, rohF = 0, rohV = 0, n = 0;
  for (const autoId of AUTO_IDS) {
    for (const seed of [1, 2]) {
      const a = durchgangSimulieren(S, { fuehrer: { autoId, stufe: 'ideal', seed } });
      const b = durchgangSimulieren(S, { fuehrer: { autoId, stufe: 'ideal', seed }, verfolger: { autoId, stufe: 'ideal', seed: seed + 10 } });
      zeit += a.zeit;
      rohF += a.fuehrer.roh;
      rohV += b.verfolger.roh;
      n++;
    }
  }
  const werte = { zeit: Math.round((zeit / n) * 10) / 10, fuehrer: Math.round((rohF / n) * 10) / 10, verfolger: Math.round((rohV / n) * 10) / 10 };
  console.log(`${def.name}: Referenzzeit ${werte.zeit} s, Rohpunkte Führer ${werte.fuehrer}, Verfolger ${werte.verfolger}`);
  if (trocken) continue;
  const datei = path.join(wurzel, 'shared', 'strecken', `${def.id}.js`);
  let text = readFileSync(datei, 'utf8');
  text = text.replace(/referenzZeit: [^,\n]+,/, `referenzZeit: ${werte.zeit},`);
  text = text.replace(/referenzPunkte: (null|\{[^}]*\}),/, `referenzPunkte: { fuehrer: ${werte.fuehrer}, verfolger: ${werte.verfolger} },`);
  writeFileSync(datei, text);
}
