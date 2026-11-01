// Testfahrt auf der Testfläche (Phase 2): Fahrphysik, Verfolgerkamera, Wandkollision,
// Hänger-Erkennung und Debug-Anzeigen. Autowahl und Assistenz zum Ausprobieren.
import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { Fahrzeug } from '../../shared/physik/fahrzeug.js';
import { effektiveParameter } from '../../shared/tuning.js';
import { AUTOS } from '../../shared/autos.js';
import { HaengerErkennung } from '../../shared/physik/haenger.js';
import { TESTFLAECHE, testflaecheGitter } from '../../shared/strecken/testflaeche.js';
import { GRAD } from '../../shared/mathe.js';
import { RennKamera } from '../render/kamera.js';
import { Umgebung, STIMMUNG_TAG } from '../render/umgebung.js';
import { TestAuto } from '../render/auto/testAuto.js';
import { betonTextur, warnstreifenTextur } from '../render/texturen.js';
import { winkelLerp } from '../render/koordinaten.js';

export class TestFahrt {
  async betreten(spiel) {
    this.spiel = spiel;
    this.szene = new THREE.Scene();
    this.rennKamera = new RennKamera(spiel.renderer.seitenverhaeltnis);
    this.rennKamera.setzeModus(spiel.daten.einstellungen.kamera);
    this.kamera = this.rennKamera.kamera;
    this.umgebung = new Umgebung(spiel.renderer.renderer, this.szene);
    this.umgebung.setze(STIMMUNG_TAG);
    this.umgebung.qualitaet(spiel.qualitaet.aktuell);
    this._weltBauen();
    this.gitter = testflaecheGitter();
    this.haenger = new HaengerErkennung();
    this.autoIndex = 0;
    this._autoErzeugen(AUTOS[0].id);
    this._uiBauen();
    spiel.eingabe.touch.zeigen(spiel.eingabe.istTouch);
    this._hoerer = [
      spiel.ereignisse.an('eingabeGeraet', (g) => spiel.eingabe.touch.zeigen(g === 'touch')),
      spiel.ereignisse.an('groesse', ({ breite, hoehe }) => this.rennKamera.seitenverhaeltnis(breite / hoehe)),
      spiel.ereignisse.an('qualitaet', (q) => this.umgebung.qualitaet(q))
    ];
    spiel.qualitaet.messungAktiv(true);
  }

  _weltBauen() {
    const def = TESTFLAECHE;
    const tex = betonTextur().clone();
    tex.repeat.set(def.breite / 16, def.hoehe / 16);
    tex.needsUpdate = true;
    const boden = new THREE.Mesh(new THREE.PlaneGeometry(def.breite + 200, def.hoehe + 200), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
    tex.repeat.set((def.breite + 200) / 16, (def.hoehe + 200) / 16);
    boden.rotation.x = -Math.PI / 2;
    boden.receiveShadow = true;
    this.szene.add(boden);
    // Begrenzungsmauern
    const mauerMat = new THREE.MeshStandardMaterial({ map: warnstreifenTextur(), roughness: 0.7 });
    const hb = def.breite / 2, hh = def.hoehe / 2;
    for (const [x, z, b, t] of [[0, -hh, def.breite, 1], [0, hh, def.breite, 1], [-hb, 0, 1, def.hoehe], [hb, 0, 1, def.hoehe]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b, 1.2, t), mauerMat);
      m.position.set(x, 0.6, z);
      this.szene.add(m);
    }
    const reifenMat = new THREE.MeshStandardMaterial({ color: '#1b1c20', roughness: 0.9 });
    for (const k of def.hindernisseKreis) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(k.r, k.r, 1.4, 20), reifenMat);
      m.position.set(k.x, 0.7, -k.y);
      this.szene.add(m);
    }
    const containerMat = new THREE.MeshStandardMaterial({ color: '#2f7fd1', roughness: 0.6 });
    for (const r of def.hindernisseRechteck) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.hl * 2, 2.6, r.hb * 2), containerMat);
      m.position.set(r.x, 1.3, -r.y);
      m.rotation.y = r.winkel;
      this.szene.add(m);
    }
  }

  _autoErzeugen(autoId) {
    if (this.auto) {
      this.szene.remove(this.auto.objekt);
      this.auto.freigeben();
    }
    const e = this.spiel.daten.einstellungen;
    const p = effektiveParameter(autoId);
    const touch = this.spiel.eingabe.istTouch;
    const halten = e.assistenz.driftHaltenModus === 'aus' ? 0 : e.assistenz.driftHaltenModus === 'an' || touch ? e.assistenz.driftHalten / 100 : 0;
    this.fahrzeug = new Fahrzeug(p, { gegenlenken: e.assistenz.gegenlenken / 100, driftHalten: halten, getriebe: touch ? 'auto' : e.getriebe });
    const s = TESTFLAECHE.start;
    this.fahrzeug.setzen(s.x, s.y, s.theta);
    this.auto = new TestAuto(p);
    this.szene.add(this.auto.objekt);
    this.haenger.zuruecksetzen();
    this.rennKamera.erstesBild = true;
  }

  _uiBauen() {
    this.anzeige = h('div.zahl', { style: { fontSize: '1.6rem' } });
    this.zusatz = h('div', { style: { color: 'var(--farbe-text-2)', fontSize: '0.9rem' } });
    this.autoName = h('span');
    this.resetKnopf = h('button.knopf.haupt', { style: { display: 'none' }, onClick: () => this._zuruecksetzen() }, 'Zurücksetzen');
    this.ui = h('div.bildschirm', { style: { pointerEvents: 'none', justifyContent: 'space-between' } },
      h('div.panel', { style: { padding: '10px 14px', alignSelf: 'flex-start', pointerEvents: 'auto', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
        h('button.knopf.klein', { onClick: () => this._wechsle(-1) }, '◀'),
        this.autoName,
        h('button.knopf.klein', { onClick: () => this._wechsle(1) }, '▶'),
        h('button.knopf.klein.geist', { onClick: () => this.rennKamera.naechsterModus() }, 'Kamera')
      ),
      h('div', { style: { alignSelf: 'center', pointerEvents: 'auto' } }, this.resetKnopf),
      h('div.panel', { style: { padding: '8px 14px', alignSelf: 'center', textAlign: 'center' } }, this.anzeige, this.zusatz)
    );
    this.spiel.uiWurzel.appendChild(this.ui);
    this.autoName.textContent = AUTOS[this.autoIndex].name;
  }

  _wechsle(d) {
    this.autoIndex = (this.autoIndex + d + AUTOS.length) % AUTOS.length;
    this.autoName.textContent = AUTOS[this.autoIndex].name;
    this._autoErzeugen(AUTOS[this.autoIndex].id);
  }

  _zuruecksetzen() {
    const s = TESTFLAECHE.start;
    this.fahrzeug.setzen(s.x, s.y, s.theta);
    this.haenger.zuruecksetzen();
    this.resetKnopf.style.display = 'none';
    this.rennKamera.erstesBild = true;
  }

  verlassen() {
    this.ui.remove();
    for (const aus of this._hoerer) aus();
    this.spiel.eingabe.touch.zeigen(false);
    this.spiel.qualitaet.messungAktiv(false);
    this.auto.freigeben();
    this.umgebung.freigeben();
    this.szene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.(); } });
  }

  schritt(dt) {
    const e = this.spiel.eingabe.werte;
    const eingabe = { ...e, hoch: this._hoch, runter: this._runter };
    this._hoch = this._runter = false;
    this.fahrzeug.schritt(eingabe, dt, this.gitter);
    for (const ev of this.fahrzeug.ereignisse) {
      if (ev.art === 'wand') this.rennKamera.stoss(Math.min(1, ev.staerke / 12));
    }
    if (e.handbremse && this.fahrzeug.tempo > 8 && !this._hbVorher) this.rennKamera.stoss(0.15);
    this._hbVorher = e.handbremse;
    const h = this.haenger.aktualisieren(this.fahrzeug.tempo, dt);
    this.resetKnopf.style.display = h.knopf ? '' : 'none';
    if (h.automatisch) this._zuruecksetzen();
  }

  frame(frameDt, alpha, eingabe, aktionen) {
    for (const a of aktionen) {
      if (a === 'kamera') this.rennKamera.naechsterModus();
      if (a === 'zuruecksetzen') this._zuruecksetzen();
      if (a === 'hoch') this._hoch = true;
      if (a === 'runter') this._runter = true;
    }
    const f = this.fahrzeug;
    const z = f.z;
    const v = f.vorher;
    const x = v.x + (z.x - v.x) * alpha;
    const y = v.y + (z.y - v.y) * alpha;
    const theta = winkelLerp(v.theta, z.theta, alpha);
    this.auto.setzePose(x, y, theta);
    this.auto.aktualisieren(frameDt, z);
    this.rennKamera.aktualisieren({ x, y, theta, vx: z.vx, vy: z.vy, tempo: f.tempo, hoechst: f.p.hoechstKmhAuslegung / 3.6 }, frameDt, this.gitter);
    this.umgebung.folgen(x, y);
    this.anzeige.textContent = `${Math.round(f.tempo * 3.6)} km/h · ${f.gangAnzeige} · ${Math.round(f.driftWinkel / GRAD)}°`;
    this.zusatz.textContent = `${Math.round(z.drehzahl)} U/min${f.p.turbo ? ` · Ladedruck ${Math.round(z.ladedruck * 100)} %` : ''}`;
  }

  debugWerte() {
    const f = this.fahrzeug;
    const z = f.z;
    return [
      ['Tempo', (f.tempo * 3.6).toFixed(1) + ' km/h'],
      ['Driftwinkel', (f.driftWinkel / GRAD).toFixed(1) + '°'],
      ['Schlupf vorne', (z.schlupfV / GRAD).toFixed(1) + '°'],
      ['Schlupf hinten', `${(z.schlupfH / GRAD).toFixed(1)}° / ${z.durchdrehen.toFixed(2)}`],
      ['Gang', f.gangAnzeige],
      ['Drehzahl', Math.round(z.drehzahl) + ''],
      ['Lenkwinkel', (z.delta / GRAD).toFixed(1) + '°']
    ];
  }

  ressourcenNeuAufbauen() {
    this.umgebung.neuAufbauen(STIMMUNG_TAG);
  }
}
