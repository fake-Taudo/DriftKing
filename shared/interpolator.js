// Darstellung des gegnerischen Autos im Online-Duell: Puffer aus Zuständen mit Serverzeit, Interpolation mit
// ca. 110 ms Verzögerung und begrenzte Extrapolation. Bei Paketverlust wird weich geblendet, nie gesprungen.
import { winkelDiff } from './mathe.js';
import { INTERPOLATION_MS } from './netzwerkSchema.js';

const MAX_PUFFER = 40;
const MAX_EXTRAPOLATION = 0.25; // s
const WEICH_ZEIT = 0.18; // s: Abbau eines Sprungs in der Darstellung
const SPRUNG_AB = 12; // m: größere Sprünge (Zurücksetzen) werden sofort übernommen
const ALTER_GLAETTUNG = 0.05; // je Zustand; bei 25 Hz etwa 0,8 s Zeitkonstante

export class Interpolator {
  constructor() {
    this.puffer = [];
    this.ausgabe = { x: 0, y: 0, theta: 0, vx: 0, vy: 0, r: 0, flags: 0, tempo: 0 };
    this.fehler = { x: 0, y: 0, theta: 0 };
    this.letzteAusgabe = null;
    this.letzteZeit = 0;
    this.alter = null; // geglättetes Alter eintreffender Zustände in ms (Latenz Server → Client)
    this.statistik = { abfragen: 0, extrapoliert: 0 };
    this._lueckenMarke = { abfragen: 0, extrapoliert: 0 };
  }

  zuruecksetzen() {
    this.puffer.length = 0;
    this.letzteAusgabe = null;
    this.fehler.x = this.fehler.y = this.fehler.theta = 0;
  }

  /**
   * Neuer Zustand vom Server. Verspätete Pakete werden einsortiert, doppelte verworfen.
   * @param {object} z entpackter Zustand
   * @param {number} zeit Serverzeit des Zustands in ms
   * @param {number} [ankunft] geschätzte Serverzeit beim Eintreffen (daraus ergibt sich die Latenz)
   */
  hinzufuegen(z, zeit, ankunft = zeit) {
    const alter = ankunft - zeit;
    this.alter = this.alter === null ? alter : this.alter + (alter - this.alter) * ALTER_GLAETTUNG;
    const p = this.puffer;
    if (p.length && z.seq <= p[p.length - 1].z.seq) {
      if (p.some((e) => e.z.seq === z.seq)) return;
      const i = p.findIndex((e) => e.z.seq > z.seq);
      if (i >= 0) p.splice(i, 0, { z, zeit });
      return;
    }
    p.push({ z, zeit });
    if (p.length > MAX_PUFFER) p.shift();
  }

  /**
   * Darstellungszeit: um die gemessene Latenz und den Puffer hinter der Serverzeit. Ohne die Latenz läge sie bei
   * langsamen Verbindungen hinter dem neuesten Zustand, und das Auto würde dauernd extrapoliert. Das gemessene
   * Alter gleicht auch einen Fehler in der Uhrensynchronisation aus.
   * @param {number} jetzt Serverzeit in ms
   */
  darstellungsZeit(jetzt) {
    return jetzt - (this.alter ?? 0) - INTERPOLATION_MS;
  }

  /** Anteil der Bilder seit dem letzten Aufruf, in denen ein Zustand fehlte (für die Verbindungsqualität). */
  lueckenAnteil() {
    const s = this.statistik, m = this._lueckenMarke;
    const n = s.abfragen - m.abfragen;
    const anteil = n > 0 ? (s.extrapoliert - m.extrapoliert) / n : 0;
    m.abfragen = s.abfragen;
    m.extrapoliert = s.extrapoliert;
    return anteil;
  }

  /**
   * Zustand zur Darstellungszeit.
   * @param {number} t Darstellungszeit (Serverzeit in ms, also jetzt minus Puffer)
   * @param {number} dt seit dem letzten Aufruf vergangene Zeit in s (für das weiche Blenden)
   * @returns {object|null} null, solange noch kein Zustand vorliegt
   */
  abfragen(t, dt = 0) {
    const p = this.puffer;
    if (!p.length) return null;
    const a = this.ausgabe;
    if (dt > 0) this.statistik.abfragen++;
    let x, y, theta, vx, vy, r, flags;
    if (t <= p[0].zeit) {
      ({ x, y, theta, vx, vy, r, flags } = p[0].z);
    } else {
      let i = p.length - 1;
      while (i > 0 && p[i].zeit > t) i--;
      const e0 = p[i], e1 = p[i + 1];
      if (e1) {
        const u = (t - e0.zeit) / Math.max(1, e1.zeit - e0.zeit);
        x = e0.z.x + (e1.z.x - e0.z.x) * u;
        y = e0.z.y + (e1.z.y - e0.z.y) * u;
        theta = e0.z.theta + winkelDiff(e0.z.theta, e1.z.theta) * u;
        vx = e0.z.vx + (e1.z.vx - e0.z.vx) * u;
        vy = e0.z.vy + (e1.z.vy - e0.z.vy) * u;
        r = e0.z.r + (e1.z.r - e0.z.r) * u;
        flags = e0.z.flags;
      } else {
        // Hinter dem letzten Zustand: begrenzt in Weltkoordinaten weiterrechnen
        if (dt > 0) this.statistik.extrapoliert++;
        const s = Math.min(MAX_EXTRAPOLATION, (t - e0.zeit) / 1000);
        const c = Math.cos(e0.z.theta), n = Math.sin(e0.z.theta);
        x = e0.z.x + (c * e0.z.vx - n * e0.z.vy) * s;
        y = e0.z.y + (n * e0.z.vx + c * e0.z.vy) * s;
        theta = e0.z.theta + e0.z.r * s;
        ({ vx, vy, r, flags } = e0.z);
      }
    }
    // Verbrauchte Einträge entfernen (etwas Vorrat bleibt für verspätete Pakete)
    while (p.length > 3 && p[1].zeit < t - 200) p.shift();

    // Sprünge zwischen zwei Abfragen weich ausblenden (außer beim Zurücksetzen)
    const f = this.fehler;
    if (this.letzteAusgabe) {
      const l = this.letzteAusgabe;
      const erwartetX = l.x + l.wvx * dt, erwartetY = l.y + l.wvy * dt;
      const dx = erwartetX - x, dy = erwartetY - y;
      if (Math.hypot(dx, dy) < SPRUNG_AB) {
        f.x = dx;
        f.y = dy;
        f.theta = winkelDiff(theta, l.theta);
      } else {
        f.x = f.y = f.theta = 0;
      }
      const abbau = dt > 0 ? Math.exp(-dt / WEICH_ZEIT) : 1;
      f.x *= abbau;
      f.y *= abbau;
      f.theta *= abbau;
    }
    a.x = x + f.x;
    a.y = y + f.y;
    a.theta = theta + f.theta;
    a.vx = vx;
    a.vy = vy;
    a.r = r;
    a.flags = flags;
    a.tempo = Math.hypot(vx, vy);
    const c = Math.cos(theta), n = Math.sin(theta);
    this.letzteAusgabe = { x: a.x, y: a.y, theta: a.theta, wvx: c * vx - n * vy, wvy: n * vx + c * vy };
    return a;
  }
}
