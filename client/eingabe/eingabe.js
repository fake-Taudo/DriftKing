// Eingabe-Schicht: vereint Tastatur, Touch, Gamepad und Neigung zu normierten Werten.
// lenken −1 (links) … +1 (rechts), gas 0…1, bremse 0…1, handbremse 0/1, kupplung 0/1.
// Erkennt das zuletzt benutzte Gerät, damit die UI passende Hinweise zeigen kann.
import { Tastatur } from './tastatur.js';
import { GamepadEingabe } from './gamepad.js';
import { TouchSteuerung } from './touch.js';
import { Neigung } from './neigung.js';
import { istTouchGeraet } from '../core/geraet.js';
import { glaetten } from '../../shared/mathe.js';
import { PHYSIK } from '../../shared/physikParameter.js';

export class Eingabe {
  constructor({ uiWurzel, ereignisse }) {
    this.ereignisBus = ereignisse;
    this.tastatur = new Tastatur();
    this.gamepad = new GamepadEingabe();
    this.touch = new TouchSteuerung(uiWurzel);
    this.neigung = new Neigung();
    this.geraet = istTouchGeraet ? 'touch' : 'tastatur';
    this.werte = { lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0 };
    this._touchLenkenGeglaettet = 0;
    this.neigung.beiVerlust = () => this.ereignisBus?.senden('neigungVerloren');
    // Touch-Benutzung erkennen, auch wenn die Steuerung ausgeblendet ist
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this._geraetSetzen('touch');
      else if (e.pointerType === 'mouse' && this.geraet === 'touch') this._geraetSetzen('tastatur');
    }, true);
  }

  /** Einstellungen aus dem Spielstand übernehmen. */
  konfigurieren(einstellungen) {
    const s = einstellungen.steuerung;
    this.tastatur.setzeBelegung(s.tasten);
    this.gamepad.setzeBelegung(s.gamepad, s.gamepadTotzone);
    this.neigung.empfindlichkeit = s.neigungEmpfindlichkeit;
    this.neigung.totzone = s.neigungTotzone;
    this.touch.konfigurieren({
      modus: s.touchModus,
      layout: s.layout,
      linkshaender: s.linkshaender,
      kupplungsButton: s.kupplungsButton,
      transparenz: s.transparenz,
      vibration: s.vibration
    });
    this.touchModus = s.touchModus;
  }

  _geraetSetzen(g) {
    if (this.geraet === g) return;
    this.geraet = g;
    this.ereignisBus?.senden('eingabeGeraet', g);
  }

  /** Pro Frame aufrufen. dt = Frame-Zeit. */
  aktualisieren(dt) {
    const tw = this.tastatur.werte();
    const gw = this.gamepad.aktualisieren();
    const uw = this.touch.werteAktuell;
    if (this.touchModus === 'neigung') this.neigung.pruefen();

    // Zuletzt benutztes Gerät bestimmen
    const zeiten = [
      ['tastatur', this.tastatur.zuletztBenutzt],
      ['gamepad', this.gamepad.zuletztBenutzt],
      ['touch', this.touch.zuletztBenutzt]
    ];
    let bestes = null;
    for (const z of zeiten) if (z[1] > 0 && (!bestes || z[1] > bestes[1])) bestes = z;
    if (bestes) this._geraetSetzen(bestes[0]);

    // Touch-/Neigungslenkung glätten (Lenkrate auf Touch beruhigen)
    let touchLenken = uw.lenken;
    if (this.touchModus === 'neigung' && this.neigung.aktiv) touchLenken = this.neigung.wert;
    this._touchLenkenGeglaettet = glaetten(this._touchLenkenGeglaettet, touchLenken, PHYSIK.lenkung.touchGlaettung, dt);
    if (Math.abs(this._touchLenkenGeglaettet) < 0.002) this._touchLenkenGeglaettet = 0;

    // Zusammenführen: Lenken vom betragsgrößten Gerät, Pedale als Maximum
    const lenkKandidaten = [tw.lenken, gw.lenken, this._touchLenkenGeglaettet];
    let lenken = 0;
    for (const l of lenkKandidaten) if (Math.abs(l) > Math.abs(lenken)) lenken = l;
    const w = this.werte;
    w.lenken = lenken;
    w.gas = Math.max(tw.gas, gw.gas, uw.gas);
    w.bremse = Math.max(tw.bremse, gw.bremse, uw.bremse);
    w.handbremse = Math.max(tw.handbremse, gw.handbremse, uw.handbremse);
    w.kupplung = Math.max(tw.kupplung, gw.kupplung, uw.kupplung);
    return w;
  }

  /** Einmal-Aktionen seit dem letzten Aufruf (z. B. 'kamera', 'pause', 'hoch'). */
  nimmEreignisse() {
    return [...this.tastatur.nimmEreignisse(), ...this.gamepad.nimmEreignisse(), ...this.touch.nimmEreignisse()];
  }

  /** Touch-Spieler bekommen standardmäßig die Drift-Haltehilfe. */
  get istTouch() {
    return this.geraet === 'touch';
  }
}
