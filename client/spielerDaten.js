// Hilfen für den Zugriff auf Spielerdaten aus dem Spielstand.

/** Eintrag des aktiven Autos. */
export function aktivesAuto(daten) {
  return daten.autos.find((a) => a.id === daten.aktivesAuto) || daten.autos[0];
}

/** Konfiguration des aktiven Autos für ein Rennen (Look, Tuning, Setup, Name). */
export function aktivesAutoKonfig(daten) {
  const a = aktivesAuto(daten);
  return {
    autoId: a.id,
    look: a.looks[a.aktiverLook].look,
    tuning: a.tuning,
    setup: a.setups[a.aktivesSetup],
    name: daten.spielerName
  };
}

/** Ist eine Strecke freigeschaltet? */
export function streckeFrei(daten, id) {
  return daten.fortschritt.strecken.includes(id);
}
