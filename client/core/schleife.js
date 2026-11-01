// Game-Loop mit festem Physik-Zeitschritt (1/60 s) und Accumulator.
// Maximal 5 Schritte pro Frame – danach wird Restzeit verworfen, damit das Spiel nach
// einem Hänger nicht „explodiert“. Die Darstellung interpoliert mit alpha zwischen den Schritten.
import { PHYSIK } from '../../shared/physikParameter.js';

export class Schleife {
  /**
   * @param {{schritt: (dt:number)=>void, rendern: (alpha:number, frameDt:number)=>void}} o
   */
  constructor({ schritt, rendern }) {
    this.schritt = schritt;
    this.rendern = rendern;
    this.dt = PHYSIK.dt;
    this.maxSchritte = PHYSIK.maxSchritteProFrame;
    this.akku = 0;
    this.letzteZeit = 0;
    this.laeuft = false;
    this.physikAktiv = true; // false = Pause (nur noch rendern)
    this.zeitFaktor = 1; // < 1 für Zeitlupe
    this.verworfeneZeit = 0;
    this.fps = 60;
    this._fpsZaehler = 0;
    this._fpsZeit = 0;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.laeuft) return;
    this.laeuft = true;
    this.letzteZeit = performance.now();
    requestAnimationFrame(this._frame);
  }

  stop() {
    this.laeuft = false;
  }

  /** Setzt den Accumulator zurück (z. B. nach Pause oder Moduswechsel). */
  zuruecksetzen() {
    this.akku = 0;
    this.letzteZeit = performance.now();
  }

  _frame(zeit) {
    if (!this.laeuft) return;
    requestAnimationFrame(this._frame);
    let frameDt = (zeit - this.letzteZeit) / 1000;
    this.letzteZeit = zeit;
    if (!(frameDt > 0)) frameDt = 0;
    if (frameDt > 0.25) frameDt = 0.25; // sehr große Lücken kappen (Tab-Rückkehr)

    // FPS-Messung
    this._fpsZaehler++;
    this._fpsZeit += frameDt;
    if (this._fpsZeit >= 0.5) {
      this.fps = this._fpsZaehler / this._fpsZeit;
      this._fpsZaehler = 0;
      this._fpsZeit = 0;
    }

    if (this.physikAktiv) {
      this.akku += frameDt * this.zeitFaktor;
      let n = 0;
      while (this.akku >= this.dt && n < this.maxSchritte) {
        this.schritt(this.dt);
        this.akku -= this.dt;
        n++;
      }
      if (n >= this.maxSchritte && this.akku >= this.dt) {
        this.verworfeneZeit += this.akku;
        this.akku = 0;
      }
    } else {
      this.akku = 0;
    }
    const alpha = this.physikAktiv ? this.akku / this.dt : 1;
    this.rendern(alpha, frameDt);
  }
}
