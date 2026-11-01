// Drift-Zeitangriff: 3 Runden auf einer Strecke, Wertung wie die Führer-Wertung (ohne Gegner).
// Medaillen nach durchschnittlicher normierter Rundenpunktzahl (Bronze 40, Silber 60, Gold 80,
// Champion 95). Wertung und Belohnung ergänzt rennenWertung.js (Phase 4/6).
import { Rennen } from './rennen.js';
import { t } from '../i18n/de.js';
import { ergebnisZeigen } from '../ui/bildschirme/ergebnis.js';
import { formatZeit } from '../ui/hud.js';

export const ZEITANGRIFF_RUNDEN = 3;

export class Zeitangriff extends Rennen {
  constructor(konfig) {
    super({ ...konfig, art: 'zeitangriff' });
  }

  hudAktualisieren() {
    const r = this.spieler.runden;
    const runde = Math.min(ZEITANGRIFF_RUNDEN, r.runde + 1);
    const laufend = r.rundenStart !== null ? this.zeit - r.rundenStart : null;
    const rest = r.rundenStart !== null ? this.S.zeitLimit - laufend : null;
    this.hud.stand({
      rolle: t('rennen.zeitangriff'),
      status: t('rennen.rundeVon', { n: runde, von: ZEITANGRIFF_RUNDEN }),
      zeit: this.zustand === 'laeuft' ? rest : null,
      zeitWarnung: rest !== null && rest < 10
    });
    this.wertungHud?.();
  }

  regelSchritt() {
    if (this.zustand !== 'laeuft') return;
    const r = this.spieler.runden;
    // Zeitlimit je Runde: 150 % der Referenzzeit
    if (r.rundenStart !== null && this.zeit - r.rundenStart > this.S.zeitLimit) {
      this.hud.meldungZeigen(t('rennen.zeitAbgelaufen'), 2.5, 'gefahr');
      r.rundenZeiten.push(null);
      this.wertungRunde?.({ zeit: null, abgebrochen: true });
      r.rundenStart = this.zeit;
      r.runde++;
      if (r.runde >= ZEITANGRIFF_RUNDEN) this.fertig();
    }
  }

  rundeBeendet(ev) {
    this.wertungRunde?.(ev);
    if (this.spieler.runden.runde >= ZEITANGRIFF_RUNDEN) this.fertig();
  }

  fertig() {
    if (this.zustand === 'ende') return;
    this.zustand = 'ziel';
    const r = this.spieler.runden;
    const zeiten = r.rundenZeiten.slice(0, ZEITANGRIFF_RUNDEN);
    setTimeout(() => {
      if (this.spiel.modus !== this) return;
      this.zustand = 'ende';
      const auswertung = this.wertungAuswerten ? this.wertungAuswerten() : null;
      const zeilen = zeiten.map((z, i) => [t('rennen.rundeNr', { n: i + 1 }), z === null ? t('rennen.abgebrochen') : formatZeit(z)]);
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

  starten() {
    super.starten();
    this.wertungStart?.();
  }
}
