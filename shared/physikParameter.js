// Globale Fahrphysik-Parameter (für alle Autos). Werte je Auto stehen in autos.js.
// Alle Größen in SI-Einheiten. Kommentare erklären die Wirkung aufs Fahrgefühl.

export const PHYSIK = {
  // --- Zeitschritt ---
  dt: 1 / 60, // fester Physik-Schritt (s)
  unterschritte: 2, // Unterschritte pro Physik-Schritt (Stabilität bei hoher Gierrate)
  maxSchritteProFrame: 5, // danach wird Restzeit verworfen

  // --- Welt ---
  g: 9.81,

  // --- Sicherheitsgrenzen (gegen Aufschaukeln/NaN) ---
  maxTempo: 95, // m/s (≈ 342 km/h), harte Obergrenze
  maxGierrate: 5.5, // rad/s
  maxDriftWinkelVoll: Math.PI, // Drehwinkel des Autos ist frei, Grenzen nur für Raten

  // --- Reifen (vereinfachte Pacejka-Form: sin(C·atan(B·α))) ---
  reifen: {
    mu: 1.1, // Grund-Reibwert (wird mit dem Grip des Autos multipliziert)
    spitzeVorneGrad: 9.5, // Schräglaufwinkel der maximalen Seitenkraft vorne
    spitzeHintenGrad: 12, // … hinten (größer → gutmütigerer Drift)
    formC: 1.32, // Formfaktor: bestimmt, wie stark die Kraft nach der Spitze abfällt
    gleitAnteil: 0.9, // Reibwert-Anteil beim vollen Durchrutschen vorne (Kraft bei sehr großem Schlupf)
    gleitAnteilHinten: 0.76, // … hinten (Arcade: Heck bricht klar aus und lässt sich im Drift halten)
    lastEmpfindlichkeit: 0.08, // mehr Last → etwas weniger Reibwert (pro 100 % Mehrlast)
    niedrigTempo: 2.5, // unterhalb (m/s) werden Schräglaufwinkel gedämpft (kein Zittern im Stand)
    seitlicheLastVerlust: 0.22, // Grip-Verlust einer Achse durch Querlastverlagerung (bei 100 % Verlagerung)
    laengsSpitze: 0.12, // Längsschlupf (Anteil) der maximalen Antriebs-/Bremskraft hinten
    bezugsTempoMin: 2.0 // m/s: Mindest-Bezugsgeschwindigkeit für die Schlupfberechnung hinten
  },

  // --- Antrieb ---
  antrieb: {
    wirkungsgrad: 0.86,
    motorBremse: 0.16, // Anteil des Spitzendrehmoments als Motorbremse beim Gaswegnehmen
    schaltHoch: 0.94, // Hochschalten bei diesem Anteil der Maximaldrehzahl (Automatik)
    schaltRunter: 0.38, // Runterschalten unterhalb dieses Anteils
    begrenzerSchnitt: 0.05, // Zündunterbrechung am Begrenzer (s)
    drehzahlTraegheit: 0.06, // Zeitkonstante der Drehzahlanzeige im ausgekuppelten Zustand (s)
    radTraegheit: 2.6, // kg·m², beide Hinterräder inkl. Bremsscheiben und Antriebswelle
    motorTraegheit: 0.16, // kg·m², Schwungmasse des Motors (wirkt mit Übersetzung² auf die Räder)
    handbremsFaktor: 1.5, // Handbremsmoment in Vielfachen des Haftmoments der Hinterachse
    schleifDrehzahl: 0.5, // Anteil der Maximaldrehzahl, bis zu dem die Kupplung beim Anfahren schleift
    kupplungsKickDauer: 0.35, // s
    kupplungsKickFaktor: 1.85, // kurzzeitiger Drehmoment-Multiplikator
    kupplungsKickSperre: 0.6, // s bis zum nächsten Kick
    rueckwaertsVerzoegerung: 0.3, // Bremse halten im Stand → nach 0,3 s Rückwärtsgang
    rueckwaertsMaxTempo: 9, // m/s
    rueckwaertsKraftAnteil: 0.45,
    stillstandSchwelle: 0.6 // m/s
  },

  // --- Lenkung ---
  lenkung: {
    maxWinkelSchnellGrad: 13, // maximaler Einschlag bei hoher Geschwindigkeit
    abfallTempo: 34, // m/s, ab hier gilt der kleine Einschlag
    gegenlenkZusatzGrad: 16, // zusätzlicher Einschlag erlaubt, wenn gegengelenkt wird (Drift)
    rate: 3.6, // rad/s Lenkgeschwindigkeit
    rueckstellRate: 5.5, // rad/s Selbstzentrierung ohne Eingabe
    touchGlaettung: 0.07 // s Zeitkonstante für Touch-/Neigungslenkung
  },

  // --- Assistenzen ---
  assistenz: {
    gegenlenkStartGrad: 4, // ab diesem Schwimmwinkel greift die Gegenlenk-Assistenz
    gegenlenkVollGrad: 14, // ab hier voll wirksam
    gegenlenkSpielraumGrad: 20, // Spielereingabe verschiebt den Einschlag um ± diesen Wert um die Bewegungsrichtung
    driftHaltenZielGrad: 36, // Drift-Haltehilfe peilt diesen Winkel an
    driftHaltenStartGrad: 12,
    driftHaltenMinTempo: 9 // m/s
  },

  // --- Stabilität / Gierdämpfung (Arcade-Hilfe, dokumentiert) ---
  stabilitaet: {
    gierDaempfung: 0.22, // Anteil der Gierrate, der pro Sekunde abgebaut wird (× Auto-Faktor)
    driftDaempfung: 0.08, // zusätzliche Dämpfung bei großen Driftwinkeln > 70°
    driftDaempfungAbGrad: 70,
    stillstandDaempfung: 4.0 // starke Dämpfung bei sehr kleiner Geschwindigkeit
  },

  // --- Lastverlagerung ---
  last: {
    glaettung: 0.08, // s Zeitkonstante für Längs-/Querbeschleunigung (Federung)
    maxVerlagerung: 0.75 // maximaler Anteil der Achslast, der verlagert werden kann
  },

  // --- Kollision ---
  kollision: {
    wandRestitution: 0.22, // Abprallen an Wänden
    wandReibung: 0.3, // Reibung entlang der Wand
    wandSpeedVerlustFrontal: 0.5, // zusätzlicher Tempoverlust bei frontalem Aufprall
    gierStoerung: 0.6, // Faktor für die Gierrate-Störung durch den Stoß
    autoRadius: 0.95, // Radius der Kollisionskreise (wird mit Fahrzeugbreite skaliert)
    autoWeichheit: 0.35, // Anteil der Überlappung, der pro Schritt aufgelöst wird (weich)
    autoGeschwAngleich: 0.15, // Anteil der Annäherungsgeschwindigkeit, der abgebaut wird
    autoKontaktAbstand: 0.15 // m Toleranz für Kontaktmeldung
  },

  // --- Hänger-Erkennung ---
  haenger: {
    stillstandTempo: 1.2, // m/s – darunter gilt das Auto als stehend
    knopfNach: 4, // s bis „Zurücksetzen“ angeboten wird
    automatischNach: 8 // s bis automatisch zurückgesetzt wird
  }
};
