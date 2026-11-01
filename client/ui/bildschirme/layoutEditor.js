// Layout-Editor der Touch-Steuerung: Tasten per Ziehen verschieben, Größe ändern, Vorschau für
// das aktuelle Format (Hoch/Quer). Gespeichert wird je Ausrichtung im Spielstand.
import { h } from '../dom.js';
import { t } from '../../i18n/de.js';
import { STANDARD_LAYOUT, istHochformat } from '../../eingabe/touch.js';

export function layoutEditor(spiel) {
  return new Promise((aufloesen) => {
    const s = spiel.daten.einstellungen.steuerung;
    const touch = spiel.eingabe.touch;
    const ausrichtung = istHochformat() ? 'hoch' : 'quer';
    const layout = JSON.parse(JSON.stringify(touch.layout));
    let auswahl = null;
    const war = touch.sichtbar;
    touch.zeigen(true);
    touch.wurzel.classList.add('bearbeiten');

    const groesseText = h('span.zahl');
    const leiste = h('div.layout-leiste.panel',
      h('strong', t('layout.titel', { format: t('layout.' + ausrichtung) })),
      h('div.layout-hinweis', t('layout.hinweis')),
      h('div.layout-knoepfe',
        h('button.knopf.klein', { onClick: () => groesse(-0.1) }, '−'),
        groesseText,
        h('button.knopf.klein', { onClick: () => groesse(0.1) }, '+'),
        h('button.knopf.klein.geist', { onClick: () => standard() }, t('layout.standard')),
        h('button.knopf.klein.geist', { onClick: () => ende(false) }, t('allgemein.abbrechen')),
        h('button.knopf.klein.haupt', { onClick: () => ende(true) }, t('allgemein.speichern'))
      )
    );
    const wurzel = h('div.layout-editor', leiste);
    spiel.overlay.appendChild(wurzel);

    const anwenden = () => {
      touch.layout = layout;
      touch.positionieren();
      for (const [name, el] of Object.entries(touch.elemente)) el.classList.toggle('ausgewaehlt', name === auswahl);
      groesseText.textContent = auswahl ? Math.round(layout[ausrichtung][auswahl === 'lenkknauf' ? 'lenkrad' : auswahl].g * 100) + ' %' : '–';
    };
    function groesse(d) {
      if (!auswahl) return;
      const e = layout[ausrichtung][auswahl];
      e.g = Math.max(0.6, Math.min(1.8, Math.round((e.g + d) * 10) / 10));
      anwenden();
    }
    function standard() {
      layout[ausrichtung] = JSON.parse(JSON.stringify(STANDARD_LAYOUT[ausrichtung]));
      anwenden();
    }

    // Ziehen (abfangen, bevor die Tasten selbst reagieren)
    let ziehen = null;
    const runter = (ev) => {
      const el = ev.target.closest('.touch-knopf, .touch-lenkrad');
      if (!el) return;
      ev.preventDefault();
      ev.stopPropagation();
      const name = Object.entries(touch.elemente).find(([, e]) => e === el)?.[0];
      if (!name || name === 'lenkknauf') return;
      auswahl = name;
      ziehen = { id: ev.pointerId, name };
      anwenden();
    };
    const bewegen = (ev) => {
      if (!ziehen || ev.pointerId !== ziehen.id) return;
      ev.preventDefault();
      ev.stopPropagation();
      const e = layout[ausrichtung][ziehen.name];
      let x = ev.clientX / window.innerWidth;
      if (touch.linkshaender) x = 1 - x;
      e.x = Math.max(0.03, Math.min(0.97, x));
      e.y = Math.max(0.08, Math.min(0.97, ev.clientY / window.innerHeight));
      anwenden();
    };
    const hoch = (ev) => {
      if (ziehen && ev.pointerId === ziehen.id) ziehen = null;
    };
    touch.wurzel.addEventListener('pointerdown', runter, true);
    window.addEventListener('pointermove', bewegen, true);
    window.addEventListener('pointerup', hoch, true);

    function ende(speichern) {
      touch.wurzel.removeEventListener('pointerdown', runter, true);
      window.removeEventListener('pointermove', bewegen, true);
      window.removeEventListener('pointerup', hoch, true);
      touch.wurzel.classList.remove('bearbeiten');
      for (const el of Object.values(touch.elemente)) el.classList.remove('ausgewaehlt');
      if (speichern) {
        s.layout = { ...(s.layout || {}), [ausrichtung]: layout[ausrichtung] };
        spiel.speicher.speichern();
      }
      spiel.einstellungenAnwenden();
      touch.zeigen(war);
      wurzel.remove();
      aufloesen(speichern);
    }
    anwenden();
  });
}
