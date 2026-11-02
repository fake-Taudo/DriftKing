// Zentrales Spielobjekt: hält alle Systeme (Speicher, Renderer, Eingabe, Netz, Qualität …)
// und den aktiven Modus (Hauptmenü, Garage, Rennen …). Die Spiellogik läuft mit festem
// Zeitschritt in modus.schritt(dt), die Darstellung in modus.frame(frameDt, alpha).
import { Ereignisse } from './core/ereignisse.js';
import { Speicher } from './core/speicher.js';
import { Qualitaet } from './core/qualitaet.js';
import { Schleife } from './core/schleife.js';
import { DebugOverlay } from './core/debug.js';
import { pwaStarten, homeBildschirmHinweis } from './core/pwa.js';
import { gestenUnterdruecken, bevorzugtWenigBewegung } from './core/geraet.js';
import { beiFehler } from './core/fehler.js';
import { Renderer } from './render/renderer.js';
import { Eingabe } from './eingabe/eingabe.js';
import { NetzClient } from './netz/netzClient.js';
import { toast } from './ui/dom.js';
import { t } from './i18n/de.js';
import { AufgabenDienst } from './core/aufgaben.js';
import { KMH } from '../shared/mathe.js';

export class Spiel {
  constructor() {
    this.ereignisse = new Ereignisse();
    this.speicher = new Speicher();
    this.qualitaet = new Qualitaet(this.ereignisse);
    this.uiWurzel = document.getElementById('ui');
    this.overlay = document.getElementById('overlay');
    this.modus = null;
    this.pausiertDurchSichtbarkeit = false;
    this.kontextHinweis = null;
  }

  get daten() {
    return this.speicher.daten;
  }

  async start({ startModus }) {
    gestenUnterdruecken();
    this.speicher.laden();
    this.aufgaben = new AufgabenDienst(this);
    beiFehler(() => {
      try { this.speicher.sofortSpeichern(); } catch { /* egal */ }
      this.schleife?.stop();
    });

    this.renderer = new Renderer({ container: document.getElementById('leinwand-container'), qualitaet: this.qualitaet, ereignisse: this.ereignisse });
    this.eingabe = new Eingabe({ uiWurzel: this.uiWurzel, ereignisse: this.ereignisse });
    this.netz = new NetzClient(this.ereignisse);
    this.debug = new DebugOverlay(this);
    this.einstellungenAnwenden();

    this.schleife = new Schleife({
      schritt: (dt) => this._schritt(dt),
      rendern: (alpha, frameDt) => this._frame(alpha, frameDt)
    });

    // Tab-Wechsel / Fensterverlust → automatisch pausieren (Online: Modus entscheidet selbst)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.modus?.beiVerstecken?.();
      else {
        this.schleife.zuruecksetzen();
        this.modus?.beiSichtbar?.();
      }
    });
    window.addEventListener('blur', () => this.modus?.beiFokusVerlust?.());

    // WebGL-Kontextverlust (häufig auf Handys): pausieren und Ressourcen neu aufbauen
    this.ereignisse.an('kontextVerloren', () => {
      this.modus?.beiVerstecken?.();
      if (!this.kontextHinweis) this.kontextHinweis = toast(t('fehler.kontextVerloren'), { art: 'warnung', dauer: 0 });
    });
    this.ereignisse.an('kontextWiederhergestellt', () => {
      this.kontextHinweis?.schliessen();
      this.kontextHinweis = null;
      this.modus?.ressourcenNeuAufbauen?.();
    });

    for (const m of this.speicher.meldungen) toast(t(m.schluessel), { art: m.art, dauer: 7000 });

    pwaStarten();
    homeBildschirmHinweis();
    this.schleife.start();
    const modus = typeof startModus === 'function' ? await startModus() : startModus;
    await this.wechsleModus(modus);
  }

  /** Wendet die gespeicherten Einstellungen auf alle Systeme an. */
  einstellungenAnwenden() {
    const e = this.daten.einstellungen;
    this.qualitaet.setzeEinstellung(e.grafik.qualitaet);
    this.eingabe.konfigurieren(e);
    const html = document.documentElement;
    html.classList.remove('schrift-0', 'schrift-1', 'schrift-2');
    html.classList.add('schrift-' + e.barrierefreiheit.schriftgroesse);
    html.classList.toggle('reduziert', this.wenigerEffekte);
    html.classList.toggle('farbenblind', !!e.barrierefreiheit.farbenblind);
    this.audio?.einstellungen?.(e.audio);
    this.ereignisse.senden('einstellungen', e);
  }

  /** Reduzierte Effekte: Einstellung oder Systemvorgabe „weniger Bewegung“. */
  get wenigerEffekte() {
    return !!this.daten.einstellungen.barrierefreiheit.reduzierteEffekte || bevorzugtWenigBewegung;
  }

  async wechsleModus(neu, parameter) {
    const alt = this.modus;
    if (alt) {
      try { alt.verlassen?.(); } catch (e) { console.error(e); }
    }
    this.modus = neu;
    this.schleife.zuruecksetzen();
    this.schleife.physikAktiv = true;
    this.schleife.zeitFaktor = 1;
    await neu.betreten?.(this, parameter);
  }

  _schritt(dt) {
    this.modus?.schritt?.(dt);
  }

  _frame(alpha, frameDt) {
    const eingabe = this.eingabe.aktualisieren(frameDt);
    const aktionen = this.eingabe.nimmEreignisse();
    this.qualitaet.frame(frameDt);
    const m = this.modus;
    if (m) {
      m.frame?.(frameDt, alpha, eingabe, aktionen);
      if (m.szene && m.kamera) this.renderer.rendern(m.szene, m.kamera, { bloom: m.bloom !== false });
    }
    if (this.debug.sichtbar) {
      const werte = [
        [t('debug.fps'), this.schleife.fps.toFixed(0)],
        [t('debug.qualitaet'), this.qualitaet.aktuell.id],
        [t('debug.drawCalls'), String(this.renderer.drawCalls)],
        [t('debug.eingabe'), `L${eingabe.lenken.toFixed(2)} G${eingabe.gas.toFixed(2)} B${eingabe.bremse.toFixed(2)} H${eingabe.handbremse} K${eingabe.kupplung}`],
        [t('debug.geraet'), this.eingabe.geraet],
        [t('debug.ping'), this.netz.verbunden ? this.netz.ping + ' ms' : '–']
      ];
      if (m?.debugWerte) werte.push(...m.debugWerte());
      this.debug.aktualisieren(frameDt, werte);
    }
  }

  /** Cheats (nur im Entwicklungsmodus sichtbar). */
  cheat(name) {
    if (!import.meta.env.DEV) return;
    const d = this.daten;
    if (name === 'muenzen') d.waehrung = Math.min(999_999_999, d.waehrung + 10000);
    if (name === 'strecken') d.fortschritt.strecken = ['industriehof', 'kuestenpass', 'neonhafen'];
    if (name === 'bots') d.fortschritt.botStufen = ['anfaenger', 'fahrer', 'profi', 'meister', 'legende'];
    if (name === 'autos') this.ereignisse.senden('cheatAutos');
    this.speicher.sofortSpeichern();
    this.ereignisse.senden('spielstandGeaendert');
    toast('Cheat: ' + name, { art: 'erfolg', dauer: 1500 });
  }
}

export { KMH };
