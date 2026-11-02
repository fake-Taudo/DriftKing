// Reiter „Lack“: Grundfarbe, Finish, Zweitfarbe (Dach, Haube, Spiegel) und Muster.
import { h } from '../dom.js';
import { t } from '../../i18n/de.js';
import { FINISHS, MUSTER } from '../../../shared/teile.js';
import { farbFeld } from '../farbwaehler.js';
import { schieber, schalter, zeile } from '../bausteine.js';
import { abschnitt, teilKarte } from './garageUi.js';

export function reiterLack(g, wurzel, ui) {
  const l = g.look;
  wurzel.append(
    abschnitt(t('garage.lack.grund'),
      farbFeld(t('garage.lack.farbe1'), l.lack.farbe1, (f) => g.aendern((x) => { x.lack.farbe1 = f; }, 'farbe1')),
      h('div.teil-raster', FINISHS.map((f) => teilKarte(g, {
        titel: f.name,
        kaufId: 'finish:' + f.id,
        aktiv: l.lack.finish === f.id,
        onClick: () => { g.aendern((x) => { x.lack.finish = f.id; }); ui.neuZeichnen(); }
      })))
    ),
    abschnitt(t('garage.lack.zweit'),
      farbFeld(t('garage.lack.farbe2'), l.lack.farbe2, (f) => g.aendern((x) => { x.lack.farbe2 = f; }, 'farbe2')),
      zeile(t('garage.lack.zweitDach'), schalter(l.lack.zweitDach, (w) => g.aendern((x) => { x.lack.zweitDach = w; }))),
      zeile(t('garage.lack.zweitHaube'), schalter(l.lack.zweitHaube, (w) => g.aendern((x) => { x.lack.zweitHaube = w; }))),
      zeile(t('garage.lack.zweitSpiegel'), schalter(l.lack.zweitSpiegel, (w) => g.aendern((x) => { x.lack.zweitSpiegel = w; })))
    ),
    abschnitt(t('garage.lack.muster'),
      h('div.teil-raster', MUSTER.map((m) => teilKarte(g, {
        titel: m.name,
        kaufId: 'muster:' + m.id,
        aktiv: l.muster.id === m.id,
        onClick: () => { g.aendern((x) => { x.muster.id = m.id; }); ui.neuZeichnen(); }
      }))),
      l.muster.id === 'keins' ? null : [
        farbFeld(t('garage.lack.musterFarbe'), l.muster.farbe, (f) => g.aendern((x) => { x.muster.farbe = f; }, 'musterFarbe')),
        zeile(t('garage.lack.deckkraft'), schieber(Math.round(l.muster.deckkraft * 100), 5, 100, 1, (w) => g.aendern((x) => { x.muster.deckkraft = w / 100; }, 'musterDeckkraft'), (x) => x + ' %')),
        zeile(t('garage.lack.skala'), schieber(l.muster.skala, 0.4, 3, 0.05, (w) => g.aendern((x) => { x.muster.skala = w; }, 'musterSkala'), (x) => x.toFixed(2)))
      ]
    )
  );
}
