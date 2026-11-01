// Einträge des Hauptmenüs. Jeder Eintrag führt zu einem funktionierenden Bildschirm/Modus.
import { aktivesAutoKonfig } from '../spielerDaten.js';

async function rennenStarten(spiel, Klasse, streckeId) {
  spiel.wechsleModus(new Klasse({ streckeId, spieler: aktivesAutoKonfig(spiel.daten) }));
}

export const MENUE_EINTRAEGE = {
  haupt: [
    { text: 'menue.spielen', untertext: 'menue.spielenUnter', art: 'haupt', aktion: (m) => m.ansicht('spielen') },
    {
      text: 'menue.einstellungen', aktion: async (_m, spiel) => {
        const { einstellungenZeigen } = await import('../ui/bildschirme/einstellungen.js');
        einstellungenZeigen(spiel);
      }
    }
  ],
  spielen: [
    {
      text: 'menue.zeitangriff', untertext: 'menue.zeitangriffUnter', aktion: async (_m, spiel) => {
        const { streckenwahl } = await import('../ui/bildschirme/streckenwahl.js');
        const id = await streckenwahl(spiel, { titel: 'wahl.zeitangriffTitel', modus: 'zeitangriff' });
        if (id) {
          const { Zeitangriff } = await import('./zeitangriff.js');
          rennenStarten(spiel, Zeitangriff, id);
        }
      }
    },
    {
      text: 'menue.freiesFahren', untertext: 'menue.freiesFahrenUnter', aktion: async (_m, spiel) => {
        const { streckenwahl } = await import('../ui/bildschirme/streckenwahl.js');
        const id = await streckenwahl(spiel, { titel: 'wahl.freiTitel', modus: 'frei' });
        if (id) {
          const { FreiesFahren } = await import('./freiesFahren.js');
          rennenStarten(spiel, FreiesFahren, id);
        }
      }
    }
  ],
  fuss: null
};
