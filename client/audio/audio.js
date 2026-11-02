// Prozeduraler Klang mit WebAudio: Motoren, Reifen, Turbo, Knall und Kontakt, UI-Töne, Menümusik. Keine Audiodateien.
// Startet erst nach der ersten Nutzereingabe (Browser-Regel, besonders iOS). Ein Kompressor am Master verhindert
// Übersteuern, die Zahl gleichzeitiger Einzeltöne ist begrenzt.
import { motorKlang, reifenKlang, turboKlang, abstandsPegel } from '../../shared/klang.js';
import { MenueMusik } from './musik.js';

const MAX_STIMMEN = 10;
const GLAETTUNG = 0.04; // s für Parameterwechsel
const MOTOR_OSZILLATOREN = 4;
const REIFEN_VERSTAERKUNG = 5; // Das schmale Bandpassfilter lässt nur einen kleinen Teil des Rauschens durch

/** Ein Motorklang: Obertöne als Oszillatoren, Rauheit als moduliertes Rauschen, dazu Reifen und Turbo. */
class Fahrgeraeusch {
  constructor(ctx, ziel, rauschen, klang, { einfach = false } = {}) {
    this.ctx = ctx;
    this.klang = klang;
    this.ausgang = ctx.createGain();
    this.ausgang.gain.value = 0;
    this.ausgang.connect(ziel);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.9;
    this.mischer = ctx.createGain();
    this.mischer.gain.value = 0;
    this.mischer.connect(this.filter);
    this.filter.connect(this.ausgang);
    // Der Grundton ist ein Sägezahn, die Obertöne weichere Dreiecke
    const n = einfach ? 2 : Math.min(MOTOR_OSZILLATOREN, klang.obertoene.length);
    this.oszis = [];
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sawtooth' : 'triangle';
      o.detune.value = (i % 2 ? 1 : -1) * (2 + klang.rauheit * 10);
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(this.mischer);
      o.start();
      this.oszis.push({ o, g });
    }
    // Rauheit: Rauschen im Bereich des Motortons
    this.rauQuelle = ctx.createBufferSource();
    this.rauQuelle.buffer = rauschen;
    this.rauQuelle.loop = true;
    this.rauFilter = ctx.createBiquadFilter();
    this.rauFilter.type = 'bandpass';
    this.rauFilter.Q.value = 1.1;
    this.rauPegel = ctx.createGain();
    this.rauPegel.gain.value = 0;
    this.rauQuelle.connect(this.rauFilter);
    this.rauFilter.connect(this.rauPegel);
    this.rauPegel.connect(this.filter);
    this.rauQuelle.start();
    // Reifen
    this.reifenQuelle = ctx.createBufferSource();
    this.reifenQuelle.buffer = rauschen;
    this.reifenQuelle.loop = true;
    this.reifenFilter = ctx.createBiquadFilter();
    this.reifenFilter.type = 'bandpass';
    this.reifenFilter.Q.value = 7;
    this.reifenPegel = ctx.createGain();
    this.reifenPegel.gain.value = 0;
    // Zweiter, höherer Formant: macht aus dem Rauschen ein Quietschen
    this.reifenFilter2 = ctx.createBiquadFilter();
    this.reifenFilter2.type = 'bandpass';
    this.reifenFilter2.Q.value = 11;
    this.reifenQuelle.connect(this.reifenFilter);
    this.reifenQuelle.connect(this.reifenFilter2);
    this.reifenFilter.connect(this.reifenPegel);
    this.reifenFilter2.connect(this.reifenPegel);
    this.reifenPegel.connect(this.ausgang);
    this.reifenQuelle.start();
    // Turbo
    this.turbo = null;
    if (!einfach) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(this.ausgang);
      o.start();
      this.turbo = { o, g };
    }
  }

  /** Ein Bild: Parameter aus dem Zustand des Autos übernehmen. */
  aktualisieren(f, last, gesamtPegel) {
    const t = this.ctx.currentTime;
    const z = f.z;
    const m = motorKlang(this.klang, z.drehzahl ?? f.p.leerlauf, f.p.drehzahlMax, last);
    this.mischer.gain.setTargetAtTime(m.gesamt, t, GLAETTUNG);
    this.filter.frequency.setTargetAtTime(m.filter, t, GLAETTUNG);
    for (let i = 0; i < this.oszis.length; i++) {
      const { o, g } = this.oszis[i];
      o.frequency.setTargetAtTime(m.frequenzen[i], t, 0.018);
      g.gain.setTargetAtTime(m.pegel[i] * (i === 0 ? 0.5 : 0.28), t, GLAETTUNG);
    }
    this.rauFilter.frequency.setTargetAtTime(Math.min(4200, m.grundFrequenz * 3), t, GLAETTUNG);
    this.rauPegel.gain.setTargetAtTime(m.rauheit * 0.3, t, GLAETTUNG);
    const r = reifenKlang(z.schlupfNormH || 0, z.durchdrehen || 0, f.tempo);
    this.reifenPegel.gain.setTargetAtTime(r.pegel * REIFEN_VERSTAERKUNG, t, 0.05);
    this.reifenFilter.frequency.setTargetAtTime(r.frequenz, t, 0.06);
    this.reifenFilter2.frequency.setTargetAtTime(r.frequenz * 1.52, t, 0.06);
    if (this.turbo) {
      const tb = f.p.turbo ? turboKlang(z.ladedruck || 0, (z.drehzahl || 0) / f.p.drehzahlMax) : { pegel: 0, frequenz: 2000 };
      this.turbo.g.gain.setTargetAtTime(tb.pegel, t, 0.06);
      this.turbo.o.frequency.setTargetAtTime(tb.frequenz, t, 0.06);
    }
    this.ausgang.gain.setTargetAtTime(gesamtPegel, t, 0.08);
  }

  stumm() {
    this.ausgang.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  freigeben() {
    const t = this.ctx.currentTime;
    this.ausgang.gain.setTargetAtTime(0, t, 0.05);
    const alle = [...this.oszis.map((x) => x.o), this.rauQuelle, this.reifenQuelle];
    if (this.turbo) alle.push(this.turbo.o);
    for (const q of alle) {
      try { q.stop(t + 0.3); } catch { /* schon gestoppt */ }
    }
    setTimeout(() => this.ausgang.disconnect(), 500);
  }
}

export class AudioSystem {
  constructor(spiel) {
    this.spiel = spiel;
    this.ctx = null;
    this.werte = { master: 0.8, effekte: 0.9, musik: 0.45, musikAn: true };
    this.fahrzeuge = new Map();
    this.stimmen = 0;
    this.pausiert = false;
    this.musikGewuenscht = false;
    this._freigabe = () => this._starten();
    for (const art of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(art, this._freigabe, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => this._sichtbarkeit());
    // Knöpfe klingen überall gleich, ohne dass jeder Bildschirm daran denken muss
    window.addEventListener('click', (e) => {
      if (e.target?.closest?.('button, .knopf, [role="tab"]')) this.ton('klick');
    }, { capture: true, passive: true });
  }

  /** Erste Nutzereingabe: Kontext anlegen oder fortsetzen. */
  _starten() {
    if (!this.ctx) {
      const K = window.AudioContext || window.webkitAudioContext;
      if (!K) return;
      try {
        this.ctx = new K({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this._aufbauen();
    }
    if (this.ctx.state !== 'running' && !document.hidden) this.ctx.resume().catch(() => {});
    if (this.musikGewuenscht) this.musik?.starten();
  }

  _aufbauen() {
    const c = this.ctx;
    this.kompressor = c.createDynamicsCompressor();
    this.kompressor.threshold.value = -14;
    this.kompressor.ratio.value = 6;
    this.kompressor.attack.value = 0.004;
    this.kompressor.release.value = 0.2;
    this.masterGain = c.createGain();
    this.effekteGain = c.createGain();
    this.motorGain = c.createGain();
    this.musikGain = c.createGain();
    this.analyse = c.createAnalyser();
    this.analyse.fftSize = 2048;
    this.effekteGain.connect(this.masterGain);
    this.motorGain.connect(this.effekteGain);
    this.musikGain.connect(this.masterGain);
    this.masterGain.connect(this.kompressor);
    this.kompressor.connect(this.analyse);
    this.analyse.connect(c.destination);
    // Zwei Sekunden Rauschen als gemeinsame Quelle
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.rauschen = b;
    this.musik = new MenueMusik(c, this.musikGain);
    this.einstellungen(this.spiel.daten.einstellungen.audio);
  }

  _sichtbarkeit() {
    if (!this.ctx) return;
    // Auch im pausierten Rennen fortsetzen: Motor und Reifen sind dann stumm, die Knöpfe sollen aber klingen.
    // Gamepad-Spieler lösen sonst nie das Fortsetzen über eine Zeiger- oder Tastatureingabe aus.
    if (document.hidden) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  /** Lautstärken aus den Einstellungen. */
  einstellungen(a) {
    this.werte = a;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(a.master, t, 0.03);
    this.effekteGain.gain.setTargetAtTime(a.effekte, t, 0.03);
    this.musikGain.gain.setTargetAtTime(a.musikAn ? a.musik * 0.6 : 0, t, 0.05);
    if (a.musikAn && this.musikGewuenscht) this.musik.starten();
    else this.musik.stoppen();
  }

  menueMusik(an) {
    this.musikGewuenscht = an;
    if (!this.ctx) return;
    if (an && this.werte.musikAn) this.musik.starten();
    else this.musik.stoppen();
  }

  pausieren(an) {
    this.pausiert = an;
    if (an) for (const g of this.fahrzeuge.values()) g.stumm();
  }

  // -------------------------------------------------------------------------
  // Fahrgeräusche

  /**
   * Pro Bild aus dem Rennen.
   * @param {Array} autos Einträge des Rennens
   * @param {object} spieler Eintrag des Spielers
   * @param {number} last Gas des Spielers
   */
  fahrt(autos, spieler, last) {
    if (!this.ctx || this.ctx.state !== 'running' || this.pausiert) return;
    const sp = spieler.darstellung;
    for (const a of autos) {
      const ich = a === spieler;
      let g = this.fahrzeuge.get(a);
      if (!g) {
        g = new Fahrgeraeusch(this.ctx, this.motorGain, this.rauschen, a.fahrzeug.p.klang, { einfach: !ich });
        this.fahrzeuge.set(a, g);
      }
      const d = a.darstellung;
      const abstand = ich || d.x === undefined ? 0 : Math.hypot(d.x - sp.x, d.y - sp.y);
      const gesamt = ich ? 1 : 0.45 * abstandsPegel(abstand);
      const gas = ich ? last : a.fahrzeug.letzteGas ?? 0.6;
      g.aktualisieren(a.fahrzeug, gas, gesamt);
    }
  }

  rennenEnde() {
    for (const g of this.fahrzeuge.values()) g.freigeben();
    this.fahrzeuge.clear();
    this.pausiert = false;
  }

  fahrzeugEreignis(a, ev) {
    if (!this.ctx) return;
    const ich = a === this.spiel.modus?.spieler;
    const pegel = ich ? 1 : 0.35;
    switch (ev.art) {
      case 'wand':
        if (ev.staerke > 1) this._knall({ pegel: pegel * Math.min(1, 0.25 + ev.staerke / 12), tief: 80, hoch: 900, dauer: 0.22 });
        break;
      case 'fehlzuendung': {
        const stark = a.modell?.look?.backfire ?? 0;
        // Auch der Serienauspuff blubbert leise, der Backfire-Auspuff knallt
        this._knall({ pegel: pegel * (0.14 + stark * 0.5) * ev.staerke, tief: 140, hoch: 2600, dauer: 0.09 });
        break;
      }
      case 'abblasen':
        this._abblasen(pegel * Math.min(1, ev.staerke));
        break;
      case 'schalten':
        if (ich) this._kurz({ typ: 'square', f: 90, ende: 60, pegel: 0.05, dauer: 0.05 });
        break;
      default:
    }
  }

  wertungEreignis(e) {
    if (!this.ctx) return;
    if (e.art === 'kontakt') this._knall({ pegel: 0.5, tief: 110, hoch: 700, dauer: 0.16 });
    else if (e.art === 'zoneEnde' && e.punkte > 0) this.ton('zone');
    else if (e.art === 'fluessig') this.ton('bonus');
  }

  // -------------------------------------------------------------------------
  // Einzeltöne

  /** Benannte Töne der Oberfläche und des Spielablaufs. */
  ton(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const k = (o) => this._kurz(o);
    switch (name) {
      case 'klick': return k({ typ: 'triangle', f: 680, ende: 420, pegel: 0.1, dauer: 0.05 });
      case 'countdown': return k({ typ: 'square', f: 660, ende: 660, pegel: 0.13, dauer: 0.16 });
      case 'los': return k({ typ: 'square', f: 1040, ende: 1040, pegel: 0.16, dauer: 0.4 });
      case 'runde':
        k({ typ: 'triangle', f: 700, ende: 700, pegel: 0.13, dauer: 0.1 });
        return k({ typ: 'triangle', f: 940, ende: 940, pegel: 0.13, dauer: 0.16, verzug: 0.1 });
      case 'zone': return k({ typ: 'sine', f: 880, ende: 1180, pegel: 0.08, dauer: 0.14 });
      case 'bonus': return k({ typ: 'sine', f: 1180, ende: 1560, pegel: 0.1, dauer: 0.16 });
      case 'kasse':
        k({ typ: 'triangle', f: 1046, ende: 1046, pegel: 0.14, dauer: 0.09 });
        k({ typ: 'triangle', f: 1318, ende: 1318, pegel: 0.14, dauer: 0.09, verzug: 0.08 });
        return k({ typ: 'triangle', f: 1568, ende: 1568, pegel: 0.15, dauer: 0.22, verzug: 0.16 });
      case 'sieg':
        for (const [i, f] of [523, 659, 784, 1046].entries()) k({ typ: 'triangle', f, ende: f, pegel: 0.15, dauer: 0.24, verzug: i * 0.11 });
        return undefined;
      case 'niederlage':
        for (const [i, f] of [392, 330, 262].entries()) k({ typ: 'triangle', f, ende: f * 0.97, pegel: 0.12, dauer: 0.28, verzug: i * 0.15 });
        return undefined;
      default:
        return undefined;
    }
  }

  _stimmeFrei() {
    return this.ctx && this.stimmen < MAX_STIMMEN;
  }

  _stimme(dauer) {
    this.stimmen++;
    setTimeout(() => { this.stimmen = Math.max(0, this.stimmen - 1); }, (dauer + 0.05) * 1000);
  }

  _kurz({ typ, f, ende, pegel, dauer, verzug = 0 }) {
    if (!this._stimmeFrei()) return;
    const c = this.ctx;
    const t = c.currentTime + verzug;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = typ;
    o.frequency.setValueAtTime(f, t);
    if (ende !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, ende), t + dauer);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pegel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(g);
    g.connect(this.effekteGain);
    o.start(t);
    o.stop(t + dauer + 0.02);
    this._stimme(verzug + dauer);
  }

  /** Dumpfer Schlag mit Rauschen: Wand, Auto-Kontakt, Backfire. */
  _knall({ pegel, tief, hoch, dauer }) {
    if (!this._stimmeFrei() || pegel < 0.01) return;
    const c = this.ctx;
    const t = c.currentTime;
    const q = c.createBufferSource();
    q.buffer = this.rauschen;
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(hoch, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(tief, 60), t + dauer);
    const g = c.createGain();
    g.gain.setValueAtTime(pegel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q.connect(fl);
    fl.connect(g);
    g.connect(this.effekteGain);
    q.start(t, Math.random());
    q.stop(t + dauer + 0.02);
    const o = c.createOscillator();
    const og = c.createGain();
    o.frequency.setValueAtTime(tief * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, tief * 0.6), t + dauer);
    og.gain.setValueAtTime(pegel * 0.8, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(og);
    og.connect(this.effekteGain);
    o.start(t);
    o.stop(t + dauer + 0.02);
    this._stimme(dauer);
  }

  /** Turbo-Ablassen: gefiltertes Rauschen mit fallender Frequenz. */
  _abblasen(pegel) {
    if (!this._stimmeFrei() || pegel < 0.02) return;
    const c = this.ctx;
    const t = c.currentTime;
    const dauer = 0.32;
    const q = c.createBufferSource();
    q.buffer = this.rauschen;
    const fl = c.createBiquadFilter();
    fl.type = 'bandpass';
    fl.Q.value = 3;
    fl.frequency.setValueAtTime(3400, t);
    fl.frequency.exponentialRampToValueAtTime(900, t + dauer);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * pegel, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    q.connect(fl);
    fl.connect(g);
    g.connect(this.effekteGain);
    q.start(t, Math.random());
    q.stop(t + dauer + 0.02);
    this._stimme(dauer);
  }

  /** Aktueller Spitzenpegel am Ausgang (für den Klangtest). */
  pegel() {
    if (!this.analyse) return { spitze: 0, rms: 0 };
    const d = new Float32Array(this.analyse.fftSize);
    this.analyse.getFloatTimeDomainData(d);
    let spitze = 0, summe = 0;
    for (const x of d) {
      spitze = Math.max(spitze, Math.abs(x));
      summe += x * x;
    }
    return { spitze, rms: Math.sqrt(summe / d.length) };
  }

  /** Spektraler Schwerpunkt in Hz (für den Klangtest: Jedes Auto klingt anders). */
  schwerpunkt() {
    if (!this.analyse) return 0;
    const d = new Float32Array(this.analyse.frequencyBinCount);
    this.analyse.getFloatFrequencyData(d);
    const hz = this.ctx.sampleRate / this.analyse.fftSize;
    let s = 0, g = 0;
    for (let i = 1; i < d.length; i++) {
      const a = 10 ** (d[i] / 20);
      s += a * i * hz;
      g += a;
    }
    return g > 0 ? s / g : 0;
  }
}
