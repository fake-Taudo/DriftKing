// Reiter „Fahrwerk“: Tieferlegung, Sturz, Spur – sichtbar am Modell, geringe und erklärte Physikwirkung.
import { h } from '../dom.js';
import { t } from '../../i18n/de.js';
import { schieber, zeile } from '../bausteine.js';
import { abschnitt } from './garageUi.js';

export function reiterFahrwerk(g, wurzel) {
  const f = g.look.fahrwerk;
  const fw = (fn, gruppe) => g.aendern((x) => fn(x.fahrwerk), gruppe);
  wurzel.append(
    abschnitt(t('garage.fahrwerk.titel'),
      zeile(t('garage.fahrwerk.tiefe'), schieber(Math.round(f.tiefe * 100), 0, 100, 1, (w) => fw((x) => { x.tiefe = w / 100; }, 'tiefe'), (x) => x + ' %'), t('garage.fahrwerk.tiefeHinweis')),
      zeile(t('garage.fahrwerk.sturzV'), schieber(f.sturzV, -8, 0, 0.5, (w) => fw((x) => { x.sturzV = w; }, 'sturzV'), (x) => x.toFixed(1) + '°'), t('garage.fahrwerk.sturzVHinweis')),
      zeile(t('garage.fahrwerk.sturzH'), schieber(f.sturzH, -10, 0, 0.5, (w) => fw((x) => { x.sturzH = w; }, 'sturzH'), (x) => x.toFixed(1) + '°'), t('garage.fahrwerk.sturzHHinweis')),
      zeile(t('garage.fahrwerk.spur'), schieber(Math.round(f.spur * 100), 0, 100, 1, (w) => fw((x) => { x.spur = w / 100; }, 'spur'), (x) => x + ' %'), t('garage.fahrwerk.spurHinweis'))
    ),
    h('div.einst-hinweis.garage-notiz', t('garage.fahrwerk.notiz'))
  );
}
