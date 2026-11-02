// Strecke 1: Industriehof (Tag). Große, flache Betonfläche mit Containern, Reifenstapeln, Paletten
// und einer technischen Schleife. Einsteigerfreundlich, breit, ca. 900 m.
export default {
  id: 'industriehof',
  name: 'Industriehof',
  beschreibung: 'Weite Betonfläche zwischen Containern und Reifenstapeln. Viel Platz für die ersten Drifts.',
  schwierigkeit: 1,
  tageszeit: 'Tag',
  breite: 22,
  rand: 3.5,
  wand: 'beton',
  start: { x: 0, y: 0, richtung: 0 },
  startVersatz: 20,
  segmente: [
    { typ: 'gerade', laenge: 125, breite: 22 },
    {
      typ: 'bogen', radius: 34, winkel: 180, breite: 28, wandL: 'reifen',
      zone: { name: 'Container-Kehre', art: 'kreis', winkel: [30, 55], minTempo: 40 },
      hindernisse: [{ art: 'reifenstapel', r: 3.2, t: 0.5, q: 24 }]
    },
    { typ: 'gerade', laenge: 45, breite: 24 },
    {
      typ: 'bogen', radius: 36, winkel: -50, breite: 22, wandR: 'container',
      zone: { name: 'Slalom links', art: 'slalom', winkel: [25, 45], minTempo: 45 },
      hindernisse: [{ form: 'rechteck', art: 'container', hb: 1.25, hl: 6, t: 0.55, q: -16.5, winkel: 10 }]
    },
    {
      typ: 'bogen', radius: 36, winkel: 100, breite: 22, wandL: 'container',
      zone: { name: 'Slalom rechts', art: 'slalom', winkel: [25, 50], minTempo: 45 },
      hindernisse: [{ form: 'rechteck', art: 'container', hb: 1.25, hl: 6, t: 0.5, q: 16.5, winkel: -5 }]
    },
    { typ: 'bogen', radius: 36, winkel: -50, breite: 22, wandR: 'container' },
    { typ: 'gerade', laenge: 40, breite: 22 },
    { typ: 'bogen', radius: 24, winkel: -65, breite: 20 },
    {
      typ: 'bogen', radius: 24, winkel: 130, breite: 20, wandL: 'reifen',
      zone: { name: 'Technische Schleife', art: 'kurve', winkel: [35, 60], minTempo: 36 },
      hindernisse: [{ art: 'pylon', r: 1.2, t: 0.5, q: 17 }]
    },
    { typ: 'bogen', radius: 24, winkel: -65, breite: 20 },
    { typ: 'gerade', laenge: 35, breite: 24 },
    {
      typ: 'bogen', radius: 34, winkel: 180, breite: 26, wandL: 'reifen',
      zone: { name: 'Reifenstapel-Kreis', art: 'kreis', winkel: [35, 60], minTempo: 38 },
      hindernisse: [{ art: 'reifenstapel', r: 3.5, t: 0.5, q: 22 }]
    },
    { typ: 'gerade', laenge: 32, breite: 22 },
    { typ: 'bogen', radius: 70, winkel: -32, breite: 24 },
    {
      typ: 'bogen', radius: 70, winkel: 64, breite: 26,
      zone: { name: 'Lange Kurve', art: 'kurve', winkel: [25, 45], minTempo: 50 }
    },
    { typ: 'bogen', radius: 70, winkel: -32, breite: 24 },
    { typ: 'schliessen' }
  ],
  idealRand: 4,
  idealMischung: 0.65,
  idealHaftung: 0.9,
  idealMaxKmh: 115,
  referenzZeit: 53.1,
  referenzPunkte: { fuehrer: 98.8, verfolger: 41.1 },
  botAuslassen: { anfaenger: 0.81, fahrer: 0.66, profi: 0.59, meister: 0.3, legende: 0.05 },
  boden: 'beton',
  wetter: 'staub',
  licht: {
    himmelOben: '#2e66d8',
    himmelHorizont: '#d8e8ff',
    himmelUnten: '#8c8f96',
    sonneFarbe: '#fff1cf',
    sonneRichtung: [0.5, 0.7, 0.35],
    sonneIntensitaet: 2.8,
    hemiOben: '#d9e8ff',
    hemiUnten: '#6a6156',
    hemiIntensitaet: 1.0,
    nebelFarbe: '#cddff5',
    nebelNah: 150,
    nebelFern: 650,
    belichtung: 1.0,
    envIntensitaet: 1.0
  },
  deko: { container: 70, reifenstapel: 40, paletten: 50, lampen: 18, hallen: 6, kraene: 0, baeume: 0, felsen: 0 }
};
