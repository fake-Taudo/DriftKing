// Online-Duell: Jeder Client simuliert nur sein eigenes Auto (verzögerungsfrei) und meldet 25-mal pro Sekunde seinen
// Zustand. Der Server steuert Countdown, Rollentausch und Ablauf und berechnet die Wertung; das gegnerische Auto wird
// mit Puffer interpoliert. Das Spiel läuft auch bei offenem Menü weiter.
import * as THREE from 'three';
import { Rennen } from './rennen.js';
import { Interpolator } from '../../shared/interpolator.js';
import { autoKontakt } from '../../shared/physik/fahrzeug.js';
import { Rundenzaehler } from '../../shared/rundenLogik.js';
import { abstandsBewertung } from '../../shared/wertung.js';
import { BotFahrer } from '../../shared/bots/botFahrer.js';
import { botStufe } from '../../shared/bots/botStufen.js';
import { FLAG, zustandPacken, zustandEntpacken } from '../../shared/netzwerkSchema.js';
import { onlineErgebnisBuchen, statistikVerbuchen } from '../../shared/oekonomie.js';
import { lokalesDatum } from '../../shared/tagesaufgaben.js';
import { duellSitzung } from '../netz/duellSitzung.js';
import { pauseMenue } from '../ui/pause.js';
import { ergebnisZeigen } from '../ui/bildschirme/ergebnis.js';
import { ereignisseAnzeigen } from './rennenWertung.js';
import { zuWelt } from '../render/koordinaten.js';
import { h, toast } from '../ui/dom.js';
import { t, zahl } from '../i18n/de.js';

const f1 = (x) => zahl(x, 1);
const SENDEN_ALLE = 0.04; // s (25 Hz)
const PING_ALLE = 2; // s
const PING_MITTEL = 90; // ms
const PING_SCHLECHT = 180; // ms
const LUECKEN_MITTEL = 0.08; // Anteil der Bilder ohne aktuellen Zustand
const LUECKEN_SCHLECHT = 0.25;

export class OnlineDuell extends Rennen {
  /**
   * @param {{streckeId:string, format:string, einheitsPI:number|null, seite:'A'|'B', gegner:object, spieler:object, autopilot?:string}} konfig
   */
  constructor(konfig) {
    super({ ...konfig, art: 'online' });
    this.seq = 0;
    this.sendeAkku = 0;
    this.pingAkku = 0;
    this.rolle = 'verfolger';
    this.stand = { du: 0, gegner: 0, combo: 1, anteil: 0, rest: null };
    this.laeuftWertung = false;
    this.interp = new Interpolator();
    this._v = new THREE.Vector3();
    this.auslaufOhneEingabe = false;
  }

  async betreten(spiel) {
    this.sitzung = duellSitzung(spiel);
    this.netz = spiel.netz;
    await super.betreten(spiel);
    const n = this.netz;
    this._abNetz = [
      n.an('startCountdown', (m) => this._durchgangVorbereiten(m)),
      n.an('gegner', (m) => this.interp.hinzufuegen(zustandEntpacken(m.d), m.s, n.serverZeit())),
      n.an('wertungStart', () => { this.laeuftWertung = true; }),
      n.an('punkte', (m) => { this.stand = m; }),
      n.an('ereignis', (m) => ereignisseAnzeigen(this, [m.e])),
      n.an('durchgangEnde', (m) => this._durchgangEnde(m)),
      n.an('ergebnis', (m) => this._ergebnis(m)),
      n.an('emote', (m) => { if (m.von !== this.konfig.seite) this.hud.popup(t('online.emote.' + m.id), 'combo'); }),
      n.an('gegnerVerbindung', (m) => {
        if (m.weg) this.hud.meldungZeigen(t('online.gegnerWeg'), 15, 'gefahr');
        else this.hud.meldungZeigen(t('online.gegnerZurueck'), 2, 'erfolg');
      }),
      n.an('_getrennt', () => this.hud.meldungZeigen(t('online.verbindungVerloren'), 15, 'gefahr')),
      n.an('wiederverbunden', () => this.hud.meldungZeigen(t('online.wiederVerbunden'), 2, 'erfolg')),
      spiel.ereignisse.an('duellVerloren', () => this._duellVerloren())
    ];
    if (this.sitzung.letzterCountdown) this._durchgangVorbereiten(this.sitzung.letzterCountdown);
    this.netz.uhrMessen(4);
  }

  aufstellen() {
    const k = this.konfig;
    const S = this.S;
    this.spieler = this.autoHinzufuegen({ ...k.spieler, einheitsPI: k.einheitsPI || undefined, rolle: 'spieler', name: k.spieler.name, farbe: '#2ee6ff' });
    this.gegnerAuto = this.autoHinzufuegen({ autoId: k.gegner.autoId, look: k.gegner.look, einheitsPI: k.einheitsPI || undefined, rolle: 'netz', name: k.gegner.name, farbe: '#ff3d6e', netz: true });
    this.gegnerAuto.netzDarstellung = () => this._gegnerDarstellung();
    this.spieler.runden = new Rundenzaehler(S, S.start.fuehrer);
    const st = S.start.verfolger;
    this.spieler.fahrzeug.setzen(st.x, st.y, st.theta, 0);
    this.gegnerAuto.fahrzeug.setzen(S.start.fuehrer.x, S.start.fuehrer.y, S.start.fuehrer.theta, 0);
  }

  /** Vor der ersten Ankündigung: warten. Danach steuert der Server den Ablauf. */
  starten() {
    this.zeit = 0;
    this.zustand = 'warten';
    this.countdown = 0;
    this._countdownWert = null;
    this.rennKamera.erstesBild = true;
  }

  neustart() { /* Im Duell gibt es keinen Neustart */ }

  /** Der Server kündigt einen Durchgang an: aufstellen und bis zum gemeinsamen Start warten. */
  _durchgangVorbereiten(m) {
    if (m.dgNr === this.aktuellerDurchgang) return; // nach einer Wiederverbindung erneut gesendet
    this.aktuellerDurchgang = m.dgNr;
    const S = this.S;
    this.rolle = m.rolle;
    this.anzeige = m;
    this.zwischen?.remove();
    this.zwischen = null;
    const st = m.rolle === 'fuehrer' ? S.start.fuehrer : S.start.verfolger;
    const sp = this.spieler;
    sp.fahrzeug.setzen(st.x, st.y, st.theta, 0);
    sp.runden.zuruecksetzen(st);
    sp.haenger.zuruecksetzen();
    sp.zurueckgesetzt = true; // erlaubt dem Server den Sprung an die Startposition
    this.interp.zuruecksetzen();
    const g = m.rolle === 'fuehrer' ? S.start.verfolger : S.start.fuehrer;
    this.gegnerAuto.fahrzeug.setzen(g.x, g.y, g.theta, 0);
    this.laeuftWertung = false;
    this.stand = { du: 0, gegner: 0, combo: 1, anteil: 0, rest: null };
    this.auslaufOhneEingabe = false;
    this.zeit = 0;
    this.zustand = 'countdown';
    this.countdown = Math.max(0.61, (m.startZeit - this.netz.serverZeit()) / 1000 + 0.6);
    this._countdownWert = null;
    this.rennKamera.erstesBild = true;
    this.hud.countdownZeigen('');
    this.hud.meldungZeigen(t(m.rolle === 'fuehrer' ? 'battle.duFuehrst' : 'battle.duVerfolgst', { name: this.konfig.gegner.name }), 3, m.rolle === 'fuehrer' ? '' : 'erfolg');
    this.spiel.eingabe.touch.zeigen(this.spiel.eingabe.istTouch);
    if (this.konfig.autopilot) {
      this.autopilot = new BotFahrer(S, sp.fahrzeug, botStufe(this.konfig.autopilot), { seed: `${this.konfig.seite}${m.laufIndex}${m.durchgangNr}`, rolle: m.rolle });
      if (m.rolle === 'verfolger') this.autopilot.setzeGegner(this.gegnerAuto.fahrzeug);
    }
  }

  schritt(dt) {
    super.schritt(dt);
    this._gegnerFuerKontakt();
    if (this.zustand === 'laeuft' || this.zustand === 'ziel') {
      if (autoKontakt(this.spieler.fahrzeug, this.gegnerAuto.fahrzeug, { nurA: true })) this._kontakt = true;
    }
    this.sendeAkku += dt;
    if (this.sendeAkku >= SENDEN_ALLE && this.zustand !== 'warten') {
      this.sendeAkku -= SENDEN_ALLE;
      this._zustandMelden();
    }
    this.pingAkku += dt;
    if (this.pingAkku >= PING_ALLE) {
      this.pingAkku = 0;
      this.netz.uhrMessen(1);
      this.luecken = this.interp.lueckenAnteil();
    }
  }

  /** Eingabe-Flags für die AFK-Erkennung und die Anzeige beim Gegner. */
  _zustandMelden() {
    const sp = this.spieler;
    const e = this.letzteEingabe || {};
    const flags = (e.gas > 0.02 ? FLAG.GAS : 0)
      | (e.bremse > 0.02 ? FLAG.BREMSE : 0)
      | (e.handbremse ? FLAG.HANDBREMSE : 0)
      | (Math.abs(e.lenken || 0) > 0.02 ? FLAG.LENKEN : 0)
      | (sp.zurueckgesetzt ? FLAG.ZURUECKGESETZT : 0);
    sp.zurueckgesetzt = false;
    this.netz.senden({ t: 'zustand', d: zustandPacken(++this.seq, sp.fahrzeug.momentaufnahme(), flags) });
  }

  /** Stand des Gegners zur Darstellungszeit (für Kontakt und Bot-Regler). */
  _gegnerFuerKontakt() {
    const a = this.interp.abfragen(this.interp.darstellungsZeit(this.netz.serverZeit()), 0);
    if (!a) return;
    const z = this.gegnerAuto.fahrzeug.z;
    z.x = a.x;
    z.y = a.y;
    z.theta = a.theta;
    z.vx = a.vx;
    z.vy = a.vy;
    z.r = a.r;
  }

  /** Darstellung (pro Bild), weich geblendet. Die Räder drehen passend zum Tempo mit. */
  _gegnerDarstellung() {
    const dt = this._frameDt || 0;
    const a = this.interp.abfragen(this.interp.darstellungsZeit(this.netz.serverZeit()), dt);
    const f = this.gegnerAuto.fahrzeug;
    const z = f.z;
    if (a) {
      const R = f.p.radRadius;
      const w = (a.vx / R) * dt;
      z.radWinkelV = (z.radWinkelV || 0) + w;
      z.radWinkelH = (z.radWinkelH || 0) + w * ((a.flags & FLAG.GAS) && Math.abs(a.vy) > 2 ? 2 : 1);
      z.radGeschwV = a.vx / R;
      z.radGeschwH = z.radGeschwV;
      z.bremsEff = a.flags & FLAG.BREMSE ? 1 : 0;
      z.handbremse = !!(a.flags & FLAG.HANDBREMSE);
      return { x: a.x, y: a.y, theta: a.theta, vx: a.vx, vy: a.vy, tempo: a.tempo };
    }
    return { x: z.x, y: z.y, theta: z.theta, vx: 0, vy: 0, tempo: 0 };
  }

  frame(frameDt, alpha, eingabe, aktionen) {
    this._frameDt = frameDt;
    super.frame(frameDt, alpha, eingabe, aktionen);
  }

  rundenEreignis(a, ev) {
    if (a === this.spieler && ev.art === 'falschrum') super.rundenEreignis(a, ev);
  }

  /** Das Duell läuft weiter, das Menü zeigt nur Einstellungen und „Aufgeben“. */
  pause() {
    if (document.querySelector('.pause-menue')) return;
    pauseMenue(this.spiel, {
      online: true,
      fortsetzen: () => {},
      beenden: () => {},
      aufgeben: () => this.netz.senden({ t: 'aufgeben' })
    });
  }

  beiVerstecken() { /* Kein Pausieren: Der Gegner fährt weiter */ }
  beiFokusVerlust() { /* dito */ }

  hudAktualisieren() {
    const m = this.anzeige;
    const k = this.konfig;
    if (m) {
      let status = t('battle.status', { lauf: m.laufNr, durchgang: m.durchgangNr, a: m.siegeA, b: m.siegeB });
      if (m.wiederholung) status += ' · ' + t('battle.wiederholung');
      if (this.zustand === 'laeuft' && !this.laeuftWertung) status = t('battle.zurLinie');
      const rest = this.laeuftWertung ? this.stand.rest : null;
      this.hud.stand({ rolle: t(this.rolle === 'fuehrer' ? 'hud.fuehrer' : 'hud.verfolger'), rolleArt: this.rolle, status, zeit: rest, zeitWarnung: rest !== null && rest < 10 });
    } else {
      this.hud.stand({ rolle: t('online.titel'), rolleArt: 'einzel', status: t('online.wartenAufStart') });
    }
    this.hud.punkte({ ich: this.stand.du, gegner: this.stand.gegner, gegnerName: k.gegner.name, combo: this.stand.combo, comboAnteil: this.stand.anteil });
    const a = this.spieler.darstellung, b = this.gegnerAuto.darstellung;
    if (b && b.x !== undefined) {
      const abstand = Math.hypot(a.x - b.x, a.y - b.y);
      this.hud.abstandAnzeigen(abstand, abstandsBewertung(abstand));
      const v = zuWelt(b.x, b.y, 1.9, this._v).project(this.kamera);
      const el = this.hud.el;
      const sichtbar = this.spiel.daten.einstellungen.anzeige.namensTag && abstand < 90 && abstand > 2.5 && v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      this.hud.namensschild(k.gegner.name, ((v.x + 1) / 2) * el.clientWidth, ((1 - v.y) / 2) * el.clientHeight, sichtbar, abstand);
    }
    this._verbindungAnzeigen();
  }

  /** Ping und Verbindungsqualität im HUD, einmal je Duell ein Warnhinweis. */
  _verbindungAnzeigen() {
    const ping = this.netz.ping;
    const l = this.luecken || 0;
    const guete = ping > PING_SCHLECHT || l > LUECKEN_SCHLECHT ? 'schlecht' : ping > PING_MITTEL || l > LUECKEN_MITTEL ? 'mittel' : 'gut';
    this.hud.pingAnzeigen(ping || null, guete);
    if (guete === 'schlecht' && !this._warnungGezeigt && this.zustand === 'laeuft') {
      this._warnungGezeigt = true;
      this.hud.meldungZeigen(t('online.schlechteVerbindung'), 3, 'gefahr');
    }
  }

  _durchgangEnde(m) {
    if (m.dgNr <= (this.letztesDurchgangEnde || 0)) return; // nach einer Wiederverbindung erneut gesendet
    this.letztesDurchgangEnde = m.dgNr;
    this.laeuftWertung = false;
    this.zustand = 'ziel';
    const d = this.spiel.daten;
    statistikVerbuchen(d, m.wertung);
    this.spiel.ereignisse.senden('fahrtGewertet', { rolle: m.rolleDu, wertung: m.wertung });
    this.hud.meldungZeigen(m.grund === 'zeit' ? t('rennen.zeitAbgelaufen') : t('battle.durchgangEnde'), 2.2, m.grund === 'zeit' ? 'gefahr' : 'erfolg');
    const ich = m.rolleDu === 'fuehrer' ? m.fuehrerPunkte : m.verfolgerPunkte;
    const er = m.rolleDu === 'fuehrer' ? m.verfolgerPunkte : m.fuehrerPunkte;
    setTimeout(() => {
      if (this.spiel.modus !== this || m.battleEnde) return;
      this.auslaufOhneEingabe = true;
      this.zwischen?.remove();
      const seite = this.konfig.seite;
      const rolle = (r) => t(r === 'fuehrer' ? 'hud.fuehrer' : 'hud.verfolger');
      const andere = m.rolleDu === 'fuehrer' ? 'verfolger' : 'fuehrer';
      let titel = t('battle.durchgangTitel', { n: this.anzeige?.durchgangNr ?? 1 });
      let unter = t('battle.naechsterTausch');
      if (m.laufEnde && m.lauf) {
        if (m.lauf.gleichstand) {
          titel = t('battle.gleichstandTitel');
          unter = t('battle.gleichstandText');
        } else {
          titel = t(m.lauf.sieger === seite ? 'battle.laufGewonnen' : 'battle.laufVerloren', { n: this.anzeige?.laufNr ?? 1 });
          unter = t('battle.stand', { a: seite === 'A' ? m.siegeA : m.siegeB, b: seite === 'A' ? m.siegeB : m.siegeA });
        }
      }
      this.zwischen = h('section.online-zwischen.panel',
        h('h2', titel),
        h('div.ergebnis-untertitel', unter),
        h('div.ergebnis-zeile', h('span', t('battle.duAls', { rolle: rolle(m.rolleDu) })), h('span.zahl', f1(ich))),
        h('div.ergebnis-zeile', h('span', t('battle.gegnerAls', { name: this.konfig.gegner.name, rolle: rolle(andere) })), h('span.zahl', f1(er))),
        h('div.battle-hinweis', t('online.gleichGehtsWeiter'))
      );
      this.spiel.uiWurzel.appendChild(this.zwischen);
    }, 2200);
  }

  _ergebnis(m) {
    this.zwischen?.remove();
    this.zwischen = null;
    this.zustand = 'ende';
    const d = this.spiel.daten;
    const r = onlineErgebnisBuchen(d, { duellId: m.duellId, gegnerId: m.gegnerId, betrag: m.belohnung, sieg: m.sieg, datum: lokalesDatum() });
    if (m.regulaer) this.spiel.ereignisse.senden('onlineDuellEnde', { sieg: m.sieg });
    this.spiel.speicher.sofortSpeichern();
    this.spiel.ereignisse.senden('spielstandGeaendert');
    const z = m.zusammenfassung;
    const seite = this.konfig.seite;
    const name = this.konfig.gegner.name;
    const ich = (l) => (seite === 'A' ? l.a : l.b);
    const er = (l) => (seite === 'A' ? l.b : l.a);
    const zeile = (e) => `${f1(e.fuehrer)} + ${f1(e.verfolger)} = ${f1(e.summe)}`;
    const meldungen = [];
    if (m.grund) meldungen.push(t('online.grund.' + m.grund + (m.sieg ? 'Sieg' : 'Niederlage')));
    if (m.grund && m.sieg) meldungen.push(t(m.belohnung > 0 ? 'online.halbeBelohnung' : 'online.keineBelohnungAbbruch'));
    if (m.regulaer && m.belohnung > 0 && r.betrag === 0 && r.grund === 'tag') meldungen.push(t('online.limitErreicht'));
    if (m.regulaer && m.belohnung > 0 && r.betrag === 0 && r.grund === 'gegner') meldungen.push(t('online.limitGegner'));
    if (m.regulaer && m.belohnung === 0) meldungen.push(t('online.keineBelohnung'));
    if (z.entscheidung === 'fuehrerpunkte') meldungen.push(t('battle.entscheidungFuehrer'));
    if (z.entscheidung === 'muenzwurf') meldungen.push(t('battle.entscheidungMuenze'));
    // Ist der Gegner endgültig weg, gibt es keine Revanche (die Lobby wird gleich aufgelöst)
    const lobbyDa = !!this.sitzung.token && m.grund !== 'verbindung' && m.grund !== 'verlassen';
    ergebnisZeigen(this.spiel, {
      titel: t(m.sieg ? 'battle.sieg' : 'battle.niederlage'),
      untertitel: t('online.ergebnisUnter', { strecke: this.S.name, name, format: t('battle.format.' + z.format) }),
      sieg: m.sieg,
      tabelle: z.laeufe.length ? {
        kopf: [t('battle.lauf'), t('hud.du'), name, t('battle.sieger')],
        zeilen: z.laeufe.map((l) => [
          String(l.nummer) + (l.wiederholung ? ' ' + t('battle.wiederholungKurz') : ''),
          zeile(ich(l)),
          zeile(er(l)),
          l.gleichstand ? t('battle.gleichstand') : l.sieger === seite ? t('hud.du') : name
        ])
      } : null,
      belohnung: r.betrag,
      meldungen,
      knoepfe: [
        lobbyDa ? { text: t('ergebnis.revanche'), art: 'haupt', aktion: () => this._zurueckZurLobby() } : null,
        { text: t('ergebnis.menue'), art: lobbyDa ? undefined : 'haupt', aktion: () => this._zumMenue() }
      ].filter(Boolean)
    });
  }

  /** Zurück in die Lobby (Revanche). */
  async _zurueckZurLobby() {
    const { Hauptmenue } = await import('./hauptmenue.js');
    const { onlineOeffnen } = await import('../ui/bildschirme/onlineLobby.js');
    const menue = new Hauptmenue('haupt');
    menue.nachBetreten = () => onlineOeffnen(menue, this.spiel);
    this.spiel.wechsleModus(menue);
  }

  async _zumMenue() {
    if (this.sitzung.token) this.sitzung.verlassen();
    this.beenden();
  }

  /** Verbindung nicht wiederhergestellt: zurück ins Menü. */
  _duellVerloren() {
    if (this.zustand === 'ende') return;
    toast(t('online.duellVerloren'), { art: 'fehler', dauer: 6000 });
    this.beenden();
  }

  verlassen() {
    for (const aus of this._abNetz || []) aus();
    this.zwischen?.remove();
    super.verlassen();
  }
}
