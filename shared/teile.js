// Teile-Katalog: alle kaufbaren Optik- und Leistungsteile mit Preisen und (kleinen) Wirkungen.
// Kauf-IDs:
//   global (für alle Autos):  "finish:<id>", "muster:<id>", "felge:<id>", "aufkleber:<paket>",
//                             "qualm:<id>", "extra:<id>"
//   je Auto:                  "teil:<slot>:<variante>", "tuning:<kategorie>:<stufe>"
// Preise sind in docs/OEKONOMIE.md begründet.

/** Preis-Faktor je Auto für autogebundene Teile (teurere Autos → teurere Teile). */
export const AUTO_PREISFAKTOR = {
  kestrel_s: 0.7,
  marlin_4d: 0.85,
  vireo_turbo: 1.0,
  hornet_wagon: 1.05,
  bastion_gt: 1.2,
  onyx_rs: 1.4
};

// ---------------------------------------------------------------------------
// Lack
export const FINISHS = [
  { id: 'glanz', name: 'Glanz', preis: 0 },
  { id: 'matt', name: 'Matt', preis: 400 },
  { id: 'satin', name: 'Satin', preis: 450 },
  { id: 'metallic', name: 'Metallic', preis: 700 },
  { id: 'perleffekt', name: 'Perleffekt', preis: 1800 },
  { id: 'chrom', name: 'Chrom', preis: 3000 }
];

export const MUSTER = [
  { id: 'keins', name: 'Kein Muster', preis: 0 },
  { id: 'rennstreifen', name: 'Rennstreifen', preis: 250 },
  { id: 'doppelstreifen', name: 'Doppelstreifen', preis: 300 },
  { id: 'karbon', name: 'Karbon-Optik', preis: 900 },
  { id: 'flammen', name: 'Flammen', preis: 800 },
  { id: 'wellen', name: 'Wellen', preis: 450 },
  { id: 'tarnung', name: 'Tarnung', preis: 600 },
  { id: 'geometrie', name: 'Geometrie', preis: 550 },
  { id: 'retro', name: 'Retro-Linien', preis: 500 },
  { id: 'seitenblitz', name: 'Seitenblitz', preis: 450 },
  { id: 'punkte', name: 'Punkte', preis: 350 },
  { id: 'kacheln', name: 'Kacheln', preis: 400 },
  { id: 'verlauf', name: 'Farbverlauf', preis: 650 }
];

// ---------------------------------------------------------------------------
// Felgen (12 Designs, global)
export const FELGEN = [
  { id: 'fuenfspeichen', name: 'Fünfspeichen', preis: 0 },
  { id: 'stahl', name: 'Stahlfelge', preis: 150 },
  { id: 'mehrspeichen', name: 'Mehrspeichen', preis: 600 },
  { id: 'kreuzspeichen', name: 'Kreuzspeichen', preis: 700 },
  { id: 'wabe', name: 'Wabe', preis: 800 },
  { id: 'scheibe', name: 'Scheibe', preis: 650 },
  { id: 'turbine', name: 'Turbine', preis: 950 },
  { id: 'stern', name: 'Sternform', preis: 900 },
  { id: 'tiefbett', name: 'Tiefbett', preis: 1100 },
  { id: 'y_speichen', name: 'Y-Speichen', preis: 1000 },
  { id: 'netz', name: 'Netz', preis: 1100 },
  { id: 'dreispeichen', name: 'Dreispeichen', preis: 1200 }
];

// ---------------------------------------------------------------------------
// Aufkleber-Pakete (global). Die einzelnen Aufkleber stehen in client/assets/aufkleber.js.
export const AUFKLEBER_PAKETE = [
  { id: 'formen', name: 'Formen', preis: 0 },
  { id: 'zahlen', name: 'Zahlen & Buchstaben', preis: 0 },
  { id: 'streifen', name: 'Streifen', preis: 150 },
  { id: 'sterne', name: 'Sterne & Blitze', preis: 200 },
  { id: 'flaggen', name: 'Flaggen-Muster', preis: 250 },
  { id: 'flammen', name: 'Flammen', preis: 300 },
  { id: 'symbole', name: 'Symbole', preis: 300 },
  { id: 'sponsoren', name: 'Sponsoren', preis: 500 },
  { id: 'text', name: 'Text-Aufkleber', preis: 250 }
];

// ---------------------------------------------------------------------------
// Reifenqualm (global)
export const QUALM = [
  { id: 'weiss', name: 'Weiß', farbe: '#eeeeee', preis: 0 },
  { id: 'schwarz', name: 'Schwarz', farbe: '#1b1b1f', preis: 200 },
  { id: 'rot', name: 'Rot', farbe: '#ff3b3b', preis: 350 },
  { id: 'blau', name: 'Blau', farbe: '#3b8bff', preis: 350 },
  { id: 'lila', name: 'Lila', farbe: '#a24bff', preis: 350 },
  { id: 'gruen', name: 'Grün', farbe: '#33e07a', preis: 350 },
  { id: 'orange', name: 'Orange', farbe: '#ff8a1f', preis: 350 },
  { id: 'regenbogen', name: 'Regenbogen', farbe: 'regenbogen', preis: 1800 },
  { id: 'frei', name: 'Freie Farbe', farbe: null, preis: 1000 }
];

// ---------------------------------------------------------------------------
// Extras (global)
export const EXTRAS = [
  { id: 'neon', name: 'Neon-Unterboden', preis: 900 },
  { id: 'toenung', name: 'Scheibentönung', preis: 200 },
  { id: 'lichtfarbe', name: 'Scheinwerferfarbe', preis: 350 },
  { id: 'ruecklicht', name: 'Rücklicht-Design', preis: 300 },
  { id: 'backfire', name: 'Backfire-Auspuff', preis: 900 }
];

// ---------------------------------------------------------------------------
// Bodykit-Slots (je Auto). Variante 0 = Serie (bzw. „kein Spoiler“) und kostenlos.
// "preise" gelten für Variante 1..n und werden mit AUTO_PREISFAKTOR multipliziert.
export const SLOTS = [
  { id: 'frontstoss', name: 'Frontstoßstange', varianten: ['Serie', 'Frontlippe', 'Frontsplitter', 'Rennschürze'], preise: [170, 290, 430] },
  { id: 'heckstoss', name: 'Heck & Diffusor', varianten: ['Serie', 'Diffusor', 'Rennheck', 'Breitheck'], preise: [140, 260, 410] },
  { id: 'schweller', name: 'Seitenschweller', varianten: ['Serie', 'Sportschweller', 'Rennschweller', 'Breitschweller'], preise: [120, 220, 340] },
  { id: 'verbreiterung', name: 'Kotflügelverbreiterung', varianten: ['Serie', 'Dezent', 'Genietet', 'Extrem'], preise: [220, 380, 620] },
  { id: 'haube', name: 'Motorhaube', varianten: ['Serie', 'Lufthutze', 'Karbonhaube', 'Lüftungshaube'], preise: [170, 340, 460] },
  { id: 'dach', name: 'Dach', varianten: ['Serie', 'Dachspoiler', 'Dachträger', 'Dach-Lufthutze'], preise: [120, 220, 310] },
  { id: 'spiegel', name: 'Spiegel', varianten: ['Serie', 'Rennspiegel', 'Aero-Spiegel', 'Retro-Spiegel'], preise: [100, 110, 130] },
  { id: 'auspuff', name: 'Auspuffblenden', varianten: ['Serie', 'Doppelrohr', 'Großrohr', 'Seitenausgang'], preise: [100, 170, 260] },
  { id: 'spoiler', name: 'Spoiler', varianten: ['Kein Spoiler', 'Bürzel', 'Lippe', 'Kleiner Flügel', 'Großer Heckflügel', 'Doppelflügel'], preise: [120, 140, 240, 420, 620] }
];

/** Kein Anbauteil kostet weniger als das (auch nicht beim günstigsten Auto). */
export const TEIL_MINDESTPREIS = 100;

export const SLOT_IDS = SLOTS.map((s) => s.id);
const slotNachId = new Map(SLOTS.map((s) => [s.id, s]));
export function slotDaten(id) {
  return slotNachId.get(id) || null;
}
export function maxVariante(slotId) {
  const s = slotNachId.get(slotId);
  return s ? s.varianten.length - 1 : 0;
}

/**
 * Kleine, dokumentierte Fahrphysik-Wirkungen von Optikteilen (siehe docs/AUTOS.md).
 * Werte sind relative Änderungen. Fokus bleibt klar auf der Optik.
 */
export const OPTIK_WIRKUNG = {
  spoiler: [
    { stabilitaet: 0, luftwiderstand: 0 },
    { stabilitaet: 0.02, luftwiderstand: 0.005 },
    { stabilitaet: 0.025, luftwiderstand: 0.006 },
    { stabilitaet: 0.04, luftwiderstand: 0.012 },
    { stabilitaet: 0.07, luftwiderstand: 0.025 },
    { stabilitaet: 0.08, luftwiderstand: 0.03 }
  ],
  haube: [{ masse: 0 }, { masse: 2 }, { masse: -9 }, { masse: -4 }],
  frontstoss: [{ luftwiderstand: 0 }, { luftwiderstand: 0.003 }, { luftwiderstand: 0.006 }, { luftwiderstand: 0.008 }],
  verbreiterung: [{ luftwiderstand: 0 }, { luftwiderstand: 0.004 }, { luftwiderstand: 0.008 }, { luftwiderstand: 0.014 }]
};

// ---------------------------------------------------------------------------
// Leistungs-Tuning: Stufe 1 = Serie (kostenlos), 2 = Sport, 3 = Rennsport, 4 = Profi, 5 = Meister.
export const STUFEN_NAMEN = ['Serie', 'Sport', 'Rennsport', 'Profi', 'Meister'];

/** Preis-Basis je Stufe (Index = Stufe - 1), wird mit Kategorie-Gewicht und Autofaktor multipliziert. */
export const STUFEN_PREISE = [0, 50, 110, 220, 440];
/** Mindestpreis je Stufe: Höhere Stufen kosten auch bei günstigen Kategorien und Autos deutlich mehr. */
export const STUFEN_MINDESTPREISE = [0, 100, 140, 200, 300];

export const TUNING = [
  {
    id: 'motor', name: 'Motor', beschreibung: 'Mehr Leistung über das ganze Drehzahlband.', gewicht: 1.6,
    // Multiplikator auf die Leistung je Stufe
    werte: { leistung: [1, 1.07, 1.15, 1.24, 1.34] }
  },
  {
    id: 'turbo', name: 'Turbo / Ansaugung', beschreibung: 'Mehr Leistung, schnellerer Ladedruckaufbau (kleineres Turboloch).', gewicht: 1.3,
    werte: { leistung: [1, 1.04, 1.08, 1.12, 1.17], turboLoch: [1, 0.88, 0.76, 0.64, 0.52] }
  },
  {
    id: 'reifen', name: 'Reifen', beschreibung: 'Mehr Grip und kontrollierbareres Rutschen im Drift.', gewicht: 1.1,
    werte: { grip: [1, 1.025, 1.05, 1.075, 1.1], gleiten: [0, 0.008, 0.016, 0.024, 0.032] }
  },
  {
    id: 'fahrwerk', name: 'Fahrwerk', beschreibung: 'Weniger Wanken, mehr Stabilität in schnellen Wechseln.', gewicht: 0.9,
    werte: { stabilitaet: [1, 1.04, 1.08, 1.12, 1.16], wanken: [1, 0.9, 0.8, 0.7, 0.6] }
  },
  {
    id: 'sperre', name: 'Differenzialsperre', beschreibung: 'Höherer Sperrgrad – Drifts lassen sich besser mit dem Gas steuern.', gewicht: 0.9,
    werte: { sperre: [0, 0.06, 0.12, 0.18, 0.24] }
  },
  {
    id: 'bremse', name: 'Bremse & Handbremse', beschreibung: 'Mehr Bremskraft und eine bissigere Handbremse.', gewicht: 0.6,
    werte: { bremse: [1, 1.08, 1.16, 1.24, 1.32], handbremse: [1, 1.06, 1.12, 1.18, 1.24] }
  },
  {
    id: 'gewicht', name: 'Gewichtsreduktion', beschreibung: 'Weniger Gewicht: besseres Beschleunigen, Bremsen und Einlenken.', gewicht: 1.1,
    werte: { masse: [1, 0.97, 0.94, 0.91, 0.88] }
  }
];

export const TUNING_IDS = TUNING.map((t) => t.id);
const tuningNachId = new Map(TUNING.map((t) => [t.id, t]));
export function tuningDaten(id) {
  return tuningNachId.get(id) || null;
}

// ---------------------------------------------------------------------------
// Preise

const globaleListen = {
  finish: FINISHS,
  muster: MUSTER,
  felge: FELGEN,
  aufkleber: AUFKLEBER_PAKETE,
  qualm: QUALM,
  extra: EXTRAS
};

/** Runden auf „schöne“ Preise (auf 10). */
function rund(p) {
  return Math.max(0, Math.round(p / 10) * 10);
}

/**
 * Liefert {preis, autoGebunden, name} für eine Kauf-ID oder null, wenn unbekannt.
 * @param {string} kaufId
 * @param {string} [autoId] für autogebundene Teile
 */
export function teilInfo(kaufId, autoId) {
  if (typeof kaufId !== 'string') return null;
  const [art, a, b] = kaufId.split(':');
  if (globaleListen[art]) {
    const e = globaleListen[art].find((x) => x.id === a);
    if (!e || b !== undefined) return null;
    return { preis: e.preis, autoGebunden: false, name: e.name, art };
  }
  const faktor = AUTO_PREISFAKTOR[autoId];
  if (art === 'teil') {
    const slot = slotNachId.get(a);
    const v = Number(b);
    if (!slot || !Number.isInteger(v) || v < 0 || v > slot.varianten.length - 1 || faktor === undefined) return null;
    const preis = v === 0 ? 0 : Math.max(TEIL_MINDESTPREIS, rund(slot.preise[v - 1] * faktor));
    return { preis, autoGebunden: true, name: `${slot.name}: ${slot.varianten[v]}`, art };
  }
  if (art === 'tuning') {
    const t = tuningNachId.get(a);
    const s = Number(b);
    if (!t || !Number.isInteger(s) || s < 1 || s > 5 || faktor === undefined) return null;
    const preis = s === 1 ? 0 : Math.max(STUFEN_MINDESTPREISE[s - 1], rund(STUFEN_PREISE[s - 1] * t.gewicht * faktor));
    return { preis, autoGebunden: true, name: `${t.name} – ${STUFEN_NAMEN[s - 1]}`, art };
  }
  return null;
}

/** Alle Kauf-IDs, die von Beginn an kostenlos im Besitz sind (global). */
export const GRATIS_GLOBAL = [
  ...FINISHS.filter((x) => x.preis === 0).map((x) => 'finish:' + x.id),
  ...MUSTER.filter((x) => x.preis === 0).map((x) => 'muster:' + x.id),
  ...FELGEN.filter((x) => x.preis === 0).map((x) => 'felge:' + x.id),
  ...AUFKLEBER_PAKETE.filter((x) => x.preis === 0).map((x) => 'aufkleber:' + x.id),
  ...QUALM.filter((x) => x.preis === 0).map((x) => 'qualm:' + x.id)
];

/** Alle Kauf-IDs, die je Auto kostenlos sind (Serien-Teile und Serien-Tuning). */
export function gratisFuerAuto() {
  const ids = [];
  for (const s of SLOTS) ids.push(`teil:${s.id}:0`);
  for (const t of TUNING) ids.push(`tuning:${t.id}:1`);
  return ids;
}

/** Liste aller globalen kaufbaren Kauf-IDs. */
export function alleGlobalenIds() {
  const ids = [];
  for (const [art, liste] of Object.entries(globaleListen)) for (const e of liste) ids.push(`${art}:${e.id}`);
  return ids;
}

/** Liste aller autogebundenen Kauf-IDs. */
export function alleAutoIds() {
  const ids = [];
  for (const s of SLOTS) for (let v = 0; v < s.varianten.length; v++) ids.push(`teil:${s.id}:${v}`);
  for (const t of TUNING) for (let st = 1; st <= 5; st++) ids.push(`tuning:${t.id}:${st}`);
  return ids;
}

// ---------------------------------------------------------------------------
// Setup-Regler (kostenlos). Werte sind normiert und werden in tuning.js in Physik übersetzt.
export const SETUP_REGLER = [
  { id: 'sturz', name: 'Sturz-Setup', min: 0, max: 1, schritt: 0.05, standard: 0.5, links: 'mehr Grip gerade', rechts: 'mehr Seitenhalt' },
  { id: 'sperrgrad', name: 'Sperrgrad', min: 0, max: 1, schritt: 0.05, standard: 0.5, links: 'offen', rechts: 'gesperrt' },
  { id: 'lenkwinkel', name: 'Lenkwinkel', min: 0, max: 1, schritt: 0.05, standard: 0.5, links: 'wenig', rechts: 'viel' },
  { id: 'gaskennlinie', name: 'Gaskennlinie', min: 0, max: 1, schritt: 0.05, standard: 0.5, links: 'sanft', rechts: 'direkt' },
  { id: 'bremsbalance', name: 'Bremsbalance', min: 0, max: 1, schritt: 0.05, standard: 0.5, links: 'hinten', rechts: 'vorne' },
  { id: 'federhaerte', name: 'Federhärte', min: 0, max: 1, schritt: 0.05, standard: 0.5, links: 'weich', rechts: 'hart' }
];

export function standardSetup(name = 'Setup') {
  const werte = {};
  for (const r of SETUP_REGLER) werte[r.id] = r.standard;
  return { name, werte };
}
