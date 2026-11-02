// Einträge des Hauptmenüs. Jeder Eintrag führt zu einem funktionierenden Bildschirm/Modus.
import { aktivesAutoKonfig } from '../spielerDaten.js';

async function rennenStarten(spiel, Klasse, streckeId) {
  spiel.wechsleModus(new Klasse({ streckeId, spieler: aktivesAutoKonfig(spiel.daten) }));
}

/** Battle-Auswahl öffnen und das gewählte Tandem-Battle starten (vorgabe: letzte Wahl). */
let battleWahlOffen = false;
export async function botBattleWahl(menue, spiel, vorgabe = null) {
  if (battleWahlOffen) return; // Doppelklick/-tipp öffnet die Auswahl nur einmal
  battleWahlOffen = true;
  let w;
  try {
    const { battleWahl } = await import('../ui/bildschirme/battleWahl.js');
    w = await battleWahl(spiel, { menue, vorgabe });
  } finally {
    battleWahlOffen = false;
  }
  if (!w) return;
  const { BotBattle } = await import('./botBattle.js');
  spiel.wechsleModus(new BotBattle({ ...w, spieler: aktivesAutoKonfig(spiel.daten) }));
}

export const MENUE_EINTRAEGE = {
  haupt: [
    { text: 'menue.spielen', untertext: 'menue.spielenUnter', art: 'haupt', aktion: (m) => m.ansicht('spielen') },
    {
      text: 'menue.garage', untertext: 'menue.garageUnter', aktion: async (_m, spiel) => {
        const { Garage } = await import('./garage.js');
        spiel.wechsleModus(new Garage());
      }
    },
    {
      text: 'menue.einstellungen', aktion: async (_m, spiel) => {
        const { einstellungenZeigen } = await import('../ui/bildschirme/einstellungen.js');
        einstellungenZeigen(spiel);
      }
    }
  ],
  spielen: [
    { text: 'menue.botBattle', untertext: 'menue.botBattleUnter', art: 'haupt', aktion: (m, spiel) => botBattleWahl(m, spiel) },
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
