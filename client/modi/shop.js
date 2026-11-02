// Shop: Autos und Teile mit Kategorien, Suche, Filter, Sortierung und Vorschau am Auto im Showroom.
// Die Vorschau ändert keinen gespeicherten Look; gekauft wird mit Bestätigung (client/ui/kauf.js).
import { Showroom } from '../render/showroom.js';
import { GarageKamera } from '../render/garageKamera.js';
import { AutoModell } from '../render/auto/autoModell.js';
import { ShopUi } from '../ui/shop/shopUi.js';
import { kopiereLook, standardLook } from '../../shared/look.js';
import { anprobeAnwenden } from '../../shared/oekonomie.js';

const RUHE = { delta: 0, radWinkelV: 0, radWinkelH: 0, radGeschwV: 0, radGeschwH: 0, ayGl: 0, axGl: 0, bremsEff: 0 };

export class Shop {
  constructor({ kategorie = 'autos' } = {}) {
    this.startKategorie = kategorie;
    this.bloom = true;
  }

  async betreten(spiel) {
    this.spiel = spiel;
    let stimmung = 'neon';
    try {
      stimmung = localStorage.getItem('driftkoenig.showroom') || stimmung;
    } catch { /* privater Modus */ }
    this.showroom = new Showroom(spiel.renderer.renderer, stimmung);
    this.szene = this.showroom.szene;
    this.orbit = new GarageKamera(spiel.renderer.seitenverhaeltnis);
    this.kamera = this.orbit.kamera;
    this.autoDreht = true;
    this.orbit.beiBedienung = () => { this.autoDreht = false; };
    this.autoId = spiel.daten.aktivesAuto;
    this.autoZeigen(this.autoId);
    this.ui = new ShopUi(this, this.startKategorie);
    this._abmelden = [
      this.orbit.binden(spiel.renderer.canvas),
      spiel.ereignisse.an('groesse', () => this.layout()),
      spiel.speicher.beobachten(() => this.ui?.kopfAktualisieren())
    ];
    this._tasten = (e) => {
      if (e.code === 'Escape' && !document.querySelector('.dialog-hintergrund')) {
        e.preventDefault();
        this.verlassenWunsch();
      }
    };
    document.addEventListener('keydown', this._tasten);
    this.layout();
    spiel.audio?.menueMusik?.(true);
  }

  layout() {
    const r = this.spiel.renderer;
    this.orbit.layout(r.breite, r.hoehe, this.ui ? this.ui.verdeckt() : {});
  }

  /** Aktiver Look eines Autos oder Serie, wenn es noch nicht gekauft ist. */
  lookVon(autoId) {
    const a = this.spiel.daten.autos.find((x) => x.id === autoId);
    return kopiereLook(a ? a.looks[a.aktiverLook].look : standardLook(autoId));
  }

  /** Zeigt ein Auto im Showroom (baut das Modell nur bei einem anderen Auto neu). */
  autoZeigen(autoId, look = null) {
    const l = look || this.lookVon(autoId);
    if (this.modell && this.modellAuto === autoId) {
      this.modell.setzeLook(l);
      return;
    }
    if (this.modell) {
      this.showroom.drehteller.remove(this.modell.objekt);
      this.modell.freigeben();
    }
    const q = this.spiel.qualitaet.aktuell;
    this.modell = new AutoModell(autoId, l, { qualitaet: { ...q, schatten: 'map' } });
    this.modellAuto = autoId;
    this.modell.blob.visible = false;
    this.modell.objekt.traverse((o) => { if (o.isMesh && o !== this.modell.blob) o.castShadow = true; });
    this.showroom.drehteller.add(this.modell.objekt);
  }

  /** Vorschau eines Teils am gewählten Auto (nur Anzeige, nichts wird gespeichert). */
  teilZeigen(kaufId) {
    const look = this.lookVon(this.autoId);
    anprobeAnwenden(look, kaufId);
    this.autoZeigen(this.autoId, look);
    const [art, slot] = kaufId.split(':');
    const m = this.modell;
    this.autoDreht = false;
    this._zurueckdrehen = true;
    if (art === 'felge') {
      const rad = m.anker.radhaeuser[0];
      this.orbit.fahreZu({ az: 78, el: 4, abstand: 2.1, ziel: [rad.x, m.p.radRadius, rad.z], min: 1.2 });
    } else if (art === 'teil' && (slot === 'spoiler' || slot === 'heckstoss' || slot === 'auspuff')) {
      this.orbit.fahreZu({ az: 150, el: 16 });
    } else if (art === 'teil' && (slot === 'frontstoss' || slot === 'haube')) {
      this.orbit.fahreZu({ az: 25, el: 16 });
    } else {
      this.orbit.fahreZu({ az: 40, el: 12 });
    }
  }

  async verlassenWunsch() {
    const { Hauptmenue } = await import('./hauptmenue.js');
    this.spiel.wechsleModus(new Hauptmenue());
  }

  async zurGarage(reiter) {
    const { Garage } = await import('./garage.js');
    this.spiel.daten.aktivesAuto = this.autoId;
    this.spiel.speicher.speichern();
    this.spiel.wechsleModus(new Garage({ reiter }));
  }

  frame(frameDt) {
    const dt = this.showroom.drehteller;
    if (this.autoDreht) dt.rotation.y += frameDt * 0.32;
    else if (this._zurueckdrehen) {
      const voll = Math.PI * 2;
      let w = dt.rotation.y % voll;
      if (w > Math.PI) w -= voll;
      if (w < -Math.PI) w += voll;
      dt.rotation.y = w * Math.exp(-frameDt / 0.14);
      if (Math.abs(dt.rotation.y) < 0.0005) {
        dt.rotation.y = 0;
        this._zurueckdrehen = false;
      }
    }
    this.orbit.frame(frameDt);
    this.modell.aktualisieren(frameDt, RUHE, performance.now() / 1000);
  }

  ressourcenNeuAufbauen() {
    this.modell.livery.textur.needsUpdate = true;
    this.showroom.setzeStimmung(this.showroom.id);
  }

  verlassen() {
    for (const aus of this._abmelden) aus();
    document.removeEventListener('keydown', this._tasten);
    this.ui.entfernen();
    this.showroom.drehteller.remove(this.modell.objekt);
    this.modell.freigeben();
    this.orbit.freigeben();
    this.showroom.freigeben();
    this.spiel.speicher.sofortSpeichern();
    this.spiel.audio?.menueMusik?.(false);
  }
}
