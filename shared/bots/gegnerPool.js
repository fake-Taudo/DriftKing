// Gegner-Pool: 16 frei erfundene Bot-Fahrer (keine echten Personen, Marken oder Teams) mit Rang,
// Auto und fertig gestaltetem Look. Vorschlag nach Fortschritt, Stufe frei wählbar (soweit frei).
import { standardLook } from '../look.js';
import { BOT_STUFEN } from './botStufen.js';

/** Baut einen Bot-Look aus kompakten Angaben auf Basis des Serien-Looks. */
function look(autoId, o) {
  const l = standardLook(autoId);
  l.lack = { ...l.lack, farbe1: o.farbe1, farbe2: o.farbe2 ?? l.lack.farbe2, finish: o.finish ?? 'glanz', zweitDach: !!o.zweitDach, zweitHaube: !!o.zweitHaube, zweitSpiegel: !!o.zweitSpiegel };
  if (o.muster) l.muster = { id: o.muster, farbe: o.musterFarbe ?? '#ffffff', deckkraft: o.musterDeckkraft ?? 0.9, skala: o.musterSkala ?? 1 };
  l.felgen = { ...l.felgen, design: o.felge ?? l.felgen.design, farbe: o.felgeFarbe ?? l.felgen.farbe, zierring: o.zierring ?? o.felgeFarbe ?? l.felgen.zierring, groesse: o.groesse ?? l.felgen.groesse, sattel: o.sattel ?? l.felgen.sattel };
  for (const [slot, v] of Object.entries(o.teile || {})) l.teile[slot] = { ...l.teile[slot], variante: v, farbe: o.teileFarbe ?? '#1b1c22' };
  l.fahrwerk = { ...l.fahrwerk, tiefe: o.tiefe ?? 0.6, sturzV: o.sturzV ?? -2, sturzH: o.sturzH ?? -3, spur: o.spur ?? 0.4 };
  if (o.qualm) l.qualm = o.qualm;
  if (o.neon) l.neon = { an: true, farbe: o.neon, helligkeit: 0.8, puls: !!o.neonPuls };
  if (o.scheinwerfer) l.scheinwerfer = o.scheinwerfer;
  l.scheiben = o.scheiben ?? 2;
  l.backfire = o.backfire ?? 0.4;
  l.kennzeichen = o.kennzeichen;
  return l;
}

export const GEGNER = [
  { id: 'mika', name: 'Mika Vogt', spitzname: 'Funke', stufe: 'anfaenger', autoId: 'kestrel_s',
    look: look('kestrel_s', { farbe1: '#ffb020', farbe2: '#1b1c22', zweitHaube: true, felge: 'stahl', felgeFarbe: '#e8e8e8', kennzeichen: 'FUNKE' }) },
  { id: 'lena', name: 'Lena Brandt', spitzname: 'Blitzstart', stufe: 'anfaenger', autoId: 'marlin_4d',
    look: look('marlin_4d', { farbe1: '#4fb3ff', finish: 'metallic', felge: 'mehrspeichen', felgeFarbe: '#c9ccd2', kennzeichen: 'LB 24' }) },
  { id: 'tarek', name: 'Tarek Sommer', spitzname: 'Sonnenschein', stufe: 'anfaenger', autoId: 'kestrel_s',
    look: look('kestrel_s', { farbe1: '#2fd17a', farbe2: '#ffffff', zweitDach: true, muster: 'rennstreifen', felge: 'fuenfspeichen', felgeFarbe: '#ffffff', kennzeichen: 'TS 07' }) },
  { id: 'jule', name: 'Jule Kranich', spitzname: 'Kranich', stufe: 'fahrer', autoId: 'vireo_turbo',
    look: look('vireo_turbo', { farbe1: '#f2f2f2', farbe2: '#e8452c', zweitDach: true, muster: 'seitenblitz', musterFarbe: '#e8452c', felge: 'kreuzspeichen', felgeFarbe: '#202228', teile: { frontstoss: 1, spoiler: 2 }, kennzeichen: 'KRANICH' }) },
  { id: 'ole', name: 'Ole Haldorsen', spitzname: 'Nordwind', stufe: 'fahrer', autoId: 'hornet_wagon',
    look: look('hornet_wagon', { farbe1: '#2e4a6b', finish: 'satin', felge: 'wabe', felgeFarbe: '#d7a83e', teile: { dach: 2, schweller: 1 }, qualm: '#3b8bff', kennzeichen: 'NORD 1' }) },
  { id: 'nina', name: 'Nina Falk', spitzname: 'Falke', stufe: 'fahrer', autoId: 'marlin_4d',
    look: look('marlin_4d', { farbe1: '#7a1f2b', finish: 'metallic', muster: 'doppelstreifen', musterFarbe: '#f4f4f4', felge: 'y_speichen', felgeFarbe: '#c9ccd2', teile: { frontstoss: 2, heckstoss: 1 }, kennzeichen: 'FALKE' }) },
  { id: 'pia', name: 'Pia Querlage', spitzname: 'Quer', stufe: 'fahrer', autoId: 'kestrel_s',
    look: look('kestrel_s', { farbe1: '#b15cff', finish: 'perleffekt', felge: 'scheibe', felgeFarbe: '#ffffff', teile: { verbreiterung: 1, spoiler: 1 }, qualm: '#a24bff', kennzeichen: 'QUER 9' }) },
  { id: 'rico', name: 'Rico Venn', spitzname: 'Turbo-Rico', stufe: 'profi', autoId: 'vireo_turbo',
    look: look('vireo_turbo', { farbe1: '#111216', farbe2: '#2ee6ff', zweitSpiegel: true, finish: 'matt', muster: 'geometrie', musterFarbe: '#2ee6ff', felge: 'turbine', felgeFarbe: '#2ee6ff', teile: { frontstoss: 3, heckstoss: 2, schweller: 2, spoiler: 3 }, neon: '#2ee6ff', kennzeichen: 'VENN 3' }) },
  { id: 'selma', name: 'Selma Ruhr', spitzname: 'Dampfhammer', stufe: 'profi', autoId: 'bastion_gt',
    look: look('bastion_gt', { farbe1: '#c43c2c', farbe2: '#111216', zweitHaube: true, muster: 'rennstreifen', musterFarbe: '#111216', felge: 'tiefbett', felgeFarbe: '#c9ccd2', teile: { haube: 1, verbreiterung: 2, auspuff: 2 }, qualm: '#ff3b3b', kennzeichen: 'RUHR 77' }) },
  { id: 'joscha', name: 'Joscha Lind', spitzname: 'Lange Leine', stufe: 'profi', autoId: 'hornet_wagon',
    look: look('hornet_wagon', { farbe1: '#e9ecf2', farbe2: '#3fae6a', zweitDach: true, muster: 'retro', musterFarbe: '#3fae6a', felge: 'netz', felgeFarbe: '#d7a83e', teile: { frontstoss: 2, dach: 1, spoiler: 2 }, kennzeichen: 'LIND 5' }) },
  { id: 'kaya', name: 'Kaya Morell', spitzname: 'Nachtfalter', stufe: 'meister', autoId: 'onyx_rs',
    look: look('onyx_rs', { farbe1: '#1a1d3a', farbe2: '#ff3d6e', finish: 'perleffekt', muster: 'wellen', musterFarbe: '#ff3d6e', musterDeckkraft: 0.7, felge: 'dreispeichen', felgeFarbe: '#ff3d6e', teile: { frontstoss: 3, schweller: 3, heckstoss: 3, spoiler: 4 }, neon: '#ff3d6e', neonPuls: true, qualm: '#ff8a1f', kennzeichen: 'MOTTE' }) },
  { id: 'bruno', name: 'Bruno Kessel', spitzname: 'Kessel', stufe: 'meister', autoId: 'bastion_gt',
    look: look('bastion_gt', { farbe1: '#2b2f38', finish: 'satin', muster: 'flammen', musterFarbe: '#ff8a1f', felge: 'stern', felgeFarbe: '#202228', teile: { haube: 3, verbreiterung: 3, spoiler: 1, auspuff: 3 }, qualm: '#1b1b1f', backfire: 1, kennzeichen: 'KESSEL' }) },
  { id: 'ida', name: 'Ida Wenzel', spitzname: 'Wirbel', stufe: 'meister', autoId: 'vireo_turbo',
    look: look('vireo_turbo', { farbe1: '#f2c230', farbe2: '#111216', zweitHaube: true, zweitDach: true, finish: 'glanz', muster: 'kacheln', musterFarbe: '#111216', musterDeckkraft: 0.5, felge: 'turbine', felgeFarbe: '#111216', teile: { frontstoss: 2, heckstoss: 3, verbreiterung: 2, spoiler: 5 }, qualm: '#f2c230', kennzeichen: 'WIRBEL' }) },
  { id: 'viktor', name: 'Viktor Hallström', spitzname: 'Der Graf', stufe: 'legende', autoId: 'onyx_rs',
    look: look('onyx_rs', { farbe1: '#d8dce6', finish: 'chrom', felge: 'netz', felgeFarbe: '#202228', zierring: '#d7a83e', teile: { frontstoss: 2, schweller: 2, heckstoss: 2, spoiler: 3, spiegel: 2 }, qualm: 'regenbogen', neon: '#ffd166', kennzeichen: 'GRAF 1' }) },
  { id: 'mara', name: 'Mara Seitwind', spitzname: 'Seitwind', stufe: 'legende', autoId: 'bastion_gt',
    look: look('bastion_gt', { farbe1: '#0f5c4a', farbe2: '#ffd166', zweitSpiegel: true, finish: 'metallic', muster: 'seitenblitz', musterFarbe: '#ffd166', felge: 'tiefbett', felgeFarbe: '#ffd166', teile: { frontstoss: 3, haube: 2, verbreiterung: 3, spoiler: 4, auspuff: 1 }, qualm: '#33e07a', kennzeichen: 'SEITE' }) },
  { id: 'kenji', name: 'Kenji Aoba', spitzname: 'Blaues Blatt', stufe: 'legende', autoId: 'vireo_turbo',
    look: look('vireo_turbo', { farbe1: '#1f4fd6', farbe2: '#ffffff', zweitDach: true, finish: 'perleffekt', muster: 'verlauf', musterFarbe: '#2ee6ff', felge: 'mehrspeichen', felgeFarbe: '#ffffff', teile: { frontstoss: 3, schweller: 3, verbreiterung: 2, dach: 3, spoiler: 4 }, neon: '#2ee6ff', qualm: '#3b8bff', kennzeichen: 'AOBA 8' }) }
];

export function gegnerDaten(id) {
  return GEGNER.find((g) => g.id === id) || null;
}

/** Gegner einer Stufe. */
export function gegnerDerStufe(stufe) {
  return GEGNER.filter((g) => g.stufe === stufe);
}

/** Autos, die die Gegner einer Stufe fahren (für Kalibrierung und Tests der Bot-Stufen). */
export function autosDerStufe(stufe) {
  return gegnerDerStufe(stufe).map((g) => g.autoId);
}

/**
 * Vorschlag nach Fortschritt: höchste freigeschaltete Stufe, deren Erstsieg auf der Strecke fehlt;
 * sonst die höchste freigeschaltete Stufe. Innerhalb der Stufe wechselnde Gegner.
 */
export function gegnerVorschlag(daten, streckeId) {
  const frei = BOT_STUFEN.filter((s) => daten.fortschritt.botStufen.includes(s.id)).map((s) => s.id);
  let stufe = frei.find((s) => !daten.fortschritt.erstSiege[`${streckeId}:${s}`]) || frei[frei.length - 1];
  const kandidaten = gegnerDerStufe(stufe);
  const n = daten.statistik.battles || 0;
  return kandidaten[n % kandidaten.length];
}
