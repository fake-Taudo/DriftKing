// Reiter „Details“: Reifenqualm, Neon, Scheibentönung, Scheinwerfer, Rücklichter, Backfire, Kennzeichen,
// Namensschild im Battle.
import { h } from '../dom.js';
import { t, zahl } from '../../i18n/de.js';
import { QUALM, EXTRAS } from '../../../shared/teile.js';
import { standardLook } from '../../../shared/look.js';
import { pruefeKennzeichen } from '../../../shared/wortfilter.js';
import { farbFeld } from '../farbwaehler.js';
import { schieber, schalter, zeile, auswahl } from '../bausteine.js';
import { abschnitt, teilKarte } from './garageUi.js';

const SCHEINWERFER = [['weiss', null], ['gelb', '#ffd56a'], ['eisblau', '#bfe3ff']];

/** Preis-Hinweis für ein Extra, solange es nicht gekauft ist. */
function extraHinweis(g, id) {
  const p = g.preisInfo('extra:' + id);
  return p.besitz ? undefined : t('garage.details.extraPreis', { preis: zahl(p.preis) });
}

export function reiterDetails(g, wurzel, ui) {
  const l = g.look;
  const serie = standardLook(g.autoId);
  void EXTRAS;

  // Reifenqualm
  const istPreset = QUALM.some((q) => q.farbe && q.farbe.toLowerCase() === String(l.qualm).toLowerCase());
  wurzel.appendChild(abschnitt(t('garage.details.qualm'),
    h('div.teil-raster', QUALM.map((q) => {
      const aktiv = q.id === 'frei' ? !istPreset : q.farbe && q.farbe.toLowerCase() === String(l.qualm).toLowerCase();
      return teilKarte(g, {
        titel: q.name,
        kaufId: 'qualm:' + q.id,
        aktiv,
        vorschau: q.farbe === 'regenbogen' ? h('span.farb-muster.regenbogen') : q.farbe ? h('span.farb-muster', { style: { background: q.farbe } }) : null,
        onClick: () => {
          g.aendern((x) => { x.qualm = q.id === 'frei' ? (istPreset || x.qualm === 'regenbogen' ? '#ffb000' : x.qualm) : q.farbe; });
          ui.neuZeichnen();
        }
      });
    })),
    !istPreset && l.qualm !== 'regenbogen' ? farbFeld(t('garage.details.qualmFarbe'), l.qualm, (f) => g.aendern((x) => { x.qualm = f; }, 'qualmFarbe')) : null,
    h('div.einst-hinweis', t('garage.details.qualmHinweis'))
  ));

  // Neon
  wurzel.appendChild(abschnitt(t('garage.details.neon'),
    zeile(t('garage.details.neonAn'), schalter(l.neon.an, (w) => { g.aendern((x) => { x.neon.an = w; }); ui.neuZeichnen(); }), extraHinweis(g, 'neon')),
    l.neon.an ? [
      farbFeld(t('garage.details.neonFarbe'), l.neon.farbe, (f) => g.aendern((x) => { x.neon.farbe = f; }, 'neonFarbe')),
      zeile(t('garage.details.neonHell'), schieber(Math.round(l.neon.helligkeit * 100), 5, 100, 1, (w) => g.aendern((x) => { x.neon.helligkeit = w / 100; }, 'neonHell'), (x) => x + ' %')),
      zeile(t('garage.details.neonPuls'), schalter(l.neon.puls, (w) => g.aendern((x) => { x.neon.puls = w; })))
    ] : null
  ));

  // Scheiben und Licht
  const swWert = l.scheinwerfer.toLowerCase();
  const swArt = swWert === serie.scheinwerfer.toLowerCase() ? 'weiss' : SCHEINWERFER.find(([, f]) => f === swWert)?.[0] ?? 'frei';
  const rueckGeaendert = l.rueck.toLowerCase() !== serie.rueck.toLowerCase();
  wurzel.appendChild(abschnitt(t('garage.details.licht'),
    zeile(t('garage.details.scheiben'), auswahl([0, 1, 2, 3, 4].map((s) => [s, t('garage.details.toenung' + s)]), l.scheiben, (w) => { g.aendern((x) => { x.scheiben = w; }); }), extraHinweis(g, 'toenung')),
    zeile(t('garage.details.scheinwerfer'), auswahl([...SCHEINWERFER.map(([id]) => [id, t('garage.details.sw_' + id)]), ['frei', t('garage.details.sw_frei')]], swArt, (w) => {
      g.aendern((x) => {
        if (w === 'weiss') x.scheinwerfer = serie.scheinwerfer;
        else if (w === 'frei') x.scheinwerfer = swArt === 'frei' ? x.scheinwerfer : '#a0ffd0';
        else x.scheinwerfer = SCHEINWERFER.find(([id]) => id === w)[1];
      });
      ui.neuZeichnen();
    }), extraHinweis(g, 'lichtfarbe')),
    swArt === 'frei' ? farbFeld(t('garage.details.swFarbe'), l.scheinwerfer, (f) => g.aendern((x) => { x.scheinwerfer = f; }, 'swFarbe')) : null,
    zeile(t('garage.details.rueckDesign'), auswahl([0, 1, 2].map((d) => [d, t('garage.details.rueck' + d)]), l.rueckDesign, (w) => g.aendern((x) => { x.rueckDesign = w; })), extraHinweis(g, 'ruecklicht')),
    farbFeld(t('garage.details.rueckFarbe'), l.rueck, (f) => g.aendern((x) => { x.rueck = f; }, 'rueckFarbe'), { hinweis: rueckGeaendert ? undefined : extraHinweis(g, 'ruecklicht') })
  ));

  // Backfire
  wurzel.appendChild(abschnitt(t('garage.details.backfire'),
    zeile(t('garage.details.backfireStaerke'), schieber(Math.round(l.backfire * 100), 0, 100, 5, (w) => g.aendern((x) => { x.backfire = w / 100; }, 'backfire'), (x) => x + ' %'), extraHinweis(g, 'backfire'))
  ));

  // Kennzeichen
  const fehler = h('div.einst-fehler');
  const feld = h('input.text-feld.kennzeichen-feld', {
    type: 'text', maxLength: 8, value: l.kennzeichen, autocomplete: 'off', spellcheck: 'false',
    'aria-label': t('garage.details.kennzeichen'), dataset: { fokus: 'kennzeichen' }
  });
  feld.addEventListener('input', () => {
    const wert = feld.value.toUpperCase();
    feld.value = wert;
    const f = pruefeKennzeichen(wert);
    fehler.textContent = f ? t('fehlertexte.' + f) : '';
    if (!f) g.aendern((x) => { x.kennzeichen = wert.trim(); }, 'kennzeichen');
  });
  wurzel.appendChild(abschnitt(t('garage.details.kennzeichen'), feld, fehler));

  // Namensschild
  const anzeige = g.daten.einstellungen.anzeige;
  wurzel.appendChild(abschnitt(t('garage.details.tag'),
    zeile(t('garage.details.tagAn'), schalter(anzeige.namensTag, (w) => { anzeige.namensTag = w; g.spiel.speicher.speichern(); }), t('garage.details.tagHinweis'))
  ));
}
