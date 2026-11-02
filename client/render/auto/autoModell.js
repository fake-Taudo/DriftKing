// Komplettes Automodell: Karosserie (mit Livery), Kabine, Säulen, Lichter, Innenraum, Anbauteile,
// Räder, Kennzeichen, Blob-Schatten und (nachts) Lichtkegel. Sichtbares Wanken/Nicken der Karosserie.
import * as THREE from 'three';
import { autoDaten } from '../../../shared/autos.js';
import { AUTO_FORMEN } from './autoFormen.js';
import { baueKarosserie } from './karosserie.js';
import { Raeder } from './raeder.js';
import { Livery } from './livery.js';
import { baueAnbauteile } from './anbauteile.js';
import { blobTextur } from '../texturen.js';
import { gierZuRotY } from '../koordinaten.js';

/** Material-Werte je Lack-Finish. */
export function lackWerte(finish) {
  switch (finish) {
    case 'matt': return { roughness: 0.82, metalness: 0.0, clearcoat: 0, clearcoatRoughness: 0.5, iridescence: 0 };
    case 'satin': return { roughness: 0.5, metalness: 0.1, clearcoat: 0.25, clearcoatRoughness: 0.4, iridescence: 0 };
    case 'metallic': return { roughness: 0.32, metalness: 0.65, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0 };
    case 'perleffekt': return { roughness: 0.28, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 1 };
    case 'chrom': return { roughness: 0.06, metalness: 1.0, clearcoat: 0.3, clearcoatRoughness: 0.05, iridescence: 0 };
    default: return { roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0 };
  }
}

function lackMaterialSetzen(m, finish) {
  const w = lackWerte(finish);
  m.roughness = w.roughness;
  m.metalness = w.metalness;
  m.clearcoat = w.clearcoat;
  m.clearcoatRoughness = w.clearcoatRoughness;
  m.iridescence = w.iridescence;
  m.iridescenceIOR = 1.35;
  m.iridescenceThicknessMinimum = 180;
  m.iridescenceThicknessMaximum = 720;
  m.needsUpdate = true;
}

function kennzeichenTextur(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 56;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f4ef';
  ctx.fillRect(0, 0, 256, 56);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 250, 50);
  ctx.fillStyle = '#2a4bd6';
  ctx.fillRect(5, 5, 22, 46);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 36px "Russo One", "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text || '').toUpperCase(), 141, 30);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class AutoModell {
  /**
   * @param {string} autoId
   * @param {object} look
   * @param {{qualitaet?: object, nacht?: boolean, tiefeAnwenden?: boolean}} [o]
   */
  constructor(autoId, look, { qualitaet, nacht = false } = {}) {
    this.autoId = autoId;
    this.p = autoDaten(autoId);
    this.form = AUTO_FORMEN[autoId];
    this.objekt = new THREE.Group();
    this.objekt.name = 'auto-' + autoId;
    this.karosserie = new THREE.Group();
    this.objekt.add(this.karosserie);
    this.nacht = nacht;
    this.wanken = 0;
    this.nicken = 0;
    this.ressourcen = [];

    const k = baueKarosserie(this.p, this.form);
    this.k = k;
    this.anker = k.anker;
    this.livery = new Livery(qualitaet ? qualitaet.livery : 1024, k.zonen);

    // Materialien
    this.lackMat = new THREE.MeshPhysicalMaterial({ map: this.livery.textur, flatShading: true });
    this.lackEinfachMat = new THREE.MeshPhysicalMaterial({ flatShading: true });
    this.zweitMat = new THREE.MeshPhysicalMaterial({ flatShading: true });
    this.glasMat = new THREE.MeshPhysicalMaterial({ color: '#0d1420', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55, clearcoat: 1, flatShading: true, side: THREE.DoubleSide, depthWrite: false });
    this.dunkelMat = new THREE.MeshStandardMaterial({ color: '#121318', roughness: 0.85, flatShading: true });
    this.innenMat = new THREE.MeshStandardMaterial({ color: '#24262e', roughness: 0.8, flatShading: true });
    this.scheinwerferMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.6, roughness: 0.2 });
    this.ruecklichtMat = new THREE.MeshStandardMaterial({ color: '#330000', emissive: '#ff2020', emissiveIntensity: 0.7, roughness: 0.3 });

    const netz = (geo, mat, schatten = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = schatten;
      this.ressourcen.push(geo);
      this.karosserie.add(m);
      return m;
    };
    this.lackNetz = netz(k.lack, this.lackMat);
    this.glasNetz = netz(k.glas, this.glasMat, false);
    this.glasNetz.renderOrder = 2;
    this.saeulenNetz = netz(k.saeulen, this.lackEinfachMat, false);
    netz(k.unterboden, this.dunkelMat, false);

    this._lichterBauen();
    this._innenraumBauen();

    // Kennzeichen
    this.kennzeichenMat = new THREE.MeshBasicMaterial({ map: kennzeichenTextur('') });
    const kz = new THREE.PlaneGeometry(0.42, 0.092);
    this.ressourcen.push(kz);
    this.kennzeichen = new THREE.Mesh(kz, this.kennzeichenMat);
    this.kennzeichen.position.set(0, this.anker.kennzeichen.y, this.anker.kennzeichen.z - 0.012);
    this.kennzeichen.rotation.y = Math.PI;
    this.karosserie.add(this.kennzeichen);

    // Anbauteile (Bodykit, Spoiler, Spiegel, Auspuff)
    this.teile = new THREE.Group();
    this.karosserie.add(this.teile);

    // Räder
    this.raeder = new Raeder(this.p, this.anker, look);
    this.objekt.add(this.raeder.objekt);

    // Blob-Schatten (Qualität „Niedrig“)
    const blobGeo = new THREE.PlaneGeometry(this.p.abmessungen.breite * 1.5, this.p.abmessungen.laenge * 1.25);
    blobGeo.rotateX(-Math.PI / 2);
    this.ressourcen.push(blobGeo);
    this.blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTextur(), transparent: true, depthWrite: false, opacity: 0.85 }));
    this.blob.position.y = 0.02;
    this.blob.renderOrder = 1;
    this.objekt.add(this.blob);

    this.setzeLook(look);
    if (qualitaet) this.qualitaet(qualitaet);
  }

  _lichterBauen() {
    const a = this.anker;
    const f = this.form;
    const g = new THREE.Group();
    this.lichter = g;
    this.karosserie.add(g);
    const sw = a.scheinwerfer;
    const add = (geo, mat, x, y, z, ry = 0, rz = 0) => {
      this.ressourcen.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(0, ry, rz);
      g.add(m);
      return m;
    };
    for (const s of [1, -1]) {
      const x = s * sw.x;
      if (f.scheinwerfer === 'rund') add(new THREE.CircleGeometry(0.085, 14), this.scheinwerferMat, x, sw.y, sw.z + 0.004);
      else if (f.scheinwerfer === 'doppelrund') {
        add(new THREE.CircleGeometry(0.07, 12), this.scheinwerferMat, x * 0.88, sw.y, sw.z + 0.004);
        add(new THREE.CircleGeometry(0.07, 12), this.scheinwerferMat, x * 1.12, sw.y, sw.z + 0.004);
      } else if (f.scheinwerfer === 'eckig') add(new THREE.PlaneGeometry(0.3, 0.11), this.scheinwerferMat, x, sw.y, sw.z + 0.004);
      else add(new THREE.PlaneGeometry(0.36, 0.06), this.scheinwerferMat, x, sw.y + 0.02, sw.z + 0.004, 0, s * 0.12);
    }
    // Lufteinlass / Kühlergrill
    const breiteE = { klein: 0.55, breit: 1.05, gross: 1.2 }[f.lufteinlass] || 0.8;
    const hoeheE = { klein: 0.1, breit: 0.13, gross: 0.22 }[f.lufteinlass] || 0.12;
    add(new THREE.PlaneGeometry(breiteE, hoeheE), this.dunkelMat, 0, this.form.bodenHoehe + 0.12 + hoeheE / 2, sw.z + 0.003);
    // Rücklichter (Serie je Form; Design aus dem Look überschreibt)
    this.ruecklichtGruppe = new THREE.Group();
    g.add(this.ruecklichtGruppe);
    // Lichtkegel (nur nachts sichtbar)
    const kegelGeo = new THREE.ConeGeometry(2.2, 9, 16, 1, true);
    kegelGeo.translate(0, -4.5, 0);
    kegelGeo.rotateX(-Math.PI / 2);
    this.ressourcen.push(kegelGeo);
    // Blendet zum Rand und nach vorn aus: Von hinten gesehen zeigt der Kegel so keine harten Kanten
    const kegelMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vN;
        varying vec3 vV;
        varying float vY;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          vY = uv.y;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uFarbe;
        varying vec3 vN;
        varying vec3 vV;
        varying float vY;
        void main() {
          float kante = pow(abs(dot(normalize(vN), normalize(vV))), 2.6);
          gl_FragColor = vec4(uFarbe, kante * vY * vY * 0.2);
        }`,
      uniforms: { uFarbe: { value: new THREE.Color('#fff3d0') } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.kegelMat = kegelMat;
    this.kegel = [];
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(kegelGeo, kegelMat);
      m.position.set(s * sw.x, sw.y, sw.z + 0.02);
      m.rotation.x = -0.06;
      m.renderOrder = 3;
      m.visible = this.nacht;
      g.add(m);
      this.kegel.push(m);
    }
  }

  _ruecklichterBauen(design) {
    const grp = this.ruecklichtGruppe;
    while (grp.children.length) {
      const c = grp.children.pop();
      c.geometry.dispose();
    }
    const rl = this.anker.ruecklicht;
    const art = design === 1 ? 'band' : design === 2 ? 'doppelrund' : this.form.ruecklicht;
    const add = (geo, x, y) => {
      const m = new THREE.Mesh(geo, this.ruecklichtMat);
      m.position.set(x, y, rl.z - 0.004);
      m.rotation.y = Math.PI;
      grp.add(m);
    };
    if (art === 'band') {
      add(new THREE.PlaneGeometry(rl.x * 2.15, 0.06), 0, rl.y);
      for (const s of [1, -1]) add(new THREE.PlaneGeometry(0.22, 0.1), s * rl.x, rl.y - 0.02);
    } else if (art === 'senkrecht') {
      for (const s of [1, -1]) add(new THREE.PlaneGeometry(0.09, 0.32), s * rl.x * 1.1, rl.y - 0.1);
    } else if (art === 'doppelrund') {
      for (const s of [1, -1]) {
        add(new THREE.CircleGeometry(0.06, 12), s * rl.x * 0.85, rl.y - 0.02);
        add(new THREE.CircleGeometry(0.06, 12), s * rl.x * 1.1, rl.y - 0.02);
      }
    } else {
      for (const s of [1, -1]) add(new THREE.PlaneGeometry(0.26, 0.11), s * rl.x, rl.y - 0.02);
    }
  }

  _innenraumBauen() {
    const i = this.anker.innenraum;
    const g = new THREE.Group();
    this.innenraum = g;
    this.karosserie.add(g);
    const add = (geo, x, y, z, rx = 0) => {
      this.ressourcen.push(geo);
      const m = new THREE.Mesh(geo, this.innenMat);
      m.position.set(x, y, z);
      m.rotation.x = rx;
      g.add(m);
      return m;
    };
    const sitzZ = i.zVorne - (i.zVorne - i.zHinten) * 0.45;
    const boden = i.boden;
    for (const s of [1, -1]) {
      const x = s * i.breite * 0.24;
      add(new THREE.BoxGeometry(0.46, 0.12, 0.48), x, boden + 0.22, sitzZ);
      add(new THREE.BoxGeometry(0.46, 0.55, 0.12), x, boden + 0.5, sitzZ - 0.26, -0.18);
      add(new THREE.BoxGeometry(0.26, 0.16, 0.08), x, boden + 0.82, sitzZ - 0.31, -0.18);
    }
    // Armaturenbrett
    add(new THREE.BoxGeometry(i.breite * 0.95, 0.16, 0.38), 0, i.guertel - 0.06, i.zVorne - 0.18);
    // Lenkrad (links = +X)
    const lenkradGeo = new THREE.TorusGeometry(0.17, 0.022, 6, 14);
    this.ressourcen.push(lenkradGeo);
    const lenkrad = new THREE.Mesh(lenkradGeo, this.dunkelMat);
    lenkrad.position.set(i.breite * 0.24, i.guertel + 0.02, i.zVorne - 0.42);
    lenkrad.rotation.x = -0.35;
    g.add(lenkrad);
    this.lenkrad = lenkrad;
    // Rückbank / Kofferraumabdeckung
    add(new THREE.BoxGeometry(i.breite * 0.85, 0.3, 0.4), 0, boden + 0.28, i.zHinten + 0.3);
  }

  /** Übernimmt einen Look (Lack, Livery, Teile, Räder, Lichter, Kennzeichen, Fahrwerk). */
  setzeLook(look, optionen = {}) {
    const alt = this.look;
    this.look = look;
    const l = look.lack;
    lackMaterialSetzen(this.lackMat, l.finish);
    lackMaterialSetzen(this.lackEinfachMat, l.finish);
    lackMaterialSetzen(this.zweitMat, l.finish);
    this.lackMat.color.set('#ffffff');
    this.lackEinfachMat.color.set(l.farbe1);
    this.zweitMat.color.set(l.farbe2);
    if (l.finish === 'chrom') {
      // Chrom: Grundfarbe färbt die Spiegelung leicht ein
      this.lackMat.color.set('#dfe3ea');
    }
    this.livery.zeichnen(look, optionen);
    // Scheibentönung (0 = hell … 4 = sehr dunkel)
    this.glasMat.opacity = [0.62, 0.72, 0.8, 0.88, 0.95][look.scheiben] ?? 0.62;
    this.scheinwerferMat.color.set(look.scheinwerfer);
    this.scheinwerferMat.emissive.set(look.scheinwerfer);
    this.kegelMat.uniforms.uFarbe.value.set(look.scheinwerfer);
    this.ruecklichtMat.emissive.set(look.rueck);
    if (!alt || alt.rueckDesign !== look.rueckDesign) this._ruecklichterBauen(look.rueckDesign);
    if (!alt || alt.kennzeichen !== look.kennzeichen) {
      this.kennzeichenMat.map?.dispose();
      this.kennzeichenMat.map = kennzeichenTextur(look.kennzeichen);
      this.kennzeichenMat.needsUpdate = true;
    }
    // Räder neu, wenn sich Felge/Fahrwerk geändert haben
    if (!alt || JSON.stringify(alt.felgen) !== JSON.stringify(look.felgen) || JSON.stringify(alt.fahrwerk) !== JSON.stringify(look.fahrwerk)) {
      this.raeder.setzeLook(look);
    }
    // Anbauteile neu aufbauen
    if (!alt || JSON.stringify(alt.teile) !== JSON.stringify(look.teile) || alt.lack.zweitSpiegel !== l.zweitSpiegel || alt.neon?.an !== look.neon?.an) {
      this._teileNeu(look);
    }
    if (this.neon) this.neon.material.color.set(look.neon.farbe);
    // Tieferlegung: Karosserie absenken (Mindest-Bodenfreiheit verhindert Boden-Clipping)
    const maxAbsenkung = Math.max(0, Math.min(0.07, this.form.bodenHoehe - 0.09));
    this.absenkung = look.fahrwerk.tiefe * maxAbsenkung;
    this.karosserie.position.y = -this.absenkung;
  }

  _teileNeu(look) {
    while (this.teile.children.length) {
      const c = this.teile.children.pop();
      c.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== this.lackEinfachMat && o.material !== this.zweitMat) o.material.dispose?.(); } });
    }
    const gruppe = baueAnbauteile(this, look);
    this.teile.add(gruppe);
    this.neon = gruppe.userData.neon || null;
  }

  /** Ändert Livery-Auflösung und Schatten je Qualitätsstufe. */
  qualitaet(stufe) {
    if (this.livery.groesse !== stufe.livery) {
      this.livery.setzeGroesse(stufe.livery);
      this.lackMat.map = this.livery.textur;
      this.lackMat.needsUpdate = true;
      this.livery.zeichnen(this.look);
    }
    const blob = stufe.schatten === 'blob';
    this.blob.visible = blob;
    this.objekt.traverse((o) => { if (o.isMesh && o !== this.blob && o.castShadow !== undefined && o.userData.schattenAus !== true) o.castShadow = !blob && (o === this.lackNetz || o === this.raeder.reifen); });
  }

  setzePose(x, y, theta) {
    this.objekt.position.set(x, 0, -y);
    this.objekt.rotation.y = gierZuRotY(theta);
  }

  /**
   * Pro Frame: Räder, Wanken/Nicken, Bremslicht, Lenkrad, Neon-Pulsieren.
   * @param {number} dt
   * @param {object} z Fahrzeugzustand (Fahrzeug.z)
   * @param {number} [zeit] Sekunden (für Puls-Effekte)
   */
  aktualisieren(dt, z, zeit = 0) {
    this.raeder.aktualisieren(z, dt);
    const k = 1 - Math.exp(-dt / 0.12);
    const zielW = Math.max(-0.075, Math.min(0.075, (z.ayGl || 0) * 0.0075));
    const zielN = Math.max(-0.045, Math.min(0.045, -(z.axGl || 0) * 0.0055));
    this.wanken += (zielW - this.wanken) * k;
    this.nicken += (zielN - this.nicken) * k;
    this.karosserie.rotation.z = this.wanken;
    this.karosserie.rotation.x = this.nicken;
    const bremst = (z.bremsEff || 0) > 0.05 || z.handbremse;
    this.ruecklichtMat.emissiveIntensity = bremst ? 2.6 : 0.8;
    if (this.lenkrad) this.lenkrad.rotation.z = (z.delta || 0) * 6;
    if (this.neon) {
      const n = this.look.neon;
      const puls = n.puls ? 0.55 + 0.45 * Math.sin(zeit * 4) : 1;
      this.neon.material.opacity = n.helligkeit * puls * 0.85;
    }
  }

  setzeNacht(an) {
    this.nacht = an;
    for (const kegel of this.kegel) kegel.visible = an;
  }

  freigeben() {
    this.raeder.freigeben();
    this._teileNeu({ ...this.look, teile: null });
    for (const g of this.ressourcen) g.dispose();
    for (const c of this.ruecklichtGruppe.children) c.geometry.dispose();
    this.livery.freigeben();
    for (const m of [this.lackMat, this.lackEinfachMat, this.zweitMat, this.glasMat, this.dunkelMat, this.innenMat, this.scheinwerferMat, this.ruecklichtMat, this.kegelMat, this.kennzeichenMat, this.blob.material]) {
      if (m.map && m.map !== this.livery.textur && m !== this.blob.material) m.map.dispose();
      m.dispose();
    }
  }
}
