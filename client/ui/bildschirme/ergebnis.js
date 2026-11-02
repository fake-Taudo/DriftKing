// Ergebnisbildschirm: Titel, Medaille/Sieger, Punkte-Aufschlüsselung, Belohnung mit
// Zähl-Animation, Freischaltungs-Meldungen und nächste Aktionen.
import { h } from '../dom.js';
import { t, zahl } from '../../i18n/de.js';

const MEDAILLEN_FARBE = { bronze: 'var(--farbe-bronze)', silber: 'var(--farbe-silber)', gold: 'var(--farbe-gold)', champion: 'var(--farbe-champion)' };

/**
 * @param {import('../../spiel.js').Spiel} spiel
 * @param {{titel:string, untertitel?:string, sieg?:boolean|null, medaille?:string|null,
 *   zeilen?:Array<[string,string]>, tabelle?:{kopf:string[], zeilen:string[][]}, belohnung?:number,
 *   meldungen?:string[], knoepfe:Array<{text:string, art?:string, aktion:Function}>}} o
 */
export function ergebnisZeigen(spiel, o) {
  document.querySelectorAll('.ergebnis-bildschirm').forEach((el) => el.remove());
  spiel.eingabe.touch.zeigen(false);
  const betrag = h('span.zahl', '0');
  const knopfReihe = h('div.knopf-reihe');
  const wurzel = h('div.ergebnis-bildschirm.dialog-hintergrund',
    h('div.dialog.panel.ergebnis-panel',
      h('h2.ergebnis-titel', { klasse: o.sieg === true ? 'sieg' : o.sieg === false ? 'niederlage' : '' }, o.titel),
      o.untertitel ? h('div.ergebnis-untertitel', o.untertitel) : null,
      o.medaille ? h('div.ergebnis-medaille', { style: { '--medaille': MEDAILLEN_FARBE[o.medaille] } }, h('span.medaille-symbol', '★'), t('medaille.' + o.medaille)) : null,
      o.tabelle ? h('table.ergebnis-tabelle',
        h('thead', h('tr', o.tabelle.kopf.map((k) => h('th', k)))),
        h('tbody', o.tabelle.zeilen.map((z) => h('tr', z.map((w) => h('td', w)))))
      ) : null,
      o.zeilen && o.zeilen.length ? h('div.ergebnis-zeilen', o.zeilen.map(([a, b]) => h('div.ergebnis-zeile', h('span', a), h('span.zahl', b)))) : null,
      o.belohnung ? h('div.ergebnis-belohnung', h('span', t('ergebnis.belohnung')), h('span.muenzen', betrag)) : null,
      (o.meldungen || []).map((m) => h('div.ergebnis-meldung', m)),
      knopfReihe
    )
  );
  for (const k of o.knoepfe) {
    knopfReihe.appendChild(h('button.knopf' + (k.art ? '.' + k.art : ''), {
      onClick: () => {
        wurzel.remove();
        k.aktion();
      }
    }, k.text));
  }
  spiel.overlay.appendChild(wurzel);
  if (o.sieg === true) spiel.audio?.ton?.('sieg');
  else if (o.sieg === false) spiel.audio?.ton?.('niederlage');
  // Zähl-Animation der Belohnung
  if (o.belohnung) {
    const start = performance.now();
    const dauer = Math.min(1600, 400 + o.belohnung * 0.6);
    const schritt = (jetzt) => {
      const a = Math.min(1, (jetzt - start) / dauer);
      betrag.textContent = zahl(Math.round(o.belohnung * (1 - Math.pow(1 - a, 3))));
      if (a < 1 && betrag.isConnected) requestAnimationFrame(schritt);
      else spiel.audio?.ton?.('kasse');
    };
    requestAnimationFrame(schritt);
  }
  setTimeout(() => knopfReihe.querySelector('.knopf')?.focus({ preventScroll: true }), 50);
  return wurzel;
}
