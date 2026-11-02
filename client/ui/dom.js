// Kleine DOM-Helfer für die UI (ohne Framework).
import { t } from '../i18n/de.js';

/**
 * Erzeugt ein Element: h('div.klasse#id', {attribute, onClick, style}, ...kinder)
 * Kinder: Strings, Zahlen, Elemente, Arrays, null/false (ignoriert).
 */
export function h(selektor, props, ...kinder) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(selektor) || [];
  const el = document.createElement(m[1] || 'div');
  if (m[2]) {
    for (const teil of m[2].match(/[.#][\w-]+/g) || []) {
      if (teil[0] === '.') el.classList.add(teil.slice(1));
      else el.id = teil.slice(1);
    }
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    kinder.unshift(props);
    props = null;
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      } else if (k === 'klasse') {
        for (const c of String(v).split(/\s+/).filter(Boolean)) el.classList.add(c);
      } else if (k === 'text') {
        el.textContent = v;
      } else if (k === 'dataset') {
        Object.assign(el.dataset, v);
      } else if (k in el && typeof v !== 'string') {
        el[k] = v;
      } else {
        el.setAttribute(k, v === true ? '' : String(v));
      }
    }
  }
  anhaengen(el, kinder);
  return el;
}

function anhaengen(el, kinder) {
  for (const k of kinder) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) anhaengen(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

/** Leert ein Element. */
export function leeren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// ---------------------------------------------------------------------------
// Toasts

let toastBereich = null;
function bereich() {
  if (!toastBereich || !toastBereich.isConnected) {
    toastBereich = h('div.toast-bereich', { role: 'status', 'aria-live': 'polite' });
    document.getElementById('overlay').appendChild(toastBereich);
  }
  return toastBereich;
}

/**
 * Zeigt eine kurze Meldung. art: 'info' | 'erfolg' | 'warnung' | 'fehler'
 * @returns {{schliessen: Function, element: HTMLElement}}
 */
export function toast(text, { art = 'info', dauer = 3500, aktion = null } = {}) {
  const el = h('div.toast.' + art, h('span', text));
  if (aktion) {
    el.appendChild(h('button.knopf.klein.akzent', { onClick: () => { aktion.ausfuehren(); schliessen(); } }, aktion.text));
  }
  bereich().appendChild(el);
  let zu = false;
  function schliessen() {
    if (zu) return;
    zu = true;
    el.style.transition = 'opacity 200ms, transform 200ms';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 220);
  }
  if (dauer > 0) setTimeout(schliessen, dauer);
  return { schliessen, element: el };
}

// ---------------------------------------------------------------------------
// Dialoge

/**
 * Zeigt einen modalen Dialog.
 * @param {{titel: string, text?: string, inhalt?: Node, knoepfe?: Array<{text, art?, wert?, aktion?}>, schliessbar?: boolean, fokus?: HTMLElement}} o
 * @returns {Promise<any>} Wert des gedrückten Knopfes (bzw. null bei Schließen)
 */
export function dialog({ titel, text, inhalt, knoepfe, schliessbar = true, fokus = null }) {
  return new Promise((aufloesen) => {
    const vorherFokus = document.activeElement;
    const reihe = h('div.knopf-reihe');
    const hintergrund = h('div.dialog-hintergrund', { role: 'dialog', 'aria-modal': 'true' },
      h('div.dialog.panel',
        h('h2', titel),
        text ? h('p', text) : null,
        inhalt || null,
        reihe
      )
    );
    function ende(wert) {
      document.removeEventListener('keydown', tasten, true);
      hintergrund.remove();
      if (vorherFokus && vorherFokus.focus) vorherFokus.focus();
      aufloesen(wert);
    }
    const liste = knoepfe || [{ text: t('allgemein.ok'), art: 'haupt', wert: true }];
    for (const k of liste) {
      reihe.appendChild(h('button.knopf' + (k.art ? '.' + k.art : ''), {
        onClick: async () => {
          if (k.aktion) {
            const r = await k.aktion();
            if (r === false) return; // Aktion verhindert das Schließen
          }
          ende(k.wert !== undefined ? k.wert : k.text);
        }
      }, k.text));
    }
    function tasten(e) {
      if (e.key === 'Escape' && schliessbar) {
        e.stopPropagation();
        e.preventDefault();
        ende(null);
      }
    }
    document.addEventListener('keydown', tasten, true);
    if (schliessbar) hintergrund.addEventListener('pointerdown', (e) => { if (e.target === hintergrund) ende(null); });
    document.getElementById('overlay').appendChild(hintergrund);
    const ersterKnopf = fokus || reihe.querySelector('.knopf.haupt') || reihe.querySelector('.knopf');
    if (ersterKnopf) setTimeout(() => ersterKnopf.focus(), 30);
  });
}

/** Ja/Nein-Abfrage. */
export function bestaetigen(titel, text, { jaText, neinText, gefahr = false } = {}) {
  return dialog({
    titel,
    text,
    knoepfe: [
      { text: neinText || t('allgemein.abbrechen'), art: 'geist', wert: false },
      { text: jaText || t('allgemein.bestaetigen'), art: gefahr ? 'gefahr' : 'haupt', wert: true }
    ]
  }).then((w) => w === true);
}

/** Text in die Zwischenablage kopieren (mit Rückfall). */
export async function inZwischenablage(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
