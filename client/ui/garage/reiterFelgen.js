// Reiter „Felgen“: 12 Designs, Farben (Felge, Zierring, Bolzen), Größe, Breite, Reifenflanke, Profil, Bremssattel.
import { h } from '../dom.js';
import { t } from '../../i18n/de.js';
import { FELGEN } from '../../../shared/teile.js';
import { farbFeld } from '../farbwaehler.js';
import { schieber, schalter, zeile, auswahl } from '../bausteine.js';
import { abschnitt, teilKarte } from './garageUi.js';

export function reiterFelgen(g, wurzel, ui) {
  const f = g.look.felgen;
  const fel = (fn, gruppe) => g.aendern((x) => fn(x.felgen), gruppe);
  wurzel.append(
    abschnitt(t('garage.felgen.design'),
      h('div.teil-raster', FELGEN.map((d) => teilKarte(g, {
        titel: d.name,
        kaufId: 'felge:' + d.id,
        aktiv: f.design === d.id,
        onClick: () => { fel((x) => { x.design = d.id; }); ui.neuZeichnen(); }
      })))
    ),
    abschnitt(t('garage.felgen.farben'),
      farbFeld(t('garage.felgen.farbe'), f.farbe, (w) => fel((x) => { x.farbe = w; }, 'felgeFarbe')),
      farbFeld(t('garage.felgen.zierring'), f.zierring, (w) => fel((x) => { x.zierring = w; }, 'felgeZier')),
      farbFeld(t('garage.felgen.bolzen'), f.bolzen, (w) => fel((x) => { x.bolzen = w; }, 'felgeBolzen')),
      farbFeld(t('garage.felgen.sattel'), f.sattel, (w) => fel((x) => { x.sattel = w; }, 'felgeSattel'))
    ),
    abschnitt(t('garage.felgen.masse'),
      zeile(t('garage.felgen.groesse'), schieber(f.groesse, 15, 20, 1, (w) => fel((x) => { x.groesse = w; }, 'felgeGroesse'), (x) => x + '″')),
      zeile(t('garage.felgen.breite'), schieber(f.breite, 6.5, 11, 0.5, (w) => fel((x) => { x.breite = w; }, 'felgeBreite'), (x) => x.toFixed(1) + '″'))
    ),
    abschnitt(t('garage.felgen.reifen'),
      zeile(t('garage.felgen.profil'), auswahl([0, 1, 2, 3].map((p) => [p, t('garage.felgen.profilArt' + p)]), f.profil, (w) => fel((x) => { x.profil = w; }))),
      zeile(t('garage.felgen.flankeLinie'), schalter(f.flankeLinie, (w) => { fel((x) => { x.flankeLinie = w; }); ui.neuZeichnen(); })),
      f.flankeLinie ? farbFeld(t('garage.felgen.flanke'), f.flanke, (w) => fel((x) => { x.flanke = w; }, 'felgeFlanke')) : null
    )
  );
}
