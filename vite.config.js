// Vite-Konfiguration für DRIFTKÖNIG.
// - Client liegt in /client, Build landet in /dist.
// - /shared wird per relativem Pfad importiert (gleicher Code für Client, Server und Tests).
// - Ein kleines eigenes Plugin erzeugt beim Build den Service Worker mit
//   versioniertem Cache (Build-Hash) und vollständiger Dateiliste.
import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const wurzel = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PORT = Number(process.env.SERVER_PORT || 3000);

/** Erzeugt dist/sw.js aus client/sw-vorlage.js mit Build-Hash und Dateiliste. */
function serviceWorkerPlugin() {
  return {
    name: 'driftkoenig-service-worker',
    apply: 'build',
    generateBundle(_optionen, bundle) {
      const dateien = Object.keys(bundle)
        .filter((n) => !n.endsWith('.map'))
        .map((n) => './' + n.replace(/\\/g, '/'));
      // Öffentliche Dateien (manifest, Icons) zusätzlich aufnehmen
      dateien.push('./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg');
      const eindeutig = [...new Set(dateien)].sort();
      const hash = createHash('sha256').update(eindeutig.join('|')).digest('hex').slice(0, 12);
      const vorlage = readFileSync(path.join(wurzel, 'client', 'sw-vorlage.js'), 'utf8');
      const quelle = vorlage
        .replace('__VERSION__', JSON.stringify(hash))
        .replace('__DATEIEN__', JSON.stringify(eindeutig));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: quelle });
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: hash }) });
    }
  };
}

export default defineConfig({
  root: path.join(wurzel, 'client'),
  publicDir: path.join(wurzel, 'client', 'public'),
  base: './',
  build: {
    outDir: path.join(wurzel, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 0
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    fs: { allow: [wurzel] },
    proxy: {
      '/ws': { target: `ws://localhost:${SERVER_PORT}`, ws: true },
      '/healthz': { target: `http://localhost:${SERVER_PORT}` }
    }
  },
  plugins: [serviceWorkerPlugin()]
});
