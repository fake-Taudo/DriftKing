// HUD im Rennen: Tacho/Drehzahl, Gang, Driftwinkel-Bogen, Punkte beider Fahrer, Combo, Rolle,
// Abstandsanzeige (Farbe + Symbol für Farbenblinde), Restzeit, Lauf-/Durchgangsstand, Minimap,
// Pause-Knopf, Countdown, Meldungen und Punkte-Popups. Überlappt nie mit den Touch-Tasten
// (Layout per CSS, im Hochformat wandert der Tacho nach oben).
import { h } from './dom.js';
import { t, zahl } from '../i18n/de.js';

const SVG = 'http://www.w3.org/2000/svg';
function svg(tag, attr = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attr)) el.setAttribute(k, v);
  return el;
}
/** SVG-Bogenpfad (Mittelpunkt cx, cy, Radius r, von/bis in Grad, 0° = oben, im Uhrzeigersinn). */
function bogen(cx, cy, r, von, bis) {
  const p = (w) => [cx + r * Math.sin((w * Math.PI) / 180), cy - r * Math.cos((w * Math.PI) / 180)];
  const [x1, y1] = p(von);
  const [x2, y2] = p(bis);
  const gross = Math.abs(bis - von) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${gross} ${bis > von ? 1 : 0} ${x2} ${y2}`;
}

export class Hud {
  /**
   * @param {HTMLElement} wurzel
   * @param {{minimap?: import('./minimap.js').Minimap, battle?: boolean, onPause?: Function, onZuruecksetzen?: Function}} o
   */
  constructor(wurzel, { minimap = null, battle = false, onPause, onZuruecksetzen } = {}) {
    this.battle = battle;
    this.el = h('div.hud' + (battle ? '.battle' : ''));
    // Oben links: Minimap
    this.minimapBox = h('div.hud-minimap');
    if (minimap) this.minimapBox.appendChild(minimap.canvas);
    // Oben Mitte: Status (Rolle, Lauf, Zeit, Punkte)
    this.rolle = h('div.hud-rolle');
    this.status = h('div.hud-status');
    this.zeit = h('div.hud-zeit.zahl');
    this.punkteIch = h('div.hud-punkte.ich', h('span.name', t('hud.du')), this.punkteIchWert = h('span.wert.zahl', '0'));
    this.punkteGegner = h('div.hud-punkte.gegner', this.gegnerName = h('span.name', ''), this.punkteGegnerWert = h('span.wert.zahl', '0'));
    this.combo = h('div.hud-combo', h('div.hud-combo-balken', this.comboFuellung = h('div')), this.comboText = h('span.zahl', '×1.0'));
    this.abstand = h('div.hud-abstand', this.abstandSymbol = h('span.symbol'), this.abstandText = h('span.zahl'));
    this.oben = h('div.hud-oben',
      h('div.hud-zeile', this.rolle, this.status, this.zeit),
      battle ? h('div.hud-zeile', this.punkteIch, this.punkteGegner) : h('div.hud-zeile', this.punkteIch),
      h('div.hud-zeile', this.combo, battle ? this.abstand : null)
    );
    // Oben rechts: Pause
    this.pauseKnopf = h('button.knopf.rund.hud-pause', { 'aria-label': t('hud.pause'), onClick: () => onPause && onPause() }, '❚❚');
    this.ping = h('div.hud-ping.zahl');
    this.fps = h('div.hud-fps.zahl');
    // Tacho
    const s = svg('svg', { viewBox: '0 0 200 130', class: 'hud-tacho-svg' });
    s.appendChild(svg('path', { d: bogen(100, 100, 82, -120, 120), class: 'tacho-spur' }));
    this.drehzahlBogen = svg('path', { d: bogen(100, 100, 82, -120, -119), class: 'tacho-drehzahl' });
    s.appendChild(this.drehzahlBogen);
    s.appendChild(svg('path', { d: bogen(100, 100, 66, -60, 60), class: 'tacho-spur winkel' }));
    this.winkelBogen = svg('path', { d: bogen(100, 100, 66, 0, 0.5), class: 'tacho-winkel' });
    s.appendChild(this.winkelBogen);
    this.tempo = h('div.hud-tempo.zahl', '0');
    this.gang = h('div.hud-gang.zahl', 'N');
    this.winkelText = h('div.hud-winkel.zahl', '0°');
    this.tacho = h('div.hud-tacho', s, h('div.hud-tacho-mitte', this.tempo, h('div.hud-einheit', t('allgemein.kmh')), h('div.hud-tacho-unten', this.gang, this.winkelText)));
    // Mitte: Countdown, Meldungen, Popups
    this.countdown = h('div.hud-countdown.zahl');
    this.meldung = h('div.hud-meldung');
    this.popups = h('div.hud-popups');
    this.resetKnopf = h('button.knopf.haupt.hud-reset', { onClick: () => onZuruecksetzen && onZuruecksetzen() }, t('hud.zuruecksetzen'));
    this.resetKnopf.style.display = 'none';
    this.el.append(this.minimapBox, this.oben, h('div.hud-rechts', this.pauseKnopf, this.ping, this.fps), this.tacho, this.countdown, this.meldung, this.popups, this.resetKnopf);
    wurzel.appendChild(this.el);
    this._meldungZeit = 0;
    this._letzte = {};
  }

  _setze(el, schl, wert) {
    if (this._letzte[schl] === wert) return;
    this._letzte[schl] = wert;
    el.textContent = wert;
  }

  /** Tacho: tempo (m/s), drehzahl-Anteil 0..1, gang, driftwinkel (Grad). */
  fahrt({ tempo, drehzahlAnteil, gang, winkel, begrenzer }) {
    this._setze(this.tempo, 't', String(Math.round(tempo * 3.6)));
    this._setze(this.gang, 'g', gang);
    this._setze(this.winkelText, 'w', Math.round(winkel) + '°');
    const dz = Math.round(Math.max(0, Math.min(1, drehzahlAnteil)) * 240) - 120;
    if (this._letzte.dz !== dz) {
      this._letzte.dz = dz;
      this.drehzahlBogen.setAttribute('d', bogen(100, 100, 82, -120, Math.max(-119, dz)));
      this.drehzahlBogen.classList.toggle('rot', drehzahlAnteil > 0.9 || begrenzer);
    }
    const wg = Math.round(Math.max(-90, Math.min(90, winkel)) * (60 / 90));
    if (this._letzte.wg !== wg) {
      this._letzte.wg = wg;
      this.winkelBogen.setAttribute('d', bogen(100, 100, 66, 0, wg === 0 ? 0.5 : wg));
      this.winkelBogen.classList.toggle('gut', Math.abs(winkel) >= 30 && Math.abs(winkel) <= 55);
    }
  }

  /** Status-Zeile: rolle (Text oder ''), status (z. B. „Runde 1/3“), restzeit (s oder null). */
  stand({ rolle = '', status = '', zeit = null, zeitWarnung = false }) {
    this._setze(this.rolle, 'rolle', rolle);
    this.rolle.style.display = rolle ? '' : 'none';
    this._setze(this.status, 'status', status);
    this._setze(this.zeit, 'zeit', zeit === null ? '' : formatZeit(zeit));
    this.zeit.classList.toggle('warnung', zeitWarnung);
  }

  punkte({ ich = null, gegner = null, gegnerName = '', combo = 1, comboAnteil = 0 }) {
    this.punkteIch.style.display = ich === null ? 'none' : '';
    if (ich !== null) this._setze(this.punkteIchWert, 'pi', zahl(ich, 1));
    if (this.battle) {
      this.punkteGegner.style.display = gegner === null ? 'none' : '';
      if (gegner !== null) this._setze(this.punkteGegnerWert, 'pg', zahl(gegner, 1));
      this._setze(this.gegnerName, 'gn', gegnerName);
    }
    const c = Math.round(combo * 10) / 10;
    this._setze(this.comboText, 'c', '×' + c.toFixed(1));
    const fuell = Math.round(Math.max(0, Math.min(1, comboAnteil)) * 100);
    if (this._letzte.cf !== fuell) {
      this._letzte.cf = fuell;
      this.comboFuellung.style.width = fuell + '%';
    }
    const stufe = combo >= 2.5 ? 3 : combo >= 2 ? 2 : combo >= 1.5 ? 1 : 0;
    if (this._letzte.cs !== stufe) {
      this._letzte.cs = stufe;
      this.combo.dataset.stufe = String(stufe);
    }
    this.combo.style.display = ich === null ? 'none' : '';
  }

  /** Abstand zum Gegner (m) mit Bewertung 'gut' | 'mittel' | 'schlecht' (Farbe + Symbol). */
  abstandAnzeigen(meter, bewertung) {
    if (meter === null) { this.abstand.style.display = 'none'; return; }
    this.abstand.style.display = '';
    this._setze(this.abstandText, 'ab', meter.toFixed(1) + ' m');
    if (this._letzte.abB !== bewertung) {
      this._letzte.abB = bewertung;
      this.abstand.dataset.bewertung = bewertung;
      this.abstandSymbol.textContent = bewertung === 'gut' ? '●' : bewertung === 'mittel' ? '▲' : '■';
    }
  }

  countdownZeigen(text) {
    this._setze(this.countdown, 'cd', text || '');
    if (text) {
      this.countdown.classList.remove('puls');
      void this.countdown.offsetWidth;
      this.countdown.classList.add('puls');
    }
  }

  meldungZeigen(text, dauer = 2, art = '') {
    this.meldung.textContent = text;
    this.meldung.dataset.art = art;
    this.meldung.classList.add('sichtbar');
    this._meldungZeit = dauer;
  }

  /** Punkte-Popup (z. B. „+12,4“ oder „Wand −5“). */
  popup(text, art = 'plus') {
    const el = h('div.hud-popup.' + art, text);
    this.popups.appendChild(el);
    setTimeout(() => el.remove(), 1200);
    while (this.popups.children.length > 4) this.popups.firstChild.remove();
  }

  resetAnzeigen(an) {
    if (this._letzte.reset === an) return;
    this._letzte.reset = an;
    this.resetKnopf.style.display = an ? '' : 'none';
  }

  pingAnzeigen(ms, schlecht) {
    this.ping.style.display = ms === null ? 'none' : '';
    if (ms !== null) this._setze(this.ping, 'ping', `${ms} ms`);
    this.ping.classList.toggle('schlecht', !!schlecht);
  }

  fpsAnzeigen(fps) {
    this.fps.style.display = fps === null ? 'none' : '';
    if (fps !== null) this._setze(this.fps, 'fps', `${Math.round(fps)} FPS`);
  }

  frame(dt) {
    if (this._meldungZeit > 0) {
      this._meldungZeit -= dt;
      if (this._meldungZeit <= 0) this.meldung.classList.remove('sichtbar');
    }
  }

  zeigen(an) {
    this.el.style.display = an ? '' : 'none';
  }

  entfernen() {
    this.el.remove();
  }
}

export function formatZeit(s) {
  if (!Number.isFinite(s)) return '–';
  const neg = s < 0;
  s = Math.abs(s);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return (neg ? '-' : '') + (m > 0 ? `${m}:${rest.toFixed(1).padStart(4, '0')}` : rest.toFixed(1));
}
