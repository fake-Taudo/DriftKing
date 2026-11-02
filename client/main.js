// Einstiegspunkt des Clients: Fehlerbehandlung, WebGL-Prüfung, Ladebildschirm, Spielstart.
import './styles/haupt.css';
import './styles/steuerung.css';
import './styles/hud.css';
import './styles/menue.css';
import './styles/garage.css';
import { installiereFehlerbehandlung, zeigeFehlerbildschirm } from './core/fehler.js';
import { pruefeWebGL2 } from './core/geraet.js';
import { t, TEXTE } from './i18n/de.js';

installiereFehlerbehandlung();

const ladeBalken = document.getElementById('lade-fortschritt');
const ladeTipp = document.getElementById('lade-tipp');
const tipps = TEXTE.laden.tipps;
ladeTipp.textContent = tipps[Math.floor(Math.random() * tipps.length)];
function fortschritt(anteil) {
  ladeBalken.style.width = Math.round(anteil * 100) + '%';
}

async function starten() {
  fortschritt(0.1);
  if (!pruefeWebGL2()) {
    zeigeFehlerbildschirm(null, t('fehler.webglTitel'), t('fehler.webglText'));
    return;
  }
  // Spiel-Code erst nach erfolgreicher Prüfung laden (kleinerer Start, saubere Fehlermeldung)
  const { Spiel } = await import('./spiel.js');
  fortschritt(0.45);
  const { startModusErzeugen } = await import('./modi/start.js');
  fortschritt(0.65);
  // Schriften für Menüs und Aufkleber bereitstellen
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  } catch { /* Schriften optional */ }
  fortschritt(0.8);
  const spiel = new Spiel();
  window.__driftkoenig = spiel; // für Tests/Debugging
  await spiel.start({ startModus: () => startModusErzeugen(spiel) });
  fortschritt(1);
  const lade = document.getElementById('lade');
  lade.style.transition = 'opacity 350ms';
  lade.style.opacity = '0';
  setTimeout(() => lade.remove(), 380);
}

starten();
