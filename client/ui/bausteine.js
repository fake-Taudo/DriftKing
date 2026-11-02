// Gemeinsame Bedienelemente der Menüs (Einstellungen, Garage): Schieberegler, Auswahlgruppe, Schalter, Zeile.
import { h } from './dom.js';

/**
 * Schieberegler. beiAenderung läuft bei jeder Bewegung, beiEnde einmal beim Loslassen.
 */
export function schieber(wert, min, max, schritt, beiAenderung, format = (x) => String(x), beiEnde = null) {
  const anzeige = h('span.schieber-wert.zahl', format(wert));
  const eingabe = h('input', { type: 'range', min, max, step: schritt, value: wert });
  eingabe.addEventListener('input', () => {
    const w = Number(eingabe.value);
    anzeige.textContent = format(w);
    beiAenderung(w);
  });
  if (beiEnde) eingabe.addEventListener('change', () => beiEnde(Number(eingabe.value)));
  return h('div.schieber', eingabe, anzeige);
}

export function auswahl(optionen, aktuell, beiAenderung) {
  const gruppe = h('div.auswahl-gruppe', { role: 'radiogroup' });
  for (const [wert, text] of optionen) {
    const k = h('button.auswahl-knopf' + (wert === aktuell ? '.aktiv' : ''), {
      role: 'radio',
      'aria-checked': wert === aktuell ? 'true' : 'false',
      onClick: () => {
        gruppe.querySelectorAll('.auswahl-knopf').forEach((b) => { b.classList.remove('aktiv'); b.setAttribute('aria-checked', 'false'); });
        k.classList.add('aktiv');
        k.setAttribute('aria-checked', 'true');
        beiAenderung(wert);
      }
    }, text);
    gruppe.appendChild(k);
  }
  return gruppe;
}

export function schalter(an, beiAenderung) {
  const k = h('button.schalter' + (an ? '.an' : ''), { role: 'switch', 'aria-checked': an ? 'true' : 'false' }, h('span'));
  k.addEventListener('click', () => {
    const neu = !k.classList.contains('an');
    k.classList.toggle('an', neu);
    k.setAttribute('aria-checked', neu ? 'true' : 'false');
    beiAenderung(neu);
  });
  return k;
}

export function zeile(titel, steuerung, hinweis) {
  return h('div.einst-zeile', h('div.einst-text', h('div.einst-titel', titel), hinweis ? h('div.einst-hinweis', hinweis) : null), h('div.einst-steuerung', steuerung));
}
