// Livery: zeichnet Lack, Zweitfarbe, Muster und Aufkleber in eine Canvas-Textur (Zonen-Atlas).
// Wird nur bei Änderungen neu gezeichnet, nie pro Frame. Größe nach Qualitätsstufe (1024/2048).
import * as THREE from 'three';
import { ATLAS } from './liveryAtlas.js';
import { zeichneMuster } from './muster.js';
import { zeichneAufkleber } from './aufkleberMaler.js';

export class Livery {
  constructor(groesse = 1024) {
    this.groesse = groesse;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = groesse;
    this.ctx = this.canvas.getContext('2d');
    this.textur = new THREE.CanvasTexture(this.canvas);
    this.textur.colorSpace = THREE.SRGBColorSpace;
    this.textur.anisotropy = 4;
    this._signatur = '';
  }

  /** Ändert die Auflösung (Qualitätsstufe). */
  setzeGroesse(g) {
    if (g === this.groesse) return;
    this.groesse = g;
    this.canvas.width = this.canvas.height = g;
    this._signatur = '';
    // Größenänderung erfordert neue GPU-Textur
    this.textur.dispose();
    this.textur = new THREE.CanvasTexture(this.canvas);
    this.textur.colorSpace = THREE.SRGBColorSpace;
    this.textur.anisotropy = 4;
  }

  /**
   * Zeichnet den Look. Liefert true, wenn neu gezeichnet wurde.
   * @param {object} look
   * @param {object} [optionen] { auswahl: Index des ausgewählten Aufklebers (Garage-Markierung) }
   */
  zeichnen(look, optionen = {}) {
    const sig = JSON.stringify([look.lack, look.muster, look.aufkleber, optionen.auswahl ?? -1]);
    if (sig === this._signatur) return false;
    this._signatur = sig;
    const ctx = this.ctx;
    const g = this.groesse;
    const l = look.lack;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = l.farbe1;
    ctx.fillRect(0, 0, g, g);
    // Zweitfarbe für Dach/Haube
    if (l.zweitDach) this._zoneFuellen('dach', l.farbe2);
    if (l.zweitHaube) this._zoneFuellen('haube', l.farbe2);
    // Muster je Zone
    if (look.muster && look.muster.id !== 'keins') {
      for (const zone of Object.keys(ATLAS)) {
        if ((zone === 'dach' && l.zweitDach) || (zone === 'haube' && l.zweitHaube)) {
          // Muster liegt auch auf Zweitfarben-Flächen
        }
        this._inZone(zone, (b, h) => zeichneMuster(ctx, look.muster, zone, b, h));
      }
    }
    // Aufkleber in Ebenen-Reihenfolge
    look.aufkleber.forEach((a, i) => {
      this._inZone(a.zone, (b, h) => zeichneAufkleber(ctx, a, b, h, i === optionen.auswahl));
    });
    ctx.restore();
    this.textur.needsUpdate = true;
    return true;
  }

  _zoneFuellen(zone, farbe) {
    const z = ATLAS[zone];
    const g = this.groesse;
    this.ctx.fillStyle = farbe;
    this.ctx.fillRect(Math.floor(z.x * g), Math.floor(z.y * g), Math.ceil(z.b * g), Math.ceil(z.h * g));
  }

  /** Zeichnet in eine Zone (lokale Koordinaten 0..b, 0..h in Pixeln, mit Beschneidung). */
  _inZone(zone, fn) {
    const z = ATLAS[zone];
    if (!z) return;
    const g = this.groesse;
    const ctx = this.ctx;
    const x = z.x * g, y = z.y * g, b = z.b * g, h = z.h * g;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, b, h);
    ctx.clip();
    ctx.translate(x, y);
    fn(b, h);
    ctx.restore();
  }

  freigeben() {
    this.textur.dispose();
    this.canvas.width = this.canvas.height = 1;
  }
}
