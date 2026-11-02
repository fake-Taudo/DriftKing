// Kleine Effekte ohne teure Nachbearbeitung: Tempolinien am Bildrand und der Leuchtfaden zwischen den Tandem-Autos.
import * as THREE from 'three';

const LINIEN_VERT = /* glsl */`
  attribute vec2 ecke;
  attribute vec3 iLinie; // Winkel, Phase, Tempo-Faktor
  uniform float uZeit;
  uniform float uStaerke;
  uniform float uSeite;
  varying float vDeckkraft;
  void main() {
    float lauf = fract(iLinie.y + uZeit * iLinie.z * 1.5);
    float r0 = 0.82 + lauf * 0.75;
    float laenge = 0.12 + 0.2 * uStaerke;
    float r = r0 + (ecke.y * 0.5 + 0.5) * laenge;
    vec2 richtung = vec2(cos(iLinie.x), sin(iLinie.x));
    vec2 quer = vec2(-richtung.y, richtung.x);
    vec2 p = richtung * r + quer * ecke.x * 0.0022;
    p.x *= uSeite;
    vDeckkraft = uStaerke * (0.2 + 0.35 * (ecke.y * 0.5 + 0.5)) * (1.0 - lauf);
    gl_Position = vec4(p, 0.0, 1.0);
  }
`;
const LINIEN_FRAG = /* glsl */`
  varying float vDeckkraft;
  void main() { gl_FragColor = vec4(vec3(1.0), vDeckkraft); }
`;

/** Tempolinien im Bildschirmraum (ein Draw Call). */
export class Tempolinien {
  constructor(anzahl = 36) {
    this.anzahl = anzahl;
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.setAttribute('ecke', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    this.geo.setIndex([0, 1, 2, 0, 2, 3]);
    const daten = new Float32Array(anzahl * 3);
    for (let i = 0; i < anzahl; i++) {
      daten[i * 3] = ((i + Math.random() * 0.8) / anzahl) * Math.PI * 2;
      daten[i * 3 + 1] = Math.random();
      daten[i * 3 + 2] = 0.8 + Math.random() * 0.8;
    }
    this.geo.setAttribute('iLinie', new THREE.InstancedBufferAttribute(daten, 3));
    this.geo.instanceCount = anzahl;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: LINIEN_VERT,
      fragmentShader: LINIEN_FRAG,
      uniforms: { uZeit: { value: 0 }, uStaerke: { value: 0 }, uSeite: { value: 1 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.objekt = new THREE.Mesh(this.geo, this.mat);
    this.objekt.frustumCulled = false;
    this.objekt.renderOrder = 50;
    this.objekt.visible = false;
  }

  /** @param {number} dt @param {number} staerke 0..1 @param {number} anteil Anteil der Linien (Qualität) */
  aktualisieren(dt, staerke, anteil = 1) {
    this.mat.uniforms.uZeit.value += dt;
    this.mat.uniforms.uStaerke.value = staerke;
    this.objekt.visible = staerke > 0.01;
    this.geo.instanceCount = Math.max(1, Math.round(this.anzahl * anteil));
  }

  freigeben() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

const FADEN_VERT = /* glsl */`
  attribute vec2 faden; // u entlang, Seite ±1
  uniform vec3 uA;
  uniform vec3 uB;
  uniform float uZeit;
  uniform float uBreite;
  varying float vU;
  varying float vQuer;
  varying float vTiefe;
  void main() {
    float u = faden.x;
    vec3 p = mix(uA, uB, u);
    p.y += sin(u * 3.14159) * 0.22 + sin(u * 11.0 + uZeit * 3.0) * 0.015;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 d = (modelViewMatrix * vec4(uB - uA, 0.0)).xyz;
    vec2 q = normalize(vec2(-d.y, d.x) + vec2(0.0001, 0.0));
    mv.xy += q * faden.y * uBreite;
    vU = u;
    vQuer = faden.y;
    vTiefe = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const FADEN_FRAG = /* glsl */`
  uniform float uZeit;
  uniform float uStaerke;
  uniform vec3 uFarbeA;
  uniform vec3 uFarbeB;
  varying float vU;
  varying float vQuer;
  varying float vTiefe;
  void main() {
    float kern = 1.0 - vQuer * vQuer;
    // Als Führer läuft der Faden durch die Kamera: nah davor ausblenden, sonst wird er zum breiten Streifen
    float nah = smoothstep(4.0, 8.0, vTiefe);
    float puls = 0.65 + 0.35 * sin(vU * 26.0 - uZeit * 7.0);
    float enden = smoothstep(0.0, 0.12, vU) * smoothstep(1.0, 0.88, vU);
    gl_FragColor = vec4(mix(uFarbeA, uFarbeB, vU), kern * puls * enden * nah * uStaerke);
  }
`;

/** Dezenter Leuchtfaden zwischen Führer und Verfolger (ein Draw Call). */
export class Leuchtfaden {
  constructor() {
    const SEGMENTE = 20;
    const faden = new Float32Array((SEGMENTE + 1) * 4);
    const index = [];
    for (let i = 0; i <= SEGMENTE; i++) {
      const u = i / SEGMENTE;
      faden.set([u, 1, u, -1], i * 4);
      if (i < SEGMENTE) {
        const v = i * 2;
        index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('faden', new THREE.BufferAttribute(faden, 2));
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGMENTE + 1) * 6), 3));
    this.geo.setIndex(index);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: FADEN_VERT,
      fragmentShader: FADEN_FRAG,
      uniforms: {
        uA: { value: new THREE.Vector3() },
        uB: { value: new THREE.Vector3() },
        uZeit: { value: 0 },
        uBreite: { value: 0.045 },
        uStaerke: { value: 0 },
        uFarbeA: { value: new THREE.Color('#2ee6ff') },
        uFarbeB: { value: new THREE.Color('#ff3d6e') }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.objekt = new THREE.Mesh(this.geo, this.mat);
    this.objekt.frustumCulled = false;
    this.objekt.renderOrder = 11;
    this.objekt.visible = false;
  }

  /** @param {number} dt @param {{x:number,y:number}|null} a @param {{x:number,y:number}|null} b @param {number} zielStaerke */
  aktualisieren(dt, a, b, zielStaerke) {
    const u = this.mat.uniforms;
    u.uZeit.value += dt;
    u.uStaerke.value += (zielStaerke - u.uStaerke.value) * (1 - Math.exp(-dt / 0.25));
    this.objekt.visible = u.uStaerke.value > 0.01 && !!a && !!b;
    if (a && b) {
      u.uA.value.set(a.x, 0.72, -a.y);
      u.uB.value.set(b.x, 0.72, -b.y);
    }
  }

  freigeben() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
