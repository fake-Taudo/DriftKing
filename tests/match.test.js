// Duell-Ablauf auf dem Server ohne Netzwerk, mit simulierter Zeit: ganze Duelle mit echten Bots (auch mit Latenz
// und Paketverlust), Rollentausch, Gleichstand, Plausibilität, AFK, Abbruch und Belohnung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../server/match.js';
import { baueStrecke } from '../shared/strecken/streckenBau.js';
import { streckenDef } from '../shared/strecken/index.js';
import { Fahrzeug } from '../shared/physik/fahrzeug.js';
import { effektiveParameter } from '../shared/tuning.js';
import { BotFahrer } from '../shared/bots/botFahrer.js';
import { botStufe } from '../shared/bots/botStufen.js';
import { HaengerErkennung } from '../shared/physik/haenger.js';
import { zuruecksetzPosition } from '../shared/rundenLogik.js';
import { zustandPacken, FLAG, mitResetZaehler, ONLINE_SIEG, ONLINE_NIEDERLAGE } from '../shared/netzwerkSchema.js';
import { Zufall } from '../shared/zufall.js';
import { Interpolator } from '../shared/interpolator.js';

const S = baueStrecke(streckenDef('industriehof'));
const DT = 1 / 60;

/**
 * Spielt ein Duell mit zwei Bots durch. Jeder „Client“ fährt sein Auto selbst und meldet 25-mal pro Sekunde.
 */
function duell({ format = 'schnell', seed = 1, latenz = 0, schwankung = 0, verlust = 0, maxZeit = 800, stufe = 'meister', eingriff = null }) {
  const nachrichten = { A: [], B: [] };
  const z = new Zufall(seed + 77);
  const seiten = {};
  for (const s of ['A', 'B']) {
    const f = new Fahrzeug(effektiveParameter('vireo_turbo'), { gegenlenken: 0.6, driftHalten: 0, getriebe: 'auto' });
    seiten[s] = { f, bot: null, seq: 0, sendenBis: 0, haenger: new HaengerErkennung(), reset: false, faehrt: false };
  }
  let ende = null;
  const m = new Match({
    S, format, seed, jetzt: 0,
    spieler: { A: { autoId: 'vireo_turbo' }, B: { autoId: 'vireo_turbo' } },
    senden: (s, n) => {
      nachrichten[s].push(n);
      if (n.t === 'startCountdown') {
        const c = seiten[s];
        const st = n.rolle === 'fuehrer' ? S.start.fuehrer : S.start.verfolger;
        c.f.setzen(st.x, st.y, st.theta, 0);
        c.haenger.zuruecksetzen();
        c.start = n.startZeit;
        c.bot = new BotFahrer(S, c.f, botStufe(stufe), { seed: `${seed}${s}${n.laufIndex}${n.durchgangNr}`, rolle: n.rolle });
        c.rolle = n.rolle;
        c.faehrt = false;
        c.reset = true;
        const andere = s === 'A' ? 'B' : 'A';
        if (n.rolle === 'verfolger') c.bot.setzeGegner(seiten[andere].f);
      }
    },
    beiEnde: (e) => { ende = e; }
  });
  eingriff?.(m);
  const unterwegs = [];
  let t = 0;
  let naechsterTick = 0;
  while (!ende && t < maxZeit * 1000) {
    t += DT * 1000;
    for (const s of ['A', 'B']) {
      const c = seiten[s];
      const andere = s === 'A' ? 'B' : 'A';
      if (c.bot && t >= c.start) {
        const e = c.bot.schritt(DT);
        c.f.schritt(e, DT, S.gitter);
        c.letzte = e;
        const h = c.haenger.aktualisieren(c.f.tempo, DT);
        if (h.automatisch) {
          const r = zuruecksetzPosition(S, c.f.z.x, c.f.z.y, c.bot.hinweis);
          c.f.setzen(r.x, r.y, r.theta, 8);
          c.haenger.zuruecksetzen();
          c.reset = true;
        }
        if (seiten[andere].bot) void 0;
      }
      if (t >= c.sendenBis) {
        c.sendenBis = t + 40;
        const e = c.letzte || {};
        const flags = (e.gas > 0.02 ? FLAG.GAS : 0) | (e.bremse > 0.02 ? FLAG.BREMSE : 0) | (e.handbremse ? FLAG.HANDBREMSE : 0) | (Math.abs(e.lenken || 0) > 0.02 ? FLAG.LENKEN : 0);
        if (c.reset) c.resets = (c.resets || 0) + 1;
        c.reset = false;
        const d = zustandPacken(++c.seq, c.f.momentaufnahme(), mitResetZaehler(flags, c.resets || 0));
        if (!z.chance(verlust)) unterwegs.push({ an: t + latenz + z.bereich(0, schwankung), s, d });
      }
    }
    unterwegs.sort((a, b) => a.an - b.an);
    while (unterwegs.length && unterwegs[0].an <= t) {
      const p = unterwegs.shift();
      m.zustandEmpfangen(p.s, p.d, t);
    }
    if (t >= naechsterTick) {
      naechsterTick = t + 50;
      m.tick(t);
    }
  }
  return { m, ende, nachrichten, t };
}

test('Ganzes Duell (Schnell) mit Rollentausch, Punkten und regulärer Belohnung', () => {
  const { ende, nachrichten, m } = duell({ seed: 3 });
  assert.ok(ende, 'Duell endet');
  assert.equal(ende.regulaer, true);
  assert.ok(['A', 'B'].includes(ende.sieger));
  assert.equal(m.durchgaenge, 2, 'zwei Durchgänge');
  const rollenA = nachrichten.A.filter((n) => n.t === 'startCountdown').map((n) => n.rolle);
  const rollenB = nachrichten.B.filter((n) => n.t === 'startCountdown').map((n) => n.rolle);
  assert.equal(rollenA.length, 2);
  assert.notEqual(rollenA[0], rollenA[1], 'Rollentausch');
  assert.notEqual(rollenA[0], rollenB[0], 'immer eine Rolle je Spieler');
  assert.ok(ende.fahrzeit >= 90, `Fahrzeit ${ende.fahrzeit}`);
  const verlierer = ende.sieger === 'A' ? 'B' : 'A';
  assert.equal(ende.belohnung[ende.sieger], ONLINE_SIEG);
  assert.equal(ende.belohnung[verlierer], ONLINE_NIEDERLAGE);
  assert.ok(nachrichten.A.some((n) => n.t === 'punkte' && n.du > 0), 'Punktestand kommt beim Client an');
  assert.ok(nachrichten.A.some((n) => n.t === 'gegner'), 'Gegner-Zustände werden weitergeleitet');
  const dg = nachrichten.A.filter((n) => n.t === 'durchgangEnde');
  assert.equal(dg.length, 2);
  assert.equal(dg[1].laufEnde, true);
  assert.equal(dg[1].battleEnde, true);
});

test('Die Wertung ist bei 200 ms Latenz und 5 % Paketverlust stabil: Duell läuft durch, kaum verworfene Zustände', () => {
  const sauber = duell({ seed: 5 });
  const schlecht = duell({ seed: 5, latenz: 200, schwankung: 40, verlust: 0.05 });
  assert.ok(schlecht.ende, 'Duell endet');
  assert.equal(schlecht.ende.regulaer, true);
  assert.equal(schlecht.m.verstoesse.A + schlecht.m.verstoesse.B <= 5, true, `Verstöße ${schlecht.m.verstoesse.A}/${schlecht.m.verstoesse.B}`);
  // Fahrzeit: Lücken über 200 ms sind bei 5 % Verlust selten, die Wertung läuft fast durchgehend
  assert.ok(schlecht.ende.fahrzeit >= sauber.ende.fahrzeit * 0.85, `${schlecht.ende.fahrzeit} gegen ${sauber.ende.fahrzeit}`);
});

test('Gleichstand: Der Lauf wird mit neuer Startrolle wiederholt und zählt nicht', () => {
  const { nachrichten, ende } = duell({
    seed: 9,
    eingriff: (m) => {
      const echt = m.ablauf.durchgangEintragen.bind(m.ablauf);
      let n = 0;
      m.ablauf.durchgangEintragen = (e) => (n++ < 2 ? echt({ fuehrerPunkte: 50, verfolgerNorm: 50 }) : echt(e));
    }
  });
  assert.ok(ende);
  const starts = nachrichten.A.filter((n) => n.t === 'startCountdown');
  assert.equal(starts.length, 4, 'Wiederholung bringt zwei weitere Durchgänge');
  assert.equal(starts[2].wiederholung, true);
  assert.equal(nachrichten.A.filter((n) => n.t === 'durchgangEnde')[1].lauf.gleichstand, true);
});

// Kleine Hilfe für gezielte Prüfungen
function leeresMatch() {
  const nachrichten = { A: [], B: [] };
  let ende = null;
  const m = new Match({
    S, format: 'schnell', seed: 1, jetzt: 0,
    spieler: { A: { autoId: 'kestrel_s' }, B: { autoId: 'kestrel_s' } },
    senden: (s, n) => nachrichten[s].push(n),
    beiEnde: (e) => { ende = e; }
  });
  return { m, nachrichten, ende: () => ende };
}
const st = S.start.fuehrer;
const packen = (seq, o = {}) => [seq, o.x ?? st.x, o.y ?? st.y, o.theta ?? st.theta, o.vx ?? 10, o.vy ?? 0, 0, o.flags ?? FLAG.GAS];

test('Plausibilität: Teleport, Überschall und Sprung ins Gelände werden verworfen, ohne den Gegner zu erreichen', () => {
  const { m, nachrichten } = leeresMatch();
  assert.equal(m.zustandEmpfangen('A', packen(1), 100), true);
  const weitergeleitet = () => nachrichten.B.filter((n) => n.t === 'gegner').length;
  assert.equal(weitergeleitet(), 1);
  assert.equal(m.zustandEmpfangen('A', packen(2, { x: st.x + 200 }), 140), false, 'Teleport');
  assert.equal(m.zustandEmpfangen('A', packen(3, { vx: 500 }), 180), false, 'zu schnell');
  assert.equal(m.zustandEmpfangen('A', packen(4, { vx: 60 }), 220), false, 'unmögliche Beschleunigung');
  assert.equal(m.zustandEmpfangen('A', packen(5, { x: 99999, y: 99999, flags: mitResetZaehler(FLAG.GAS, 1) }), 260), false, 'weit neben der Strecke, auch beim Zurücksetzen');
  assert.equal(weitergeleitet(), 1);
  assert.equal(m.zustandEmpfangen('A', packen(6, { x: st.x + 30, flags: mitResetZaehler(FLAG.GAS, 1) }), 300), true, 'Zurücksetzen darf springen');
  assert.equal(m.zustandEmpfangen('A', packen(6, { x: st.x + 30 }), 340), false, 'verspätete Sequenz');
});

test('Zurücksetzen aus dem Stand ist kein Regelverstoß, auch nicht mehrfach und nicht bei Paketverlust', () => {
  const { m, ende } = leeresMatch();
  const start = m.startZeit;
  m.tick(start);
  let seq = 0, t = start;
  const senden = (o) => {
    t += 40;
    return m.zustandEmpfangen('A', packen(++seq, o), t);
  };
  senden({ vx: 0 });
  for (let i = 1; i <= 8; i++) {
    // Das Auto steckt fest, wird versetzt und hat sofort wieder 6 m/s (wie spielerZuruecksetzen)
    // Zwischen zwei Punkten auf der Strecke: Der Sprung von 25 m wäre ohne Zurücksetzen ein Teleport
    const x0 = st.x + (i % 2) * 25;
    const flags = mitResetZaehler(FLAG.GAS, i);
    assert.equal(senden({ x: x0, vx: 6, flags }), true, `Zurücksetzen ${i} wird angenommen`);
    for (let k = 0; k < 5; k++) senden({ x: x0 + (k + 1) * 0.24, vx: 6, flags });
    senden({ x: x0 + 1.3, vx: 0, flags });
  }
  assert.equal(m.verstoesse.A, 0, 'keine Verstöße');
  assert.equal(ende(), null, 'Das Duell läuft weiter');

  // Das Paket mit dem Sprung geht verloren: Das nächste trägt den Zähler weiter
  const b = leeresMatch();
  assert.equal(b.m.zustandEmpfangen('A', packen(1, { vx: 0 }), 100), true);
  assert.equal(b.m.zustandEmpfangen('A', packen(3, { x: st.x + 40, vx: 6, flags: mitResetZaehler(FLAG.GAS, 1) }), 180), true, 'Folgepaket genügt');
  assert.equal(b.m.verstoesse.A, 0);
  // Ohne geänderten Zähler bleibt derselbe Sprung verboten
  assert.equal(b.m.zustandEmpfangen('A', packen(4, { x: st.x + 90, vx: 6, flags: mitResetZaehler(FLAG.GAS, 1) }), 220), false);
});

test('Der Abzug fürs Zurücksetzen fällt genau einmal an, und der Zähler allein ist keine Eingabe', () => {
  const { m } = leeresMatch();
  m.tick(m.startZeit);
  m.zustandEmpfangen('A', packen(1), m.startZeit + 40);
  m.laeuft = true;
  assert.equal(m.resetMerker.A, false);
  m.zustandEmpfangen('A', packen(2, { x: st.x + 30, flags: mitResetZaehler(FLAG.GAS, 1) }), m.startZeit + 80);
  assert.equal(m.resetMerker.A, true);
  m.resetMerker.A = false;
  m.zustandEmpfangen('A', packen(3, { x: st.x + 30.3, flags: mitResetZaehler(FLAG.GAS, 1) }), m.startZeit + 120);
  assert.equal(m.resetMerker.A, false, 'Gleicher Zähler: kein zweiter Abzug');
  const vorher = m.eingabeZeit.A;
  m.zustandEmpfangen('A', packen(4, { x: st.x + 30.6, flags: mitResetZaehler(0, 1) }), m.startZeit + 160);
  assert.equal(m.eingabeZeit.A, vorher, 'Nur der Zähler zählt nicht als Eingabe');
});

test('Dauerhafter Regelverstoß verliert das Duell', () => {
  const { m, ende } = leeresMatch();
  m.zustandEmpfangen('A', packen(1), 100);
  for (let i = 2; i < 60; i++) m.zustandEmpfangen('A', packen(i, { x: st.x + 500 }), 100 + i * 40);
  assert.equal(ende().grund, 'regelverstoss');
  assert.equal(ende().sieger, 'B');
});

test('AFK: Keine Eingaben über 20 s während eines Durchgangs verlieren das Duell', () => {
  const { m, ende } = leeresMatch();
  let t = 0;
  for (; t < 40000 && !ende(); t += 40) {
    const seq = Math.round(t / 40) + 1;
    m.zustandEmpfangen('A', packen(seq, { vx: 0, flags: 0 }), t);
    m.zustandEmpfangen('B', packen(seq, { vx: 5, flags: FLAG.GAS }), t);
    m.tick(t);
  }
  assert.ok(ende(), 'Duell endet');
  assert.equal(ende().grund, 'afk');
  assert.equal(ende().sieger, 'B');
  assert.ok(t < 30000, `nach ${t} ms`);
});

test('Meldelücken über 200 ms: Der Wertungs-Tick entfällt für beide', () => {
  const { m } = leeresMatch();
  m.tick(m.startZeit + 10);
  m._wertungStarten(m.startZeit + 10);
  let t = m.startZeit + 10;
  let seq = 1;
  const melden = () => {
    m.zustandEmpfangen('A', packen(seq, { vx: 15 }), t);
    m.zustandEmpfangen('B', packen(seq, { vx: 15 }), t);
    seq++;
  };
  for (let i = 0; i < 50; i++) {
    t += 40;
    melden();
    m.tick(t);
  }
  const mitMeldung = m.fahrzeit;
  assert.ok(mitMeldung > 1.5, `Fahrzeit ${mitMeldung}`);
  // Spieler A meldet 2 Sekunden nichts: keine Wertungs-Ticks für beide
  for (let i = 0; i < 50; i++) {
    t += 40;
    m.zustandEmpfangen('B', packen(seq++, { vx: 15 }), t);
    m.tick(t);
  }
  assert.ok(m.fahrzeit - mitMeldung < 0.4, `Fahrzeit stieg um ${m.fahrzeit - mitMeldung}`);
});

test('Belohnung: nur nach regulärem Ende voll; Abbruch halb für den Gewinner, und erst nach echter Fahrzeit', () => {
  const a = leeresMatch();
  a.m.aufgabe('A', 'verbindung', 1000);
  assert.equal(a.ende().sieger, 'B');
  assert.equal(a.ende().regulaer, false);
  assert.deepEqual(a.ende().belohnung, { A: 0, B: 0 }, 'ohne Fahrzeit keine Belohnung');
  const b = leeresMatch();
  b.m.fahrzeit = 45;
  b.m.aufgabe('B', 'verbindung', 1000);
  assert.deepEqual(b.ende().belohnung, { A: ONLINE_SIEG / 2, B: 0 });
  const c = leeresMatch();
  c.m.fahrzeit = 500;
  c.m.durchgaenge = 1;
  c.m.ablauf.sieger = 'A';
  c.m._beenden(1000);
  assert.deepEqual(c.ende().belohnung, { A: 0, B: 0 }, 'weniger als zwei Durchgänge');
  const d = leeresMatch();
  d.m.fahrzeit = 60;
  d.m.durchgaenge = 2;
  d.m.ablauf.sieger = 'A';
  d.m._beenden(1000);
  assert.deepEqual(d.ende().belohnung, { A: 0, B: 0 }, 'unter 90 Sekunden Fahrzeit');
});

test('Interpolator: liefert Zwischenwerte, begrenzt die Extrapolation, verträgt Verlust und Umordnung', () => {
  const ip = new Interpolator();
  assert.equal(ip.abfragen(0), null);
  const z = (seq, x, theta = 0) => ({ seq, x, y: 0, theta, vx: 25, vy: 0, r: 0, flags: 0 });
  ip.hinzufuegen(z(1, 0), 1000);
  ip.hinzufuegen(z(3, 2), 1080); // Paket 2 fehlt zunächst
  ip.hinzufuegen(z(2, 1), 1040); // … und kommt verspätet
  assert.deepEqual(ip.puffer.map((e) => e.z.seq), [1, 2, 3]);
  ip.hinzufuegen(z(2, 1), 1040);
  assert.equal(ip.puffer.length, 3, 'Doppelte werden verworfen');
  const neu = new Interpolator();
  neu.hinzufuegen(z(1, 0), 1000);
  neu.hinzufuegen(z(2, 10), 1100);
  assert.ok(Math.abs(neu.abfragen(1050).x - 5) < 1e-6, 'Mitte zwischen zwei Zuständen');
  // Weit hinter dem letzten Zustand: höchstens 0,25 s weiterrechnen
  const spaet = new Interpolator();
  spaet.hinzufuegen(z(1, 0), 1000);
  assert.ok(Math.abs(spaet.abfragen(9000).x - 25 * 0.25) < 1e-6);
  // Winkel über die ±180°-Grenze: kurzer Weg
  const w = new Interpolator();
  w.hinzufuegen(z(1, 0, 3.1), 1000);
  w.hinzufuegen(z(2, 0, -3.1), 1100);
  const t = w.abfragen(1050).theta;
  assert.ok(Math.abs(Math.abs(t) - Math.PI) < 0.1, `Winkel ${t}`);
});

test('Interpolator: Bei Paketverlust gibt es keine Sprünge in der Darstellung', () => {
  const ip = new Interpolator();
  const z = new Zufall(11);
  let groessterSprung = 0, letzte = null, seq = 0;
  // Auto fährt 25 m/s; 25 Zustände pro Sekunde, 5 % gehen verloren, Abfrage mit 60 Hz und 110 ms Puffer
  for (let t = 0; t < 10000; t += 1000 / 60) {
    if (Math.floor(t / 40) > seq) {
      seq = Math.floor(t / 40);
      if (!z.chance(0.05)) ip.hinzufuegen({ seq, x: (seq * 40 * 25) / 1000, y: 0, theta: 0, vx: 25, vy: 0, r: 0, flags: 0 }, seq * 40 + 30);
    }
    const a = ip.abfragen(t - 110, 1 / 60);
    if (a) {
      if (letzte !== null) groessterSprung = Math.max(groessterSprung, Math.abs(a.x - letzte));
      letzte = a.x;
    }
  }
  assert.ok(groessterSprung < 1.2, `größter Sprung ${groessterSprung.toFixed(2)} m je Bild (normal 0,42 m)`);
});

test('Interpolator: Bei 200 ms Latenz und ungenauer Uhr wird interpoliert, nicht dauernd extrapoliert', () => {
  for (const uhrFehler of [0, 400, -400]) {
    const ip = new Interpolator();
    const z = new Zufall(5);
    let seq = 0;
    const unterwegs = [];
    // Der Server stempelt jeden Zustand; beim Client kommt er 200 ms später an, 5 % gehen verloren
    for (let t = 0; t < 20000; t += 1000 / 60) {
      if (Math.floor(t / 40) > seq) {
        seq = Math.floor(t / 40);
        if (!z.chance(0.05)) unterwegs.push({ an: t + 200, seq, zeit: t });
      }
      while (unterwegs.length && unterwegs[0].an <= t) {
        const p = unterwegs.shift();
        ip.hinzufuegen({ seq: p.seq, x: (p.zeit * 25) / 1000, y: 0, theta: 0, vx: 25, vy: 0, r: 0, flags: 0 }, p.zeit, t + uhrFehler);
      }
      ip.abfragen(ip.darstellungsZeit(t + uhrFehler), 1 / 60);
    }
    const anteil = ip.statistik.extrapoliert / ip.statistik.abfragen;
    assert.ok(anteil < 0.02, `Uhrenfehler ${uhrFehler} ms: ${(anteil * 100).toFixed(1)} % extrapoliert`);
    assert.ok(Math.abs(ip.alter - (200 + uhrFehler)) < 5, `gemessenes Alter ${ip.alter}`);
  }
});

test('Nach einer Wiederverbindung kommt der aktuelle Stand erneut, mit Nummer zum Aussortieren', () => {
  const { m, nachrichten } = leeresMatch();
  const letzte = (t) => nachrichten.A.filter((n) => n.t === t).at(-1);
  const anzahl = (t) => nachrichten.A.filter((n) => n.t === t).length;
  const erste = letzte('startCountdown');
  assert.equal(erste.dgNr, 1);
  m.nachsenden('A');
  assert.equal(anzahl('startCountdown'), 2, 'Ankündigung noch einmal');
  assert.deepEqual(letzte('startCountdown'), erste);
  // Durchgang vorbei: Jetzt fehlt dem Zurückgekehrten das Ende
  m.tick(erste.startZeit);
  m._durchgangEnde('ziel', erste.startZeit + 1000);
  const ende = letzte('durchgangEnde');
  assert.equal(ende.dgNr, 1);
  m.nachsenden('A');
  assert.equal(anzahl('durchgangEnde'), 2);
  assert.deepEqual(letzte('durchgangEnde'), ende);
  // Nächster Durchgang: neue Nummer, gleiche Regeln
  m.tick(erste.startZeit + 1000 + 2200);
  m.tick(erste.startZeit + 1000 + 2200 + 6000);
  assert.equal(letzte('startCountdown').dgNr, 2);
});
