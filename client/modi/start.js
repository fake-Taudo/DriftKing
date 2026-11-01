// Legt fest, mit welchem Modus das Spiel startet (Hauptmenü; Testfahrt über ?test=1).
import { Hauptmenue } from './hauptmenue.js';

export async function startModusErzeugen() {
  if (new URLSearchParams(location.search).get('test') === '1') {
    const { TestFahrt } = await import('./testFahrt.js');
    return new TestFahrt();
  }
  return new Hauptmenue();
}
