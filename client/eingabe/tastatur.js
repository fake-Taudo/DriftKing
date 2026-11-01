// Tastatur-Eingabe mit frei belegbaren Tasten (KeyboardEvent.code).

export class Tastatur {
  constructor() {
    this.gedrueckt = new Set();
    this.belegung = {};
    this.ereignisse = [];
    this.aktiv = true;
    this.zuletztBenutzt = 0;
    this._runter = (e) => this._taste(e, true);
    this._hoch = (e) => this._taste(e, false);
    this._blur = () => this.gedrueckt.clear();
    window.addEventListener('keydown', this._runter);
    window.addEventListener('keyup', this._hoch);
    window.addEventListener('blur', this._blur);
  }

  setzeBelegung(belegung) {
    this.belegung = belegung;
  }

  _istSpielTaste(code) {
    for (const codes of Object.values(this.belegung)) if (codes.includes(code)) return true;
    return false;
  }

  _taste(e, runter) {
    const ziel = e.target;
    if (ziel instanceof HTMLInputElement || ziel instanceof HTMLTextAreaElement || ziel instanceof HTMLSelectElement) return;
    const code = e.code;
    if (runter) {
      if (!e.repeat) {
        for (const [aktion, codes] of Object.entries(this.belegung)) {
          if (codes.includes(code)) this.ereignisse.push(aktion);
        }
      }
      this.gedrueckt.add(code);
      this.zuletztBenutzt = performance.now();
    } else {
      this.gedrueckt.delete(code);
    }
    // Pfeiltasten/Leertaste sollen die Seite nicht scrollen, solange kein Menüknopf fokussiert ist
    if (this.aktiv && this._istSpielTaste(code) && !(ziel instanceof HTMLButtonElement && (code === 'Space' || code === 'Enter'))) {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
    }
  }

  halten(aktion) {
    const codes = this.belegung[aktion];
    if (!codes) return false;
    for (const c of codes) if (this.gedrueckt.has(c)) return true;
    return false;
  }

  /** Liefert analoge Werte (Tastatur: 0/1). */
  werte() {
    const links = this.halten('links') ? 1 : 0;
    const rechts = this.halten('rechts') ? 1 : 0;
    return {
      lenken: rechts - links,
      gas: this.halten('gas') ? 1 : 0,
      bremse: this.halten('bremse') ? 1 : 0,
      handbremse: this.halten('handbremse') ? 1 : 0,
      kupplung: this.halten('kupplung') ? 1 : 0
    };
  }

  nimmEreignisse() {
    const e = this.ereignisse;
    this.ereignisse = [];
    return e;
  }

  freigeben() {
    window.removeEventListener('keydown', this._runter);
    window.removeEventListener('keyup', this._hoch);
    window.removeEventListener('blur', this._blur);
  }
}
