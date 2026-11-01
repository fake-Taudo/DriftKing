// Einstiegspunkt des Clients: Fehlerbehandlung, WebGL-Prüfung, Spielstart.
import './styles/haupt.css';
import './styles/steuerung.css';
import { installiereFehlerbehandlung, zeigeFehlerbildschirm } from './core/fehler.js';
import { pruefeWebGL2 } from './core/geraet.js';
import { t } from './i18n/de.js';

installiereFehlerbehandlung();

async function starten() {
  if (!pruefeWebGL2()) {
    zeigeFehlerbildschirm(null, t('fehler.webglTitel'), t('fehler.webglText'));
    return;
  }
  // Spiel-Code erst nach erfolgreicher Prüfung laden (kleinerer Start, saubere Fehlermeldung)
  const { Spiel } = await import('./spiel.js');
  const { startModusErzeugen } = await import('./modi/start.js');
  const spiel = new Spiel();
  window.__driftkoenig = spiel; // für Tests/Debugging
  await spiel.start({ startModus: startModusErzeugen() });
}

starten();
