// Legt fest, mit welchem Modus das Spiel startet.
//   Standard: Hauptmenü
//   ?test=1                       Testfahrt (Physik-Testfläche)
//   ?test=eingabe                 Eingabe- und Verbindungstest (Würfel, Eingabewerte, Server-Echo)
//   ?perf=1&strecke=<id>          Freies Fahren mit Autopilot (für reproduzierbare Messungen)
import { Hauptmenue } from './hauptmenue.js';
import { aktivesAutoKonfig } from '../spielerDaten.js';
import { dialog } from '../ui/dom.js';
import { t } from '../i18n/de.js';
import { STRECKEN_IDS } from '../../shared/strecken/index.js';

/** Startet das Tutorial (erster Start und Einstellungen). */
async function tutorialStarten(spiel) {
  const { Tutorial } = await import('./tutorial.js');
  spiel.wechsleModus(new Tutorial({ streckeId: 'industriehof', spieler: aktivesAutoKonfig(spiel.daten) }));
}

/** Angebot beim ersten Start. Überspringen zählt als gesehen, wiederholen geht in den Einstellungen. */
async function tutorialAnbieten(spiel) {
  const wahl = await dialog({
    titel: t('tutorial.angebotTitel'),
    text: t('tutorial.angebotText'),
    knoepfe: [
      { text: t('tutorial.ueberspringen'), art: 'geist', wert: 'nein' },
      { text: t('tutorial.starten'), art: 'haupt', wert: 'ja' }
    ]
  });
  if (wahl === 'ja') {
    tutorialStarten(spiel);
  } else {
    spiel.daten.fortschritt.tutorialFertig = true;
    spiel.speicher.speichern();
  }
}

export async function startModusErzeugen(spiel) {
  spiel.tutorialStarten = () => tutorialStarten(spiel);
  const p = new URLSearchParams(location.search);
  if (p.get('test') === 'eingabe') {
    const { TestFlaeche } = await import('./testFlaeche.js');
    return new TestFlaeche();
  }
  if (p.get('test') === '1') {
    const { TestFahrt } = await import('./testFahrt.js');
    return new TestFahrt();
  }
  if (p.get('perf') === '1') {
    const strecke = STRECKEN_IDS.includes(p.get('strecke')) ? p.get('strecke') : 'industriehof';
    const { FreiesFahren } = await import('./freiesFahren.js');
    return new FreiesFahren({ streckeId: strecke, spieler: aktivesAutoKonfig(spiel.daten), autopilot: 'legende' });
  }
  const menue = new Hauptmenue();
  if (!spiel.daten.fortschritt.tutorialFertig) menue.nachBetreten = () => tutorialAnbieten(spiel);
  return menue;
}
