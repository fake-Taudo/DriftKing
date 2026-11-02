// Reifenspuren: Ringpuffer aus Vierecken in einem einzigen Mesh. Neue Abschnitte überschreiben die ältesten,
// das Verblassen rechnet der Shader aus dem Entstehungszeitpunkt. Es wird nur der geänderte Bereich hochgeladen.
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float aZeit;
  attribute float aStaerke;
  uniform float uZeit;
  uniform float uDauer;
  varying float vDeckkraft;
  void main() {
    float u = clamp((uZeit - aZeit) / uDauer, 0.0, 1.0);
    vDeckkraft = aStaerke * (1.0 - u * u);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uFarbe;
  varying float vDeckkraft;
  void main() {
    if (vDeckkraft <= 0.004) discard;
    gl_FragColor = vec4(uFarbe, vDeckkraft);
  }
`;

const HOEHE = 0.022; // m über der Fahrbahn
const BREITE = 0.23; // m
const ABSCHNITT = 0.32; // m
const SEITENVERSATZ_MAX = 3; // m: größere Sprünge (Zurücksetzen) unterbrechen die Spur

export class Reifenspuren {
  /**
   * @param {number} maxAbschnitte
   * @param {number} [dauer] Sekunden bis zum Verschwinden
   */
  constructor(maxAbschnitte, dauer = 45) {
    this.max = maxAbschnitte;
    this.schreib = 0;
    this.zeit = 0;
    const n = maxAbschnitte * 4;
    this.posit = new Float32Array(n * 3);
    this.zeiten = new Float32Array(n).fill(-1e6);
    this.staerken = new Float32Array(n);
    const index = new Uint32Array(maxAbschnitte * 6);
    for (let i = 0; i < maxAbschnitte; i++) {
      const v = i * 4, k = i * 6;
      index[k] = v;
      index[k + 1] = v + 1;
      index[k + 2] = v + 2;
      index[k + 3] = v + 1;
      index[k + 4] = v + 3;
      index[k + 5] = v + 2;
    }
    this.geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.posit, 3).setUsage(THREE.DynamicDrawUsage);
    this.aZeit = new THREE.BufferAttribute(this.zeiten, 1).setUsage(THREE.DynamicDrawUsage);
    this.aStaerke = new THREE.BufferAttribute(this.staerken, 1).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.aPos);
    this.geo.setAttribute('aZeit', this.aZeit);
    this.geo.setAttribute('aStaerke', this.aStaerke);
    this.geo.setIndex(new THREE.BufferAttribute(index, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uZeit: { value: 0 }, uDauer: { value: dauer }, uFarbe: { value: new THREE.Color('#0b0b0d') } },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    this.objekt = new THREE.Mesh(this.geo, this.mat);
    this.objekt.frustumCulled = false;
    this.objekt.renderOrder = 2;
    this.spuren = new Map(); // Schlüssel → letzter Punkt der Spur
    this._neuVon = -1;
    this._neuAnzahl = 0;
  }

  /**
   * Meldet die Lage eines Rads in diesem Bild.
   * @param {string} schluessel Auto und Rad
   * @param {number} x Weltkoordinate
   * @param {number} z Weltkoordinate
   * @param {number} staerke 0 = keine Spur (unterbricht), sonst Deckkraft
   */
  rad(schluessel, x, z, staerke) {
    const s = this.spuren.get(schluessel);
    if (staerke <= 0) {
      if (s) s.aktiv = false;
      return;
    }
    if (!s) {
      this.spuren.set(schluessel, { x, z, nx: 0, nz: 0, aktiv: true, staerke, neu: true });
      return;
    }
    if (!s.aktiv) {
      s.x = x;
      s.z = z;
      s.aktiv = true;
      s.neu = true;
      s.staerke = staerke;
      return;
    }
    const dx = x - s.x, dz = z - s.z;
    const l = Math.hypot(dx, dz);
    if (l < ABSCHNITT) return;
    if (l > SEITENVERSATZ_MAX) {
      s.x = x;
      s.z = z;
      s.neu = true;
      return;
    }
    const nx = -dz / l, nz = dx / l;
    if (s.neu) {
      s.nx = nx;
      s.nz = nz;
      s.neu = false;
    }
    this._abschnitt(s, x, z, nx, nz, staerke);
    s.x = x;
    s.z = z;
    s.nx = nx;
    s.nz = nz;
    s.staerke = staerke;
  }

  _abschnitt(s, x, z, nx, nz, staerke) {
    const i = this.schreib;
    this.schreib = (i + 1) % this.max;
    const v = i * 4;
    const b = BREITE / 2;
    const p = this.posit;
    const setze = (k, px, pz) => {
      p[k * 3] = px;
      p[k * 3 + 1] = HOEHE;
      p[k * 3 + 2] = pz;
    };
    setze(v, s.x + s.nx * b, s.z + s.nz * b);
    setze(v + 1, s.x - s.nx * b, s.z - s.nz * b);
    setze(v + 2, x + nx * b, z + nz * b);
    setze(v + 3, x - nx * b, z - nz * b);
    for (let k = 0; k < 4; k++) {
      this.zeiten[v + k] = this.zeit;
      this.staerken[v + k] = k < 2 ? s.staerke : staerke;
    }
    if (this._neuVon < 0) this._neuVon = i;
    this._neuAnzahl++;
  }

  aktualisieren(dt) {
    this.zeit += dt;
    this.mat.uniforms.uZeit.value = this.zeit;
    if (this._neuAnzahl === 0) return;
    const von = this._neuVon, n = Math.min(this._neuAnzahl, this.max);
    for (const a of [this.aPos, this.aZeit, this.aStaerke]) {
      a.clearUpdateRanges();
      const groesse = a.itemSize * 4;
      if (von + n <= this.max) {
        a.addUpdateRange(von * groesse, n * groesse);
      } else {
        // Der Ring läuft über: zwei Bereiche
        a.addUpdateRange(von * groesse, (this.max - von) * groesse);
        a.addUpdateRange(0, (von + n - this.max) * groesse);
      }
      a.needsUpdate = true;
    }
    this._neuVon = -1;
    this._neuAnzahl = 0;
  }

  /** Alle Spuren entfernen (Neustart). */
  leeren() {
    this.zeiten.fill(-1e6);
    this.aZeit.clearUpdateRanges();
    this.aZeit.needsUpdate = true;
    for (const s of this.spuren.values()) s.aktiv = false;
  }

  freigeben() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
