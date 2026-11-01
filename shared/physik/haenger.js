// Hänger-Erkennung: Steht das Auto länger als 4 s ohne Fahrt, wird „Zurücksetzen“ angeboten;
// nach 8 s wird automatisch zurückgesetzt (im Battle mit Punktabzug, im Training ohne).
import { PHYSIK } from '../physikParameter.js';

export class HaengerErkennung {
  constructor() {
    this.stehzeit = 0;
  }

  zuruecksetzen() {
    this.stehzeit = 0;
  }

  /**
   * @param {number} tempo m/s
   * @param {number} dt
   * @param {boolean} [aktiv] false z. B. im Countdown oder nach dem Ziel
   * @returns {{knopf: boolean, automatisch: boolean}}
   */
  aktualisieren(tempo, dt, aktiv = true) {
    const H = PHYSIK.haenger;
    if (!aktiv || tempo > H.stillstandTempo) {
      this.stehzeit = 0;
    } else {
      this.stehzeit += dt;
    }
    return {
      knopf: this.stehzeit >= H.knopfNach,
      automatisch: this.stehzeit >= H.automatischNach
    };
  }
}
