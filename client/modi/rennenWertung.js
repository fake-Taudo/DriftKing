// Wertung im Rennen (Client): 20 Ticks pro Sekunde aus dem festen Physik-Takt (alle 3 Schritte),
// Anzeige der Wertungs-Ereignisse (Popups, Meldungen) und Hilfen für die Ergebnis-Aufschlüsselung.
// Freies Fahren und Zeitangriff nutzen die Einzel-Wertung (Führer-Wertung ohne Gegner),
// das Bot-Battle zwei Wertungen (Führer und Verfolger).
import { Wertung } from '../../shared/wertung.js';
import { WERTUNG } from '../../shared/wertungsParameter.js';
import { PHYSIK } from '../../shared/physikParameter.js';
import { t, zahl } from '../i18n/de.js';

/** Physik-Schritte pro Wertungs-Tick (1/60 s Physik, 20 Ticks/s Wertung → 3). */
export const TICK_SCHRITTE = Math.round(1 / WERTUNG.tickRate / PHYSIK.dt);

/** Kurze, eindeutige ID (für Buchungen: jede Fahrt wird höchstens einmal belohnt). */
export function zufallsId() {
  const z = new Uint32Array(2);
  crypto.getRandomValues(z);
  return Date.now().toString(36) + z[0].toString(36) + z[1].toString(36);
}

/** Wertungs-Zustand eines Autos (Momentaufnahme plus Merker „wurde zurückgesetzt“). */
export function wertungsZustand(a) {
  const z = a.fahrzeug.momentaufnahme();
  z.zurueckgesetzt = !!a.zurueckgesetzt;
  return z;
}

/** Zeigt Wertungs-Ereignisse des Spielers im HUD (Zonen-Punkte, Abzüge, Boni, Dreher). */
export function ereignisseAnzeigen(rennen, ereignisse) {
  const hud = rennen.hud;
  for (const e of ereignisse) {
    if (e.art === 'zoneEnde' && e.punkte >= 0.5) hud.popup('+' + zahl(e.punkte, 1));
    else if (e.art === 'wand') hud.popup(t('wertung.wand', { n: e.abzug }), 'minus');
    else if (e.art === 'kontakt') {
      hud.popup(t('wertung.kontakt', { n: e.abzug }), 'minus');
      rennen.rennKamera?.stoss(0.45);
    }
    else if (e.art === 'zuruecksetzen' && e.abzug) hud.popup(t('wertung.zurueckgesetzt', { n: e.abzug }), 'minus');
    else if (e.art === 'fluessig') hud.popup(t('wertung.fluessig', { n: zahl(e.bonus, 1) }), 'combo');
    else if (e.art === 'spin') hud.meldungZeigen(t('wertung.dreher'), 1.5, 'gefahr');
    rennen.spiel.audio?.wertungEreignis?.(e);
  }
}

/** Einzel-Wertung des Spielers (Freies Fahren, Zeitangriff): Start/Stopp je Runde. */
export class EinzelWertung {
  constructor(rennen) {
    this.r = rennen;
    this.wertung = new Wertung(rennen.S, 'einzel', { abmessungen: rennen.spieler.fahrzeug.p.abmessungen });
    this.aktiv = false;
    this.schritte = 0;
    this.startZeit = 0;
  }

  start() {
    this.wertung.zuruecksetzen(0);
    this.startZeit = this.r.zeit;
    this.schritte = 0;
    this.aktiv = true;
    this.r.spieler.zurueckgesetzt = false;
  }

  /** Beendet die laufende Wertung und liefert die Aufschlüsselung. */
  stopp() {
    this.aktiv = false;
    return this.wertung.aufschluesselung();
  }

  /** Pro Physik-Schritt aufrufen; tickt die Wertung mit 20 Hz. */
  schritt() {
    if (!this.aktiv || ++this.schritte % TICK_SCHRITTE) return;
    const a = this.r.spieler;
    const ev = this.wertung.tick(wertungsZustand(a), null, this.r.zeit - this.startZeit);
    a.zurueckgesetzt = false;
    ereignisseAnzeigen(this.r, ev);
  }

  hud() {
    const w = this.wertung;
    this.r.hud.punkte({ ich: w.punkte, combo: w.combo, comboAnteil: w.comboAnteil });
  }
}

/**
 * Fasst mehrere Aufschlüsselungen zusammen (Mittel der Anteile und Punkte, Summen der Abzüge,
 * Höchstwerte der Rekorde). Verfolger-Anteile (Abstand, Gleichwinkel) nur aus Verfolger-Fahrten.
 */
export function aufschluesselungZusammenfassen(liste) {
  const n = Math.max(1, liste.length);
  const mittel = (k) => liste.reduce((s, a) => s + (a[k] || 0), 0) / n;
  const summe = (k) => liste.reduce((s, a) => s + (a[k] || 0), 0);
  const max = (k) => liste.reduce((m, a) => Math.max(m, a[k] || 0), 0);
  const verf = liste.filter((a) => a.abstand !== null && a.abstand !== undefined);
  const vMittel = (k) => (verf.length ? verf.reduce((s, a) => s + a[k], 0) / verf.length : null);
  return {
    punkte: mittel('punkte'),
    winkel: mittel('winkel'),
    tempo: mittel('tempo'),
    linie: mittel('linie'),
    abstand: vMittel('abstand'),
    gleichwinkel: vMittel('gleichwinkel'),
    combo: mittel('combo'),
    comboMax: max('comboMax'),
    abzuege: summe('abzuege'),
    boni: summe('boni'),
    wand: summe('wand'),
    kontakte: summe('kontakte'),
    resets: summe('resets'),
    spins: summe('spins'),
    fluessig: summe('fluessig'),
    besterWinkel: max('besterWinkel'),
    laengsterDrift: max('laengsterDrift')
  };
}

/** Zeilen der Punkte-Aufschlüsselung für den Ergebnisbildschirm. */
export function aufschluesselungZeilen(a) {
  const pz = (x) => Math.round(x) + ' %';
  const zeilen = [
    [t('wertung.anteilWinkel'), pz(a.winkel)],
    [t('wertung.anteilTempo'), pz(a.tempo)],
    [t('wertung.anteilLinie'), pz(a.linie)]
  ];
  if (a.abstand !== null && a.abstand !== undefined) {
    zeilen.push([t('wertung.anteilAbstand'), pz(a.abstand)], [t('wertung.anteilGleichwinkel'), pz(a.gleichwinkel)]);
  }
  zeilen.push(
    [t('wertung.combo'), t('wertung.comboWert', { mittel: zahl(a.combo, 1), max: zahl(a.comboMax, 1) })],
    [t('wertung.abzuege'), a.abzuege ? '−' + zahl(a.abzuege, 1) : '0'],
    [t('wertung.boni'), a.boni ? '+' + zahl(a.boni, 1) : '0'],
    [t('wertung.fehler'), t('wertung.fehlerWert', { wand: a.wand, kontakte: a.kontakte, resets: a.resets, spins: a.spins })],
    [t('wertung.besterWinkel'), Math.round(a.besterWinkel) + '°'],
    [t('wertung.laengsterDrift'), zahl(a.laengsterDrift, 1) + ' s']
  );
  return zeilen;
}
