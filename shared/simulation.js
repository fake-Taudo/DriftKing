// Headless-Simulation einer Runde (für Tests, Kalibrierung und Referenzwerte):
// ein oder zwei Bot-Fahrzeuge auf einer Strecke, gleiche Physik und Rundenlogik wie im Spiel.
import { Fahrzeug, autoKontakt } from './physik/fahrzeug.js';
import { effektiveParameter } from './tuning.js';
import { BotFahrer } from './bots/botFahrer.js';
import { botStufe } from './bots/botStufen.js';
import { Rundenzaehler, zuruecksetzPosition } from './rundenLogik.js';
import { HaengerErkennung } from './physik/haenger.js';
import { PHYSIK } from './physikParameter.js';

const DT = PHYSIK.dt;

/**
 * Lässt einen Bot eine Runde fahren.
 * @returns {{fertig:boolean, zeit:number, wandkontakte:number, resets:number, verlauf?:Array}}
 */
export function botRunde(S, { autoId = 'kestrel_s', stufe = 'legende', modus = 'drift', seed = 1, maxZeit, beiSchritt } = {}) {
  const f = new Fahrzeug(effektiveParameter(autoId), { gegenlenken: 0.6, driftHalten: 0, getriebe: 'auto' });
  const st = S.start.einzel;
  f.setzen(st.x, st.y, st.theta, 50 / 3.6);
  const bot = new BotFahrer(S, f, botStufe(stufe), { seed, rolle: 'einzel', modus });
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

export { autoKontakt };
