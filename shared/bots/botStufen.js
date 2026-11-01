// Bot-Stufen (Richtwerte aus SPEC.md, Abschnitt 7.3) und ihre Regler-Parameter.
// Die Spalte „Ziel-Punkte als Führer“ wird per Simulationstest geprüft (tests/bots.test.js).

export const BOT_STUFEN = [
  {
    id: 'anfaenger', name: 'Anfänger',
    sollWinkel: [20, 30], linienAbweichung: 3.0, reaktion: 0.35, fehlerQuote: 0.3,
    tempoFaktor: 0.84, verfolgerGenauigkeit: 0.45, zielPunkte: [35, 50]
  },
  {
    id: 'fahrer', name: 'Fahrer',
    sollWinkel: [25, 40], linienAbweichung: 2.2, reaktion: 0.28, fehlerQuote: 0.22,
    tempoFaktor: 0.88, verfolgerGenauigkeit: 0.6, zielPunkte: [40, 55]
  },
  {
    id: 'profi', name: 'Profi',
    sollWinkel: [30, 45], linienAbweichung: 1.5, reaktion: 0.2, fehlerQuote: 0.14,
    tempoFaktor: 0.92, verfolgerGenauigkeit: 0.74, zielPunkte: [55, 70]
  },
  {
    id: 'meister', name: 'Meister',
    sollWinkel: [35, 55], linienAbweichung: 0.9, reaktion: 0.14, fehlerQuote: 0.07,
    tempoFaktor: 0.96, verfolgerGenauigkeit: 0.86, zielPunkte: [70, 85]
  },
  {
    id: 'legende', name: 'Legende',
    sollWinkel: [35, 55], linienAbweichung: 0.4, reaktion: 0.09, fehlerQuote: 0.025,
    tempoFaktor: 1.0, verfolgerGenauigkeit: 0.95, zielPunkte: [85, 97]
  }
];

/** „Idealfahrt“ ohne Fehler und Streuung – damit wird die Referenzpunktzahl je Strecke ermittelt. */
export const IDEAL_STUFE = {
  id: 'ideal', name: 'Ideal',
  sollWinkel: [35, 55], linienAbweichung: 0, reaktion: 0.05, fehlerQuote: 0,
  tempoFaktor: 1.0, verfolgerGenauigkeit: 1, zielPunkte: [100, 100]
};

export function botStufe(id) {
  if (id === 'ideal') return IDEAL_STUFE;
  const s = BOT_STUFEN.find((b) => b.id === id);
  if (!s) throw new Error('Unbekannte Bot-Stufe: ' + id);
  return s;
}
