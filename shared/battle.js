// Battle-Ablauf (Tandem): Läufe aus zwei Durchgängen mit Rollentausch, Format „Schnell“ (1 Lauf)
// oder „Best of 3“ (wer zuerst 2 Läufe gewinnt), Gleichstand-Regel mit Wiederholungsläufen.
// Rein logisch – wird vom Client (Bot-Battle) und vom Server (Online-Duell) gleich verwendet.
import { WERTUNG } from './wertungsParameter.js';
import { verfolgerEndpunkte } from './wertung.js';
import { Zufall } from './zufall.js';

export const FORMATE = {
  schnell: { id: 'schnell', laeufeZumSieg: 1, maxLaeufe: 1, belohnungsFaktor: 0.5 },
  bo3: { id: 'bo3', laeufeZumSieg: 2, maxLaeufe: 3, belohnungsFaktor: 1 }
};
export const MAX_WIEDERHOLUNGEN = 2;

const anderer = (s) => (s === 'A' ? 'B' : 'A');

export class BattleAblauf {
  /**
   * @param {{format?: 'schnell'|'bo3', seed?: number|string}} o
   */
  constructor({ format = 'bo3', seed = 1 } = {}) {
    this.format = FORMATE[format] || FORMATE.bo3;
    this.zufall = new Zufall(seed);
    this.laeufe = [];
    this.siegeA = 0;
    this.siegeB = 0;
    this.wiederholungenInFolge = 0;
    this.sieger = null;
    this.entscheidung = null; // 'punkte' | 'fuehrerpunkte' | 'muenzwurf' | 'aufgabe'
    this._neuerLauf(this.zufall.chance(0.5) ? 'A' : 'B', false);
  }

  get fertig() {
    return this.sieger !== null;
  }

  get aktuellerLauf() {
    return this.laeufe[this.laeufe.length - 1];
  }

  /** Anzahl gewerteter (nicht wiederholter) Läufe. */
  get gewerteteLaeufe() {
    return this.laeufe.filter((l) => l.ergebnis && !l.ergebnis.gleichstand).length;
  }

  _neuerLauf(startRolle, wiederholung) {
    this.laeufe.push({ nummer: this.laeufe.length + 1, startRolle, wiederholung, durchgaenge: [], ergebnis: null });
  }

  /** Beschreibung des nächsten Durchgangs (wer führt). */
  naechsterDurchgang() {
    if (this.fertig) return null;
    const lauf = this.aktuellerLauf;
    const n = lauf.durchgaenge.length;
    const fuehrer = n === 0 ? lauf.startRolle : anderer(lauf.startRolle);
    return { laufNr: this.gewerteteLaeufe + 1, laufIndex: this.laeufe.length, durchgangNr: n + 1, fuehrer, verfolger: anderer(fuehrer), wiederholung: lauf.wiederholung };
  }

  /**
   * Ergebnis eines Durchgangs eintragen.
   * @param {{fuehrerPunkte:number, verfolgerNorm:number}} e normierte Punkte (0–100); die Verfolger-
   *   Endpunkte werden hier mit dem Fairness-Faktor berechnet.
   * @returns {{laufEnde: boolean, lauf?: object, battleEnde: boolean}}
   */
  durchgangEintragen({ fuehrerPunkte, verfolgerNorm }) {
    if (this.fertig) throw new Error('Battle ist beendet');
    const d = this.naechsterDurchgang();
    const verfolgerPunkte = verfolgerEndpunkte(verfolgerNorm, fuehrerPunkte);
    const lauf = this.aktuellerLauf;
    lauf.durchgaenge.push({ fuehrer: d.fuehrer, fuehrerPunkte, verfolgerPunkte, verfolgerNorm });
    if (lauf.durchgaenge.length < 2) return { laufEnde: false, battleEnde: false };
    return this._laufAuswerten(lauf);
  }

  _punkte(lauf, s) {
    let fuehrer = 0, verfolger = 0;
    for (const d of lauf.durchgaenge) {
      if (d.fuehrer === s) fuehrer = d.fuehrerPunkte;
      else verfolger = d.verfolgerPunkte;
    }
    return { fuehrer, verfolger, summe: fuehrer + verfolger };
  }

  _laufAuswerten(lauf) {
    const a = this._punkte(lauf, 'A');
    const b = this._punkte(lauf, 'B');
    const diff = a.summe - b.summe;
    if (Math.abs(diff) < WERTUNG.gleichstandGrenze) {
      if (this.wiederholungenInFolge < MAX_WIEDERHOLUNGEN) {
        lauf.ergebnis = { a, b, sieger: null, gleichstand: true };
        this.wiederholungenInFolge++;
        this._neuerLauf(this.zufall.chance(0.5) ? 'A' : 'B', true);
        return { laufEnde: true, lauf, battleEnde: false };
      }
      // Nach zwei Wiederholungen: höhere Führer-Punktzahl des letzten Laufs, sonst Münzwurf
      let sieger;
      let art;
      if (a.fuehrer !== b.fuehrer) {
        sieger = a.fuehrer > b.fuehrer ? 'A' : 'B';
        art = 'fuehrerpunkte';
      } else {
        sieger = this.zufall.chance(0.5) ? 'A' : 'B';
        art = 'muenzwurf';
      }
      lauf.ergebnis = { a, b, sieger, gleichstand: false, entscheidung: art };
      this.wiederholungenInFolge = 0;
      return this._laufGewonnen(lauf, sieger, art);
    }
    const sieger = diff > 0 ? 'A' : 'B';
    lauf.ergebnis = { a, b, sieger, gleichstand: false, entscheidung: 'punkte' };
    this.wiederholungenInFolge = 0;
    return this._laufGewonnen(lauf, sieger, 'punkte');
  }

  _laufGewonnen(lauf, sieger, art) {
    if (sieger === 'A') this.siegeA++;
    else this.siegeB++;
    const ziel = this.format.laeufeZumSieg;
    if (this.siegeA >= ziel || this.siegeB >= ziel || this.gewerteteLaeufe >= this.format.maxLaeufe) {
      this.sieger = this.siegeA > this.siegeB ? 'A' : 'B';
      this.entscheidung = art;
      return { laufEnde: true, lauf, battleEnde: true };
    }
    // Nächster Lauf: Startrolle wechselt gegenüber dem Vorlauf
    this._neuerLauf(anderer(lauf.startRolle), false);
    return { laufEnde: true, lauf, battleEnde: false };
  }

  /** Aufgabe/Abbruch: der andere gewinnt. */
  aufgeben(seite) {
    this.sieger = anderer(seite);
    this.entscheidung = 'aufgabe';
  }

  /** Kompakte Zusammenfassung (für Ergebnisbildschirm und Netzwerk). */
  zusammenfassung() {
    return {
      format: this.format.id,
      sieger: this.sieger,
      entscheidung: this.entscheidung,
      siegeA: this.siegeA,
      siegeB: this.siegeB,
      laeufe: this.laeufe.filter((l) => l.ergebnis).map((l) => ({
        nummer: l.nummer,
        wiederholung: l.wiederholung,
        gleichstand: l.ergebnis.gleichstand,
        sieger: l.ergebnis.sieger,
        a: l.ergebnis.a,
        b: l.ergebnis.b
      }))
    };
  }
}
