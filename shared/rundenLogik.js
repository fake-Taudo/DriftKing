// Rundenlogik: verfolgt den Fortschritt eines Autos entlang der Strecke (Projektion auf die
// Mittellinie), prüft Checkpoints der Reihe nach, erkennt Runden, Falschfahren und Abkürzungen.
// Wird von Client (alle Modi) und Server (Online-Duell) gleich verwendet.

export class Rundenzaehler {
  /**
   * @param {object} S Laufzeit-Strecke (baueStrecke)
   * @param {{x:number, y:number}} startPos Startposition des Autos
   */
  constructor(S, startPos) {
    this.S = S;
    this.n = S.anzahl;
    // Checkpoint-Abstände ab der Startlinie (in Proben, aufsteigend)
    this.cpAbstaende = S.checkpoints
      .map((i) => (i - S.startIdx + this.n) % this.n)
      .filter((d) => d > 0)
      .sort((a, b) => a - b);
    this.zuruecksetzen(startPos);
  }

  zuruecksetzen(startPos) {
    const p = this.S.projektion(startPos.x, startPos.y);
    this.index = p.index;
    // Strecke seit der Startlinie in Proben (vor der Linie negativ)
    let d = (p.index - this.S.startIdx + this.n) % this.n;
    if (d > this.n / 2) d -= this.n;
    this.weg = d;
    this.runde = 0; // abgeschlossene Runden
    this.naechsterCp = 0;
    this.rundenStart = null; // Zeit beim Überfahren der Startlinie
    this.rundenZeiten = [];
    this.falschrumZeit = 0;
    this.falschrum = false;
    this.ereignisse = [];
  }

  /** Anteil der aktuellen Runde (0..1). */
  get anteil() {
    return Math.max(0, Math.min(1, this.weg / this.n));
  }

  /**
   * Aktualisiert mit der aktuellen Position.
   * @param {number} x
   * @param {number} y
   * @param {number} zeit Spielzeit in s
   * @param {number} dt
   * @returns {Array<{art:'start'|'checkpoint'|'runde'|'falschrum'|'abkuerzung', zeit?:number, nummer?:number}>}
   */
  aktualisieren(x, y, zeit, dt) {
    const ev = this.ereignisse;
    ev.length = 0;
    const p = this.S.projektion(x, y, this.index);
    let schritt = p.index - this.index;
    if (schritt > this.n / 2) schritt -= this.n;
    if (schritt < -this.n / 2) schritt += this.n;
    this.index = p.index;
    // Sprünge (Abkürzung durchs Infield, Zurücksetzen) zählen nicht als Fortschritt
    const maxSchritt = Math.max(8, 60 * dt * 1.5 / this.S.ds + 6);
    if (Math.abs(schritt) > maxSchritt) {
      if (schritt > 0) ev.push({ art: 'abkuerzung' });
      schritt = 0;
    }
    const vorher = this.weg;
    this.weg += schritt;
    // Startlinie erstmals überfahren
    if (vorher < 0 && this.weg >= 0 && this.rundenStart === null) {
      this.rundenStart = zeit;
      ev.push({ art: 'start', zeit });
    }
    // Checkpoints der Reihe nach
    while (this.naechsterCp < this.cpAbstaende.length && this.weg >= this.cpAbstaende[this.naechsterCp]) {
      ev.push({ art: 'checkpoint', nummer: this.naechsterCp });
      this.naechsterCp++;
    }
    // Runde: alle Checkpoints passiert und wieder über die Linie
    if (this.weg >= this.n && this.naechsterCp >= this.cpAbstaende.length) {
      this.weg -= this.n;
      this.naechsterCp = 0;
      this.runde++;
      const rz = this.rundenStart !== null ? zeit - this.rundenStart : null;
      if (rz !== null) this.rundenZeiten.push(rz);
      this.rundenStart = zeit;
      ev.push({ art: 'runde', nummer: this.runde, zeit: rz });
    }
    // Falschfahrer: über 2 s merklich rückwärts entlang der Strecke
    if (schritt < 0) this.falschrumZeit += dt;
    else if (schritt > 0) this.falschrumZeit = Math.max(0, this.falschrumZeit - dt * 2);
    const falsch = this.falschrumZeit > 2;
    if (falsch && !this.falschrum) ev.push({ art: 'falschrum' });
    this.falschrum = falsch;
    return ev;
  }
}

/**
 * Zurücksetz-Position: nächste Position auf der Ideallinie, ein Stück vor der aktuellen Projektion,
 * in Fahrtrichtung ausgerichtet.
 */
export function zuruecksetzPosition(S, x, y, hinweis, vorMeter = 4) {
  const p = S.projektion(x, y, hinweis);
  const i = (p.index + Math.round(vorMeter / S.ds)) % S.anzahl;
  const q = S.proben[i];
  return { x: S.ideal.x[i], y: S.ideal.y[i], theta: q.richtung, index: i };
}
