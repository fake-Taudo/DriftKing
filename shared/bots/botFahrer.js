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

/** Regler-Werte (per Simulation abgestimmt, scripts/botKalibrierung.js). */
export const STANDARD_REGLER = {
  vorBasis: 4, vorFaktor: 0.3, vorMin: 6, vorMax: 20, // Vorausschau (m)
  assistenz: 0.85, // Gegenlenk-Assistenz des Bot-Fahrzeugs (wie beim Spieler einstellbar)
  kTheta: 2.4, kR: 0.6, // Lenkregler auf Soll-Ausrichtung (Bewegungsrichtung + Driftwinkel) und Gierrate
  kl: 0, kld: 0, // optionaler reiner Winkelregler in der Lenkung (abgestimmt: aus)
  kPfadLenk: 1, // Anteil der Ausrichtungs-Lenkung
  gasModus: 'winkel', // Gas regelt den Driftwinkel (+ Tempo)
  gas0: 0.6, kpGas: 0.03, kiGas: 0, kdGas: 0.002, kvGas: 0.05,
  gasT0: 0.72, kvT: 0.12, kQuer: 1.2, // nur für gasModus 'tempo'
  einleitung: 0.24, // s Handbremse zum Einleiten
  driftTempo: 0.78, // Zieltempo in Drift-Zonen relativ zum Grip-Zieltempo
  einleitTempo: 1.12, // erst einleiten, wenn das Tempo höchstens so viel über dem Ziel liegt
  randAbstand: 2.0, randGas: 0.25, randLenk: 0.35, // Randschutz nahe der Außenkante
  winkelPfad: 0.6, // Linienfehler (Grad) → zusätzlicher Soll-Winkel
  sollFaktor: 1.0,
  lenkModus: 'ausrichtung' // Drift-Lenkung: 'ausrichtung' (Soll-Ausrichtung) oder 'pursuit' (Linie, Winkel nur über das Gas)
};

/** Fahrstil je Auto (per Simulation gesucht, scripts/botFahrstil.js): ein guter Fahrer passt sich dem Auto an. */
export const AUTO_FAHRSTIL = {
  kestrel_s: { gas0: 0.65, kpGas: 0.04, driftTempo: 0.72 },
  marlin_4d: { gas0: 0.8, kpGas: 0.02, driftTempo: 0.84 },
  vireo_turbo: { gas0: 0.5, kpGas: 0.02, driftTempo: 0.72 },
  hornet_wagon: { gas0: 0.8, kpGas: 0.02, driftTempo: 0.84 },
  bastion_gt: { gas0: 0.5, kpGas: 0.04, driftTempo: 0.72 },
  onyx_rs: { gas0: 0.65, kpGas: 0.04, driftTempo: 0.84 }
};

export class BotFahrer {
  /**
   * @param {object} S Laufzeit-Strecke
   * @param {import('../physik/fahrzeug.js').Fahrzeug} fahrzeug
   * @param {object} stufe Bot-Stufe (botStufen.js)
   * @param {{seed?: number|string, rolle?: 'fuehrer'|'verfolger'|'einzel', modus?: 'drift'|'grip'}} [o]
   */
  constructor(S, fahrzeug, stufe, { seed = 1, rolle = 'einzel', modus = 'drift', regler, auslassen } = {}) {
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
    this.R = { ...STANDARD_REGLER, ...(AUTO_FAHRSTIL[fahrzeug.p.id] || {}), ...(regler || {}) };
    // Quote ausgelassener Zonen: Streckendaten (kalibriert) vor Stufen-Richtwert
    this.auslassen = auslassen ?? S.def?.botAuslassen?.[stufe.id] ?? stufe.auslassen ?? 0;
    fahrzeug.assistenz.gegenlenken = this.R.assistenz;
    this._integ = 0;
    this._betaVorher = 0;
  }

  /**
   * Auslass-Plan für eine Runde: Zonen in zufälliger Reihenfolge werden ausgelassen (nur Grip), bis ihr
   * Gewicht (Fahrzeit bei Referenztempo ≈ erreichbare Punkte) den Anteil q aller Zonen erreicht; die
   * letzte Zone nur mit der Wahrscheinlichkeit des fehlenden Rests. So lässt ein Bot je Runde fast
   * immer denselben Punkte-Anteil liegen – unabhängig davon, ob eine große oder kleine Zone getroffen
   * wird. Die Punkte streuen dadurch deutlich weniger als bei einer Auslosung je Zone.
   */
  _planNeu() {
    const S = this.S;
    const n = S.anzahl;
    const gew = S.zonen.map((z) => ((z.bis - z.von + n) % n) * S.ds / Math.max(5, z.referenzTempo));
    const ziel = this.auslassen * gew.reduce((a, b) => a + b, 0);
    const plan = new Set();
    let erreicht = 0;
    for (const i of this.z.gemischt([...gew.keys()])) {
      const rest = ziel - erreicht;
      if (rest <= 1e-9) break;
      if (gew[i] <= rest) {
        plan.add(i);
        erreicht += gew[i];
      } else {
        if (this.z.chance(rest / gew[i])) plan.add(i);
        break;
      }
    }
    this._auslassPlan = plan;
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
      if (zi >= 0) {
        // Neuer Plan je Runde: wenn die Zonennummer kleiner wird (Zonen sind in Fahrtrichtung nummeriert)
        if (!this._auslassPlan || zi < this._planLetzte) this._planNeu();
        this._planLetzte = zi;
        if (this._auslassPlan.has(zi)) this.fehler = { art: 'auslassen', staerke: 1 };
        else if (this.z.chance(st.fehlerQuote)) this.fehler = { art: this.z.waehle(FEHLER_ARTEN), staerke: this.z.bereich(0.5, 1) };
      }
    }

    // Vorausschau
    const R = this.R;
    const vorMeter = klemme(R.vorBasis + v * R.vorFaktor, R.vorMin, R.vorMax);
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
      // Tatsächlicher Abstand (Luftlinie) für den Kontaktschutz, Streckenabstand für die Regelung
      this._luftAbstand = Math.hypot(this.gegner.z.x - z.x, this.gegner.z.y - z.y);
      abstandFehler = d * S.ds - 8;
    }

    const theta = z.theta;
    const phiD = Math.atan2(zy - z.y, zx - z.x);
    const phiV = v > 1.5 ? f.bewegungsRichtung : theta;

    // Zielgeschwindigkeit
    let vZiel = S.ideal.tempo[(i + Math.round(4 / S.ds)) % n] * st.tempoFaktor;
    if (this.rolle === 'verfolger' && this.gegner) {
      // Sollabstand 8 m: zu weit → aufholen, zu nah → deutlich zurücknehmen (kein Auffahren)
      const k = abstandFehler > 0 ? 0.35 : 0.9;
      vZiel = Math.max(4, vZiel + klemme(abstandFehler * k, -12, 8));
      vZiel = Math.min(vZiel, this.gegner.tempo + (abstandFehler > 0 ? 6 : -1.5));
      if (this._luftAbstand < 5.5) vZiel = Math.min(vZiel, this.gegner.tempo - (5.5 - this._luftAbstand) * 1.5);
    }
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
        if (this.fehler.art === 'zuViel') sollW *= 1 + 0.3 * this.fehler.staerke;
        if (this.fehler.art === 'auslassen') sollW = 0;
        if (this.fehler.art === 'zuWenig') sollW *= 1 - 0.55 * this.fehler.staerke;
      }
    }
    const betaIst = -f.schwimmwinkel / GRAD; // + = Nase links der Bewegungsrichtung (Linksdrift)
    const e = { lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0 };
    if (Math.abs(sollW) >= 8) vZiel *= R.driftTempo;
    // Ausgelassene Zone: vorsichtig mit Grip durchfahren (kein ungewolltes Rutschen)
    if (this.fehler && this.fehler.art === 'auslassen' && zi >= 0) vZiel *= st.vorsicht ?? 0.92;
    // Zu schnell für die Einleitung: erst wie bei Grip-Fahrt herunterbremsen
    const zuSchnell = Math.abs(sollW) >= 8 && !this.driftAktiv && v > vZiel * R.einleitTempo && betaIst * Math.sign(sollW) < 8;

    if (Math.abs(sollW) < 8 || zuSchnell) {
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
      // Unbeabsichtigtes Rutschen bei Grip-Fahrt sofort abfangen (Gas weg)
      if (Math.abs(betaIst) > 8) e.gas = Math.min(e.gas, Math.max(0, 0.45 - (Math.abs(betaIst) - 8) * 0.03));
    } else {
      // --- Drift ---
      const s = Math.sign(sollW);
      // Einleitung per Handbremse, wenn noch kein Winkel aufgebaut ist
      if (!this.driftAktiv) {
        this.driftAktiv = true;
        this._integ = 0;
        // Reaktionszeit: die Einleitung kommt um die Reaktionszeit später (plus Fehler „zu spät“)
        const verspaetung = this.stufe.reaktion + (this.fehler && this.fehler.art === 'spaet' ? 0.5 * this.fehler.staerke : 0);
        if (betaIst * s < 8 && v > 8) this.einleitung = R.einleitung + verspaetung;
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
          this._betaVorher = betaIst * s;
          return this._ausgeben(e, dt);
        }
      }
      const beta = betaIst * s; // > 0: Drift in Kurvenrichtung
      const pfadFehler = (winkelNorm(phiD - phiV) * s) / GRAD;
      const sollEff = Math.abs(sollW) * R.sollFaktor + klemme(R.winkelPfad * pfadFehler, -15, 15);
      const thetaZiel = phiD + s * sollEff * GRAD;
      const eTheta = winkelNorm(thetaZiel - theta);
      const rZiel = v * S.ideal.kruemmung[i];
      const wFehler = sollEff - beta;
      this._integ = klemme(this._integ + wFehler * dt, -30, 30);
      const rate = (beta - this._betaVorher) / dt;
      this._betaVorher = beta;
      // Lenkung: Winkelregler (schnell) + Anteil Ausrichtungsregler (Linie)
      const lenkWinkel = s * (-R.kl * wFehler + R.kld * rate);
      const lenkPfad = -(R.kTheta * eTheta + R.kR * (rZiel - z.r));
      e.lenken = klemme(lenkWinkel + R.kPfadLenk * lenkPfad, -1, 1);
      if (R.lenkModus === 'pursuit') {
        const alpha = winkelNorm(phiD - theta);
        const delta = Math.atan(((2 * Math.sin(alpha)) / vorMeter) * f.p.radstand);
        e.lenken = klemme(-delta / Math.max(0.05, this._maxLenk(v)), -1, 1);
      }
      // Gas: PI-Regler auf den Driftwinkel, plus Tempo
      const dv = vZiel - v;
      if (R.gasModus === 'tempo') {
        const aussen = Math.max(0, -s * (proj.quer - S.ideal.versatz[i])); // m außerhalb der Linie
        const vEff = vZiel - (R.kQuer * aussen) / 3.6;
        e.gas = klemme(R.gasT0 + R.kvT * (vEff - v) + R.kpGas * wFehler, 0, 1);
      } else {
        e.gas = klemme(R.gas0 + R.kpGas * wFehler + R.kiGas * this._integ - R.kdGas * rate + R.kvGas * dv, 0, 1);
      }
      if (beta > sollEff + 28) e.gas = 0; // Dreher droht
      if (beta < -5) e.gas = Math.min(e.gas, 0.5); // falsche Richtung: erst fangen
      if (dv < -6) e.bremse = klemme(-dv * 0.05, 0, 0.5);
      // Randschutz: nahe der Außenkante Gas zurücknehmen und in die Kurve lenken
      const p = S.proben[i];
      const aussenAbstand = p.breite / 2 + s * proj.quer; // Außenseite liegt bei −s
      const unter = R.randAbstand - aussenAbstand;
      if (unter > 0) {
        e.gas = klemme(e.gas - R.randGas * unter, 0, 1);
        e.lenken = klemme(e.lenken - s * R.randLenk * unter, -1, 1);
      }
    }
    // Auffahrschutz des Verfolgers (auch im Drift): unter 5 m Luftlinie hinter dem Führer Gas weg
    // und bremsen – ein langsamer oder stehender Führer (z. B. ein Mensch nach einem Dreher) wird
    // nicht angeschoben.
    if (this.rolle === 'verfolger' && this.gegner && abstandFehler < 0 && this._luftAbstand < 5) {
      const nah = klemme((5 - this._luftAbstand) / 2, 0, 1);
      e.gas *= 1 - nah;
      e.bremse = Math.max(e.bremse, 0.7 * nah);
    }
    return this._ausgeben(e, dt);
  }

  /** Eingaben leicht verzögert und geglättet weitergeben (die Reaktionszeit wirkt vor allem auf Entscheidungen). */
  _ausgeben(e, dt) {
    const r = this.stufe.reaktion;
    this.verzoegert.push({ t: this.zeit, e });
    const verz = r * 0.1;
    while (this.verzoegert.length > 1 && this.verzoegert[1].t <= this.zeit - verz) this.verzoegert.shift();
    const ziel = this.verzoegert[0].e;
    const a = this.ausgabe;
    const k = 1 - Math.exp(-dt / (0.03 + r * 0.12));
    a.lenken += (ziel.lenken - a.lenken) * k;
    a.gas += (ziel.gas - a.gas) * Math.min(1, k * 1.5);
    a.bremse = ziel.bremse;
    a.handbremse = ziel.handbremse;
    a.kupplung = 0;
    return a;
  }
}
