// Einstellungen: Grafik, Audio, Steuerung (inkl. Tastenbelegung, Layout-Editor), Kamera, Assistenz,
// Barrierefreiheit, Spieler, Spielstand (Export/Import, Zurücksetzen mit doppelter Sicherheitsabfrage).
import { h, leeren, dialog, bestaetigen, toast, inZwischenablage } from '../dom.js';
import { t } from '../../i18n/de.js';
import { STANDARD_TASTEN, STANDARD_GAMEPAD } from '../../../shared/spielstand.js';
import { pruefeName } from '../../../shared/wortfilter.js';
import { Neigung } from '../../eingabe/neigung.js';
import { KAMERA_MODI } from '../../render/kamera.js';
import { istTouchGeraet } from '../../core/geraet.js';

const REITER = ['grafik', 'audio', 'steuerung', 'assistenz', 'zugang', 'spieler', 'spielstand'];

function schieber(wert, min, max, schritt, beiAenderung, format = (x) => String(x)) {
  const anzeige = h('span.schieber-wert.zahl', format(wert));
  const eingabe = h('input', { type: 'range', min, max, step: schritt, value: wert });
  eingabe.addEventListener('input', () => {
    const w = Number(eingabe.value);
    anzeige.textContent = format(w);
    beiAenderung(w);
  });
  return h('div.schieber', eingabe, anzeige);
}

function auswahl(optionen, aktuell, beiAenderung) {
  const gruppe = h('div.auswahl-gruppe', { role: 'radiogroup' });
  for (const [wert, text] of optionen) {
    const k = h('button.auswahl-knopf' + (wert === aktuell ? '.aktiv' : ''), {
      role: 'radio',
      'aria-checked': wert === aktuell ? 'true' : 'false',
      onClick: () => {
        gruppe.querySelectorAll('.auswahl-knopf').forEach((b) => { b.classList.remove('aktiv'); b.setAttribute('aria-checked', 'false'); });
        k.classList.add('aktiv');
        k.setAttribute('aria-checked', 'true');
        beiAenderung(wert);
      }
    }, text);
    gruppe.appendChild(k);
  }
  return gruppe;
}

function schalter(an, beiAenderung) {
  const k = h('button.schalter' + (an ? '.an' : ''), { role: 'switch', 'aria-checked': an ? 'true' : 'false' }, h('span'));
  k.addEventListener('click', () => {
    const neu = !k.classList.contains('an');
    k.classList.toggle('an', neu);
    k.setAttribute('aria-checked', neu ? 'true' : 'false');
    beiAenderung(neu);
  });
  return k;
}

function zeile(titel, steuerung, hinweis) {
  return h('div.einst-zeile', h('div.einst-text', h('div.einst-titel', titel), hinweis ? h('div.einst-hinweis', hinweis) : null), h('div.einst-steuerung', steuerung));
}

/**
 * Zeigt die Einstellungen als Overlay. Liefert ein Promise, das beim Schließen erfüllt wird.
 */
export function einstellungenZeigen(spiel, { imRennen = false, reiter = 'grafik' } = {}) {
  return new Promise((aufloesen) => {
    const d = spiel.daten;
    const e = d.einstellungen;
    const aendern = () => {
      spiel.einstellungenAnwenden();
      spiel.speicher.speichern();
    };
    const inhalt = h('div.einst-inhalt');
    const leiste = h('div.einst-reiter', { role: 'tablist' });
    const wurzel = h('div.bildschirm.mit-hintergrund.einstellungen-bildschirm',
      h('div.wahl-kopf', h('button.knopf.geist.klein', { onClick: () => schliessen() }, '← ' + t('allgemein.zurueck')), h('h2.titel', t('einst.titel'))),
      leiste,
      inhalt
    );
    function schliessen() {
      document.removeEventListener('keydown', tasten, true);
      wurzel.remove();
      spiel.speicher.sofortSpeichern();
      aufloesen();
    }
    function tasten(ev) {
      if (ev.code === 'Escape' && !wurzel.querySelector('.warte-taste')) {
        ev.preventDefault();
        ev.stopPropagation();
        schliessen();
      }
    }

    const reiterBauen = {
      grafik: () => [
        zeile(t('einst.qualitaet'), auswahl([['auto', t('einst.auto')], ['niedrig', t('einst.niedrig')], ['mittel', t('einst.mittel')], ['hoch', t('einst.hoch')]], e.grafik.qualitaet, (w) => { e.grafik.qualitaet = w; aendern(); }), t('einst.qualitaetHinweis')),
        zeile(t('einst.kamera'), auswahl(KAMERA_MODI.map((m) => [m, t('kamera.' + m)]), e.kamera, (w) => { e.kamera = w; aendern(); })),
        zeile(t('einst.fps'), schalter(e.anzeige.fps, (w) => { e.anzeige.fps = w; aendern(); })),
        zeile(t('einst.namensTag'), schalter(e.anzeige.namensTag, (w) => { e.anzeige.namensTag = w; aendern(); }))
      ],
      audio: () => [
        zeile(t('einst.master'), schieber(Math.round(e.audio.master * 100), 0, 100, 1, (w) => { e.audio.master = w / 100; aendern(); }, (x) => x + ' %')),
        zeile(t('einst.effekte'), schieber(Math.round(e.audio.effekte * 100), 0, 100, 1, (w) => { e.audio.effekte = w / 100; aendern(); }, (x) => x + ' %')),
        zeile(t('einst.musik'), schieber(Math.round(e.audio.musik * 100), 0, 100, 1, (w) => { e.audio.musik = w / 100; aendern(); }, (x) => x + ' %')),
        zeile(t('einst.musikAn'), schalter(e.audio.musikAn, (w) => { e.audio.musikAn = w; aendern(); }))
      ],
      steuerung: () => {
        const s = e.steuerung;
        const teile = [
          h('h3.einst-gruppe', t('einst.touch')),
          zeile(t('einst.touchModus'), auswahl([['tasten', t('einst.tasten')], ['lenkrad', t('einst.lenkrad')], ['neigung', t('einst.neigung')]], s.touchModus, async (w) => {
            if (w === 'neigung') {
              const r = await spiel.eingabe.neigung.aktivieren();
              if (r !== 'ok') {
                toast(r === 'unsicher' ? t('eingabe.neigungUnsicher') : t('eingabe.neigungVerweigert'), { art: 'warnung' });
                s.touchModus = 'tasten';
                aendern();
                zeigen('steuerung');
                return;
              }
              spiel.eingabe.neigung.kalibrieren();
            }
            s.touchModus = w;
            aendern();
          }), istTouchGeraet ? null : t('einst.touchHinweis')),
          s.touchModus === 'neigung' ? zeile(t('einst.neigungEmpfindlichkeit'), schieber(Math.round(s.neigungEmpfindlichkeit * 100), 0, 100, 5, (w) => { s.neigungEmpfindlichkeit = w / 100; aendern(); }, (x) => x + ' %')) : null,
          s.touchModus === 'neigung' ? zeile(t('einst.kalibrieren'), h('button.knopf.klein', { onClick: () => { spiel.eingabe.neigung.kalibrieren(); toast(t('einst.kalibriert'), { art: 'erfolg', dauer: 1500 }); } }, t('einst.kalibrieren'))) : null,
          zeile(t('einst.transparenz'), schieber(Math.round(s.transparenz * 100), 20, 100, 5, (w) => { s.transparenz = w / 100; aendern(); }, (x) => x + ' %')),
          zeile(t('einst.linkshaender'), schalter(s.linkshaender, (w) => { s.linkshaender = w; aendern(); })),
          zeile(t('einst.kupplungsKnopf'), schalter(s.kupplungsButton, (w) => { s.kupplungsButton = w; aendern(); })),
          zeile(t('einst.vibration'), schalter(s.vibration, (w) => { s.vibration = w; aendern(); }), t('einst.vibrationHinweis')),
          zeile(t('einst.layout'), h('button.knopf.klein', {
            onClick: async () => {
              const { layoutEditor } = await import('./layoutEditor.js');
              wurzel.style.display = 'none';
              await layoutEditor(spiel);
              wurzel.style.display = '';
            }
          }, t('einst.layoutBearbeiten'))),
          h('h3.einst-gruppe', t('einst.pc')),
          zeile(t('einst.getriebe'), auswahl([['auto', t('einst.automatik')], ['manuell', t('einst.manuell')]], e.getriebe, (w) => { e.getriebe = w; aendern(); }), t('einst.getriebeHinweis')),
          ...Object.keys(STANDARD_TASTEN).map((aktion) => tastenZeile(spiel, s, aktion, aendern)),
          zeile(t('einst.tastenStandard'), h('button.knopf.klein.geist', { onClick: () => { s.tasten = JSON.parse(JSON.stringify(STANDARD_TASTEN)); aendern(); zeigen('steuerung'); } }, t('einst.zuruecksetzen'))),
          h('h3.einst-gruppe', t('einst.gamepad')),
          zeile(t('einst.totzone'), schieber(Math.round(s.gamepadTotzone * 100), 0, 40, 1, (w) => { s.gamepadTotzone = w / 100; aendern(); }, (x) => x + ' %')),
          ...Object.keys(STANDARD_GAMEPAD).map((aktion) => gamepadZeile(spiel, s, aktion, aendern)),
          zeile(t('einst.gamepadStandard'), h('button.knopf.klein.geist', { onClick: () => { s.gamepad = { ...STANDARD_GAMEPAD }; aendern(); zeigen('steuerung'); } }, t('einst.zuruecksetzen')))
        ];
        return teile;
      },
      assistenz: () => [
        zeile(t('einst.gegenlenken'), schieber(e.assistenz.gegenlenken, 0, 100, 5, (w) => { e.assistenz.gegenlenken = w; aendern(); }, (x) => x + ' %'), t('einst.gegenlenkenHinweis')),
        zeile(t('einst.driftHalten'), auswahl([['auto', t('einst.nurTouch')], ['an', t('allgemein.an')], ['aus', t('allgemein.aus')]], e.assistenz.driftHaltenModus, (w) => { e.assistenz.driftHaltenModus = w; aendern(); }), t('einst.driftHaltenHinweis')),
        zeile(t('einst.driftHaltenStaerke'), schieber(e.assistenz.driftHalten, 0, 100, 5, (w) => { e.assistenz.driftHalten = w; aendern(); }, (x) => x + ' %'))
      ],
      zugang: () => [
        zeile(t('einst.schrift'), auswahl([[0, t('einst.klein')], [1, t('einst.normal')], [2, t('einst.gross')]], e.barrierefreiheit.schriftgroesse, (w) => { e.barrierefreiheit.schriftgroesse = w; aendern(); })),
        zeile(t('einst.farbenblind'), schalter(e.barrierefreiheit.farbenblind, (w) => { e.barrierefreiheit.farbenblind = w; aendern(); }), t('einst.farbenblindHinweis')),
        zeile(t('einst.reduziert'), schalter(e.barrierefreiheit.reduzierteEffekte, (w) => { e.barrierefreiheit.reduzierteEffekte = w; aendern(); }), t('einst.reduziertHinweis'))
      ],
      spieler: () => {
        const eingabe = h('input.text-eingabe', { type: 'text', maxlength: 16, value: d.spielerName, autocomplete: 'off' });
        const fehler = h('div.einst-fehler');
        const speichernKnopf = h('button.knopf.klein.akzent', {
          onClick: () => {
            const f = pruefeName(eingabe.value);
            if (f) { fehler.textContent = t('fehlertexte.' + f); return; }
            d.spielerName = eingabe.value.trim();
            fehler.textContent = '';
            aendern();
            toast(t('einst.nameGespeichert'), { art: 'erfolg', dauer: 1500 });
          }
        }, t('allgemein.speichern'));
        const teile = [zeile(t('einst.spielerName'), h('div.name-feld', eingabe, speichernKnopf, fehler), t('einst.spielerNameHinweis'))];
        if (spiel.tutorialStarten) {
          teile.push(zeile(t('einst.tutorial'), h('button.knopf.klein', { onClick: () => { schliessen(); spiel.tutorialStarten(); } }, t('einst.tutorialStarten'))));
        }
        return teile;
      },
      spielstand: () => [
        !spiel.speicher.verfuegbar ? h('div.einst-warnung', t('speicher.keinSpeicher')) : null,
        zeile(t('speicher.exportDatei'), h('button.knopf.klein', { onClick: () => spiel.speicher.exportDatei() }, t('einst.exportieren'))),
        zeile(t('speicher.exportCode'), h('button.knopf.klein', {
          onClick: async () => {
            const code = await spiel.speicher.exportCode();
            const feld = h('textarea', { readonly: true });
            feld.value = code;
            await dialog({
              titel: t('speicher.codeTitel'), text: t('speicher.codeHinweis'), inhalt: feld,
              knoepfe: [
                { text: t('allgemein.kopieren'), art: 'akzent', aktion: async () => { const ok = await inZwischenablage(code); toast(ok ? t('allgemein.kopiert') : t('allgemein.fehlerKopieren')); return false; } },
                { text: t('allgemein.schliessen'), art: 'geist', wert: true }
              ]
            });
          }
        }, t('einst.exportieren'))),
        zeile(t('speicher.importDatei'), h('button.knopf.klein', {
          onClick: () => {
            const datei = h('input', { type: 'file', accept: '.json,application/json' });
            datei.addEventListener('change', async () => {
              const f = datei.files && datei.files[0];
              if (!f) return;
              if (f.size > 2_000_000) { toast(t('speicher.importFehler', { grund: t('speicher.gruende.zu_gross') }), { art: 'fehler' }); return; }
              await importieren(await f.text());
            });
            datei.click();
          }
        }, t('einst.importieren'))),
        zeile(t('speicher.importCode'), h('button.knopf.klein', {
          onClick: async () => {
            const feld = h('textarea', { placeholder: 'D…' });
            const ok = await dialog({ titel: t('speicher.importCode'), text: t('speicher.codeEingeben'), inhalt: feld, knoepfe: [{ text: t('allgemein.abbrechen'), art: 'geist', wert: false }, { text: t('einst.importieren'), art: 'haupt', wert: true }] });
            if (ok) await importieren(feld.value);
          }
        }, t('einst.importieren'))),
        zeile(t('einst.reset'), h('button.knopf.klein.gefahr', {
          onClick: async () => {
            if (imRennen) { toast(t('einst.resetNichtImRennen'), { art: 'warnung' }); return; }
            if (!(await bestaetigen(t('einst.resetTitel'), t('einst.resetText1'), { jaText: t('einst.resetWeiter'), gefahr: true }))) return;
            if (!(await bestaetigen(t('einst.resetTitel2'), t('einst.resetText2'), { jaText: t('einst.resetEndgueltig'), gefahr: true }))) return;
            spiel.speicher.zuruecksetzen();
            spiel.einstellungenAnwenden();
            spiel.ereignisse.senden('spielstandGeaendert');
            toast(t('einst.resetFertig'), { art: 'erfolg' });
            schliessen();
            const { Hauptmenue } = await import('../../modi/hauptmenue.js');
            spiel.wechsleModus(new Hauptmenue());
          }
        }, t('einst.resetKnopf')), t('einst.resetHinweis'))
      ]
    };

    async function importieren(text) {
      if (imRennen) { toast(t('einst.resetNichtImRennen'), { art: 'warnung' }); return; }
      if (!(await bestaetigen(t('speicher.importCode'), t('speicher.importBestaetigen'), { gefahr: true }))) return;
      const r = await spiel.speicher.importieren(text);
      if (!r.ok) {
        toast(t('speicher.importFehler', { grund: t('speicher.gruende.' + r.fehler) }), { art: 'fehler', dauer: 6000 });
        return;
      }
      spiel.einstellungenAnwenden();
      spiel.ereignisse.senden('spielstandGeaendert');
      toast(t('speicher.importErfolg'), { art: 'erfolg' });
      zeigen('spielstand');
    }

    function zeigen(name) {
      leeren(leiste);
      for (const r of REITER) {
        leiste.appendChild(h('button.reiter-knopf' + (r === name ? '.aktiv' : ''), { role: 'tab', 'aria-selected': r === name ? 'true' : 'false', onClick: () => zeigen(r) }, t('einst.reiter.' + r)));
      }
      leeren(inhalt);
      inhalt.append(...reiterBauen[name]().filter(Boolean));
      inhalt.scrollTop = 0;
    }

    document.addEventListener('keydown', tasten, true);
    spiel.overlay.appendChild(wurzel);
    zeigen(reiter);
  });
}

function tastenText(code) {
  return String(code).replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '↑').replace('↑Up', '↑').replace('↑Down', '↓').replace('↑Left', '←').replace('↑Right', '→').replace('Space', t('einst.leertaste')).replace('ShiftLeft', 'Shift').replace('ShiftRight', 'Shift R').replace('Escape', 'Esc');
}

function tastenZeile(spiel, s, aktion, aendern) {
  const knopf = h('button.knopf.klein.tasten-knopf', (s.tasten[aktion] || []).map(tastenText).join(' / ') || '–');
  knopf.addEventListener('click', () => {
    knopf.textContent = t('einst.tasteDruecken');
    knopf.classList.add('warte-taste');
    const fang = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      document.removeEventListener('keydown', fang, true);
      knopf.classList.remove('warte-taste');
      if (ev.code !== 'Escape' || aktion === 'pause') {
        // Taste aus anderen Aktionen entfernen (keine Doppelbelegung)
        for (const a of Object.keys(s.tasten)) s.tasten[a] = s.tasten[a].filter((c) => c !== ev.code);
        const rest = (s.tasten[aktion] || []).slice(1).filter((c) => c !== ev.code);
        s.tasten[aktion] = [ev.code, ...rest].slice(0, 2);
        aendern();
      }
      knopf.textContent = (s.tasten[aktion] || []).map(tastenText).join(' / ') || '–';
    };
    document.addEventListener('keydown', fang, true);
  });
  return zeile(t('eingabe.' + aktion), knopf);
}

function gamepadZeile(spiel, s, aktion, aendern) {
  const knopf = h('button.knopf.klein.tasten-knopf', t('einst.gamepadTaste', { n: s.gamepad[aktion] }));
  knopf.addEventListener('click', () => {
    knopf.textContent = t('einst.gamepadDruecken');
    knopf.classList.add('warte-taste');
    const start = performance.now();
    const vorher = new Set();
    const p0 = navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p) : null;
    if (p0) p0.buttons.forEach((b, i) => { if (b.pressed) vorher.add(i); });
    const pruefen = () => {
      const p = navigator.getGamepads ? [...navigator.getGamepads()].find((x) => x) : null;
      if (p) {
        const i = p.buttons.findIndex((b, k) => b.pressed && !vorher.has(k) && k !== 6 && k !== 7);
        if (i >= 0) {
          s.gamepad[aktion] = i;
          aendern();
          knopf.classList.remove('warte-taste');
          knopf.textContent = t('einst.gamepadTaste', { n: i });
          return;
        }
      }
      if (performance.now() - start > 6000) {
        knopf.classList.remove('warte-taste');
        knopf.textContent = t('einst.gamepadTaste', { n: s.gamepad[aktion] });
        return;
      }
      requestAnimationFrame(pruefen);
    };
    requestAnimationFrame(pruefen);
  });
  return zeile(t('eingabe.' + aktion), knopf);
}

export { Neigung };
