// Jury-Logik (Tandem-Wertung). Arbeitet nur auf Fahrzeug-Zuständen mit festen 20 Ticks pro Sekunde,
// damit Client und Server dieselben Punkte berechnen. Wand- und Autokontakt werden aus den Zuständen
// erkannt (Kollisionskreise gegen Wände bzw. gegeneinander).
//
// Führer pro Tick (nur ab 40 km/h und 10° Driftwinkel):
//   basis · f_winkel · f_tempo · f_zone · f_linie · combo
// Verfolger pro Tick (nach 3 s Aufschließphase):
//   basis · f_abstand · f_gleichwinkel · f_linie · f_drift · combo
// Normierung: 100 · Roh / Referenz (Legende-Idealfahrt) + Boni − Abzüge, begrenzt auf 0–100.
// Verfolger-Endwertung: VerfolgerNorm · (0,5 + 0,5 · Führerpunkte / 100).
import { WERTUNG as W } from './wertungsParameter.js';
import { autoKreise } from './physik/kollision.js';
import { klemme } from './mathe.js';

const GRAD = 180 / Math.PI;

/** Trapez über dem Driftwinkel (Grad). */
export function fWinkel(grad) {
  const a = Math.abs(grad);
  const w = W.winkel;
  if (a <= w.null || a >= w.nullBei) return 0;
  if (a < w.vollAb) return (a - w.null) / (w.vollAb - w.null);
  if (a <= w.vollBis) return 1;
  return (w.nullBei - a) / (w.nullBei - w.vollBis);
}

/** Tempo-Faktor: v / Referenz, begrenzt auf 0..1,2. */
export function fTempo(v, referenz) {
  if (!(referenz > 0)) return 0;
  return klemme(v / referenz, 0, W.tempoMax);
}

/** Linien-Faktor: 0,4 … 1,0 je nach Abstand zur Ideallinie. */
export function fLinie(abstand) {
  return 1 - klemme(Math.abs(abstand) / W.linienToleranz, 0, 1) * W.linienAnteil;
}

/** Abstands-Faktor des Verfolgers (Mittelpunktsabstand in m). */
export function fAbstand(d) {
  const a = W.abstand;
  if (d >= a.nullBei) return 0;
  if (d > a.sweetMax) return 1 - (d - a.sweetMax) / (a.nullBei - a.sweetMax);
  if (d >= a.nahGrenze) return 1;
  if (d >= a.nahBei) return a.nahWert + (1 - a.nahWert) * ((d - a.nahBei) / (a.nahGrenze - a.nahBei));
  return a.nahWert * Math.max(0, d / a.nahBei);
}

/** Gleichwinkel-Faktor: 1 − |Winkeldifferenz| / 30°. */
export function fGleichwinkel(differenzGrad) {
  return klemme(1 - Math.abs(differenzGrad) / W.gleichwinkelSpanne, 0, 1);
}

/** Bewertung des Abstands für die Anzeige (Farbe + Symbol). */
export function abstandsBewertung(d) {
  const f = fAbstand(d);
  if (f >= 0.85) return 'gut';
  if (f >= 0.45) return 'mittel';
  return 'schlecht';
}

/** Verfolger-Endpunkte aus normierter Verfolger-Wertung und Führerpunkten des Gegners. */
export function verfolgerEndpunkte(verfolgerNorm, fuehrerPunkte) {
  return klemme(verfolgerNorm * (W.verfolgerSockel + (1 - W.verfolgerSockel) * klemme(fuehrerPunkte, 0, 100) / 100), 0, 100);
}

/** Signierter Driftwinkel in Grad (+ = Nase links der Bewegungsrichtung). */
export function driftWinkelGrad(z) {
  const v = Math.hypot(z.vx, z.vy);
  if (v < 1) return 0;
  return -Math.atan2(z.vy, z.vx) * GRAD;
}

export class Wertung {
  /**
   * @param {object} S Laufzeit-Strecke
   * @param {'fuehrer'|'verfolger'|'einzel'} rolle ('einzel' = Führer-Wertung ohne Gegner, z. B. Zeitangriff)
   * @param {{abmessungen: object, gegnerAbmessungen?: object, referenz?: number, resetStrafe?: boolean}} o
   */
  constructor(S, rolle, { abmessungen, gegnerAbmessungen = null, referenz = null, resetStrafe = true } = {}) {
    this.S = S;
    this.rolle = rolle;
    this.kreise = autoKreise(abmessungen);
    this.gegnerKreise = gegnerAbmessungen ? autoKreise(gegnerAbmessungen) : this.kreise;
    const refRolle = rolle === 'verfolger' ? 'verfolger' : 'fuehrer';
    this.referenz = referenz ?? S.referenzPunkte?.[refRolle] ?? schaetzeReferenz(S, refRolle);
    this.resetStrafe = resetStrafe;
    this.dt = 1 / W.tickRate;
    this.zuruecksetzen();
  }

  zuruecksetzen(startZeit = 0) {
    this.startZeit = startZeit;
    this.roh = 0;
    this.boni = 0;
    this.abzuege = 0;
    this.combo = W.comboMin;
    this.comboMax = W.comboMin;
    this.gnade = 0;
    this.sperreBis = -1;
    this.hinweis = undefined;
    this.inWand = false;
    this.wandFrei = 0;
    this.autoKontaktBis = -1;
    this.spinAktiv = false;
    this.letzteRichtung = 0;
    this.letzteDriftZeit = -10;
    this.driftSeit = 0; // Dauer des laufenden Drifts in eine Richtung
    this.driftSpitze = 0; // größter Winkel dieses Drifts
    this.vorherDauer = 0;
    this.vorherSpitze = 0;
    this.letzterBonus = -10;
    this.minTempoLuecke = Infinity;
    this.ersteZone = this.rolle === 'verfolger';
    // Stetiger Fortschritt entlang der Strecke (m): Punkte nur auf neuem Boden (kein Kreisen/Zurückfahren)
    this.fortschritt = 0;
    this.maxFortschritt = 0;
    this._letztesS = undefined;
    this.zone = -1;
    this.zonenPunkteStart = 0;
    this.statistik = { ticks: 0, gueltig: 0, winkel: 0, tempo: 0, linie: 0, abstand: 0, gleichwinkel: 0, comboSumme: 0, wand: 0, kontakte: 0, resets: 0, spins: 0, fluessig: 0, besterWinkel: 0, laengsterDrift: 0, driftDauer: 0 };
    this.ereignisse = [];
  }

  /** Live-Punktzahl (0–100, ohne Verfolger-Faktor). */
  get punkte() {
    return klemme((100 * this.roh) / this.referenz + this.boni - this.abzuege, 0, 100);
  }

  get comboAnteil() {
    return (this.combo - W.comboMin) / (W.comboMax - W.comboMin);
  }

  _kontaktWand(z) {
    const g = this.S.gitter;
    const c = Math.cos(z.theta), s = Math.sin(z.theta);
    const r = this.kreise.r + W.wandToleranz;
    for (const o of this.kreise.versaetze) {
      if (g.kreisKontakt(z.x + c * o, z.y + s * o, r)) return true;
    }
    return false;
  }

  _kontaktAuto(z, g) {
    const ca = Math.cos(z.theta), sa = Math.sin(z.theta);
    const cb = Math.cos(g.theta), sb = Math.sin(g.theta);
    const grenze = this.kreise.r + this.gegnerKreise.r + 0.05;
    if ((z.x - g.x) ** 2 + (z.y - g.y) ** 2 > 64) return false;
    for (const oa of this.kreise.versaetze) {
      for (const ob of this.gegnerKreise.versaetze) {
        const dx = z.x + ca * oa - (g.x + cb * ob);
        const dy = z.y + sa * oa - (g.y + sb * ob);
        if (dx * dx + dy * dy < grenze * grenze) return true;
      }
    }
    return false;
  }

  /**
   * Ein Wertungs-Tick.
   * @param {{x,y,theta,vx,vy, zurueckgesetzt?:boolean}} z eigener Zustand
   * @param {{x,y,theta,vx,vy}|null} g Zustand des Gegners (Verfolger: Führer)
   * @param {number} zeit Sekunden seit Start des Durchgangs
   * @returns {Array<object>} Ereignisse für die Anzeige
   */
  tick(z, g, zeit) {
    const ev = this.ereignisse;
    ev.length = 0;
    const st = this.statistik;
    st.ticks++;
    const S = this.S;
    const p = S.projektion(z.x, z.y, this.hinweis);
    this.hinweis = p.index;
    const pp = S.proben[p.index];
    const sJetzt = p.s + (z.x - pp.x) * pp.tx + (z.y - pp.y) * pp.ty;
    let anDerFront = true;
    if (this._letztesS !== undefined) {
      let d = sJetzt - this._letztesS;
      if (d > S.laenge / 2) d -= S.laenge;
      if (d < -S.laenge / 2) d += S.laenge;
      if (Math.abs(d) < 40) this.fortschritt += d; // Sprünge (Zurücksetzen) ignorieren
      anDerFront = this.fortschritt > this.maxFortschritt + 1e-3;
    }
    this._letztesS = sJetzt;
    this.maxFortschritt = Math.max(this.maxFortschritt, this.fortschritt);
    const zi = S.zoneVon[p.index];
    const zone = zi >= 0 ? S.zonen[zi] : null;
    const v = Math.hypot(z.vx, z.vy);
    const winkel = driftWinkelGrad(z);
    const aWinkel = Math.abs(winkel);

    // Zurücksetzen (großer Abzug im Battle)
    if (z.zurueckgesetzt) {
      st.resets++;
      if (this.resetStrafe) this.abzuege += W.abzugZuruecksetzen;
      this._comboReset();
      ev.push({ art: 'zuruecksetzen', abzug: this.resetStrafe ? W.abzugZuruecksetzen : 0 });
    }

    // Wandkontakt: einmal pro Berührung (erneut erst nach kurzer Trennung)
    const wand = this._kontaktWand(z);
    if (wand && !this.inWand) {
      st.wand++;
      this.abzuege += W.abzugWand;
      this.sperreBis = zeit + W.wandSperre;
      this._comboReset();
      ev.push({ art: 'wand', abzug: W.abzugWand });
    }
    if (wand) { this.inWand = true; this.wandFrei = 0; } else {
      this.wandFrei += this.dt;
      if (this.wandFrei >= 0.3) this.inWand = false;
    }

    // Autokontakt (kleiner Abzug, mit kurzer Sperre gegen Mehrfachzählung)
    if (g && zeit >= this.autoKontaktBis && this._kontaktAuto(z, g)) {
      st.kontakte++;
      this.abzuege += W.abzugAutoKontakt;
      this.autoKontaktBis = zeit + W.autoKontaktSperre;
      ev.push({ art: 'kontakt', abzug: W.abzugAutoKontakt });
    }

    // Dreher: Winkel über 100° oder Stillstand in einer Zone
    const spin = aWinkel > W.spinWinkel || (zone && v < W.stillstandTempo && zeit > 2);
    if (spin && !this.spinAktiv) {
      st.spins++;
      this._comboReset();
      ev.push({ art: 'spin' });
    }
    this.spinAktiv = spin;

    // Zonenwechsel (für Popups und Start der Führer-Wertung)
    if (zi !== this.zone) {
      if (this.zone >= 0) ev.push({ art: 'zoneEnde', zone: this.zone, punkte: this.punkte - this.zonenPunkteStart });
      if (zi >= 0) {
        this.ersteZone = true;
        this.zonenPunkteStart = this.punkte;
        ev.push({ art: 'zoneStart', zone: zi, name: zone.name });
      }
      this.zone = zi;
    }

    // Linie
    const iv = S.ideal.versatz[p.index];
    const fL = fLinie(p.quer - iv);
    const gesperrt = zeit < this.sperreBis || !anDerFront;
    const minTempo = (this.rolle === 'verfolger' ? W.minTempoVerfolgerKmh : W.minTempoKmh) / 3.6;
    const driftet = aWinkel >= W.minWinkel && aWinkel <= W.spinWinkel && v >= minTempo;

    // Combo: wächst bei sauberem Driften, fällt nach kurzer Pause zurück
    if (driftet && !gesperrt) {
      this.combo = Math.min(W.comboMax, this.combo + W.comboProSekunde * this.dt);
      this.gnade = 0;
      st.driftDauer += this.dt;
      st.laengsterDrift = Math.max(st.laengsterDrift, st.driftDauer);
      st.besterWinkel = Math.max(st.besterWinkel, aWinkel);
    } else {
      this.gnade += this.dt;
      if (!driftet) st.driftDauer = 0;
      if (this.gnade > W.comboGnadenzeit && this.combo > W.comboMin) {
        this.combo = W.comboMin;
        ev.push({ art: 'comboVerloren' });
      }
    }
    this.comboMax = Math.max(this.comboMax, this.combo);

    // Flüssigkeit: schneller Wechsel zwischen gegenläufigen Drifts ohne Tempoverlust
    const refTempo = zone ? zone.referenzTempo : S.ideal.tempo[p.index];
    if (driftet) {
      const richtung = Math.sign(winkel);
      if (richtung !== this.letzteRichtung) {
        // Richtungswechsel: abgeschlossener Drift wird zum „vorherigen“
        this.vorherDauer = this.driftSeit;
        this.vorherSpitze = this.driftSpitze;
        this.driftSeit = 0;
        this.driftSpitze = 0;
        if (this.letzteRichtung && zeit - this.letzteDriftZeit < W.fluessigMaxZeit &&
          this.minTempoLuecke >= W.fluessigMinTempoAnteil * refTempo && !gesperrt &&
          this.vorherDauer >= W.fluessigMinDauer && this.vorherSpitze >= W.fluessigMinWinkel &&
          zeit - this.letzterBonus >= W.fluessigAbstand) {
          this.boni += W.fluessigBonus;
          this.letzterBonus = zeit;
          st.fluessig++;
          ev.push({ art: 'fluessig', bonus: W.fluessigBonus });
        }
      }
      this.driftSeit += this.dt;
      this.driftSpitze = Math.max(this.driftSpitze, aWinkel);
      this.letzteRichtung = richtung;
      this.letzteDriftZeit = zeit;
      this.minTempoLuecke = Infinity;
    } else {
      this.minTempoLuecke = Math.min(this.minTempoLuecke, v);
    }

    // Punkte
    let rohTick = 0;
    if (!gesperrt) {
      if (this.rolle !== 'verfolger') {
        if (driftet && this.ersteZone) {
          const fW = fWinkel(aWinkel);
          const fT = fTempo(v, refTempo);
          const fZ = zone ? W.zoneInnen : W.zoneAussen;
          rohTick = W.basis * fW * fT * fZ * fL * this.combo;
          if (rohTick > 0) {
            st.gueltig++;
            st.winkel += fW; st.tempo += Math.min(1, fT); st.linie += fL; st.comboSumme += this.combo;
          }
        }
      } else if (g && zeit - this.startZeit >= W.aufschliessZeit && v >= minTempo) {
        const d = Math.hypot(z.x - g.x, z.y - g.y);
        const fA = fAbstand(d);
        const fG = fGleichwinkel(winkel - driftWinkelGrad(g));
        const fD = aWinkel >= W.minWinkel ? 1 : W.verfolgerOhneDrift;
        rohTick = W.basis * fA * fG * fL * fD * this.combo;
        if (rohTick > 0) {
          st.gueltig++;
          st.abstand += fA; st.gleichwinkel += fG; st.linie += fL; st.winkel += fD; st.comboSumme += this.combo;
        }
      }
    }
    this.roh += rohTick;
    this.rohTick = rohTick;
    return ev;
  }

  _comboReset() {
    if (this.combo > W.comboMin) this.ereignisse.push({ art: 'comboVerloren' });
    this.combo = W.comboMin;
    this.gnade = 0;
  }

  /** Aufschlüsselung für den Ergebnisbildschirm (Anteile 0–100 %). */
  aufschluesselung() {
    const st = this.statistik;
    const n = Math.max(1, st.gueltig);
    const anteil = (x) => Math.round((100 * x) / n);
    return {
      punkte: this.punkte,
      roh: this.roh,
      winkel: anteil(st.winkel),
      tempo: anteil(st.tempo),
      linie: anteil(st.linie),
      abstand: this.rolle === 'verfolger' ? anteil(st.abstand) : null,
      gleichwinkel: this.rolle === 'verfolger' ? anteil(st.gleichwinkel) : null,
      combo: st.gueltig ? st.comboSumme / st.gueltig : 1,
      comboMax: this.comboMax,
      abzuege: this.abzuege,
      boni: this.boni,
      wand: st.wand,
      kontakte: st.kontakte,
      resets: st.resets,
      spins: st.spins,
      fluessig: st.fluessig,
      besterWinkel: st.besterWinkel,
      laengsterDrift: st.laengsterDrift
    };
  }
}

/**
 * Rückfall-Schätzung der Referenzpunktzahl, falls die Strecke (noch) keine simulierte hat:
 * Ideal-Drift durch alle Zonen (f_winkel = 1, f_tempo = 1, f_linie = 1) mit wachsender Combo.
 */
export function schaetzeReferenz(S, rolle) {
  let roh = 0, combo = 1;
  const ds = S.ds;
  for (let i = 0; i < S.anzahl; i++) {
    const v = Math.max(5, S.ideal.tempo[i]);
    const dt = ds / v;
    const ticks = dt * W.tickRate;
    const inZone = S.zoneVon[i] >= 0;
    if (inZone) combo = Math.min(W.comboMax, combo + W.comboProSekunde * dt);
    roh += ticks * (inZone ? 1 : W.zoneAussen * 0.5) * combo;
  }
  return rolle === 'verfolger' ? roh * 0.9 : roh;
}
