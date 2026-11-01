// Alle Texte der Spieloberfläche (Deutsch). Zugriff über t('bereich.schluessel', {platzhalter}).
// Platzhalter im Text: {name}. Zahlen werden vor dem Einsetzen nicht formatiert – dafür zahl().

export const TEXTE = {
  allgemein: {
    spielname: 'DRIFTKÖNIG',
    laden: 'Lädt …',
    zurueck: 'Zurück',
    weiter: 'Weiter',
    ok: 'OK',
    abbrechen: 'Abbrechen',
    bestaetigen: 'Bestätigen',
    schliessen: 'Schließen',
    ja: 'Ja',
    nein: 'Nein',
    an: 'An',
    aus: 'Aus',
    speichern: 'Speichern',
    kopieren: 'Kopieren',
    kopiert: 'In die Zwischenablage kopiert',
    einfuegen: 'Einfügen',
    muenzen: 'Driftmünzen',
    muenzenKurz: '{n} DM',
    neuLaden: 'Neu laden',
    fehlerKopieren: 'Kopieren nicht möglich – bitte manuell markieren.',
    gesperrt: 'Gesperrt',
    neu: 'NEU',
    kmh: 'km/h',
    grad: '°',
    sekunden: 's',
    meter: 'm'
  },

  fehler: {
    titel: 'Ups – da ist etwas schiefgelaufen',
    text: 'Ein unerwarteter Fehler ist aufgetreten. Dein Spielstand ist gesichert. Lade das Spiel neu, um weiterzuspielen.',
    details: 'Technische Details',
    webglTitel: '3D-Grafik nicht verfügbar',
    webglText: 'Dein Browser oder Gerät unterstützt WebGL 2 nicht (oder es ist deaktiviert). DRIFTKÖNIG braucht WebGL 2. Bitte nutze ein aktuelles Chrome, Edge, Firefox oder Safari (ab iOS 16) und aktiviere die Hardware-Beschleunigung.',
    kontextVerloren: 'Grafik wird wiederhergestellt …',
    kontextVerlorenText: 'Das Gerät hat die 3D-Grafik kurz zurückgesetzt. Einen Moment bitte.'
  },

  speicher: {
    keinSpeicher: 'Speichern nicht möglich (z. B. privater Modus). Dein Fortschritt geht beim Schließen verloren.',
    backupGeladen: 'Dein Spielstand war beschädigt. Die letzte gültige Sicherung wurde geladen.',
    neuerSpielstand: 'Dein Spielstand war beschädigt und konnte nicht wiederhergestellt werden. Ein neuer Spielstand wurde angelegt.',
    migriert: 'Dein Spielstand wurde auf die neue Version aktualisiert.',
    exportDatei: 'Als Datei exportieren',
    exportCode: 'Als Text-Code exportieren',
    importDatei: 'Datei importieren',
    importCode: 'Text-Code importieren',
    importErfolg: 'Spielstand erfolgreich importiert.',
    importFehler: 'Import fehlgeschlagen: {grund}',
    importBestaetigen: 'Der aktuelle Spielstand wird überschrieben. Fortfahren?',
    codeTitel: 'Spielstand-Code',
    codeHinweis: 'Kopiere diesen Code und bewahre ihn sicher auf. Mit ihm kannst du deinen Spielstand auf einem anderen Gerät importieren.',
    codeEingeben: 'Füge hier deinen Spielstand-Code ein:',
    gruende: {
      leer: 'Keine Daten gefunden.',
      zu_gross: 'Die Daten sind zu groß.',
      json: 'Die Daten sind kein gültiges Format.',
      format: 'Das ist kein DRIFTKÖNIG-Spielstand.',
      pruefsumme: 'Die Prüfsumme stimmt nicht – die Daten sind beschädigt oder verändert.',
      schema: 'Die Daten enthalten ungültige Werte.',
      version_neuer: 'Der Spielstand stammt aus einer neueren Spielversion.',
      version_unbekannt: 'Unbekannte Spielstand-Version.',
      ungueltige_zeichen: 'Der Code enthält ungültige Zeichen.',
      kompression_fehlt: 'Dein Browser kann diesen Code nicht entpacken. Bitte aktualisiere ihn.'
    }
  },

  pwa: {
    update: 'Neue Version verfügbar – neu laden',
    homeBildschirm: 'Tipp: Füge DRIFTKÖNIG zum Home-Bildschirm hinzu (Teilen → „Zum Home-Bildschirm“), um im Vollbild zu spielen.',
    offline: 'Offline – Online-Duelle sind gerade nicht verfügbar.'
  },

  debug: {
    titel: 'Debug',
    fps: 'FPS',
    tempo: 'Tempo',
    winkel: 'Driftwinkel',
    schlupfV: 'Schlupf vorne',
    schlupfH: 'Schlupf hinten',
    punkteRate: 'Punkte/s',
    ping: 'Ping',
    gang: 'Gang',
    drehzahl: 'Drehzahl',
    eingabe: 'Eingabe',
    geraet: 'Gerät',
    qualitaet: 'Qualität',
    drawCalls: 'Draw Calls',
    cheats: 'Cheats',
    muenzen: '+10.000 Münzen',
    strecken: 'Alle Strecken freischalten',
    bots: 'Alle Bot-Stufen freischalten',
    autos: 'Alle Autos besitzen'
  },

  eingabe: {
    tastatur: 'Tastatur',
    touch: 'Touch',
    gamepad: 'Gamepad',
    gas: 'Gas',
    bremse: 'Bremse',
    handbremse: 'Handbremse',
    kupplung: 'Kupplung',
    links: 'Links',
    rechts: 'Rechts',
    hoch: 'Hochschalten',
    runter: 'Runterschalten',
    kamera: 'Kamera',
    zuruecksetzen: 'Zurücksetzen',
    pause: 'Pause',
    neigungErlauben: 'Neigungssteuerung erlauben',
    neigungVerweigert: 'Neigungssteuerung nicht erlaubt – Tasten-Steuerung aktiv.',
    neigungKalibrieren: 'Gerät gerade halten und tippen zum Kalibrieren',
    neigungUnsicher: 'Neigungssteuerung braucht eine sichere Verbindung (HTTPS).'
  },

  test: {
    titel: 'Testfläche',
    hinweis: 'Phase-1-Testszene: Steuere den Würfel. Alle Eingaben werden unten angezeigt.',
    echo: 'Server-Echo',
    echoOk: 'WebSocket-Echo erfolgreich ({ms} ms)',
    echoFehler: 'WebSocket-Echo fehlgeschlagen'
  }
};

/** Liefert den Text zum Schlüsselpfad; fehlende Schlüssel werden sichtbar markiert. */
export function t(pfad, werte) {
  let knoten = TEXTE;
  for (const teil of pfad.split('.')) {
    knoten = knoten?.[teil];
    if (knoten === undefined) return `⟦${pfad}⟧`;
  }
  if (typeof knoten !== 'string') return `⟦${pfad}⟧`;
  if (!werte) return knoten;
  return knoten.replace(/\{(\w+)\}/g, (_, k) => (werte[k] !== undefined ? String(werte[k]) : `{${k}}`));
}

/** Zahl im deutschen Format (Tausenderpunkt). */
export function zahl(n, nachkomma = 0) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma });
}
