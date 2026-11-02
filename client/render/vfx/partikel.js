// Partikelschwarm mit Instancing: ein Draw Call, alle Daten in Instanz-Attributen. Die Bewegung rechnet die CPU,
// der Vertex-Shader richtet die Quads zur Kamera aus (optional entlang der Bewegung gestreckt, für Funken und Regen).
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute vec2 ecke;
  attribute vec4 iPos;    // xyz, Größe
  attribute vec4 iFarbe;  // rgb, Deckkraft
  attribute vec4 iBewegung; // xyz Richtung (für die Streckung), w Drehung
  uniform float uStreckung;
  varying vec2 vUv;
  varying vec4 vFarbe;
  void main() {
    vUv = ecke * 0.5 + 0.5;
    vFarbe = iFarbe;
    vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
    vec2 versatz;
    if (uStreckung > 0.0) {
      // Quad entlang der Bewegung auf dem Bildschirm
      vec3 d = (modelViewMatrix * vec4(iBewegung.xyz, 0.0)).xyz;
      float l = length(d.xy);
      vec2 a = l > 0.001 ? d.xy / l : vec2(0.0, 1.0);
      vec2 q = vec2(-a.y, a.x);
      versatz = q * ecke.x * iPos.w + a * ecke.y * (iPos.w + l * uStreckung);
    } else {
      float c = cos(iBewegung.w), s = sin(iBewegung.w);
      versatz = vec2(c * ecke.x - s * ecke.y, s * ecke.x + c * ecke.y) * iPos.w;
    }
    mv.xy += versatz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  varying vec2 vUv;
  varying vec4 vFarbe;
  uniform float uHaerte;
  uniform float uLicht;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = dot(p, p);
    if (r > 1.0) discard;
    float a = pow(1.0 - r, uHaerte) * vFarbe.a;
    gl_FragColor = vec4(vFarbe.rgb * uLicht, a);
  }
`;

export class PartikelSchwarm {
  /**
   * @param {object} o
   * @param {number} o.max Höchstzahl gleichzeitig
   * @param {boolean} [o.additiv] leuchtend (Funken, Flammen) statt deckend (Qualm)
   * @param {number} [o.streckung] > 0: entlang der Bewegung strecken
   * @param {number} [o.haerte] Randverlauf (groß = weich)
   * @param {number} [o.licht] Helligkeit der Szene (Nacht dunkler)
   */
  constructor({ max, additiv = false, streckung = 0, haerte = 1.4, licht = 1 }) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 4);
    this.farbe = new Float32Array(max * 4);
    this.bewegung = new Float32Array(max * 4);
    // Nur für die CPU: Geschwindigkeit, Alter, Lebensdauer, Größen, Deckkraft, Zug, Auftrieb, Drehrate
    this.v = new Float32Array(max * 3);
    this.leben = new Float32Array(max * 2); // Alter, Dauer
    this.form = new Float32Array(max * 3); // Größe Start, Größe Ende, Deckkraft
    this.kraft = new Float32Array(max * 3); // Zug, Auftrieb, Drehrate
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.setAttribute('ecke', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    this.geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 4).setUsage(THREE.DynamicDrawUsage);
    this.aFarbe = new THREE.InstancedBufferAttribute(this.farbe, 4).setUsage(THREE.DynamicDrawUsage);
    this.aBewegung = new THREE.InstancedBufferAttribute(this.bewegung, 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iPos', this.aPos);
    this.geo.setAttribute('iFarbe', this.aFarbe);
    this.geo.setAttribute('iBewegung', this.aBewegung);
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); // nur für three.js
    this.geo.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uStreckung: { value: streckung }, uHaerte: { value: haerte }, uLicht: { value: licht } },
      transparent: true,
      depthWrite: false,
      blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.objekt = new THREE.Mesh(this.geo, this.mat);
    this.objekt.frustumCulled = false;
    this.objekt.renderOrder = additiv ? 12 : 10;
    this.objekt.visible = false;
  }

  /**
   * Stößt ein Partikel aus. Ist der Schwarm voll, wird das älteste Partikel ersetzt.
   * @param {{x,y,z,vx?,vy?,vz?,dauer,groesse,groesseEnde?,r,g,b,deckkraft?,zug?,auftrieb?,dreh?}} p (Weltkoordinaten)
   */
  ausstossen(p) {
    let i = this.n;
    if (i >= this.max) {
      // Ältestes Partikel suchen wäre teuer: Ein zufälliges Opfer fällt im dichten Qualm nicht auf
      i = Math.floor(Math.random() * this.max);
    } else {
      this.n++;
    }
    const i4 = i * 4, i3 = i * 3, i2 = i * 2;
    this.pos[i4] = p.x;
    this.pos[i4 + 1] = p.y;
    this.pos[i4 + 2] = p.z;
    this.pos[i4 + 3] = p.groesse;
    this.farbe[i4] = p.r;
    this.farbe[i4 + 1] = p.g;
    this.farbe[i4 + 2] = p.b;
    this.farbe[i4 + 3] = 0;
    this.bewegung[i4 + 3] = Math.random() * Math.PI * 2;
    this.v[i3] = p.vx || 0;
    this.v[i3 + 1] = p.vy || 0;
    this.v[i3 + 2] = p.vz || 0;
    this.leben[i2] = 0;
    this.leben[i2 + 1] = p.dauer;
    this.form[i3] = p.groesse;
    this.form[i3 + 1] = p.groesseEnde ?? p.groesse;
    this.form[i3 + 2] = p.deckkraft ?? 1;
    this.kraft[i3] = p.zug || 0;
    this.kraft[i3 + 1] = p.auftrieb || 0;
    this.kraft[i3 + 2] = p.dreh || 0;
  }

  _entfernen(i) {
    const l = --this.n;
    if (i === l) return;
    const i4 = i * 4, l4 = l * 4, i3 = i * 3, l3 = l * 3;
    for (let k = 0; k < 4; k++) {
      this.pos[i4 + k] = this.pos[l4 + k];
      this.farbe[i4 + k] = this.farbe[l4 + k];
      this.bewegung[i4 + k] = this.bewegung[l4 + k];
    }
    for (let k = 0; k < 3; k++) {
      this.v[i3 + k] = this.v[l3 + k];
      this.form[i3 + k] = this.form[l3 + k];
      this.kraft[i3 + k] = this.kraft[l3 + k];
    }
    this.leben[i * 2] = this.leben[l * 2];
    this.leben[i * 2 + 1] = this.leben[l * 2 + 1];
  }

  /** @param {number} dt @param {number} windX @param {number} windZ Wind in m/s (Weltkoordinaten) */
  aktualisieren(dt, windX = 0, windZ = 0) {
    for (let i = this.n - 1; i >= 0; i--) {
      const i2 = i * 2, i3 = i * 3, i4 = i * 4;
      const alter = (this.leben[i2] += dt);
      const dauer = this.leben[i2 + 1];
      if (alter >= dauer) {
        this._entfernen(i);
        continue;
      }
      const u = alter / dauer;
      const zug = Math.exp(-this.kraft[i3] * dt);
      const vx = (this.v[i3] = (this.v[i3] - windX) * zug + windX);
      const vy = (this.v[i3 + 1] = this.v[i3 + 1] * zug + this.kraft[i3 + 1] * dt);
      const vz = (this.v[i3 + 2] = (this.v[i3 + 2] - windZ) * zug + windZ);
      this.pos[i4] += vx * dt;
      let y = this.pos[i4 + 1] + vy * dt;
      if (y < 0.03) {
        y = 0.03;
        this.v[i3 + 1] = Math.abs(vy) * 0.3;
      }
      this.pos[i4 + 1] = y;
      this.pos[i4 + 3] = this.form[i3] + (this.form[i3 + 1] - this.form[i3]) * u;
      // Schnell einblenden, langsam auflösen
      const ein = Math.min(1, u * 8);
      this.farbe[i4 + 3] = this.form[i3 + 2] * ein * (1 - u) * (1 - u);
      this.bewegung[i4] = vx;
      this.bewegung[i4 + 1] = vy;
      this.bewegung[i4 + 2] = vz;
      this.bewegung[i4 + 3] += this.kraft[i3 + 2] * dt;
    }
    this.geo.instanceCount = this.n;
    this.objekt.visible = this.n > 0;
    if (this.n > 0) {
      this.aPos.needsUpdate = true;
      this.aFarbe.needsUpdate = true;
      this.aBewegung.needsUpdate = true;
    }
  }

  leeren() {
    this.n = 0;
    this.geo.instanceCount = 0;
    this.objekt.visible = false;
  }

  freigeben() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
