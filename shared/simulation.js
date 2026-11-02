// Headless-Simulation (für Tests, Kalibrierung und Referenzwerte): ein oder zwei Bot-Fahrzeuge auf
// einer Strecke, gleiche Physik, Rundenlogik und Wertung wie im Spiel.
import { Fahrzeug, autoKontakt } from './physik/fahrzeug.js';
import { effektiveParameter } from './tuning.js';
import { BotFahrer } from './bots/botFahrer.js';
import { botStufe } from './bots/botStufen.js';
import { Rundenzaehler, zuruecksetzPosition } from './rundenLogik.js';
import { HaengerErkennung } from './physik/haenger.js';
import { PHYSIK } from './physikParameter.js';
import { Wertung, verfolgerEndpunkte } from './wertung.js';
import { WERTUNG } from './wertungsParameter.js';

const DT = PHYSIK.dt;
const TICK_SCHRITTE = Math.round(1 / WERTUNG.tickRate / DT); // 3 Physik-Schritte pro Wertungs-Tick

function botAuto(S, { autoId = 'kestrel_s', stufe = 'legende', seed = 1, modus = 'drift', rolle = 'einzel', regler, auslassen } = {}) {
  const f = new Fahrzeug(effektiveParameter(autoId), { gegenlenken: 0.6, driftHalten: 0, getriebe: 'auto' });
  const bot = new BotFahrer(S, f, botStufe(stufe), { seed, rolle, modus, regler, auslassen });
  return { f, bot, autoId };
}

/**
 * Lässt einen Bot eine Runde fahren (ohne Wertung).
 * @returns {{fertig:boolean, zeit:number, wandkontakte:number, resets:number}}
 */
export function botRunde(S, { autoId = 'kestrel_s', stufe = 'legende', modus = 'drift', seed = 1, maxZeit, beiSchritt, regler } = {}) {
  const { f, bot } = botAuto(S, { autoId, stufe, seed, modus, regler });
  const st = S.start.einzel;
  f.setzen(st.x, st.y, st.theta, 50 / 3.6);
  const runden = new Rundenzaehler(S, st);
  const haenger = new HaengerErkennung();
  let zeit = 0, wand = 0, resets = 0;
  const grenze = maxZeit ?? S.zeitLimit * 1.6;
  while (zeit < grenze) {
    const e = bot.schritt(DT);
    f.schritt(e, DT, S.gitter);
    zeit += DT;
    for (const ev of f.ereignisse) if (ev.art === 'wand' && ev.staerke > 1.5) wand++;
    const evs = runden.aktualisieren(f.z.x, f.z.y, zeit, DT);
    if (beiSchritt) beiSchritt(f, bot, zeit, evs);
    if (evs.some((x) => x.art === 'runde')) return { fertig: true, zeit: runden.rundenZeiten[0] ?? zeit, wandkontakte: wand, resets };
    const h = haenger.aktualisieren(f.tempo, DT);
    if (h.automatisch) {
      const r = zuruecksetzPosition(S, f.z.x, f.z.y, bot.hinweis);
      f.setzen(r.x, r.y, r.theta, 8);
      haenger.zuruecksetzen();
      resets++;
    }
  }
  return { fertig: false, zeit, wandkontakte: wand, resets };
}

/**
 * Simuliert einen Durchgang (eine Runde) mit Wertung: Führer allein oder Führer + Verfolger.
 * Fliegender Start wie im Spiel; Wertung startet beim Überfahren der Startlinie.
 * @param {object} S Laufzeit-Strecke
 * @param {{fuehrer: object, verfolger?: object|null, referenz?: {fuehrer?:number, verfolger?:number}}} o
 * @returns {{fuehrer: object, verfolger: object|null, zeit: number, fertig: boolean}}
 */
export function durchgangSimulieren(S, { fuehrer, verfolger = null, referenz = {} }) {
  const A = botAuto(S, { ...fuehrer, rolle: verfolger ? 'fuehrer' : 'einzel' });
  const B = verfolger ? botAuto(S, { ...verfolger, rolle: 'verfolger' }) : null;
  const sA = S.start.fuehrer, sB = S.start.verfolger;
  A.f.setzen(sA.x, sA.y, sA.theta, 50 / 3.6);
  if (B) {
    B.f.setzen(sB.x, sB.y, sB.theta, 50 / 3.6);
    B.bot.setzeGegner(A.f);
  }
  const abA = effektiveParameter(A.autoId).abmessungen;
  const abB = B ? effektiveParameter(B.autoId).abmessungen : null;
  const wA = new Wertung(S, verfolger ? 'fuehrer' : 'einzel', { abmessungen: abA, gegnerAbmessungen: abB, referenz: referenz.fuehrer });
  const wB = B ? new Wertung(S, 'verfolger', { abmessungen: abB, gegnerAbmessungen: abA, referenz: referenz.verfolger }) : null;
  const rA = new Rundenzaehler(S, sA);
  const hA = new HaengerErkennung();
  const hB = new HaengerErkennung();
  let zeit = 0, schritt = 0, wertungsZeit = null, fertig = false;
  let resetA = false, resetB = false;
  const grenze = S.zeitLimit * 1.15 + 10;
  while (zeit < grenze) {
    A.f.schritt(A.bot.schritt(DT), DT, S.gitter);
    if (B) {
      B.f.schritt(B.bot.schritt(DT), DT, S.gitter);
      autoKontakt(A.f, B.f);
    }
    zeit += DT;
    schritt++;
    const ev = rA.aktualisieren(A.f.z.x, A.f.z.y, zeit, DT);
    if (wertungsZeit === null && ev.some((e) => e.art === 'start')) {
      wertungsZeit = zeit;
      wA.zuruecksetzen(0);
      wB?.zuruecksetzen(0);
    }
    if (ev.some((e) => e.art === 'runde')) { fertig = true; break; }
    if (wertungsZeit !== null && zeit - wertungsZeit > S.zeitLimit) break;
    // Hänger
    if (hA.aktualisieren(A.f.tempo, DT).automatisch) {
      const r = zuruecksetzPosition(S, A.f.z.x, A.f.z.y, A.bot.hinweis);
      A.f.setzen(r.x, r.y, r.theta, 8); hA.zuruecksetzen(); resetA = true;
    }
    if (B && hB.aktualisieren(B.f.tempo, DT).automatisch) {
      const r = zuruecksetzPosition(S, B.f.z.x, B.f.z.y, B.bot.hinweis);
      B.f.setzen(r.x, r.y, r.theta, 8); hB.zuruecksetzen(); resetB = true;
    }
    // Wertung mit 20 Ticks pro Sekunde
    if (wertungsZeit !== null && schritt % TICK_SCHRITTE === 0) {
      const t = zeit - wertungsZeit;
      const zA = { ...A.f.momentaufnahme(), zurueckgesetzt: resetA };
      const zB = B ? { ...B.f.momentaufnahme(), zurueckgesetzt: resetB } : null;
      wA.tick(zA, zB, t);
      if (wB) wB.tick(zB, zA, t);
      resetA = resetB = false;
    }
  }
  const fA = wA.aufschluesselung();
  const fB = wB ? wB.aufschluesselung() : null;
  if (fB) fB.endpunkte = verfolgerEndpunkte(fB.punkte, fA.punkte);
  return { fuehrer: fA, verfolger: fB, zeit: wertungsZeit !== null ? zeit - wertungsZeit : zeit, fertig };
}

export { autoKontakt };
