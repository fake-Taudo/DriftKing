// Legt fest, mit welchem Modus das Spiel startet.
//   Standard: Hauptmenü
//   ?test=1                       Testfahrt (Physik-Testfläche)
//   ?perf=1&strecke=<id>          Freies Fahren mit Autopilot (für reproduzierbare Messungen)
import { Hauptmenue } from './hauptmenue.js';
import { aktivesAutoKonfig } from '../spielerDaten.js';
import { STRECKEN_IDS } from '../../shared/strecken/index.js';

export async function startModusErzeugen(spiel) {
  const p = new URLSearchParams(location.search);
  if (p.get('test') === '1') {
    const { TestFahrt } = await import('./testFahrt.js');
    return new TestFahrt();
  }
  if (p.get('perf') === '1') {
    const strecke = STRECKEN_IDS.includes(p.get('strecke')) ? p.get('strecke') : 'industriehof';
    const { FreiesFahren } = await import('./freiesFahren.js');
    return new FreiesFahren({ streckeId: strecke, spieler: aktivesAutoKonfig(spiel.daten), autopilot: 'legende' });
  }
  return new Hauptmenue();
}
