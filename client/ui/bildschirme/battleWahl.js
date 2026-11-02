// Battle-Auswahl: Strecke, Schwierigkeit (Bot-Stufe), Gegner (Auto und Look als Vorschau auf der
// Drehscheibe des Hauptmenüs), Format und Belohnungsvorschau. Gesperrtes zeigt die Bedingung.
// Vorgeschlagen wird der Gegner nach Fortschritt; die Stufe ist frei wählbar, soweit freigeschaltet.
import { h, leeren } from '../dom.js';
import { t, zahl } from '../../i18n/de.js';
import { STRECKEN, streckenDef } from '../../../shared/strecken/index.js';
import { BOT_STUFEN } from '../../../shared/bots/botStufen.js';
import { gegnerDerStufe, gegnerVorschlag, gegnerDaten } from '../../../shared/bots/gegnerPool.js';
import { BATTLE_BELOHNUNG, PERFEKT_BONUS, STRECKEN_FREISCHALTUNG } from '../../../shared/oekonomie.js';
import { FORMATE } from '../../../shared/battle.js';
import { autoDaten } from '../../../shared/autos.js';
import { freischaltText } from './streckenwahl.js';

/**
 * @param {import('../../spiel.js').Spiel} spiel
 * @param {{menue?: import('../../modi/hauptmenue.js').Hauptmenue, vorgabe?: object|null}} o
 * @returns {Promise<{streckeId:string, stufe:string, gegnerId:string, format:string}|null>}
 */
export function battleWahl(spiel, { menue = null, vorgabe = null } = {}) {
  return new Promise((aufloesen) => {
    const d = spiel.daten;
    const f = d.fortschritt;
    const freiStrecken = STRECKEN.filter((s) => f.strecken.includes(s.id));
    const wahl = {
      streckeId: vorgabe && f.strecken.includes(vorgabe.streckeId) ? vorgabe.streckeId : freiStrecken[freiStrecken.length - 1].id,
      stufe: null,
      gegnerId: null,
      format: vorgabe && FORMATE[vorgabe.format] ? vorgabe.format : 'bo3'
    };
    let stufeGewaehlt = false;
    const vorschlagen = () => {
      const g = gegnerVorschlag(d, wahl.streckeId);
      wahl.stufe = g.stufe;
      wahl.gegnerId = g.id;
    };
    if (vorgabe && f.botStufen.includes(vorgabe.stufe)) {
      wahl.stufe = vorgabe.stufe;
      wahl.gegnerId = gegnerDaten(vorgabe.gegnerId)?.stufe === vorgabe.stufe ? vorgabe.gegnerId : gegnerDerStufe(vorgabe.stufe)[0].id;
      stufeGewaehlt = true;
    } else {
      vorschlagen();
    }

    const panel = h('div.battle-wahl-panel');
    const info = h('div.battle-vorschau-info');
    const wurzel = h('div.bildschirm.wahl-bildschirm.battle-wahl',
      h('div.wahl-kopf',
        h('button.knopf.geist.klein', { onClick: () => ende(null) }, '← ' + t('allgemein.zurueck')),
        h('h2.titel', t('battleWahl.titel')),
        h('div.muenzen.menue-muenzen.wahl-muenzen', zahl(d.waehrung))
      ),
      h('div.battle-wahl-inhalt', panel, info)
    );

    // Das Hauptmenü darunter ausblenden (die Drehscheibe bleibt als Vorschau sichtbar)
    if (menue?.ui) menue.ui.style.visibility = 'hidden';

    function ende(wert) {
      document.removeEventListener('keydown', tasten, true);
      wurzel.remove();
      if (menue?.ui) menue.ui.style.visibility = '';
      menue?.vorschau?.();
      aufloesen(wert);
    }

    const abschnitt = (titel, ...inhalt) => h('section.battle-abschnitt', h('h3', titel), ...inhalt);
    const knopf = (aktiv, schl, o, text) => h('button.auswahl-knopf' + (aktiv ? '.aktiv' : ''), { ...o, dataset: { fokus: schl }, 'aria-pressed': aktiv ? 'true' : 'false' }, text);

    let letzteVorschau = null;
    function zeichnen() {
      const fokus = document.activeElement?.dataset?.fokus;
      leeren(panel);
      const gegner = gegnerDaten(wahl.gegnerId);
      const erstKey = `${wahl.streckeId}:${wahl.stufe}`;

      // Strecke
      const regel = Object.entries(STRECKEN_FREISCHALTUNG).find(([ziel, r]) => r.nach === wahl.streckeId && !f.strecken.includes(ziel));
      const gesperrt = STRECKEN.filter((s) => !f.strecken.includes(s.id));
      panel.appendChild(abschnitt(t('battleWahl.strecke'),
        h('div.auswahl-gruppe', STRECKEN.map((s) => {
          const frei = f.strecken.includes(s.id);
          return knopf(wahl.streckeId === s.id, 's:' + s.id, {
            disabled: !frei,
            title: frei ? s.beschreibung : freischaltText(s.id),
            onClick: () => { wahl.streckeId = s.id; if (!stufeGewaehlt) vorschlagen(); zeichnen(); }
          }, (frei ? '' : '🔒 ') + s.name);
        })),
        regel ? fortschrittHinweis(Math.max(0, regel[1].siege - (f.siegeStrecke[wahl.streckeId] || 0)), streckenDef(regel[0]).name) : null,
        gesperrt.map((s) => h('div.battle-hinweis.gesperrt', '🔒 ' + s.name + ': ' + freischaltText(s.id)))
      ));

      // Schwierigkeit
      const ersteGesperrte = BOT_STUFEN.find((st) => !f.botStufen.includes(st.id));
      panel.appendChild(abschnitt(t('battleWahl.stufe'),
        h('div.auswahl-gruppe', BOT_STUFEN.map((st) => {
          const frei = f.botStufen.includes(st.id);
          const besiegt = !!f.erstSiege[`${wahl.streckeId}:${st.id}`];
          return knopf(wahl.stufe === st.id, 'st:' + st.id, {
            disabled: !frei,
            title: besiegt ? t('battleWahl.besiegt') : '',
            onClick: () => {
              wahl.stufe = st.id;
              stufeGewaehlt = true;
              const liste = gegnerDerStufe(st.id);
              wahl.gegnerId = liste[(d.statistik.battles || 0) % liste.length].id;
              zeichnen();
            }
          }, (frei ? '' : '🔒 ') + st.name + (besiegt ? ' ✓' : ''));
        })),
        ersteGesperrte ? h('div.battle-hinweis.gesperrt', t('battleWahl.sperreStufe', {
          name: ersteGesperrte.name,
          vorher: BOT_STUFEN[BOT_STUFEN.indexOf(ersteGesperrte) - 1].name
        })) : null
      ));

      // Gegner
      panel.appendChild(abschnitt(t('battleWahl.gegner'),
        h('div.gegner-liste', gegnerDerStufe(wahl.stufe).map((g) => h('button.gegner-karte' + (g.id === wahl.gegnerId ? '.aktiv' : ''), {
          dataset: { fokus: 'g:' + g.id },
          'aria-pressed': g.id === wahl.gegnerId ? 'true' : 'false',
          onClick: () => { wahl.gegnerId = g.id; zeichnen(); }
        },
          h('span.gegner-farbe', { style: { background: g.look.lack.farbe1 } }),
          h('span.gegner-name', g.name),
          h('span.gegner-spitz', t('battleWahl.spitzname', { name: g.spitzname })),
          h('span.gegner-auto', autoDaten(g.autoId).name)
        )))
      ));

      // Format
      panel.appendChild(abschnitt(t('battleWahl.format'),
        h('div.auswahl-gruppe', ['schnell', 'bo3'].map((id) => knopf(wahl.format === id, 'f:' + id, {
          onClick: () => { wahl.format = id; zeichnen(); }
        }, t('battle.format.' + id)))),
        h('div.battle-hinweis', t('battleWahl.formatInfo.' + wahl.format))
      ));

      // Belohnung
      const fak = FORMATE[wahl.format].belohnungsFaktor;
      const tab = BATTLE_BELOHNUNG[wahl.stufe];
      const sieg = Math.round(tab.sieg * fak);
      const erst = !f.erstSiege[erstKey];
      panel.appendChild(abschnitt(t('battleWahl.belohnung'),
        h('div.battle-belohnung',
          h('div.battle-belohnung-zeile', h('span', t('battleWahl.beiSieg')), h('span.muenzen', zahl(sieg))),
          erst ? h('div.battle-belohnung-zeile.bonus', h('span', t('battleWahl.erstsieg')), h('span.muenzen', '+' + zahl(sieg))) : null,
          h('div.battle-belohnung-zeile', h('span', t('battleWahl.beiNiederlage')), h('span.muenzen', zahl(Math.round(tab.niederlage * fak)))),
          h('div.battle-belohnung-zeile.klein', h('span', t('battleWahl.perfekt')), h('span.muenzen', '+' + zahl(Math.round(PERFEKT_BONUS * fak))))
        )
      ));

      panel.appendChild(h('div.knopf-reihe.battle-start',
        h('button.knopf.haupt.gross', { dataset: { fokus: 'start' }, onClick: () => ende({ ...wahl }) }, t('battleWahl.starten'))
      ));

      // Vorschau (Drehscheibe) und Info
      leeren(info);
      info.append(
        h('div.battle-vorschau-rang', botStufeName(wahl.stufe)),
        h('div.battle-vorschau-name', gegner.name),
        h('div.battle-vorschau-auto', autoDaten(gegner.autoId).name + ' · ' + streckenDef(wahl.streckeId).name)
      );
      if (letzteVorschau !== gegner.id) {
        letzteVorschau = gegner.id;
        menue?.vorschau?.(gegner.autoId, gegner.look);
      }
      const ziel = fokus && panel.querySelector(`[data-fokus="${fokus}"]`);
      if (ziel) ziel.focus({ preventScroll: true });
    }

    function tasten(e) {
      if (e.code === 'Escape') { e.preventDefault(); ende(null); }
    }
    document.addEventListener('keydown', tasten, true);
    spiel.overlay.appendChild(wurzel);
    zeichnen();
    setTimeout(() => panel.querySelector('[data-fokus="start"]')?.focus({ preventScroll: true }), 30);
  });
}

function fortschrittHinweis(n, name) {
  return h('div.battle-hinweis', t(n === 1 ? 'battleWahl.fortschrittStreckeEins' : 'battleWahl.fortschrittStrecke', { n, name }));
}

function botStufeName(id) {
  return BOT_STUFEN.find((s) => s.id === id)?.name ?? id;
}
