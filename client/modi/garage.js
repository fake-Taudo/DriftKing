// Garage: Showroom mit dem aktiven Auto, freie Kamera, Bedienfeld mit allen Anpassungen.
// Jede Änderung ist sofort am Auto sichtbar (Anprobe auch ohne Kauf). Gespeichert wird automatisch, sobald
// der Look nur noch aus gekauften Teilen besteht; Ungekauftes bleibt Anprobe, bis es gekauft oder verworfen
// wird. Die Livery wird höchstens einmal pro Bild neu gezeichnet.
import { Showroom } from '../render/showroom.js';
import { GarageKamera } from '../render/garageKamera.js';
import { AutoModell } from '../render/auto/autoModell.js';
import { GarageUi } from '../ui/garage/garageUi.js';
import { dialog } from '../ui/dom.js';
import { teileKaufen } from '../ui/kauf.js';
import { t, zahl } from '../i18n/de.js';
import { kopiereLook, pruefeLook } from '../../shared/look.js';
import { AUFKLEBER_IDS } from '../assets/aufkleber.js';
import { Verlauf } from '../../shared/verlauf.js';
import { besitzt, lookBedarf, anprobeEntfernen } from '../../shared/oekonomie.js';
import { teilInfo } from '../../shared/teile.js';

const RUHE = { delta: 0, radWinkelV: 0, radWinkelH: 0, radGeschwV: 0, radGeschwH: 0, ayGl: 0, axGl: 0, bremsEff: 0 };

/** Kamerawinkel je Livery-Zone (zeigt beim Bearbeiten die richtige Stelle). */
const ZONEN_ANSICHT = {
  seiteL: { az: 90, el: 6 },
  seiteR: { az: -90, el: 6 },
  haube: { az: 12, el: 42, relativ: 0.85 },
  dach: { az: 40, el: 66, relativ: 0.9 },
  heck: { az: 180, el: 24, relativ: 0.85 },
  front: { az: 0, el: 8, relativ: 0.85 }
};

export class Garage {
  constructor({ reiter = 'lack' } = {}) {
    this.startReiter = reiter;
    this.bloom = true;
  }

  async betreten(spiel) {
    this.spiel = spiel;
    this.verlauf = new Verlauf();
    this.showroom = new Showroom(spiel.renderer.renderer, this._stimmungLaden());
    this.szene = this.showroom.szene;
    this.orbit = new GarageKamera(spiel.renderer.seitenverhaeltnis);
    this.kamera = this.orbit.kamera;
    this.autoDreht = true;
    this.orbit.beiBedienung = () => { this.autoDreht = false; };
    this.auswahl = -1;
    this._autoLaden(spiel.daten.aktivesAuto);

    this.ui = new GarageUi(this, this.startReiter);
    this._abmelden = [
      this.orbit.binden(spiel.renderer.canvas),
      spiel.ereignisse.an('groesse', () => this.layout()),
      spiel.ereignisse.an('qualitaet', (q) => this.modell?.qualitaet({ ...q, schatten: 'map' })),
      spiel.speicher.beobachten(() => this.ui?.kopfAktualisieren())
    ];
    this._tasten = (e) => this._tastatur(e);
    document.addEventListener('keydown', this._tasten);
    this.layout();
    spiel.audio?.menueMusik?.(true);
  }

  // -------------------------------------------------------------------------
  // Daten

  get daten() {
    return this.spiel.daten;
  }

  get auto() {
    return this.daten.autos.find((a) => a.id === this.autoId);
  }

  get slot() {
    return this.auto.looks[this.auto.aktiverLook];
  }

  _stimmungLaden() {
    try {
      return localStorage.getItem('driftkoenig.showroom') || 'neon';
    } catch {
      return 'neon';
    }
  }

  stimmung(id) {
    this.showroom.setzeStimmung(id);
    try {
      localStorage.setItem('driftkoenig.showroom', id);
    } catch { /* privater Modus: nur für diese Sitzung */ }
  }

  _autoLaden(autoId) {
    if (this.modell) {
      this.showroom.drehteller.remove(this.modell.objekt);
      this.modell.freigeben();
    }
    this.autoId = autoId;
    this.look = kopiereLook(this.slot.look);
    this.auswahl = -1;
    this.verlauf.leeren();
    const q = this.spiel.qualitaet.aktuell;
    this.modell = new AutoModell(autoId, this.look, { qualitaet: { ...q, schatten: 'map' } });
    this.modell.blob.visible = false;
    this.modell.objekt.traverse((o) => { if (o.isMesh && o !== this.modell.blob) o.castShadow = true; });
    this.showroom.drehteller.add(this.modell.objekt);
    this._schmutzig = false;
  }

  /** Lädt einen anderen Look-Slot oder ein anderes Auto (nach Klärung offener Anproben). */
  async autoWechseln(autoId) {
    if (!(await this.anprobeKlaeren())) return;
    this.daten.aktivesAuto = autoId;
    this.spiel.speicher.speichern();
    this._autoLaden(autoId);
    this.ui.neuAufbauen();
  }

  async lookSlotWechseln(i) {
    if (!(await this.anprobeKlaeren())) return;
    this.auto.aktiverLook = i;
    this.spiel.speicher.speichern();
    this.lookErsetzen(kopiereLook(this.slot.look), false);
    this.verlauf.leeren();
    this.ui.neuAufbauen();
  }

  /** Ersetzt den bearbeiteten Look (Rückgängig, Import, Slot-Wechsel). */
  lookErsetzen(look, merken = true) {
    if (merken) this.verlauf.merken(this.look);
    this.look = look;
    if (this.auswahl >= look.aufkleber.length) this.auswahl = look.aufkleber.length - 1;
    this._schmutzig = true;
    this._speichernWennMoeglich();
    this.ui?.anprobeAktualisieren();
  }

  /**
   * Ändert den Look. Aufeinanderfolgende Änderungen derselben Gruppe (z. B. ein Schieberegler in Bewegung)
   * zählen als ein Schritt für Rückgängig.
   * @param {(look:object)=>void} fn
   * @param {string} [gruppe]
   */
  aendern(fn, gruppe = '') {
    if (!gruppe || gruppe !== this._letzteGruppe) this.verlauf.merken(this.look);
    this._letzteGruppe = gruppe;
    clearTimeout(this._gruppeZeit);
    this._gruppeZeit = setTimeout(() => { this._letzteGruppe = null; }, 700);
    fn(this.look);
    this._schmutzig = true;
    this._speichernWennMoeglich();
    this.ui?.anprobeAktualisieren();
  }

  rueckgaengig() {
    const z = this.verlauf.rueckgaengig(this.look);
    if (z) this._ausVerlauf(z);
  }

  wiederholen() {
    const z = this.verlauf.wiederholen(this.look);
    if (z) this._ausVerlauf(z);
  }

  _ausVerlauf(look) {
    this.look = look;
    this._letzteGruppe = null;
    if (this.auswahl >= look.aufkleber.length) this.auswahl = look.aufkleber.length - 1;
    this._schmutzig = true;
    this._speichernWennMoeglich();
    this.ui.neuZeichnen();
    this.ui.anprobeAktualisieren();
  }

  _tastatur(e) {
    if (document.querySelector('.dialog-hintergrund')) return;
    const feld = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '') && document.activeElement.type !== 'range';
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !feld) {
      e.preventDefault();
      if (e.shiftKey) this.wiederholen(); else this.rueckgaengig();
    } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY' && !feld) {
      e.preventDefault();
      this.wiederholen();
    } else if (e.code === 'Escape' && !feld) {
      e.preventDefault();
      this.ui.zurueckKnopf();
    }
  }

  // -------------------------------------------------------------------------
  // Besitz, Kaufen, Speichern

  /** Preis und Besitz einer Kauf-ID für das aktuelle Auto. */
  preisInfo(kaufId) {
    const info = teilInfo(kaufId, this.autoId);
    return { preis: info ? info.preis : 0, besitz: besitzt(this.daten, kaufId, this.autoId), name: info?.name ?? kaufId };
  }

  bedarf() {
    return lookBedarf(this.daten, this.autoId, this.look);
  }

  _speichernWennMoeglich() {
    if (this.bedarf().teile.length) return false;
    if (!pruefeLook(this.look, { aufkleberIds: AUFKLEBER_IDS }).ok) return false;
    this.slot.look = kopiereLook(this.look);
    this.spiel.speicher.speichern();
    return true;
  }

  /**
   * Kauf-Flow: Preis und Bestätigung, danach atomarer Kauf und Erfolgsmeldung.
   * Nicht leistbares zeigt den fehlenden Betrag.
   * @returns {Promise<boolean>} true, wenn gekauft
   */
  async kaufDialog(kaufIds, optionen = {}) {
    if (!(await teileKaufen(this.spiel, kaufIds, this.autoId, optionen))) return false;
    this.ui?.kaufFeier();
    this._speichernWennMoeglich();
    this.ui?.kopfAktualisieren();
    this.ui?.neuZeichnen();
    this.ui?.anprobeAktualisieren();
    return true;
  }

  /** Alle Anproben kaufen. */
  async anprobeKaufen() {
    return this.kaufDialog(this.bedarf().teile.map((x) => x.id));
  }

  /** Nimmt alle nicht gekauften Teile aus dem Look. */
  anprobeVerwerfen() {
    this.verlauf.merken(this.look);
    anprobeEntfernen(this.look, this.slot.look, this.bedarf().teile.map((x) => x.id));
    if (this.auswahl >= this.look.aufkleber.length) this.auswahl = this.look.aufkleber.length - 1;
    this._schmutzig = true;
    this._speichernWennMoeglich();
    this.ui.neuZeichnen();
    this.ui.anprobeAktualisieren();
  }

  /** Vor dem Verlassen: offene Anprobe kaufen oder verwerfen. @returns {Promise<boolean>} weitermachen? */
  async anprobeKlaeren() {
    const b = this.bedarf();
    if (!b.teile.length) return true;
    const wahl = await dialog({
      titel: t('garage.anprobeOffenTitel'),
      text: t('garage.anprobeOffenText', { teile: b.teile.map((x) => x.name).join(', '), preis: zahl(b.summe) }),
      knoepfe: [
        { text: t('allgemein.abbrechen'), art: 'geist', wert: 'abbrechen' },
        { text: t('garage.verwerfen'), wert: 'verwerfen' },
        { text: t('garage.kaufen', { preis: zahl(b.summe) }), art: 'haupt', wert: 'kaufen' }
      ]
    });
    if (wahl === 'verwerfen') {
      this.anprobeVerwerfen();
      return true;
    }
    if (wahl === 'kaufen') return this.anprobeKaufen();
    return false;
  }

  async verlassenWunsch() {
    if (!(await this.anprobeKlaeren())) return;
    const { Hauptmenue } = await import('./hauptmenue.js');
    this.spiel.wechsleModus(new Hauptmenue());
  }

  // -------------------------------------------------------------------------
  // Kamera und Ansichten

  /** Vom Bedienfeld verdeckter Bereich → Bildmitte und Abstand anpassen. */
  layout() {
    const r = this.spiel.renderer;
    const f = this.ui ? this.ui.verdeckt() : { rechts: 0, unten: 0 };
    this.orbit.layout(r.breite, r.hoehe, f);
  }

  ansicht(name) {
    const m = this.modell;
    const a = m.anker;
    this.autoDreht = false;
    this._zielDrehung = 0;
    const rad = a.radhaeuser[0];
    const ansichten = {
      standard: { az: 40, el: 12 },
      front: { az: 0, el: 7 },
      seite: { az: 90, el: 6 },
      heck: { az: 180, el: 9 },
      felge: { az: 78, el: 4, abstand: 2.1, ziel: [rad.x, m.p.radRadius, rad.z], min: 1.2 },
      innen: { az: 180, el: 3, abstand: 0.75, ziel: [a.innenraum.breite * 0.2, a.innenraum.guertel + 0.1, a.innenraum.zVorne - 0.3], min: 0.3 }
    };
    this.orbit.fahreZu(ansichten[name] || ansichten.standard);
    this.ui?.ansichtMarkieren(name);
  }

  /** Index der markierten Ebene: nur im Aufkleber-Reiter sichtbar, nie auf Fotos. */
  get markierung() {
    return this.ui?.reiter === 'aufkleber' && !this.ui?.fotoAktiv ? this.auswahl : -1;
  }

  markierungAktualisieren() {
    this._schmutzig = true;
  }

  zonenAnsicht(zone) {
    this.autoDreht = false;
    this._zielDrehung = 0;
    this.orbit.fahreZu(ZONEN_ANSICHT[zone] || ZONEN_ANSICHT.seiteL);
    this.ui?.ansichtMarkieren(null);
  }

  autoDrehenUmschalten() {
    this.autoDreht = !this.autoDreht;
    this._zielDrehung = null;
    return this.autoDreht;
  }

  /** Fotomodus: ohne Bedienfeld, Foto in hoher Qualität. */
  async fotoAufnehmen() {
    const r = this.spiel.renderer;
    const q = this.modell.livery.groesse;
    this.modell.livery.setzeGroesse(2048);
    this.modell.lackMat.map = this.modell.livery.textur;
    this.modell.lackMat.needsUpdate = true;
    this.modell.livery.zeichnen(this.look);
    const sonne = this.showroom.sonne;
    const schatten = sonne.shadow.mapSize.x;
    sonne.shadow.mapSize.set(4096, 4096);
    sonne.shadow.map?.dispose();
    sonne.shadow.map = null;
    let blob = null;
    try {
      blob = await r.foto(this.szene, this.kamera);
    } finally {
      this.modell.livery.setzeGroesse(q);
      this.modell.lackMat.map = this.modell.livery.textur;
      this.modell.lackMat.needsUpdate = true;
      this.modell.livery.zeichnen(this.look, { auswahl: this.markierung });
      sonne.shadow.mapSize.set(schatten, schatten);
      sonne.shadow.map?.dispose();
      sonne.shadow.map = null;
    }
    return blob;
  }

  // -------------------------------------------------------------------------
  // Spielschleife

  frame(frameDt) {
    if (this._schmutzig) {
      this._schmutzig = false;
      this.modell.setzeLook(this.look, { auswahl: this.markierung });
      this.ui?.nachLook();
    }
    const dt = this.showroom.drehteller;
    if (this.autoDreht) {
      dt.rotation.y += frameDt * 0.32;
    } else if (this._zielDrehung !== null && this._zielDrehung !== undefined) {
      // Für Schnellansichten die Drehscheibe auf den kürzesten Weg zurückdrehen
      const voll = Math.PI * 2;
      let w = dt.rotation.y % voll;
      if (w > Math.PI) w -= voll;
      if (w < -Math.PI) w += voll;
      const k = 1 - Math.exp(-frameDt / 0.14);
      dt.rotation.y = w * (1 - k);
      if (Math.abs(dt.rotation.y) < 0.0005) {
        dt.rotation.y = 0;
        this._zielDrehung = null;
      }
    }
    this.orbit.frame(frameDt);
    this.modell.aktualisieren(frameDt, RUHE, performance.now() / 1000);
  }

  beiSichtbar() {
    this.spiel.schleife.zuruecksetzen();
  }

  ressourcenNeuAufbauen() {
    this.modell.livery.textur.needsUpdate = true;
    this.showroom.setzeStimmung(this.showroom.id);
  }

  debugWerte() {
    return [['Ebenen', String(this.look.aufkleber.length)]];
  }

  verlassen() {
    clearTimeout(this._gruppeZeit);
    for (const aus of this._abmelden) aus();
    document.removeEventListener('keydown', this._tasten);
    this.ui.entfernen();
    this.spiel.speicher.sofortSpeichern();
    this.showroom.drehteller.remove(this.modell.objekt);
    this.modell.freigeben();
    this.orbit.freigeben();
    this.showroom.freigeben();
    this.spiel.audio?.menueMusik?.(false);
  }
}
