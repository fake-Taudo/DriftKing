// Reiter „Looks“: fünf Look-Slots je Auto (umbenennbar), Zurücksetzen und Look-Code zum Teilen.
import { h, dialog, toast, inZwischenablage, bestaetigen } from '../dom.js';
import { t } from '../../i18n/de.js';
import { lookZuCode, codeZuLook, standardLook, kopiereLook } from '../../../shared/look.js';
import { AUFKLEBER_IDS } from '../../assets/aufkleber.js';
import { autoDaten } from '../../../shared/autos.js';
import { abschnitt } from './garageUi.js';
import { slotUmbenennen } from './reiterTuning.js';

/** Verständliche Meldung zu einem abgelehnten Look-Code. */
function codeFehlerText(r) {
  if (r.fehler === 'falsches_auto') return t('garage.looks.codeAnderesAuto', { auto: autoDaten(r.auto)?.name ?? r.auto });
  if (r.fehler === 'schema') return t('garage.looks.codeSchema', { feld: r.feld });
  return t('garage.looks.code_' + (['leer', 'zu_gross'].includes(r.fehler) ? r.fehler : 'kaputt'));
}

async function codeExportieren(g) {
  try {
    const code = await lookZuCode(g.look);
    const feld = h('textarea.code-feld', { readOnly: true, rows: 5 });
    feld.value = code;
    await dialog({
      titel: t('garage.looks.codeTitel'),
      text: t('garage.looks.codeHinweis'),
      inhalt: feld,
      knoepfe: [
        { text: t('allgemein.schliessen'), art: 'geist', wert: false },
        {
          text: t('allgemein.kopieren'),
          art: 'haupt',
          wert: true,
          aktion: async () => {
            const ok = await inZwischenablage(code);
            toast(ok ? t('allgemein.kopiert') : t('allgemein.fehlerKopieren'), { art: ok ? 'erfolg' : 'warnung' });
            return ok;
          }
        }
      ]
    });
  } catch (e) {
    toast(e.message === 'zu_gross' ? t('garage.looks.code_zu_gross') : t('garage.looks.codeExportFehler'), { art: 'fehler' });
  }
}

async function codeImportieren(g, ui) {
  const feld = h('textarea.code-feld', { rows: 5, spellcheck: 'false', 'aria-label': t('garage.looks.codeEingeben') });
  const fehler = h('div.einst-fehler');
  let ergebnis = null;
  const ok = await dialog({
    titel: t('garage.looks.importTitel'),
    text: t('garage.looks.codeEingeben'),
    inhalt: h('div', feld, fehler),
    knoepfe: [
      { text: t('allgemein.abbrechen'), art: 'geist', wert: false },
      {
        text: t('garage.looks.importieren'),
        art: 'haupt',
        wert: true,
        aktion: async () => {
          const r = await codeZuLook(feld.value, { aufkleberIds: AUFKLEBER_IDS, autoId: g.autoId });
          if (!r.ok) {
            fehler.textContent = codeFehlerText(r);
            return false;
          }
          ergebnis = r.look;
          return true;
        }
      }
    ]
  });
  if (ok === true && ergebnis) {
    g.lookErsetzen(ergebnis);
    ui.neuZeichnen();
    toast(t('garage.looks.importOk'), { art: 'erfolg' });
  }
}

export function reiterLooks(g, wurzel, ui) {
  const a = g.auto;
  wurzel.appendChild(abschnitt(t('garage.looks.slots'),
    h('div.look-liste', a.looks.map((l, i) => h('div.look-reihe' + (i === a.aktiverLook ? '.aktiv' : ''),
      h('button.look-wahl', {
        dataset: { fokus: 'look' + i },
        'aria-pressed': i === a.aktiverLook ? 'true' : 'false',
        onClick: () => { if (i !== a.aktiverLook) g.lookSlotWechseln(i); }
      },
        h('span.look-punkt', { style: { background: l.look.lack.farbe1 } }),
        h('span.look-name', l.name),
        i === a.aktiverLook ? h('small', t('garage.looks.aktiv')) : null
      ),
      h('button.knopf.geist.klein', {
        onClick: async () => {
          const n = await slotUmbenennen(t('garage.looks.umbenennen'), l.name);
          if (n) {
            l.name = n;
            g.spiel.speicher.speichern();
            ui.neuZeichnen();
          }
        }
      }, t('garage.umbenennen'))
    )))
  ));
  wurzel.appendChild(abschnitt(t('garage.looks.teilen'),
    h('div.einst-hinweis', t('garage.looks.teilenHinweis')),
    h('div.ebenen-aktionen',
      h('button.knopf.akzent.klein', { onClick: () => codeExportieren(g) }, t('garage.looks.exportieren')),
      h('button.knopf.klein', { onClick: () => codeImportieren(g, ui) }, t('garage.looks.importieren'))
    )
  ));
  wurzel.appendChild(abschnitt(t('garage.looks.werkzeuge'),
    h('div.ebenen-aktionen',
      h('button.knopf.gefahr.klein', {
        onClick: async () => {
          if (await bestaetigen(t('garage.looks.serieTitel'), t('garage.looks.serieText'), { jaText: t('garage.looks.serie'), gefahr: true })) {
            g.lookErsetzen(kopiereLook(standardLook(g.autoId)));
            ui.neuZeichnen();
          }
        }
      }, t('garage.looks.serie'))
    )
  ));
}
