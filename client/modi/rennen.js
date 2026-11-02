// Rennmodus (Basis für Freies Fahren, Zeitangriff, Bot-Battle, Online-Duell, Tutorial):
// Strecke + Umgebung + Autos (Spieler, Bots, Netz-Gegner) + Kamera + HUD + Minimap,
// Countdown, Rundenlogik, Hänger-Erkennung, Pause, Speicherfreigabe beim Verlassen.
import * as THREE from 'three';
import { Fahrzeug, autoKontakt } from '../../shared/physik/fahrzeug.js';
import { effektiveParameter } from '../../shared/tuning.js';
import { HaengerErkennung } from '../../shared/physik/haenger.js';
import { Rundenzaehler, zuruecksetzPosition } from '../../shared/rundenLogik.js';
import { baueStrecke } from '../../shared/strecken/streckenBau.js';
import { streckenDef } from '../../shared/strecken/index.js';
import { GRAD } from '../../shared/mathe.js';
import { RennKamera } from '../render/kamera.js';
import { Umgebung } from '../render/umgebung.js';
import { StreckeModell } from '../render/strecke/streckeModell.js';
import { AutoModell } from '../render/auto/autoModell.js';
import { RennVfx } from '../render/vfx/rennVfx.js';
import { winkelLerp } from '../render/koordinaten.js';
import { Hud } from '../ui/hud.js';
import { Minimap } from '../ui/minimap.js';
import { pauseMenue } from '../ui/pause.js';
import { BotFahrer } from '../../shared/bots/botFahrer.js';
import { botStufe } from '../../shared/bots/botStufen.js';
import { t } from '../i18n/de.js';
import { displayWachHalten } from '../core/geraet.js';

const streckenCache = new Map();
/** Laufzeit-Strecke (zwischengespeichert, da der Aufbau einige Millisekunden dauert). */
export function strecke(id) {
  if (!streckenCache.has(id)) streckenCache.set(id, baueStrecke(streckenDef(id)));
  return streckenCache.get(id);
}

/** Interpolierter Darstellungszustand eines Fahrzeugs. */
function interpoliert(f, alpha, ziel = {}) {
  const z = f.z, v = f.vorher;
  ziel.x = v.x + (z.x - v.x) * alpha;
  ziel.y = v.y + (z.y - v.y) * alpha;
  ziel.theta = winkelLerp(v.theta, z.theta, alpha);
  ziel.vx = z.vx;
  ziel.vy = z.vy;
  ziel.tempo = f.tempo;
  return ziel;
}

export class Rennen {
  /**
   * @param {object} konfig
   *   art: 'frei' | 'zeitangriff' | 'battle' | 'online' | 'tutorial'
   *   streckeId, spieler: {autoId, look, tuning, setup, name}, runden (Zeitangriff)
   */
  constructor(konfig) {
    this.konfig = konfig;
    this.art = konfig.art;
    this.zustand = 'laden'; // 'countdown' | 'laeuft' | 'ziel' | 'ende'
    this.zeit = 0;
    this.countdown = 0;
    this.pausiert = false;
    this.autos = []; // {fahrzeug, modell, rolle, bot?, name, farbe, runden, darstellung}
    this._hoerer = [];
    this._aktionen = { hoch: false, runter: false };
    this.fahrzeit = 0; // reine Fahrzeit (für die Statistik)
  }

  async betreten(spiel) {
    this.spiel = spiel;
    const e = spiel.daten.einstellungen;
    this.S = strecke(this.konfig.streckeId);
    const S = this.S;
    this.szene = new THREE.Scene();
    this.rennKamera = new RennKamera(spiel.renderer.seitenverhaeltnis);
    this.rennKamera.setzeModus(e.kamera);
    this.rennKamera.reduziert = spiel.wenigerEffekte;
    this.kamera = this.rennKamera.kamera;
    this.umgebung = new Umgebung(spiel.renderer.renderer, this.szene);
    this.umgebung.setze(S.def.licht);
    this.umgebung.qualitaet(spiel.qualitaet.aktuell);
    this.streckeModell = new StreckeModell(S, spiel.qualitaet.aktuell);
    this.szene.add(this.streckeModell.objekt);
    this.nacht = S.def.tageszeit === 'Nacht';

    this.aufstellen();
    this.vfx = new RennVfx(this);

    this.minimap = new Minimap(S, 150);
    this.hud = new Hud(spiel.uiWurzel, {
      minimap: this.minimap,
      battle: this.istBattle,
      onPause: () => this.pause(),
      onZuruecksetzen: () => this.spielerZuruecksetzen(true)
    });
    spiel.eingabe.touch.zeigen(spiel.eingabe.istTouch);
    this._hoerer.push(
      spiel.ereignisse.an('eingabeGeraet', (g) => spiel.eingabe.touch.zeigen(g === 'touch' && !this.pausiert)),
      spiel.ereignisse.an('groesse', ({ breite, hoehe }) => this.rennKamera.seitenverhaeltnis(breite / hoehe)),
      spiel.ereignisse.an('qualitaet', (q) => this._qualitaet(q)),
      spiel.ereignisse.an('einstellungen', () => this._einstellungenNeu())
    );
    spiel.qualitaet.messungAktiv(true);
    displayWachHalten(true);
    this.starten();
  }

  get istBattle() {
    return this.art === 'battle' || this.art === 'online';
  }

  /** Assistenzen aus den Einstellungen (Drift-Haltehilfe standardmäßig nur bei Touch). */
  _assistenz() {
    const e = this.spiel.daten.einstellungen;
    const touch = this.spiel.eingabe.istTouch;
    const modus = e.assistenz.driftHaltenModus;
    const halten = modus === 'aus' ? 0 : modus === 'an' || touch ? e.assistenz.driftHalten / 100 : 0;
    return { gegenlenken: e.assistenz.gegenlenken / 100, driftHalten: halten, getriebe: touch ? 'auto' : e.getriebe };
  }

  /** Baut ein Auto (Physik + Modell) und fügt es hinzu. */
  autoHinzufuegen({ autoId, look, tuning, setup, einheitsPI, rolle, name, farbe, bot = null, netz = false }) {
    const p = effektiveParameter(autoId, { tuning, setup, look, einheitsPI });
    const f = new Fahrzeug(p, rolle === 'spieler' ? this._assistenz() : { gegenlenken: 0.6, driftHalten: 0, getriebe: 'auto' });
    const modell = new AutoModell(autoId, look, { qualitaet: this.spiel.qualitaet.aktuell, nacht: this.nacht });
    this.szene.add(modell.objekt);
    const eintrag = { fahrzeug: f, modell, rolle, name, farbe, bot, netz, darstellung: {}, haenger: new HaengerErkennung(), runden: null, autoId };
    this.autos.push(eintrag);
    return eintrag;
  }

  /** Stellt die Autos auf (von Unterklassen erweitert). */
  aufstellen() {
    const sp = this.konfig.spieler;
    this.spieler = this.autoHinzufuegen({ ...sp, rolle: 'spieler', name: sp.name, farbe: '#2ee6ff' });
    const st = this.S.start.einzel;
    this.spieler.fahrzeug.setzen(st.x, st.y, st.theta, 0);
    this.spieler.runden = new Rundenzaehler(this.S, st);
    // Autopilot (nur für Messungen/Tests, z. B. ?perf=1): ein Bot fährt das Spielerauto
    if (this.konfig.autopilot) {
      this.autopilot = new BotFahrer(this.S, this.spieler.fahrzeug, botStufe(this.konfig.autopilot), { seed: 1, modus: 'drift' });
    }
  }

  /** Start bzw. Neustart. */
  starten() {
    this.zeit = 0;
    this.zustand = this.art === 'frei' ? 'laeuft' : 'countdown';
    this.countdown = this.art === 'frei' ? 0 : 3.6;
    this._countdownWert = null;
    const st = this.S.start.einzel;
    this.spieler.fahrzeug.setzen(st.x, st.y, st.theta, 0);
    this.spieler.runden.zuruecksetzen(st);
    this.spieler.haenger.zuruecksetzen();
    this.bestRunde = null;
    this.rennKamera.erstesBild = true;
    this.hud.countdownZeigen('');
    this.vfx?.leeren();
  }

  /** Ende des Countdowns: fliegender Start. */
  los() {
    this.zustand = 'laeuft';
    this.spiel.audio?.ton?.('los');
  }

  pause() {
    if (this.pausiert || this.zustand === 'ende') return;
    this.pausiert = true;
    this.spiel.schleife.physikAktiv = false;
    this.spiel.eingabe.touch.zeigen(false);
    this.spiel.audio?.pausieren?.(true);
    pauseMenue(this.spiel, {
      online: false,
      fortsetzen: () => this.fortsetzen(),
      neustart: () => { this.fortsetzen(); this.neustart(); },
      beenden: () => this.beendenAusPause()
    });
  }

  /** „Beenden“ im Pause-Menü (Battle fragt vorher nach). */
  beendenAusPause() {
    this.beenden();
  }

  fortsetzen() {
    this.pausiert = false;
    this.spiel.schleife.zuruecksetzen();
    this.spiel.schleife.physikAktiv = true;
    this.spiel.eingabe.touch.zeigen(this.spiel.eingabe.istTouch);
    this.spiel.audio?.pausieren?.(false);
  }

  neustart() {
    this.starten();
  }

  /** Zurück ins Hauptmenü. */
  async beenden() {
    const { Hauptmenue } = await import('./hauptmenue.js');
    this.spiel.wechsleModus(new Hauptmenue());
  }

  beiVerstecken() {
    // Tab-Wechsel/Fensterverlust: automatisch pausieren
    if (!this.pausiert && this.zustand !== 'ende') this.pause();
  }

  beiFokusVerlust() {
    this.beiVerstecken();
  }

  _qualitaet(q) {
    this.umgebung.qualitaet(q);
    for (const a of this.autos) a.modell.qualitaet(q);
    this.vfx?.einstellungenNeu();
  }

  /** Kurze Zeitlupe für große Momente: nie online und nicht bei reduzierten Effekten. */
  zeitlupe(dauer, faktor) {
    if (this.art === 'online' || this.spiel.wenigerEffekte) return;
    this._zeitlupeBis = performance.now() / 1000 + dauer;
    this.spiel.schleife.zeitFaktor = faktor;
  }

  _einstellungenNeu() {
    const e = this.spiel.daten.einstellungen;
    this.rennKamera.reduziert = this.spiel.wenigerEffekte;
    this.vfx?.einstellungenNeu();
    Object.assign(this.spieler.fahrzeug.assistenz, this._assistenz());
    void e;
  }

  /** Zurücksetzen auf die Strecke (strafe: im Battle mit Punktabzug). */
  spielerZuruecksetzen(manuell = false) {
    const a = this.spieler;
    const f = a.fahrzeug;
    const r = zuruecksetzPosition(this.S, f.z.x, f.z.y, a.runden.index);
    f.setzen(r.x, r.y, r.theta, 6);
    a.haenger.zuruecksetzen();
    a.zurueckgesetzt = true; // für die Wertung (Abzug beim nächsten Tick)
    this.hud.resetAnzeigen(false);
    this.rennKamera.erstesBild = true;
    this.nachZuruecksetzen?.(a, manuell);
  }

  // ---------------------------------------------------------------------------
  // Spielschritt (fester Zeitschritt)

  schritt(dt) {
    if (this.pausiert || this.zustand === 'warten') return;
    if (this.zustand === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0.6 && this.zustand === 'countdown') this.los();
      this.autosHalten?.();
      return;
    }
    this.zeit += dt;
    if (this.zustand === 'laeuft') {
      this.fahrzeit += dt;
      if (!this.konfig.autopilot) this.spiel.aufgaben?.fahrtSchritt(this.spieler.fahrzeug, dt);
    }
    // Spieler
    const sp = this.spieler;
    if (sp && !sp.netzGesteuert) {
      const eingabe = this.zustand === 'ende' || this.zustand === 'ziel' && this.auslaufOhneEingabe
        ? { lenken: 0, gas: 0, bremse: 0.3, handbremse: 0, kupplung: 0 }
        : this.autopilot ? this.autopilot.schritt(dt)
          : { ...this.spiel.eingabe.werte, hoch: this._aktionen.hoch, runter: this._aktionen.runter };
      this._aktionen.hoch = this._aktionen.runter = false;
      this.letzteEingabe = eingabe;
      sp.fahrzeug.schritt(eingabe, dt, this.S.gitter);
    }
    // Bots
    for (const a of this.autos) {
      if (!a.bot) continue;
      const e = a.bot.schritt(dt);
      a.fahrzeug.schritt(e, dt, this.S.gitter);
    }
    // Weiche Auto-Auto-Kollision (lokal simulierte Autos)
    for (let i = 0; i < this.autos.length; i++) {
      for (let j = i + 1; j < this.autos.length; j++) {
        const a = this.autos[i], b = this.autos[j];
        if (a.netz || b.netz) continue;
        autoKontakt(a.fahrzeug, b.fahrzeug);
      }
    }
    // Rundenlogik, Hänger, Ereignisse
    for (const a of this.autos) {
      if (a.runden) {
        const ev = a.runden.aktualisieren(a.fahrzeug.z.x, a.fahrzeug.z.y, this.zeit, dt);
        for (const x of ev) {
          if (a === this.spieler && x.art === 'runde' && !this.konfig.autopilot) this.spiel.aufgaben?.runde();
          this.rundenEreignis(a, x);
        }
      }
      const h = a.haenger.aktualisieren(a.fahrzeug.tempo, dt, this.zustand === 'laeuft');
      if (a === this.spieler) {
        this.hud.resetAnzeigen(h.knopf);
        if (h.automatisch) this.spielerZuruecksetzen(false);
      } else if (h.automatisch && a.bot) {
        const r = zuruecksetzPosition(this.S, a.fahrzeug.z.x, a.fahrzeug.z.y, a.runden?.index);
        a.fahrzeug.setzen(r.x, r.y, r.theta, 6);
        a.haenger.zuruecksetzen();
        a.zurueckgesetzt = true;
        this.nachZuruecksetzen?.(a, false);
      }
      for (const ev of a.fahrzeug.ereignisse) this.fahrzeugEreignis(a, ev);
    }
    this.wertungSchritt?.(dt);
    this.regelSchritt?.(dt);
  }

  /** Ereignisse der Physik (Wand, Schalten, Fehlzündung …). */
  fahrzeugEreignis(a, ev) {
    if (a === this.spieler) {
      if (ev.art === 'wand') {
        this.spiel.aufgaben?.wand(ev.staerke);
        this.rennKamera.stoss(Math.min(1, ev.staerke / 12));
        if (ev.staerke > 3) this.spiel.eingabe.gamepad.rumpeln(Math.min(1, ev.staerke / 12), 140);
      }
    }
    this.spiel.audio?.fahrzeugEreignis?.(a, ev);
    this.vfx?.fahrzeugEreignis?.(a, ev);
  }

  /** Rundenereignisse (Start, Checkpoint, Runde, Falschfahrer, Abkürzung). */
  rundenEreignis(a, ev) {
    if (a !== this.spieler) return;
    if (ev.art === 'falschrum') this.hud.meldungZeigen(t('rennen.falschrum'), 2.5, 'gefahr');
    if (ev.art === 'runde') this.spiel.audio?.ton?.('runde');
    if (ev.art === 'runde' && ev.zeit) {
      const neu = this.bestRunde === null || ev.zeit < this.bestRunde;
      if (neu) this.bestRunde = ev.zeit;
      this.hud.meldungZeigen(t('rennen.rundenzeit', { zeit: ev.zeit.toFixed(2) }) + (neu ? ' · ' + t('rennen.bestzeit') : ''), 3, neu ? 'erfolg' : '');
      this.rundeBeendet?.(ev);
    }
  }

  // ---------------------------------------------------------------------------
  // Darstellung (pro Frame)

  frame(frameDt, alpha, eingabe, aktionen) {
    for (const ak of aktionen) {
      if (ak === 'pause' || ak === 'menueZurueck') {
        if (this.pausiert) continue;
        this.pause();
      }
      if (this.pausiert) continue;
      if (ak === 'kamera') {
        const m = this.rennKamera.naechsterModus();
        this.spiel.daten.einstellungen.kamera = m;
        this.spiel.speicher.speichern();
        this.hud.meldungZeigen(t('kamera.' + m), 1.2);
      }
      if (ak === 'zuruecksetzen') {
        if (this.art === 'frei' && this.zustand !== 'ende') this.neustart();
        else if (this.spieler.haenger.stehzeit > 1.5) this.spielerZuruecksetzen(true);
      }
      if (ak === 'hoch') this._aktionen.hoch = true;
      if (ak === 'runter') this._aktionen.runter = true;
    }
    const zeit = performance.now() / 1000;
    if (this._zeitlupeBis && zeit >= this._zeitlupeBis) {
      this._zeitlupeBis = 0;
      this.spiel.schleife.zeitFaktor = 1;
    }
    for (const a of this.autos) {
      const d = a.netz ? a.netzDarstellung(alpha) : interpoliert(a.fahrzeug, this.pausiert ? 1 : alpha, a.darstellung);
      a.darstellung = d;
      a.modell.setzePose(d.x, d.y, d.theta);
      a.modell.aktualisieren(frameDt, a.fahrzeug.z, zeit);
    }
    const sp = this.spieler;
    const f = sp.fahrzeug;
    const d = sp.darstellung;
    this.rennKamera.aktualisieren({ ...d, hoechst: f.p.hoechstKmhAuslegung / 3.6 }, frameDt, this.S.gitter);
    this.umgebung.folgen(d.x, d.y);

    // Countdown
    if (this.zustand === 'countdown') {
      const wert = this.countdown > 3.6 ? '' : this.countdown > 2.6 ? '3' : this.countdown > 1.6 ? '2' : this.countdown > 0.6 ? '1' : '';
      if (wert !== this._countdownWert) {
        this._countdownWert = wert;
        this.hud.countdownZeigen(wert);
        if (wert) this.spiel.audio?.ton?.('countdown');
      }
    } else if (this._countdownWert !== 'LOS' && this._countdownWert !== null && this.zeit < 1) {
      this._countdownWert = 'LOS';
      this.hud.countdownZeigen(t('rennen.los'));
      setTimeout(() => this.hud.countdownZeigen(''), 800);
    }

    // HUD
    this.hud.fahrt({
      tempo: f.tempo,
      drehzahlAnteil: (f.z.drehzahl - f.p.leerlauf) / (f.p.drehzahlMax - f.p.leerlauf),
      gang: f.gangAnzeige,
      winkel: f.tempo > 3 ? -f.schwimmwinkel / GRAD : 0,
      begrenzer: f.z.begrenzer > 0
    });
    this.hudAktualisieren?.(frameDt);
    this.hud.fpsAnzeigen(this.spiel.daten.einstellungen.anzeige.fps ? this.spiel.schleife.fps : null);
    this.hud.frame(frameDt);
    this.minimap.zeichnen(this.autos.map((a) => ({ x: a.darstellung.x, y: a.darstellung.y, theta: a.darstellung.theta, farbe: a.farbe })));
    this.spiel.audio?.fahrt?.(this.autos, sp, this.letzteEingabe?.gas ?? 0);
    this.vfx?.frame?.(frameDt, this);
  }

  debugWerte() {
    const f = this.spieler.fahrzeug;
    const z = f.z;
    return [
      [t('debug.tempo'), (f.tempo * 3.6).toFixed(1) + ' km/h'],
      [t('debug.winkel'), (f.driftWinkel / GRAD).toFixed(1) + '°'],
      [t('debug.schlupfV'), (z.schlupfV / GRAD).toFixed(1) + '°'],
      [t('debug.schlupfH'), `${(z.schlupfH / GRAD).toFixed(1)}° / ${z.durchdrehen.toFixed(2)}`],
      [t('debug.gang'), f.gangAnzeige],
      [t('debug.drehzahl'), String(Math.round(z.drehzahl))],
      [t('debug.punkteRate'), this.punkteRate ? this.punkteRate.toFixed(1) : '–']
    ];
  }

  ressourcenNeuAufbauen() {
    this.umgebung.neuAufbauen(this.S.def.licht);
    for (const a of this.autos) a.modell.livery.textur.needsUpdate = true;
  }

  verlassen() {
    displayWachHalten(false);
    if (!this.konfig.autopilot && this.fahrzeit > 0) {
      const st = this.spiel.daten.statistik;
      st.fahrzeit = Math.min(1e12, st.fahrzeit + Math.round(this.fahrzeit));
      this.spiel.speicher.speichern();
    }
    for (const aus of this._hoerer) aus();
    this.spiel.qualitaet.messungAktiv(false);
    this.spiel.eingabe.touch.zeigen(false);
    this.spiel.schleife.physikAktiv = true;
    this.spiel.schleife.zeitFaktor = 1;
    this.hud.entfernen();
    document.querySelectorAll('.pause-menue, .ergebnis-bildschirm').forEach((el) => el.remove());
    this.vfx?.freigeben?.();
    for (const a of this.autos) {
      this.szene.remove(a.modell.objekt);
      a.modell.freigeben();
    }
    this.autos = [];
    this.szene.remove(this.streckeModell.objekt);
    this.streckeModell.freigeben();
    this.umgebung.freigeben();
    this.spiel.audio?.rennenEnde?.();
  }
}
