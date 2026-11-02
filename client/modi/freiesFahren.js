// Freies Fahren / Training: alle freigeschalteten Strecken, alle eigenen Autos, Rundenzeiten,
// Neustart-Taste (R). Drift-Punkte sind sichtbar (Einzel-Wertung je Runde ab der Startlinie);
// ein neuer persönlicher Punkte-Bestwert bringt einen kleinen Münz-Bonus (siehe oekonomie.js).
import { Rennen } from './rennen.js';
import { EinzelWertung, zufallsId } from './rennenWertung.js';
import { trainingRundeAbschliessen, statistikVerbuchen } from '../../shared/oekonomie.js';
import { t, zahl } from '../i18n/de.js';

export class FreiesFahren extends Rennen {
  constructor(konfig) {
    super({ ...konfig, art: 'frei' });
    this.sitzung = zufallsId();
    this.rundenGewertet = 0;
  }

  starten() {
    super.starten();
    this.einzel ||= new EinzelWertung(this);
    this.einzel.aktiv = false;
  }

  hudAktualisieren() {
    const r = this.spieler.runden;
    const status = t('rennen.runde', { n: r.runde + 1 });
    const laufend = r.rundenStart !== null ? this.zeit - r.rundenStart : null;
    this.hud.stand({ rolle: t('rennen.training'), rolleArt: 'einzel', status, zeit: laufend });
    this.einzel.hud();
  }

  wertungSchritt() {
    this.einzel.schritt();
  }

  rundenEreignis(a, ev) {
    if (a === this.spieler && ev.art === 'start') this.einzel.start();
    super.rundenEreignis(a, ev);
  }

  rundeBeendet(ev) {
    const d = this.spiel.daten;
    const id = this.S.id;
    const best = (d.fortschritt.bestwerte[id] ||= {});
    if (ev.zeit && (best.runde === undefined || best.runde === null || ev.zeit < best.runde)) {
      best.runde = Math.round(ev.zeit * 1000) / 1000;
    }
    // Rundenpunkte: Bestwert und ggf. kleiner Bonus, dann nächste Runde werten
    const a = this.einzel.stopp();
    this.einzel.start();
    if (!this.konfig.autopilot) {
      statistikVerbuchen(d, a);
      const r = trainingRundeAbschliessen(d, { laufId: `${this.sitzung}:${this.rundenGewertet++}`, streckeId: id, punkte: a.punkte });
      this.hud.popup(t('wertung.rundenPunkte', { n: zahl(a.punkte, 1) }), 'combo');
      if (r.neuerBestwert) this.hud.popup(t('wertung.neuerBestwert'), 'combo');
      if (r.bonus) this.hud.popup(t('wertung.bonus', { n: zahl(r.bonus) }), 'muenzen');
    }
    this.spiel.speicher.speichern();
  }
}
