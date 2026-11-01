// Spielstand-Ablage im Browser: localStorage mit Präfix und Versionsnummer, tägliches Backup,
// Rückfall auf Arbeitsspeicher (z. B. privater Modus), Export/Import als Datei und Text-Code.
import {
  SPIELSTAND_VERSION, neuerSpielstand, verpacke, entpacke, erzeugeClientId, MAX_IMPORT_BYTES
} from '../../shared/spielstand.js';
import { kodiere, dekodiere } from '../../shared/kodierung.js';
import { AUFKLEBER_IDS } from '../assets/aufkleber.js';

const PRAEFIX = 'driftkoenig';
const schluessel = (version) => `${PRAEFIX}.v${version}.spielstand`;
const BACKUP = `${PRAEFIX}.backup`;
const BACKUP_DATUM = `${PRAEFIX}.backupDatum`;

function heute() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function zufallsByte() {
  const a = new Uint8Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

/** Ablage-Abstraktion: localStorage oder Arbeitsspeicher. */
class Ablage {
  constructor() {
    this.speicher = new Map();
    this.dauerhaft = false;
    try {
      const k = `${PRAEFIX}.test`;
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      this.dauerhaft = true;
    } catch {
      this.dauerhaft = false;
    }
  }
  lesen(k) {
    if (!this.dauerhaft) return this.speicher.get(k) ?? null;
    try { return localStorage.getItem(k); } catch { return null; }
  }
  schreiben(k, v) {
    if (!this.dauerhaft) { this.speicher.set(k, v); return true; }
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      // Speicher voll oder gesperrt → in den Arbeitsspeicher ausweichen
      this.dauerhaft = false;
      this.speicher.set(k, v);
      return false;
    }
  }
  loeschen(k) {
    if (!this.dauerhaft) { this.speicher.delete(k); return; }
    try { localStorage.removeItem(k); } catch { /* egal */ }
  }
}

export class Speicher {
  constructor() {
    this.ablage = new Ablage();
    this.daten = null;
    /** Meldungen beim Laden (i18n-Schlüssel), z. B. 'speicher.backupGeladen' */
    this.meldungen = [];
    this._zeitgeber = null;
    this._beobachter = new Set();
    this.pruefOptionen = { aufkleberIds: AUFKLEBER_IDS };
  }

  get verfuegbar() {
    return this.ablage.dauerhaft;
  }

  /** Lädt den Spielstand (mit Migration, Backup-Rückfall und Neuanlage). */
  laden() {
    this.meldungen = [];
    if (!this.ablage.dauerhaft) this.meldungen.push({ schluessel: 'speicher.keinSpeicher', art: 'warnung' });

    // Aktuelle Version suchen, sonst ältere Versionen (Migration)
    let text = null;
    for (let v = SPIELSTAND_VERSION; v >= 0 && !text; v--) text = this.ablage.lesen(schluessel(v));

    if (text) {
      const r = entpacke(text, this.pruefOptionen);
      if (r.ok) {
        this.daten = r.daten;
        if (r.migriert) {
          this.meldungen.push({ schluessel: 'speicher.migriert', art: 'info' });
          this.sofortSpeichern();
        }
        this._taeglichesBackup(verpacke(this.daten));
        return this.daten;
      }
      console.warn('[Speicher] Spielstand ungültig:', r.fehler, r.feld || '');
      const backup = this.ablage.lesen(BACKUP);
      if (backup) {
        const rb = entpacke(backup, this.pruefOptionen);
        if (rb.ok) {
          this.daten = rb.daten;
          this.meldungen.push({ schluessel: 'speicher.backupGeladen', art: 'warnung' });
          this.sofortSpeichern();
          return this.daten;
        }
      }
      this.daten = neuerSpielstand(erzeugeClientId(zufallsByte));
      this.meldungen.push({ schluessel: 'speicher.neuerSpielstand', art: 'fehler' });
      this.sofortSpeichern();
      return this.daten;
    }

    this.daten = neuerSpielstand(erzeugeClientId(zufallsByte));
    this.sofortSpeichern();
    return this.daten;
  }

  /** Einmal pro Tag die letzte gültige Version in einen zweiten Schlüssel sichern. */
  _taeglichesBackup(gueltigerText) {
    const d = heute();
    if (this.ablage.lesen(BACKUP_DATUM) !== d) {
      this.ablage.schreiben(BACKUP, gueltigerText);
      this.ablage.schreiben(BACKUP_DATUM, d);
    }
  }

  /** Verzögertes Speichern (bündelt viele Änderungen). */
  speichern() {
    if (this._zeitgeber) return;
    this._zeitgeber = setTimeout(() => {
      this._zeitgeber = null;
      this.sofortSpeichern();
    }, 800);
  }

  /** Sofort speichern (z. B. nach Käufen – atomar zusammen mit der Änderung). */
  sofortSpeichern() {
    if (this._zeitgeber) {
      clearTimeout(this._zeitgeber);
      this._zeitgeber = null;
    }
    if (!this.daten) return false;
    const ok = this.ablage.schreiben(schluessel(SPIELSTAND_VERSION), verpacke(this.daten));
    for (const fn of this._beobachter) {
      try { fn(this.daten); } catch (e) { console.error(e); }
    }
    return ok;
  }

  /** Rückruf bei jeder Speicherung (z. B. UI-Aktualisierung der Münzen). */
  beobachten(fn) {
    this._beobachter.add(fn);
    return () => this._beobachter.delete(fn);
  }

  /** Setzt den Fortschritt komplett zurück (neue Client-ID bleibt erhalten). */
  zuruecksetzen() {
    const id = this.daten?.clientId || erzeugeClientId(zufallsByte);
    this.daten = neuerSpielstand(id);
    this.ablage.loeschen(BACKUP);
    this.ablage.loeschen(BACKUP_DATUM);
    this.sofortSpeichern();
    return this.daten;
  }

  // ---------------------------------------------------------------------------
  // Export / Import

  exportText() {
    return verpacke(this.daten);
  }

  /** Datei-Export (.json): Download bzw. Teilen-Menü auf iOS. */
  async exportDatei() {
    const text = this.exportText();
    const name = `driftkoenig-spielstand-${heute()}.json`;
    const blob = new Blob([text], { type: 'application/json' });
    if (navigator.canShare && typeof File === 'function') {
      try {
        const datei = new File([blob], name, { type: 'application/json' });
        if (navigator.canShare({ files: [datei] }) && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
          await navigator.share({ files: [datei], title: 'DRIFTKÖNIG-Spielstand' });
          return true;
        }
      } catch { /* Rückfall auf Download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  }

  /** Text-Code-Export (komprimiert, Base64URL). */
  async exportCode() {
    return kodiere(JSON.parse(this.exportText()));
  }

  /**
   * Import aus Datei-Inhalt oder Text-Code. Bei Erfolg wird der Spielstand ersetzt.
   * @returns {Promise<{ok: true} | {ok: false, fehler: string}>}
   */
  async importieren(eingabe) {
    if (typeof eingabe !== 'string' || !eingabe.trim()) return { ok: false, fehler: 'leer' };
    if (eingabe.length > MAX_IMPORT_BYTES * 2) return { ok: false, fehler: 'zu_gross' };
    let text = eingabe.trim();
    if (!text.startsWith('{')) {
      // Text-Code
      try {
        const objekt = await dekodiere(text, { maxCodeLaenge: MAX_IMPORT_BYTES * 2, maxRohBytes: MAX_IMPORT_BYTES });
        text = JSON.stringify(objekt);
      } catch (e) {
        return { ok: false, fehler: e.message || 'format' };
      }
    }
    const r = entpacke(text, this.pruefOptionen);
    if (!r.ok) return { ok: false, fehler: r.fehler };
    // Client-ID des Geräts beibehalten (sonst könnte man Online-Tageslimits umgehen)
    const alteId = this.daten?.clientId;
    this.daten = r.daten;
    if (alteId) this.daten.clientId = alteId;
    this.sofortSpeichern();
    return { ok: true };
  }
}
