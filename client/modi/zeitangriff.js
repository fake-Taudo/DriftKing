// Drift-Zeitangriff: 3 Runden auf einer Strecke, Wertung wie die Führer-Wertung (ohne Gegner).
// Medaillen nach durchschnittlicher normierter Rundenpunktzahl (Bronze 40, Silber 60, Gold 80,
// Champion 95). Zeitlimit je Runde: 150 % der Referenzzeit – eine abgelaufene Runde wird
// abgebrochen (ihre bis dahin erreichten Punkte zählen), die nächste beginnt beim nächsten
// Überfahren der Startlinie.
import { Rennen } from './rennen.js';
import { t, zahl } from '../i18n/de.js';
import { ergebnisZeigen } from '../ui/bildschirme/ergebnis.js';
import { formatZeit } from '../ui/hud.js';
import { EinzelWertung, zufallsId, aufschluesselungZusammenfassen, aufschluesselungZeilen } from './rennenWertung.js';
import { zeitangriffAbschliessen, statistikVerbuchen } from '../../shared/oekonomie.js';

export const ZEITANGRIFF_RUNDEN = 3;

export class Zeitangriff extends Rennen {
  constructor(konfig) {
    super({ ...konfig, art: 'zeitangriff' });
  }

  starten() {
    super.starten();
    this.ergebnisse = []; // je Runde: {zeit (s) oder null (abgebrochen), wertung (Aufschlüsselung)}
    this.rundeStart = null; // Spielzeit beim Start der laufenden Runde
    this.wartetAufLinie = false;
    this.laufId = zufallsId();
    this.einzel ||= new EinzelWertung(this);
    this.einzel.aktiv = false;
  }

  get rundenNummer() {
    return Math.min(ZEITANGRIFF_RUNDEN, this.ergebnisse.length + 1);
  }

  hudAktualisieren() {
    const laeuft = this.rundeStart !== null && !this.wartetAufLinie;
    const laufend = laeuft ? this.zeit - this.rundeStart : null;
    const rest = laeuft ? this.S.zeitLimit - laufend : null;
    this.hud.stand({
      rolle: t('rennen.zeitangriff'),
      rolleArt: 'einzel',
      status: this.wartetAufLinie ? t('rennen.zurLinie') : t('rennen.rundeVon', { n: this.rundenNummer, von: ZEITANGRIFF_RUNDEN }),
      zeit: this.zustand === 'laeuft' ? rest : null,
      zeitWarnung: rest !== null && rest < 10
    });
    this.einzel.hud();
  }

  wertungSchritt() {
    this.einzel.schritt();
  }

  rundenEreignis(a, ev) {
    if (a === this.spieler && ev.art === 'start' && this.rundeStart === null) {
      this.rundeStart = this.zeit;
      this.einzel.start();
    }
    if (a === this.spieler && ev.art === 'runde' && this.wartetAufLinie) {
      this.rundeBeendet(); // keine Rundenzeit-Meldung für den Rest einer abgebrochenen Runde
      return;
    }
    super.rundenEreignis(a, ev);
  }

  /** Runde abschließen (Zeit oder null bei Abbruch) und Punkte als Popup zeigen. */
  _rundeEintragen(zeit) {
    const wertung = this.einzel.stopp();
    this.ergebnisse.push({ zeit, wertung });
    this.hud.popup(t('wertung.rundenPunkte', { n: zahl(wertung.punkte, 1) }), 'combo');
  }

  regelSchritt() {
    if (this.zustand !== 'laeuft' || this.rundeStart === null || this.wartetAufLinie) return;
    if (this.zeit - this.rundeStart > this.S.zeitLimit) {
      this.hud.meldungZeigen(t('rennen.zeitAbgelaufen'), 2.5, 'gefahr');
      this._rundeEintragen(null);
      if (this.ergebnisse.length >= ZEITANGRIFF_RUNDEN) this.fertig();
      else this.wartetAufLinie = true;
    }
  }

  rundeBeendet() {
    if (this.zustand !== 'laeuft') return;
    if (this.wartetAufLinie) {
      // Rest der abgebrochenen Runde zählt nicht – ab hier läuft die nächste Runde
      this.wartetAufLinie = false;
      this.rundeStart = this.zeit;
      this.einzel.start();
      return;
    }
    this._rundeEintragen(this.zeit - this.rundeStart);
    this.rundeStart = this.zeit;
    if (this.ergebnisse.length >= ZEITANGRIFF_RUNDEN) this.fertig();
    else this.einzel.start();
  }

  /** Auswertung: Durchschnitt, Medaille, Belohnung (einmal je Lauf), Statistik. */
  auswerten() {
    const runden = this.ergebnisse.slice(0, ZEITANGRIFF_RUNDEN);
    const mittel = runden.reduce((s, r) => s + r.wertung.punkte, 0) / ZEITANGRIFF_RUNDEN;
    const d = this.spiel.daten;
    if (this.konfig.autopilot) return { mittel, medaille: null, belohnung: 0, posten: [], neuerBestwert: false };
    for (const r of runden) statistikVerbuchen(d, r.wertung);
    const e = zeitangriffAbschliessen(d, { laufId: this.laufId, streckeId: this.S.id, punkte: mittel });
    this.spiel.speicher.speichern();
    this.spiel.ereignisse.senden('zeitangriffEnde', { streckeId: this.S.id, punkte: mittel, medaille: e.medaille, runden: runden.map((r) => r.wertung) });
    return { mittel, ...e };
  }

  fertig() {
    if (this.zustand === 'ende' || this.zustand === 'ziel') return;
    this.zustand = 'ziel';
    this.einzel.aktiv = false;
    setTimeout(() => {
      if (this.spiel.modus !== this) return;
      this.zustand = 'ende';
      const runden = this.ergebnisse.slice(0, ZEITANGRIFF_RUNDEN);
      const e = this.auswerten();
      const zeilen = [
        ...runden.map((r, i) => [
          t('rennen.rundeNr', { n: i + 1 }),
          (r.zeit === null ? t('rennen.abgebrochen') : formatZeit(r.zeit) + ' s') + ' · ' + t('wertung.punkteKurz', { n: zahl(r.wertung.punkte, 1) })
        ]),
        [t('wertung.mittel'), zahl(e.mittel, 1)],
        ...aufschluesselungZeilen(aufschluesselungZusammenfassen(runden.map((r) => r.wertung))),
        ...e.posten.map((p) => [t('wertung.posten.' + p.text, { medaille: t('medaille.' + p.medaille) }), '+' + zahl(p.betrag)])
      ];
      const meldungen = [];
      if (e.neuerBestwert) meldungen.push(t('wertung.neuerBestwertZeitangriff', { n: zahl(e.mittel, 1) }));
      if (!e.medaille) meldungen.push(t('wertung.keineMedaille', { n: 40 }));
      ergebnisZeigen(this.spiel, {
        titel: t('ergebnis.zeitangriffTitel'),
        untertitel: this.S.name,
        medaille: e.medaille,
        zeilen,
        belohnung: e.belohnung,
        meldungen,
        knoepfe: [
          { text: t('ergebnis.nochmal'), art: 'haupt', aktion: () => { this.starten(); this.spiel.eingabe.touch.zeigen(this.spiel.eingabe.istTouch); } },
          { text: t('ergebnis.menue'), aktion: () => this.beenden() }
        ]
      });
    }, 1800);
  }
}
