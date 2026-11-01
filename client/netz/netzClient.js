// WebSocket-Verbindung zum Spielserver mit automatischem Wiederholen beim Aufwachen
// (kostenlose Render-Instanzen schlafen ein), Heartbeat alle 25 s und Uhrensynchronisation.

const HEARTBEAT_MS = 25_000;
const MAX_WARTEZEIT_MS = 90_000;

export class NetzClient {
  constructor(ereignisse) {
    this.ereignisse = ereignisse;
    this.ws = null;
    this.status = 'getrennt'; // 'getrennt' | 'verbinde' | 'aufwachen' | 'verbunden'
    this.hoerer = new Map();
    this.uhrVersatz = 0; // Serverzeit - lokale Zeit (ms)
    this.ping = 0; // Rundlaufzeit (ms)
    this._messungen = [];
    this._herzschlag = null;
    this._abbruch = false;
    this._verbindungsVersuch = null;
  }

  static url() {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return proto + location.host + '/ws';
  }

  _setzeStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this.ereignisse?.senden('netzStatus', s);
  }

  /** Nachrichten-Typ abonnieren. */
  an(typ, fn) {
    if (!this.hoerer.has(typ)) this.hoerer.set(typ, new Set());
    this.hoerer.get(typ).add(fn);
    return () => this.hoerer.get(typ)?.delete(fn);
  }

  _verteilen(n) {
    const liste = this.hoerer.get(n.t);
    if (liste) for (const fn of [...liste]) {
      try { fn(n); } catch (e) { console.error('[Netz]', e); }
    }
    const alle = this.hoerer.get('*');
    if (alle) for (const fn of [...alle]) fn(n);
  }

  get verbunden() {
    return this.status === 'verbunden' && this.ws && this.ws.readyState === 1;
  }

  /** Server-Zeit (ms) aus lokaler Zeit geschätzt. */
  serverZeit() {
    return Date.now() + this.uhrVersatz;
  }

  /**
   * Verbindet (mit Wiederholungen bis zu 90 s). Liefert true bei Erfolg.
   * Während der Wartezeit ist der Status 'aufwachen' („Server wird gestartet …“).
   */
  verbinden() {
    if (this.verbunden) return Promise.resolve(true);
    if (this._verbindungsVersuch) return this._verbindungsVersuch;
    this._abbruch = false;
    const start = Date.now();
    this._setzeStatus('verbinde');
    this._verbindungsVersuch = new Promise((aufloesen) => {
      const versuch = (n) => {
        if (this._abbruch) { this._verbindungsVersuch = null; this._setzeStatus('getrennt'); return aufloesen(false); }
        this._einmalVerbinden().then((ok) => {
          if (ok) {
            this._verbindungsVersuch = null;
            return aufloesen(true);
          }
          if (Date.now() - start > MAX_WARTEZEIT_MS) {
            this._verbindungsVersuch = null;
            this._setzeStatus('getrennt');
            return aufloesen(false);
          }
          if (n >= 1) this._setzeStatus('aufwachen');
          // Health-Check weckt einen schlafenden Server zusätzlich auf
          fetch('./healthz', { cache: 'no-store' }).catch(() => {});
          setTimeout(() => versuch(n + 1), Math.min(4000, 1000 + n * 500));
        });
      };
      versuch(0);
    });
    return this._verbindungsVersuch;
  }

  _einmalVerbinden() {
    return new Promise((aufloesen) => {
      let erledigt = false;
      let ws;
      try {
        ws = new WebSocket(NetzClient.url());
      } catch {
        return aufloesen(false);
      }
      const zeitlimit = setTimeout(() => {
        if (!erledigt) { erledigt = true; try { ws.close(); } catch { /* egal */ } aufloesen(false); }
      }, 8000);
      ws.onopen = () => {
        if (erledigt) return;
        erledigt = true;
        clearTimeout(zeitlimit);
        this.ws = ws;
        this._setzeStatus('verbunden');
        this._starteHerzschlag();
        this.uhrMessen();
        aufloesen(true);
      };
      ws.onerror = () => {
        if (!erledigt) { erledigt = true; clearTimeout(zeitlimit); aufloesen(false); }
      };
      ws.onclose = () => {
        if (!erledigt) { erledigt = true; clearTimeout(zeitlimit); aufloesen(false); return; }
        if (this.ws === ws) {
          this.ws = null;
          this._stoppeHerzschlag();
          this._setzeStatus('getrennt');
          this._verteilen({ t: '_getrennt' });
        }
      };
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string' || e.data.length > 64 * 1024) return;
        let n;
        try { n = JSON.parse(e.data); } catch { return; }
        if (!n || typeof n.t !== 'string') return;
        if (n.t === 'pong') this._pong(n);
        this._verteilen(n);
      };
    });
  }

  senden(nachricht) {
    if (!this.verbunden) return false;
    try {
      this.ws.send(JSON.stringify(nachricht));
      return true;
    } catch {
      return false;
    }
  }

  _starteHerzschlag() {
    this._stoppeHerzschlag();
    this._herzschlag = setInterval(() => this.senden({ t: 'ping', c: Date.now() }), HEARTBEAT_MS);
  }

  _stoppeHerzschlag() {
    if (this._herzschlag) clearInterval(this._herzschlag);
    this._herzschlag = null;
  }

  /** Mehrere Ping-Pong-Messungen für Uhrenversatz und Latenz. */
  uhrMessen(anzahl = 6) {
    for (let i = 0; i < anzahl; i++) setTimeout(() => this.senden({ t: 'ping', c: Date.now() }), i * 120);
  }

  _pong(n) {
    const jetzt = Date.now();
    if (typeof n.c !== 'number' || typeof n.s !== 'number' || n.c > jetzt || jetzt - n.c > 10000) return;
    const rtt = jetzt - n.c;
    const versatz = n.s + rtt / 2 - jetzt;
    this._messungen.push({ rtt, versatz });
    if (this._messungen.length > 10) this._messungen.shift();
    // Messungen mit kleiner Rundlaufzeit sind genauer → nach RTT sortiert die bessere Hälfte mitteln
    const sortiert = [...this._messungen].sort((a, b) => a.rtt - b.rtt);
    const gute = sortiert.slice(0, Math.max(1, Math.ceil(sortiert.length / 2)));
    this.uhrVersatz = gute.reduce((s, m) => s + m.versatz, 0) / gute.length;
    this.ping = Math.round(this._messungen.reduce((s, m) => s + m.rtt, 0) / this._messungen.length);
  }

  trennen() {
    this._abbruch = true;
    this._stoppeHerzschlag();
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      try { ws.close(); } catch { /* egal */ }
    }
    this._setzeStatus('getrennt');
  }
}
