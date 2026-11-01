// Express-App: Sicherheits-Header, Health-Check und Auslieferung des Vite-Builds (dist/).
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = path.join(wurzel, 'dist');

/** Content-Security-Policy ohne Inline-Skripte. WebSocket nur zum eigenen Host. */
function csp(host) {
  const ws = host ? ` ws://${host} wss://${host}` : '';
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${ws}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join('; ');
}

/** Host-Header nur übernehmen, wenn er harmlos aussieht (kein Header-Injection). */
function sichererHost(h) {
  return typeof h === 'string' && /^[A-Za-z0-9.\-:\[\]]{1,255}$/.test(h) ? h : '';
}

export function erzeugeApp({ statusInfo = () => ({}) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', csp(sichererHost(req.headers.host)));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'accelerometer=(self), gyroscope=(self), fullscreen=(self), screen-wake-lock=(self), camera=(), microphone=(), geolocation=()');
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, laufzeit: Math.round(process.uptime()), ...statusInfo() });
  });

  if (existsSync(DIST)) {
    // Gehashte Build-Dateien dürfen lange gecacht werden, Einstiegsdateien nie.
    app.use(
      express.static(DIST, {
        index: 'index.html',
        setHeaders(res, datei) {
          const name = path.basename(datei);
          if (/^(index\.html|sw\.js|version\.json|manifest\.webmanifest)$/.test(name)) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (datei.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=3600');
          }
          if (name === 'manifest.webmanifest') res.setHeader('Content-Type', 'application/manifest+json');
        }
      })
    );
  } else {
    app.get('/', (_req, res) => {
      res.type('text/plain; charset=utf-8').send('DRIFTKÖNIG-Server läuft. Kein Build gefunden – bitte "npm run build" ausführen oder "npm run dev" für die Entwicklung nutzen.');
    });
  }

  app.use((_req, res) => {
    res.status(404).type('text/plain; charset=utf-8').send('Nicht gefunden');
  });

  return app;
}
