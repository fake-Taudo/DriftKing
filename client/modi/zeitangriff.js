// Drift-Zeitangriff: 3 Runden auf einer Strecke, Wertung wie die Führer-Wertung (ohne Gegner).
// Medaillen nach durchschnittlicher normierter Rundenpunktzahl (Bronze 40, Silber 60, Gold 80,
// Champion 95). Zeitlimit je Runde: 150 % der Referenzzeit – eine abgelaufene Runde wird
// abgebrochen, die nächste beginnt beim nächsten Überfahren der Startlinie.
import { Rennen } from './rennen.js';
import { t } from '../i18n/de.js';
import { ergebnisZeigen } from '../ui/bildschirme/ergebnis.js';
import { formatZeit } from '../ui/hud.js';

export const ZEITANGRIFF_RUNDEN = 3;

export class Zeitangriff extends Rennen {
  constructor(konfig) {
    super({ ...konfig, art: 'zeitangriff' });
  }

  starten() {
    super.starten();
    this.ergebnisse = []; // je Runde: Zeit (s) oder null (abgebrochen)
    this.rundeStart = null; // Spielzeit beim Start der laufenden Runde
    this.wartetAufLinie = false;
    this.wertungStart?.();
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
      status: this.wartetAufLinie ? t('rennen.zurLinie') : t('rennen.rundeVon', { n: this.rundenNummer, von: ZEITANGRIFF_RUNDEN }),
      zeit: this.zustand === 'laeuft' ? rest : null,
      zeitWarnung: rest !== null && rest < 10
    });
    this.wertungHud?.();
  }

  rundenEreignis(a, ev) {
    if (a === this.spieler && ev.art === 'start' && this.rundeStart === null) {
      this.rundeStart = this.zeit;
      this.wertungRundeStart?.();
    }
    if (a === this.spieler && ev.art === 'runde' && this.wartetAufLinie) {
      this.rundeBeendet(); // keine Rundenzeit-Meldung für den Rest einer abgebrochenen Runde
      return;
    }
    super.rundenEreignis(a, ev);
  }

  regelSchritt() {
    if (this.zustand !== 'laeuft' || this.rundeStart === null || this.wartetAufLinie) return;
    if (this.zeit - this.rundeStart > this.S.zeitLimit) {
      this.hud.meldungZeigen(t('rennen.zeitAbgelaufen'), 2.5, 'gefahr');
      this.ergebnisse.push(null);
      this.wertungRunde?.({ zeit: null, abgebrochen: true });
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
      this.wertungRundeStart?.();
      return;
    }
    const zeit = this.zeit - this.rundeStart;
    this.ergebnisse.push(zeit);
    this.wertungRunde?.({ zeit });
    this.rundeStart = this.zeit;
    this.wertungRundeStart?.();
    if (this.ergebnisse.length >= ZEITANGRIFF_RUNDEN) this.fertig();
  }

  fertig() {
    if (this.zustand === 'ende' || this.zustand === 'ziel') return;
    this.zustand = 'ziel';
    const zeiten = this.ergebnisse.slice(0, ZEITANGRIFF_RUNDEN);
    setTimeout(() => {
      if (this.spiel.modus !== this) return;
      this.zustand = 'ende';
      const auswertung = this.wertungAuswerten ? this.wertungAuswerten() : null;
      const zeilen = zeiten.map((z, i) => [t('rennen.rundeNr', { n: i + 1 }), z === null ? t('rennen.abgebrochen') : formatZeit(z) + ' s']);
      ergebnisZeigen(this.spiel, {
        titel: t('ergebnis.zeitangriffTitel'),
        untertitel: this.S.name,
        medaille: auswertung?.medaille ?? null,
        zeilen: [...(auswertung?.zeilen || []), ...zeilen],
        belohnung: auswertung?.belohnung ?? 0,
        meldungen: auswertung?.meldungen || [],
        knoepfe: [
          { text: t('ergebnis.nochmal'), art: 'haupt', aktion: () => this.starten() },
          { text: t('ergebnis.menue'), aktion: () => this.beenden() }
        ]
      });
    }, 1800);
  }
}
