// Umgebung einer Szene: Himmel (Farbverlauf-Shader mit Sonne), Nebel, Hauptlicht mit kleiner,
// dem Spielerauto folgender Shadow-Map, Hemisphärenlicht und eine selbst erzeugte Environment-Map
// (für Lackglanz und nassen Asphalt ohne Echtzeit-Spiegelung).
import * as THREE from 'three';

const HIMMEL_VERTEX = /* glsl */ `
varying vec3 vRichtung;
void main() {
  vRichtung = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // immer ganz hinten
}`;

const HIMMEL_FRAGMENT = /* glsl */ `
uniform vec3 oben;
uniform vec3 horizont;
uniform vec3 unten;
uniform vec3 sonneRichtung;
uniform vec3 sonneFarbe;
uniform float sonneGroesse;
uniform float sterne;
varying vec3 vRichtung;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
void main() {
  vec3 d = normalize(vRichtung);
  float h = d.y;
  vec3 farbe = h > 0.0 ? mix(horizont, oben, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizont, unten, pow(clamp(-h, 0.0, 1.0), 0.4));
  float s = max(dot(d, normalize(sonneRichtung)), 0.0);
  farbe += sonneFarbe * (pow(s, 900.0 / sonneGroesse) * 2.5 + pow(s, 12.0) * 0.35);
  if (sterne > 0.0 && h > 0.05) {
    vec3 q = floor(d * 260.0);
    float st = step(0.9965, hash(q)) * sterne * smoothstep(0.05, 0.4, h);
    farbe += vec3(st);
  }
  gl_FragColor = vec4(farbe, 1.0);
  #include <colorspace_fragment>
}`;

export class Umgebung {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} szene
   */
  constructor(renderer, szene) {
    this.renderer = renderer;
    this.szene = szene;
    this.himmelMaterial = new THREE.ShaderMaterial({
      vertexShader: HIMMEL_VERTEX,
      fragmentShader: HIMMEL_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        oben: { value: new THREE.Color('#3d6bd9') },
        horizont: { value: new THREE.Color('#cfe3ff') },
        unten: { value: new THREE.Color('#6f7a8c') },
        sonneRichtung: { value: new THREE.Vector3(0.4, 0.6, 0.2) },
        sonneFarbe: { value: new THREE.Color('#fff2cc') },
        sonneGroesse: { value: 1.0 },
        sterne: { value: 0 }
      }
    });
    this.himmel = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.himmelMaterial);
    this.himmel.frustumCulled = false;
    this.himmel.renderOrder = -10;
    szene.add(this.himmel);

    this.hemi = new THREE.HemisphereLight('#cfe0ff', '#4a4038', 0.9);
    szene.add(this.hemi);
    this.sonne = new THREE.DirectionalLight('#ffffff', 2.6);
    this.sonne.castShadow = true;
    this.sonne.shadow.bias = -0.0004;
    this.sonne.shadow.normalBias = 0.02;
    const k = this.sonne.shadow.camera;
    k.left = -11; k.right = 11; k.top = 11; k.bottom = -11; k.near = 1; k.far = 120;
    szene.add(this.sonne);
    szene.add(this.sonne.target);
    this.sonnenRichtung = new THREE.Vector3(0.4, 0.6, 0.2).normalize();
    this.envMap = null;
    this._pmrem = null;
  }

  /**
   * Setzt Tageszeit/Stimmung.
   * @param {object} s Stimmung (siehe Streckendaten „licht“)
   */
  setze(s) {
    const u = this.himmelMaterial.uniforms;
    u.oben.value.set(s.himmelOben);
    u.horizont.value.set(s.himmelHorizont);
    u.unten.value.set(s.himmelUnten);
    u.sonneFarbe.value.set(s.sonneFarbe);
    u.sonneGroesse.value = s.sonneGroesse ?? 1;
    u.sterne.value = s.sterne ?? 0;
    this.sonnenRichtung.set(...s.sonneRichtung).normalize();
    u.sonneRichtung.value.copy(this.sonnenRichtung);
    this.sonne.color.set(s.lichtFarbe ?? s.sonneFarbe);
    this.sonne.intensity = s.sonneIntensitaet;
    this.hemi.color.set(s.hemiOben);
    this.hemi.groundColor.set(s.hemiUnten);
    this.hemi.intensity = s.hemiIntensitaet;
    this.szene.fog = new THREE.Fog(s.nebelFarbe, s.nebelNah, s.nebelFern);
    this.renderer.toneMappingExposure = s.belichtung ?? 1;
    this._envErzeugen(s);
  }

  /** Erzeugt eine passende Environment-Map aus einer kleinen Hilfsszene (Himmel + Lichtflächen). */
  _envErzeugen(s) {
    if (!this._pmrem) this._pmrem = new THREE.PMREMGenerator(this.renderer);
    const hilfe = new THREE.Scene();
    const himmel = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), this.himmelMaterial.clone());
    hilfe.add(himmel);
    // Helle Flächen als „Lichter“ (für Glanzpunkte im Lack)
    const flaechen = s.envFlaechen || [
      { farbe: '#ffffff', staerke: 3, pos: [0, 30, 0], groesse: [30, 30] },
      { farbe: '#ffffff', staerke: 1.2, pos: [40, 10, 0], groesse: [10, 20] },
      { farbe: '#ffffff', staerke: 1.2, pos: [-40, 10, 0], groesse: [10, 20] }
    ];
    const geos = [];
    for (const f of flaechen) {
      const geo = new THREE.PlaneGeometry(f.groesse[0], f.groesse[1]);
      geos.push(geo);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(f.farbe).multiplyScalar(f.staerke), side: THREE.DoubleSide }));
      m.position.set(...f.pos);
      m.lookAt(0, 0, 0);
      hilfe.add(m);
    }
    const ziel = this._pmrem.fromScene(hilfe, 0.03);
    // Render-Target selbst freigeben (nur die Textur freizugeben ließe den Framebuffer liegen)
    if (this._envZiel) this._envZiel.dispose();
    this._envZiel = ziel;
    this.envMap = ziel.texture;
    this.szene.environment = this.envMap;
    this.szene.environmentIntensity = s.envIntensitaet ?? 1;
    himmel.geometry.dispose();
    himmel.material.dispose();
    for (const kind of hilfe.children) kind.material?.dispose?.();
    for (const g of geos) g.dispose();
  }

  /** Schatten-Einstellung je Qualitätsstufe. */
  qualitaet(stufe) {
    const an = stufe.schatten === 'map';
    this.sonne.castShadow = an;
    if (an && this.sonne.shadow.mapSize.x !== stufe.schattenGroesse) {
      this.sonne.shadow.mapSize.set(stufe.schattenGroesse, stufe.schattenGroesse);
      if (this.sonne.shadow.map) {
        this.sonne.shadow.map.dispose();
        this.sonne.shadow.map = null;
      }
    }
  }

  /** Lässt Licht und Schattenkamera dem Spielerauto folgen (Physik-Koordinaten). */
  folgen(x, y) {
    const t = this.sonne.target.position;
    t.set(x, 0, -y);
    this.sonne.position.set(x + this.sonnenRichtung.x * 50, this.sonnenRichtung.y * 50, -y + this.sonnenRichtung.z * 50);
    this.sonne.target.updateMatrixWorld();
  }

  /** Nach WebGL-Kontextverlust: Environment-Map neu erzeugen. */
  neuAufbauen(s) {
    this._pmrem?.dispose();
    this._pmrem = null;
    this._envErzeugen(s);
  }

  freigeben() {
    this.himmel.geometry.dispose();
    this.himmelMaterial.dispose();
    this._envZiel?.dispose();
    this._pmrem?.dispose();
    this.sonne.shadow.map?.dispose();
  }
}

/** Stimmung der Testfläche (Tag). */
export const STIMMUNG_TAG = {
  himmelOben: '#2f63d6',
  himmelHorizont: '#d4e6ff',
  himmelUnten: '#7d8796',
  sonneFarbe: '#fff4d6',
  sonneRichtung: [0.45, 0.62, 0.3],
  sonneIntensitaet: 2.6,
  hemiOben: '#d6e6ff',
  hemiUnten: '#5b5245',
  hemiIntensitaet: 1.0,
  nebelFarbe: '#c9dcf5',
  nebelNah: 120,
  nebelFern: 520,
  belichtung: 1.0,
  envIntensitaet: 1.0
};
