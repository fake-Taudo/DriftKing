// Gibt die Balance-Tabellen für docs/OEKONOMIE.md aus den echten Spieldaten aus.
// Aufruf: node scripts/oekonomieTabelle.js
import { AUTOS } from '../shared/autos.js';
import { FINISHS, MUSTER, FELGEN, AUFKLEBER_PAKETE, QUALM, EXTRAS, SLOTS, TUNING, teilInfo } from '../shared/teile.js';
import { neuerSpielstand } from '../shared/spielstand.js';
import { battleAbschliessen, BATTLE_BELOHNUNG, ZEITANGRIFF_BELOHNUNG, PERFEKT_BONUS } from '../shared/oekonomie.js';
import { AUFGABEN_POOL, AUFGABEN_JE_TAG } from '../shared/tagesaufgaben.js';
import { Zufall } from '../shared/zufall.js';

const z = (n) => Math.round(n).toLocaleString('de-DE');
const sum = (l) => l.reduce((s, x) => s + x.preis, 0);

// --- Katalog ---
const global = [['Lack-Finishs', FINISHS], ['Muster', MUSTER], ['Felgen', FELGEN], ['Aufkleber-Pakete', AUFKLEBER_PAKETE], ['Reifenqualm', QUALM], ['Extras', EXTRAS]];
console.log('### Katalog\n\n| Inhalt | Anzahl | Summe (DM) | Preisspanne |\n|---|---:|---:|---|');
let gesamtGlobal = 0;
for (const [name, l] of global) {
  const k = l.filter((x) => x.preis > 0);
  gesamtGlobal += sum(l);
  console.log(`| ${name} | ${k.length} | ${z(sum(l))} | ${z(Math.min(...k.map((x) => x.preis)))}–${z(Math.max(...k.map((x) => x.preis)))} |`);
}
console.log(`| **Für alle Autos zusammen** | | **${z(gesamtGlobal)}** | |\n`);
console.log('| Auto | Preis | Bodykit komplett | Tuning komplett | Zusammen |\n|---|---:|---:|---:|---:|');
let gesamt = gesamtGlobal, autosPreis = 0, teileSumme = 0, tuningSumme = 0;
for (const a of AUTOS) {
  let teile = 0, tun = 0;
  for (const s of SLOTS) for (let v = 1; v < s.varianten.length; v++) teile += teilInfo(`teil:${s.id}:${v}`, a.id).preis;
  for (const t of TUNING) for (let st = 2; st <= 5; st++) tun += teilInfo(`tuning:${t.id}:${st}`, a.id).preis;
  console.log(`| ${a.name} | ${z(a.preis)} | ${z(teile)} | ${z(tun)} | ${z(a.preis + teile + tun)} |`);
  gesamt += a.preis + teile + tun;
  autosPreis += a.preis;
  teileSumme += teile;
  tuningSumme += tun;
}
console.log(`| **Summe** | **${z(autosPreis)}** | **${z(teileSumme)}** | **${z(tuningSumme)}** | **${z(autosPreis + teileSumme + tuningSumme)}** |\n`);
console.log(`**Gesamtkosten aller Inhalte: ${z(gesamt)} DM.**\n`);

// --- Erstes neues Auto ---
const siegeBisAuto = (ausgaben, quote, seed) => {
  const d = neuerSpielstand('oekonomie' + String(seed).padStart(12, '0'));
  d.waehrung -= ausgaben;
  const r = new Zufall(seed);
  let siege = 0, battles = 0;
  while (d.waehrung < AUTOS[1].preis && battles < 500) {
    battles++;
    const sieg = r.chance(quote);
    const strecke = d.fortschritt.strecken[d.fortschritt.strecken.length - 1];
    const stufen = d.fortschritt.botStufen;
    battleAbschliessen(d, { battleId: 'b' + battles, streckeId: strecke, stufe: stufen[Math.max(0, stufen.length - 2)], format: 'bo3', sieg });
    if (sieg) siege++;
  }
  return { siege, battles };
};
console.log('### Erstes neues Auto (Marlin 4D, 8.000 DM)\n\n| Vorher für Teile ausgegeben | Siegquote | Ø Siege | Ø Battles | ca. Spielzeit |\n|---:|---:|---:|---:|---:|');
for (const [ausgaben, quote] of [[0, 0.7], [1000, 0.7], [2000, 0.7], [1000, 0.5], [2000, 0.5], [3000, 0.6]]) {
  let s = 0, b = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const e = siegeBisAuto(ausgaben, quote, i + 1);
    s += e.siege;
    b += e.battles;
  }
  console.log(`| ${z(ausgaben)} DM | ${Math.round(quote * 100)} % | ${(s / N).toFixed(1).replace('.', ',')} | ${(b / N).toFixed(1).replace('.', ',')} | ${Math.round((b / N) * 7)} min |`);
}

// --- Einkommen ---
const MIN_JE_BATTLE = 7;
console.log('\n### Einkommen je Stunde (Best of 3, ca. 7 Minuten je Battle einschließlich Menü)\n\n| Stufe | Sieg | Niederlage | Siegquote | Ø je Battle | Ø je Stunde |\n|---|---:|---:|---:|---:|---:|');
const QUOTE = { anfaenger: 0.8, fahrer: 0.7, profi: 0.65, meister: 0.6, legende: 0.5 };
const NAMEN = { anfaenger: 'Anfänger', fahrer: 'Fahrer', profi: 'Profi', meister: 'Meister', legende: 'Legende' };
const proStunde = {};
for (const [st, b] of Object.entries(BATTLE_BELOHNUNG)) {
  const je = QUOTE[st] * b.sieg + (1 - QUOTE[st]) * b.niederlage + 0.1 * PERFEKT_BONUS;
  proStunde[st] = (je * 60) / MIN_JE_BATTLE;
  console.log(`| ${NAMEN[st]} | ${z(b.sieg)} | ${z(b.niederlage)} | ${Math.round(QUOTE[st] * 100)} % | ${z(je)} | ${z(proStunde[st])} |`);
}
const einmalig = 3 * Object.values(ZEITANGRIFF_BELOHNUNG).reduce((a, b) => a + b, 0);
const erstsiege = 3 * Object.values(BATTLE_BELOHNUNG).reduce((a, b) => a + b.sieg, 0);
const aufgabeSchnitt = AUFGABEN_POOL.reduce((s, a) => s + a.belohnung, 0) / AUFGABEN_POOL.length;
console.log(`\nEinmalig: Erstsieg-Boni ${z(erstsiege)} DM, Medaillen ${z(einmalig)} DM, Startguthaben 5.000 DM. Tagesaufgaben: ${AUFGABEN_JE_TAG} × Ø ${z(aufgabeSchnitt)} DM = ${z(AUFGABEN_JE_TAG * aufgabeSchnitt)} DM je Tag.\n`);

// --- Spielzeit bis alles gekauft ist ---
const phasen = [['Anfänger/Fahrer', 5, (proStunde.anfaenger + proStunde.fahrer) / 2], ['Profi', 10, proStunde.profi], ['Meister', 10, proStunde.meister]];
let geld = 5000 + erstsiege + einmalig, stunden = 0;
console.log('### Spielzeit bis alles gekauft ist\n\n| Abschnitt | Stunden | DM je Stunde | Kontostand danach (ohne Ausgaben) |\n|---|---:|---:|---:|');
const AUFGABE_STUNDE = (AUFGABEN_JE_TAG * aufgabeSchnitt) / 1.5; // ca. 1,5 Stunden je Spieltag
for (const [name, h, rate] of phasen) {
  geld += h * (rate + AUFGABE_STUNDE);
  stunden += h;
  console.log(`| ${name} | ${h} | ${z(rate + AUFGABE_STUNDE)} | ${z(geld)} |`);
}
const rate = proStunde.legende * 0.5 + proStunde.meister * 0.5 + AUFGABE_STUNDE;
const rest = Math.max(0, gesamt - geld) / rate;
console.log(`| Meister/Legende | ${rest.toFixed(1).replace('.', ',')} | ${z(rate)} | ${z(geld + rest * rate)} |`);
console.log(`\n**Ergebnis: ca. ${Math.round(stunden + rest)} Stunden, bis wirklich alles gekauft ist.**`);
