// Lobbys des Online-Duells: Einladungscodes, Beitritt, Einstellungen, Bereit-Status, Wiederverbindung, Aufräumen.
// Alles liegt nur im Arbeitsspeicher. Die Rollen „Gastgeber“ (A) und „Gast“ (B) sind serverseitig fest.
import { randomInt, randomBytes } from 'node:crypto';
import { Match } from './match.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { streckenDef, STRECKEN_IDS } from '../shared/strecken/index.js';
import { leistungsindex } from '../shared/leistungsindex.js';
import { codeNormalisieren, CODE_ALPHABET, CODE_LAENGE, CODE_GUELTIG_MS, LOBBY_INAKTIV_MS, WIEDERVERBINDEN_MS, MAX_BELOHNT_PRO_TAG, MAX_BELOHNT_PRO_GEGNER } from '../shared/netzwerkSchema.js';

const streckenCache = new Map();
function strecke(id) {
  if (!streckenCache.has(id)) streckenCache.set(id, baueStrecke(streckenDef(id)));
  return streckenCache.get(id);
}

const andere = (s) => (s === 'A' ? 'B' : 'A');

export class LobbyVerwaltung {
  /**
   * @param {object} o
   * @param {(verbindung:object, nachricht:object)=>void} o.senden
   * @param {()=>number} o.jetzt
   * @param {number} [o.codeGueltigMs]
   * @param {number} [o.wiederverbindenMs]
   * @param {number} [o.inaktivMs]
   * @param {number} [o.afkMs]
   */
  constructor({ senden, jetzt, codeGueltigMs = CODE_GUELTIG_MS, wiederverbindenMs = WIEDERVERBINDEN_MS, inaktivMs = LOBBY_INAKTIV_MS, afkMs }) {
    this.sendenAn = senden;
    this.afkMs = afkMs;
    this.jetzt = jetzt;
    this.codeGueltigMs = codeGueltigMs;
    this.wiederverbindenMs = wiederverbindenMs;
    this.inaktivMs = inaktivMs;
    this.lobbys = new Map(); // code → Lobby
    this.tokens = new Map(); // token → { lobby, seite }
    this.belohnt = new Map(); // clientId → { tag, gesamt, proGegner }
    this.abgelaufen = new Map(); // code → Zeit des Ablaufs (für die genaue Fehlermeldung)
  }

  get anzahl() {
    return this.lobbys.size;
  }

  _neuerCode() {
    for (let i = 0; i < 100; i++) {
      let c = '';
      for (let k = 0; k < CODE_LAENGE; k++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.lobbys.has(c)) return c;
    }
    throw new Error('Kein freier Code');
  }

  _token(lobby, seite) {
    const token = randomBytes(18).toString('base64url');
    this.tokens.set(token, { lobby, seite });
    return token;
  }

  /** Spieler A eröffnet ein Duell. */
  erstellen(v) {
    if (v.lobby) this.verlassen(v);
    const code = this._neuerCode();
    const jetzt = this.jetzt();
    const lobby = {
      code,
      erstellt: jetzt,
      codeBis: jetzt + this.codeGueltigMs,
      codeBenutzt: false,
      aktivitaet: jetzt,
      seiten: { A: this._platz(v), B: null },
      streckeId: null,
      format: 'bo3',
      einheit: false,
      match: null,
      seedZaehler: 0
    };
    lobby.seiten.A.token = this._token(lobby, 'A');
    this.lobbys.set(code, lobby);
    v.lobby = lobby;
    v.seite = 'A';
    this._streckeWaehlen(lobby);
    this.sendenAn(v, { t: 'duellErstellt', code, token: lobby.seiten.A.token, gueltigBis: lobby.codeBis });
    this._status(lobby);
  }

  _platz(v) {
    return { v, profil: v.profil, bereit: false, weg: null, token: null };
  }

  /** Spieler B tritt per Code bei. @returns {string|null} Fehlercode */
  beitreten(v, codeRoh) {
    const code = codeNormalisieren(codeRoh);
    if (!code) return 'code_ungueltig';
    const lobby = this.lobbys.get(code);
    if (!lobby) return this.abgelaufen.has(code) ? 'code_abgelaufen' : 'code_ungueltig';
    if (lobby.codeBenutzt || lobby.seiten.B) return 'code_benutzt';
    if (this.jetzt() > lobby.codeBis) return 'code_abgelaufen';
    if (lobby.seiten.A.v === v) return 'eigenes_duell';
    if (v.lobby) this.verlassen(v);
    lobby.codeBenutzt = true;
    lobby.seiten.B = this._platz(v);
    lobby.seiten.B.token = this._token(lobby, 'B');
    lobby.aktivitaet = this.jetzt();
    v.lobby = lobby;
    v.seite = 'B';
    this._streckeWaehlen(lobby);
    this.sendenAn(v, { t: 'beigetreten', code, token: lobby.seiten.B.token, seite: 'B' });
    this._status(lobby);
    return null;
  }

  /** Nur Strecken, die beide freigeschaltet haben (nach ihren Meldungen). */
  _gemeinsameStrecken(lobby) {
    const a = lobby.seiten.A.profil.strecken;
    const b = lobby.seiten.B?.profil.strecken ?? a;
    return STRECKEN_IDS.filter((s) => a.includes(s) && b.includes(s));
  }

  _streckeWaehlen(lobby) {
    const liste = this._gemeinsameStrecken(lobby);
    if (!liste.includes(lobby.streckeId)) lobby.streckeId = liste[liste.length - 1] ?? 'industriehof';
  }

  einstellungen(v, n) {
    const lobby = v.lobby;
    if (!lobby || lobby.match) return 'kein_lobby';
    if (v.seite !== 'A') return 'nur_gastgeber';
    if (n.streckeId !== undefined) {
      if (!this._gemeinsameStrecken(lobby).includes(n.streckeId)) return 'strecke_gesperrt';
      lobby.streckeId = n.streckeId;
    }
    if (n.format !== undefined) lobby.format = n.format;
    if (n.einheit !== undefined) lobby.einheit = n.einheit;
    // Geänderte Bedingungen: beide bestätigen neu
    for (const s of ['A', 'B']) if (lobby.seiten[s]) lobby.seiten[s].bereit = false;
    lobby.aktivitaet = this.jetzt();
    this._status(lobby);
    return null;
  }

  bereit(v, an) {
    const lobby = v.lobby;
    if (!lobby || lobby.match) return 'kein_lobby';
    lobby.seiten[v.seite].bereit = an;
    lobby.aktivitaet = this.jetzt();
    this._status(lobby);
    if (lobby.seiten.A.bereit && lobby.seiten.B?.bereit) this._starten(lobby);
    return null;
  }

  _einheitsPI(lobby) {
    const pi = (s) => leistungsindex(lobby.seiten[s].profil.autoId, {});
    return Math.round((pi('A') + pi('B')) / 2);
  }

  /** Daten des Lobby-Bildschirms für beide Seiten. */
  _status(lobby) {
    const sicht = (s) => {
      const p = lobby.seiten[s];
      if (!p) return null;
      return {
        name: p.profil.name,
        autoId: p.profil.autoId,
        look: p.profil.look,
        pi: leistungsindex(p.profil.autoId, p.profil.tuning),
        bereit: p.bereit,
        weg: !!p.weg
      };
    };
    const n = {
      t: 'lobbyStatus',
      code: lobby.code,
      A: sicht('A'),
      B: sicht('B'),
      streckeId: lobby.streckeId,
      strecken: this._gemeinsameStrecken(lobby),
      format: lobby.format,
      einheit: lobby.einheit,
      einheitsPI: lobby.seiten.B ? this._einheitsPI(lobby) : null
    };
    for (const s of ['A', 'B']) {
      const p = lobby.seiten[s];
      if (p && !p.weg) this.sendenAn(p.v, { ...n, seite: s });
    }
  }

  _starten(lobby) {
    const jetzt = this.jetzt();
    lobby.seedZaehler++;
    lobby.aktivitaet = jetzt;
    const einheitsPI = lobby.einheit ? this._einheitsPI(lobby) : null;
    for (const s of ['A', 'B']) {
      const p = lobby.seiten[s];
      this.sendenAn(p.v, {
        t: 'duellStart',
        seite: s,
        streckeId: lobby.streckeId,
        format: lobby.format,
        einheitsPI,
        gegner: { name: lobby.seiten[andere(s)].profil.name, autoId: lobby.seiten[andere(s)].profil.autoId, look: lobby.seiten[andere(s)].profil.look }
      });
    }
    lobby.match = new Match({
      S: strecke(lobby.streckeId),
      format: lobby.format,
      seed: `${lobby.code}:${lobby.seedZaehler}:${randomInt(1 << 30)}`,
      spieler: { A: { autoId: lobby.seiten.A.profil.autoId }, B: { autoId: lobby.seiten.B.profil.autoId } },
      jetzt,
      senden: (s, nachricht) => {
        const p = lobby.seiten[s];
        if (p && !p.weg) this.sendenAn(p.v, nachricht);
      },
      afkMs: this.afkMs,
      beiEnde: (ende) => this._duellEnde(lobby, ende)
    });
  }

  /** Tagesgrenzen: Der Server zählt mit, solange er läuft; der Client prüft beim Buchen zusätzlich. */
  _belohnungPruefen(clientId, gegnerId, betrag) {
    if (betrag <= 0) return 0;
    const tag = new Date(this.jetzt()).toISOString().slice(0, 10);
    let e = this.belohnt.get(clientId);
    if (!e || e.tag !== tag) {
      e = { tag, gesamt: 0, proGegner: {} };
      this.belohnt.set(clientId, e);
    }
    if (clientId === gegnerId) return 0;
    if (e.gesamt >= MAX_BELOHNT_PRO_TAG || (e.proGegner[gegnerId] || 0) >= MAX_BELOHNT_PRO_GEGNER) return 0;
    e.gesamt++;
    e.proGegner[gegnerId] = (e.proGegner[gegnerId] || 0) + 1;
    return betrag;
  }

  _duellEnde(lobby, ende) {
    const duellId = `${lobby.code}-${lobby.seedZaehler}-${lobby.erstellt}`;
    for (const s of ['A', 'B']) {
      const p = lobby.seiten[s];
      if (!p) continue;
      const gegnerId = lobby.seiten[andere(s)]?.profil.clientId ?? '';
      const belohnung = this._belohnungPruefen(p.profil.clientId, gegnerId, ende.belohnung[s]);
      const nachricht = {
        t: 'ergebnis',
        duellId,
        seite: s,
        sieger: ende.sieger,
        sieg: ende.sieger === s,
        regulaer: ende.regulaer,
        grund: ende.grund,
        fahrzeit: ende.fahrzeit,
        zusammenfassung: ende.zusammenfassung,
        belohnung,
        gegnerId
      };
      // Gerade unterbrochen: Das Ergebnis samt Belohnung wartet bis zur Frist auf die Rückkehr
      if (p.weg) p.offenesErgebnis = nachricht;
      else this.sendenAn(p.v, nachricht);
      p.bereit = false;
    }
    lobby.match = null;
    lobby.aktivitaet = this.jetzt();
    for (const s of ['A', 'B']) {
      const p = lobby.seiten[s];
      if (p?.weg && this.jetzt() > p.weg) this._platzEntfernen(lobby, s);
    }
    this._lobbyPruefen(lobby);
    if (this.lobbys.has(lobby.code)) this._status(lobby);
  }

  zustand(v, d) {
    const m = v.lobby?.match;
    if (!m) return;
    m.zustandEmpfangen(v.seite, d, this.jetzt());
  }

  aufgeben(v) {
    const m = v.lobby?.match;
    if (m) m.aufgabe(v.seite, 'aufgabe', this.jetzt());
  }

  emote(v, id) {
    const lobby = v.lobby;
    if (!lobby) return;
    const jetzt = this.jetzt();
    if (jetzt - (v.letztesEmote || 0) < 1000) return;
    v.letztesEmote = jetzt;
    lobby.aktivitaet = jetzt;
    for (const s of ['A', 'B']) {
      const p = lobby.seiten[s];
      if (p && !p.weg) this.sendenAn(p.v, { t: 'emote', von: v.seite, id });
    }
  }

  /** Spieler verlässt die Lobby bewusst. */
  verlassen(v) {
    const lobby = v.lobby;
    if (!lobby) return;
    const s = v.seite;
    if (lobby.match) lobby.match.aufgabe(s, 'verlassen', this.jetzt());
    v.lobby = null;
    v.seite = null;
    this._platzEntfernen(lobby, s);
    this._lobbyPruefen(lobby);
    if (this.lobbys.has(lobby.code)) {
      const rest = lobby.seiten.A || lobby.seiten.B;
      if (rest && !rest.weg) this.sendenAn(rest.v, { t: 'gegnerWeg' });
      this._status(lobby);
    }
  }

  _platzEntfernen(lobby, s) {
    const p = lobby.seiten[s];
    if (!p) return;
    if (p.token) this.tokens.delete(p.token);
    lobby.seiten[s] = null;
  }

  /** Lobby ohne Spieler auflösen. Fehlt nur einer und der Code ist schon benutzt, kann niemand mehr nachkommen. */
  _lobbyPruefen(lobby) {
    if (!lobby.seiten.A && !lobby.seiten.B) this._aufloesen(lobby);
    else if (!lobby.seiten.A || !lobby.seiten.B) {
      // Ein Duell braucht zwei: Mit benutztem Code kann niemand mehr nachkommen
      if (lobby.codeBenutzt) {
        const rest = lobby.seiten.A || lobby.seiten.B;
        if (rest && !rest.weg) {
          this.sendenAn(rest.v, { t: 'lobbyEnde', grund: 'gegner_weg' });
          rest.v.lobby = null;
          rest.v.seite = null;
        }
        this._aufloesen(lobby);
      }
    }
  }

  _aufloesen(lobby) {
    for (const s of ['A', 'B']) {
      const p = lobby.seiten[s];
      if (p?.token) this.tokens.delete(p.token);
      if (p?.v?.lobby === lobby) {
        p.v.lobby = null;
        p.v.seite = null;
      }
    }
    this.abgelaufen.set(lobby.code, this.jetzt());
    this.lobbys.delete(lobby.code);
  }

  /** Verbindung abgerissen: 15 Sekunden Zeit zum Wiederverbinden. */
  verbindungWeg(v) {
    const lobby = v.lobby;
    if (!lobby) return;
    const p = lobby.seiten[v.seite];
    if (!p || p.v !== v) return;
    p.weg = this.jetzt() + this.wiederverbindenMs;
    const anderer = lobby.seiten[andere(v.seite)];
    if (anderer && !anderer.weg) this.sendenAn(anderer.v, { t: 'gegnerVerbindung', weg: true, bis: p.weg });
    this._status(lobby);
  }

  /** @returns {string|null} Fehlercode */
  wiederverbinden(v, token) {
    const e = this.tokens.get(token);
    if (!e) return 'token_ungueltig';
    const { lobby, seite } = e;
    const p = lobby.seiten[seite];
    if (!p) return 'token_ungueltig';
    // Das Token ist einmalig: Für die nächste Unterbrechung gibt es ein neues
    this.tokens.delete(token);
    const alt = p.v;
    if (alt && alt !== v) {
      alt.lobby = null;
      alt.seite = null;
    }
    p.v = v;
    p.weg = null;
    p.token = this._token(lobby, seite);
    v.lobby = lobby;
    v.seite = seite;
    v.profil = p.profil;
    lobby.aktivitaet = this.jetzt();
    this.sendenAn(v, { t: 'wiederverbunden', token: p.token, seite, imDuell: !!lobby.match, streckeId: lobby.streckeId });
    // Was während der Unterbrechung verloren ging: laufender Durchgang oder das fertige Ergebnis
    if (p.offenesErgebnis) {
      this.sendenAn(v, p.offenesErgebnis);
      p.offenesErgebnis = null;
    } else {
      lobby.match?.nachsenden(seite);
    }
    const anderer = lobby.seiten[andere(seite)];
    if (anderer && !anderer.weg) this.sendenAn(anderer.v, { t: 'gegnerVerbindung', weg: false });
    this._status(lobby);
    return null;
  }

  /** Regelmäßig aufrufen (alle 50 ms): Duelle takten, Abbrüche und abgelaufene Lobbys aufräumen. */
  tick() {
    const jetzt = this.jetzt();
    for (const lobby of [...this.lobbys.values()]) {
      lobby.match?.tick(jetzt);
      for (const s of ['A', 'B']) {
        const p = lobby.seiten[s];
        if (p?.weg && jetzt > p.weg) this._nichtZurueck(lobby, s, jetzt);
      }
      if (!this.lobbys.has(lobby.code)) continue;
      if (!lobby.match) {
        const codeAbgelaufen = !lobby.codeBenutzt && jetzt > lobby.codeBis;
        if (codeAbgelaufen || jetzt - lobby.aktivitaet > this.inaktivMs) {
          for (const s of ['A', 'B']) {
            const p = lobby.seiten[s];
            if (p && !p.weg) this.sendenAn(p.v, { t: 'lobbyEnde', grund: codeAbgelaufen ? 'code_abgelaufen' : 'inaktiv' });
          }
          this._aufloesen(lobby);
        }
      }
    }
    // Merker für abgelaufene Codes nicht ewig halten
    for (const [c, zeit] of this.abgelaufen) if (jetzt - zeit > 3600_000) this.abgelaufen.delete(c);
  }

  _nichtZurueck(lobby, s, jetzt) {
    if (lobby.match) {
      lobby.match.aufgabe(s, 'verbindung', jetzt);
      // _duellEnde hat den Platz entfernt und die Lobby geprüft
      return;
    }
    this._platzEntfernen(lobby, s);
    this._lobbyPruefen(lobby);
    if (this.lobbys.has(lobby.code)) this._status(lobby);
  }

  beenden() {
    this.lobbys.clear();
    this.tokens.clear();
  }
}
