// Touch-Steuerung: große Tasten mit zuverlässigem Mehrfach-Touch (Pointer Events).
// Lenken wahlweise per Pfeil-Tasten, Lenkrad/Schieber oder Neigung. Layout frei verschiebbar.
import { h } from '../ui/dom.js';
import { t } from '../i18n/de.js';
import { vibrieren } from '../core/geraet.js';

/**
 * Standard-Layouts für Quer- und Hochformat: Positionen (Mittelpunkt) als Anteil der
 * Bildschirmbreite/-höhe, g = Größenfaktor. Im Layout-Editor frei verschiebbar.
 */
export const STANDARD_LAYOUT = {
  quer: {
    links: { x: 0.075, y: 0.8, g: 1 },
    rechts: { x: 0.215, y: 0.8, g: 1 },
    lenkrad: { x: 0.17, y: 0.82, g: 1 },
    gas: { x: 0.915, y: 0.74, g: 1.15 },
    bremse: { x: 0.775, y: 0.85, g: 0.95 },
    handbremse: { x: 0.79, y: 0.6, g: 1 },
    kupplung: { x: 0.655, y: 0.87, g: 0.8 }
  },
  hoch: {
    links: { x: 0.13, y: 0.88, g: 1 },
    rechts: { x: 0.37, y: 0.88, g: 1 },
    lenkrad: { x: 0.3, y: 0.9, g: 0.9 },
    gas: { x: 0.86, y: 0.84, g: 1.1 },
    bremse: { x: 0.64, y: 0.91, g: 0.85 },
    handbremse: { x: 0.86, y: 0.71, g: 0.9 },
    kupplung: { x: 0.64, y: 0.79, g: 0.75 }
  }
};
const kopie = (o) => JSON.parse(JSON.stringify(o));

/** true im Hochformat. */
export function istHochformat() {
  return window.innerHeight > window.innerWidth;
}

const SVG = 'http://www.w3.org/2000/svg';
function icon(pfad) {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', pfad);
  p.setAttribute('fill', 'currentColor');
  s.appendChild(p);
  return s;
}
const ICONS = {
  links: 'M15.5 4 6 12l9.5 8v-5.2L12.3 12l3.2-2.8z',
  rechts: 'M8.5 4 18 12l-9.5 8v-5.2l3.2-2.8-3.2-2.8z',
  gas: 'M7 3h10l-1 18H8zM9 6v3h6V6z',
  bremse: 'M5 8h14v8H5zM7 10v4h10v-4z',
  handbremse: 'M11 2h2v9h3l-4 6-4-6h3zM5 19h14v2H5z',
  kupplung: 'M4 11h16v2H4zM11 4h2v16h-2z'
};

export class TouchSteuerung {
  constructor(eltern) {
    this.eltern = eltern;
    this.wurzel = h('div.touch-steuerung', { 'aria-hidden': 'true' });
    this.modus = 'tasten'; // 'tasten' | 'lenkrad' | 'neigung'
    this.layout = kopie(STANDARD_LAYOUT);
    this.linkshaender = false;
    this.kupplungAn = false;
    this.transparenz = 0.65;
    this.vibration = true;
    this.sichtbar = false;
    this.werteAktuell = { lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0 };
    this.zuletztBenutzt = 0;
    this.ereignisse = [];
    this._lenkZeiger = new Map(); // pointerId → Wert
    this.elemente = {};
    this.eltern.appendChild(this.wurzel);
    this._aufbauen();
    this._groesseHoerer = () => this.positionieren();
    window.addEventListener('resize', this._groesseHoerer);
    window.addEventListener('orientationchange', this._groesseHoerer);
  }

  konfigurieren({ modus, layout, linkshaender, kupplungsButton, transparenz, vibration }) {
    if (modus) this.modus = modus;
    this.layout = kopie(STANDARD_LAYOUT);
    if (layout && typeof layout === 'object') {
      for (const ausrichtung of ['quer', 'hoch']) {
        for (const [k, v] of Object.entries(layout[ausrichtung] || {})) {
          if (this.layout[ausrichtung][k] && v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.g)) {
            this.layout[ausrichtung][k] = { x: Math.min(1, Math.max(0, v.x)), y: Math.min(1, Math.max(0, v.y)), g: Math.min(1.8, Math.max(0.6, v.g)) };
          }
        }
      }
    }
    this.linkshaender = !!linkshaender;
    this.kupplungAn = !!kupplungsButton;
    if (typeof transparenz === 'number') this.transparenz = transparenz;
    this.vibration = vibration !== false;
    this._aufbauen();
  }

  zeigen(an) {
    this.sichtbar = an;
    this.wurzel.classList.toggle('sichtbar', an);
    if (!an) this._allesLoslassen();
    else this.positionieren();
  }

  _allesLoslassen() {
    const w = this.werteAktuell;
    w.lenken = w.gas = w.bremse = w.handbremse = w.kupplung = 0;
    this._lenkZeiger.clear();
    for (const el of Object.values(this.elemente)) el.classList.remove('aktiv');
  }

  _aufbauen() {
    this.wurzel.textContent = '';
    this.elemente = {};
    this.wurzel.style.setProperty('--touch-deckkraft', String(this.transparenz));
    // Lenkung
    if (this.modus === 'tasten') {
      const gruppe = h('div.touch-lenkgruppe');
      const l = h('div.touch-knopf.lenk', { dataset: { aktion: 'links' } }, icon(ICONS.links));
      const r = h('div.touch-knopf.lenk', { dataset: { aktion: 'rechts' } }, icon(ICONS.rechts));
      this.elemente.links = l;
      this.elemente.rechts = r;
      gruppe.append(l, r);
      this.wurzel.appendChild(gruppe);
      this._lenkTastenEreignisse(gruppe, l, r);
    } else if (this.modus === 'lenkrad') {
      const knauf = h('div.touch-lenkknauf');
      const schiene = h('div.touch-lenkrad', h('div.touch-lenkschiene'), knauf);
      this.elemente.lenkrad = schiene;
      this.elemente.lenkknauf = knauf;
      this.wurzel.appendChild(schiene);
      this._lenkradEreignisse(schiene, knauf);
    }
    // Pedale
    const pedale = [['gas', 'gas'], ['bremse', 'bremse'], ['handbremse', 'handbremse']];
    if (this.kupplungAn) pedale.push(['kupplung', 'kupplung']);
    for (const [aktion, ikon] of pedale) {
      const el = h('div.touch-knopf.' + aktion, { dataset: { aktion } }, icon(ICONS[ikon]), h('span.touch-beschriftung', t('eingabe.' + aktion)));
      this.elemente[aktion] = el;
      this.wurzel.appendChild(el);
      this._pedalEreignisse(el, aktion);
    }
    this.positionieren();
  }

  /** Grundgröße der Tasten aus der Bildschirmgröße. */
  _basisGroesse() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return Math.max(64, Math.min(124, Math.min(vw, vh) * 0.2));
  }

  /** Aktives Layout (je nach Ausrichtung). */
  get aktivesLayout() {
    return this.layout[istHochformat() ? 'hoch' : 'quer'];
  }

  positionieren() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const basis = this._basisGroesse();
    const layout = this.aktivesLayout;
    const setze = (el, eintrag, breiteFaktor = 1) => {
      if (!el || !eintrag) return;
      const g = basis * eintrag.g;
      let x = this.linkshaender ? 1 - eintrag.x : eintrag.x;
      const w = g * breiteFaktor;
      let px = x * vw - w / 2;
      let py = eintrag.y * vh - g / 2;
      px = Math.max(4, Math.min(vw - w - 4, px));
      py = Math.max(4, Math.min(vh - g - 4, py));
      el.style.width = w + 'px';
      el.style.height = g + 'px';
      el.style.transform = `translate(${px}px, ${py}px)`;
    };
    if (this.modus === 'tasten') {
      setze(this.elemente.links, layout.links);
      setze(this.elemente.rechts, layout.rechts);
    } else if (this.modus === 'lenkrad') {
      setze(this.elemente.lenkrad, layout.lenkrad, 2.8);
    }
    for (const a of ['gas', 'bremse', 'handbremse', 'kupplung']) setze(this.elemente[a], layout[a]);
  }

  /** Bildschirm-Rechtecke aller Tasten (für den HUD-Überlappungsschutz). */
  rechtecke() {
    return Object.values(this.elemente).filter((e) => e.isConnected && !e.classList.contains('touch-lenkknauf')).map((e) => e.getBoundingClientRect());
  }

  _benutzt() {
    this.zuletztBenutzt = performance.now();
  }

  _lenkTastenEreignisse(gruppe, l, r) {
    const aktualisieren = () => {
      let summe = 0;
      for (const v of this._lenkZeiger.values()) summe += v;
      this.werteAktuell.lenken = Math.max(-1, Math.min(1, summe));
      l.classList.toggle('aktiv', [...this._lenkZeiger.values()].includes(-1));
      r.classList.toggle('aktiv', [...this._lenkZeiger.values()].includes(1));
    };
    const seite = (x) => {
      const a = l.getBoundingClientRect();
      const b = r.getBoundingClientRect();
      const mitte = (a.left + a.right + b.left + b.right) / 4;
      const linksIstLinks = a.left < b.left;
      return (x < mitte) === linksIstLinks ? -1 : 1;
    };
    const runter = (e) => {
      e.preventDefault();
      this._benutzt();
      try { e.target.setPointerCapture?.(e.pointerId); } catch { /* egal */ }
      this._lenkZeiger.set(e.pointerId, seite(e.clientX));
      aktualisieren();
    };
    const bewegen = (e) => {
      if (!this._lenkZeiger.has(e.pointerId)) return;
      this._lenkZeiger.set(e.pointerId, seite(e.clientX));
      aktualisieren();
    };
    const hoch = (e) => {
      this._lenkZeiger.delete(e.pointerId);
      aktualisieren();
    };
    for (const el of [l, r]) {
      el.addEventListener('pointerdown', runter);
      el.addEventListener('pointermove', bewegen);
      el.addEventListener('pointerup', hoch);
      el.addEventListener('pointercancel', hoch);
      el.addEventListener('lostpointercapture', hoch);
    }
  }

  _lenkradEreignisse(schiene, knauf) {
    let zeiger = null;
    const setzen = (x) => {
      const rect = schiene.getBoundingClientRect();
      const mitte = rect.left + rect.width / 2;
      const halb = rect.width / 2 - rect.height * 0.25;
      const w = Math.max(-1, Math.min(1, (x - mitte) / Math.max(20, halb)));
      this.werteAktuell.lenken = w;
      knauf.style.transform = `translateX(${w * halb}px)`;
    };
    schiene.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._benutzt();
      zeiger = e.pointerId;
      try { schiene.setPointerCapture(e.pointerId); } catch { /* egal */ }
      schiene.classList.add('aktiv');
      setzen(e.clientX);
    });
    schiene.addEventListener('pointermove', (e) => {
      if (e.pointerId === zeiger) setzen(e.clientX);
    });
    const loslassen = (e) => {
      if (e.pointerId !== zeiger) return;
      zeiger = null;
      schiene.classList.remove('aktiv');
      this.werteAktuell.lenken = 0;
      knauf.style.transform = 'translateX(0px)';
    };
    schiene.addEventListener('pointerup', loslassen);
    schiene.addEventListener('pointercancel', loslassen);
    schiene.addEventListener('lostpointercapture', loslassen);
  }

  _pedalEreignisse(el, aktion) {
    const zeiger = new Set();
    const aktualisieren = () => {
      const an = zeiger.size > 0 ? 1 : 0;
      const vorher = this.werteAktuell[aktion];
      this.werteAktuell[aktion] = an;
      el.classList.toggle('aktiv', an === 1);
      if (an && !vorher) {
        this.ereignisse.push(aktion);
        if (this.vibration && (aktion === 'handbremse' || aktion === 'kupplung')) vibrieren(12);
      }
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._benutzt();
      zeiger.add(e.pointerId);
      try { el.setPointerCapture(e.pointerId); } catch { /* egal */ }
      aktualisieren();
    });
    const los = (e) => {
      zeiger.delete(e.pointerId);
      aktualisieren();
    };
    el.addEventListener('pointerup', los);
    el.addEventListener('pointercancel', los);
    el.addEventListener('lostpointercapture', los);
  }

  nimmEreignisse() {
    const e = this.ereignisse;
    this.ereignisse = [];
    return e;
  }

  freigeben() {
    window.removeEventListener('resize', this._groesseHoerer);
    window.removeEventListener('orientationchange', this._groesseHoerer);
    this.wurzel.remove();
  }
}
