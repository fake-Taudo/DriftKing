// Einfache prozedurale Menümusik: gleitende Flächen, Bass und leiser Puls über einer Moll-Akkordfolge.
// Wird in kleinen Abschnitten im Voraus geplant, damit Hänger im Hauptthread nicht zu hören sind.

const TEMPO = 92; // Schläge pro Minute
const SCHLAG = 60 / TEMPO;
const VORLAUF = 0.6; // s
const TAKT_ALLE = 150; // ms
// Akkordfolge in Halbtönen über dem Grundton A (a-Moll, F-Dur, C-Dur, G-Dur)
const AKKORDE = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
const GRUND = 110; // Hz
const hz = (halbton, oktave = 0) => GRUND * 2 ** (halbton / 12 + oktave);

export class MenueMusik {
  constructor(ctx, ziel) {
    this.ctx = ctx;
    this.ziel = ctx.createGain();
    this.ziel.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1500;
    this.filter.connect(this.ziel);
    this.ziel.connect(ziel);
    this.laeuft = false;
    this._takt = null;
    this.naechster = 0;
    this.schritt = 0;
  }

  starten() {
    if (this.laeuft) return;
    this.laeuft = true;
    this.ziel.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.8);
    this.naechster = this.ctx.currentTime + 0.1;
    this._takt = setInterval(() => this._planen(), TAKT_ALLE);
  }

  stoppen() {
    if (!this.laeuft) return;
    this.laeuft = false;
    this.ziel.gain.setTargetAtTime(0, this.ctx.currentTime, 0.35);
    clearInterval(this._takt);
    this._takt = null;
  }

  _planen() {
    if (this.ctx.state !== 'running') {
      this.naechster = this.ctx.currentTime + 0.1;
      return;
    }
    while (this.naechster < this.ctx.currentTime + VORLAUF) {
      this._schrittSpielen(this.naechster, this.schritt);
      this.naechster += SCHLAG / 2;
      this.schritt = (this.schritt + 1) % 64;
    }
  }

  _schrittSpielen(t, s) {
    const akkord = AKKORDE[Math.floor(s / 16) % AKKORDE.length];
    if (s % 16 === 0) {
      for (const h of akkord) this._ton(hz(h, 1), t, SCHLAG * 8, 0.03, 'triangle', 1.2);
      this._ton(hz(akkord[0], 2) * 1.5, t, SCHLAG * 8, 0.012, 'sine', 1.6);
    }
    if (s % 4 === 0) this._ton(hz(akkord[0], -1), t, SCHLAG * 1.6, 0.085, 'sine', 0.02);
    if (s % 8 === 6) this._ton(hz(akkord[2], -1), t, SCHLAG * 0.8, 0.05, 'sine', 0.02);
    // Leiser Arpeggio-Puls
    if (s % 2 === 1) this._ton(hz(akkord[(s >> 1) % 3], 2), t, SCHLAG * 0.45, 0.018, 'triangle', 0.01);
  }

  _ton(f, t, dauer, pegel, typ, anschlag) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = typ;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pegel, t + Math.max(0.005, anschlag));
    g.gain.linearRampToValueAtTime(0.0001, t + dauer);
    o.connect(g);
    g.connect(this.filter);
    o.start(t);
    o.stop(t + dauer + 0.02);
  }
}
