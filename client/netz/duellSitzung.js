// Sitzung eines Online-Duells im Client: Anmeldung beim Server, Lobby-Zustand, Wiederverbindung mit dem
// einmaligen Token. Bleibt über Moduswechsel hinweg bestehen (Menü → Duell → Ergebnis → Revanche).
import { lookZuCode, codeZuLook, standardLook } from '../../shared/look.js';
import { AUFKLEBER_IDS } from '../assets/aufkleber.js';
import { PROTOKOLL_VERSION, WIEDERVERBINDEN_MS } from '../../shared/netzwerkSchema.js';
import { aktivesAuto } from '../spielerDaten.js';

export class DuellSitzung {
  constructor(spiel) {
    this.spiel = spiel;
    this.netz = spiel.netz;
    this.token = null;
    this.lobby = null;
    this.seite = null;
    this.angemeldet = false;
    this.imDuell = false;
    this.letzterCountdown = null;
    this.hoerer = new Map();
    this._ab = [
      this.netz.an('duellErstellt', (n) => { this.token = n.token; this.seite = 'A'; this.imDuell = false; }),
      this.netz.an('beigetreten', (n) => { this.token = n.token; this.seite = n.seite; this.imDuell = false; }),
      this.netz.an('lobbyStatus', (n) => { this.lobby = n; this.seite = n.seite; }),
      this.netz.an('duellStart', () => { this.imDuell = true; this.letzterCountdown = null; }),
      this.netz.an('startCountdown', (n) => { this.letzterCountdown = n; }),
      this.netz.an('ergebnis', () => { this.imDuell = false; this.letzterCountdown = null; }),
      this.netz.an('lobbyEnde', () => { this.lobby = null; this.token = null; }),
      this.netz.an('wiederverbunden', (n) => {
        this.token = n.token;
        this.seite = n.seite;
        this.imDuell = n.imDuell;
      }),
      this.netz.an('_getrennt', () => this._verbindungVerloren())
    ];
  }

  /** Meldet das aktive Auto beim Server an. @returns {Promise<string|null>} Fehlercode oder null */
  async anmelden() {
    if (!(await this.netz.verbinden())) return 'keine_verbindung';
    const d = this.spiel.daten;
    const a = aktivesAuto(d);
    const look = a.looks[a.aktiverLook].look;
    let code;
    try {
      code = await lookZuCode(look);
    } catch {
      return 'look_ungueltig';
    }
    return new Promise((fertig) => {
      const ende = (wert) => {
        aus1();
        aus2();
        clearTimeout(zeit);
        fertig(wert);
      };
      const aus1 = this.netz.an('willkommen', () => {
        this.angemeldet = true;
        ende(null);
      });
      const aus2 = this.netz.an('fehler', (n) => ende(n.code));
      const zeit = setTimeout(() => ende('keine_verbindung'), 8000);
      this.netz.senden({
        t: 'hallo',
        v: PROTOKOLL_VERSION,
        clientId: d.clientId,
        name: d.spielerName,
        autoId: a.id,
        look: code,
        tuning: a.tuning,
        strecken: d.fortschritt.strecken
      });
    });
  }

  senden(n) {
    return this.netz.senden(n);
  }

  /** Verbindung abgerissen: Innerhalb der Frist mit dem Token zurückkehren. */
  async _verbindungVerloren() {
    this.angemeldet = false;
    if (!this.token || this._kehrtZurueck) return;
    this._kehrtZurueck = true;
    const bis = Date.now() + WIEDERVERBINDEN_MS;
    while (Date.now() < bis && this.token) {
      // verbinden() wartet bis zu 90 s (schlafender Server); hier zählt nur die Frist
      const da = await Promise.race([this.netz.verbinden(), new Promise((r) => setTimeout(() => r(false), Math.max(0, bis - Date.now())))]);
      if (da) {
        const ok = await new Promise((fertig) => {
          const ende = (w) => {
            a1();
            a2();
            clearTimeout(z);
            fertig(w);
          };
          const a1 = this.netz.an('wiederverbunden', () => ende(true));
          const a2 = this.netz.an('fehler', (n) => { if (n.code === 'token_ungueltig') ende(false); });
          const z = setTimeout(() => ende(false), 3000);
          this.netz.senden({ t: 'wiederverbinden', token: this.token });
        });
        if (ok) {
          this.angemeldet = true;
          this._kehrtZurueck = false;
          return;
        }
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    this._kehrtZurueck = false;
    this.token = null;
    this.lobby = null;
    if (!this.netz.verbunden) this.netz.trennen();
    this.spiel.ereignisse.senden('duellVerloren');
  }

  /** Lobby verlassen und Verbindung behalten. */
  verlassen() {
    this.senden({ t: 'verlassen' });
    this.token = null;
    this.lobby = null;
    this.seite = null;
    this.imDuell = false;
  }

  /** Decodiert den Look eines Mitspielers; im Fehlerfall die Serie (der Server hat ihn schon geprüft). */
  async lookLesen(code, autoId) {
    const r = await codeZuLook(code, { aufkleberIds: AUFKLEBER_IDS, autoId });
    return r.ok ? r.look : standardLook(autoId);
  }
}

let sitzung = null;
/** Die eine Sitzung dieses Spiels. */
export function duellSitzung(spiel) {
  if (!sitzung) sitzung = new DuellSitzung(spiel);
  return sitzung;
}
