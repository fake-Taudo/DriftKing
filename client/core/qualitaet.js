// Qualitätsstufen (Niedrig/Mittel/Hoch/Automatisch) mit Hysterese bei „Automatisch“.
import { istDesktop } from './geraet.js';

export const STUFEN = {
  niedrig: { id: 'niedrig', pixelRatio: 1.0, schatten: 'blob', schattenGroesse: 0, partikel: 0.25, livery: 1024, bloom: false, deko: 0.5 },
  mittel: { id: 'mittel', pixelRatio: 1.5, schatten: 'map', schattenGroesse: 1024, partikel: 0.6, livery: 1024, bloom: false, deko: 0.8 },
  hoch: { id: 'hoch', pixelRatio: 2.0, schatten: 'map', schattenGroesse: 2048, partikel: 1.0, livery: 2048, bloom: true, deko: 1.0 }
};
const REIHENFOLGE = ['niedrig', 'mittel', 'hoch'];

// Automatik: Messfenster 2 s; senken schnell, erhöhen erst nach 20 s stabiler Leistung.
const MESS_FENSTER = 2.0;
const ZIEL_FRAMEZEIT = 1 / 50; // über ~20 ms Durchschnitt → zu langsam
const GUT_FRAMEZEIT = 1 / 58; // darunter gilt die Leistung als stabil gut
const ERHOEHEN_NACH = 20;

export class Qualitaet {
  constructor(ereignisse) {
    this.ereignisse = ereignisse;
    this.einstellung = 'auto';
    this.aktuell = STUFEN.mittel;
    this._summe = 0;
    this._anzahl = 0;
    this._fensterZeit = 0;
    this._gutSeit = 0;
    this._messungAktiv = false;
  }

  /** Einstellung setzen: 'niedrig' | 'mittel' | 'hoch' | 'auto' */
  setzeEinstellung(wert) {
    this.einstellung = wert;
    if (wert === 'auto') {
      this._setze('mittel');
      this._gutSeit = 0;
    } else {
      this._setze(wert);
    }
  }

  /** Bloom nur auf Hoch und nur am Desktop. */
  get bloom() {
    return this.aktuell.bloom && istDesktop;
  }

  _setze(id) {
    const neu = STUFEN[id];
    if (!neu || neu === this.aktuell) return;
    this.aktuell = neu;
    this.ereignisse?.senden('qualitaet', neu);
  }

  /** Nur im Rennen messen (Menüs sind nicht aussagekräftig). */
  messungAktiv(an) {
    this._messungAktiv = an;
    this._summe = 0;
    this._anzahl = 0;
    this._fensterZeit = 0;
  }

  /** Pro Frame mit der Frame-Zeit aufrufen. */
  frame(frameDt) {
    if (this.einstellung !== 'auto' || !this._messungAktiv) return;
    if (!(frameDt > 0) || frameDt > 0.2 || document.hidden) return;
    this._summe += frameDt;
    this._anzahl++;
    this._fensterZeit += frameDt;
    if (this._fensterZeit < MESS_FENSTER) return;
    const mittel = this._summe / this._anzahl;
    this._summe = 0;
    this._anzahl = 0;
    this._fensterZeit = 0;
    const idx = REIHENFOLGE.indexOf(this.aktuell.id);
    if (mittel > ZIEL_FRAMEZEIT && idx > 0) {
      this._setze(REIHENFOLGE[idx - 1]);
      this._gutSeit = 0;
    } else if (mittel < GUT_FRAMEZEIT) {
      this._gutSeit += MESS_FENSTER;
      if (this._gutSeit >= ERHOEHEN_NACH && idx < REIHENFOLGE.length - 1) {
        this._setze(REIHENFOLGE[idx + 1]);
        this._gutSeit = 0;
      }
    } else {
      this._gutSeit = 0;
    }
  }
}
