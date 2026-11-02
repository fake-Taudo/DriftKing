// Kleine Anzeige der Tagesaufgaben im Hauptmenü (aufklappbar).
import { h, leeren } from './dom.js';
import { t, zahl } from '../i18n/de.js';
import { aufgabeDaten } from '../../shared/tagesaufgaben.js';

/** @returns {{el: HTMLElement, aktualisieren: Function}} */
export function tagesBox(spiel) {
  const liste = h('div.tages-liste');
  const kopfText = h('span.tages-kopf-text');
  const pfeil = h('span.tages-pfeil');
  let offen = window.innerWidth > window.innerHeight;
  const kopf = h('button.tages-kopf', {
    'aria-expanded': offen ? 'true' : 'false',
    onClick: () => {
      offen = !offen;
      kopf.setAttribute('aria-expanded', offen ? 'true' : 'false');
      el.classList.toggle('offen', offen);
      pfeil.textContent = offen ? '▾' : '▴';
    }
  }, kopfText, pfeil);
  const el = h('section.tages-box.panel' + (offen ? '.offen' : ''), kopf, liste);
  pfeil.textContent = offen ? '▾' : '▴';

  function aktualisieren() {
    spiel.aufgaben?.bereitstellen();
    const aufgaben = spiel.daten.tagesaufgaben.aufgaben;
    kopfText.textContent = t('aufgaben.titel', { n: aufgaben.filter((a) => a.erledigt).length, von: aufgaben.length });
    leeren(liste);
    for (const a of aufgaben) {
      const d = aufgabeDaten(a.id);
      if (!d) continue;
      const anteil = Math.min(100, (a.fortschritt / d.ziel) * 100);
      liste.appendChild(h('div.tages-aufgabe' + (a.erledigt ? '.erledigt' : ''),
        h('div.tages-zeile',
          h('span', (a.erledigt ? '✓ ' : '') + t('aufgaben.text.' + a.id)),
          h('span.muenzen.tages-lohn', zahl(d.belohnung))
        ),
        h('div.tages-balken', h('div', { style: { width: anteil + '%' } }))
      ));
    }
  }
  aktualisieren();
  return { el, aktualisieren };
}
