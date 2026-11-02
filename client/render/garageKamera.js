// Kamera der Garage: frei drehbar um das Auto (Wischen/Maus), Zoom begrenzt (Mausrad/zwei Finger),
// Schnellansichten mit weichem Übergang. Die Bildmitte lässt sich per View-Offset in den freien Bereich
// neben dem Bedienfeld verschieben, damit das Auto nie unter dem Panel steht.
import * as THREE from 'three';

const GRAD = Math.PI / 180;

export class GarageKamera {
  constructor(seitenverhaeltnis) {
    this.kamera = new THREE.PerspectiveCamera(38, seitenverhaeltnis, 0.05, 160);
    this.ziel = new THREE.Vector3(0, 0.6, 0);
    this.sollZiel = this.ziel.clone();
    this.az = 40 * GRAD;
    this.el = 12 * GRAD;
    this.abstand = 7;
    this.sollAz = this.az;
    this.sollEl = this.el;
    this.sollAbstand = this.abstand;
    this.minAbstand = 3;
    this.maxAbstand = 14;
    this.basisAbstand = 7;
    this.zeiger = new Map();
    this._pinch = 0;
    this.beiBedienung = null;
  }

  /**
   * Passt Seitenverhältnis und Bildmitte an den freien Bereich an.
   * @param {number} b Fensterbreite
   * @param {number} h Fensterhöhe
   * @param {{rechts:number, unten:number}} frei vom Panel verdeckte Breite bzw. Höhe (px)
   */
  layout(b, h, { rechts = 0, unten = 0 } = {}) {
    const k = this.kamera;
    k.aspect = b / h;
    k.setViewOffset(b, h, rechts / 2, unten / 2, b, h);
    k.updateProjectionMatrix();
    // Abstand, bei dem das Auto (ca. 5 m lang, 2 m hoch) in den freien Bereich passt
    const freiB = Math.max(80, b - rechts), freiH = Math.max(80, h - unten);
    const tanH = Math.tan((k.fov * GRAD) / 2) * 2;
    const neu = Math.max(4.6, Math.max((6.2 * h) / (freiB * tanH), (2.4 * h) / (freiH * tanH)));
    const faktor = neu / this.basisAbstand;
    this.basisAbstand = neu;
    this.minAbstand = neu * 0.55;
    this.maxAbstand = neu * 1.9;
    this.sollAbstand = this.sollAbstand * faktor;
  }

  /**
   * Fährt eine Ansicht an.
   * @param {{az:number, el:number, abstand?:number, relativ?:number, ziel?:number[], min?:number}} a az/el in Grad
   */
  fahreZu({ az, el, abstand, relativ = 1, ziel = [0, 0.6, 0], min }) {
    // Kürzesten Weg um das Auto nehmen
    let soll = az * GRAD;
    const voll = Math.PI * 2;
    soll += Math.round((this.az - soll) / voll) * voll;
    this.sollAz = soll;
    this.sollEl = el * GRAD;
    this.sollAbstand = abstand ?? this.basisAbstand * relativ;
    this.sollZiel.set(ziel[0], ziel[1], ziel[2]);
    this.minOverride = min ?? null;
  }

  drehen(dx, dy) {
    this.sollAz -= dx * 0.0075;
    this.sollEl = Math.min(80 * GRAD, Math.max(-2 * GRAD, this.sollEl + dy * 0.005));
    this.beiBedienung?.();
  }

  zoomen(faktor) {
    const min = this.minOverride ?? this.minAbstand;
    this.sollAbstand = Math.min(this.maxAbstand, Math.max(min, this.sollAbstand * faktor));
    this.beiBedienung?.();
  }

  /** Bindet Zeiger-Ereignisse an die Leinwand. Liefert eine Abmelde-Funktion. */
  binden(el) {
    const runter = (e) => {
      this.zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      this._pinch = 0;
    };
    const bewegen = (e) => {
      const z = this.zeiger.get(e.pointerId);
      if (!z) return;
      if (this.zeiger.size === 1) {
        this.drehen(e.clientX - z.x, e.clientY - z.y);
      }
      z.x = e.clientX;
      z.y = e.clientY;
      if (this.zeiger.size === 2) {
        const [a, b] = [...this.zeiger.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this._pinch > 0 && d > 0) this.zoomen(this._pinch / d);
        this._pinch = d;
      }
    };
    const hoch = (e) => {
      this.zeiger.delete(e.pointerId);
      this._pinch = 0;
    };
    const rad = (e) => {
      e.preventDefault();
      this.zoomen(e.deltaY > 0 ? 1.08 : 0.92);
    };
    el.addEventListener('pointerdown', runter);
    el.addEventListener('pointermove', bewegen);
    el.addEventListener('pointerup', hoch);
    el.addEventListener('pointercancel', hoch);
    el.addEventListener('wheel', rad, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', runter);
      el.removeEventListener('pointermove', bewegen);
      el.removeEventListener('pointerup', hoch);
      el.removeEventListener('pointercancel', hoch);
      el.removeEventListener('wheel', rad);
    };
  }

  frame(dt) {
    const k = 1 - Math.exp(-dt / 0.14);
    this.az += (this.sollAz - this.az) * k;
    this.el += (this.sollEl - this.el) * k;
    this.abstand += (this.sollAbstand - this.abstand) * k;
    this.ziel.lerp(this.sollZiel, k);
    const c = Math.cos(this.el);
    this.kamera.position.set(
      this.ziel.x + Math.sin(this.az) * c * this.abstand,
      this.ziel.y + Math.sin(this.el) * this.abstand,
      this.ziel.z + Math.cos(this.az) * c * this.abstand
    );
    this.kamera.lookAt(this.ziel);
  }

  freigeben() {
    this.kamera.clearViewOffset();
  }
}
