// Pause-Menü: Fortsetzen, Neustart, Einstellungen, Beenden.
// Im Online-Duell läuft das Spiel weiter; das Menü zeigt dann nur Einstellungen und „Aufgeben“.
import { h, bestaetigen } from './dom.js';
import { t } from '../i18n/de.js';

/**
 * @param {import('../spiel.js').Spiel} spiel
 * @param {{online?: boolean, fortsetzen: Function, neustart?: Function, beenden: Function, aufgeben?: Function}} o
 */
export function pauseMenue(spiel, o) {
  document.querySelectorAll('.pause-menue').forEach((el) => el.remove());
  const schliessen = () => {
    document.removeEventListener('keydown', tasten, true);
    wurzel.remove();
  };
  const knoepfe = [];
  if (!o.online) {
    knoepfe.push(h('button.knopf.haupt', { onClick: () => { schliessen(); o.fortsetzen(); } }, t('pause.fortsetzen')));
    if (o.neustart) knoepfe.push(h('button.knopf', { onClick: () => { schliessen(); o.neustart(); } }, t('pause.neustart')));
  } else {
    knoepfe.push(h('button.knopf.haupt', { onClick: () => { schliessen(); o.fortsetzen(); } }, t('pause.zurueck')));
  }
  knoepfe.push(h('button.knopf', {
    onClick: async () => {
      const { einstellungenZeigen } = await import('./bildschirme/einstellungen.js');
      wurzel.style.display = 'none';
      await einstellungenZeigen(spiel, { imRennen: true });
      wurzel.style.display = '';
    }
  }, t('pause.einstellungen')));
  if (o.online) {
    knoepfe.push(h('button.knopf.gefahr', {
      onClick: async () => {
        if (await bestaetigen(t('pause.aufgebenTitel'), t('pause.aufgebenText'), { jaText: t('pause.aufgeben'), gefahr: true })) {
          schliessen();
          o.aufgeben();
        }
      }
    }, t('pause.aufgeben')));
  } else {
    knoepfe.push(h('button.knopf.geist', { onClick: () => { schliessen(); o.beenden(); } }, t('pause.beenden')));
  }
  const wurzel = h('div.pause-menue.dialog-hintergrund',
    h('div.dialog.panel.pause-panel',
      h('h2', o.online ? t('pause.onlineTitel') : t('pause.titel')),
      o.online ? h('p', t('pause.onlineHinweis')) : null,
      h('div.menue-liste', knoepfe)
    )
  );
  function tasten(e) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      e.stopPropagation();
      schliessen();
      o.fortsetzen();
    }
  }
  document.addEventListener('keydown', tasten, true);
  spiel.overlay.appendChild(wurzel);
  setTimeout(() => knoepfe[0].focus(), 30);
  return { schliessen };
}
