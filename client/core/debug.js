// Debug-Overlay (FPS, Tempo, Driftwinkel, Schlupf, Punkte-Rate, Ping …) und Cheats.
// Aktivierung: URL-Parameter ?debug=1 (immer) oder Taste F3 (nur im Entwicklungsmodus).
// Cheats sind im Produktions-Build deaktiviert.
import { h } from '../ui/dom.js';
import { t } from '../i18n/de.js';

export const DEBUG_PARAM = new URLSearchParams(location.search).get('debug') === '1';
export const CHEATS_ERLAUBT = import.meta.env.DEV;

export class DebugOverlay {
  constructor(spiel) {
    this.spiel = spiel;
    this.sichtbar = DEBUG_PARAM;
    this.el = h('div.debug-overlay');
    this.tabelle = h('table');
    this.el.appendChild(this.tabelle);
    this.zeilen = new Map();
    if (CHEATS_ERLAUBT) {
      const cheats = h('div.cheats',
        h('strong', t('debug.cheats')),
        h('button', { onClick: () => spiel.cheat('muenzen') }, t('debug.muenzen')),
        h('button', { onClick: () => spiel.cheat('strecken') }, t('debug.strecken')),
        h('button', { onClick: () => spiel.cheat('bots') }, t('debug.bots')),
        h('button', { onClick: () => spiel.cheat('autos') }, t('debug.autos'))
      );
      this.el.appendChild(cheats);
    }
    this.el.style.display = this.sichtbar ? '' : 'none';
    document.getElementById('overlay').appendChild(this.el);
    this._zeit = 0;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3' && (import.meta.env.DEV || DEBUG_PARAM)) {
        e.preventDefault();
        this.umschalten();
      }
    });
  }

  umschalten() {
    this.sichtbar = !this.sichtbar;
    this.el.style.display = this.sichtbar ? '' : 'none';
  }

  /** Werte setzen (nur ~6× pro Sekunde, um das DOM zu schonen). */
  aktualisieren(frameDt, werte) {
    if (!this.sichtbar) return;
    this._zeit += frameDt;
    if (this._zeit < 0.16) return;
    this._zeit = 0;
    for (const [schluessel, wert] of werte) {
      let zelle = this.zeilen.get(schluessel);
      if (!zelle) {
        zelle = h('td');
        this.tabelle.appendChild(h('tr', h('td', schluessel), zelle));
        this.zeilen.set(schluessel, zelle);
      }
      zelle.textContent = wert;
    }
  }
}
