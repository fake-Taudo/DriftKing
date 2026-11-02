// Farbwähler: Farbrad (Farbton und Sättigung), Helligkeit, Hex-Eingabe und Schnellfarben.
// farbFeld() zeigt eine Zeile mit Farbmuster; ein Tipp klappt den Wähler auf (immer nur einer offen).
import { h } from './dom.js';
import { t } from '../i18n/de.js';

export const SCHNELLFARBEN = [
  '#f4f4f4', '#9a9da3', '#1b1c22', '#e8452c', '#ff8a1f', '#f2c230', '#39e08a', '#0f5c4a',
  '#2ee6ff', '#2c6be8', '#1a1d3a', '#b15cff', '#ff3d6e', '#7a1f2b', '#c9a66b', '#d7a83e'
];
const FARBE = /^#[0-9a-fA-F]{6}$/;

export function hexZuHsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let w = 0;
  if (d > 0) {
    if (max === r) w = ((g - b) / d + 6) % 6;
    else if (max === g) w = (b - r) / d + 2;
    else w = (r - g) / d + 4;
  }
  return { h: w * 60, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvZuHex(hh, s, v) {
  const f = (n) => {
    const k = (n + hh / 60) % 6;
    const w = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(w * 255).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

let radBild = null;
/** Farbrad einmal berechnen und wiederverwenden (Helligkeit als Überlagerung). */
function radZeichnen(ctx, g) {
  if (!radBild || radBild.width !== g) {
    radBild = ctx.createImageData(g, g);
    const r = g / 2;
    for (let y = 0; y < g; y++) {
      for (let x = 0; x < g; x++) {
        const dx = x + 0.5 - r, dy = y + 0.5 - r;
        const d = Math.hypot(dx, dy) / r;
        const i = (y * g + x) * 4;
        if (d > 1) continue;
        const hex = hsvZuHex(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, d, 1);
        const n = parseInt(hex.slice(1), 16);
        radBild.data[i] = (n >> 16) & 255;
        radBild.data[i + 1] = (n >> 8) & 255;
        radBild.data[i + 2] = n & 255;
        radBild.data[i + 3] = Math.round(Math.min(1, (1 - d) * r) * 255);
      }
    }
  }
  ctx.putImageData(radBild, 0, 0);
}

/**
 * Inhalt des Wählers.
 * @param {string} farbe Startfarbe
 * @param {(hex:string)=>void} beiAenderung läuft bei jeder Änderung
 */
export function farbwaehler(farbe, beiAenderung) {
  const G = 168;
  let hsv = hexZuHsv(FARBE.test(farbe) ? farbe : '#ffffff');
  const rad = h('canvas.farb-rad', { width: G, height: G, 'aria-label': t('farbe.rad') });
  const ctx = rad.getContext('2d');
  radZeichnen(ctx, G);
  const griff = h('div.farb-griff');
  const radBox = h('div.farb-rad-box', rad, griff);
  const hell = h('input.farb-hell', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(hsv.v * 100), 'aria-label': t('farbe.helligkeit') });
  const hex = h('input.farb-hex', { type: 'text', maxLength: 7, spellcheck: 'false', autocomplete: 'off', 'aria-label': t('farbe.hex') });
  const fehler = h('div.farb-fehler');
  const muster = h('div.farb-schnell', SCHNELLFARBEN.map((f) => h('button.farb-punkt', {
    style: { background: f },
    'aria-label': f,
    onClick: () => { hsv = hexZuHsv(f); anzeigen(f); beiAenderung(f); }
  })));

  function anzeigen(aktuell, hexLassen = false) {
    const r = G / 2;
    const w = (hsv.h * Math.PI) / 180;
    griff.style.left = r + Math.cos(w) * hsv.s * r + 'px';
    griff.style.top = r + Math.sin(w) * hsv.s * r + 'px';
    griff.style.background = aktuell;
    rad.style.filter = `brightness(${Math.max(0.15, hsv.v)})`;
    hell.value = String(Math.round(hsv.v * 100));
    if (!hexLassen) hex.value = aktuell;
    fehler.textContent = '';
  }

  function ausPosition(e) {
    const b = rad.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width * 2 - 1;
    const y = (e.clientY - b.top) / b.height * 2 - 1;
    hsv.h = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    hsv.s = Math.min(1, Math.hypot(x, y));
    if (hsv.v < 0.05) hsv.v = 1;
    const f = hsvZuHex(hsv.h, hsv.s, hsv.v);
    anzeigen(f);
    beiAenderung(f);
  }
  radBox.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    radBox.setPointerCapture(e.pointerId);
    ausPosition(e);
  });
  radBox.addEventListener('pointermove', (e) => {
    if (radBox.hasPointerCapture(e.pointerId)) ausPosition(e);
  });
  hell.addEventListener('input', () => {
    hsv.v = Number(hell.value) / 100;
    const f = hsvZuHex(hsv.h, hsv.s, hsv.v);
    anzeigen(f);
    beiAenderung(f);
  });
  hex.addEventListener('input', () => {
    let w = hex.value.trim();
    if (w && w[0] !== '#') w = '#' + w;
    if (FARBE.test(w)) {
      hsv = hexZuHsv(w);
      anzeigen(w.toLowerCase(), true);
      beiAenderung(w.toLowerCase());
    } else {
      fehler.textContent = w.length >= 7 ? t('farbe.hexFehler') : '';
    }
  });
  anzeigen(FARBE.test(farbe) ? farbe : '#ffffff');
  return h('div.farbwaehler',
    radBox,
    h('div.farb-spalte',
      h('label.farb-beschriftung', t('farbe.helligkeit'), hell),
      h('label.farb-beschriftung', t('farbe.hex'), hex),
      fehler,
      muster
    )
  );
}

let offenesFeld = null;

/**
 * Zeile mit Titel und Farbmuster; ein Tipp klappt den Farbwähler darunter auf.
 * @param {string} titel
 * @param {string} farbe
 * @param {(hex:string)=>void} beiAenderung
 * @param {{hinweis?:string, gesperrt?:boolean}} [o]
 */
export function farbFeld(titel, farbe, beiAenderung, { hinweis } = {}) {
  const punkt = h('span.farb-muster', { style: { background: farbe } });
  const wert = h('span.zahl.farb-wert', farbe);
  let waehler = null;
  const zu = () => {
    waehler?.remove();
    waehler = null;
    knopf.setAttribute('aria-expanded', 'false');
    if (offenesFeld === zu) offenesFeld = null;
  };
  const knopf = h('button.farb-zeile', {
    'aria-expanded': 'false',
    onClick: () => {
      if (waehler) { zu(); return; }
      offenesFeld?.();
      waehler = farbwaehler(punkt.dataset.farbe || farbe, (f) => {
        punkt.style.background = f;
        punkt.dataset.farbe = f;
        wert.textContent = f;
        beiAenderung(f);
      });
      wurzel.appendChild(waehler);
      knopf.setAttribute('aria-expanded', 'true');
      offenesFeld = zu;
    }
  }, h('span.farb-titel', titel, hinweis ? h('small', hinweis) : null), h('span.farb-rechts', wert, punkt));
  const wurzel = h('div.farb-feld', knopf);
  return wurzel;
}

/** Schließt einen offenen Farbwähler (beim Neuzeichnen eines Panels). */
export function farbFeldSchliessen() {
  offenesFeld = null;
}
