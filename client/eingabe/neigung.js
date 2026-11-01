// Neigungssteuerung (Gyroskop/DeviceOrientation) mit Kalibrierung und Totzone.
// iOS verlangt eine Berechtigungsabfrage (ausgelöst durch einen Tipp) und HTTPS.
import { istSicher } from '../core/geraet.js';

export class Neigung {
  constructor() {
    this.aktiv = false;
    this.erlaubt = false;
    this.wert = 0;
    this.roh = 0;
    this.nullpunkt = 0;
    this.empfindlichkeit = 0.5; // 0..1 → maximaler Neigungswinkel 40°..15°
    this.totzone = 0.04;
    this.zuletztDaten = 0;
    this._hoerer = (e) => this._ereignis(e);
    this.beiVerlust = null; // Rückruf, wenn die Berechtigung wegfällt
  }

  static verfuegbar() {
    return typeof window.DeviceOrientationEvent !== 'undefined';
  }

  static brauchtBerechtigung() {
    return typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
  }

  /** Muss aus einem Tipp heraus aufgerufen werden (iOS). Liefert 'ok' | 'verweigert' | 'unsicher' | 'nicht_verfuegbar'. */
  async aktivieren() {
    if (!Neigung.verfuegbar()) return 'nicht_verfuegbar';
    if (!istSicher) return 'unsicher';
    if (Neigung.brauchtBerechtigung()) {
      try {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') return 'verweigert';
      } catch {
        return 'verweigert';
      }
    }
    this.erlaubt = true;
    if (!this.aktiv) {
      window.addEventListener('deviceorientation', this._hoerer);
      this.aktiv = true;
    }
    this.zuletztDaten = performance.now();
    return 'ok';
  }

  deaktivieren() {
    window.removeEventListener('deviceorientation', this._hoerer);
    this.aktiv = false;
    this.wert = 0;
  }

  /** Aktuelle Haltung als Mittelstellung übernehmen. */
  kalibrieren() {
    this.nullpunkt = this.roh;
  }

  _ereignis(e) {
    if (e.beta === null || e.gamma === null) return;
    this.zuletztDaten = performance.now();
    // Bildschirmausrichtung bestimmt, welche Achse „Lenkradneigung“ ist
    const winkel = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
    let neigung;
    if (winkel === 90) neigung = e.beta;
    else if (winkel === -90 || winkel === 270) neigung = -e.beta;
    else if (winkel === 180) neigung = -e.gamma;
    else neigung = e.gamma;
    this.roh = neigung;
    const maxWinkel = 40 - 25 * this.empfindlichkeit;
    let w = (neigung - this.nullpunkt) / maxWinkel;
    if (Math.abs(w) < this.totzone) w = 0;
    else w = Math.sign(w) * (Math.abs(w) - this.totzone) / (1 - this.totzone);
    this.wert = Math.max(-1, Math.min(1, w));
  }

  /** Prüft, ob noch Daten kommen (Berechtigung kann wegfallen). */
  pruefen() {
    if (this.aktiv && performance.now() - this.zuletztDaten > 3000) {
      this.deaktivieren();
      this.erlaubt = false;
      if (this.beiVerlust) this.beiVerlust();
    }
  }
}
