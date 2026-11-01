// Freies Fahren / Training: alle freigeschalteten Strecken, alle eigenen Autos, Rundenzeiten,
// Neustart-Taste (R). Drift-Punkte und der kleine Münz-Bonus bei neuem Bestwert kommen über die
// Wertung (rennenWertung.js) hinzu.
import { Rennen } from './rennen.js';
import { t } from '../i18n/de.js';

export class FreiesFahren extends Rennen {
  constructor(konfig) {
    super({ ...konfig, art: 'frei' });
  }

  hudAktualisieren() {
    const r = this.spieler.runden;
    const status = t('rennen.runde', { n: r.runde + 1 });
    const laufend = r.rundenStart !== null ? this.zeit - r.rundenStart : null;
    this.hud.stand({ rolle: t('rennen.training'), status, zeit: laufend });
    this.wertungHud?.();
  }

  rundeBeendet(ev) {
    const d = this.spiel.daten;
    const id = this.S.id;
    const best = (d.fortschritt.bestwerte[id] ||= {});
    if (ev.zeit && (best.runde === undefined || best.runde === null || ev.zeit < best.runde)) {
      best.runde = Math.round(ev.zeit * 1000) / 1000;
      this.spiel.speicher.speichern();
    }
    this.wertungRunde?.(ev);
  }
}
