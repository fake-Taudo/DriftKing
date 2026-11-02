// Tagesaufgaben im laufenden Spiel: sammelt Ereignisse aus Rennen und Battles, schreibt Abgeschlossenes gut
// und meldet es. Die Regeln stehen in shared/tagesaufgaben.js.
import { aufgabenBereitstellen, aufgabenEreignis, lokalesDatum } from '../../shared/tagesaufgaben.js';
import { toast } from '../ui/dom.js';
import { t, zahl } from '../i18n/de.js';

const GRAD = 180 / Math.PI;
const DRIFT_HOCH = 50; // Grad
const DRIFT_NORMAL = 15; // Grad
const DRIFT_TEMPO = 40 / 3.6; // m/s

export class AufgabenDienst {
  constructor(spiel) {
    this.spiel = spiel;
    this.laufHoch = 0;
    this.laufNormal = 0;
    this.fahrzeit = 0;
    this.wandInRunde = false;
    const e = spiel.ereignisse;
    e.an('battleEnde', ({ sieg }) => {
      this.melden('battleEnde');
      if (sieg) this.melden('battleSieg');
    });
    e.an('onlineDuellEnde', () => this.melden('onlineDuell'));
    e.an('zeitangriffEnde', ({ medaille }) => {
      if (medaille) this.melden('medaille');
    });
    e.an('fahrtGewertet', ({ rolle, wertung }) => {
      this.melden('punkte', Math.round(wertung.punkte));
      this.melden('combo', wertung.comboMax);
      if (wertung.fluessig) this.melden('fluessig', wertung.fluessig);
      if (rolle === 'fuehrer') this.melden('fuehrerPunkte', wertung.punkte);
      if (rolle === 'verfolger') this.melden('verfolgerPunkte', wertung.endpunkte ?? wertung.punkte);
    });
    this.bereitstellen();
  }

  /** Neue Aufgaben, sobald der Tag gewechselt hat. */
  bereitstellen() {
    if (aufgabenBereitstellen(this.spiel.daten, lokalesDatum())) {
      this.spiel.speicher.speichern();
      return true;
    }
    return false;
  }

  melden(ereignis, wert = 1) {
    this.bereitstellen();
    const fertig = aufgabenEreignis(this.spiel.daten, ereignis, wert);
    if (fertig.length || ereignis === 'runde') this.spiel.speicher.speichern();
    for (const f of fertig) {
      toast(t('aufgaben.geschafft', { text: t('aufgaben.text.' + f.id), n: zahl(f.belohnung) }), { art: 'erfolg', dauer: 4500 });
      this.spiel.audio?.ton?.('kasse');
    }
    if (fertig.length) this.spiel.ereignisse.senden('aufgabeGeschafft', fertig);
  }

  /** Pro Physik-Schritt im Rennen: Driftdauern und Fahrzeit. */
  fahrtSchritt(f, dt) {
    const winkel = f.driftWinkel * GRAD;
    const schnell = f.tempo >= DRIFT_TEMPO;
    this.laufHoch = schnell && winkel >= DRIFT_HOCH ? this.laufHoch + dt : 0;
    this.laufNormal = schnell && winkel >= DRIFT_NORMAL ? this.laufNormal + dt : 0;
    // Nur bei vollen Zehntelsekunden melden, das spart Rechenzeit
    this._takt = (this._takt || 0) + dt;
    if (this._takt >= 0.1) {
      this._takt = 0;
      if (this.laufHoch > 0.5) this.melden('driftHoch', this.laufHoch);
      if (this.laufNormal > 0.5) this.melden('driftDauer', this.laufNormal);
    }
    this.fahrzeit += dt;
    if (this.fahrzeit >= 10) {
      this.melden('fahrzeit', this.fahrzeit);
      this.fahrzeit = 0;
    }
  }

  wand(staerke) {
    if (staerke > 1.5) this.wandInRunde = true;
  }

  /** Eine Runde wurde beendet. */
  runde() {
    this.melden('runde');
    if (!this.wandInRunde) this.melden('saubereRunde');
    this.wandInRunde = false;
  }
}
