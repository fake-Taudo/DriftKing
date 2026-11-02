// Ablauf des Tutorials als reine Logik: Jeder Schritt prüft die Fahrzeugwerte, bis die Aufgabe geschafft ist.
// Unabhängig von Darstellung und Eingabegerät, damit ein Test einen Neuling mit echter Physik durchspielen kann.

/** Reihenfolge und Bedingungen. Die Texte stehen in client/i18n/de.js unter tutorial.<id>. */
export const TUTORIAL_SCHRITTE = [
  { id: 'gas', ziel: 40 },
  { id: 'lenken', ziel: 1 },
  { id: 'bremse', ziel: 1 },
  { id: 'handbremse', ziel: 1 },
  { id: 'drift', ziel: 1.2 },
  { id: 'halten', ziel: 2.5 },
  { id: 'tandem', ziel: 6 },
  { id: 'fertig', ziel: 0 }
];

export const TANDEM_ABSTAND = 22; // m: so nah muss man am Führer bleiben
export const DRIFT_WINKEL = 18; // Grad: ab hier zählt es für den Neuling als Drift
export const DRIFT_TEMPO = 25; // km/h
export const WEITER_NACH = 45; // s: danach darf ein Schritt auch ohne Erfolg übersprungen werden

export class TutorialAblauf {
  constructor() {
    this.index = 0;
    this.stand = 0;
    this.zeitImSchritt = 0;
    this.links = false;
    this.rechts = false;
    this.warSchnell = false;
  }

  get schritt() {
    return TUTORIAL_SCHRITTE[this.index];
  }

  get fertig() {
    return this.schritt.id === 'fertig';
  }

  /** Fortschritt des Schritts (0..1) für die Anzeige. */
  get anteil() {
    const z = this.schritt.ziel;
    return z > 0 ? Math.min(1, this.stand / z) : 1;
  }

  /** Darf der Schritt übersprungen werden (nach einiger Zeit ohne Erfolg)? */
  get darfWeiter() {
    return this.zeitImSchritt >= WEITER_NACH;
  }

  weiter() {
    if (this.fertig) return;
    this.index++;
    this.stand = 0;
    this.zeitImSchritt = 0;
    this.links = this.rechts = this.warSchnell = false;
  }

  /**
   * Ein Schritt der Prüfung.
   * @param {{tempoKmh:number, lenken:number, bremse:number, handbremse:number, winkelGrad:number, abstand:number|null}} w
   * @param {number} dt
   * @returns {boolean} true, wenn gerade ein Schritt abgeschlossen wurde
   */
  aktualisieren(w, dt) {
    if (this.fertig) return false;
    this.zeitImSchritt += dt;
    const id = this.schritt.id;
    let geschafft = false;
    if (id === 'gas') {
      this.stand = Math.max(this.stand, w.tempoKmh);
      geschafft = w.tempoKmh >= this.schritt.ziel;
    } else if (id === 'lenken') {
      if (w.tempoKmh > 8) {
        if (w.lenken > 0.4) this.links = true;
        if (w.lenken < -0.4) this.rechts = true;
      }
      this.stand = this.links && this.rechts ? 1 : 0;
      geschafft = this.links && this.rechts;
    } else if (id === 'bremse') {
      // Einmal mit Tempo bremsen und deutlich langsamer werden
      if (w.tempoKmh > 30) this.warSchnell = true;
      if (this.warSchnell && w.bremse > 0.3 && w.tempoKmh < 22) geschafft = true;
      this.stand = geschafft ? 1 : 0;
    } else if (id === 'handbremse') {
      geschafft = w.handbremse > 0 && w.tempoKmh > 20;
      this.stand = geschafft ? 1 : 0;
    } else if (id === 'drift') {
      if (Math.abs(w.winkelGrad) >= DRIFT_WINKEL && w.tempoKmh >= DRIFT_TEMPO) this.stand += dt;
      geschafft = this.stand >= this.schritt.ziel;
    } else if (id === 'halten') {
      // Am Stück halten: fällt der Winkel weg, beginnt die Zeit von vorn
      if (Math.abs(w.winkelGrad) >= DRIFT_WINKEL && w.tempoKmh >= DRIFT_TEMPO) this.stand += dt;
      else this.stand = Math.max(0, this.stand - dt * 2);
      geschafft = this.stand >= this.schritt.ziel;
    } else if (id === 'tandem') {
      if (w.abstand !== null && w.abstand <= TANDEM_ABSTAND && w.tempoKmh > 15) this.stand += dt;
      geschafft = this.stand >= this.schritt.ziel;
    }
    if (geschafft) this.weiter();
    return geschafft;
  }
}
