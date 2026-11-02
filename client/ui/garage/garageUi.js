// Oberfläche der Garage: Kopfzeile (Auto, Münzen, Rückgängig), Reiter mit Bedienfeld, Schnellansichten,
// Anprobe-Leiste und Fotomodus. Der Inhalt der Reiter steht in den Dateien reiter*.js.
import { h, leeren, toast } from '../dom.js';
import { t, zahl } from '../../i18n/de.js';
import { autoDaten } from '../../../shared/autos.js';
import { leistungsindex, piKlasse } from '../../../shared/leistungsindex.js';
import { SHOWROOMS } from '../../render/showroom.js';
import { farbFeldSchliessen } from '../farbwaehler.js';
import { reiterLack } from './reiterLack.js';
import { reiterAufkleber } from './reiterAufkleber.js';
import { reiterFelgen } from './reiterFelgen.js';
import { reiterBodykit } from './reiterBodykit.js';
import { reiterFahrwerk } from './reiterFahrwerk.js';
import { reiterDetails } from './reiterDetails.js';
import { reiterTuning, reiterSetup } from './reiterTuning.js';
import { reiterLooks } from './reiterLooks.js';

const REITER = [
  { id: 'lack', symbol: '🎨', bauen: reiterLack, ansicht: 'standard' },
  { id: 'aufkleber', symbol: '★', bauen: reiterAufkleber },
  { id: 'felgen', symbol: '◎', bauen: reiterFelgen, ansicht: 'felge' },
  { id: 'bodykit', symbol: '▰', bauen: reiterBodykit, ansicht: 'standard' },
  { id: 'fahrwerk', symbol: '↕', bauen: reiterFahrwerk, ansicht: 'front' },
  { id: 'details', symbol: '✦', bauen: reiterDetails },
  { id: 'tuning', symbol: '⚙', bauen: reiterTuning },
  { id: 'setup', symbol: '☰', bauen: reiterSetup },
  { id: 'looks', symbol: '▣', bauen: reiterLooks }
];
const ANSICHTEN = ['front', 'seite', 'heck', 'felge', 'innen'];

export class GarageUi {
  constructor(garage, startReiter) {
    this.g = garage;
    this.spiel = garage.spiel;
    this.reiter = REITER.some((r) => r.id === startReiter) ? startReiter : 'lack';
    this.eingeklappt = false;
    this.wurzel = h('div.garage');
    this.spiel.uiWurzel.appendChild(this.wurzel);
    this._aufbauen();
    this.neuZeichnen();
    this.anprobeAktualisieren();
  }

  _aufbauen() {
    leeren(this.wurzel);
    const g = this.g;
    this.muenzen = h('div.muenzen.menue-muenzen', zahl(g.daten.waehrung));
    this.zurueckBtn = h('button.knopf.geist.klein', { 'aria-label': t('allgemein.zurueck'), onClick: () => this.zurueckKnopf() }, '←', h('span.garage-zurueck-text', ' ' + t('allgemein.zurueck')));
    this.undoBtn = h('button.knopf.rund.geist.garage-rund', { 'aria-label': t('garage.rueckgaengig'), title: t('garage.rueckgaengig'), onClick: () => g.rueckgaengig() }, '↶');
    this.redoBtn = h('button.knopf.rund.geist.garage-rund', { 'aria-label': t('garage.wiederholen'), title: t('garage.wiederholen'), onClick: () => g.wiederholen() }, '↷');
    this.autoName = h('div.garage-auto-name');
    this.piAnzeige = h('div.garage-pi.zahl');
    const autos = g.daten.autos;
    const wechsel = (r) => {
      const i = autos.findIndex((a) => a.id === g.autoId);
      g.autoWechseln(autos[(i + r + autos.length) % autos.length].id);
    };
    const mehrereAutos = autos.length > 1;
    this.kopf = h('div.garage-kopf',
      this.zurueckBtn,
      h('div.garage-auto',
        mehrereAutos ? h('button.knopf.rund.geist.garage-rund', { 'aria-label': t('garage.autoVor'), onClick: () => wechsel(-1) }, '‹') : null,
        h('div.garage-auto-text', this.autoName, this.piAnzeige),
        mehrereAutos ? h('button.knopf.rund.geist.garage-rund', { 'aria-label': t('garage.autoNach'), onClick: () => wechsel(1) }, '›') : null
      ),
      h('div.garage-kopf-rechts', this.undoBtn, this.redoBtn, this.muenzen)
    );

    // Schnellansichten, Drehen, Showroom, Foto
    this.ansichtKnoepfe = new Map();
    const ansichten = h('div.garage-ansichten');
    for (const a of ANSICHTEN) {
      const k = h('button.ansicht-knopf', { onClick: () => g.ansicht(a) }, t('garage.ansicht.' + a));
      this.ansichtKnoepfe.set(a, k);
      ansichten.appendChild(k);
    }
    ansichten.appendChild(h('button.ansicht-knopf', {
      'aria-label': t('garage.drehen'),
      title: t('garage.drehen'),
      onClick: () => g.autoDrehenUmschalten()
    }, '⟳'));
    ansichten.appendChild(h('button.ansicht-knopf', { onClick: () => this.showroomMenue() }, t('garage.showroom')));
    ansichten.appendChild(h('button.ansicht-knopf', { onClick: () => this.fotoModus(true) }, '📷 ' + t('garage.foto')));
    this.ansichtenLeiste = ansichten;

    // Reiter
    this.leiste = h('div.garage-reiter', { role: 'tablist' });
    for (const r of REITER) {
      this.leiste.appendChild(h('button.garage-reiter-knopf', {
        role: 'tab',
        dataset: { reiter: r.id },
        onClick: () => this.reiterOeffnen(r.id)
      }, h('span.reiter-symbol', r.symbol), h('span', t('garage.reiter.' + r.id))));
    }
    this.inhalt = h('div.garage-inhalt');
    this.anprobe = h('div.garage-anprobe');
    this.einklappen = h('button.garage-griff', { 'aria-label': t('garage.einklappen'), onClick: () => this.panelUmschalten() }, '▾');
    this.panel = h('section.garage-panel.panel', this.einklappen, this.leiste, this.inhalt, this.anprobe);

    this.zoneDetail = null;
    this.wurzel.append(this.kopf, this.ansichtenLeiste, this.panel);
    this.kopfAktualisieren();
    this._reiterMarkieren();
  }

  /** Nach Auto- oder Slot-Wechsel alles neu. */
  neuAufbauen() {
    this._aufbauen();
    this.neuZeichnen();
    this.anprobeAktualisieren();
    this.g.layout();
  }

  kopfAktualisieren() {
    const g = this.g;
    this.muenzen.textContent = zahl(g.daten.waehrung);
    this.autoName.textContent = autoDaten(g.autoId).name;
    const pi = leistungsindex(g.autoId, g.auto.tuning);
    this.piAnzeige.textContent = t('garage.pi', { klasse: piKlasse(pi), pi });
    this.undoBtn.disabled = !g.verlauf.kannZurueck;
    this.redoBtn.disabled = !g.verlauf.kannVor;
  }

  _reiterMarkieren() {
    for (const k of this.leiste.children) {
      const an = k.dataset.reiter === this.reiter;
      k.classList.toggle('aktiv', an);
      k.setAttribute('aria-selected', an ? 'true' : 'false');
      if (an) k.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    }
  }

  reiterOeffnen(id) {
    this.reiter = id;
    this.g.markierungAktualisieren();
    this.inhalt.scrollTop = 0;
    this._reiterMarkieren();
    this.neuZeichnen();
    const r = REITER.find((x) => x.id === id);
    if (r.ansicht) this.g.ansicht(r.ansicht);
    if (this.eingeklappt) this.panelUmschalten();
  }

  /** Zeichnet den aktiven Reiter neu (Scrollposition und Fokus bleiben erhalten). */
  neuZeichnen() {
    const y = this.inhalt.scrollTop;
    const fokus = document.activeElement?.dataset?.fokus;
    farbFeldSchliessen();
    leeren(this.inhalt);
    this.nachLookRueckruf = null;
    REITER.find((r) => r.id === this.reiter).bauen(this.g, this.inhalt, this);
    this.inhalt.scrollTop = y;
    if (fokus) this.inhalt.querySelector(`[data-fokus="${fokus}"]`)?.focus({ preventScroll: true });
    this.kopfAktualisieren();
  }

  /** Läuft, nachdem das Auto den neuen Look übernommen hat (z. B. für die Zonen-Vorschau). */
  nachLook() {
    this.nachLookRueckruf?.();
    this.kopfAktualisieren();
  }

  anprobeAktualisieren() {
    const b = this.g.bedarf();
    leeren(this.anprobe);
    this.anprobe.classList.toggle('sichtbar', b.teile.length > 0);
    if (b.teile.length) {
      this.anprobe.append(
        h('div.anprobe-text',
          h('strong', t('garage.anprobe', { n: b.teile.length })),
          h('span.anprobe-teile', b.teile.map((x) => x.name).join(', '))
        ),
        h('button.knopf.geist.klein', { onClick: () => this.g.anprobeVerwerfen() }, t('garage.verwerfen')),
        h('button.knopf.haupt.klein', { onClick: () => this.g.anprobeKaufen() }, t('garage.kaufen', { preis: zahl(b.summe) }))
      );
    }
    this.kopfAktualisieren();
  }

  /** Kleine Erfolgsanimation nach einem Kauf. */
  kaufFeier() {
    this.muenzen.classList.remove('feier');
    void this.muenzen.offsetWidth;
    this.muenzen.classList.add('feier');
    this.kopfAktualisieren();
  }

  ansichtMarkieren(name) {
    for (const [a, k] of this.ansichtKnoepfe) k.classList.toggle('aktiv', a === name);
  }

  panelUmschalten() {
    this.eingeklappt = !this.eingeklappt;
    this.panel.classList.toggle('eingeklappt', this.eingeklappt);
    this.wurzel.classList.toggle('eingeklappt', this.eingeklappt);
    this.einklappen.textContent = this.eingeklappt ? '▴' : '▾';
    this.einklappen.setAttribute('aria-label', t(this.eingeklappt ? 'garage.ausklappen' : 'garage.einklappen'));
    this.g.layout();
  }

  /** Vom Panel verdeckter Teil des Bildes (für die Kamera). */
  verdeckt() {
    if (this.fotoAktiv) return { rechts: 0, unten: 0 };
    const hoch = window.innerHeight > window.innerWidth;
    const r = this.panel.getBoundingClientRect();
    if (hoch) return { rechts: 0, unten: this.eingeklappt ? 0 : Math.max(0, window.innerHeight - r.top) };
    return { rechts: this.eingeklappt ? 0 : Math.max(0, window.innerWidth - r.left), unten: 0 };
  }

  zurueckKnopf() {
    if (this.fotoAktiv) {
      this.fotoModus(false);
      return;
    }
    if (this.menueOffen) {
      this.menueOffen();
      return;
    }
    this.g.verlassenWunsch();
  }

  showroomMenue() {
    this.menueOffen?.();
    const liste = h('div.showroom-menue');
    const zu = () => {
      liste.remove();
      this.menueOffen = null;
    };
    for (const s of SHOWROOMS) {
      liste.appendChild(h('button.ansicht-knopf' + (s.id === this.g.showroom.id ? '.aktiv' : ''), {
        onClick: () => {
          this.g.stimmung(s.id);
          zu();
        }
      }, h('span.showroom-punkt', { style: { background: s.ring } }), t('garage.stimmung.' + s.id)));
    }
    this.menueOffen = zu;
    this.ansichtenLeiste.appendChild(liste);
  }

  fotoModus(an) {
    this.fotoAktiv = an;
    this.g.markierungAktualisieren();
    this.menueOffen?.();
    this.wurzel.classList.toggle('foto', an);
    this.fotoLeiste?.remove();
    this.fotoLeiste = null;
    if (an) {
      this.g.autoDreht = false;
      const status = h('span.foto-status');
      const ausloeser = h('button.knopf.haupt', {
        onClick: async () => {
          ausloeser.disabled = true;
          status.textContent = t('garage.fotoLaeuft');
          try {
            await this._fotoSichern();
            status.textContent = '';
          } catch (e) {
            console.error(e);
            toast(t('garage.fotoFehler'), { art: 'fehler' });
            status.textContent = '';
          }
          ausloeser.disabled = false;
        }
      }, '📷 ' + t('garage.fotoAufnehmen'));
      this.fotoLeiste = h('div.foto-leiste',
        h('button.knopf.geist.klein', { onClick: () => this.fotoModus(false) }, '← ' + t('allgemein.zurueck')),
        SHOWROOMS.map((s) => h('button.ansicht-knopf', { onClick: () => this.g.stimmung(s.id) }, h('span.showroom-punkt', { style: { background: s.ring } }), t('garage.stimmung.' + s.id))),
        status,
        ausloeser
      );
      this.wurzel.appendChild(this.fotoLeiste);
    }
    this.g.layout();
  }

  /** Foto rendern und sichern: auf dem iPhone über das Teilen-Menü, sonst als Download. */
  async _fotoSichern() {
    const blob = await this.g.fotoAufnehmen();
    if (!blob) throw new Error('kein Bild');
    const name = `driftkoenig-${this.g.autoId}-${Date.now()}.png`;
    const datei = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [datei] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      try {
        await navigator.share({ files: [datei], title: t('allgemein.spielname') });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast(t('garage.fotoGespeichert'), { art: 'erfolg' });
  }

  entfernen() {
    this.wurzel.remove();
  }
}

// ---------------------------------------------------------------------------
// Bausteine, die mehrere Reiter verwenden

/** Überschrift eines Abschnitts. */
export function abschnitt(titel, ...inhalt) {
  return h('section.garage-abschnitt', titel ? h('h3', titel) : null, ...inhalt);
}

/**
 * Auswahlkarte für ein kaufbares Teil. Zeigt Preis bzw. Häkchen; ein Klick probiert es an.
 * @param {{titel:string, kaufId?:string, aktiv?:boolean, onClick:Function, vorschau?:Node, fokus?:string}} o
 */
export function teilKarte(g, { titel, kaufId, aktiv = false, onClick, vorschau = null, fokus }) {
  const info = kaufId ? g.preisInfo(kaufId) : { preis: 0, besitz: true };
  return h('button.teil-karte' + (aktiv ? '.aktiv' : '') + (info.besitz ? '' : '.ungekauft'), {
    dataset: { fokus: fokus ?? kaufId ?? titel },
    'aria-pressed': aktiv ? 'true' : 'false',
    onClick
  },
    vorschau,
    h('span.teil-name', titel),
    h('span.teil-preis' + (info.besitz ? '.besitz' : ''), info.besitz ? (info.preis > 0 ? t('garage.gekauftKurz') : t('garage.inklusive')) : zahl(info.preis) + ' DM')
  );
}
