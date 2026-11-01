// Globale Fehlerbehandlung: freundlicher Fehlerbildschirm mit „Neu laden“.
import { t } from '../i18n/de.js';

let angezeigt = false;
let vorAnzeige = null;

/** Optionaler Rückruf vor der Anzeige (z. B. Spielstand sichern, Spiel pausieren). */
export function beiFehler(fn) {
  vorAnzeige = fn;
}

function ignorieren(meldung) {
  const m = String(meldung || '');
  // Harmlose Browser-Meldungen, die kein Spielfehler sind
  return /ResizeObserver loop|Script error\.?$|NotAllowedError: play\(\)|AbortError/.test(m);
}

export function zeigeFehlerbildschirm(fehler, titel = t('fehler.titel'), text = t('fehler.text')) {
  if (angezeigt) return;
  angezeigt = true;
  try { vorAnzeige && vorAnzeige(fehler); } catch { /* nichts */ }
  const detail = fehler && (fehler.stack || fehler.message) ? String(fehler.stack || fehler.message) : String(fehler || '');
  const wurzel = document.createElement('div');
  wurzel.className = 'fehler-bildschirm';
  const panel = document.createElement('div');
  panel.className = 'panel';
  const h1 = document.createElement('h1');
  h1.textContent = titel;
  const p = document.createElement('p');
  p.textContent = text;
  panel.append(h1, p);
  if (detail) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = t('fehler.details');
    const pre = document.createElement('pre');
    pre.textContent = detail.slice(0, 4000);
    details.append(summary, pre);
    panel.append(details);
  }
  const knopf = document.createElement('button');
  knopf.className = 'knopf haupt';
  knopf.textContent = t('allgemein.neuLaden');
  knopf.addEventListener('click', () => location.reload());
  panel.append(knopf);
  wurzel.append(panel);
  document.body.appendChild(wurzel);
  setTimeout(() => knopf.focus(), 50);
}

export function installiereFehlerbehandlung() {
  window.addEventListener('error', (e) => {
    if (ignorieren(e.message)) return;
    // Fehler beim Laden von Ressourcen (Bilder etc.) haben kein error-Objekt → nicht fatal
    if (!e.error && e.target && e.target !== window) return;
    console.error('[Fehler]', e.error || e.message);
    zeigeFehlerbildschirm(e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const grund = e.reason;
    if (ignorieren(grund && (grund.message || grund))) return;
    console.error('[Unbehandelte Ablehnung]', grund);
    zeigeFehlerbildschirm(grund);
  });
}
