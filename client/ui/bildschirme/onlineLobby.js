// Online-Duell: Verbinden (auch mit aufwachendem Server), Duell erstellen oder per Code beitreten, Lobby mit
// Name, Auto, Look-Vorschau und PI beider Spieler, Strecke, Format, Einheits-Leistung, Bereit und Emotes.
import { h, leeren, toast, inZwischenablage } from '../dom.js';
import { auswahl, schalter, zeile } from '../bausteine.js';
import { t, zahl } from '../../i18n/de.js';
import { streckenDef } from '../../../shared/strecken/index.js';
import { autoDaten } from '../../../shared/autos.js';
import { piKlasse } from '../../../shared/leistungsindex.js';
import { EMOTES, CODE_LAENGE, codeNormalisieren, MAX_BELOHNT_PRO_TAG } from '../../../shared/netzwerkSchema.js';
import { lokalesDatum } from '../../../shared/tagesaufgaben.js';
import { duellSitzung } from '../../netz/duellSitzung.js';

function fehlerText(code) {
  if (String(code).startsWith('name_')) return t('fehlertexte.' + code);
  const text = t('online.fehler.' + code);
  return text.startsWith('⟦') ? t('online.fehler.unbekannt') : text;
}

/**
 * Öffnet den Online-Bildschirm über dem Hauptmenü.
 * @param {import('../../modi/hauptmenue.js').Hauptmenue} menue
 * @param {import('../../spiel.js').Spiel} spiel
 */
export function onlineOeffnen(menue, spiel) {
  document.querySelector('.online-bildschirm')?.remove();
  const sitzung = duellSitzung(spiel);
  const inhalt = h('div.online-inhalt');
  const statusZeile = h('div.online-status');
  const wurzel = h('div.bildschirm.wahl-bildschirm.battle-wahl.online-bildschirm',
    h('div.wahl-kopf',
      h('button.knopf.geist.klein', { onClick: () => schliessen(true) }, '← ' + t('allgemein.zurueck')),
      h('h2.titel', t('online.titel')),
      h('div.muenzen.menue-muenzen.wahl-muenzen', zahl(spiel.daten.waehrung))
    ),
    h('div.battle-wahl-inhalt', h('div.battle-wahl-panel', statusZeile, inhalt), h('div.battle-vorschau-info.online-vorschau'))
  );
  const vorschauInfo = wurzel.querySelector('.online-vorschau');
  if (menue?.ui) menue.ui.style.visibility = 'hidden';
  spiel.overlay.appendChild(wurzel);

  const ab = [];
  let vorschauSchluessel = null;

  function schliessen(lobbyVerlassen) {
    for (const aus of ab) aus();
    document.removeEventListener('keydown', tasten, true);
    wurzel.remove();
    if (menue?.ui) menue.ui.style.visibility = '';
    menue?.vorschau?.();
    if (lobbyVerlassen && sitzung.lobby) sitzung.verlassen();
  }
  function tasten(e) {
    if (e.code === 'Escape' && !document.querySelector('.dialog-hintergrund')) {
      e.preventDefault();
      schliessen(true);
    }
  }
  document.addEventListener('keydown', tasten, true);

  const statusZeigen = (text, art = '') => {
    statusZeile.textContent = text || '';
    statusZeile.dataset.art = art;
  };

  /** Startansicht: erstellen oder beitreten. */
  function startAnsicht() {
    leeren(inhalt);
    const feld = h('input.text-feld.code-eingabe', {
      type: 'text', maxLength: CODE_LAENGE, placeholder: 'ABC234', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'characters',
      'aria-label': t('online.codeEingeben')
    });
    feld.addEventListener('input', () => { feld.value = feld.value.toUpperCase(); });
    const beitreten = () => {
      const c = codeNormalisieren(feld.value);
      if (!c) { statusZeigen(t('online.fehler.code_ungueltig'), 'fehler'); return; }
      statusZeigen(t('online.tritt_bei'));
      sitzung.senden({ t: 'beitreten', code: c });
    };
    feld.addEventListener('keydown', (e) => { if (e.key === 'Enter') beitreten(); });
    const o = spiel.daten.online;
    const heute = o.datum === lokalesDatum() ? o.belohnt : 0;
    inhalt.append(
      h('section.battle-abschnitt',
        h('h3', t('online.erstellenTitel')),
        h('p.online-text', t('online.erstellenText')),
        h('button.knopf.haupt', { onClick: () => { statusZeigen(''); sitzung.senden({ t: 'duellErstellen' }); } }, t('online.erstellen'))
      ),
      h('section.battle-abschnitt',
        h('h3', t('online.beitretenTitel')),
        h('div.code-zeile', feld, h('button.knopf.akzent', { onClick: beitreten }, t('online.beitreten')))
      ),
      h('div.battle-hinweis', t('online.limit', { n: Math.max(0, MAX_BELOHNT_PRO_TAG - heute), von: MAX_BELOHNT_PRO_TAG }))
    );
    setTimeout(() => feld.focus({ preventScroll: true }), 30);
  }

  /** Spielerkarte in der Lobby. */
  const karte = (p, du, seite) => {
    if (!p) return h('div.spieler-karte.leer', t('online.wartetAufGegner'));
    const a = autoDaten(p.autoId);
    return h('button.spieler-karte' + (p.bereit ? '.bereit' : '') + (p.weg ? '.weg' : ''), {
      title: t('online.vorschauHinweis'),
      onClick: () => vorschauSetzen(p, seite, true)
    },
      h('span.spieler-name', p.name, du ? h('small', ' ' + t('online.du')) : null),
      h('span.spieler-auto', `${a.name} · ${piKlasse(p.pi)} ${p.pi}`),
      h('span.spieler-status', p.weg ? t('online.verbindungWeg') : p.bereit ? '✓ ' + t('online.bereit') : t('online.nichtBereit'))
    );
  };

  async function vorschauSetzen(p, seite, erzwingen = false) {
    const schl = seite + p.look;
    if (!erzwingen && vorschauSchluessel === schl) return;
    vorschauSchluessel = schl;
    const look = await sitzung.lookLesen(p.look, p.autoId);
    menue?.vorschau?.(p.autoId, look);
    leeren(vorschauInfo);
    vorschauInfo.append(
      h('div.battle-vorschau-rang', `${piKlasse(p.pi)} ${p.pi}`),
      h('div.battle-vorschau-name', p.name),
      h('div.battle-vorschau-auto', autoDaten(p.autoId).name)
    );
  }

  /** Lobby-Ansicht aus dem Status des Servers. */
  function lobbyAnsicht(n) {
    leeren(inhalt);
    statusZeigen('');
    const gastgeber = n.seite === 'A';
    const ich = n[n.seite];
    const gegner = n[n.seite === 'A' ? 'B' : 'A'];
    const emotes = h('div.emote-reihe', EMOTES.map((id) => h('button.knopf.geist.klein', { onClick: () => sitzung.senden({ t: 'emote', id }) }, t('online.emote.' + id))));
    const abschnitte = [
      gegner ? null : h('section.battle-abschnitt.code-anzeige',
        h('h3', t('online.deinCode')),
        h('div.code-gross.zahl', n.code),
        h('div.ebenen-aktionen',
          h('button.knopf.akzent.klein', {
            onClick: async () => {
              const ok = await inZwischenablage(n.code);
              toast(ok ? t('allgemein.kopiert') : t('allgemein.fehlerKopieren'), { art: ok ? 'erfolg' : 'warnung' });
            }
          }, t('allgemein.kopieren'))
        ),
        h('p.online-text', t('online.codeHinweis'))
      ),
      h('section.battle-abschnitt', h('div.spieler-reihe', karte(n.A, n.seite === 'A', 'A'), karte(n.B, n.seite === 'B', 'B'))),
      h('section.battle-abschnitt',
        h('h3', t('online.strecke')),
        gastgeber
          ? auswahl(n.strecken.map((s) => [s, streckenDef(s).name]), n.streckeId, (w) => sitzung.senden({ t: 'einstellungen', streckeId: w }))
          : h('div.online-wert', streckenDef(n.streckeId).name)
      ),
      h('section.battle-abschnitt',
        h('h3', t('battleWahl.format')),
        gastgeber
          ? auswahl(['schnell', 'bo3'].map((f) => [f, t('battle.format.' + f)]), n.format, (w) => sitzung.senden({ t: 'einstellungen', format: w }))
          : h('div.online-wert', t('battle.format.' + n.format))
      ),
      zeile(t('online.einheit'), gastgeber
        ? schalter(n.einheit, (w) => sitzung.senden({ t: 'einstellungen', einheit: w }))
        : h('span.online-wert', t(n.einheit ? 'allgemein.an' : 'allgemein.aus')), t('online.einheitHinweis')),
      gegner ? h('button.knopf.' + (ich.bereit ? 'geist' : 'haupt') + '.online-bereit', {
        onClick: () => sitzung.senden({ t: 'bereit', an: !ich.bereit })
      }, ich.bereit ? t('online.nichtMehrBereit') : t('online.binBereit')) : null,
      gegner ? h('section.battle-abschnitt', h('h3', t('online.emotes')), emotes) : null
    ];
    inhalt.append(...abschnitte.filter(Boolean));
    if (gegner) vorschauSetzen(gegner, 'gegner');
    else if (ich) vorschauSetzen(ich, 'ich');
  }

  ab.push(
    sitzung.netz.an('lobbyStatus', (n) => lobbyAnsicht(n)),
    sitzung.netz.an('fehler', (n) => {
      if (n.code === 'token_ungueltig') return;
      statusZeigen(fehlerText(n.code), 'fehler');
    }),
    sitzung.netz.an('lobbyEnde', (n) => {
      toast(t('online.lobbyEnde.' + n.grund), { art: 'warnung', dauer: 5000 });
      vorschauSchluessel = null;
      menue?.vorschau?.();
      leeren(vorschauInfo);
      startAnsicht();
    }),
    sitzung.netz.an('emote', (n) => {
      toast(t('online.emoteVon', { name: sitzung.lobby?.[n.von]?.name ?? '', text: t('online.emote.' + n.id) }), { dauer: 2200 });
    }),
    sitzung.netz.an('duellStart', async (n) => {
      schliessen(false);
      const { OnlineDuell } = await import('../../modi/onlineDuell.js');
      const { aktivesAutoKonfig } = await import('../../spielerDaten.js');
      const gegnerLook = await sitzung.lookLesen(n.gegner.look, n.gegner.autoId);
      spiel.wechsleModus(new OnlineDuell({
        streckeId: n.streckeId,
        format: n.format,
        einheitsPI: n.einheitsPI,
        seite: n.seite,
        gegner: { ...n.gegner, look: gegnerLook },
        spieler: aktivesAutoKonfig(spiel.daten),
        autopilot: spiel.testAutopilot ?? undefined
      }));
    }),
    spiel.ereignisse.an('netzStatus', (s) => {
      if (s === 'aufwachen') statusZeigen(t('online.aufwachen'));
      if (s === 'verbinde') statusZeigen(t('online.verbinde'));
    })
  );

  // Verbinden und anmelden
  (async () => {
    if (sitzung.lobby && sitzung.netz.verbunden) {
      lobbyAnsicht(sitzung.lobby);
      return;
    }
    statusZeigen(t('online.verbinde'));
    const f = await sitzung.anmelden();
    if (!wurzel.isConnected) return;
    if (f) {
      statusZeigen(fehlerText(f), 'fehler');
      inhalt.append(h('button.knopf', {
        onClick: () => {
          schliessen(false);
          onlineOeffnen(menue, spiel);
        }
      }, t('online.nochmal')));
      return;
    }
    statusZeigen('');
    startAnsicht();
  })();
  return { schliessen };
}
