// Einfaches Testauto (Phase 2): Karosserie-Quader, Kabine, vier Räder mit Lenkeinschlag und Drehung,
// sichtbares Wanken/Nicken. Wird ab Phase 3 durch die modularen Automodelle ersetzt und dient danach
// nur noch als Rückfall-Darstellung im Debug.
import * as THREE from 'three';
import { gierZuRotY } from '../koordinaten.js';

export class TestAuto {
  constructor(p, farbe = '#ff3d6e') {
    const { laenge, breite, hoehe } = p.abmessungen;
    this.p = p;
    this.objekt = new THREE.Group();
    this.karosserie = new THREE.Group();
    this.objekt.add(this.karosserie);
    const lack = new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.35, metalness: 0.3 });
    const dunkel = new THREE.MeshStandardMaterial({ color: '#15161c', roughness: 0.6 });
    const rumpf = new THREE.Mesh(new THREE.BoxGeometry(breite, hoehe * 0.45, laenge), lack);
    rumpf.position.y = 0.32 + hoehe * 0.22;
    const kabine = new THREE.Mesh(new THREE.BoxGeometry(breite * 0.86, hoehe * 0.38, laenge * 0.45), dunkel);
    kabine.position.set(0, 0.32 + hoehe * 0.62, -laenge * 0.05);
    for (const m of [rumpf, kabine]) { m.castShadow = true; this.karosserie.add(m); }
    const lichtVorne = new THREE.Mesh(new THREE.BoxGeometry(breite * 0.8, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: '#fff7d6' }));
    lichtVorne.position.set(0, 0.32 + hoehe * 0.3, laenge / 2 + 0.01);
    this.ruecklicht = new THREE.Mesh(new THREE.BoxGeometry(breite * 0.8, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: '#661010' }));
    this.ruecklicht.position.set(0, 0.32 + hoehe * 0.3, -laenge / 2 - 0.01);
    this.karosserie.add(lichtVorne, this.ruecklicht);

    const radGeo = new THREE.CylinderGeometry(p.radRadius, p.radRadius, 0.24, 18);
    radGeo.rotateZ(Math.PI / 2);
    const felgeGeo = new THREE.BoxGeometry(0.26, p.radRadius * 1.4, 0.12);
    this.raeder = [];
    const spur = p.spurweite / 2;
    const achsV = p.radstand * (1 - p.gewichtVorne);
    const achsH = -p.radstand * p.gewichtVorne;
    for (const [x, z, vorne] of [[spur, achsV, true], [-spur, achsV, true], [spur, achsH, false], [-spur, achsH, false]]) {
      const halter = new THREE.Group();
      halter.position.set(x, p.radRadius, z);
      const dreh = new THREE.Group();
      const reifen = new THREE.Mesh(radGeo, dunkel);
      const felge = new THREE.Mesh(felgeGeo, new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.8, roughness: 0.3 }));
      reifen.castShadow = true;
      dreh.add(reifen, felge);
      halter.add(dreh);
      this.objekt.add(halter);
      this.raeder.push({ halter, dreh, vorne });
    }
    this.wanken = 0;
    this.nicken = 0;
  }

  setzePose(x, y, theta) {
    this.objekt.position.set(x, 0, -y);
    this.objekt.rotation.y = gierZuRotY(theta);
  }

  aktualisieren(dt, z) {
    for (const r of this.raeder) {
      r.halter.rotation.y = r.vorne ? z.delta : 0;
      r.dreh.rotation.x = r.vorne ? z.radWinkelV : z.radWinkelH;
    }
    // Wanken und Nicken (rein visuell, geglättet)
    const k = 1 - Math.exp(-dt / 0.12);
    this.wanken += (Math.max(-0.08, Math.min(0.08, z.ayGl * 0.008)) - this.wanken) * k;
    this.nicken += (Math.max(-0.05, Math.min(0.05, -z.axGl * 0.006)) - this.nicken) * k;
    this.karosserie.rotation.z = this.wanken; // Linkskurve (ay > 0) → Karosserie neigt nach rechts
    this.karosserie.rotation.x = this.nicken;
    this.ruecklicht.material.color.set(z.bremsEff > 0.05 ? '#ff2020' : '#661010');
  }

  freigeben() {
    this.objekt.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
  }
}
