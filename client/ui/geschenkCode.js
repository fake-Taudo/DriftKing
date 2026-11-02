// Geschenk-Symbol im Hauptmenü und Dialog zum Einlösen eines Codes. Die Regeln stehen in shared/oekonomie.js.
import { h, dialog, toast } from './dom.js';
import { t, zahl } from '../i18n/de.js';
import { codeEinloesen, MAX_CODE_LAENGE } from '../../shared/oekonomie.js';

const SVG = 'http://www.w3.org/2000/svg';

function svgTeil(tag, klasse, attribute) {
  const el = document.createElementNS(SVG, tag);
  el.setAttribute('class', klasse);
  for (const [k, v] of Object.entries(attribute)) el.setAttribute(k, v);
  return el;
}

function geschenkSymbol() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'geschenk-symbol');
  svg.setAttribute('aria-hidden', 'true');
  svg.append(
    svgTeil('rect', 'geschenk-karton', { x: 4.5, y: 12.5, width: 15, height: 9, rx: 1 }),
    svgTeil('rect', 'geschenk-karton', { x: 3, y: 8, width: 18, height: 3.5, rx: 1 }),
    svgTeil('rect', 'geschenk-band', { x: 10.5, y: 8, width: 3, height: 13.5 }),
    svgTeil('path', 'geschenk-band', { d: 'M12 8C10.2 3.8 6.6 2.4 5.7 4.6 5 6.8 8.4 8 12 8Z' }),
    svgTeil('path', 'geschenk-band', { d: 'M12 8C13.8 3.8 17.4 2.4 18.3 4.6 19 6.8 15.6 8 12 8Z' })
  );
  return svg;
}

async function codeDialog(spiel) {
  const meldung = h('div.code-meldung', { role: 'alert' });
  const feld = h('input.text-eingabe.code-feld', {
    type: 'text',
    placeholder: t('geschenk.feld'),
    'aria-label': t('geschenk.feld'),
    maxlength: MAX_CODE_LAENGE,
    autocomplete: 'off',
    autocapitalize: 'characters',
    autocorrect: 'off',
    spellcheck: 'false',
    onInput: () => { meldung.textContent = ''; },
    onKeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault(); // Sonst löst dieselbe Taste den Geschenk-Knopf aus, der nach dem Schließen den Fokus bekommt
      feld.closest('.dialog').querySelector('.knopf.haupt').click();
    }
  });
  await dialog({
    titel: t('geschenk.titel'),
    inhalt: h('div', feld, meldung),
    fokus: feld,
    knoepfe: [
      { text: t('allgemein.abbrechen'), art: 'geist', wert: null },
      {
        text: t('geschenk.einloesen'),
        art: 'haupt',
        aktion: () => {
          const r = codeEinloesen(spiel.daten, feld.value);
          if (!r.ok) {
            meldung.textContent = t('geschenk.' + r.grund);
            feld.focus();
            return false;
          }
          spiel.speicher.sofortSpeichern();
          spiel.audio?.ton?.('kasse');
          toast(t('geschenk.erfolg', { n: zahl(r.betrag) }), { art: 'erfolg' });
          return true;
        }
      }
    ]
  });
}

/** Runder Knopf mit Geschenk-Symbol, öffnet den Code-Dialog. */
export function geschenkKnopf(spiel) {
  return h('button.knopf.rund.geist.menue-geschenk', { 'aria-label': t('geschenk.knopf'), onClick: () => codeDialog(spiel) }, geschenkSymbol());
}
