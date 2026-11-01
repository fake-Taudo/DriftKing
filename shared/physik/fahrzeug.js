// Fahrzeugsimulation auf einer flachen 2D-Ebene (Einspurmodell mit Lastverlagerung).
//
// Koordinaten: Welt (x, y) in Metern, Gierwinkel theta (0 = Blick in +x, gegen den Uhrzeigersinn
// positiv). Karosserie-Koordinaten: vx nach vorne, vy nach links, Gierrate r gegen den Uhrzeigersinn.
// Lenkwinkel delta: positiv = nach links. Die Eingabe-Schicht liefert lenken +1 = rechts.
//
// Vorderachse: vereinfachte Pacejka-Kurve über dem Schräglaufwinkel, Bremse/Allrad-Anteil über
// den Kamm'schen Kreis.
// Hinterachse: Raddrehzahl ω ist ein eigener Zustand (implizit gelöst → stabil). Die Reifenkraft
// folgt aus dem kombinierten Schlupf (Längsschlupf aus ω, Querschlupf aus der Seitengeschwindigkeit).
// Drehen die Räder durch, zeigt der Reibkraftvektor nach vorne und die Seitenführung bricht ein –
// genau das ist der Kern des Driftens. Handbremse = großes Bremsmoment → Räder blockieren.
// Arcade-Hilfen (Gegenlenk-Assistenz, Drift-Haltehilfe, Gierdämpfung) stehen in physikParameter.js.
import { PHYSIK } from '../physikParameter.js';
import { klemme, lerp, glattStufe, naehern, glaetten, GRAD } from '../mathe.js';
import { autoKreise } from './kollision.js';

const P = PHYSIK;
const ZWEI_PI_DURCH_60 = (2 * Math.PI) / 60;

/** Pacejka-Formfaktor B aus dem Winkel der Spitzenkraft. */
function pacejkaB(spitzeRad, C) {
  return Math.tan(Math.PI / (2 * C)) / spitzeRad;
}

/** Relative Seitenkraft (−1..1) über dem Schräglaufwinkel. */
function pacejka(alpha, B, C) {
  const f = Math.sin(C * Math.atan(B * Math.abs(alpha)));
  return alpha < 0 ? -f : f;
}

/** Formfaktor C aus dem gewünschten Gleitreibungs-Anteil (Kraft bei sehr großem Schlupf). */
function formAusGleiten(gleitAnteil) {
  return 2 - (2 / Math.PI) * Math.asin(klemme(gleitAnteil, 0.5, 0.995));
}

/** Relatives Drehmoment aus der Stützstellen-Kurve. u = Drehzahl / Maximaldrehzahl. */
function kurveWert(kurve, u) {
  if (u <= kurve[0][0]) return kurve[0][1];
  for (let i = 1; i < kurve.length; i++) {
    if (u <= kurve[i][0]) {
      const [u0, w0] = kurve[i - 1];
      const [u1, w1] = kurve[i];
      return w0 + ((w1 - w0) * (u - u0)) / (u1 - u0);
    }
  }
  return kurve[kurve.length - 1][1];
}

export class Fahrzeug {
  /**
   * @param {object} p effektive Parameter (shared/tuning.js → effektiveParameter)
   * @param {{gegenlenken?: number, driftHalten?: number, getriebe?: 'auto'|'manuell'}} [assistenz]
   */
  constructor(p, assistenz = {}) {
    this.p = p;
    this.assistenz = { gegenlenken: 0.6, driftHalten: 0, getriebe: 'auto', ...assistenz };
    this._ableiten();
    this.z = this._leererZustand();
    this.vorher = { x: 0, y: 0, theta: 0 };
    this.ereignisse = [];
    this._kupplungVorher = 0;
    this._gasVorher = 0;
    this._fx = 0;
    this._fy = 0;
    this._sn = 0;
  }

  /** Vorberechnung aller abgeleiteten Konstanten aus den Parametern. */
  _ableiten() {
    const p = this.p;
    const g = P.g;
    this.m = p.masse;
    this.L = p.radstand;
    this.lh = p.radstand * p.gewichtVorne; // Schwerpunkt → Hinterachse
    this.lv = p.radstand - this.lh; // Schwerpunkt → Vorderachse
    this.Iz = this.m * this.lv * this.lh * p.traegheitFaktor * 1.1;
    this.FzVStatisch = (this.m * g * this.lh) / this.L;
    this.FzHStatisch = (this.m * g * this.lv) / this.L;
    this.CV = formAusGleiten(p.gleitAnteil);
    this.CH = formAusGleiten(p.gleitAnteilHinten ?? p.gleitAnteil);
    this.BV = pacejkaB(P.reifen.spitzeVorneGrad * GRAD, this.CV);
    this.B1 = Math.tan(Math.PI / (2 * this.CH)); // Spitze bei normiertem Schlupf 1
    this.tanSpitzeH = Math.tan(P.reifen.spitzeHintenGrad * GRAD);
    // Drehmoment so skalieren, dass die Spitzenleistung den (getunten) Watt entspricht
    let maxRel = 0;
    for (let rpm = p.leerlauf; rpm <= p.drehzahlMax; rpm += 25) {
      const w = kurveWert(p.drehmomentKurve, rpm / p.drehzahlMax) * rpm * ZWEI_PI_DURCH_60;
      if (w > maxRel) maxRel = w;
    }
    this.drehmomentSkala = p.leistungWatt / maxRel;
    this.drehmomentMax = this.drehmomentSkala * Math.max(...p.drehmomentKurve.map((k) => k[1]));
    // Luftwiderstand aus der Auslegungs-Höchstgeschwindigkeit (Serienleistung):
    // η·P = c·v³ + c_rr·m·g·v  →  getunte Autos werden dadurch automatisch schneller.
    const vMax = p.hoechstKmhAuslegung / 3.6;
    this.crr = 0.012;
    const pRad = P.antrieb.wirkungsgrad * p.leistungWattSerie;
    this.cLuft = Math.max(0.15, (pRad - this.crr * this.m * g * vMax) / (vMax * vMax * vMax)) * (1 + (p.luftZuschlag || 0));
    this.kreise = autoKreise(p.abmessungen);
  }

  _leererZustand() {
    return {
      x: 0, y: 0, theta: 0,
      vx: 0, vy: 0, r: 0,
      omegaH: 0, // Winkelgeschwindigkeit der Hinterräder (rad/s)
      delta: 0,
      drehzahl: this.p.leerlauf,
      gang: 1,
      zielGang: 1,
      richtung: 1,
      schaltTimer: 0,
      ladedruck: 0,
      kickTimer: 0,
      kickSperre: 0,
      begrenzer: 0,
      rueckTimer: 0,
      axGl: 0,
      ayGl: 0,
      // Ausgaben für Anzeige, Wertung, VFX, Audio
      schlupfV: 0, // Schräglaufwinkel vorne (rad)
      schlupfH: 0, // Schräglaufwinkel hinten (rad)
      schlupfNormH: 0, // normierter kombinierter Schlupf hinten (1 = Haftgrenze)
      durchdrehen: 0, // Längsschlupf der Hinterräder (0 = rollt, 1 = doppelt so schnell wie der Boden)
      gleitenH: 0, // 0..1 Rutschen hinten (Qualm, Quietschen)
      gleitenV: 0,
      gasEff: 0,
      bremsEff: 0,
      handbremse: 0,
      kupplungGetrennt: false,
      radWinkelV: 0,
      radWinkelH: 0,
      radGeschwV: 0,
      radGeschwH: 0,
      wandKontakt: false,
      wandKontaktZeit: 0,
      last: 0
    };
  }

  /** Setzt Position und Ausrichtung (Geschwindigkeit optional entlang der Blickrichtung). */
  setzen(x, y, theta, tempo = 0) {
    const z = this._leererZustand();
    const p = this.p;
    z.x = x; z.y = y; z.theta = theta;
    z.vx = tempo;
    z.omegaH = tempo / p.radRadius;
    if (tempo > 3) {
      // Passenden Gang für fliegenden Start wählen
      for (let g = 1; g <= p.gaenge.length; g++) {
        z.gang = g;
        z.zielGang = g;
        const rpm = (tempo / p.radRadius) * p.gaenge[g - 1] * p.achsUebersetzung / ZWEI_PI_DURCH_60;
        z.drehzahl = rpm;
        if (rpm < p.drehzahlMax * 0.8) break;
      }
    }
    this.z = z;
    this.vorher = { x, y, theta };
  }

  get tempo() {
    return Math.hypot(this.z.vx, this.z.vy);
  }

  /** Driftwinkel (rad, 0..π): Winkel zwischen Fahrzeugausrichtung und Bewegungsrichtung. */
  get driftWinkel() {
    const z = this.z;
    if (Math.hypot(z.vx, z.vy) < 1) return 0;
    return Math.abs(Math.atan2(z.vy, z.vx));
  }

  /** Schwimmwinkel mit Vorzeichen (rad): >0 = Bewegung nach links relativ zur Fahrzeugachse. */
  get schwimmwinkel() {
    const z = this.z;
    if (Math.hypot(z.vx, z.vy) < 1) return 0;
    return Math.atan2(z.vy, z.vx);
  }

  /** Bewegungsrichtung in Weltkoordinaten (rad). */
  get bewegungsRichtung() {
    return this.z.theta + Math.atan2(this.z.vy, this.z.vx);
  }

  /** Weltgeschwindigkeit {x, y}. */
  get weltGeschwindigkeit() {
    const z = this.z;
    const c = Math.cos(z.theta), s = Math.sin(z.theta);
    return { x: z.vx * c - z.vy * s, y: z.vx * s + z.vy * c };
  }

  get gangAnzeige() {
    const z = this.z;
    if (z.richtung < 0) return 'R';
    if (Math.abs(z.vx) < 0.3 && z.gasEff < 0.05 && z.bremsEff < 0.05) return 'N';
    return String(z.gang);
  }

  /** Gesamtübersetzung Motor → Rad (mit Vorzeichen: rückwärts negativ). */
  _uebersetzung(gang) {
    const p = this.p;
    if (this.z.richtung < 0) return -p.gaenge[0] * p.achsUebersetzung * 1.05;
    return p.gaenge[gang - 1] * p.achsUebersetzung;
  }

  /**
   * Ein Physik-Schritt.
   * @param {{lenken:number, gas:number, bremse:number, handbremse:number, kupplung?:number, hoch?:boolean, runter?:boolean}} e
   * @param {number} dt
   * @param {import('./kollision.js').KollisionsGitter} [gitter]
   */
  schritt(e, dt, gitter) {
    const z = this.z;
    const p = this.p;
    this.vorher.x = z.x;
    this.vorher.y = z.y;
    this.vorher.theta = z.theta;
    this.ereignisse.length = 0;
    if (!(dt > 0)) return;

    // --- Eingaben aufbereiten ---
    const lenken = klemme(Number(e.lenken) || 0, -1, 1);
    const gasIn = klemme(Number(e.gas) || 0, 0, 1);
    const bremseIn = klemme(Number(e.bremse) || 0, 0, 1);
    const hb = e.handbremse ? 1 : 0;
    const kupplung = e.kupplung ? 1 : 0;
    const v = Math.hypot(z.vx, z.vy);
    const A = P.antrieb;

    // Rückwärtsgang: Bremse im Stand halten → nach 0,3 s rückwärts; Gas → sofort wieder vorwärts
    if (z.richtung === 1) {
      if (v < A.stillstandSchwelle && bremseIn > 0.5 && gasIn < 0.1) {
        z.rueckTimer += dt;
        if (z.rueckTimer >= A.rueckwaertsVerzoegerung) {
          z.richtung = -1;
          z.rueckTimer = 0;
          z.gang = 1;
          z.zielGang = 1;
          z.schaltTimer = 0;
        }
      } else {
        z.rueckTimer = 0;
      }
    } else if (gasIn > 0.1 && z.vx > -A.stillstandSchwelle) {
      z.richtung = 1;
      z.gang = 1;
      z.zielGang = 1;
    }
    let antrieb = z.richtung === 1 ? gasIn : bremseIn;
    const bremsEingabe = z.richtung === 1 ? bremseIn : gasIn;

    // Drift-Haltehilfe (v. a. Touch): kleine Gaskorrektur hält den Drift, ersetzt aber nicht das Fahren
    const halten = this.assistenz.driftHalten || 0;
    if (halten > 0 && z.richtung === 1 && antrieb > 0.15 && v > P.assistenz.driftHaltenMinTempo) {
      const winkel = this.driftWinkel / GRAD;
      if (winkel > P.assistenz.driftHaltenStartGrad && winkel < 100) {
        const korrektur = klemme((P.assistenz.driftHaltenZielGrad - winkel) / 25, -1, 1);
        antrieb = klemme(antrieb + halten * 0.45 * korrektur, 0, 1);
      }
    }
    const gasEff = Math.pow(antrieb, p.gasExponent);
    z.gasEff = gasEff;
    z.bremsEff = bremsEingabe;
    z.handbremse = hb;

    // Kupplungstritt (Flanke): kurzer Drehmomentstoß
    if (kupplung && !this._kupplungVorher && z.kickSperre <= 0 && gasEff > 0.3 && z.richtung === 1) {
      z.kickTimer = A.kupplungsKickDauer;
      z.kickSperre = A.kupplungsKickSperre;
      this.ereignisse.push({ art: 'kupplung' });
    }
    this._kupplungVorher = kupplung;
    z.kickTimer = Math.max(0, z.kickTimer - dt);
    z.kickSperre = Math.max(0, z.kickSperre - dt);

    // Fehlzündung beim schnellen Gaswegnehmen bei hoher Drehzahl (für Backfire-VFX/Audio)
    if (this._gasVorher > 0.7 && gasEff < 0.15 && z.drehzahl > p.drehzahlMax * 0.55) {
      this.ereignisse.push({ art: 'fehlzuendung', staerke: z.drehzahl / p.drehzahlMax });
      if (p.turbo && z.ladedruck > 0.5) this.ereignisse.push({ art: 'abblasen', staerke: z.ladedruck });
    }
    this._gasVorher = gasEff;

    this._getriebe(e, dt, gasEff);
    this._lenkung(lenken, dt);
    this._turbo(dt, gasEff);

    // Unterschritte (bei sehr großen dt automatisch mehr, damit nichts explodiert)
    const n = Math.max(P.unterschritte, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) this._integrieren(h, gasEff, bremsEingabe, hb, gitter);

    this._drehzahl(dt, gasEff);
    this._sichern();
  }

  // ---------------------------------------------------------------------------

  _getriebe(e, dt, gasEff) {
    const z = this.z;
    const p = this.p;
    const n = p.gaenge.length;
    if (z.schaltTimer > 0) {
      z.schaltTimer -= dt;
      if (z.schaltTimer <= 0) {
        z.schaltTimer = 0;
        z.gang = z.zielGang;
      }
      return;
    }
    if (z.richtung < 0) return;
    // Schaltpunkte nach Fahrgeschwindigkeit (nicht nach Raddrehzahl) → im Drift bleibt der Gang drin
    const v = Math.hypot(z.vx, z.vy);
    const rpmBoden = (v / p.radRadius) * this._uebersetzung(z.gang) / ZWEI_PI_DURCH_60;
    if (this.assistenz.getriebe === 'manuell') {
      if (e.hoch && z.gang < n) this._schalten(z.gang + 1);
      else if (e.runter && z.gang > 1) {
        const rpmNeu = rpmBoden * p.gaenge[z.gang - 2] / p.gaenge[z.gang - 1];
        if (rpmNeu < p.drehzahlMax * 1.02) this._schalten(z.gang - 1, 0.6);
      }
      return;
    }
    if (rpmBoden > P.antrieb.schaltHoch * p.drehzahlMax && z.gang < n && gasEff > 0.05) {
      this._schalten(z.gang + 1);
    } else if (z.gang > 1) {
      const rpmUnten = rpmBoden * p.gaenge[z.gang - 2] / p.gaenge[z.gang - 1];
      if (rpmBoden < P.antrieb.schaltRunter * p.drehzahlMax && rpmUnten < 0.86 * p.drehzahlMax) {
        this._schalten(z.gang - 1, 0.6);
      }
    }
  }

  _schalten(ziel, zeitFaktor = 1) {
    const z = this.z;
    z.zielGang = ziel;
    z.schaltTimer = this.p.schaltzeit * zeitFaktor;
    this.ereignisse.push({ art: 'schalten', gang: ziel, hoch: ziel > z.gang });
  }

  _lenkung(lenken, dt) {
    const z = this.z;
    const p = this.p;
    const L = P.lenkung;
    const maxStand = p.lenkwinkelMax * GRAD;
    const maxSchnell = Math.min(maxStand, L.maxWinkelSchnellGrad * GRAD);
    const vxA = Math.abs(z.vx);
    const maxV = lerp(maxStand, maxSchnell, glattStufe(0, L.abfallTempo, Math.hypot(z.vx, z.vy)));
    const beta = vxA > 1 ? Math.atan2(z.vy, vxA) : 0;
    let ziel = -lenken * maxV;
    // Gegenlenken im Drift darf über die tempoabhängige Grenze hinausgehen
    if (Math.abs(beta) > 2 * GRAD && Math.sign(ziel) === Math.sign(beta)) {
      const grenze = Math.min(maxStand, Math.max(maxV, Math.abs(beta) + L.gegenlenkZusatzGrad * GRAD));
      ziel = -lenken * grenze;
    }
    // Gegenlenk-Assistenz: führt die Vorderräder teilweise in die Bewegungsrichtung
    let assistAktiv = false;
    const A = this.assistenz.gegenlenken || 0;
    if (A > 0 && z.vx > 3) {
      const w = glattStufe(P.assistenz.gegenlenkStartGrad * GRAD, P.assistenz.gegenlenkVollGrad * GRAD, Math.abs(beta));
      if (w > 0) {
        const vorneRichtung = Math.atan2(z.vy + this.lv * z.r, z.vx);
        const assistZiel = klemme(vorneRichtung, -maxStand, maxStand) - lenken * P.assistenz.gegenlenkSpielraumGrad * GRAD;
        ziel = lerp(ziel, assistZiel, A * w);
        assistAktiv = true;
      }
    }
    ziel = klemme(ziel, -maxStand, maxStand);
    const rate = Math.abs(lenken) > 0.05 || assistAktiv ? L.rate : L.rueckstellRate;
    z.delta = naehern(z.delta, ziel, rate * dt);
  }

  _turbo(dt, gasEff) {
    const z = this.z;
    const t = this.p.turbo;
    if (!t) { z.ladedruck = 0; return; }
    const genugDrehzahl = z.drehzahl > t.ansprechDrehzahl * this.p.drehzahlMax;
    const ziel = genugDrehzahl ? gasEff : 0;
    if (ziel > z.ladedruck) z.ladedruck = Math.min(ziel, z.ladedruck + dt / t.aufbauZeit);
    else z.ladedruck = Math.max(ziel, z.ladedruck - dt / t.abfallZeit);
  }

  /** Motordrehmoment (Nm) bei Drehzahl rpm inkl. Turbo, Begrenzer und Kupplungstritt. */
  _motorMoment(rpm, gasEff) {
    const z = this.z;
    const p = this.p;
    let turboMul = 1;
    if (p.turbo) turboMul = 1 - p.turbo.anteil + p.turbo.anteil * z.ladedruck;
    const u = klemme(rpm / p.drehzahlMax, 0.05, 1.05);
    let T = kurveWert(p.drehmomentKurve, u) * this.drehmomentSkala * turboMul * gasEff;
    if (z.begrenzer > 0) T = 0;
    if (z.kickTimer > 0) T *= P.antrieb.kupplungsKickFaktor;
    // Motorbremse beim Gaswegnehmen
    if (gasEff < 0.05 && rpm > p.leerlauf * 1.3) {
      T = -P.antrieb.motorBremse * this.drehmomentMax * klemme(rpm / p.drehzahlMax, 0.2, 1);
    }
    return T;
  }

  /**
   * Reifenkraft der Hinterachse bei Raddrehzahl omega (Ergebnis in this._fx/_fy/_sn).
   * sperre < 1 dämpft den wirksamen Längsschlupf (offenes Differenzial: das innere Rad dreht durch,
   * das äußere behält Seitenführung).
   */
  _reifenH(omega, vx, uLat, Fmax, sperre) {
    const R = this.p.radRadius;
    const sLon = omega * R - vx;
    const vRef = Math.max(Math.abs(vx), Math.abs(omega * R), P.reifen.bezugsTempoMin);
    const kappa = (sLon / vRef) * sperre;
    const tau = uLat / vRef;
    const kn = kappa / P.reifen.laengsSpitze;
    const tn = tau / this.tanSpitzeH;
    const sn = Math.hypot(kn, tn);
    this._sn = sn;
    if (sn < 1e-9) { this._fx = 0; this._fy = 0; return; }
    const F = Fmax * Math.sin(this.CH * Math.atan(this.B1 * sn));
    let dx = kn / sn, dy = tn / sn;
    // Bei großem Schlupf wirkt Gleitreibung entgegen der tatsächlichen Rutschrichtung
    const w = glattStufe(1, 3, sn);
    if (w > 0) {
      const s = Math.hypot(kappa, tau);
      if (s > 1e-9) {
        dx = lerp(dx, kappa / s, w);
        dy = lerp(dy, tau / s, w);
        const d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;
      }
    }
    this._fx = F * dx;
    this._fy = -F * dy;
  }

  _integrieren(h, gasEff, bremsEingabe, hb, gitter) {
    const z = this.z;
    const p = this.p;
    const R = P.reifen;
    const A = P.antrieb;
    const m = this.m;
    const g = P.g;
    const lv = this.lv, lh = this.lh;
    const vx = z.vx, vy = z.vy, r = z.r;
    const v = Math.hypot(vx, vy);
    const radR = p.radRadius;

    // --- Lastverlagerung (Längs: Beschleunigen → hinten, Bremsen → vorne; Quer: nach außen) ---
    const maxL = P.last.maxVerlagerung;
    const dFzL = klemme((m * z.axGl * p.schwerpunktHoehe) / this.L, -maxL * this.FzVStatisch, maxL * this.FzHStatisch);
    const FzV = this.FzVStatisch - dFzL;
    const FzH = this.FzHStatisch + dFzL;
    const dFzQ = Math.abs((m * z.ayGl * p.schwerpunktHoehe) / p.spurweite) * p.wankFaktor;
    const dQV = dFzQ * p.wankVorne;
    const dQH = dFzQ * (1 - p.wankVorne);
    const verlustV = 1 - R.seitlicheLastVerlust * Math.min(1, dQV / (FzV * 0.5)) ** 2;
    const verlustH = 1 - R.seitlicheLastVerlust * Math.min(1, dQH / (FzH * 0.5)) ** 2;
    const lastV = 1 - R.lastEmpfindlichkeit * (FzV / this.FzVStatisch - 1);
    const lastH = 1 - R.lastEmpfindlichkeit * (FzH / this.FzHStatisch - 1);
    const stabBonus = 1 + (p.stabilitaet - 1) * 0.05 * Math.min(1, v / 40);
    const FmaxV = R.mu * p.grip * lastV * verlustV * FzV;
    const FmaxH = R.mu * p.grip * lastH * verlustH * FzH * stabBonus;

    // --- Geschwindigkeiten an den Achsen ---
    const cd = Math.cos(z.delta), sd = Math.sin(z.delta);
    const vyV = vy + lv * r;
    const vyH = vy - lh * r;
    const uLonV = cd * vx + sd * vyV;
    const uLatV = -sd * vx + cd * vyV;
    const nT = R.niedrigTempo;
    const nenner = nT * (1 - Math.min(1, v / (nT * 4))) + 0.3;
    const alphaV = Math.atan2(uLatV, Math.max(Math.abs(uLonV), nenner));
    z.schlupfV = alphaV;
    z.schlupfH = Math.atan2(vyH, Math.max(Math.abs(vx), nenner));

    // --- Antrieb: Motor ↔ Hinterräder ---
    const ueb = this._uebersetzung(z.gang);
    const getrennt = z.schaltTimer > 0 || hb === 1; // Handbremse = Kupplung getreten
    z.kupplungGetrennt = getrennt;
    const anteilV = p.antrieb === 'allrad' ? p.allradVorneAnteil : 0;
    let momentRad = 0; // Antriebsmoment an den Hinterrädern (Nm)
    let FantriebV = 0;
    let traegheit = A.radTraegheit;
    if (!getrennt) {
      const rpmGekoppelt = Math.abs(z.omegaH * ueb) / ZWEI_PI_DURCH_60;
      const schleif = p.leerlauf + gasEff * (A.schleifDrehzahl * p.drehzahlMax - p.leerlauf);
      let rpmMotor = rpmGekoppelt;
      if (rpmGekoppelt < schleif && gasEff > 0.02) {
        rpmMotor = schleif; // Kupplung schleift beim Anfahren
      } else {
        traegheit += A.motorTraegheit * ueb * ueb;
      }
      if (rpmGekoppelt >= p.drehzahlMax && z.begrenzer <= 0 && gasEff > 0.1) {
        z.begrenzer = A.begrenzerSchnitt;
        this.ereignisse.push({ art: 'begrenzer' });
      }
      let T = this._motorMoment(rpmMotor, gasEff);
      if (gasEff < 0.05 && Math.abs(vx) < 2) T = 0;
      const gesamt = T * ueb * A.wirkungsgrad;
      if (z.richtung < 0 && -vx > A.rueckwaertsMaxTempo) {
        momentRad = 0;
      } else {
        const faktor = z.richtung < 0 ? A.rueckwaertsKraftAnteil : 1;
        momentRad = gesamt * (1 - anteilV) * faktor;
        FantriebV = (gesamt * anteilV * faktor) / radR;
      }
    }

    // --- Bremsmomente ---
    const Fb = bremsEingabe * p.bremskraft;
    const momentBremseH = Fb * (1 - p.bremsBalance) * radR + hb * p.handbremse * A.handbremsFaktor * FmaxH * radR;

    // Differenzialsperre: bei offener Sperre dreht das entlastete Innenrad → weniger wirksamer Schlupf
    const offen = Math.max(0.3, 1 - (2 * dQH) / Math.max(1, FzH));
    const sperre = lerp(offen, 1, p.sperre);

    // --- Implizite Lösung der Raddrehzahl: I·(ω'−ω)/h = M_an − Fx(ω')·R − M_br·sgn(ω') ---
    const omega0 = z.omegaH;
    const Ih = traegheit / h;
    const gFn = (w, sgn) => {
      this._reifenH(w, vx, vyH, FmaxH, sperre);
      return Ih * (w - omega0) - momentRad + this._fx * radR + momentBremseH * sgn;
    };
    let omegaNeu;
    const g0 = gFn(0, 0);
    if (Math.abs(g0) <= momentBremseH) {
      omegaNeu = 0; // blockiert (Bremse/Handbremse hält die Räder)
    } else {
      const positiv = g0 + momentBremseH < 0;
      const sgn = positiv ? 1 : -1;
      let lo = positiv ? 0 : Math.min(omega0, vx / radR, 0) - Math.abs(momentRad) / Ih - 10;
      let hi = positiv ? Math.max(omega0, vx / radR, 0) + Math.abs(momentRad) / Ih + 10 : 0;
      let x = klemme(omega0, lo, hi);
      for (let it = 0; it < 14; it++) {
        const gx = gFn(x, sgn);
        if (Math.abs(gx) < 1e-3) break;
        if (gx > 0) hi = x; else lo = x;
        const eps = 0.02;
        const ab = (gFn(x + eps, sgn) - gx) / eps;
        let xn = ab > 1e-9 ? x - gx / ab : (lo + hi) / 2;
        if (!(xn > lo && xn < hi)) xn = (lo + hi) / 2;
        if (Math.abs(xn - x) < 1e-5) { x = xn; break; }
        x = xn;
      }
      omegaNeu = x;
    }
    z.omegaH = omegaNeu;
    this._reifenH(omegaNeu, vx, vyH, FmaxH, sperre);
    let FxH = this._fx;
    let FyH = this._fy;
    z.schlupfNormH = this._sn;

    // --- Vorderachse: Seitenkraft + Bremse/Allrad über den Kamm'schen Kreis ---
    let FyV = -FmaxV * pacejka(alphaV, this.BV, this.CV);
    const mV = (m * lh) / this.L, mH = (m * lv) / this.L;
    const bremsV = -Math.sign(uLonV) * Math.min(Fb * p.bremsBalance, (mV * Math.abs(uLonV)) / h) * Math.min(1, Math.abs(uLonV) / 0.3);
    let FxV = FantriebV + bremsV;
    const bedarfV = Math.hypot(FxV, FyV);
    let gleitenV = 0;
    if (bedarfV > FmaxV && bedarfV > 1e-6) {
      const s = FmaxV / bedarfV;
      FxV *= s;
      FyV *= s;
      gleitenV = Math.min(1, (bedarfV / FmaxV - 1) * 1.5);
    }
    if (Math.abs(alphaV) > P.reifen.spitzeVorneGrad * GRAD * 1.6) gleitenV = Math.max(gleitenV, 0.5);

    // Kein Überschwingen bei kleiner Quergeschwindigkeit (verhindert Zittern im Stand)
    const grenzeV = (0.5 * mV * Math.abs(uLatV)) / h;
    const grenzeH = (0.5 * mH * Math.abs(vyH)) / h;
    if (Math.abs(FyV) > grenzeV) FyV = Math.sign(FyV) * grenzeV;
    if (Math.abs(FyH) > grenzeH) FyH = Math.sign(FyH) * grenzeH;

    // Rollwiderstand (nicht über Stillstand hinaus)
    const Froll = -Math.sign(vx) * Math.min(this.crr * m * g, (m * Math.abs(vx)) / h) * Math.min(1, Math.abs(vx) / 0.5);

    // --- Kräfte im Karosseriesystem ---
    const FxVk = FxV * cd - FyV * sd;
    const FyVk = FxV * sd + FyV * cd;
    const FxLuft = -this.cLuft * v * vx;
    const FyLuft = -this.cLuft * 1.5 * v * vy;
    const Fx = FxVk + FxH + FxLuft + Froll;
    const Fy = FyVk + FyH + FyLuft;
    let Mz = lv * FyVk - lh * FyH;

    // Gierdämpfung (Arcade-Stabilisierung, klein) + Zusatzdämpfung bei sehr großen Winkeln
    const S = P.stabilitaet;
    const winkel = v > 1 ? Math.abs(Math.atan2(vy, vx)) : 0;
    let daempfung = S.gierDaempfung * p.gierDaempfung * p.stabilitaet;
    if (winkel > S.driftDaempfungAbGrad * GRAD) daempfung += S.driftDaempfung;
    if (v < 1.5) daempfung += S.stillstandDaempfung * (1 - v / 1.5);
    Mz -= this.Iz * daempfung * r;

    // --- Integration (semi-implizites Euler-Verfahren) ---
    const ax = Fx / m;
    const ay = Fy / m;
    z.vx += (ax + r * vy) * h;
    z.vy += (ay - r * vx) * h;
    z.r += (Mz / this.Iz) * h;

    // Stillstand ohne Eingabe: sauber anhalten statt kriechen
    if (Math.hypot(z.vx, z.vy) < 0.12 && gasEff < 0.02) {
      z.vx *= 0.5;
      z.vy *= 0.5;
      z.r *= 0.5;
      if (Math.abs(z.omegaH) < 0.5) z.omegaH *= 0.5;
    }

    // Sicherheitsgrenzen
    z.r = klemme(z.r, -P.maxGierrate, P.maxGierrate);
    const vJetzt = Math.hypot(z.vx, z.vy);
    if (vJetzt > P.maxTempo) {
      z.vx *= P.maxTempo / vJetzt;
      z.vy *= P.maxTempo / vJetzt;
    }
    z.omegaH = klemme(z.omegaH, -P.maxTempo / radR, (P.maxTempo * 1.6) / radR);

    z.theta += z.r * h;
    const c = Math.cos(z.theta), s = Math.sin(z.theta);
    z.x += (z.vx * c - z.vy * s) * h;
    z.y += (z.vx * s + z.vy * c) * h;

    z.axGl = glaetten(z.axGl, ax, P.last.glaettung, h);
    z.ayGl = glaetten(z.ayGl, ay, P.last.glaettung, h);
    z.gleitenH = glattStufe(1.1, 2.6, this._sn);
    z.gleitenV = gleitenV;
    z.last = dFzL / (m * g);
    z.durchdrehen = Math.max(0, (z.omegaH * radR - Math.abs(z.vx)) / Math.max(3, Math.abs(z.vx)));

    // Räder: Drehwinkel für die Darstellung
    z.radGeschwV = uLonV / radR;
    z.radGeschwH = z.omegaH;
    z.radWinkelV = (z.radWinkelV + z.radGeschwV * h) % (Math.PI * 2);
    z.radWinkelH = (z.radWinkelH + z.radGeschwH * h) % (Math.PI * 2);

    if (gitter) this._kollision(gitter, h);
  }

  /** Wandkollision: Positionskorrektur + Impuls am Kontaktpunkt (mit Gierrate-Störung). */
  _kollision(gitter, h) {
    const z = this.z;
    const K = P.kollision;
    const { r: rad, versaetze } = this.kreise;
    let kontakt = false;
    for (let iter = 0; iter < 3; iter++) {
      let gefunden = false;
      for (const o of versaetze) {
        const c = Math.cos(z.theta), s = Math.sin(z.theta);
        const cx = z.x + c * o, cy = z.y + s * o;
        const k = gitter.kreisKontakt(cx, cy, rad);
        if (!k) continue;
        gefunden = true;
        kontakt = true;
        // Sauber aus der Wand schieben
        z.x += k.nx * (k.tiefe + 0.002);
        z.y += k.ny * (k.tiefe + 0.002);
        // Impuls
        let wvx = z.vx * c - z.vy * s;
        let wvy = z.vx * s + z.vy * c;
        const rpx = cx - k.nx * rad - z.x;
        const rpy = cy - k.ny * rad - z.y;
        const vpx = wvx - z.r * rpy;
        const vpy = wvy + z.r * rpx;
        const vn = vpx * k.nx + vpy * k.ny;
        if (vn < 0) {
          const rn = rpx * k.ny - rpy * k.nx;
          const j = (-(1 + K.wandRestitution) * vn) / (1 / this.m + (rn * rn) / this.Iz);
          wvx += (j * k.nx) / this.m;
          wvy += (j * k.ny) / this.m;
          z.r += ((rn * j) / this.Iz) * K.gierStoerung;
          // Reibung entlang der Wand
          const tx = -k.ny, ty = k.nx;
          const vt = vpx * tx + vpy * ty;
          const rt = rpx * ty - rpy * tx;
          let jt = -vt / (1 / this.m + (rt * rt) / this.Iz);
          jt = klemme(jt, -K.wandReibung * j, K.wandReibung * j);
          wvx += (jt * tx) / this.m;
          wvy += (jt * ty) / this.m;
          z.r += ((rt * jt) / this.Iz) * K.gierStoerung;
          // Frontaler Aufprall kostet zusätzlich Tempo
          const frontal = Math.max(0, -(c * k.nx + s * k.ny));
          if (frontal > 0.5) {
            const verlust = K.wandSpeedVerlustFrontal * (frontal - 0.5) * 2 * Math.min(1, -vn / 15);
            wvx *= 1 - verlust;
            wvy *= 1 - verlust;
          }
          const staerke = -vn;
          if (staerke > 0.6 || !z.wandKontakt) {
            this.ereignisse.push({ art: 'wand', staerke, x: k.px, y: k.py, nx: k.nx, ny: k.ny, objekt: k.art });
          }
          z.vx = wvx * c + wvy * s;
          z.vy = -wvx * s + wvy * c;
          z.r = klemme(z.r, -P.maxGierrate, P.maxGierrate);
          // Räder passen sich grob an (kein Durchdrehen durch den Stoß)
          if (z.omegaH * this.p.radRadius > Math.abs(z.vx) * 3 + 10) z.omegaH *= 0.8;
        }
      }
      if (!gefunden) break;
    }
    if (kontakt) z.wandKontaktZeit += h;
    else z.wandKontaktZeit = 0;
    z.wandKontakt = kontakt;
  }

  /** Motordrehzahl für Anzeige, Klang und Turbo. */
  _drehzahl(dt, gasEff) {
    const z = this.z;
    const p = this.p;
    const A = P.antrieb;
    if (z.begrenzer > 0) z.begrenzer = Math.max(0, z.begrenzer - dt);
    if (z.kupplungGetrennt) {
      // Ausgekuppelt (Schalten, Handbremse): Motor dreht frei nach Gas
      const frei = z.schaltTimer > 0 ? z.drehzahl * 0.9 : p.leerlauf + gasEff * (p.drehzahlMax * 1.0 - p.leerlauf);
      z.drehzahl = glaetten(z.drehzahl, frei, A.drehzahlTraegheit, dt);
    } else {
      const gekoppelt = Math.abs(z.omegaH * this._uebersetzung(z.gang)) / ZWEI_PI_DURCH_60;
      const schleif = p.leerlauf + gasEff * (A.schleifDrehzahl * p.drehzahlMax - p.leerlauf);
      z.drehzahl = Math.max(gekoppelt, gasEff > 0.02 ? schleif : p.leerlauf);
    }
    if (z.kickTimer > 0) z.drehzahl = Math.max(z.drehzahl, p.drehzahlMax * 0.92);
    z.drehzahl = klemme(z.drehzahl, p.leerlauf * 0.9, p.drehzahlMax * 1.01);
  }

  /** NaN-Schutz: bei ungültigen Werten auf den letzten gültigen Zustand zurück. */
  _sichern() {
    const z = this.z;
    const ok = Number.isFinite(z.x) && Number.isFinite(z.y) && Number.isFinite(z.theta) &&
      Number.isFinite(z.vx) && Number.isFinite(z.vy) && Number.isFinite(z.r) &&
      Number.isFinite(z.drehzahl) && Number.isFinite(z.delta) && Number.isFinite(z.omegaH);
    if (ok) {
      // Gierwinkel im Wertebereich halten (große Zahlen verlieren Genauigkeit)
      if (z.theta > Math.PI * 4 || z.theta < -Math.PI * 4) {
        const k = Math.round(z.theta / (2 * Math.PI)) * 2 * Math.PI;
        z.theta -= k;
        this.vorher.theta -= k;
      }
      return;
    }
    const v = this.vorher;
    this.setzen(Number.isFinite(v.x) ? v.x : 0, Number.isFinite(v.y) ? v.y : 0, Number.isFinite(v.theta) ? v.theta : 0, 0);
    this.ereignisse.push({ art: 'notfall' });
  }

  /** Kompakter Zustand für Netzwerk, Wertung und Wiederholungen. */
  momentaufnahme() {
    const z = this.z;
    return { x: z.x, y: z.y, theta: z.theta, vx: z.vx, vy: z.vy, r: z.r };
  }
}

/**
 * Weiche Auto-Auto-Kollision (Tandem): kein harter Rückstoß, kein Festkleben, keine Rotation.
 * @param {Fahrzeug} a
 * @param {Fahrzeug} b
 * @param {{nurA?: boolean}} [o] nurA: nur Auto a wird bewegt (Online: jeder Client schiebt nur sein eigenes Auto)
 * @returns {boolean} Kontakt
 */
export function autoKontakt(a, b, { nurA = false } = {}) {
  const K = P.kollision;
  const za = a.z, zb = b.z;
  const dxm = zb.x - za.x, dym = zb.y - za.y;
  const grob = (a.p.abmessungen.laenge + b.p.abmessungen.laenge) / 2 + 0.5;
  if (dxm * dxm + dym * dym > grob * grob) return false;
  const ca = Math.cos(za.theta), sa = Math.sin(za.theta);
  const cb = Math.cos(zb.theta), sb = Math.sin(zb.theta);
  let px = 0, py = 0, kontakt = false;
  for (const oa of a.kreise.versaetze) {
    const ax = za.x + ca * oa, ay = za.y + sa * oa;
    for (const ob of b.kreise.versaetze) {
      const bx = zb.x + cb * ob, by = zb.y + sb * ob;
      const dx = ax - bx, dy = ay - by;
      const d = Math.hypot(dx, dy);
      const ueberlappung = a.kreise.r + b.kreise.r - d;
      if (ueberlappung > -K.autoKontaktAbstand) kontakt = true;
      if (ueberlappung > 0 && d > 1e-6) {
        px += (dx / d) * ueberlappung;
        py += (dy / d) * ueberlappung;
      }
    }
  }
  const laenge = Math.hypot(px, py);
  if (laenge > 0) {
    const nx = px / laenge, ny = py / laenge;
    const anteilA = nurA ? 1 : b.m / (a.m + b.m);
    const verschiebung = Math.min(laenge, 0.6) * K.autoWeichheit;
    za.x += nx * verschiebung * anteilA;
    za.y += ny * verschiebung * anteilA;
    if (!nurA) {
      zb.x -= nx * verschiebung * (1 - anteilA);
      zb.y -= ny * verschiebung * (1 - anteilA);
    }
    // Annäherungsgeschwindigkeit sanft abbauen (ohne Drehung)
    const va = a.weltGeschwindigkeit, vb = b.weltGeschwindigkeit;
    const vRel = (va.x - vb.x) * nx + (va.y - vb.y) * ny;
    if (vRel < 0) {
      const dv = -vRel * K.autoGeschwAngleich;
      const neuA = { x: va.x + nx * dv * anteilA, y: va.y + ny * dv * anteilA };
      za.vx = neuA.x * ca + neuA.y * sa;
      za.vy = -neuA.x * sa + neuA.y * ca;
      if (!nurA) {
        const neuB = { x: vb.x - nx * dv * (1 - anteilA), y: vb.y - ny * dv * (1 - anteilA) };
        zb.vx = neuB.x * cb + neuB.y * sb;
        zb.vy = -neuB.x * sb + neuB.y * cb;
      }
    }
  }
  return kontakt;
}
