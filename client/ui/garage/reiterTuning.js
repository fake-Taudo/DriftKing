// Reiter „Tuning“ (kaufbare Stufen 1–5 mit Vorher/Nachher und Leistungsindex) und „Setup“ (kostenlose Regler,
// drei Slots je Auto).
import { h, dialog } from '../dom.js';
import { t, zahl } from '../../i18n/de.js';
import { TUNING, STUFEN_NAMEN, SETUP_REGLER, standardSetup } from '../../../shared/teile.js';
import { effektiveParameter } from '../../../shared/tuning.js';
import { leistungsindex, piKlasse } from '../../../shared/leistungsindex.js';
import { tuningEinbauen, besitzt } from '../../../shared/oekonomie.js';
import { schieber } from '../bausteine.js';
import { abschnitt } from './garageUi.js';

const PS = 735.49875;

/** Kennzahlen für die Vorher/Nachher-Balken. */
function kennzahlen(g, tuning) {
  const p = effektiveParameter(g.autoId, { tuning, setup: g.auto.setups[g.auto.aktivesSetup], look: g.look });
  return [
    { id: 'leistung', wert: p.leistungWatt / PS, max: 900, text: (w) => Math.round(w) + ' PS' },
    { id: 'gewicht', wert: p.masse, max: 2000, text: (w) => Math.round(w) + ' kg', kleinerBesser: true },
    { id: 'grip', wert: p.grip, max: 1.6, text: (w) => w.toFixed(2) },
    { id: 'stabilitaet', wert: p.stabilitaet, max: 1.8, text: (w) => w.toFixed(2) },
    { id: 'bremse', wert: p.bremskraft, max: 30000, text: (w) => (w / 1000).toFixed(1).replace('.', ',') + ' kN' },
    { id: 'sperre', wert: p.sperre, max: 1, text: (w) => Math.round(w * 100) + ' %' }
  ];
}

function balken(g, jetzt, neu) {
  return h('div.tuning-balken', jetzt.map((k, i) => {
    const n = neu ? neu[i] : k;
    const anteil = (w) => Math.min(100, Math.max(2, (w / k.max) * 100));
    const anders = neu && Math.abs(n.wert - k.wert) > 1e-6;
    return h('div.balken-zeile',
      h('span.balken-name', t('garage.tuning.wert_' + k.id)),
      h('span.balken-spur',
        anders ? h('span.balken-neu', { style: { width: anteil(n.wert) + '%' } }) : null,
        h('span.balken-wert', { style: { width: anteil(Math.min(k.wert, anders ? n.wert : k.wert)) + '%' } })
      ),
      h('span.balken-zahl.zahl', anders ? `${k.text(k.wert)} → ${k.text(n.wert)}` : k.text(k.wert))
    );
  }));
}

export function reiterTuning(g, wurzel, ui) {
  const a = g.auto;
  const pi = leistungsindex(g.autoId, a.tuning);
  const v = ui.tuningVorschau; // { kat, stufe } oder null
  const probe = v ? { ...a.tuning, [v.kat]: v.stufe } : null;
  const piNeu = probe ? leistungsindex(g.autoId, probe) : pi;
  wurzel.appendChild(abschnitt(null,
    h('div.pi-kopf',
      h('div.pi-klasse', piKlasse(piNeu)),
      h('div.pi-zahl.zahl', probe && piNeu !== pi ? `${pi} → ${piNeu}` : String(pi)),
      h('div.einst-hinweis', t('garage.tuning.pi'))
    ),
    balken(g, kennzahlen(g, a.tuning), probe ? kennzahlen(g, probe) : null)
  ));
  for (const k of TUNING) {
    const aktuell = a.tuning[k.id];
    const gewaehlt = v?.kat === k.id ? v.stufe : null;
    const knoepfe = [1, 2, 3, 4, 5].map((s) => {
      const id = `tuning:${k.id}:${s}`;
      const eigen = besitzt(g.daten, id, g.autoId);
      const info = g.preisInfo(id);
      return h('button.stufe-knopf' + (s === aktuell ? '.aktiv' : '') + (s === gewaehlt ? '.vorschau' : '') + (eigen ? '' : '.ungekauft'), {
        dataset: { fokus: id },
        'aria-pressed': s === aktuell ? 'true' : 'false',
        onClick: () => {
          if (eigen) {
            tuningEinbauen(g.daten, g.autoId, k.id, s);
            ui.tuningVorschau = null;
            g.spiel.speicher.speichern();
          } else {
            ui.tuningVorschau = gewaehlt === s ? null : { kat: k.id, stufe: s };
          }
          ui.neuZeichnen();
        }
      }, h('span.stufe-name', STUFEN_NAMEN[s - 1]), h('span.stufe-preis', eigen ? (s === aktuell ? t('garage.tuning.eingebaut') : t('garage.gekauftKurz')) : zahl(info.preis) + ' DM'));
    });
    wurzel.appendChild(abschnitt(k.name,
      h('div.einst-hinweis', k.beschreibung),
      h('div.stufen-reihe', knoepfe),
      gewaehlt ? h('button.knopf.haupt.klein', {
        onClick: async () => {
          const id = `tuning:${k.id}:${gewaehlt}`;
          if (await g.kaufDialog([id])) {
            tuningEinbauen(g.daten, g.autoId, k.id, gewaehlt);
            ui.tuningVorschau = null;
            g.spiel.speicher.sofortSpeichern();
            ui.neuZeichnen();
          }
        }
      }, t('garage.tuning.kaufen', { name: STUFEN_NAMEN[gewaehlt - 1], preis: zahl(g.preisInfo(`tuning:${k.id}:${gewaehlt}`).preis) })) : null
    ));
  }
}

/** Umbenennen eines Slots (Look oder Setup). */
export async function slotUmbenennen(titel, name) {
  const feld = h('input.text-feld', { type: 'text', maxLength: 20, value: name, autocomplete: 'off' });
  const ok = await dialog({
    titel,
    inhalt: feld,
    knoepfe: [
      { text: t('allgemein.abbrechen'), art: 'geist', wert: false },
      { text: t('allgemein.ok'), art: 'haupt', wert: true }
    ]
  });
  const neu = feld.value.trim();
  return ok === true && neu ? neu : null;
}

export function reiterSetup(g, wurzel, ui) {
  const a = g.auto;
  const s = a.setups[a.aktivesSetup];
  wurzel.appendChild(abschnitt(t('garage.setup.slots'),
    h('div.slot-reihe', a.setups.map((st, i) => h('button.slot-knopf' + (i === a.aktivesSetup ? '.aktiv' : ''), {
      dataset: { fokus: 'setup' + i },
      onClick: () => {
        a.aktivesSetup = i;
        g.spiel.speicher.speichern();
        ui.neuZeichnen();
      }
    }, st.name))),
    h('div.ebenen-aktionen',
      h('button.knopf.klein', {
        onClick: async () => {
          const n = await slotUmbenennen(t('garage.setup.umbenennen'), s.name);
          if (n) {
            s.name = n;
            g.spiel.speicher.speichern();
            ui.neuZeichnen();
          }
        }
      }, t('garage.umbenennen')),
      h('button.knopf.klein', {
        onClick: () => {
          s.werte = standardSetup(s.name).werte;
          g.spiel.speicher.speichern();
          ui.neuZeichnen();
        }
      }, t('garage.setup.zuruecksetzen'))
    )
  ));
  wurzel.appendChild(abschnitt(t('garage.setup.regler'),
    SETUP_REGLER.map((r) => h('div.setup-regler',
      h('div.setup-kopf', h('span', r.name), h('span.setup-pole', `${r.links} ↔ ${r.rechts}`)),
      schieber(s.werte[r.id], r.min, r.max, r.schritt, (w) => {
        s.werte[r.id] = w;
        g.spiel.speicher.speichern();
      }, (x) => Math.round(x * 100) + ' %')
    )),
    h('div.einst-hinweis.garage-notiz', t('garage.setup.notiz'))
  ));
}
