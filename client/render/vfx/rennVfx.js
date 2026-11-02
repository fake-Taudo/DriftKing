// Effekte im Rennen: Reifenqualm, Reifenspuren, Funken, Backfire, Tempolinien, Vignette, Leuchtfaden und Wetter.
// Menge und Dichte skalieren mit der Qualitätsstufe; „Reduzierte Effekte“ nimmt alles Hektische heraus.
import * as THREE from 'three';
import { PartikelSchwarm } from './partikel.js';
import { Reifenspuren } from './reifenspuren.js';
import { Tempolinien, Leuchtfaden } from './bildEffekte.js';
import { abstandsBewertung } from '../../../shared/wertung.js';

const SPUREN_JE_STUFE = { niedrig: 400, mittel: 900, hoch: 1800 };
const WIND = { staub: [1.3, 0.4], gischt: [3.2, 1.2], regen: [1.6, 0.6] };
const SZENEN_LICHT = { Tag: 0.78, Sonnenuntergang: 0.8, Nacht: 0.5 }; // unter der Bloom-Schwelle: Qualm leuchtet nicht
const QUALM_JE_SEKUNDE = 72; // je Rad bei voller Stärke und Qualitätsstufe Hoch
const LINIEN_ANTEIL = { niedrig: 0.4, mittel: 0.7, hoch: 1 };
const FADEN_STAERKE = { gut: 0.75, mittel: 0.28, schlecht: 0.1 };

const klemme = (x, a, b) => Math.min(b, Math.max(a, x));
const zufall = (a, b) => a + Math.random() * (b - a);

/** HSV-Regenbogen für den Regenbogen-Qualm. */
function regenbogen(h, ziel) {
  ziel.setHSL(h % 1, 0.95, 0.62);
  return ziel;
}

export class RennVfx {
  /** @param {import('../../modi/rennen.js').Rennen} rennen */
  constructor(rennen) {
    this.rennen = rennen;
    this.spiel = rennen.spiel;
    const szene = rennen.szene;
    const def = rennen.S.def;
    this.wetter = def.wetter;
    this.wind = WIND[def.wetter] || [1, 0.3];
    const licht = SZENEN_LICHT[def.tageszeit] ?? 1;
    const stufe = this.spiel.qualitaet.aktuell.id;

    this.rauch = new PartikelSchwarm({ max: 700, haerte: 1.3, licht });
    // Deckend statt additiv: Auf hellem Beton würden sie sonst rein weiß und verschwinden
    this.funken = new PartikelSchwarm({ max: 180, streckung: 0.035, haerte: 0.5 });
    this.glut = new PartikelSchwarm({ max: 90, haerte: 0.7 });
    this.spuren = new Reifenspuren(SPUREN_JE_STUFE[stufe] ?? 900);
    this.linien = new Tempolinien();
    this.faden = new Leuchtfaden();
    this.umwelt = this.wetter === 'regen'
      ? new PartikelSchwarm({ max: 520, additiv: true, streckung: 0.045, haerte: 0.8 })
      : new PartikelSchwarm({ max: 220, haerte: 1.8, licht });
    for (const t of [this.rauch, this.funken, this.glut, this.spuren, this.linien, this.faden, this.umwelt]) szene.add(t.objekt);

    this.vignette = document.createElement('div');
    this.vignette.className = 'hud-vignette';
    this.spiel.uiWurzel.prepend(this.vignette);
    this._vignetteWert = -1;

    this._farbe = new THREE.Color();
    this._v = new THREE.Vector3();
    this._umweltAkku = 0;
    this._zeit = 0;
    this.einstellungenNeu();
  }

  einstellungenNeu() {
    this.reduziert = this.spiel.wenigerEffekte;
    const q = this.spiel.qualitaet.aktuell;
    this.skala = q.partikel * (this.reduziert ? 0.6 : 1);
    this.linienAnteil = LINIEN_ANTEIL[q.id] ?? 0.7;
    this.mitVignette = q.id !== 'niedrig' && !this.reduziert;
  }

  /** Neuer Durchgang oder Neustart: Spuren und Qualm entfernen. */
  leeren() {
    this.rauch.leeren();
    this.funken.leeren();
    this.glut.leeren();
    this.spuren.leeren();
  }

  // -------------------------------------------------------------------------
  // Ereignisse der Physik

  fahrzeugEreignis(a, ev) {
    if (ev.art === 'wand') this._wandTreffer(ev);
    else if (ev.art === 'fehlzuendung') this._backfire(a, ev.staerke);
  }

  _wandTreffer(ev) {
    if (ev.staerke < 1.5) return;
    const n = Math.round(klemme(ev.staerke * 4, 4, 34) * Math.max(0.35, this.skala));
    const wx = ev.x, wz = -ev.y;
    const nx = ev.nx, nz = -ev.ny;
    for (let i = 0; i < n; i++) {
      const tangente = zufall(-1, 1) * 7;
      const heraus = zufall(1, 7);
      const rot = Math.random();
      this.funken.ausstossen({
        x: wx, y: zufall(0.2, 0.75), z: wz,
        vx: nx * heraus - nz * tangente,
        vy: zufall(0.5, 5),
        vz: nz * heraus + nx * tangente,
        dauer: zufall(0.22, 0.6),
        groesse: zufall(0.02, 0.045),
        r: 1, g: 0.55 + rot * 0.35, b: 0.12 + rot * 0.2,
        zug: 1.2,
        auftrieb: -9
      });
    }
    // Etwas Staub vom Anprall
    const puffs = Math.round(klemme(ev.staerke, 1, 6) * this.skala);
    for (let i = 0; i < puffs; i++) {
      this.rauch.ausstossen({
        x: wx + zufall(-0.3, 0.3), y: zufall(0.2, 0.7), z: wz + zufall(-0.3, 0.3),
        vx: nx * zufall(0.5, 2), vy: zufall(0.2, 1), vz: nz * zufall(0.5, 2),
        dauer: zufall(0.5, 1), groesse: 0.3, groesseEnde: 1.2,
        r: 0.55, g: 0.53, b: 0.5, deckkraft: 0.28, zug: 1.5
      });
    }
  }

  /** Flammen am Auspuff: nur mit dem Backfire-Auspuff aus dem Shop. */
  _backfire(a, staerke) {
    const stark = a.modell.look.backfire ?? 0;
    if (stark <= 0) return;
    const f = a.fahrzeug;
    const th = a.darstellung.theta ?? f.z.theta;
    const hx = -Math.cos(th), hz = Math.sin(th);
    a.modell.objekt.updateMatrixWorld();
    for (const p of a.modell.auspuffPositionen || []) {
      this._v.set(p[0], p[1], p[2]);
      a.modell.objekt.localToWorld(this._v);
      const n = Math.round((6 + 12 * stark * staerke) * Math.max(0.5, this.skala));
      for (let i = 0; i < n; i++) {
        const heiss = Math.random();
        const t = zufall(2, 9);
        this.glut.ausstossen({
          x: this._v.x, y: this._v.y, z: this._v.z,
          vx: hx * t + zufall(-0.9, 0.9), vy: zufall(-0.2, 1), vz: hz * t + zufall(-0.9, 0.9),
          dauer: zufall(0.07, 0.17), groesse: zufall(0.09, 0.16), groesseEnde: zufall(0.18, 0.34),
          r: 1, g: 0.4 + heiss * 0.45, b: 0.06 + heiss * 0.2,
          zug: 4
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Pro Bild

  frame(frameDt, rennen) {
    if (rennen.pausiert) return;
    const dt = frameDt * (this.spiel.schleife.zeitFaktor ?? 1);
    this._zeit += dt;
    for (const a of rennen.autos) this._autoEffekte(a, dt);
    this._umweltEffekte(dt);
    this._tempoEffekte(dt);
    this._tandem(dt);
    const [wx, wz] = this.wind;
    this.rauch.aktualisieren(dt, wx, wz);
    this.funken.aktualisieren(dt, 0, 0);
    this.glut.aktualisieren(dt, 0, 0);
    this.umwelt.aktualisieren(dt, wx, wz);
    this.spuren.aktualisieren(dt);
  }

  /** Schlupf: gemessen bei eigenen Autos, beim Netz-Gegner aus den übertragenen Geschwindigkeiten geschätzt. */
  _schlupf(a) {
    const z = a.fahrzeug.z;
    if (a.netz) {
      const winkel = Math.abs(Math.atan2(z.vy, Math.max(Math.abs(z.vx), 1)));
      return { hinten: winkel / 0.14, dreht: 0, vorne: 0, hb: !!z.handbremse };
    }
    return { hinten: z.schlupfNormH || 0, dreht: z.durchdrehen || 0, vorne: Math.abs(z.schlupfV || 0), hb: !!z.handbremse };
  }

  _autoEffekte(a, dt) {
    const d = a.darstellung;
    if (d.x === undefined) return;
    const f = a.fahrzeug;
    const tempo = d.tempo ?? f.tempo;
    const s = this._schlupf(a);
    const fuerSpur = tempo > 2.5 && (s.hinten > 1.02 || s.dreht > 0.2 || (s.hb && tempo > 3));
    const staerke = klemme((s.hinten - 0.95) * 1.5 + s.dreht * 0.5 + (s.hb ? 0.35 : 0), 0, 1);
    const c = Math.cos(d.theta), n = Math.sin(d.theta);
    const lh = f.lh ?? 1.2, lv = f.lv ?? 1.2;
    const spur = (f.p.spurweite ?? 1.5) / 2;
    const rx = d.x - lh * c, ry = d.y - lh * n;
    // Hinterräder (links = -n, c)
    const lx = rx - n * spur, ly = ry + c * spur;
    const hx = rx + n * spur, hy = ry - c * spur;
    const spurStaerke = fuerSpur ? 0.2 + staerke * 0.55 : 0;
    this.spuren.rad(a.name + ':hl', lx, -ly, spurStaerke);
    this.spuren.rad(a.name + ':hr', hx, -hy, spurStaerke);
    // Vorderräder nur beim starken Schieben
    const vorne = tempo > 6 && s.vorne > 0.3 ? klemme((s.vorne - 0.3) * 0.8, 0.08, 0.35) : 0;
    const vx0 = d.x + lv * c, vy0 = d.y + lv * n;
    this.spuren.rad(a.name + ':vl', vx0 - n * spur, -(vy0 + c * spur), vorne);
    this.spuren.rad(a.name + ':vr', vx0 + n * spur, -(vy0 - c * spur), vorne);

    // Qualm
    if (fuerSpur && staerke > 0.04) {
      // Langsam dreht sich der Qualm sonst um das Auto und verdeckt es
      const anTempo = klemme(tempo / 9, 0.3, 1);
      a._qualmAkku = (a._qualmAkku || 0) + QUALM_JE_SEKUNDE * this.skala * staerke * anTempo * dt;
      const ziel = Math.floor(a._qualmAkku);
      if (ziel > 0) {
        a._qualmAkku -= ziel;
        const wv = f.weltGeschwindigkeit ?? { x: 0, y: 0 };
        for (let i = 0; i < ziel; i++) this._qualm(a, lx, ly, hx, hy, i, wv, staerke);
      }
    }

    // Funken am Unterboden: nur sehr tief gelegt und bei starkem Nicken
    const tief = a.modell.look.fahrwerk?.tiefe ?? 0;
    if (!a.netz && tief >= 0.7 && Math.abs(f.z.axGl || 0) > 8 && tempo > 8 && Math.random() < dt * 10 * Math.max(0.4, this.skala)) {
      const r = Math.random();
      this.funken.ausstossen({
        x: d.x - c * lh * 0.4 + zufall(-0.3, 0.3), y: 0.06, z: -(d.y - n * lh * 0.4) + zufall(-0.3, 0.3),
        vx: c * tempo * 0.5 + zufall(-1.5, 1.5), vy: zufall(0.5, 2.5), vz: -n * tempo * 0.5 + zufall(-1.5, 1.5),
        dauer: zufall(0.15, 0.32), groesse: 0.014,
        r: 1, g: 0.6 + r * 0.3, b: 0.25, auftrieb: -9, zug: 1
      });
    }
  }

  _qualm(a, lx, ly, hx, hy, i, wv, staerke) {
    const li = i % 2 === 0;
    const x = li ? lx : hx, y = li ? ly : hy;
    const q = a.modell.look.qualm ?? '#eeeeee';
    const farbe = this._farbe;
    if (q === 'regenbogen') regenbogen(this._zeit * 0.45 + Math.random() * 0.03, farbe);
    else farbe.set(q);
    const dunkel = q === '#1b1b1f';
    this.rauch.ausstossen({
      x: x + zufall(-0.12, 0.12), y: zufall(0.06, 0.16), z: -y + zufall(-0.12, 0.12),
      vx: (wv.x ?? 0) * 0.1 + zufall(-0.5, 0.5),
      vy: zufall(0.2, 0.65),
      vz: -(wv.y ?? 0) * 0.1 + zufall(-0.5, 0.5),
      dauer: zufall(0.9, 2),
      groesse: zufall(0.18, 0.3),
      groesseEnde: zufall(1.1, 2),
      r: farbe.r, g: farbe.g, b: farbe.b,
      deckkraft: (dunkel ? 0.5 : 0.38) * (0.45 + staerke * 0.55),
      zug: 1.1,
      auftrieb: 0.25,
      dreh: zufall(-0.5, 0.5)
    });
  }

  _umweltEffekte(dt) {
    const k = this.rennen.kamera.position;
    const raten = { staub: 11, gischt: 7, regen: 430 };
    const rate = raten[this.wetter];
    if (!rate) return;
    this._umweltAkku += rate * this.skala * dt;
    const n = Math.floor(this._umweltAkku);
    this._umweltAkku -= n;
    for (let i = 0; i < n; i++) {
      if (this.wetter === 'regen') {
        this.umwelt.ausstossen({
          x: k.x + zufall(-24, 24), y: zufall(8, 15), z: k.z + zufall(-24, 24),
          vx: 1.6, vy: -24, vz: 0.6,
          dauer: zufall(0.4, 0.62), groesse: 0.012,
          r: 0.55, g: 0.68, b: 0.95, deckkraft: 0.45
        });
      } else if (this.wetter === 'staub') {
        this.umwelt.ausstossen({
          x: k.x + zufall(-28, 28), y: zufall(0.2, 4), z: k.z + zufall(-28, 28),
          vx: zufall(-0.3, 0.3), vy: zufall(-0.05, 0.12), vz: zufall(-0.3, 0.3),
          dauer: zufall(4, 8), groesse: zufall(0.2, 0.5), groesseEnde: zufall(0.8, 1.6),
          r: 0.72, g: 0.64, b: 0.52, deckkraft: 0.13, zug: 0.8, dreh: zufall(-0.2, 0.2)
        });
      } else {
        this.umwelt.ausstossen({
          x: k.x + zufall(-45, 45), y: zufall(0.6, 6), z: k.z + zufall(-45, 45),
          vx: zufall(0, 1), vy: zufall(-0.1, 0.3), vz: zufall(-0.3, 0.6),
          dauer: zufall(3, 6), groesse: zufall(2, 4), groesseEnde: zufall(5, 9),
          r: 0.92, g: 0.95, b: 0.98, deckkraft: 0.1, zug: 0.7, dreh: zufall(-0.1, 0.1)
        });
      }
    }
  }

  _tempoEffekte(dt) {
    const r = this.rennen;
    const f = r.spieler?.fahrzeug;
    if (!f) return;
    const anteil = klemme((f.tempo / ((f.p.hoechstKmhAuslegung || 180) / 3.6) - 0.55) / 0.4, 0, 1);
    const fahrt = r.zustand === 'laeuft' || r.zustand === 'ziel';
    const staerke = fahrt && !this.reduziert ? anteil : 0;
    // Das Linienfeld spiegelt sich nicht: uSeite bleibt für ein Bildseitenverhältnis wie im Querformat gleich
    this.linien.aktualisieren(dt, staerke, this.linienAnteil);
    const v = this.mitVignette ? Math.round(staerke * 20) / 20 : 0;
    if (v !== this._vignetteWert) {
      this._vignetteWert = v;
      this.vignette.style.opacity = String(v * 0.75);
    }
  }

  _tandem(dt) {
    const r = this.rennen;
    if (!r.istBattle || r.autos.length < 2) return;
    const a = r.autos[0].darstellung, b = r.autos[1].darstellung;
    if (a.x === undefined || b.x === undefined) return;
    const m = Math.hypot(a.x - b.x, a.y - b.y);
    const ziel = r.zustand === 'laeuft' && m < 45 && m > 1.5 ? FADEN_STAERKE[abstandsBewertung(m)] ?? 0.1 : 0;
    this.faden.aktualisieren(dt, a, b, this.reduziert ? ziel * 0.6 : ziel);
  }

  freigeben() {
    const szene = this.rennen.szene;
    for (const t of [this.rauch, this.funken, this.glut, this.spuren, this.linien, this.faden, this.umwelt]) {
      szene.remove(t.objekt);
      t.freigeben();
    }
    this.vignette.remove();
  }
}
