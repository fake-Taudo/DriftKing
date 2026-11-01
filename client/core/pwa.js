// Progressive Web App: Service-Worker-Registrierung, Update-Hinweis, Home-Bildschirm-Tipp (iOS).
import { toast } from '../ui/dom.js';
import { t } from '../i18n/de.js';
import { istIOS, istStandalone } from './geraet.js';

export function pwaStarten() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) {
    // Im Entwicklungsmodus keinen Service Worker verwenden (alte Registrierungen entfernen)
    navigator.serviceWorker.getRegistrations().then((liste) => liste.forEach((r) => r.unregister())).catch(() => {});
    return;
  }
  let neuLadenAngefordert = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (neuLadenAngefordert) location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const hinweis = (worker) => {
      toast(t('pwa.update'), {
        art: 'info',
        dauer: 0,
        aktion: {
          text: t('allgemein.neuLaden'),
          ausfuehren: () => {
            neuLadenAngefordert = true;
            worker.postMessage({ typ: 'aktivieren' });
          }
        }
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) hinweis(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const neu = reg.installing;
      if (!neu) return;
      neu.addEventListener('statechange', () => {
        if (neu.state === 'installed' && navigator.serviceWorker.controller) hinweis(neu);
      });
    });
    // Regelmäßig nach Updates sehen (z. B. wenn das Spiel lange offen ist)
    setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  }).catch((e) => console.warn('[PWA] Service Worker nicht registriert:', e));
}

/** Auf dem iPhone fehlt die Fullscreen-API → einmalig Tipp zum Home-Bildschirm zeigen. */
export function homeBildschirmHinweis() {
  if (!istIOS || istStandalone) return;
  try {
    if (localStorage.getItem('driftkoenig.homeHinweis') === '1') return;
    localStorage.setItem('driftkoenig.homeHinweis', '1');
  } catch { /* privater Modus: trotzdem einmal zeigen */ }
  toast(t('pwa.homeBildschirm'), { dauer: 9000 });
}
