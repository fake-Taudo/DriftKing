// Oberfläche des Shops: Kategorien, Suche, Filter (gekauft, leistbar, neu), Sortierung, Trefferliste und
// Detailbereich mit Kaufen, Verkaufen, Fahren und „In der Garage anpassen“.
import { h, leeren } from '../dom.js';
import { t, zahl } from '../../i18n/de.js';
import { AUTOS, autoDaten } from '../../../shared/autos.js';
import { FINISHS, MUSTER, FELGEN, AUFKLEBER_PAKETE, QUALM, EXTRAS, SLOTS, TUNING, STUFEN_NAMEN, teilInfo } from '../../../shared/teile.js';
import { besitzt, verkaufswert, autoVerkaufswert } from '../../../shared/oekonomie.js';
import { leistungsindex, piKlasse } from '../../../shared/leistungsindex.js';
import { AUFKLEBER } from '../../assets/aufkleber.js';
import { aufkleberBild } from '../garage/reiterAufkleber.js';
import { teileKaufen, teilVerkaufen, autoKaufenFlow, autoVerkaufenFlow } from '../kauf.js';

const KATEGORIEN = [
  { id: 'autos', symbol: '🚗', global: true },
  { id: 'lack', symbol: '🎨', art: 'finish', liste: FINISHS, reiter: 'lack', global: true },
  { id: 'muster', symbol: '▦', art: 'muster', liste: MUSTER, reiter: 'lack', global: true },
  { id: 'felgen', symbol: '◎', art: 'felge', liste: FELGEN, reiter: 'felgen', global: true },
  { id: 'bodykit', symbol: '▰', reiter: 'bodykit' },
  { id: 'aufkleber', symbol: '★', art: 'aufkleber', liste: AUFKLEBER_PAKETE, reiter: 'aufkleber', global: true },
  { id: 'qualm', symbol: '☁', art: 'qualm', liste: QUALM, reiter: 'details', global: true },
  { id: 'extras', symbol: '✦', art: 'extra', liste: EXTRAS, reiter: 'details', global: true },
  { id: 'tuning', symbol: '⚙', reiter: 'tuning' }
];

function gesehenLaden() {
  try {
    return new Set(JSON.parse(localStorage.getItem('driftkoenig.shopGesehen') || '[]'));
  } catch {
    return new Set();
  }
}
function gesehenSichern(s) {
  try {
    localStorage.setItem('driftkoenig.shopGesehen', JSON.stringify([...s]));
  } catch { /* privater Modus: nur für diese Sitzung */ }
}

export class ShopUi {
  constructor(shop, kategorie) {
    this.s = shop;
    this.spiel = shop.spiel;
    this.kategorie = KATEGORIEN.some((k) => k.id === kategorie) ? kategorie : 'autos';
    this.suche = '';
    this.filter = 'alle';
    this.sortierung = 'preisAuf';
    this.auswahl = null;
    this.gesehen = gesehenLaden();
    this.wurzel = h('div.garage.shop');
    this.spiel.uiWurzel.appendChild(this.wurzel);
    this._aufbauen();
  }

  get daten() {
    return this.spiel.daten;
  }

  _aufbauen() {
    const s = this.s;
    this.muenzen = h('div.muenzen.menue-muenzen', zahl(this.daten.waehrung));
    this.autoName = h('div.garage-auto-name');
    this.autoUnter = h('div.garage-pi.zahl');
    const autos = () => this.daten.autos;
    const wechsel = (r) => {
      const a = autos();
      const i = a.findIndex((x) => x.id === s.autoId);
      s.autoId = a[(Math.max(0, i) + r + a.length) % a.length].id;
      this.auswahl = null;
      s.autoZeigen(s.autoId);
      this.zeichnen();
    };
    this.wechsler = h('div.garage-auto',
      h('button.knopf.rund.geist.garage-rund', { 'aria-label': t('garage.autoVor'), onClick: () => wechsel(-1) }, '‹'),
      h('div.garage-auto-text', this.autoName, this.autoUnter),
      h('button.knopf.rund.geist.garage-rund', { 'aria-label': t('garage.autoNach'), onClick: () => wechsel(1) }, '›')
    );
    this.kopf = h('div.garage-kopf',
      h('button.knopf.geist.klein', { 'aria-label': t('allgemein.zurueck'), onClick: () => s.verlassenWunsch() }, '←', h('span.garage-zurueck-text', ' ' + t('allgemein.zurueck'))),
      this.wechsler,
      h('div.garage-kopf-rechts', this.muenzen)
    );
    this.leiste = h('div.garage-reiter', { role: 'tablist' }, KATEGORIEN.map((k) => h('button.garage-reiter-knopf', {
      role: 'tab',
      dataset: { reiter: k.id },
      onClick: () => {
        this.kategorie = k.id;
        this.auswahl = null;
        this.zeichnen();
        this.inhalt.scrollTop = 0;
      }
    }, h('span.reiter-symbol', k.symbol), h('span', t('shop.kategorie.' + k.id)))));

    this.suchFeld = h('input.text-feld.shop-suche', { type: 'search', placeholder: t('shop.suche'), 'aria-label': t('shop.suche'), autocomplete: 'off' });
    this.suchFeld.addEventListener('input', () => {
      this.suche = this.suchFeld.value;
      this.listeZeichnen();
    });
    this.filterZeile = h('div.shop-filter');
    this.inhalt = h('div.garage-inhalt.shop-liste');
    this.detail = h('div.shop-detail');
    this.panel = h('section.garage-panel.panel', h('div.shop-griff-platz'), this.leiste, h('div.shop-steuerung', this.suchFeld, this.filterZeile), this.inhalt, this.detail);
    this.wurzel.append(this.kopf, this.panel);
    this.zeichnen();
  }

  verdeckt() {
    const hoch = window.innerHeight > window.innerWidth;
    const r = this.panel.getBoundingClientRect();
    if (hoch) return { rechts: 0, unten: Math.max(0, window.innerHeight - r.top) };
    return { rechts: Math.max(0, window.innerWidth - r.left), unten: 0 };
  }

  kopfAktualisieren() {
    this.muenzen.textContent = zahl(this.daten.waehrung);
    const a = autoDaten(this.s.autoId);
    const eintrag = this.daten.autos.find((x) => x.id === this.s.autoId);
    this.autoName.textContent = a.name;
    const pi = leistungsindex(a.id, eintrag?.tuning);
    this.autoUnter.textContent = t('garage.pi', { klasse: piKlasse(pi), pi });
  }

  /** Alle Einträge der aktuellen Kategorie. */
  eintraege() {
    const k = KATEGORIEN.find((x) => x.id === this.kategorie);
    const autoId = this.s.autoId;
    if (k.id === 'autos') {
      return AUTOS.map((a) => ({ schluessel: 'auto:' + a.id, autoId: a.id, name: a.name, preis: a.preis, besitz: this.daten.autos.some((x) => x.id === a.id), unter: a.klasse }));
    }
    const teil = (kaufId, name, unter) => {
      const i = teilInfo(kaufId, autoId);
      return { schluessel: kaufId, kaufId, name: name ?? i.name, preis: i.preis, besitz: besitzt(this.daten, kaufId, autoId), unter };
    };
    if (k.id === 'bodykit') {
      return SLOTS.flatMap((s) => s.varianten.slice(1).map((v, i) => teil(`teil:${s.id}:${i + 1}`, v, s.name)));
    }
    if (k.id === 'tuning') {
      return TUNING.flatMap((x) => [2, 3, 4, 5].map((st) => teil(`tuning:${x.id}:${st}`, `${x.name}: ${STUFEN_NAMEN[st - 1]}`)));
    }
    return k.liste.filter((e) => e.preis > 0).map((e) => teil(`${k.art}:${e.id}`, e.name));
  }

  gefiltert() {
    const q = this.suche.trim().toLowerCase();
    let l = this.eintraege();
    if (q) l = l.filter((e) => e.name.toLowerCase().includes(q) || (e.unter || '').toLowerCase().includes(q));
    if (this.filter === 'gekauft') l = l.filter((e) => e.besitz);
    if (this.filter === 'leistbar') l = l.filter((e) => !e.besitz && e.preis <= this.daten.waehrung);
    if (this.filter === 'neu') l = l.filter((e) => !e.besitz && !this.gesehen.has(e.schluessel));
    const sortieren = {
      preisAuf: (a, b) => a.preis - b.preis,
      preisAb: (a, b) => b.preis - a.preis,
      name: (a, b) => a.name.localeCompare(b.name, 'de')
    };
    return l.sort(sortieren[this.sortierung]);
  }

  zeichnen() {
    for (const k of this.leiste.children) {
      const an = k.dataset.reiter === this.kategorie;
      k.classList.toggle('aktiv', an);
      k.setAttribute('aria-selected', an ? 'true' : 'false');
      if (an) k.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    }
    const k = KATEGORIEN.find((x) => x.id === this.kategorie);
    this.wechsler.style.visibility = k.global && k.id !== 'autos' ? 'hidden' : 'visible';
    if (k.id === 'autos') this.wechsler.style.visibility = 'hidden';
    leeren(this.filterZeile);
    this.filterZeile.append(
      h('div.auswahl-gruppe.shop-chips', ['alle', 'gekauft', 'leistbar', 'neu'].map((f) => h('button.auswahl-knopf' + (this.filter === f ? '.aktiv' : ''), {
        'aria-pressed': this.filter === f ? 'true' : 'false',
        onClick: () => { this.filter = f; this.zeichnen(); }
      }, t('shop.filter.' + f)))),
      h('select.shop-sortierung', {
        'aria-label': t('shop.sortierung'),
        onChange: (e) => { this.sortierung = e.target.value; this.listeZeichnen(); }
      }, ['preisAuf', 'preisAb', 'name'].map((o) => h('option', { value: o, selected: this.sortierung === o }, t('shop.sort.' + o))))
    );
    this.kopfAktualisieren();
    this.listeZeichnen();
    this.detailZeichnen();
    this.s.layout();
  }

  listeZeichnen() {
    const liste = this.gefiltert();
    leeren(this.inhalt);
    if (!liste.length) {
      this.inhalt.appendChild(h('div.shop-leer', t('shop.leer')));
      return;
    }
    const raster = h('div.teil-raster.shop-raster');
    for (const e of liste) {
      const neu = !e.besitz && !this.gesehen.has(e.schluessel);
      const leistbar = e.preis <= this.daten.waehrung;
      raster.appendChild(h('button.teil-karte' + (this.auswahl === e.schluessel ? '.aktiv' : '') + (e.besitz ? '' : '.ungekauft'), {
        dataset: { fokus: e.schluessel },
        'aria-pressed': this.auswahl === e.schluessel ? 'true' : 'false',
        onClick: () => this.waehlen(e.schluessel)
      },
        neu ? h('span.shop-neu', t('allgemein.neu')) : null,
        e.unter ? h('span.shop-unter', e.unter) : null,
        h('span.teil-name', e.name),
        h('span.teil-preis' + (e.besitz ? '.besitz' : '') + (leistbar || e.besitz ? '' : '.zu-teuer'), e.besitz ? t('garage.gekauftKurz') : e.preis === 0 ? t('garage.inklusive') : zahl(e.preis) + ' DM')
      ));
    }
    this.inhalt.appendChild(raster);
  }

  waehlen(schluessel) {
    const fokus = schluessel;
    this.auswahl = schluessel;
    this.gesehen.add(schluessel);
    gesehenSichern(this.gesehen);
    const e = this.eintraege().find((x) => x.schluessel === schluessel);
    if (e?.autoId) {
      this.s.autoZeigen(e.autoId);
      this.s.autoDreht = true;
      this.s.orbit.fahreZu({ az: 40, el: 12 });
    } else if (e?.kaufId) {
      this.s.teilZeigen(e.kaufId);
    }
    this.listeZeichnen();
    this.detailZeichnen();
    this.inhalt.querySelector(`[data-fokus="${fokus}"]`)?.focus({ preventScroll: true });
    this.s.layout();
  }

  _nachBuchung() {
    this.spiel.ereignisse.senden('spielstandGeaendert');
    this.muenzen.classList.remove('feier');
    void this.muenzen.offsetWidth;
    this.muenzen.classList.add('feier');
    // Das Auto könnte verkauft worden sein
    if (!this.daten.autos.some((a) => a.id === this.s.autoId)) this.s.autoId = this.daten.aktivesAuto;
    this.zeichnen();
    const e = this.eintraege().find((x) => x.schluessel === this.auswahl);
    if (e?.autoId) this.s.autoZeigen(e.autoId);
    else if (e?.kaufId) this.s.teilZeigen(e.kaufId);
    else this.s.autoZeigen(this.s.autoId);
  }

  detailZeichnen() {
    leeren(this.detail);
    const e = this.eintraege().find((x) => x.schluessel === this.auswahl);
    this.detail.classList.toggle('sichtbar', !!e);
    if (!e) return;
    if (e.autoId) this._autoDetail(e);
    else this._teilDetail(e);
  }

  /** Füllt den Detailbereich; leere Angaben (null) werden übersprungen. */
  _detailSetzen(...teile) {
    this.detail.append(...teile.filter(Boolean));
  }

  _autoDetail(e) {
    const a = autoDaten(e.autoId);
    const eintrag = this.daten.autos.find((x) => x.id === a.id);
    const pi = leistungsindex(a.id, eintrag?.tuning);
    const aktiv = this.daten.aktivesAuto === a.id;
    const kannVerkaufen = eintrag && this.daten.autos.length > 1;
    const fehlt = a.preis - this.daten.waehrung;
    this._detailSetzen(
      h('h3.shop-titel', a.name),
      h('p.shop-text', a.beschreibung),
      h('div.shop-werte',
        [[t('shop.wert.leistung'), a.soll.ps + ' PS'], [t('shop.wert.masse'), a.masse + ' kg'], [t('shop.wert.nullHundert'), String(a.soll.nullHundert).replace('.', ',') + ' s'], [t('shop.wert.spitze'), a.soll.hoechstKmh + ' km/h'], [t('shop.wert.antrieb'), t('shop.antrieb.' + a.antrieb)], [t('shop.wert.pi'), `${piKlasse(pi)} ${pi}`]]
          .map(([n, w]) => h('div.shop-wert', h('span', n), h('strong.zahl', w)))
      ),
      !eintrag && fehlt > 0 ? h('div.einst-hinweis.shop-fehlt', t('shop.fehlt', { n: zahl(fehlt) })) : null,
      h('div.ebenen-aktionen.shop-aktionen',
        eintrag
          ? [
            h('button.knopf.haupt.klein', {
              disabled: aktiv,
              onClick: () => {
                this.daten.aktivesAuto = a.id;
                this.s.autoId = a.id;
                this.spiel.speicher.speichern();
                this._nachBuchung();
              }
            }, aktiv ? t('shop.aktiv') : t('shop.fahren')),
            h('button.knopf.klein', { onClick: () => { this.s.autoId = a.id; this.s.zurGarage('lack'); } }, t('shop.anpassen')),
            kannVerkaufen ? h('button.knopf.geist.klein', {
              onClick: async () => { if (await autoVerkaufenFlow(this.spiel, a.id)) { this.auswahl = null; this._nachBuchung(); } }
            }, t('shop.verkaufen', { erloes: zahl(autoVerkaufswert(this.daten, a.id)) })) : null
          ]
          : h('button.knopf.haupt.klein', {
            onClick: async () => {
              if (await autoKaufenFlow(this.spiel, a.id)) {
                this.daten.aktivesAuto = a.id;
                this.s.autoId = a.id;
                this.spiel.speicher.sofortSpeichern();
                this._nachBuchung();
              }
            }
          }, t('garage.kaufen', { preis: zahl(a.preis) }))
      )
    );
  }

  _teilDetail(e) {
    const k = KATEGORIEN.find((x) => x.id === this.kategorie);
    const autoId = this.s.autoId;
    const fehlt = e.preis - this.daten.waehrung;
    const hinweis = k.global ? t('shop.fuerAlle') : t('shop.nurFuer', { auto: autoDaten(autoId).name });
    let beschreibung = null;
    if (k.id === 'tuning') {
      const [, kat, stufe] = e.kaufId.split(':');
      const eintrag = this.daten.autos.find((x) => x.id === autoId);
      const piVorher = leistungsindex(autoId, eintrag?.tuning);
      const piNachher = leistungsindex(autoId, { ...(eintrag?.tuning || {}), [kat]: Number(stufe) });
      beschreibung = h('p.shop-text', TUNING.find((x) => x.id === kat).beschreibung + ' ' + t('shop.piAenderung', { von: piVorher, nach: piNachher }));
    }
    let bilder = null;
    if (k.id === 'aufkleber') {
      const id = e.kaufId.split(':')[1];
      bilder = id === 'text'
        ? h('p.shop-text', t('shop.textAufkleber'))
        : h('div.shop-aufkleber', AUFKLEBER.filter((a) => a.paket === id).slice(0, 18).map((a) => aufkleberBild(a.id)));
    }
    this._detailSetzen(
      h('h3.shop-titel', e.name),
      h('div.einst-hinweis', hinweis),
      beschreibung,
      bilder,
      !e.besitz && fehlt > 0 ? h('div.einst-hinweis.shop-fehlt', t('shop.fehlt', { n: zahl(fehlt) })) : null,
      h('div.ebenen-aktionen.shop-aktionen',
        e.besitz
          ? [
            h('button.knopf.klein', { onClick: () => this.s.zurGarage(k.reiter) }, t('shop.anpassen')),
            h('button.knopf.geist.klein', {
              onClick: async () => { if (await teilVerkaufen(this.spiel, e.kaufId, autoId)) this._nachBuchung(); }
            }, t('shop.verkaufen', { erloes: zahl(verkaufswert(e.preis)) }))
          ]
          : h('button.knopf.haupt.klein', {
            onClick: async () => { if (await teileKaufen(this.spiel, [e.kaufId], autoId)) this._nachBuchung(); }
          }, t('garage.kaufen', { preis: zahl(e.preis) }))
      )
    );
  }

  entfernen() {
    this.wurzel.remove();
  }
}
