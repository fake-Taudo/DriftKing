// Three.js-Renderer: Canvas, Größenanpassung, Qualitätsstufen, WebGL-Kontextverlust, Bloom.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class Renderer {
  constructor({ container, qualitaet, ereignisse }) {
    this.container = container;
    this.qualitaet = qualitaet;
    this.ereignisse = ereignisse;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      preserveDrawingBuffer: false
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap gibt es seit three.js r187 nicht mehr
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute('tabindex', '-1');
    container.appendChild(this.canvas);

    this.breite = 1;
    this.hoehe = 1;
    this.kontextVerloren = false;
    this.composer = null;
    this.bloomPass = null;
    this._bloomSzene = null;
    this._bloomKamera = null;
    this.drawCalls = 0;
    this.dreiecke = 0;

    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.kontextVerloren = true;
      this.ereignisse.senden('kontextVerloren');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.kontextVerloren = false;
      this._composerVerwerfen();
      this.ereignisse.senden('kontextWiederhergestellt');
    });

    this._beobachter = new ResizeObserver(() => this.groesseAnpassen());
    this._beobachter.observe(container);
    window.addEventListener('orientationchange', () => setTimeout(() => this.groesseAnpassen(), 250));
    ereignisse.an('qualitaet', () => this.groesseAnpassen());
    this.groesseAnpassen();
  }

  get pixelRatio() {
    return Math.min(window.devicePixelRatio || 1, this.qualitaet.aktuell.pixelRatio);
  }

  groesseAnpassen() {
    const b = Math.max(1, this.container.clientWidth);
    const hh = Math.max(1, this.container.clientHeight);
    this.breite = b;
    this.hoehe = hh;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(b, hh, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(b, hh);
    }
    this.ereignisse.senden('groesse', { breite: b, hoehe: hh });
  }

  get seitenverhaeltnis() {
    return this.breite / this.hoehe;
  }

  _composerVerwerfen() {
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
      this.bloomPass = null;
    }
  }

  _composerFuer(szene, kamera) {
    if (!this.composer || this._bloomSzene !== szene || this._bloomKamera !== kamera) {
      this._composerVerwerfen();
      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(this.breite, this.hoehe);
      this.composer.addPass(new RenderPass(szene, kamera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(this.breite, this.hoehe), 0.38, 0.5, 0.92);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      this._bloomSzene = szene;
      this._bloomKamera = kamera;
    }
    return this.composer;
  }

  /** Zeichnet eine Szene (mit Bloom auf Qualität „Hoch“ am Desktop). */
  rendern(szene, kamera, { bloom = true } = {}) {
    if (this.kontextVerloren) return;
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    if (bloom && this.qualitaet.bloom) {
      this._composerFuer(szene, kamera).render();
    } else {
      this.renderer.render(szene, kamera);
    }
    this.drawCalls = this.renderer.info.render.calls;
    this.dreiecke = this.renderer.info.render.triangles;
  }

  /**
   * Foto in hoher Auflösung mit Bloom: rendert einmal und liest das Bild im selben Frame aus
   * (der Zeichenpuffer bleibt sonst nicht erhalten).
   * @returns {Promise<Blob|null>} PNG
   */
  async foto(szene, kamera) {
    const faktor = Math.min(3, 3840 / Math.max(this.breite, this.hoehe));
    this._composerVerwerfen();
    this.renderer.setPixelRatio(faktor);
    this.renderer.setSize(this.breite, this.hoehe, false);
    const c = new EffectComposer(this.renderer);
    c.setPixelRatio(faktor);
    c.setSize(this.breite, this.hoehe);
    c.addPass(new RenderPass(szene, kamera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(this.breite, this.hoehe), 0.45, 0.5, 0.85));
    c.addPass(new OutputPass());
    c.render();
    const versprechen = new Promise((fertig) => this.canvas.toBlob(fertig, 'image/png'));
    const blob = await versprechen;
    c.dispose();
    this.groesseAnpassen();
    return blob;
  }

  /** Schatten-Auflösung entsprechend der Qualitätsstufe. */
  get schattenAn() {
    return this.qualitaet.aktuell.schatten === 'map';
  }
}
