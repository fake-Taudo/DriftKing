// Rückgängig/Wiederholen für einen Zustand aus reinen Daten (Garage: der bearbeitete Look).
// Gespeichert werden unveränderliche Text-Abbilder, damit spätere Änderungen sie nicht berühren.

export const VERLAUF_SCHRITTE = 60;

export class Verlauf {
  constructor(grenze = VERLAUF_SCHRITTE) {
    this.grenze = grenze;
    this.zurueck = [];
    this.vor = [];
  }

  /** Merkt den Zustand vor einer Änderung; eine neue Änderung verwirft die Wiederholen-Liste. */
  merken(zustand) {
    const abbild = JSON.stringify(zustand);
    if (this.zurueck[this.zurueck.length - 1] === abbild) return;
    this.zurueck.push(abbild);
    if (this.zurueck.length > this.grenze) this.zurueck.shift();
    this.vor.length = 0;
  }

  get kannZurueck() {
    return this.zurueck.length > 0;
  }

  get kannVor() {
    return this.vor.length > 0;
  }

  /** @returns {object|null} der vorherige Zustand */
  rueckgaengig(aktuell) {
    if (!this.zurueck.length) return null;
    this.vor.push(JSON.stringify(aktuell));
    return JSON.parse(this.zurueck.pop());
  }

  /** @returns {object|null} der zuletzt rückgängig gemachte Zustand */
  wiederholen(aktuell) {
    if (!this.vor.length) return null;
    this.zurueck.push(JSON.stringify(aktuell));
    return JSON.parse(this.vor.pop());
  }

  leeren() {
    this.zurueck.length = 0;
    this.vor.length = 0;
  }
}
