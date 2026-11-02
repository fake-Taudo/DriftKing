// Kamera im Rennen: Verfolger (Standard), Weit-Verfolger, Vogelperspektive (schräg von oben), Motorhaube.
// Drift-Verhalten: Blickrichtung = Mischung aus Fahrzeugausrichtung (35 %) und Bewegungsrichtung (65 %),
// geglättet (τ ≈ 0,25 s) – so sieht man das Auto im Drift seitlich, ohne wildes Schwenken.
// FOV steigt mit dem Tempo, leichtes Wackeln bei Handbremse/Kontakt, keine Wanddurchdringung.
import * as THREE from 'three';

export const KAMERA_MODI = ['verfolger', 'weit', 'oben', 'haube'];

const MODUS_WERTE = {
  verfolger: { abstand: 7.0, hoehe: 2.75, blickVor: 3.0, blickHoehe: 1.0, fovMin: 60, fovMax: 75 },
  weit: { abstand: 10.5, hoehe: 4.0, blickVor: 4.0, blickHoehe: 1.0, fovMin: 58, fovMax: 72 },
  oben: { abstand: 13.0, hoehe: 15.0, blickVor: 2.0, blickHoehe: 0.0, fovMin: 50, fovMax: 58 },
  haube: { abstand: -0.6, hoehe: 1.05, blickVor: 20.0, blickHoehe: 0.9, fovMin: 70, fovMax: 85 }
};

const ANTEIL_AUSRICHTUNG = 0.35;
const FAHRT_RADIUS = 5.6; // m
const TAU_RICHTUNG = 0.25;

export class RennKamera {
  constructor(seitenverhaeltnis) {
    this.kamera = new THREE.PerspectiveCamera(60, seitenverhaeltnis, 0.1, 1500);
    this.modus = 'verfolger';
    this.richtung = new THREE.Vector2(1, 0); // geglättete Blickrichtung (Physik-2D)
    this.abstandAktuell = MODUS_WERTE.verfolger.abstand;
    this.wackeln = 0;
    this._zeit = 0;
    this._ziel = new THREE.Vector3();
    this._blick = new THREE.Vector3();
    this.reduziert = false; // reduzierte Effekte: kein Wackeln
    this.erstesBild = true;
  }

  setzeModus(modus) {
    if (MODUS_WERTE[modus]) this.modus = modus;
    this.erstesBild = true;
  }

  naechsterModus() {
    const i = KAMERA_MODI.indexOf(this.modus);
    this.setzeModus(KAMERA_MODI[(i + 1) % KAMERA_MODI.length]);
    return this.modus;
  }

  seitenverhaeltnis(a) {
    this.kamera.aspect = a;
    this.kamera.updateProjectionMatrix();
  }

  /**
   * Kamerafahrt um ein Auto, etwa den Sieger am Ende eines Laufs.
   * @param {() => {x:number,y:number,theta:number}} ziel liefert die Lage des Autos
   * @param {number} dauer Sekunden
   */
  kamerafahrt(ziel, dauer) {
    if (this.reduziert || this.modus === 'haube') return;
    const d = ziel();
    this.fahrt = { ziel, rest: dauer, winkel: d.theta + Math.PI * 0.72 };
  }

  /** Stoß für Kamerawackeln (0..1). */
  stoss(staerke) {
    if (this.reduziert) return;
    this.wackeln = Math.min(1, Math.max(this.wackeln, staerke));
  }

  /**
   * @param {{x:number, y:number, theta:number, vx:number, vy:number, tempo:number, hoechst:number}} ziel interpolierter Zustand
   * @param {number} dt
   * @param {import('@shared/physik/kollision.js').KollisionsGitter} [gitter]
   */
  aktualisieren(ziel, dt, gitter) {
    const w = MODUS_WERTE[this.modus];
    this._zeit += dt;
    // Gewünschte Richtung: Mischung aus Ausrichtung und Bewegungsrichtung
    const hx = Math.cos(ziel.theta), hy = Math.sin(ziel.theta);
    let rx = hx, ry = hy;
    if (ziel.tempo > 2 && this.modus !== 'haube') {
      const c = Math.cos(ziel.theta), s = Math.sin(ziel.theta);
      const bx = (ziel.vx * c - ziel.vy * s) / ziel.tempo;
      const by = (ziel.vx * s + ziel.vy * c) / ziel.tempo;
      // Rückwärtsfahrt: nicht nach hinten schwenken
      const vorwaerts = bx * hx + by * hy > -0.2;
      if (vorwaerts) {
        const misch = Math.min(1, (ziel.tempo - 2) / 4);
        rx = hx * ANTEIL_AUSRICHTUNG + bx * (1 - ANTEIL_AUSRICHTUNG) * misch + hx * (1 - ANTEIL_AUSRICHTUNG) * (1 - misch);
        ry = hy * ANTEIL_AUSRICHTUNG + by * (1 - ANTEIL_AUSRICHTUNG) * misch + hy * (1 - ANTEIL_AUSRICHTUNG) * (1 - misch);
      }
    }
    const l = Math.hypot(rx, ry) || 1;
    rx /= l; ry /= l;
    if (this.erstesBild) {
      this.richtung.set(rx, ry);
      this.erstesBild = false;
    } else {
      const k = this.modus === 'haube' ? 1 : 1 - Math.exp(-dt / TAU_RICHTUNG);
      this.richtung.x += (rx - this.richtung.x) * k;
      this.richtung.y += (ry - this.richtung.y) * k;
      this.richtung.normalize();
    }
    const dx = this.richtung.x, dy = this.richtung.y;

    // Kamera-Kollision: Strahl vom Auto zur Wunschposition, Annäherung statt Durchdringen
    let abstand = w.abstand;
    if (gitter && w.abstand > 0 && this.modus !== 'oben') {
      const ax = ziel.x, ay = ziel.y;
      const bx = ax - dx * (w.abstand + 0.6), by = ay - dy * (w.abstand + 0.6);
      const t = gitter.strahl(ax, ay, bx, by);
      if (t < 1) abstand = Math.max(1.8, t * (w.abstand + 0.6) - 0.6);
    }
    // Schnell heran, langsam wieder weg
    const tau = abstand < this.abstandAktuell ? 0.05 : 0.6;
    this.abstandAktuell += (abstand - this.abstandAktuell) * (1 - Math.exp(-dt / tau));
    const hoeheFaktor = w.abstand > 0 ? Math.max(0.7, this.abstandAktuell / w.abstand) : 1;

    const px = ziel.x - dx * this.abstandAktuell;
    const py = ziel.y - dy * this.abstandAktuell;
    this._ziel.set(px, w.hoehe * hoeheFaktor, -py);
    this._blick.set(ziel.x + dx * w.blickVor, w.blickHoehe, -(ziel.y + dy * w.blickVor));

    if (this.modus === 'haube') {
      this._ziel.set(ziel.x + hx * 0.4, w.hoehe, -(ziel.y + hy * 0.4));
      this._blick.set(ziel.x + hx * w.blickVor, w.blickHoehe, -(ziel.y + hy * w.blickVor));
    }

    // Wackeln (abklingend)
    if (this.wackeln > 0.001) {
      const a = this.wackeln * 0.18;
      this._ziel.x += Math.sin(this._zeit * 53) * a;
      this._ziel.y += Math.sin(this._zeit * 41 + 1.3) * a * 0.7;
      this._ziel.z += Math.cos(this._zeit * 47) * a;
      this.wackeln *= Math.exp(-dt / 0.18);
    }

    if (this.fahrt) {
      const fa = this.fahrt;
      fa.rest -= dt;
      fa.winkel += dt * 0.55;
      const d = fa.ziel();
      const cx = Math.cos(fa.winkel), cy = Math.sin(fa.winkel);
      // Nicht durch Wände: Der Radius schrumpft notfalls
      const t = gitter ? gitter.strahl(d.x, d.y, d.x + cx * FAHRT_RADIUS, d.y + cy * FAHRT_RADIUS) : 1;
      const r = t < 1 ? Math.max(2.4, t * FAHRT_RADIUS - 0.5) : FAHRT_RADIUS;
      this._ziel.set(d.x + cx * r, 1.45, -(d.y + cy * r));
      this._blick.set(d.x, 0.7, -d.y);
      if (fa.rest <= 0) {
        this.fahrt = null;
        this.erstesBild = true;
      }
    }

    this.kamera.position.copy(this._ziel);
    this.kamera.lookAt(this._blick);

    // FOV mit dem Tempo
    const anteil = Math.min(1, ziel.tempo / Math.max(20, ziel.hoechst));
    const fov = w.fovMin + (w.fovMax - w.fovMin) * anteil;
    if (Math.abs(this.kamera.fov - fov) > 0.05) {
      this.kamera.fov += (fov - this.kamera.fov) * Math.min(1, dt * 4);
      this.kamera.updateProjectionMatrix();
    }
  }
}
