// Tutorial: Gas, Lenken, Bremsen, Handbremse, erster Drift, Drift halten und das Tandem-Prinzip auf der
// ersten Strecke. Überspringbar, in den Einstellungen wiederholbar. Der Ablauf steht in shared/tutorialLogik.js.
import { Rennen } from './rennen.js';
import { TutorialAblauf, TUTORIAL_SCHRITTE, TANDEM_ABSTAND } from '../../shared/tutorialLogik.js';
import { BotFahrer } from '../../shared/bots/botFahrer.js';
import { botStufe } from '../../shared/bots/botStufen.js';
import { abstandsBewertung } from '../../shared/wertung.js';
import { Rundenzaehler } from '../../shared/rundenLogik.js';
import { standardLook } from '../../shared/look.js';
import { h, leeren } from '../ui/dom.js';
import { t } from '../i18n/de.js';

const GRAD = 180 / Math.PI;

/** Bedienhinweise passend zum Eingabegerät. */
function bedienung(geraet) {
  const art = geraet === 'touch' ? 'touch' : geraet === 'gamepad' ? 'gamepad' : 'tastatur';
  const n = (k) => t(`tutorial.eingabe.${art}.${k}`);
  return { gas: n('gas'), bremse: n('bremse'), lenken: n('lenken'), handbremse: n('handbremse') };
}

export class Tutorial extends Rennen {
  constructor(konfig) {
    super({ ...konfig, art: 'tutorial' });
    this.ablauf = new TutorialAblauf();
  }

  get istBattle() {
    return true; // HUD mit Abstandsanzeige für den Tandem-Schritt
  }

  aufstellen() {
    super.aufstellen();
    // Großzügige Hilfen für den Anfang (nur in diesem Modus)
    this._hilfenSetzen();
  }

  _hilfenSetzen() {
    const a = this.spieler.fahrzeug.assistenz;
    a.gegenlenken = Math.max(a.gegenlenken, 0.75);
    a.driftHalten = Math.max(a.driftHalten, 0.3);
  }

  _einstellungenNeu() {
    super._einstellungenNeu();
    this._hilfenSetzen();
  }

  starten() {
    super.starten();
    this.zustand = 'laeuft';
    this.countdown = 0;
    this.karteBauen();
    this.hud.abstandAnzeigen(null);
  }

  neustart() {
    this.spielerZuruecksetzen(true);
  }

  karteBauen() {
    this.karte?.remove();
    this.titel = h('h2.tutorial-titel');
    this.text = h('p.tutorial-text');
    this.balken = h('div');
    this.weiterKnopf = h('button.knopf.klein', { onClick: () => this.schrittUeberspringen() }, t('tutorial.weiter'));
    this.weiterKnopf.style.display = 'none';
    this.karte = h('section.tutorial-karte.panel',
      h('div.tutorial-kopf', this.zaehler = h('span.tutorial-zaehler'), h('button.knopf.geist.klein', { onClick: () => this.abschliessen() }, t('tutorial.ueberspringen'))),
      this.titel,
      this.text,
      h('div.tutorial-balken', this.balken),
      this.weiterKnopf
    );
    this.spiel.uiWurzel.appendChild(this.karte);
    this._schrittAnzeigen();
  }

  _schrittAnzeigen() {
    const s = this.ablauf.schritt;
    const nr = TUTORIAL_SCHRITTE.indexOf(s) + 1;
    this.zaehler.textContent = t('tutorial.zaehler', { n: Math.min(nr, TUTORIAL_SCHRITTE.length - 1), von: TUTORIAL_SCHRITTE.length - 1 });
    this.titel.textContent = t(`tutorial.${s.id}.titel`);
    this.text.textContent = t(`tutorial.${s.id}.text`, { ...bedienung(this.spiel.eingabe.geraet), abstand: TANDEM_ABSTAND });
  }

  schrittUeberspringen() {
    this.ablauf.weiter();
    this._schrittGewechselt();
  }

  _schrittGewechselt() {
    this.spiel.audio?.ton?.('kasse');
    this.weiterKnopf.style.display = 'none';
    if (this.ablauf.fertig) {
      this._fertigAnzeigen();
      return;
    }
    if (this.ablauf.schritt.id === 'tandem') this._tandemStarten();
    this._schrittAnzeigen();
    this.hud.popup(t('tutorial.gutGemacht'), 'combo');
  }

  /** Ein gutmütiger Bot fährt vor, der Spieler folgt ihm. */
  _tandemStarten() {
    const S = this.S;
    if (!this.botAuto) {
      const autoId = this.konfig.spieler.autoId;
      this.botAuto = this.autoHinzufuegen({ autoId, look: { ...standardLook(autoId), lack: { ...standardLook(autoId).lack, farbe1: '#ffc53d', finish: 'glanz' } }, rolle: 'bot', name: t('tutorial.botName'), farbe: '#ff3d6e' });
      this.botAuto.runden = new Rundenzaehler(S, S.start.fuehrer);
    }
    const f = S.start.fuehrer, v = S.start.verfolger;
    this.botAuto.fahrzeug.setzen(f.x, f.y, f.theta, 0);
    this.botAuto.runden.zuruecksetzen(f);
    this.botAuto.bot = new BotFahrer(S, this.botAuto.fahrzeug, botStufe('anfaenger'), { seed: 3, rolle: 'fuehrer', auslassen: 1 });
    this.spieler.fahrzeug.setzen(v.x, v.y, v.theta, 0);
    this.spieler.runden.zuruecksetzen(v);
    this.spieler.haenger.zuruecksetzen();
    this.rennKamera.erstesBild = true;
  }

  regelSchritt(dt) {
    const f = this.spieler.fahrzeug;
    const e = this.spiel.eingabe.werte;
    const abstand = this.botAuto ? Math.hypot(f.z.x - this.botAuto.fahrzeug.z.x, f.z.y - this.botAuto.fahrzeug.z.y) : null;
    const wechsel = this.ablauf.aktualisieren({
      tempoKmh: f.tempo * 3.6,
      lenken: e.lenken,
      bremse: e.bremse,
      handbremse: e.handbremse,
      winkelGrad: f.driftWinkel * GRAD,
      abstand
    }, dt);
    if (wechsel) this._schrittGewechselt();
  }

  hudAktualisieren() {
    this.hud.stand({ rolle: t('tutorial.rolle'), rolleArt: 'einzel', status: '' });
    this.hud.punkte({ ich: null });
    this.balken.style.width = Math.round(this.ablauf.anteil * 100) + '%';
    if (this.ablauf.darfWeiter && this.weiterKnopf.style.display === 'none') this.weiterKnopf.style.display = '';
    if (this.ablauf.schritt.id === 'tandem' && this.botAuto) {
      const a = this.spieler.darstellung, b = this.botAuto.darstellung;
      const m = Math.hypot(a.x - b.x, a.y - b.y);
      this.hud.abstandAnzeigen(m, abstandsBewertung(m));
    } else {
      this.hud.abstandAnzeigen(null);
    }
  }

  _fertigAnzeigen() {
    this.spiel.daten.fortschritt.tutorialFertig = true;
    this.spiel.speicher.sofortSpeichern();
    this.titel.textContent = t('tutorial.fertig.titel');
    this.text.textContent = t('tutorial.fertig.text');
    this.zaehler.textContent = '';
    this.balken.style.width = '100%';
    const reihe = this.karte.querySelector('.tutorial-kopf');
    leeren(reihe);
    this.karte.appendChild(h('div.knopf-reihe.tutorial-schluss',
      h('button.knopf.haupt', { onClick: () => this.abschliessen() }, t('tutorial.zumMenue'))
    ));
    this.hud.abstandAnzeigen(null);
    if (this.botAuto) this.botAuto.bot = { schritt: () => ({ lenken: 0, gas: 0, bremse: 0.4, handbremse: 0, kupplung: 0 }) };
  }

  /** Beenden oder Überspringen: gilt als gesehen und führt ins Hauptmenü. */
  abschliessen() {
    this.spiel.daten.fortschritt.tutorialFertig = true;
    this.spiel.speicher.sofortSpeichern();
    this.beenden();
  }

  verlassen() {
    this.karte?.remove();
    super.verlassen();
  }
}
