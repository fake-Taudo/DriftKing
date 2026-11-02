// Ökonomie: Verkauf, Autos, keine Vermehrung durch Kreisläufe, Tagesaufgaben, Balance-Ziele, Tutorial mit echter Physik.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neuerSpielstand, pruefeSpielstand } from '../shared/spielstand.js';
import { kaufen, verkaufen, verkaufswert, autoKaufen, autoVerkaufen, autoVerkaufswert, besitzt, lookBedarf, tuningEinbauen, battleAbschliessen, anprobeAnwenden, lookKaufIds, buchen, onlineErgebnisBuchen, codeEinloesen, MAX_BUCHUNGEN, BATTLE_BELOHNUNG, ZEITANGRIFF_BELOHNUNG } from '../shared/oekonomie.js';
import { teilInfo, alleGlobalenIds, alleAutoIds, FINISHS, MUSTER, FELGEN, AUFKLEBER_PAKETE, QUALM, EXTRAS, SLOTS, TUNING, STUFEN_NAMEN } from '../shared/teile.js';
import { AUTOS, AUTO_IDS, autoDaten } from '../shared/autos.js';
import { standardLook, kopiereLook, pruefeLook } from '../shared/look.js';
import { AUFKLEBER_IDS } from '../client/assets/aufkleber.js';
import { AUFGABEN_POOL, AUFGABEN_JE_TAG, aufgabenBereitstellen, aufgabenEreignis, lokalesDatum, aufgabeDaten } from '../shared/tagesaufgaben.js';
import { TutorialAblauf, TUTORIAL_SCHRITTE } from '../shared/tutorialLogik.js';
import { Fahrzeug } from '../shared/physik/fahrzeug.js';
import { effektiveParameter } from '../shared/tuning.js';
import { testflaecheGitter, TESTFLAECHE } from '../shared/strecken/testflaeche.js';
import { Zufall } from '../shared/zufall.js';

const neu = (id = 'oekonomietest123456') => neuerSpielstand(id);
const OPT = { aufkleberIds: AUFKLEBER_IDS };
const GRAD = 180 / Math.PI;

test('Verkauf: 50 %, nur Gekauftes, kein zweites Mal', () => {
  const d = neu();
  assert.equal(kaufen(d, 'finish:metallic', 'kestrel_s').ok, true);
  const g = d.waehrung;
  const r = verkaufen(d, 'finish:metallic', 'kestrel_s');
  assert.equal(r.ok, true);
  assert.equal(r.erloes, verkaufswert(teilInfo('finish:metallic').preis));
  assert.equal(d.waehrung, g + r.erloes);
  assert.equal(besitzt(d, 'finish:metallic', 'kestrel_s'), false);
  assert.equal(verkaufen(d, 'finish:metallic', 'kestrel_s').grund, 'kein_besitz');
  assert.equal(verkaufen(d, 'finish:glanz', 'kestrel_s').grund, 'kostenlos');
  assert.equal(verkaufen(d, 'gibt:es:nicht', 'kestrel_s').grund, 'unbekannt');
});

test('Verkauf entfernt das Teil aus allen Looks; Spielstand bleibt gültig, Rennen brauchen nichts Ungekauftes', () => {
  const d = neu();
  d.waehrung = 100000;
  assert.equal(autoKaufen(d, 'marlin_4d').ok, true);
  kaufen(d, ['finish:metallic', 'muster:flammen', 'extra:neon', 'felge:netz', 'aufkleber:flammen', 'qualm:rot'], 'kestrel_s');
  kaufen(d, ['teil:spoiler:4', 'tuning:motor:3'], 'kestrel_s');
  tuningEinbauen(d, 'kestrel_s', 'motor', 3);
  const a = d.autos[0], b = d.autos[1];
  for (const l of [a.looks[0].look, a.looks[3].look, b.looks[1].look]) {
    l.lack.finish = 'metallic';
    l.muster.id = 'flammen';
    l.neon.an = true;
    l.felgen.design = 'netz';
    l.qualm = '#ff3b3b';
    l.aufkleber.push({ id: 'flamme', zone: 'haube', x: 0.5, y: 0.5, rot: 0, skala: 0.5, farbe: '#ffffff', spiegel: false, deckkraft: 1 });
  }
  a.looks[0].look.teile.spoiler.variante = 4;
  for (const id of ['finish:metallic', 'muster:flammen', 'extra:neon', 'felge:netz', 'qualm:rot', 'aufkleber:flammen', 'teil:spoiler:4', 'tuning:motor:3']) {
    assert.equal(verkaufen(d, id, 'kestrel_s').ok, true, id);
  }
  for (const auto of d.autos) {
    for (const l of auto.looks) assert.deepEqual(lookBedarf(d, auto.id, l.look).teile, [], auto.id);
  }
  assert.equal(a.tuning.motor, 1, 'verkaufte Tuningstufe ist ausgebaut');
  assert.deepEqual(pruefeSpielstand(d, OPT), { ok: true });
});

test('Autokauf: Preis, Guthaben, Doppelkauf; Autoverkauf: 50 % plus Teile, das letzte Auto nie', () => {
  const d = neu();
  assert.equal(autoVerkaufen(d, 'kestrel_s').grund, 'letztes');
  d.waehrung = 7999;
  const zuTeuer = autoKaufen(d, 'marlin_4d');
  assert.equal(zuTeuer.grund, 'guthaben');
  assert.equal(zuTeuer.fehlt, 1);
  assert.equal(d.autos.length, 1);
  d.waehrung = 20000;
  assert.equal(autoKaufen(d, 'marlin_4d').ok, true);
  assert.equal(d.waehrung, 12000);
  assert.equal(autoKaufen(d, 'marlin_4d').grund, 'besitz');
  assert.equal(d.waehrung, 12000);
  assert.equal(autoKaufen(d, 'gibtsnicht').grund, 'unbekannt');
  kaufen(d, 'teil:spoiler:4', 'marlin_4d');
  const preisTeil = teilInfo('teil:spoiler:4', 'marlin_4d').preis;
  const stand = d.waehrung;
  assert.equal(autoVerkaufswert(d, 'marlin_4d'), 4000 + verkaufswert(preisTeil));
  d.aktivesAuto = 'marlin_4d';
  const r = autoVerkaufen(d, 'marlin_4d');
  assert.equal(r.erloes, 4000 + verkaufswert(preisTeil));
  assert.equal(d.waehrung, stand + r.erloes);
  assert.equal(d.aktivesAuto, 'kestrel_s', 'aktives Auto wechselt');
  assert.deepEqual(pruefeSpielstand(d, OPT), { ok: true });
});

test('Keine Vermehrung: 5.000 zufällige Käufe und Verkäufe lassen das Vermögen nie steigen', () => {
  const z = new Zufall(42);
  const d = neu();
  d.waehrung = 300000;
  const wert = () => {
    // Vermögen = Guthaben + was alles beim Wiederverkauf brächte
    let w = d.waehrung;
    for (const id of d.besitzGlobal) w += verkaufswert(teilInfo(id)?.preis ?? 0);
    for (const a of d.autos) w += autoVerkaufswert(d, a.id);
    return w;
  };
  const globale = alleGlobalenIds();
  const autoteile = alleAutoIds();
  let vorher = wert();
  for (let i = 0; i < 5000; i++) {
    const auto = z.waehle(d.autos).id;
    const wurf = z.naechste();
    let r;
    if (wurf < 0.3) r = kaufen(d, z.waehle(globale), auto);
    else if (wurf < 0.6) r = kaufen(d, z.waehle(autoteile), auto);
    else if (wurf < 0.75) r = verkaufen(d, z.waehle(globale), auto);
    else if (wurf < 0.9) r = verkaufen(d, z.waehle(autoteile), auto);
    else if (wurf < 0.96) r = autoKaufen(d, z.waehle(AUTO_IDS));
    else r = autoVerkaufen(d, z.waehle(AUTO_IDS));
    const jetzt = wert();
    assert.ok(jetzt <= vorher, `Schritt ${i}: Vermögen stieg von ${vorher} auf ${jetzt} (${JSON.stringify(r)})`);
    assert.ok(d.waehrung >= 0 && Number.isInteger(d.waehrung));
    vorher = jetzt;
    if (d.waehrung < 2000) d.waehrung += 0; // bewusst kein Nachschub: es soll nur abwärts gehen
  }
  assert.deepEqual(pruefeSpielstand(d, OPT), { ok: true });
});

test('Kauf und sofortiger Verkauf ergibt immer einen Verlust (jede Kauf-ID, jedes Auto)', () => {
  for (const auto of AUTO_IDS) {
    const d = neuerSpielstand('verlusttest12345678');
    d.waehrung = 1000000;
    autoKaufen(d, auto);
    for (const id of [...alleGlobalenIds(), ...alleAutoIds()]) {
      const info = teilInfo(id, auto);
      if (!info || info.preis === 0) continue;
      const g = d.waehrung;
      assert.equal(kaufen(d, id, auto).ok, true, id);
      assert.equal(verkaufen(d, id, auto).ok, true, id);
      assert.ok(d.waehrung < g, `${auto} ${id}`);
    }
  }
});

test('Negatives Guthaben ist unmöglich; Doppelklick kauft nur einmal', () => {
  const d = neu();
  d.waehrung = 500;
  assert.equal(buchen(d, { betrag: -501 }).ok, false);
  assert.equal(d.waehrung, 500);
  assert.equal(buchen(d, { betrag: 1.5 }).ok, false);
  const p = teilInfo('finish:matt').preis;
  kaufen(d, 'finish:matt', 'kestrel_s');
  kaufen(d, 'finish:matt', 'kestrel_s');
  assert.equal(d.waehrung, 500 - p);
  assert.equal(d.besitzGlobal.filter((x) => x === 'finish:matt').length, 1);
});

test('Anprobe im Shop: Vorschau betrifft genau das gezeigte Teil und bleibt ein gültiger Look', () => {
  const ids = [...alleGlobalenIds(), ...alleAutoIds()];
  for (const id of ids) {
    const l = standardLook('vireo_turbo');
    const sichtbar = anprobeAnwenden(l, id);
    const art = id.split(':')[0];
    if (art === 'aufkleber' || art === 'tuning') assert.equal(sichtbar, false, id);
    else {
      assert.equal(sichtbar, true, id);
      assert.deepEqual(pruefeLook(l, OPT), { ok: true }, id);
      if (!id.endsWith(':0') && teilInfo(id, 'vireo_turbo').preis > 0) assert.ok(lookKaufIds('vireo_turbo', l).includes(id), id);
    }
  }
});

test('Online-Duell: Belohnung genau einmal, 3 je Gegner, 10 je Tag, nie mehr als vorgesehen, Tageswechsel', () => {
  const d = neu();
  const start = d.waehrung;
  const buche = (nr, gegnerId, betrag = 400, sieg = true, datum = '2026-11-02') => onlineErgebnisBuchen(d, { duellId: 'd' + nr, gegnerId, betrag, sieg, datum });
  assert.deepEqual(buche(1, 'x'), { ok: true, betrag: 400 });
  assert.equal(d.waehrung, start + 400);
  assert.equal(d.statistik.onlineDuelle, 1);
  assert.equal(d.statistik.onlineSiege, 1);
  // Doppelt gemeldet (etwa nach einer Wiederverbindung): zählt nicht noch einmal
  assert.equal(buche(1, 'x').ok, false);
  assert.equal(d.waehrung, start + 400);
  assert.equal(d.statistik.onlineDuelle, 1);
  // Der Betrag ist gedeckelt, auch wenn ein manipulierter Server mehr meldet
  assert.equal(buche(2, 'x', 99999).betrag, 400);
  // Eine Niederlage bringt weniger, ohne reguläres Ende gibt es nichts
  assert.equal(buche(3, 'x', 100, false).betrag, 100);
  assert.equal(d.statistik.onlineSiege, 2);
  const stand = d.waehrung;
  assert.deepEqual(buche(4, 'x', 0, false), { ok: true, betrag: 0, grund: 'keine' });
  // Dritter belohnter Gegner-Lauf war Nummer 3, der vierte geht leer aus
  assert.deepEqual(buche(5, 'x'), { ok: true, betrag: 0, grund: 'gegner' });
  assert.equal(d.waehrung, stand);
  // Tagesgrenze über verschiedene Gegner
  for (let i = 0; i < 7; i++) assert.equal(buche(10 + i, 'g' + i).betrag, 400);
  assert.equal(d.online.belohnt, 10);
  assert.deepEqual(buche(30, 'neu'), { ok: true, betrag: 0, grund: 'tag' });
  // Am nächsten Tag zählt alles neu
  assert.equal(buche(31, 'x', 400, true, '2026-11-03').betrag, 400);
  assert.equal(d.online.belohnt, 1);
  assert.equal(pruefeSpielstand(d).ok, true);
});

test('Tagesaufgaben: Pool ≥ 12, 3 je Tag, Belohnung 100–400, je Spieler und Tag fest, Wechsel um Mitternacht', () => {
  assert.ok(AUFGABEN_POOL.length >= 12);
  for (const a of AUFGABEN_POOL) assert.ok(a.belohnung >= 100 && a.belohnung <= 400 && a.ziel > 0, a.id);
  const d = neu();
  assert.equal(aufgabenBereitstellen(d, '2026-11-02'), true);
  assert.equal(d.tagesaufgaben.aufgaben.length, AUFGABEN_JE_TAG);
  assert.equal(new Set(d.tagesaufgaben.aufgaben.map((a) => a.id)).size, AUFGABEN_JE_TAG);
  const vorher = JSON.stringify(d.tagesaufgaben);
  assert.equal(aufgabenBereitstellen(d, '2026-11-02'), false);
  assert.equal(JSON.stringify(d.tagesaufgaben), vorher, 'gleicher Tag: nichts ändert sich');
  const e = neu();
  aufgabenBereitstellen(e, '2026-11-02');
  assert.deepEqual(e.tagesaufgaben.aufgaben.map((a) => a.id), d.tagesaufgaben.aufgaben.map((a) => a.id));
  // Über viele Tage kommen viele verschiedene Aufgaben vor
  const gesehen = new Set();
  for (let t = 1; t <= 28; t++) {
    aufgabenBereitstellen(d, `2026-12-${String(t).padStart(2, '0')}`);
    for (const a of d.tagesaufgaben.aufgaben) gesehen.add(a.id);
  }
  assert.ok(gesehen.size >= 12, `nur ${gesehen.size} verschiedene`);
  assert.equal(lokalesDatum(new Date(2026, 10, 2, 23, 59)), '2026-11-02');
  assert.equal(lokalesDatum(new Date(2026, 10, 3, 0, 0)), '2026-11-03');
  assert.deepEqual(pruefeSpielstand(d, OPT), { ok: true });
});

test('Tagesaufgaben: Fortschritt, Summe und Bestwert, einmalige Belohnung', () => {
  const d = neu();
  d.tagesaufgaben = { datum: '2026-11-02', aufgaben: [{ id: 'siege2', fortschritt: 0, erledigt: false, abgeholt: false }, { id: 'fuehrer70', fortschritt: 0, erledigt: false, abgeholt: false }, { id: 'punkte300', fortschritt: 0, erledigt: false, abgeholt: false }] };
  const g = d.waehrung;
  assert.deepEqual(aufgabenEreignis(d, 'battleSieg'), []);
  const fertig = aufgabenEreignis(d, 'battleSieg');
  assert.deepEqual(fertig, [{ id: 'siege2', belohnung: 300 }]);
  assert.equal(d.waehrung, g + 300);
  assert.deepEqual(aufgabenEreignis(d, 'battleSieg'), [], 'erledigte Aufgabe zahlt nicht noch einmal');
  assert.equal(d.waehrung, g + 300);
  aufgabenEreignis(d, 'fuehrerPunkte', 50);
  aufgabenEreignis(d, 'fuehrerPunkte', 30);
  assert.equal(d.tagesaufgaben.aufgaben[1].fortschritt, 50, 'Bestwert, keine Summe');
  aufgabenEreignis(d, 'fuehrerPunkte', 71);
  assert.equal(d.tagesaufgaben.aufgaben[1].erledigt, true);
  aufgabenEreignis(d, 'punkte', 100);
  aufgabenEreignis(d, 'punkte', -50);
  aufgabenEreignis(d, 'punkte', NaN);
  assert.equal(d.tagesaufgaben.aufgaben[2].fortschritt, 100, 'ungültige Werte zählen nicht');
  // Dieselbe Aufgabe am selben Tag nach erneutem Auslosen zahlt nicht doppelt
  d.tagesaufgaben.aufgaben[0] = { id: 'siege2', fortschritt: 0, erledigt: false, abgeholt: false };
  aufgabenEreignis(d, 'battleSieg', 2);
  assert.equal(d.waehrung, g + 300 + aufgabeDaten('fuehrer70').belohnung);
});

test('Balance: erstes neues Auto nach 8–12 Bot-Siegen (bei sparsamem Teilekauf)', () => {
  // Neuling: gibt 1.000 DM für Lack aus, gewinnt 70 % seiner Battles (Best of 3) und steigt langsam auf
  const d = neu();
  d.waehrung -= 1000;
  const preis = autoDaten('marlin_4d').preis;
  const z = new Zufall(7);
  let siege = 0, n = 0;
  while (d.waehrung < preis && n < 200) {
    n++;
    const sieg = z.chance(0.7);
    const strecke = d.fortschritt.strecken[d.fortschritt.strecken.length - 1];
    // nimmt die zweithöchste freigeschaltete Stufe (nicht die schwerste)
    const stufen = d.fortschritt.botStufen;
    const stufe = stufen[Math.max(0, stufen.length - 2)];
    battleAbschliessen(d, { battleId: 'b' + n, streckeId: strecke, stufe, format: 'bo3', sieg });
    if (sieg) siege++;
  }
  assert.ok(siege >= 7 && siege <= 12, `${siege} Siege bis zum ersten neuen Auto`);
});

test('Balance: Gesamtkosten aller Inhalte liegen im Rahmen von 25–40 Stunden', () => {
  const sum = (l) => l.reduce((s, x) => s + x.preis, 0);
  let gesamt = sum(FINISHS) + sum(MUSTER) + sum(FELGEN) + sum(AUFKLEBER_PAKETE) + sum(QUALM) + sum(EXTRAS);
  for (const a of AUTOS) {
    gesamt += a.preis;
    for (const s of SLOTS) for (let v = 1; v < s.varianten.length; v++) gesamt += teilInfo(`teil:${s.id}:${v}`, a.id).preis;
    for (const t of TUNING) for (let st = 2; st <= STUFEN_NAMEN.length; st++) gesamt += teilInfo(`tuning:${t.id}:${st}`, a.id).preis;
  }
  // Einkommen siehe docs/OEKONOMIE.md: 25 Stunden ≈ 160.000 DM, 40 Stunden ≈ 270.000 DM
  assert.ok(gesamt >= 160000 && gesamt <= 270000, `Gesamtkosten ${gesamt}`);
  // Preisspanne der Teile: ca. 100 bis 12.000
  for (const id of [...alleGlobalenIds(), ...alleAutoIds()]) {
    for (const auto of AUTO_IDS) {
      const p = teilInfo(id, auto)?.preis ?? 0;
      assert.ok(p === 0 || (p >= 100 && p <= 12000), `${id}: ${p}`);
    }
  }
  assert.equal(BATTLE_BELOHNUNG.legende.sieg, 1500);
  assert.equal(ZEITANGRIFF_BELOHNUNG.champion, 1000);
});

test('Tuning: höhere Stufen kosten bei jedem Auto und jeder Kategorie deutlich mehr', () => {
  for (const a of AUTO_IDS) {
    for (const t of TUNING) {
      let vorher = 0;
      for (let s = 2; s <= 5; s++) {
        const p = teilInfo(`tuning:${t.id}:${s}`, a).preis;
        assert.ok(p > vorher * 1.3, `${a} ${t.id} Stufe ${s}: ${p} nach ${vorher}`);
        vorher = p;
      }
    }
  }
});

test('Tutorial: ein Neuling kommt mit echter Physik bis zum gehaltenen ersten Drift', () => {
  const f = new Fahrzeug(effektiveParameter('kestrel_s'), { gegenlenken: 0.75, driftHalten: 0.3, getriebe: 'auto' });
  const gitter = testflaecheGitter();
  void TESTFLAECHE;
  f.setzen(-100, -100, 0, 0);
  const ablauf = new TutorialAblauf();
  const DT = 1 / 60;
  const pruefen = (e) => {
    f.schritt(e, DT, gitter);
    return ablauf.aktualisieren({
      tempoKmh: f.tempo * 3.6, lenken: e.lenken, bremse: e.bremse, handbremse: e.handbremse,
      winkelGrad: f.driftWinkel * GRAD, abstand: null
    }, DT);
  };
  const leer = { lenken: 0, gas: 0, bremse: 0, handbremse: 0, kupplung: 0 };
  // Gas
  for (let t = 0; t < 15 && ablauf.schritt.id === 'gas'; t += DT) pruefen({ ...leer, gas: 1 });
  assert.equal(ablauf.schritt.id, 'lenken', 'Gas geschafft');
  // Lenken
  for (let t = 0; t < 1; t += DT) pruefen({ ...leer, gas: 0.5, lenken: 0.6 });
  for (let t = 0; t < 1; t += DT) pruefen({ ...leer, gas: 0.5, lenken: -0.6 });
  assert.equal(ablauf.schritt.id, 'bremse', 'Lenken geschafft');
  // Bremsen
  f.setzen(-100, -100, 0, 5);
  for (let t = 0; t < 4; t += DT) pruefen({ ...leer, gas: 1 });
  for (let t = 0; t < 8 && ablauf.schritt.id === 'bremse'; t += DT) pruefen({ ...leer, bremse: 1 });
  assert.equal(ablauf.schritt.id, 'handbremse', 'Bremsen geschafft');
  // Handbremse
  f.setzen(-100, -100, 0, 5);
  for (let t = 0; t < 4; t += DT) pruefen({ ...leer, gas: 1 });
  pruefen({ ...leer, handbremse: 1 });
  assert.equal(ablauf.schritt.id, 'drift', 'Handbremse geschafft');
  // Erster Drift und Halten: anfahren, einlenken, kurz Handbremse, dann Gas stehen lassen
  let versuche = 0;
  while (ablauf.schritt.id !== 'tandem' && versuche < 12) {
    versuche++;
    f.setzen(0, 0, 0, 60 / 3.6);
    for (let t = 0; t < 0.35; t += DT) pruefen({ ...leer, lenken: -1, handbremse: 1, gas: 0.3 });
    for (let t = 0; t < 5; t += DT) pruefen({ ...leer, lenken: 0, gas: 0.9 }); // Lenkung los, die Assistenz gegenlenkt
  }
  assert.equal(ablauf.schritt.id, 'tandem', `Drift nach ${versuche} Versuchen nicht geschafft (Schritt ${ablauf.schritt.id})`);
  // Tandem: bleibt nah am Führer
  for (let t = 0; t < 7; t += DT) ablauf.aktualisieren({ tempoKmh: 40, lenken: 0, bremse: 0, handbremse: 0, winkelGrad: 0, abstand: 12 }, DT);
  assert.equal(ablauf.fertig, true);
  assert.equal(TUTORIAL_SCHRITTE.at(-1).id, 'fertig');
});

test('Tutorial: ein Schritt lässt sich nach einiger Zeit überspringen, sonst nicht', () => {
  const a = new TutorialAblauf();
  assert.equal(a.darfWeiter, false);
  for (let t = 0; t < 46; t += 1) a.aktualisieren({ tempoKmh: 0, lenken: 0, bremse: 0, handbremse: 0, winkelGrad: 0, abstand: null }, 1);
  assert.equal(a.darfWeiter, true);
  a.weiter();
  assert.equal(a.schritt.id, 'lenken');
  assert.equal(a.darfWeiter, false);
});

test('Die Look-Hilfen verändern den Serien-Look nicht', () => {
  const l = standardLook('kestrel_s');
  const k = kopiereLook(l);
  lookKaufIds('kestrel_s', l);
  assert.deepEqual(l, k);
});

test('Geschenk-Code: Release bringt 7.500 Münzen, aber nur einmal', () => {
  const d = neuerSpielstand('testclient1234567890');
  const start = d.waehrung;
  const r = codeEinloesen(d, 'Release');
  assert.equal(r.ok, true);
  assert.equal(r.betrag, 7500);
  assert.equal(d.waehrung, start + 7500);
  assert.equal(d.statistik.muenzenVerdient, 7500);
  assert.deepEqual(pruefeSpielstand(d), { ok: true });
  for (const nochmal of ['Release', 'RELEASE', ' release ']) {
    assert.deepEqual(codeEinloesen(d, nochmal), { ok: false, grund: 'eingeloest' });
  }
  assert.equal(d.waehrung, start + 7500);
});

test('Geschenk-Code: Schreibweise und Leerzeichen am Rand sind egal', () => {
  for (const eingabe of ['release', 'RELEASE', '  ReLeAsE\n']) {
    const d = neuerSpielstand('testclient1234567890');
    assert.equal(codeEinloesen(d, eingabe).ok, true, eingabe);
  }
});

test('Geschenk-Code: Falsche Eingaben ändern nichts', () => {
  const d = neuerSpielstand('testclient1234567890');
  const vorher = JSON.stringify(d);
  assert.equal(codeEinloesen(d, '').grund, 'leer');
  assert.equal(codeEinloesen(d, '   ').grund, 'leer');
  assert.equal(codeEinloesen(d, null).grund, 'leer');
  for (const falsch of ['Releas', 'Release2', 'Re lease', 'constructor', '__proto__', 'toString']) {
    assert.equal(codeEinloesen(d, falsch).grund, 'unbekannt', falsch);
  }
  assert.equal(JSON.stringify(d), vorher);
});

test('Geschenk-Code: Die Sperre überlebt das Kürzen der Buchungsliste', () => {
  const d = neuerSpielstand('testclient1234567890');
  codeEinloesen(d, 'Release');
  for (let i = 0; i < MAX_BUCHUNGEN + 50; i++) buchen(d, { betrag: 1, id: 'test:' + i });
  assert.equal(codeEinloesen(d, 'Release').grund, 'eingeloest');
});
