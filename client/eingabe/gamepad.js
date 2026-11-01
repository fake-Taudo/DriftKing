// Gamepad-Eingabe (Gamepad API, Standard-Mapping).
// Linker Stick = Lenken, rechter Trigger = Gas, linker Trigger = Bremse, Tasten frei belegbar.

const TRIGGER_LINKS = 6;
const TRIGGER_RECHTS = 7;

export class GamepadEingabe {
  constructor() {
    this.belegung = {};
    this.totzone = 0.12;
    this.vorher = new Map(); // Tastenzustände des letzten Frames (für Flanken)
    this.ereignisse = [];
    this.zuletztBenutzt = 0;
    this.verbunden = false;
    this.name = '';
    this.werteAktuell = { lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0 };
    window.addEventListener('gamepadconnected', (e) => { this.verbunden = true; this.name = e.gamepad.id; });
    window.addEventListener('gamepaddisconnected', () => { this.verbunden = false; });
  }

  setzeBelegung(belegung, totzone) {
    this.belegung = belegung;
    if (typeof totzone === 'number') this.totzone = totzone;
  }

  _pad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  /** Pro Frame aufrufen. */
  aktualisieren() {
    const p = this._pad();
    const w = this.werteAktuell;
    if (!p) {
      w.lenken = w.gas = w.bremse = w.handbremse = w.kupplung = 0;
      return w;
    }
    this.verbunden = true;
    const tz = this.totzone;
    let x = p.axes[0] || 0;
    x = Math.abs(x) < tz ? 0 : Math.sign(x) * (Math.abs(x) - tz) / (1 - tz);
    const knopf = (i) => (p.buttons[i] ? p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0) : 0);
    let gas = knopf(TRIGGER_RECHTS);
    let bremse = knopf(TRIGGER_LINKS);
    gas = gas < tz * 0.5 ? 0 : gas;
    bremse = bremse < tz * 0.5 ? 0 : bremse;
    w.lenken = Math.max(-1, Math.min(1, x));
    w.gas = gas;
    w.bremse = bremse;
    w.handbremse = this.belegung.handbremse !== undefined && knopf(this.belegung.handbremse) > 0.5 ? 1 : 0;
    w.kupplung = this.belegung.kupplung !== undefined && knopf(this.belegung.kupplung) > 0.5 ? 1 : 0;

    // Flanken für Einmal-Aktionen
    for (const [aktion, index] of Object.entries(this.belegung)) {
      const jetzt = knopf(index) > 0.5;
      const alt = this.vorher.get(index) || false;
      if (jetzt && !alt) this.ereignisse.push(aktion);
      this.vorher.set(index, jetzt);
    }
    // Zusätzlich: Steuerkreuz für Menüs
    const steuerkreuz = { 12: 'menueHoch', 13: 'menueRunter', 14: 'menueLinks', 15: 'menueRechts', 0: 'menueOk', 1: 'menueZurueck' };
    for (const [index, aktion] of Object.entries(steuerkreuz)) {
      const i = Number(index);
      const jetzt = knopf(i) > 0.5;
      const schl = 'm' + i;
      const alt = this.vorher.get(schl) || false;
      if (jetzt && !alt) this.ereignisse.push(aktion);
      this.vorher.set(schl, jetzt);
    }

    if (Math.abs(w.lenken) > 0.2 || w.gas > 0.2 || w.bremse > 0.2 || w.handbremse || p.buttons.some((b) => b && b.pressed)) {
      this.zuletztBenutzt = performance.now();
    }
    return w;
  }

  nimmEreignisse() {
    const e = this.ereignisse;
    this.ereignisse = [];
    return e;
  }

  /** Kurzes Rumpeln (wo unterstützt). */
  rumpeln(staerke = 0.5, dauerMs = 120) {
    const p = this._pad();
    const akt = p && p.vibrationActuator;
    if (akt && akt.playEffect) {
      akt.playEffect('dual-rumble', { duration: dauerMs, strongMagnitude: staerke, weakMagnitude: staerke * 0.6 }).catch(() => {});
    }
  }
}
