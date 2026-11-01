// Entwicklungsstart: Server (mit Neuladen per --watch) und Vite-Dev-Server parallel.
// Bewusst ohne Zusatzpaket (concurrently o. ä.), damit die Abhängigkeiten klein bleiben.
// Ports: Vite auf PORT (Standard 5173), Spielserver auf SERVER_PORT (Standard 3000).
// Vite leitet /ws und /healthz an den Spielserver weiter.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITE_PORT = String(process.env.PORT || 5173);
const SERVER_PORT = String(process.env.SERVER_PORT || 3000);
const kinder = [];

function starte(name, befehl, argumente, farbe, env) {
  const kind = spawn(befehl, argumente, {
    cwd: wurzel,
    shell: process.platform === 'win32',
    env: { ...process.env, NODE_ENV: 'development', ...env }
  });
  const praefix = `\x1b[${farbe}m[${name}]\x1b[0m `;
  const ausgeben = (strom) => (daten) => {
    for (const zeile of daten.toString().split(/\r?\n/)) {
      if (zeile.trim()) strom.write(praefix + zeile + '\n');
    }
  };
  kind.stdout.on('data', ausgeben(process.stdout));
  kind.stderr.on('data', ausgeben(process.stderr));
  kind.on('exit', (code) => {
    process.stdout.write(`${praefix}beendet (Code ${code})\n`);
  });
  kinder.push(kind);
}

starte('server', 'node', ['--watch-path=server', '--watch-path=shared', 'server/index.js'], '36', { PORT: SERVER_PORT });
starte('vite', 'npx', ['vite', '--port', VITE_PORT, '--strictPort'], '35', { SERVER_PORT });

function beenden() {
  for (const k of kinder) {
    try { k.kill(); } catch { /* bereits beendet */ }
  }
  process.exit(0);
}
process.on('SIGINT', beenden);
process.on('SIGTERM', beenden);
