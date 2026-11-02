// Reiter „Aufkleber“: Ebenen-Liste, Bibliothek, Text-Aufkleber und Bearbeiten der gewählten Ebene:
// Zone, Position (Ziehen in der Zonen-Vorschau), Größe, Drehung, Farbe, Deckkraft, Spiegeln, Reihenfolge,
// Duplizieren, Löschen, Gruppen und „Auf andere Seite spiegeln“.
import { h, dialog, toast } from '../dom.js';
import { t, zahl } from '../../i18n/de.js';
import { AUFKLEBER, aufkleberDaten, aufkleberKaufId } from '../../assets/aufkleber.js';
import { AUFKLEBER_PAKETE } from '../../../shared/teile.js';
import { ZONEN, SCHRIFTEN, MAX_AUFKLEBER } from '../../../shared/look.js';
import { pruefeAufkleberText } from '../../../shared/wortfilter.js';
import * as ops from '../../../shared/aufkleberOps.js';
import { ATLAS } from '../../render/auto/liveryAtlas.js';
import { farbFeld } from '../farbwaehler.js';
import { schieber, zeile, auswahl } from '../bausteine.js';
import { abschnitt } from './garageUi.js';

const SVG = 'http://www.w3.org/2000/svg';

/** Vorschau eines Aufklebers als kleine SVG-Grafik (zeichnet dieselben Pfad-Daten wie die Livery). */
export function aufkleberBild(id, farbe = 'currentColor') {
  const d = aufkleberDaten(id);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('aufkleber-bild');
  if (!d) return svg;
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', d.pfad);
  p.setAttribute('fill', farbe);
  if (d.regel === 'evenodd') p.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(p);
  if (d.text) {
    const w = document.createElementNS(SVG, 'text');
    w.setAttribute('x', '50');
    w.setAttribute('y', String(d.text.y));
    w.setAttribute('text-anchor', 'middle');
    w.setAttribute('dominant-baseline', 'middle');
    w.setAttribute('font-size', String(d.text.groesse));
    w.setAttribute('fill', farbe);
    w.setAttribute('font-family', SCHRIFTEN.find((s) => s.id === d.text.schrift)?.css.replace(/"/g, '') ?? '');
    w.textContent = d.text.wort;
    svg.appendChild(w);
  }
  return svg;
}

function ebenenName(a) {
  if (a.id === 'text') return '„' + a.text + '“';
  return aufkleberDaten(a.id)?.name ?? a.id;
}

/** Dialog für einen neuen oder geänderten Text-Aufkleber. @returns {Promise<{text,schrift}|null>} */
async function textDialog(start = { text: '', schrift: SCHRIFTEN[0].id }) {
  const fehler = h('div.einst-fehler');
  const eingabe = h('input.text-feld', { type: 'text', maxLength: 16, value: start.text, autocomplete: 'off', spellcheck: 'false', 'aria-label': t('garage.aufkleber.text') });
  let schrift = start.schrift;
  const vorschau = h('div.text-vorschau', start.text || t('garage.aufkleber.textBeispiel'));
  const schriftSetzen = (id) => {
    schrift = id;
    vorschau.style.fontFamily = SCHRIFTEN.find((s) => s.id === id).css;
  };
  schriftSetzen(schrift);
  eingabe.addEventListener('input', () => {
    vorschau.textContent = eingabe.value || t('garage.aufkleber.textBeispiel');
    fehler.textContent = '';
  });
  const ergebnis = await dialog({
    titel: t('garage.aufkleber.textTitel'),
    inhalt: h('div.text-dialog', eingabe, vorschau, auswahl(SCHRIFTEN.map((s) => [s.id, s.name]), schrift, schriftSetzen), fehler),
    knoepfe: [
      { text: t('allgemein.abbrechen'), art: 'geist', wert: null },
      {
        text: t('allgemein.ok'),
        art: 'haupt',
        aktion: () => {
          const f = pruefeAufkleberText(eingabe.value);
          if (f) {
            fehler.textContent = t('fehlertexte.' + f);
            return false;
          }
          return true;
        },
        wert: 'ok'
      }
    ]
  });
  return ergebnis === 'ok' ? { text: eingabe.value.trim(), schrift } : null;
}

/** Bibliothek mit Kategorien; ein Klick setzt den Aufkleber als neue Ebene (Anprobe, falls ungekauft). */
function bibliothek(g, ui, schliessen) {
  const pakete = AUFKLEBER_PAKETE.filter((p) => p.id !== 'text');
  let aktiv = ui.aufkleberPaket || pakete[0].id;
  const raster = h('div.aufkleber-raster');
  const leiste = h('div.auswahl-gruppe.paket-leiste');
  const zeichnen = () => {
    raster.replaceChildren();
    const info = g.preisInfo('aufkleber:' + aktiv);
    for (const a of AUFKLEBER.filter((x) => x.paket === aktiv)) {
      raster.appendChild(h('button.aufkleber-knopf', {
        title: a.name,
        'aria-label': a.name,
        onClick: () => {
          let i = -1;
          g.aendern((x) => { i = ops.hinzufuegen(x.aufkleber, ops.neuerAufkleber(a.id, ui.aufkleberZone || 'seiteL')); });
          if (i < 0) { toast(t('garage.aufkleber.voll', { n: MAX_AUFKLEBER }), { art: 'warnung' }); return; }
          g.auswahl = i;
          g._schmutzig = true;
          schliessen();
        }
      }, aufkleberBild(a.id)));
    }
    preis.textContent = info.besitz ? t('garage.aufkleber.paketBesitz') : t('garage.aufkleber.paketPreis', { preis: zahl(info.preis) });
  };
  const preis = h('div.battle-hinweis');
  for (const p of pakete) {
    leiste.appendChild(h('button.auswahl-knopf' + (p.id === aktiv ? '.aktiv' : ''), {
      onClick: (e) => {
        aktiv = p.id;
        ui.aufkleberPaket = p.id;
        leiste.querySelectorAll('.auswahl-knopf').forEach((k) => k.classList.remove('aktiv'));
        e.currentTarget.classList.add('aktiv');
        zeichnen();
      }
    }, p.name));
  }
  zeichnen();
  return h('div.aufkleber-bibliothek',
    h('div.bibliothek-kopf', h('h3', t('garage.aufkleber.bibliothek')), h('button.knopf.geist.klein', { onClick: schliessen }, t('allgemein.schliessen'))),
    leiste,
    preis,
    raster
  );
}

/** Vorschau der Zone: zeigt den Ausschnitt der Livery, Ziehen verschiebt die gewählte Ebene. */
function zonenVorschau(g, ui, a) {
  const z = ATLAS[a.zone];
  const masse = g.modell.k.zonen[a.zone];
  const bw = 320;
  const bh = Math.round(bw * Math.min(1, masse.h / masse.b));
  const canvas = h('canvas.zonen-vorschau', { width: bw, height: bh, 'aria-label': t('garage.aufkleber.vorschau') });
  const ctx = canvas.getContext('2d');
  const zeichnen = () => {
    const src = g.modell.livery.canvas;
    const G = src.width;
    ctx.drawImage(src, z.x * G, z.y * G, z.b * G, z.h * G, 0, 0, bw, bh);
  };
  zeichnen();
  ui.nachLookRueckruf = zeichnen;
  let letzte = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const b = canvas.getBoundingClientRect();
    letzte = { x: e.clientX, y: e.clientY };
    // Ein Tippen setzt die Ebene direkt an diese Stelle
    const nx = (e.clientX - b.left) / b.width, ny = (e.clientY - b.top) / b.height;
    g.aendern((l) => { const q = l.aufkleber[g.auswahl]; ops.verschieben(l.aufkleber, g.auswahl, nx - q.x, ny - q.y); }, 'aufkleberZiehen');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!letzte) return;
    const b = canvas.getBoundingClientRect();
    const dx = (e.clientX - letzte.x) / b.width, dy = (e.clientY - letzte.y) / b.height;
    letzte = { x: e.clientX, y: e.clientY };
    g.aendern((l) => ops.verschieben(l.aufkleber, g.auswahl, dx, dy), 'aufkleberZiehen');
  });
  const ende = () => {
    if (!letzte) return;
    letzte = null;
    ui.neuZeichnen();
  };
  canvas.addEventListener('pointerup', ende);
  canvas.addEventListener('pointercancel', ende);
  return h('div.zonen-vorschau-box', canvas, h('div.einst-hinweis', t('garage.aufkleber.ziehen')));
}

export function reiterAufkleber(g, wurzel, ui) {
  const l = g.look;
  const liste = l.aufkleber;
  const waehlen = (i, kamera = true) => {
    g.auswahl = i;
    g._schmutzig = true;
    if (kamera && liste[i]) { g.zonenAnsicht(liste[i].zone); ui.aufkleberZone = liste[i].zone; }
    ui.neuZeichnen();
  };
  const aendern = (fn, gruppe) => g.aendern((x) => fn(x.aufkleber[g.auswahl], x), gruppe);

  if (ui.bibliothekOffen) {
    wurzel.appendChild(bibliothek(g, ui, () => {
      ui.bibliothekOffen = false;
      ui.neuZeichnen();
      if (liste[g.auswahl]) g.zonenAnsicht(liste[g.auswahl].zone);
    }));
    return;
  }

  // Kopf: Zähler und neue Ebenen
  wurzel.appendChild(abschnitt(null,
    h('div.ebenen-kopf',
      h('div.ebenen-zaehler.zahl', t('garage.aufkleber.zaehler', { n: liste.length, max: MAX_AUFKLEBER })),
      h('button.knopf.akzent.klein', { dataset: { fokus: 'neu' }, disabled: liste.length >= MAX_AUFKLEBER, onClick: () => { ui.bibliothekOffen = true; ui.neuZeichnen(); } }, '+ ' + t('garage.aufkleber.neu')),
      h('button.knopf.klein', {
        disabled: liste.length >= MAX_AUFKLEBER,
        onClick: async () => {
          const e = await textDialog();
          if (!e) return;
          let i = -1;
          g.aendern((x) => { i = ops.hinzufuegen(x.aufkleber, ops.neuerAufkleber('text', ui.aufkleberZone || 'seiteL', e)); });
          if (i >= 0) waehlen(i);
        }
      }, '+ ' + t('garage.aufkleber.neuText'))
    ),
    g.preisInfo('aufkleber:text').besitz ? null : h('div.einst-hinweis', t('garage.aufkleber.textPreis', { preis: zahl(g.preisInfo('aufkleber:text').preis) }))
  ));

  // Bearbeiten der gewählten Ebene
  const a = liste[g.auswahl];
  if (a) {
    const info = g.preisInfo(aufkleberKaufId(a.id));
    const gruppiert = a.gruppe !== undefined;
    wurzel.appendChild(abschnitt(t('garage.aufkleber.bearbeiten', { name: ebenenName(a) }),
      info.besitz ? null : h('div.einst-hinweis', t('garage.aufkleber.anprobe', { preis: zahl(info.preis) })),
      auswahl(ZONEN.map((z) => [z, t('garage.zone.' + z)]), a.zone, (z) => {
        aendern((q) => { q.zone = z; });
        ui.aufkleberZone = z;
        g.zonenAnsicht(z);
        ui.neuZeichnen();
      }),
      zonenVorschau(g, ui, a),
      farbFeld(t('garage.aufkleber.farbe'), a.farbe, (f) => aendern((q) => { q.farbe = f; }, 'aufkleberFarbe')),
      zeile(t('garage.aufkleber.groesse'), schieber(a.skala, 0.05, 3, 0.01, (w) => aendern((q) => { q.skala = w; }, 'aufkleberSkala'), (x) => x.toFixed(2))),
      zeile(t('garage.aufkleber.drehung'), schieber(a.rot, -180, 180, 1, (w) => aendern((q) => { q.rot = w; }, 'aufkleberRot'), (x) => x + '°')),
      zeile(t('garage.aufkleber.deckkraft'), schieber(Math.round(a.deckkraft * 100), 5, 100, 1, (w) => aendern((q) => { q.deckkraft = w / 100; }, 'aufkleberDeckkraft'), (x) => x + ' %')),
      h('div.ebenen-aktionen',
        a.id === 'text' ? h('button.knopf.klein', {
          onClick: async () => {
            const e = await textDialog({ text: a.text, schrift: a.schrift });
            if (e) { aendern((q) => { q.text = e.text; q.schrift = e.schrift; }); ui.neuZeichnen(); }
          }
        }, t('garage.aufkleber.textAendern')) : null,
        h('button.knopf.klein', { onClick: () => aendern((q) => { q.spiegel = !q.spiegel; }) }, t('garage.aufkleber.spiegeln')),
        h('button.knopf.klein', {
          disabled: liste.length >= MAX_AUFKLEBER,
          onClick: () => {
            let i = -1;
            g.aendern((x) => { i = ops.aufAndereSeite(x.aufkleber, g.auswahl); });
            if (i >= 0) waehlen(i);
          }
        }, t('garage.aufkleber.andereSeite')),
        h('button.knopf.klein', {
          disabled: liste.length >= MAX_AUFKLEBER,
          onClick: () => {
            let i = -1;
            g.aendern((x) => { i = ops.duplizieren(x.aufkleber, g.auswahl); });
            if (i >= 0) waehlen(i, false);
          }
        }, t('garage.aufkleber.duplizieren')),
        h('button.knopf.klein', {
          onClick: () => {
            if (gruppiert) g.aendern((x) => ops.gruppeLoesen(x.aufkleber, g.auswahl));
            else ui.gruppenAuswahl = ui.gruppenAuswahl ? null : new Set([g.auswahl]);
            ui.neuZeichnen();
          }
        }, gruppiert ? t('garage.aufkleber.gruppeLoesen') : ui.gruppenAuswahl ? t('allgemein.abbrechen') : t('garage.aufkleber.gruppieren')),
        h('button.knopf.gefahr.klein', {
          onClick: () => {
            let i = -1;
            g.aendern((x) => { i = ops.loeschen(x.aufkleber, g.auswahl); });
            ui.gruppenAuswahl = null;
            waehlen(i, false);
          }
        }, t('garage.aufkleber.loeschen'))
      ),
      ui.gruppenAuswahl ? h('div.gruppen-hinweis',
        h('span', t('garage.aufkleber.gruppenHinweis', { n: ui.gruppenAuswahl.size })),
        h('button.knopf.akzent.klein', {
          disabled: ui.gruppenAuswahl.size < 2,
          onClick: () => {
            const ids = [...ui.gruppenAuswahl];
            g.aendern((x) => ops.gruppeSetzen(x.aufkleber, ids));
            ui.gruppenAuswahl = null;
            ui.neuZeichnen();
          }
        }, t('garage.aufkleber.gruppeBilden'))
      ) : null
    ));
  }

  // Ebenen-Liste (oberste Ebene zuerst)
  const reihen = [];
  for (let i = liste.length - 1; i >= 0; i--) {
    const e = liste[i];
    reihen.push(h('div.ebene' + (i === g.auswahl ? '.aktiv' : ''),
      h('button.ebene-wahl', {
        dataset: { fokus: 'ebene' + i },
        'aria-pressed': i === g.auswahl ? 'true' : 'false',
        onClick: () => {
          if (ui.gruppenAuswahl) {
            if (ui.gruppenAuswahl.has(i)) ui.gruppenAuswahl.delete(i);
            else ui.gruppenAuswahl.add(i);
            ui.neuZeichnen();
          } else {
            waehlen(i);
          }
        }
      },
        ui.gruppenAuswahl ? h('span.ebene-haken', ui.gruppenAuswahl.has(i) ? '☑' : '☐') : null,
        e.id === 'text' ? h('span.ebene-textbild', { style: { color: e.farbe } }, 'T') : aufkleberBild(e.id, e.farbe),
        h('span.ebene-text', h('span.ebene-name', ebenenName(e)), h('small', t('garage.zone.' + e.zone) + (e.gruppe !== undefined ? ' · ' + t('garage.aufkleber.gruppe', { n: e.gruppe + 1 }) : '')))
      ),
      h('button.ebene-pfeil', { 'aria-label': t('garage.aufkleber.hoch'), disabled: i === liste.length - 1, onClick: () => { let n = i; g.aendern((x) => { n = ops.ebeneVerschieben(x.aufkleber, i, 1); }); g.auswahl = n; ui.neuZeichnen(); } }, '▲'),
      h('button.ebene-pfeil', { 'aria-label': t('garage.aufkleber.runter'), disabled: i === 0, onClick: () => { let n = i; g.aendern((x) => { n = ops.ebeneVerschieben(x.aufkleber, i, -1); }); g.auswahl = n; ui.neuZeichnen(); } }, '▼')
    ));
  }
  wurzel.appendChild(abschnitt(t('garage.aufkleber.ebenen'),
    reihen.length ? h('div.ebenen-liste', reihen) : h('div.einst-hinweis', t('garage.aufkleber.leer'))
  ));
}
