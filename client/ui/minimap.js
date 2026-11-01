// Minimap: Strecke (mit Drift-Zonen und Startlinie) als vorgezeichnetes Bild, darüber die Autos.
// Kartenausrichtung: Norden oben (feste Karte), Autos als Pfeile in ihrer Fahrtrichtung.

export class Minimap {
  constructor(S, groesse = 150) {
    this.S = S;
    this.groesse = groesse;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.canvas.width = this.canvas.height = Math.round(groesse * dpr);
    this.canvas.style.width = this.canvas.style.height = groesse + 'px';
    this.ctx = this.canvas.getContext('2d');
    this.hintergrund = document.createElement('canvas');
    this.hintergrund.width = this.hintergrund.height = this.canvas.width;
    const g = S.grenze;
    const rand = 12;
    const b = g.maxX - g.minX - 40, h = g.maxY - g.minY - 40;
    this.skala = ((groesse - rand * 2) * dpr) / Math.max(b, h);
    this.mx = (g.minX + g.maxX) / 2;
    this.my = (g.minY + g.maxY) / 2;
    this._vorzeichnen();
  }

  _p(x, y) {
    const c = this.canvas.width / 2;
    return [c + (x - this.mx) * this.skala, c - (y - this.my) * this.skala];
  }

  _vorzeichnen() {
    const ctx = this.hintergrund.getContext('2d');
    const S = this.S;
    ctx.lineCap = ctx.lineJoin = 'round';
    const pfad = (von, bis, farbe, breite) => {
      ctx.strokeStyle = farbe;
      ctx.lineWidth = breite;
      ctx.beginPath();
      let i = von;
      let erster = true;
      while (true) {
        const p = S.proben[i];
        const [x, y] = this._p(p.x, p.y);
        if (erster) { ctx.moveTo(x, y); erster = false; } else ctx.lineTo(x, y);
        if (i === bis) break;
        i = (i + 1) % S.anzahl;
      }
      ctx.stroke();
    };
    const breite = Math.max(3, 12 * this.skala);
    pfad(0, S.anzahl - 1, 'rgba(0,0,0,0.55)', breite + 4 * this.dpr);
    pfad(0, S.anzahl - 1, 'rgba(210,216,240,0.9)', breite);
    pfad(S.anzahl - 1, 0, 'rgba(210,216,240,0.9)', breite);
    for (const z of S.zonen) pfad(z.von, z.bis, 'rgba(255,61,110,0.95)', breite * 0.7);
    // Startlinie
    const p = S.proben[S.startIdx];
    const [x, y] = this._p(p.x, p.y);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x, y, 3.5 * this.dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * @param {Array<{x:number, y:number, theta:number, farbe:string, symbol?:string}>} autos
   */
  zeichnen(autos) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.hintergrund, 0, 0);
    const d = this.dpr;
    for (const a of autos) {
      const [x, y] = this._p(a.x, a.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-a.theta);
      ctx.fillStyle = a.farbe;
      ctx.strokeStyle = '#0b0e1c';
      ctx.lineWidth = 1.5 * d;
      ctx.beginPath();
      ctx.moveTo(7 * d, 0);
      ctx.lineTo(-5 * d, 4.5 * d);
      ctx.lineTo(-3 * d, 0);
      ctx.lineTo(-5 * d, -4.5 * d);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
