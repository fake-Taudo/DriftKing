// Bot-Fahrer: steuert ein Fahrzeug ausschließlich über virtuelle Eingaben (Lenken, Gas, Bremse,
// Handbremse) – gleiche Physik wie der Spieler, keine Tempo- oder Grip-Tricks.
//
// Fahrlogik: Zielpunkt auf der Ideallinie (bzw. auf der Spur des Führers) im Vorausschau-Abstand,
// Zielgeschwindigkeit aus dem Geschwindigkeitsprofil, Soll-Driftwinkel aus den Drift-Zonen.
// Grip-Fahrt: Pure-Pursuit-Lenkung. Drift: Lenkregler (PD) auf die Soll-Ausrichtung
// (Bewegungsrichtung + Driftwinkel), Gasregler auf Driftwinkel und Tempo, Einleitung per Handbremse.
// Stufen unterscheiden sich in Linienqualität, Winkelkontrolle, Fehlerquote und Reaktionszeit.
import { klemme, lerp, winkelNorm, glattStufe, GRAD } from '../mathe.js';
import { Zufall } from '../zufall.js';
import { PHYSIK } from '../physikParameter.js';

const FEHLER_ARTEN = ['zuViel', 'zuWenig', 'weit', 'spaet'];

export class BotFahrer {
  /**
   * @param {object} S Laufzeit-Strecke
   * @param {import('../physik/fahrzeug.js').Fahrzeug} fahrzeug
   * @param {object} stufe Bot-Stufe (botStufen.js)
   * @param {{seed?: number|string, rolle?: 'fuehrer'|'verfolger'|'einzel', modus?: 'drift'|'grip'}} [o]
   */
  constructor(S, fahrzeug, stufe, { seed = 1, rolle = 'einzel', modus = 'drift' } = {}) {
    this.S = S;
    this.f = fahrzeug;
    this.stufe = stufe;
    this.rolle = rolle;
    this.modus = modus;
    this.z = new Zufall(seed);
    this.hinweis = undefined;
    this.zeit = 0;
    this.gegner = null;
    this.spur = []; // Spur des Führers (für Verfolger): {index, x, y, winkel}
    // Seedbares „Rauschen“ der Linie (zwei überlagerte Sinus)
    this.phasen = [this.z.bereich(0, 6.28), this.z.bereich(0, 6.28), this.z.bereich(0.25, 0.5), this.z.bereich(0.6, 1.1)];
    this.ausgabe = { lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0 };
    this.verzoegert = [];
    this.einleitung = 0;
    this.zone = -1;
    this.fehler = null;
    this.driftAktiv = false;
    this.letzteZone = -1;
  }

  /** Für Verfolger: das Führungsfahrzeug. */
  setzeGegner(fahrzeug) {
    this.gegner = fahrzeug;
    this.spur.length = 0;
  }

  _rauschen() {
    const a = this.stufe.linienAbweichung;
    if (!a) return 0;
    const [p1, p2, w1, w2] = this.phasen;
    return a * (0.62 * Math.sin(this.zeit * w1 + p1) + 0.38 * Math.sin(this.zeit * w2 + p2));
  }

  /** Maximaler Lenkwinkel bei Tempo v (wie in der Physik), für die Umrechnung Winkel → Eingabe. */
  _maxLenk(v) {
    const p = this.f.p;
    const L = PHYSIK.lenkung;
    const maxStand = p.lenkwinkelMax * GRAD;
    const maxSchnell = Math.min(maxStand, L.maxWinkelSchnellGrad * GRAD);
    return lerp(maxStand, maxSchnell, glattStufe(0, L.abfallTempo, v));
  }

  /**
   * Berechnet die Eingabe für den nächsten Physik-Schritt.
   * @param {number} dt
   */
  schritt(dt) {
    this.zeit += dt;
    const S = this.S;
    const f = this.f;
    const z = f.z;
    const st = this.stufe;
    const n = S.anzahl;
    const v = f.tempo;
    const proj = S.projektion(z.x, z.y, this.hinweis);
    this.hinweis = proj.index;
    const i = proj.index;

    // Spur des Führers mitschreiben (für den Verfolger)
    if (this.gegner) {
      const g = this.gegner;
      const gp = S.projektion(g.z.x, g.z.y, this._gHinweis);
      this._gHinweis = gp.index;
      const letzte = this.spur[this.spur.length - 1];
      if (!letzte || letzte.index !== gp.index) {
        this.spur.push({ index: gp.index, x: g.z.x, y: g.z.y, winkel: -g.schwimmwinkel / GRAD });
        if (this.spur.length > 400) this.spur.shift();
      }
    }

    // Zone und Fehler je Zone
    const zi = S.zoneVon[(i + Math.round(6 / S.ds)) % n];
    if (zi !== this.letzteZone) {
      this.letzteZone = zi;
      this.fehler = null;
      if (zi >= 0 && this.z.chance(st.fehlerQuote)) this.fehler = { art: this.z.waehle(FEHLER_ARTEN), staerke: this.z.bereich(0.5, 1) };
    }

    // Vorausschau
    const vorMeter = klemme(4 + v * 0.38, 6, 20);
    const j = (i + Math.round(vorMeter / S.ds)) % n;
    let querZiel = S.ideal.versatz[j] + this._rauschen();
    if (this.fehler && this.fehler.art === 'weit') {
      querZiel -= Math.sign(S.ideal.kruemmung[j] || 1) * 3.5 * this.fehler.staerke;
    }
    let zx = S.proben[j].x + S.proben[j].nx * querZiel;
    let zy = S.proben[j].y + S.proben[j].ny * querZiel;

    // Verfolger: auf der Spur des Führers bleiben (Genauigkeit mischt mit der Ideallinie)
    let sollWinkelVerfolger = null;
    let abstandFehler = 0;
    if (this.rolle === 'verfolger' && this.gegner && this.spur.length) {
      let bester = null, bestD = Infinity;
      for (const s of this.spur) {
        let d = Math.abs(s.index - j);
        d = Math.min(d, n - d);
        if (d < bestD) { bestD = d; bester = s; }
      }
      if (bester && bestD < 15) {
        const g = st.verfolgerGenauigkeit;
        zx = lerp(zx, bester.x, g);
        zy = lerp(zy, bester.y, g);
        sollWinkelVerfolger = bester.winkel;
      }
      // Abstand entlang der Strecke (m), Sollbereich 6–10 m
      const gp = S.projektion(this.gegner.z.x, this.gegner.z.y, this._gHinweis);
      let d = gp.index - i;
      if (d < -n / 2) d += n;
      if (d > n / 2) d -= n;
      abstandFehler = d * S.ds - 8;
    }

    const theta = z.theta;
    const phiD = Math.atan2(zy - z.y, zx - z.x);
    const phiV = v > 1.5 ? f.bewegungsRichtung : theta;

    // Zielgeschwindigkeit
    let vZiel = S.ideal.tempo[(i + Math.round(4 / S.ds)) % n] * st.tempoFaktor;
    if (this.rolle === 'verfolger' && this.gegner) vZiel = Math.max(4, vZiel + klemme(abstandFehler * 0.35, -8, 8));
    if (this.rolle === 'einzel' && this.modus === 'grip') vZiel *= 0.92;

    // Soll-Driftwinkel (Grad, Vorzeichen = Kurvenrichtung; + = Linkskurve)
    let sollW = 0;
    if (this.modus === 'drift') {
      const ideal = S.ideal.sollWinkel[j];
      if (Math.abs(ideal) > 1) {
        const [a, b] = st.sollWinkel;
        const zone = S.zonen[S.zoneVon[j]];
        const anteil = zone ? klemme((Math.abs(ideal) - zone.winkelMin) / Math.max(1, zone.winkelMax - zone.winkelMin), 0, 1) : 0.5;
        sollW = Math.sign(ideal) * lerp(a, b, anteil);
      }
      if (sollWinkelVerfolger !== null && Math.abs(sollW) > 1) {
        sollW = lerp(sollW, sollWinkelVerfolger, st.verfolgerGenauigkeit * 0.8);
      }
      if (this.fehler) {
        if (this.fehler.art === 'zuViel') sollW *= 1 + 0.6 * this.fehler.staerke;
        if (this.fehler.art === 'zuWenig') sollW *= 1 - 0.55 * this.fehler.staerke;
      }
    }
    const betaIst = -f.schwimmwinkel / GRAD; // + = Nase links der Bewegungsrichtung (Linksdrift)
    const e = { lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0 };

    if (Math.abs(sollW) < 8) {
      // --- Grip-Fahrt: Pure Pursuit ---
      this.driftAktiv = false;
      const alpha = winkelNorm(phiD - theta);
      const krumm = (2 * Math.sin(alpha)) / vorMeter;
      const delta = Math.atan(krumm * f.p.radstand);
      e.lenken = klemme(-delta / Math.max(0.05, this._maxLenk(v)), -1, 1);
      // Restdrift ausleiten: in Bewegungsrichtung gegenlenken
      if (Math.abs(betaIst) > 10) e.lenken = klemme(e.lenken + Math.sign(betaIst) * 0.25, -1, 1);
      const dv = vZiel - v;
      e.gas = klemme(0.3 + dv * 0.3, 0, 1);
      e.bremse = klemme(-dv * 0.22 - 0.15, 0, 1);
      if (e.bremse > 0) e.gas = 0;
      if (Math.abs(betaIst) > 25) e.gas = Math.min(e.gas, 0.3);
    } else {
      // --- Drift ---
      const s = Math.sign(sollW);
      // Einleitung per Handbremse, wenn noch kein Winkel aufgebaut ist
      if (!this.driftAktiv) {
        this.driftAktiv = true;
        const verspaetung = this.fehler && this.fehler.art === 'spaet' ? 0.5 * this.fehler.staerke : 0;
        if (betaIst * s < 8 && v > 8) this.einleitung = 0.24 + verspaetung;
        this._einleitungVerz = verspaetung;
      }
      if (this.einleitung > 0) {
        this.einleitung -= dt;
        if (this._einleitungVerz > 0) {
          this._einleitungVerz -= dt;
        } else if (this.einleitung > 0) {
          e.handbremse = 1;
          e.lenken = -s;
          e.gas = 0.6;
          return this._ausgeben(e, dt);
        }
      }
      const thetaZiel = phiD + s * Math.abs(sollW) * GRAD;
      const eTheta = winkelNorm(thetaZiel - theta);
      const rZiel = v * S.ideal.kruemmung[i];
      const kp = 2.2, kd = 0.45;
      e.lenken = klemme(-(kp * eTheta + kd * (rZiel - z.r)), -1, 1);
      // Gas: Winkel aufbauen/halten, Tempo halten
      const wFehler = Math.abs(sollW) - betaIst * s;
      const dv = vZiel - v;
      e.gas = klemme(0.62 + wFehler * 0.022 + dv * 0.05, 0, 1);
      if (betaIst * s > Math.abs(sollW) + 28) e.gas = 0; // Dreher droht
      if (betaIst * s < -5) e.gas = Math.min(e.gas, 0.5); // falsche Richtung: erst fangen
      if (dv < -6) e.bremse = klemme(-dv * 0.05, 0, 0.5);
    }
    return this._ausgeben(e, dt);
  }

  /** Reaktionszeit: Eingaben werden verzögert und geglättet weitergegeben. */
  _ausgeben(e, dt) {
    const r = this.stufe.reaktion;
    this.verzoegert.push({ t: this.zeit, e });
    const verz = r * 0.35;
    while (this.verzoegert.length > 1 && this.verzoegert[1].t <= this.zeit - verz) this.verzoegert.shift();
    const ziel = this.verzoegert[0].e;
    const a = this.ausgabe;
    const k = 1 - Math.exp(-dt / Math.max(0.02, r * 0.5));
    a.lenken += (ziel.lenken - a.lenken) * k;
    a.gas += (ziel.gas - a.gas) * Math.min(1, k * 1.5);
    a.bremse = ziel.bremse;
    a.handbremse = ziel.handbremse;
    a.kupplung = 0;
    return a;
  }
}
