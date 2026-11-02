// Showroom der Garage: Drehscheibe, Boden, Lichtleisten und fünf wählbare Stimmungen (Hintergrund,
// Licht, Spiegelungen im Lack). Alle Daten sind rein prozedural.
import * as THREE from 'three';
import { glowTextur } from './texturen.js';

export const SHOWROOMS = [
  {
    id: 'neon', grund: '#0b0e1c', boden: '#0e1226', scheibe: '#1a1f3a', ring: '#ff3d6e', leiste: '#ff3d6e', leiste2: '#2ee6ff',
    himmel: ['#8fa2ff', '#1a1030', 0.9], sonne: ['#ffffff', 2.2, [4, 8, 6]], punkt: [['#ff3d6e', 30, [-5, 3, -2]], ['#2ee6ff', 30, [5, 2.5, -3]]],
    env: { grund: '#151a33', decke: '#ffffff', links: '#ff3d6e', rechts: '#2ee6ff' }
  },
  {
    id: 'studio', grund: '#cfd4de', boden: '#c3c8d2', scheibe: '#e6e9ef', ring: '#2c6be8', leiste: '#ffffff', leiste2: '#ffffff',
    himmel: ['#ffffff', '#a7adba', 1.5], sonne: ['#ffffff', 2.6, [3, 9, 5]], punkt: [],
    env: { grund: '#d8dce4', decke: '#ffffff', links: '#ffffff', rechts: '#f0f2f7' }
  },
  {
    id: 'abend', grund: '#3a2436', boden: '#2a1c2a', scheibe: '#3a2a38', ring: '#ff9a3d', leiste: '#ff9a3d', leiste2: '#ff5a6e',
    himmel: ['#ffb98a', '#2a1a3a', 1.0], sonne: ['#ffb070', 2.8, [7, 3.5, 4]], punkt: [['#ff7a3d', 22, [-5, 2, 3]]],
    env: { grund: '#5a3448', decke: '#ffcf9a', links: '#ff7a3d', rechts: '#6a4a9a' }
  },
  {
    id: 'halle', grund: '#14171c', boden: '#26292e', scheibe: '#34383e', ring: '#ffc53d', leiste: '#f3f5ff', leiste2: '#ffc53d',
    himmel: ['#c8ccd6', '#1c1e22', 0.7], sonne: ['#fff4e0', 2.0, [1, 10, 2]], punkt: [['#fff0d0', 18, [0, 5, 5]], ['#fff0d0', 18, [0, 5, -5]]],
    env: { grund: '#22252a', decke: '#ffffff', links: '#3a3d42', rechts: '#3a3d42' }
  },
  {
    id: 'nacht', grund: '#05070f', boden: '#0a0d18', scheibe: '#12162a', ring: '#7a5cff', leiste: '#7a5cff', leiste2: '#2c6be8',
    himmel: ['#4a6ab0', '#05060c', 0.42], sonne: ['#a8c4ff', 1.1, [-5, 8, 4]], punkt: [['#7a5cff', 24, [4, 2, 4]]],
    env: { grund: '#0a0e1e', decke: '#6a84c8', links: '#3a2c88', rechts: '#1c3a88' }
  }
];

export function showroomDaten(id) {
  return SHOWROOMS.find((s) => s.id === id) || SHOWROOMS[0];
}

const LEISTEN = 14;

export class Showroom {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {string} [id] Stimmung
   */
  constructor(renderer, id = 'neon') {
    this.renderer = renderer;
    const s = new THREE.Scene();
    this.szene = s;
    s.background = new THREE.Color();
    s.fog = new THREE.Fog('#000000', 18, 46);

    this.himmel = new THREE.HemisphereLight();
    this.sonne = new THREE.DirectionalLight();
    this.sonne.castShadow = true;
    this.sonne.shadow.mapSize.set(1024, 1024);
    const sc = this.sonne.shadow.camera;
    sc.left = sc.bottom = -5;
    sc.right = sc.top = 5;
    sc.near = 0.5;
    sc.far = 30;
    this.sonne.shadow.bias = -0.0006;
    s.add(this.himmel, this.sonne);
    this.punkte = [new THREE.PointLight('#ffffff', 0, 18), new THREE.PointLight('#ffffff', 0, 18)];
    s.add(...this.punkte);

    // Drehscheibe (dreht sich zusammen mit dem Auto)
    this.drehteller = new THREE.Group();
    s.add(this.drehteller);
    this.scheibeMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.6 });
    const scheibe = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.18, 56), this.scheibeMat);
    scheibe.position.y = -0.09;
    scheibe.receiveShadow = true;
    this.drehteller.add(scheibe);
    this.ringMat = new THREE.MeshBasicMaterial();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.035, 8, 72), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    this.drehteller.add(ring);

    this.bodenMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.3 });
    const boden = new THREE.Mesh(new THREE.CircleGeometry(60, 56), this.bodenMat);
    boden.rotation.x = -Math.PI / 2;
    boden.position.y = -0.18;
    boden.receiveShadow = true;
    s.add(boden);
    this.glowMat = new THREE.MeshBasicMaterial({ map: glowTextur(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), this.glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.17;
    s.add(glow);

    // Lichtleisten im Kreis (geben dem Raum Tiefe und im Lack schöne Reflexe)
    this.leisteMat = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
    const leisteGeo = new THREE.BoxGeometry(0.16, 5.5, 0.16);
    for (let i = 0; i < LEISTEN; i++) {
      const w = (i / LEISTEN) * Math.PI * 2;
      const m = new THREE.Mesh(leisteGeo, this.leisteMat[i % 2]);
      m.position.set(Math.cos(w) * 19, 2.6, Math.sin(w) * 19);
      s.add(m);
    }
    this.setzeStimmung(id);
  }

  /** Stimmung wechseln: Farben, Licht und Umgebungskarte für die Lack-Spiegelung. */
  setzeStimmung(id) {
    const d = showroomDaten(id);
    this.id = d.id;
    const s = this.szene;
    s.background.set(d.grund);
    s.fog.color.set(d.grund);
    this.himmel.color.set(d.himmel[0]);
    this.himmel.groundColor.set(d.himmel[1]);
    this.himmel.intensity = d.himmel[2];
    this.sonne.color.set(d.sonne[0]);
    this.sonne.intensity = d.sonne[1];
    this.sonne.position.set(...d.sonne[2]);
    this.punkte.forEach((p, i) => {
      const w = d.punkt[i];
      p.intensity = w ? w[1] : 0;
      if (w) {
        p.color.set(w[0]);
        p.position.set(...w[2]);
      }
    });
    this.scheibeMat.color.set(d.scheibe);
    this.ringMat.color.set(d.ring);
    this.bodenMat.color.set(d.boden);
    this.glowMat.color.set(d.ring);
    this.leisteMat[0].color.set(d.leiste);
    this.leisteMat[1].color.set(d.leiste2);
    this._umgebung(d.env);
  }

  _umgebung(e) {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const hilfe = new THREE.Scene();
    hilfe.background = new THREE.Color(e.grund);
    const flaeche = (farbe, x, y, z, b, hh) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b, hh), new THREE.MeshBasicMaterial({ color: farbe, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      hilfe.add(m);
    };
    flaeche(e.decke, 0, 10, 0, 12, 12);
    flaeche(e.links, -10, 2, 0, 4, 8);
    flaeche(e.rechts, 10, 2, 0, 4, 8);
    this._envZiel?.dispose();
    this._envZiel = pmrem.fromScene(hilfe, 0.02);
    this.szene.environment = this._envZiel.texture;
    pmrem.dispose();
    hilfe.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }

  freigeben() {
    this._envZiel?.dispose();
    this.szene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
    this.sonne.shadow.map?.dispose();
  }
}
