// Tandem-Battle gegen Bots: Spieler (Seite A) gegen einen Fahrer aus dem Gegner-Pool (Seite B).
// Ablauf über BattleAblauf (Läufe aus zwei Durchgängen mit Rollentausch, Gleichstand-Regel),
// Wertung beider Fahrer mit 20 Ticks/s ab dem Überfahren der Startlinie durch den Führer
// (Verfolger nach 3 s Aufschließphase), Zeitlimit 150 % der Referenzzeit, Zwischenstände,
// Ergebnis mit Aufschlüsselung, Belohnung und Freischaltungen.
import * as THREE from 'three';
import { Rennen } from './rennen.js';
import { BattleAblauf, FORMATE } from '../../shared/battle.js';
import { Wertung, verfolgerEndpunkte, abstandsBewertung } from '../../shared/wertung.js';
import { battleAbschliessen, statistikVerbuchen, PERFEKT_SCHWELLE } from '../../shared/oekonomie.js';
import { BotFahrer } from '../../shared/bots/botFahrer.js';
import { botStufe } from '../../shared/bots/botStufen.js';
import { gegnerDaten } from '../../shared/bots/gegnerPool.js';
import { streckenDef } from '../../shared/strecken/index.js';
import { Rundenzaehler } from '../../shared/rundenLogik.js';
import { TICK_SCHRITTE, wertungsZustand, ereignisseAnzeigen, zufallsId, aufschluesselungZusammenfassen, aufschluesselungZeilen } from './rennenWertung.js';
import { ergebnisZeigen } from '../ui/bildschirme/ergebnis.js';
import { bestaetigen } from '../ui/dom.js';
import { zuWelt } from '../render/koordinaten.js';
import { t, zahl } from '../i18n/de.js';

/** Ohne Eingabe ausrollen (zwischen den Durchgängen). */
const AUSLAUF = { lenken: 0, gas: 0, bremse: 0.35, handbremse: 0, kupplung: 0 };
const AUSLAUF_BOT = { schritt: () => AUSLAUF };
/** Sekunden nach dem Ende eines Durchgangs, bis der Zwischenstand erscheint (freier Auslauf). */
const AUSLAUF_ZEIT = 2.2;
/** Notfall: Überfährt der Führer die Startlinie nicht, beginnt die Wertung nach dieser Zeit trotzdem. */
const START_SPAETESTENS = 12;

const f1 = (x) => zahl(x, 1);

export class BotBattle extends Rennen {
  /**
   * @param {{streckeId:string, spieler:object, gegnerId:string, stufe:string, format:'schnell'|'bo3', seed?:number}} konfig
   */
  constructor(konfig) {
    super({ ...konfig, art: 'battle' });
    this.gegner = gegnerDaten(konfig.gegnerId);
    if (!this.gegner) throw new Error('Unbekannter Gegner: ' + konfig.gegnerId);
    this.stufe = botStufe(konfig.stufe);
    this.format = FORMATE[konfig.format] ? konfig.format : 'bo3';
    this.seed = konfig.seed ?? neuerSeed();
    this._v = new THREE.Vector3();
  }

  aufstellen() {
    const sp = this.konfig.spieler;
    const S = this.S;
    this.spieler = this.autoHinzufuegen({ ...sp, rolle: 'spieler', name: sp.name, farbe: '#2ee6ff' });
    this.botAuto = this.autoHinzufuegen({ autoId: this.gegner.autoId, look: this.gegner.look, rolle: 'bot', name: this.gegner.name, farbe: '#ff3d6e', bot: AUSLAUF_BOT });
    this.spieler.runden = new Rundenzaehler(S, S.start.fuehrer);
    this.botAuto.runden = new Rundenzaehler(S, S.start.verfolger);
  }

  /** Neues Battle (auch Neustart und Revanche). */
  starten() {
    this.ablauf = new BattleAblauf({ format: this.format, seed: this.seed });
    this.battleId = zufallsId();
    this.spielerFahrten = []; // Aufschlüsselungen des Spielers je Durchgang
    this.perfekt = 0;
    this.abgeschlossen = false;
    this._durchgangAufstellen();
  }

  neustart() {
    this.seed = neuerSeed();
    this.starten();
  }

  /** Stellt beide Autos für den nächsten Durchgang auf und startet den Countdown. */
  _durchgangAufstellen() {
    const S = this.S;
    const d = this.ablauf.naechsterDurchgang();
    this.durchgang = d;
    this.spielerFuehrt = d.fuehrer === 'A';
    const fuehrer = this.spielerFuehrt ? this.spieler : this.botAuto;
    const verfolger = this.spielerFuehrt ? this.botAuto : this.spieler;
    this.fuehrerAuto = fuehrer;
    this.verfolgerAuto = verfolger;
    for (const [a, st] of [[fuehrer, S.start.fuehrer], [verfolger, S.start.verfolger]]) {
      a.fahrzeug.setzen(st.x, st.y, st.theta, 0);
      a.runden.zuruecksetzen(st);
      a.haenger.zuruecksetzen();
      a.zurueckgesetzt = false;
    }
    // Bot mit der Rolle dieses Durchgangs (seedbar je Lauf und Durchgang)
    const bot = new BotFahrer(S, this.botAuto.fahrzeug, this.stufe, {
      seed: `${this.seed}:${d.laufIndex}:${d.durchgangNr}`,
      rolle: this.spielerFuehrt ? 'verfolger' : 'fuehrer'
    });
    if (this.spielerFuehrt) bot.setzeGegner(this.spieler.fahrzeug);
    this.botAuto.bot = bot;
    // Autopilot (nur Tests/Messungen): fährt das Spielerauto in der Rolle dieses Durchgangs
    if (this.konfig.autopilot) {
      this.autopilot = new BotFahrer(S, this.spieler.fahrzeug, botStufe(this.konfig.autopilot), {
        seed: `ap:${this.seed}:${d.laufIndex}:${d.durchgangNr}`,
        rolle: this.spielerFuehrt ? 'fuehrer' : 'verfolger'
      });
      if (!this.spielerFuehrt) this.autopilot.setzeGegner(this.botAuto.fahrzeug);
    }
    const ab = (a) => a.fahrzeug.p.abmessungen;
    this.wFuehrer = new Wertung(S, 'fuehrer', { abmessungen: ab(fuehrer), gegnerAbmessungen: ab(verfolger) });
    this.wVerfolger = new Wertung(S, 'verfolger', { abmessungen: ab(verfolger), gegnerAbmessungen: ab(fuehrer) });
    this.durchgangLaeuft = false;
    this.durchgangStart = null;
    this.tickSchritte = 0;
    this.auslaufBis = null;
    this.auslaufOhneEingabe = false;
    this.zwischenOffen = false;
    // Countdown (wie Rennen.starten)
    this.zeit = 0;
    this.zustand = 'countdown';
    this.countdown = 3.6;
    this._countdownWert = null;
    this.rennKamera.erstesBild = true;
    this.hud.countdownZeigen('');
    this.hud.meldungZeigen(t(this.spielerFuehrt ? 'battle.duFuehrst' : 'battle.duVerfolgst', { name: this.gegner.name }), 3.2, this.spielerFuehrt ? '' : 'erfolg');
    this.spiel.eingabe.touch.zeigen(this.spiel.eingabe.istTouch);
  }

  _durchgangLos() {
    this.durchgangLaeuft = true;
    this.durchgangStart = this.zeit;
    this.tickSchritte = 0;
    this.wFuehrer.zuruecksetzen(0);
    this.wVerfolger.zuruecksetzen(0);
    this.fuehrerAuto.zurueckgesetzt = this.verfolgerAuto.zurueckgesetzt = false;
  }

  wertungSchritt() {
    if (!this.durchgangLaeuft || ++this.tickSchritte % TICK_SCHRITTE) return;
    const zeit = this.zeit - this.durchgangStart;
    const zF = wertungsZustand(this.fuehrerAuto);
    const zV = wertungsZustand(this.verfolgerAuto);
    const evF = this.wFuehrer.tick(zF, zV, zeit);
    const evV = this.wVerfolger.tick(zV, zF, zeit);
    this.fuehrerAuto.zurueckgesetzt = this.verfolgerAuto.zurueckgesetzt = false;
    ereignisseAnzeigen(this, this.spielerFuehrt ? evF : evV);
  }

  regelSchritt() {
    if (this.zustand === 'laeuft') {
      if (!this.durchgangLaeuft) {
        if (this.zeit > START_SPAETESTENS) this._durchgangLos();
      } else if (this.zeit - this.durchgangStart > this.S.zeitLimit) {
        this._durchgangEnde('zeit');
      }
    } else if (this.zustand === 'ziel' && this.auslaufBis !== null && this.zeit >= this.auslaufBis) {
      this.auslaufBis = null;
      this._zwischenstand();
    }
  }

  rundenEreignis(a, ev) {
    if (a === this.spieler && ev.art === 'falschrum') super.rundenEreignis(a, ev);
    if (a !== this.fuehrerAuto || this.zustand !== 'laeuft') return;
    if (ev.art === 'start' && !this.durchgangLaeuft) this._durchgangLos();
    else if (ev.art === 'runde' && this.durchgangLaeuft) this._durchgangEnde('ziel');
  }

  /** Durchgang beenden: Punkte eintragen, Auslauf, danach Zwischenstand. */
  _durchgangEnde(grund) {
    this.durchgangLaeuft = false;
    this.zustand = 'ziel';
    const aF = this.wFuehrer.aufschluesselung();
    const aV = this.wVerfolger.aufschluesselung();
    const fuehrerPunkte = aF.punkte;
    const verfolgerNorm = aV.punkte;
    const verfolgerPunkte = verfolgerEndpunkte(verfolgerNorm, fuehrerPunkte);
    const ergebnis = this.ablauf.durchgangEintragen({ fuehrerPunkte, verfolgerNorm });
    const eigene = this.spielerFuehrt ? aF : { ...aV, endpunkte: verfolgerPunkte };
    this.spielerFahrten.push(eigene);
    if (!this.konfig.autopilot) statistikVerbuchen(this.spiel.daten, eigene);
    if (this.spielerFuehrt && fuehrerPunkte > PERFEKT_SCHWELLE && aF.wand === 0) {
      this.perfekt++;
      this.hud.popup(t('battle.perfekt'), 'combo');
    }
    this.letzter = { durchgang: this.durchgang, spielerFuehrt: this.spielerFuehrt, fuehrerPunkte, verfolgerPunkte, grund, ergebnis };
    this.hud.meldungZeigen(grund === 'zeit' ? t('rennen.zeitAbgelaufen') : t('battle.durchgangEnde'), AUSLAUF_ZEIT, grund === 'zeit' ? 'gefahr' : 'erfolg');
    this.auslaufBis = this.zeit + AUSLAUF_ZEIT;
    this.spiel.ereignisse.senden('durchgangEnde', { rolle: this.spielerFuehrt ? 'fuehrer' : 'verfolger', wertung: eigene });
  }

  /** Punkte eines Durchgangs aus Sicht des Spielers. */
  _durchgangZeilen(l) {
    const ich = l.spielerFuehrt ? l.fuehrerPunkte : l.verfolgerPunkte;
    const er = l.spielerFuehrt ? l.verfolgerPunkte : l.fuehrerPunkte;
    return [
      [t('battle.duAls', { rolle: t(l.spielerFuehrt ? 'hud.fuehrer' : 'hud.verfolger') }), f1(ich)],
      [t('battle.gegnerAls', { name: this.gegner.name, rolle: t(l.spielerFuehrt ? 'hud.verfolger' : 'hud.fuehrer') }), f1(er)]
    ];
  }

  /** Zwischenstand nach einem Durchgang bzw. Lauf; am Ende das Battle-Ergebnis. */
  _zwischenstand() {
    const l = this.letzter;
    if (l.ergebnis.battleEnde) { this._battleEnde(); return; }
    this.auslaufOhneEingabe = true;
    this.botAuto.bot = AUSLAUF_BOT;
    this.autopilot = null;
    this.zwischenOffen = true;
    let titel = t('battle.durchgangTitel', { n: l.durchgang.durchgangNr });
    let untertitel = t('battle.naechsterTausch');
    const zeilen = this._durchgangZeilen(l);
    if (l.ergebnis.laufEnde) {
      const e = l.ergebnis.lauf.ergebnis;
      zeilen.push([t('battle.summeDu'), f1(e.a.summe)], [t('battle.summeGegner', { name: this.gegner.name }), f1(e.b.summe)]);
      if (e.gleichstand) {
        titel = t('battle.gleichstandTitel');
        untertitel = t('battle.gleichstandText');
      } else {
        titel = t(e.sieger === 'A' ? 'battle.laufGewonnen' : 'battle.laufVerloren', { n: l.durchgang.laufNr });
        untertitel = t('battle.stand', { a: this.ablauf.siegeA, b: this.ablauf.siegeB });
      }
    }
    ergebnisZeigen(this.spiel, {
      titel,
      untertitel,
      sieg: l.ergebnis.laufEnde && !l.ergebnis.lauf.ergebnis.gleichstand ? l.ergebnis.lauf.ergebnis.sieger === 'A' : null,
      zeilen,
      knoepfe: [
        { text: t('battle.weiter'), art: 'haupt', aktion: () => this._durchgangAufstellen() },
        { text: t('battle.abbrechen'), art: 'geist', aktion: () => this._abbrechenFragen(() => this._zwischenstand()) }
      ]
    });
  }

  async _abbrechenFragen(sonst) {
    if (await bestaetigen(t('battle.abbrechenTitel'), t('battle.abbrechenText'), { jaText: t('battle.abbrechen'), gefahr: true })) this.beenden();
    else sonst?.();
  }

  /** Battle beendet: Belohnung buchen (einmal je Battle-ID), Ergebnis zeigen. */
  _battleEnde() {
    this.zustand = 'ende';
    this.auslaufOhneEingabe = true;
    this.botAuto.bot = AUSLAUF_BOT;
    this.autopilot = null;
    const d = this.spiel.daten;
    const zus = this.ablauf.zusammenfassung();
    const sieg = this.ablauf.sieger === 'A';
    let r = { belohnung: 0, posten: [], freischaltungen: [] };
    if (!this.abgeschlossen && !this.konfig.autopilot) {
      this.abgeschlossen = true;
      r = battleAbschliessen(d, { battleId: this.battleId, streckeId: this.S.id, stufe: this.stufe.id, format: this.format, sieg, perfekt: this.perfekt });
      this.spiel.speicher.speichern();
      this.spiel.ereignisse.senden('battleEnde', { sieg, streckeId: this.S.id, stufe: this.stufe.id, format: this.format, fahrten: this.spielerFahrten });
      this.spiel.ereignisse.senden('spielstandGeaendert');
    }
    const name = this.gegner.name;
    const tabelle = {
      kopf: [t('battle.lauf'), t('hud.du'), name, t('battle.sieger')],
      zeilen: zus.laeufe.map((l) => [
        String(l.nummer) + (l.wiederholung ? ' ' + t('battle.wiederholungKurz') : ''),
        `${f1(l.a.fuehrer)} + ${f1(l.a.verfolger)} = ${f1(l.a.summe)}`,
        `${f1(l.b.fuehrer)} + ${f1(l.b.verfolger)} = ${f1(l.b.summe)}`,
        l.gleichstand ? t('battle.gleichstand') : l.sieger === 'A' ? t('hud.du') : name
      ])
    };
    const fuehrerFahrten = this.spielerFahrten.filter((a) => a.abstand === null);
    const verfolgerFahrten = this.spielerFahrten.filter((a) => a.abstand !== null);
    const mittel = (liste, k) => (liste.length ? liste.reduce((s, a) => s + a[k], 0) / liste.length : null);
    const zeilen = [];
    if (fuehrerFahrten.length) zeilen.push([t('battle.mittelFuehrer'), f1(mittel(fuehrerFahrten, 'punkte'))]);
    if (verfolgerFahrten.length) zeilen.push([t('battle.mittelVerfolger'), f1(mittel(verfolgerFahrten, 'endpunkte'))]);
    zeilen.push(...aufschluesselungZeilen(aufschluesselungZusammenfassen(this.spielerFahrten)));
    for (const p of r.posten) zeilen.push([t('battle.posten.' + p.text, { n: this.perfekt }), '+' + zahl(p.betrag)]);
    const meldungen = [];
    if (zus.entscheidung === 'fuehrerpunkte') meldungen.push(t('battle.entscheidungFuehrer'));
    if (zus.entscheidung === 'muenzwurf') meldungen.push(t('battle.entscheidungMuenze'));
    for (const f of r.freischaltungen) {
      if (f.art === 'strecke') meldungen.push(t('battle.neueStrecke', { name: streckenDef(f.id).name }));
      if (f.art === 'stufe') meldungen.push(t('battle.neueStufe', { name: botStufe(f.id).name }));
    }
    ergebnisZeigen(this.spiel, {
      titel: t(sieg ? 'battle.sieg' : 'battle.niederlage'),
      untertitel: t('battle.ergebnisUnter', { strecke: this.S.name, name, stufe: this.stufe.name, format: t('battle.format.' + this.format), a: zus.siegeA, b: zus.siegeB }),
      sieg,
      tabelle,
      zeilen,
      belohnung: r.belohnung,
      meldungen,
      knoepfe: [
        { text: t('ergebnis.revanche'), art: 'haupt', aktion: () => this.neustart() },
        { text: t('battle.andereWahl'), aktion: () => this._neueWahl() },
        { text: t('ergebnis.menue'), aktion: () => this.beenden() }
      ]
    });
  }

  /** Zurück zur Battle-Auswahl (mit der bisherigen Wahl vorbelegt). */
  async _neueWahl() {
    const { Hauptmenue } = await import('./hauptmenue.js');
    const { botBattleWahl } = await import('./menueEintraege.js');
    const menue = new Hauptmenue('spielen');
    const k = this.konfig;
    menue.nachBetreten = () => botBattleWahl(menue, this.spiel, { streckeId: k.streckeId, stufe: k.stufe, gegnerId: k.gegnerId, format: k.format });
    this.spiel.wechsleModus(menue);
  }

  pause() {
    if (this.zwischenOffen) return; // Zwischenstand-Dialog ist offen, die Autos rollen nur aus
    super.pause();
  }

  /** Beenden aus dem Pause-Menü: ein laufendes Battle endet ohne Belohnung (mit Rückfrage). */
  async beendenAusPause() {
    if (this.zustand === 'ende' || await bestaetigen(t('battle.abbrechenTitel'), t('battle.abbrechenText'), { jaText: t('battle.abbrechen'), gefahr: true })) {
      this.beenden();
    } else {
      this.pausiert = false;
      this.pause(); // Pause-Menü wieder öffnen
    }
  }

  hudAktualisieren() {
    const d = this.durchgang;
    const rest = this.durchgangLaeuft ? this.S.zeitLimit - (this.zeit - this.durchgangStart) : null;
    let status = t('battle.status', { lauf: d.laufNr, durchgang: d.durchgangNr, a: this.ablauf.siegeA, b: this.ablauf.siegeB });
    if (d.wiederholung) status += ' · ' + t('battle.wiederholung');
    if (this.zustand === 'laeuft' && !this.durchgangLaeuft) status = t('battle.zurLinie');
    this.hud.stand({
      rolle: t(this.spielerFuehrt ? 'hud.fuehrer' : 'hud.verfolger'),
      rolleArt: this.spielerFuehrt ? 'fuehrer' : 'verfolger',
      status,
      zeit: rest,
      zeitWarnung: rest !== null && rest < 10
    });
    const pF = this.wFuehrer.punkte;
    const pV = verfolgerEndpunkte(this.wVerfolger.punkte, pF);
    const w = this.spielerFuehrt ? this.wFuehrer : this.wVerfolger;
    this.hud.punkte({
      ich: this.spielerFuehrt ? pF : pV,
      gegner: this.spielerFuehrt ? pV : pF,
      gegnerName: this.gegner.name,
      combo: w.combo,
      comboAnteil: w.comboAnteil
    });
    const a = this.spieler.darstellung, b = this.botAuto.darstellung;
    const abstand = Math.hypot(a.x - b.x, a.y - b.y);
    this.hud.abstandAnzeigen(abstand, abstandsBewertung(abstand));
    this._namensschild(abstand);
  }

  /** Namensschild über dem Gegnerauto (Projektion der Weltposition auf den Bildschirm). */
  _namensschild(abstand) {
    const b = this.botAuto.darstellung;
    const v = zuWelt(b.x, b.y, 1.9, this._v).project(this.kamera);
    const el = this.hud.el;
    const sichtbar = abstand < 90 && abstand > 2.5 && v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    this.hud.namensschild(this.gegner.name, ((v.x + 1) / 2) * el.clientWidth, ((1 - v.y) / 2) * el.clientHeight, sichtbar, abstand);
  }
}

function neuerSeed() {
  const z = new Uint32Array(1);
  crypto.getRandomValues(z);
  return z[0];
}
