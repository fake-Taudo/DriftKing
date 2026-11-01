// Geräte-Erkennung, Vollbild, Wake-Lock und Unterdrückung unerwünschter Browser-Gesten.

const ua = navigator.userAgent || '';
export const istIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const istAndroid = /Android/i.test(ua);
export const istTouchGeraet = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
export const istMobil = istIOS || istAndroid || (istTouchGeraet && Math.min(screen.width, screen.height) < 820);
export const istDesktop = !istMobil;
export const istStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const bevorzugtWenigBewegung = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
export const istSicher = window.isSecureContext;

/** Prüft, ob WebGL 2 verfügbar ist. */
export function pruefeWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Vollbild

export function vollbildVerfuegbar() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen) && !(istIOS && /iPhone|iPod/.test(ua));
}

export function istVollbild() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export async function vollbildUmschalten() {
  try {
    if (istVollbild()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const el = document.documentElement;
      await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
      // Auf Handys im Vollbild Querformat bevorzugen (wo erlaubt)
      if (istMobil && screen.orientation?.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    }
  } catch {
    /* vom Browser abgelehnt – stillschweigend ignorieren */
  }
}

// ---------------------------------------------------------------------------
// Wake-Lock (Display wach halten während der Fahrt)

let wakeLock = null;
let wakeLockGewuenscht = false;

export async function displayWachHalten(an) {
  wakeLockGewuenscht = an;
  if (!('wakeLock' in navigator)) return;
  try {
    if (an && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!an && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  // Wake-Lock wird beim Tab-Wechsel freigegeben → bei Rückkehr neu anfordern
  if (document.visibilityState === 'visible' && wakeLockGewuenscht && !wakeLock) displayWachHalten(true);
});

// ---------------------------------------------------------------------------
// Gesten unterdrücken: kein Pinch-Zoom, kein Doppeltipp-Zoom, kein Kontextmenü, kein Markieren

export function gestenUnterdruecken() {
  const nichtEingabe = (e) => !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement);
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 || (nichtEingabe(e) && !e.target.closest?.('.scrollbar'))) e.preventDefault();
  }, { passive: false });
  let letzterTipp = 0;
  document.addEventListener('touchend', (e) => {
    const jetzt = Date.now();
    if (jetzt - letzterTipp < 320 && nichtEingabe(e) && !e.target.closest?.('button, .knopf, input, label')) e.preventDefault();
    letzterTipp = jetzt;
  }, { passive: false });
  document.addEventListener('contextmenu', (e) => { if (nichtEingabe(e)) e.preventDefault(); });
  document.addEventListener('selectstart', (e) => { if (nichtEingabe(e)) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => e.preventDefault());
  // Strg+Mausrad-Zoom am Desktop verhindern
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
}

/** Kurze Vibration (wo unterstützt, z. B. nicht auf dem iPhone). */
export function vibrieren(muster) {
  try {
    if (navigator.vibrate) navigator.vibrate(muster);
  } catch { /* nicht unterstützt */ }
}
