// Ablauf eines Online-Duells auf dem Server, ohne Netzwerk: Countdown, Rollentausch, Rundenzähler, Wertung mit
// 20 Ticks/s aus den gemeldeten Zuständen, Plausibilitätsprüfung, AFK, Gleichstand, Ergebnis und Belohnung.
// Die Uhr wird von außen übergeben (tick), damit sich ganze Duelle mit simulierter Zeit testen lassen.
import { BattleAblauf } from '../shared/battle.js';
import { Wertung, verfolgerEndpunkte } from '../shared/wertung.js';
import { Rundenzaehler } from '../shared/rundenLogik.js';
import { autoDaten } from '../shared/autos.js';
import { WERTUNG } from '../shared/wertungsParameter.js';
import { EINGABE_FLAGS, resetZaehler, LUECKE_MS, AFK_MS, VORLAUF_MS, ZUSTAND_MS, ONLINE_SIEG, ONLINE_NIEDERLAGE, MIN_FAHRZEIT_S, MIN_FAHRZEIT_AUFGABE_S, zustandEntpacken } from '../shared/netzwerkSchema.js';

const TICK_MS = 1000 / WERTUNG.tickRate;
const anderer = (s) => (s === 'A' ? 'B' : 'A');
const r1 = (x) => Math.round(x * 10) / 10;

const AUSLAUF_MS = 2200; // nach dem Durchgang: freier Auslauf
const ZWISCHENSTAND_MS = 6000; // danach: Zwischenstand, bis der nächste Durchgang angekündigt wird
const START_SPAETESTENS_MS = 15000; // Führer überfährt die Linie nicht: Wertung beginnt trotzdem
const MAX_VERSTOESSE = 40; // je Durchgang, dann gilt das Duell als verloren
const MAX_BESCHLEUNIGUNG = 45; // m/s²
const RAND_TOLERANZ = 40; // m neben der Fahrbahn

export class Match {
  /**
   * @param {object} o
   * @param {object} o.S Laufzeit-Strecke
   * @param {'schnell'|'bo3'} o.format
   * @param {number|string} o.seed
   * @param {{A:{autoId:string}, B:{autoId:string}}} o.spieler
   * @param {(seite:'A'|'B', nachricht:object)=>void} o.senden
   * @param {(ergebnis:object)=>void} [o.beiEnde]
   * @param {number} o.jetzt Startzeit in ms
   * @param {number} [o.afkMs]
   */
  constructor({ S, format, seed, spieler, senden, beiEnde, jetzt, afkMs = AFK_MS }) {
    this.S = S;
    this.afkMs = afkMs;
    this.senden = senden;
    this.beiEnde = beiEnde;
    this.spieler = spieler;
    this.ablauf = new BattleAblauf({ format, seed });
    this.phase = 'angekuendigt';
    this.fahrzeit = 0;
    this.durchgaenge = 0;
    this.ende = null;
    this.letzterTick = jetzt;
    this.aufschluesselungen = { A: [], B: [] };
    this.vMax = {};
    this.abm = {};
    for (const s of ['A', 'B']) {
      const a = autoDaten(spieler[s].autoId);
      this.abm[s] = a.abmessungen;
      this.vMax[s] = (a.soll.hoechstKmh * 1.7) / 3.6;
    }
    this._durchgangAnkuendigen(jetzt);
  }

  // -------------------------------------------------------------------------
  // Durchgang

  _durchgangAnkuendigen(jetzt) {
    const d = this.ablauf.naechsterDurchgang();
    this.d = d;
    this.startZeit = jetzt + VORLAUF_MS;
    this.phase = 'countdown';
    this.laeuft = false;
    this.zustaende = { A: null, B: null };
    this.empfangZeit = { A: 0, B: 0 };
    this.eingabeZeit = { A: this.startZeit, B: this.startZeit };
    this.letzteFlags = { A: 0, B: 0 };
    this.verstoesse = { A: 0, B: 0 };
    this.resetMerker = { A: false, B: false };
    const f = d.fuehrer, v = d.verfolger;
    this.wF = new Wertung(this.S, 'fuehrer', { abmessungen: this.abm[f], gegnerAbmessungen: this.abm[v] });
    this.wV = new Wertung(this.S, 'verfolger', { abmessungen: this.abm[v], gegnerAbmessungen: this.abm[f] });
    this.runden = new Rundenzaehler(this.S, this.S.start.fuehrer);
    this.tickZaehler = 0;
    this.punkteZeit = 0;
    this.fahrtZeit = 0;
    for (const s of ['A', 'B']) this.senden(s, this._ankuendigung(s));
  }

  _ankuendigung(s) {
    const d = this.d;
    return {
      t: 'startCountdown',
      dgNr: this.durchgaenge + 1,
      startZeit: this.startZeit,
      laufNr: d.laufNr,
      laufIndex: d.laufIndex,
      durchgangNr: d.durchgangNr,
      wiederholung: d.wiederholung,
      rolle: s === d.fuehrer ? 'fuehrer' : 'verfolger',
      siegeA: this.ablauf.siegeA,
      siegeB: this.ablauf.siegeB
    };
  }

  /** Nach einer Wiederverbindung: den aktuellen Stand erneut senden. Der Client verwirft, was er schon kennt (dgNr). */
  nachsenden(s) {
    if (this.ende) return;
    if (this.phase === 'countdown' || this.phase === 'fahrt') {
      this.senden(s, this._ankuendigung(s));
      if (this.laeuft) this.senden(s, { t: 'wertungStart', zeit: this.wertungStart, limit: this.S.zeitLimit });
    } else if (this.letztesEnde) {
      this.senden(s, this.letztesEnde[s]);
    }
  }

  // -------------------------------------------------------------------------
  // Eingehende Zustände

  /**
   * Nimmt einen Fahrzustand an, prüft ihn und leitet ihn an den Gegner weiter.
   * @param {'A'|'B'} s Seite
   * @param {number[]} d Zahlenfeld (netzwerkSchema)
   * @param {number} jetzt ms
   * @returns {boolean} false, wenn der Zustand verworfen wurde
   */
  zustandEmpfangen(s, d, jetzt) {
    if (this.ende || this.phase === 'zwischenstand') return false;
    const z = zustandEntpacken(d);
    const alt = this.zustaende[s];
    if (alt && z.seq <= alt.seq) return false; // verspätet oder doppelt
    const reset = !!alt && resetZaehler(z.flags) !== resetZaehler(alt.flags);
    if (!this._plausibel(s, z, alt, reset)) {
      if (++this.verstoesse[s] > MAX_VERSTOESSE) this.aufgabe(s, 'regelverstoss', jetzt);
      return false;
    }
    if (reset && this.laeuft) this.resetMerker[s] = true;
    if (z.flags & EINGABE_FLAGS) this.eingabeZeit[s] = jetzt;
    this.zustaende[s] = z;
    this.empfangZeit[s] = jetzt;
    this.senden(anderer(s), { t: 'gegner', d, s: jetzt });
    return true;
  }

  /**
   * Plausibilität: Höchsttempo je Auto, Beschleunigung, Teleport, Streckenbegrenzung.
   * Nach dem Zurücksetzen entfallen Beschleunigung und Teleport: Das Auto steht an neuer Stelle und hat wieder Tempo.
   */
  _plausibel(s, z, alt, reset) {
    const v = Math.hypot(z.vx, z.vy);
    if (v > this.vMax[s]) return false;
    const p = this.S.projektion(z.x, z.y);
    if (Math.abs(p.quer) > this.S.proben[p.index].breite / 2 + RAND_TOLERANZ) return false;
    if (!alt || reset) return true;
    const dt = Math.max(1, z.seq - alt.seq) * (ZUSTAND_MS / 1000);
    const vAlt = Math.hypot(alt.vx, alt.vy);
    if (v - vAlt > MAX_BESCHLEUNIGUNG * dt + 3) return false;
    if (Math.hypot(z.x - alt.x, z.y - alt.y) > Math.max(v, vAlt) * dt * 1.6 + 4) return false;
    return true;
  }

  // -------------------------------------------------------------------------
  // Zeit

  /** Vom Server regelmäßig aufgerufen (mindestens alle 50 ms). */
  tick(jetzt) {
    if (this.ende) return;
    if (this.phase === 'countdown' && jetzt >= this.startZeit) {
      this.phase = 'fahrt';
      this.fahrtZeit = jetzt;
      this.letzterTick = jetzt;
    }
    if (this.phase === 'fahrt') {
      while (this.phase === 'fahrt' && jetzt - this.letzterTick >= TICK_MS) {
        this.letzterTick += TICK_MS;
        this._wertungsTick(this.letzterTick);
      }
      if (this.phase === 'fahrt') this._afkPruefen(jetzt);
    }
    if (this.phase === 'auslauf' && jetzt >= this.phasenEnde) {
      this.phase = 'zwischenstand';
      if (this.letztes.battleEnde) {
        this._beenden(this.phasenEnde);
        return;
      }
      this.phasenEnde = jetzt + ZWISCHENSTAND_MS;
    }
    if (this.phase === 'zwischenstand' && jetzt >= this.phasenEnde) this._durchgangAnkuendigen(jetzt);
  }

  _afkPruefen(jetzt) {
    for (const s of ['A', 'B']) {
      if (jetzt - this.eingabeZeit[s] > this.afkMs) {
        this.aufgabe(s, 'afk', jetzt);
        return;
      }
    }
  }

  _wertungsTick(zeit) {
    const f = this.d.fuehrer, v = this.d.verfolger;
    const zF = this.zustaende[f];
    const zV = this.zustaende[v];
    const fehlt = !zF || !zV;
    const luecke = fehlt || zeit - this.empfangZeit[f] > LUECKE_MS || zeit - this.empfangZeit[v] > LUECKE_MS;
    // Rundenzähler des Führers (Start und Ziel steuern den Durchgang)
    if (zF) {
      const ev = this.runden.aktualisieren(zF.x, zF.y, zeit / 1000, TICK_MS / 1000);
      for (const e of ev) {
        if (e.art === 'start' && !this.laeuft) this._wertungStarten(zeit);
        else if (e.art === 'runde' && this.laeuft) {
          this._durchgangEnde('ziel', zeit);
          return;
        }
      }
    }
    if (!this.laeuft) {
      if (zeit - this.fahrtZeit > START_SPAETESTENS_MS) this._wertungStarten(zeit);
      return;
    }
    if ((zeit - this.wertungStart) / 1000 > this.S.zeitLimit) {
      this._durchgangEnde('zeit', zeit);
      return;
    }
    if (luecke) return; // Verbindungsprobleme benachteiligen niemanden: Tick entfällt für beide
    const t = (zeit - this.wertungStart) / 1000;
    this.fahrzeit += TICK_MS / 1000;
    const a = { ...zF, zurueckgesetzt: this.resetMerker[f] };
    const b = { ...zV, zurueckgesetzt: this.resetMerker[v] };
    this.resetMerker[f] = this.resetMerker[v] = false;
    const evF = this.wF.tick(a, b, t);
    this._ereignisseSenden(f, evF);
    const evV = this.wV.tick(b, a, t);
    this._ereignisseSenden(v, evV);
    if (++this.tickZaehler % 5 === 0) this._punkteSenden(zeit);
  }

  _wertungStarten(zeit) {
    this.laeuft = true;
    this.wertungStart = zeit;
    this.wF.zuruecksetzen(0);
    this.wV.zuruecksetzen(0);
    for (const s of ['A', 'B']) this.senden(s, { t: 'wertungStart', zeit, limit: this.S.zeitLimit });
  }

  _ereignisseSenden(s, ereignisse) {
    for (const e of ereignisse) {
      if (e.art === 'comboVerloren' || e.art === 'zoneStart') continue;
      const kopie = { art: e.art };
      if (e.abzug !== undefined) kopie.abzug = e.abzug;
      if (e.bonus !== undefined) kopie.bonus = e.bonus;
      if (e.punkte !== undefined) kopie.punkte = r1(e.punkte);
      this.senden(s, { t: 'ereignis', e: kopie });
    }
  }

  /** Punktestand für das HUD (4-mal pro Sekunde). */
  _punkteSenden(zeit) {
    const f = this.d.fuehrer;
    const pF = this.wF.punkte;
    const pV = verfolgerEndpunkte(this.wV.punkte, pF);
    for (const s of ['A', 'B']) {
      const w = s === f ? this.wF : this.wV;
      this.senden(s, {
        t: 'punkte',
        du: r1(s === f ? pF : pV),
        gegner: r1(s === f ? pV : pF),
        combo: r1(w.combo),
        anteil: Math.round(w.comboAnteil * 100) / 100,
        rest: r1(this.S.zeitLimit - (zeit - this.wertungStart) / 1000)
      });
    }
  }

  _durchgangEnde(grund, zeit) {
    if (!this.laeuft) this._wertungStarten(zeit);
    this.phase = 'auslauf';
    this.laeuft = false;
    this.durchgaenge++;
    const f = this.d.fuehrer, v = this.d.verfolger;
    const aF = this.wF.aufschluesselung();
    const aV = this.wV.aufschluesselung();
    const fuehrerPunkte = aF.punkte;
    const verfolgerNorm = aV.punkte;
    const verfolgerPunkte = verfolgerEndpunkte(verfolgerNorm, fuehrerPunkte);
    const ergebnis = this.ablauf.durchgangEintragen({ fuehrerPunkte, verfolgerNorm });
    this.letztes = ergebnis;
    this.aufschluesselungen[f].push(aF);
    this.aufschluesselungen[v].push({ ...aV, endpunkte: verfolgerPunkte });
    this.phasenEnde = zeit + AUSLAUF_MS;
    this.letztesEnde = {};
    for (const s of ['A', 'B']) {
      this.letztesEnde[s] = {
        t: 'durchgangEnde',
        dgNr: this.durchgaenge,
        grund,
        rolleDu: s === f ? 'fuehrer' : 'verfolger',
        fuehrerPunkte: r1(fuehrerPunkte),
        verfolgerPunkte: r1(verfolgerPunkte),
        wertung: s === f ? aF : { ...aV, endpunkte: verfolgerPunkte },
        laufEnde: ergebnis.laufEnde,
        lauf: ergebnis.lauf ? { a: ergebnis.lauf.ergebnis.a, b: ergebnis.lauf.ergebnis.b, sieger: ergebnis.lauf.ergebnis.sieger, gleichstand: ergebnis.lauf.ergebnis.gleichstand } : null,
        battleEnde: ergebnis.battleEnde,
        siegeA: this.ablauf.siegeA,
        siegeB: this.ablauf.siegeB,
        weiterIn: AUSLAUF_MS + (ergebnis.battleEnde ? 0 : ZWISCHENSTAND_MS)
      };
      this.senden(s, this.letztesEnde[s]);
    }
  }

  // -------------------------------------------------------------------------
  // Ende

  /** Aufgabe, Abbruch, AFK oder Regelverstoß: der andere gewinnt. */
  aufgabe(seite, grund, jetzt) {
    if (this.ende) return;
    this.ablauf.aufgeben(seite);
    this._beenden(jetzt, grund);
  }

  /** Belohnung nach den Regeln aus Abschnitt 9 und 10.3. */
  _belohnung(seite, grund) {
    const sieg = this.ablauf.sieger === seite;
    if (!grund) {
      if (this.fahrzeit < MIN_FAHRZEIT_S || this.durchgaenge < 2) return 0;
      return sieg ? ONLINE_SIEG : ONLINE_NIEDERLAGE;
    }
    // Abbruch: nur der Gewinner bekommt die halbe Belohnung, und auch das erst nach etwas echter Fahrzeit
    return sieg && this.fahrzeit >= MIN_FAHRZEIT_AUFGABE_S ? ONLINE_SIEG / 2 : 0;
  }

  _beenden(jetzt, grund = null) {
    this.phase = 'ende';
    const zus = this.ablauf.zusammenfassung();
    this.ende = {
      regulaer: !grund,
      grund,
      sieger: this.ablauf.sieger,
      zusammenfassung: zus,
      fahrzeit: Math.round(this.fahrzeit),
      belohnung: { A: this._belohnung('A', grund), B: this._belohnung('B', grund) }
    };
    this.beiEnde?.(this.ende, jetzt);
  }
}
