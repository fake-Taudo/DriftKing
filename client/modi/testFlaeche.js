// Eingabe- und Verbindungstest (Aufruf mit ?test=eingabe): Würfel auf einer Fläche, gesteuert über die
// Eingabe-Schicht. Prüft Game-Loop, Eingaben (Tastatur, Touch, Gamepad), Canvas-Größe und WebSocket-Echo
// – nützlich auf echten Geräten und nach einem Deploy.
import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { t } from '../i18n/de.js';

export class TestFlaeche {
  async betreten(spiel) {
    this.spiel = spiel;
    this.szene = new THREE.Scene();
    this.szene.background = new THREE.Color('#1a2040');
    this.szene.fog = new THREE.Fog('#1a2040', 40, 140);
    this.kamera = new THREE.PerspectiveCamera(60, spiel.renderer.seitenverhaeltnis, 0.1, 500);
    this.szene.add(new THREE.HemisphereLight('#bcd4ff', '#2a2440', 1.2));
    const sonne = new THREE.DirectionalLight('#ffffff', 2.2);
    sonne.position.set(20, 40, 10);
    this.szene.add(sonne);
    const boden = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#2a3058', roughness: 0.9 }));
    boden.rotation.x = -Math.PI / 2;
    this.szene.add(boden);
    this.szene.add(new THREE.GridHelper(400, 80, '#ff3d6e', '#3a4378'));
    this.wuerfel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 4), new THREE.MeshStandardMaterial({ color: '#ff3d6e', roughness: 0.4 }));
    this.wuerfel.position.y = 0.6;
    this.szene.add(this.wuerfel);
    this.x = 0; this.z = 0; this.winkel = 0; this.tempo = 0;
    this.vorher = { x: 0, z: 0, winkel: 0 };

    this.ui = h('div.bildschirm', { style: { pointerEvents: 'none' } },
      h('div.panel', { style: { padding: '12px 16px', maxWidth: '520px', pointerEvents: 'auto' } },
        h('h2.titel', t('test.titel')),
        h('p', { style: { color: 'var(--farbe-text-2)', margin: '6px 0' } }, t('test.hinweis')),
        this.anzeige = h('div.zahl', { style: { fontSize: '13px' } }),
        h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' } },
          h('button.knopf.akzent.klein', { onClick: () => this.echoTest() }, t('test.echo')),
          this.echoText = h('span', { style: { alignSelf: 'center' } })
        )
      )
    );
    spiel.uiWurzel.appendChild(this.ui);
    spiel.eingabe.touch.zeigen(spiel.eingabe.istTouch);
    this._geraetHoerer = spiel.ereignisse.an('eingabeGeraet', (g) => spiel.eingabe.touch.zeigen(g === 'touch'));
    this._groesseHoerer = spiel.ereignisse.an('groesse', ({ breite, hoehe }) => {
      this.kamera.aspect = breite / hoehe;
      this.kamera.updateProjectionMatrix();
    });
    this.letzteAktionen = [];
  }

  async echoTest() {
    this.echoText.textContent = '…';
    const ok = await this.spiel.netz.verbinden();
    if (!ok) { this.echoText.textContent = t('test.echoFehler'); return; }
    const start = performance.now();
    const aus = this.spiel.netz.an('echo', () => {
      aus();
      this.echoText.textContent = t('test.echoOk', { ms: Math.round(performance.now() - start) });
    });
    this.spiel.netz.senden({ t: 'echo', d: 'hallo' });
  }

  verlassen() {
    this.ui.remove();
    this._geraetHoerer();
    this._groesseHoerer();
    this.spiel.eingabe.touch.zeigen(false);
  }

  schritt(dt) {
    const e = this.spiel.eingabe.werte;
    this.vorher = { x: this.x, z: this.z, winkel: this.winkel };
    this.tempo += (e.gas * 18 - e.bremse * 22) * dt;
    this.tempo *= e.handbremse ? 0.95 : 0.99;
    this.tempo = Math.max(-8, Math.min(40, this.tempo));
    this.winkel -= e.lenken * dt * 2.2 * Math.min(1, Math.abs(this.tempo) / 4) * Math.sign(this.tempo || 1);
    this.x += Math.sin(this.winkel) * this.tempo * dt;
    this.z += Math.cos(this.winkel) * this.tempo * dt;
  }

  frame(frameDt, alpha, eingabe, aktionen) {
    if (aktionen.length) this.letzteAktionen = [...aktionen, ...this.letzteAktionen].slice(0, 6);
    const x = this.vorher.x + (this.x - this.vorher.x) * alpha;
    const z = this.vorher.z + (this.z - this.vorher.z) * alpha;
    const w = this.vorher.winkel + (this.winkel - this.vorher.winkel) * alpha;
    this.wuerfel.position.set(x, 0.6, z);
    this.wuerfel.rotation.y = w;
    this.kamera.position.set(x - Math.sin(w) * 9, 4, z - Math.cos(w) * 9);
    this.kamera.lookAt(x, 1, z);
    this.anzeige.textContent = `L ${eingabe.lenken.toFixed(2)}  G ${eingabe.gas.toFixed(2)}  B ${eingabe.bremse.toFixed(2)}  H ${eingabe.handbremse}  K ${eingabe.kupplung}  | ${this.spiel.eingabe.geraet} | ${this.letzteAktionen.join(', ')}`;
  }

  debugWerte() {
    return [['Tempo', (this.tempo * 3.6).toFixed(0) + ' km/h']];
  }
}
