// Alle Konstanten der Jury-Logik (Formeln siehe shared/wertung.js und docs/WERTUNG.md).

export const WERTUNG = {
  tickRate: 20, // Wertungs-Ticks pro Sekunde (alle Modi, auch online)
  basis: 1, // Rohpunkte-Basis pro Tick

  // Gültigkeit eines Wertungs-Ticks
  minTempoKmh: 40, // Führer: Mindesttempo
  minTempoVerfolgerKmh: 30,
  minWinkel: 10, // Grad

  // f_winkel: Trapez über dem Driftwinkel (Grad)
  winkel: { null: 10, vollAb: 30, vollBis: 55, nullBei: 85 },

  // f_tempo: Tempo / Referenztempo der Zone, begrenzt
  tempoMax: 1.2,

  // f_zone
  zoneInnen: 1.0,
  zoneAussen: 0.25,

  // f_linie = 1 − min(1, Abstand / Toleranz) · 0,6
  linienToleranz: 5.0, // m
  linienAnteil: 0.6,

  // Combo
  comboMin: 1.0,
  comboMax: 3.0,
  comboProSekunde: 0.1,
  comboGnadenzeit: 1.0, // s ohne Drift, bevor die Combo zurückfällt (Übergänge)

  // Verfolger
  abstand: { sweetMin: 6, sweetMax: 10, nullBei: 30, nahGrenze: 5, nahWert: 0.5, nahBei: 3 },
  gleichwinkelSpanne: 30, // Grad
  verfolgerOhneDrift: 0.2,
  aufschliessZeit: 3.0, // s ohne Verfolger-Wertung nach dem Start

  // Abzüge und Boni (in normierten Punkten, Skala 0–100)
  abzugWand: 3,
  wandSperre: 1.0, // s ohne Punkte nach Wandkontakt
  abzugAutoKontakt: 1,
  autoKontaktSperre: 0.6, // s, bis derselbe Kontakt erneut zählt
  abzugZuruecksetzen: 10,
  spinWinkel: 100, // Grad – darüber gilt ein Dreher (Combo-Reset)
  stillstandTempo: 2, // m/s – Stillstand in einer Zone = Dreher
  fluessigBonus: 1.5,
  fluessigMaxZeit: 1.2, // s für den Richtungswechsel
  fluessigMinTempoAnteil: 0.5, // Tempo darf nicht unter 50 % der Zonengeschwindigkeit fallen
  fluessigMinDauer: 1.0, // s: der vorherige Drift muss so lange gehalten worden sein (kein Zickzack-Wackeln)
  fluessigMinWinkel: 25, // Grad: … und mindestens diesen Winkel erreicht haben
  fluessigAbstand: 2.0, // s Mindestabstand zwischen zwei Boni

  // Wandkontakt-Erkennung aus dem Zustand (Kreise der Karosserie gegen die Wände)
  wandToleranz: 0.06, // m

  // Fairness: Verfolger-Punkte = VerfolgerNorm · (0,5 + 0,5 · Führerpunkte / 100)
  verfolgerSockel: 0.5,

  // Gleichstand: Laufdifferenz unter diesem Wert → Wiederholung
  gleichstandGrenze: 3
};
