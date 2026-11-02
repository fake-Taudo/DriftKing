// Performance-Messung: startet den Produktionsserver, öffnet das Spiel in Edge/Chrome (playwright-core),
// misst FPS und Draw Calls je Strecke ohne und mit CPU-Drosselung (4× und 6×) sowie den Speicher
// bei wiederholtem Streckenwechsel. Ergebnis als Markdown auf der Konsole (für docs/PERFORMANCE.md).
// Voraussetzung: npm run build. Aufruf: node scripts/performance.js [--sichtbar]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3456;
const sichtbar = process.argv.includes('--sichtbar');

function browserPfad() {
  const kandidaten = [
    process.env.BROWSER_PFAD,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ].filter(Boolean);
  const core = 'C:/Program Files (x86)/Microsoft/EdgeCore';
  if (existsSync(core)) {
    for (const v of readdirSync(core).sort().reverse()) kandidaten.push(`${core}/${v}/msedge.exe`);
  }
  return kandidaten.find((k) => existsSync(k));
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

async function messen(seite, sekunden) {
  return seite.evaluate(async (s) => {
    const sp = window.__driftkoenig;
    const proben = [];
    let drawMax = 0;
    const start = performance.now();
    let frames = 0;
    await new Promise((fertig) => {
      const f = () => {
        frames++;
        drawMax = Math.max(drawMax, sp.renderer.drawCalls);
        if (performance.now() - start < s * 1000) requestAnimationFrame(f);
        else fertig();
      };
      requestAnimationFrame(f);
    });
    proben.push(frames / ((performance.now() - start) / 1000));
    return { fps: proben[0], drawCalls: drawMax, qualitaet: sp.qualitaet.aktuell.id };
  }, sekunden);
}

const server = spawn(process.execPath, ['server/index.js'], { cwd: wurzel, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
try {
  await warte(1200);
  const exe = browserPfad();
  if (!exe) throw new Error('Kein Chrome/Edge gefunden (BROWSER_PFAD setzen).');
  const browser = await chromium.launch({
    executablePath: exe,
    headless: !sichtbar,
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
  });
  const ergebnisse = [];
  const profile = process.argv.includes('--nurSpeicher') ? [] : [
    { name: 'Desktop 1280×720', viewport: { width: 1280, height: 720 }, dpr: 1, mobil: false },
    { name: 'Handy 390×844 (DPR 3)', viewport: { width: 844, height: 390 }, dpr: 3, mobil: true }
  ];
  for (const profil of profile) {
    const kontext = await browser.newContext({ viewport: profil.viewport, deviceScaleFactor: profil.dpr, isMobile: profil.mobil, hasTouch: profil.mobil });
    const seite = await kontext.newPage();
    const cdp = await kontext.newCDPSession(seite);
    for (const strecke of ['industriehof', 'kuestenpass', 'neonhafen']) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await seite.goto(`http://127.0.0.1:${PORT}/?perf=1&strecke=${strecke}`);
      await seite.waitForFunction(() => window.__driftkoenig?.modus?.S, null, { timeout: 30000 });
      await warte(2500);
      const gpu = await seite.evaluate(() => {
        const gl = window.__driftkoenig.renderer.renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      });
      for (const rate of profil.mobil ? [4, 6] : [1, 4, 6]) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        await warte(1500);
        const m = await messen(seite, 6);
        ergebnisse.push({ profil: profil.name, strecke, rate, ...m, gpu });
        console.error(`${profil.name} ${strecke} ${rate}×: ${m.fps.toFixed(1)} FPS, ${m.drawCalls} Draw Calls, Qualität ${m.qualitaet}`);
      }
    }
    await kontext.close();
  }

  // Speicher bei wiederholtem Streckenwechsel
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const seite = await kontext.newPage();
  const cdp = await kontext.newCDPSession(seite);
  await seite.goto(`http://127.0.0.1:${PORT}/?perf=1&strecke=industriehof`);
  await seite.waitForFunction(() => window.__driftkoenig?.modus?.S, null, { timeout: 30000 });
  await warte(1500);
  const speicher = [];
  const reihenfolge = ['kuestenpass', 'neonhafen', 'industriehof', 'kuestenpass', 'neonhafen', 'industriehof', 'kuestenpass', 'neonhafen', 'industriehof'];
  for (const [i, strecke] of reihenfolge.entries()) {
    await seite.evaluate(async (id) => {
      const sp = window.__driftkoenig;
      const Klasse = sp.modus.constructor;
      await sp.wechsleModus(new Klasse({ ...sp.modus.konfig, streckeId: id }));
    }, strecke);
    await warte(1500);
    await cdp.send('HeapProfiler.collectGarbage');
    await warte(300);
    const m = await seite.evaluate(() => {
      const info = window.__driftkoenig.renderer.renderer.info.memory;
      return { geometrien: info.geometries, texturen: info.textures, heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null };
    });
    speicher.push({ i: i + 1, strecke, ...m });
  }
  await browser.close();

  console.log(`GPU: ${ergebnisse[0]?.gpu}\n`);
  console.log('| Profil | Strecke | CPU-Drosselung | FPS | Draw Calls (max.) | Qualität (Automatik) |');
  console.log('|---|---|---|---|---|---|');
  for (const e of ergebnisse) console.log(`| ${e.profil} | ${e.strecke} | ${e.rate}× | ${e.fps.toFixed(1)} | ${e.drawCalls} | ${e.qualitaet} |`);
  console.log('\n| Wechsel | Strecke | Geometrien | Texturen | JS-Heap (MB) |');
  console.log('|---|---|---|---|---|');
  for (const s of speicher) console.log(`| ${s.i} | ${s.strecke} | ${s.geometrien} | ${s.texturen} | ${s.heapMB?.toFixed(1)} |`);
} finally {
  server.kill();
}
