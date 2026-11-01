// Streckenauswahl (Freies Fahren, Zeitangriff): Karten mit Name, Beschreibung, Schwierigkeit,
// Länge, Bestwerten; gesperrte Strecken zeigen die Freischalt-Bedingung.
import { h } from '../dom.js';
import { t } from '../../i18n/de.js';
import { STRECKEN } from '../../../shared/strecken/index.js';
import { strecke } from '../../modi/rennen.js';
import { formatZeit } from '../hud.js';

/** Freischalt-Text einer gesperrten Strecke. */
export function freischaltText(id) {
  if (id === 'kuestenpass') return t('wahl.sperreKuestenpass');
  if (id === 'neonhafen') return t('wahl.sperreNeonhafen');
  return '';
}

/**
 * @returns {Promise<string|null>} gewählte Strecken-ID oder null (zurück)
 */
export function streckenwahl(spiel, { titel, modus }) {
  return new Promise((aufloesen) => {
    const d = spiel.daten;
    const wurzel = h('div.bildschirm.mit-hintergrund.wahl-bildschirm');
    const ende = (wert) => {
      document.removeEventListener('keydown', tasten, true);
      wurzel.remove();
      aufloesen(wert);
    };
    const karten = STRECKEN.map((def) => {
      const frei = d.fortschritt.strecken.includes(def.id);
      const S = strecke(def.id);
      const best = d.fortschritt.bestwerte[def.id] || {};
      const medaille = d.fortschritt.medaillen[def.id];
      const sterne = '★'.repeat(def.schwierigkeit) + '☆'.repeat(3 - def.schwierigkeit);
      return h('button.strecken-karte' + (frei ? '' : '.gesperrt'), {
        disabled: !frei,
        dataset: { strecke: def.id, tageszeit: def.tageszeit },
        onClick: () => frei && ende(def.id)
      },
        h('div.karte-bild', h('div.karte-tageszeit', def.tageszeit)),
        h('div.karte-inhalt',
          h('h3', def.name),
          h('div.karte-meta', h('span.sterne', { 'aria-label': t('wahl.schwierigkeit', { n: def.schwierigkeit }) }, sterne), h('span', t('wahl.laenge', { m: Math.round(S.laenge) })), h('span', t('wahl.zonen', { n: S.zonen.length }))),
          h('p', def.beschreibung),
          frei
            ? h('div.karte-best',
              best.runde ? h('span', t('wahl.bestRunde', { zeit: formatZeit(best.runde) })) : null,
              modus === 'zeitangriff' && medaille ? h('span.medaille-klein', { dataset: { medaille } }, '★ ' + t('medaille.' + medaille)) : null,
              modus === 'zeitangriff' && best.zeitangriff ? h('span', t('wahl.bestPunkte', { n: Math.round(best.zeitangriff) })) : null
            )
            : h('div.karte-sperre', '🔒 ' + freischaltText(def.id))
        )
      );
    });
    wurzel.append(
      h('div.wahl-kopf', h('button.knopf.geist.klein', { onClick: () => ende(null) }, '← ' + t('allgemein.zurueck')), h('h2.titel', t(titel))),
      h('div.strecken-liste', karten)
    );
    function tasten(e) {
      if (e.code === 'Escape') { e.preventDefault(); ende(null); }
    }
    document.addEventListener('keydown', tasten, true);
    spiel.overlay.appendChild(wurzel);
    setTimeout(() => wurzel.querySelector('.strecken-karte:not(.gesperrt)')?.focus(), 30);
  });
}
