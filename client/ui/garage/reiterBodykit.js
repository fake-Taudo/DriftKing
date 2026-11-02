// Reiter „Bodykit“: je Slot die Varianten (Anprobe und Preis je Auto), Farbe des Teils, Auspuff-Größe.
import { h } from '../dom.js';
import { t } from '../../i18n/de.js';
import { SLOTS, OPTIK_WIRKUNG } from '../../../shared/teile.js';
import { standardLook } from '../../../shared/look.js';
import { farbFeld } from '../farbwaehler.js';
import { schieber, zeile } from '../bausteine.js';
import { abschnitt, teilKarte } from './garageUi.js';

/** Kurze Beschreibung der kleinen Fahrwirkung einer Variante (leer = keine). */
function wirkungText(slot, v) {
  const w = OPTIK_WIRKUNG[slot]?.[v];
  if (!w) return '';
  const teile = [];
  if (w.stabilitaet) teile.push(t('garage.bodykit.stabilitaet', { n: Math.round(w.stabilitaet * 100) }));
  if (w.luftwiderstand) teile.push(t('garage.bodykit.luft', { n: (w.luftwiderstand * 100).toFixed(1).replace('.', ',') }));
  if (w.masse) teile.push(t('garage.bodykit.masse', { n: (w.masse > 0 ? '+' : '−') + Math.abs(w.masse) }));
  return teile.join(' · ');
}

export function reiterBodykit(g, wurzel, ui) {
  const l = g.look;
  const serienFarbe = standardLook(g.autoId).teile.spoiler.farbe;
  for (const s of SLOTS) {
    const teil = l.teile[s.id];
    const wirkung = wirkungText(s.id, teil.variante);
    wurzel.appendChild(abschnitt(s.name,
      h('div.teil-raster', s.varianten.map((name, v) => teilKarte(g, {
        titel: name,
        kaufId: `teil:${s.id}:${v}`,
        aktiv: teil.variante === v,
        onClick: () => {
          g.aendern((x) => {
            const e = x.teile[s.id];
            // Erstes Anbauteil im Slot: in Wagenfarbe statt im dunklen Serienton (sonst kaum zu sehen)
            if (e.variante === 0 && v > 0 && e.farbe === serienFarbe) e.farbe = x.lack.farbe1;
            e.variante = v;
          });
          ui.neuZeichnen();
        }
      }))),
      wirkung ? h('div.einst-hinweis', wirkung) : null,
      teil.variante > 0 ? farbFeld(t('garage.bodykit.farbe'), teil.farbe, (f) => g.aendern((x) => { x.teile[s.id].farbe = f; }, 'teilFarbe' + s.id)) : null,
      s.id === 'auspuff' && teil.variante > 0 ? zeile(t('garage.bodykit.auspuffGroesse'), schieber(teil.groesse, 0.6, 1.5, 0.05, (w) => g.aendern((x) => { x.teile.auspuff.groesse = w; }, 'auspuffGroesse'), (x) => x.toFixed(2))) : null
    ));
  }
}
