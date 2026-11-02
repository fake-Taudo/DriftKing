// Hauptmenü: 3D-Hintergrund (aktuelles Auto dreht sich auf einer Drehscheibe im Showroom),
// darüber das Menü: Spielen (Bot-Battle, Zeitangriff, Freies Fahren), Online-Duell, Garage, Shop,
// Einstellungen. Währung und Tagesaufgaben sind sichtbar.
import * as THREE from 'three';
import { h, leeren } from '../ui/dom.js';
import { t, zahl } from '../i18n/de.js';
import { AutoModell } from '../render/auto/autoModell.js';
import { aktivesAuto, aktivesAutoKonfig } from '../spielerDaten.js';
import { glowTextur } from '../render/texturen.js';
import { vollbildVerfuegbar, vollbildUmschalten } from '../core/geraet.js';
import { MENUE_EINTRAEGE } from './menueEintraege.js';

export class Hauptmenue {
  constructor(start = 'haupt') {
    this.startAnsicht = start;
  }

  async betreten(spiel) {
    this.spiel = spiel;
    this.bloom = true;
    this._szeneBauen();
    this.ui = h('div.bildschirm.menue-bildschirm');
    spiel.uiWurzel.appendChild(this.ui);
    this._hoerer = [
      spiel.ereignisse.an('groesse', ({ breite, hoehe }) => { this.kamera.aspect = breite / hoehe; this.kamera.updateProjectionMatrix(); this._kameraSetzen(); }),
      spiel.speicher.beobachten(() => this._kopfAktualisieren()),
      spiel.ereignisse.an('spielstandGeaendert', () => { this._autoNeu(); this._kopfAktualisieren(); })
    ];
    this.ansicht(this.startAnsicht);
    spiel.audio?.menueMusik?.(true);
  }

  _szeneBauen() {
    const spiel = this.spiel;
    this.szene = new THREE.Scene();
    this.szene.background = new THREE.Color('#0b0e1c');
    this.szene.fog = new THREE.Fog('#0b0e1c', 14, 40);
    this.kamera = new THREE.PerspectiveCamera(42, spiel.renderer.seitenverhaeltnis, 0.1, 100);
    this._kameraSetzen();
    this.szene.add(new THREE.HemisphereLight('#8fa2ff', '#1a1030', 0.9));
    const licht = new THREE.DirectionalLight('#ffffff', 2.2);
    licht.position.set(4, 8, 6);
    licht.castShadow = true;
    licht.shadow.mapSize.set(1024, 1024);
    licht.shadow.camera.left = licht.shadow.camera.bottom = -5;
    licht.shadow.camera.right = licht.shadow.camera.top = 5;
    this.szene.add(licht);
    const pinkLicht = new THREE.PointLight('#ff3d6e', 30, 18);
    pinkLicht.position.set(-5, 3, -2);
    const tuerkisLicht = new THREE.PointLight('#2ee6ff', 30, 18);
    tuerkisLicht.position.set(5, 2.5, -3);
    this.szene.add(pinkLicht, tuerkisLicht);
    // Umgebung für Lackspiegelung
    const pmrem = new THREE.PMREMGenerator(spiel.renderer.renderer);
    const hilfe = new THREE.Scene();
    hilfe.background = new THREE.Color('#151a33');
    const flaeche = (farbe, x, y, z, b, hh) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b, hh), new THREE.MeshBasicMaterial({ color: farbe, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      hilfe.add(m);
    };
    flaeche('#ffffff', 0, 10, 0, 12, 12);
    flaeche('#ff3d6e', -10, 2, 0, 4, 8);
    flaeche('#2ee6ff', 10, 2, 0, 4, 8);
    this._envZiel = pmrem.fromScene(hilfe, 0.02);
    this.envMap = this._envZiel.texture;
    pmrem.dispose();
    hilfe.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.szene.environment = this.envMap;
    // Drehscheibe
    const scheibe = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.18, 48), new THREE.MeshStandardMaterial({ color: '#1a1f3a', roughness: 0.35, metalness: 0.6 }));
    scheibe.position.y = -0.09;
    scheibe.receiveShadow = true;
    this.szene.add(scheibe);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.035, 8, 64), new THREE.MeshBasicMaterial({ color: '#ff3d6e' }));
    ring.rotation.x = Math.PI / 2;
    this.szene.add(ring);
    const boden = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: '#0e1226', roughness: 0.6, metalness: 0.3 }));
    boden.rotation.x = -Math.PI / 2;
    boden.position.y = -0.18;
    boden.receiveShadow = true;
    this.szene.add(boden);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ map: glowTextur(), color: '#ff3d6e', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.17;
    this.szene.add(glow);
    this.drehteller = new THREE.Group();
    this.szene.add(this.drehteller);
    this._autoNeu();
  }

  _kameraSetzen() {
    const hoch = this.spiel.renderer.hoehe > this.spiel.renderer.breite;
    // Im Querformat steht das Menü links → Auto etwas nach rechts
    if (hoch) this.kamera.position.set(0, 2.6, 11.5);
    else this.kamera.position.set(-2.2, 2.1, 8.6);
    this.kamera.lookAt(hoch ? 0 : -2.2, 0.6, 0);
    if (!hoch) this.kamera.position.x += 0;
    this.kameraVersatz = hoch ? 0 : 2.2;
    if (this.drehteller) this.drehteller.position.x = hoch ? 0 : 0.2;
  }

  _autoNeu() {
    const k = aktivesAutoKonfig(this.spiel.daten);
    const sig = k.autoId + JSON.stringify(k.look);
    if (this._autoSig === sig) return;
    this._autoSig = sig;
    if (this.auto) {
      this.drehteller.remove(this.auto.objekt);
      this.auto.freigeben();
    }
    this.auto = new AutoModell(k.autoId, k.look, { qualitaet: { ...this.spiel.qualitaet.aktuell, schatten: 'map' } });
    this.auto.objekt.traverse((o) => { if (o.isMesh && o !== this.auto.blob) o.castShadow = true; });
    this.auto.blob.visible = false;
    this.drehteller.add(this.auto.objekt);
  }

  _kopf() {
    const d = this.spiel.daten;
    this.muenzAnzeige = h('div.muenzen.menue-muenzen', zahl(d.waehrung));
    return h('div.menue-kopf',
      h('div.logo.menue-logo', t('allgemein.spielname')),
      h('div.menue-kopf-rechts',
        this.muenzAnzeige,
        vollbildVerfuegbar() ? h('button.knopf.rund.geist', { 'aria-label': t('menue.vollbild'), onClick: () => vollbildUmschalten() }, '⛶') : null
      )
    );
  }

  _kopfAktualisieren() {
    if (this.muenzAnzeige) this.muenzAnzeige.textContent = zahl(this.spiel.daten.waehrung);
    this.tagesBox?.aktualisieren?.();
  }

  /** Wechselt die Menüansicht ('haupt' | 'spielen'). */
  ansicht(name) {
    leeren(this.ui);
    this.ui.appendChild(this._kopf());
    const liste = h('div.menue-liste.haupt-liste');
    const eintraege = MENUE_EINTRAEGE[name] || MENUE_EINTRAEGE.haupt;
    for (const e of eintraege) {
      if (e.verfuegbar && !e.verfuegbar(this.spiel)) continue;
      liste.appendChild(h('button.knopf.menue-knopf' + (e.art ? '.' + e.art : ''), {
        onClick: () => e.aktion(this, this.spiel)
      }, h('span.menue-knopf-text', t(e.text)), e.untertext ? h('span.menue-knopf-unter', t(e.untertext)) : null));
    }
    if (name !== 'haupt') liste.appendChild(h('button.knopf.geist.menue-knopf', { onClick: () => this.ansicht('haupt') }, t('allgemein.zurueck')));
    const autoName = aktivesAuto(this.spiel.daten);
    this.ui.appendChild(h('div.menue-inhalt',
      h('div.menue-spalte', h('h2.titel.menue-titel', t(name === 'haupt' ? 'menue.hauptTitel' : 'menue.spielenTitel')), liste),
      h('div.menue-auto-info', h('span.menue-auto-name', this.auto ? this.auto.p.name : autoName.id))
    ));
    if (MENUE_EINTRAEGE.fuss) {
      const fuss = MENUE_EINTRAEGE.fuss(this, this.spiel);
      if (fuss) {
        this.tagesBox = fuss;
        this.ui.appendChild(fuss.el);
      }
    }
    setTimeout(() => liste.querySelector('.knopf')?.focus({ preventScroll: true }), 30);
  }

  frame(frameDt, _alpha, _eingabe, aktionen) {
    this.drehteller.rotation.y += frameDt * 0.35;
    if (this.auto) this.auto.aktualisieren(frameDt, { delta: 0, radWinkelV: 0, radWinkelH: 0, radGeschwV: 0, radGeschwH: 0, ayGl: 0, axGl: 0, bremsEff: 0 }, performance.now() / 1000);
    // Menüsteuerung per Gamepad/Tastatur
    for (const a of aktionen) {
      if (a === 'menueHoch' || a === 'menueRunter') {
        const knoepfe = [...this.ui.querySelectorAll('.menue-knopf')];
        const i = knoepfe.indexOf(document.activeElement);
        const n = (i + (a === 'menueRunter' ? 1 : -1) + knoepfe.length) % knoepfe.length;
        knoepfe[n]?.focus();
      }
      if (a === 'menueOk' && document.activeElement?.classList.contains('knopf')) document.activeElement.click();
    }
  }

  ressourcenNeuAufbauen() {
    if (this.auto) this.auto.livery.textur.needsUpdate = true;
  }

  verlassen() {
    for (const aus of this._hoerer) aus();
    this.ui.remove();
    if (this.auto) this.auto.freigeben();
    this._envZiel.dispose();
    this.szene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.spiel.audio?.menueMusik?.(false);
  }
}
