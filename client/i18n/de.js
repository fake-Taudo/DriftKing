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
  },

  laden: {
    tipps: [
      'Tipp: Kurz die Handbremse ziehen und sofort Gas geben – so leitest du einen Drift am leichtesten ein.',
      'Tipp: Mit dem Gas steuerst du den Driftwinkel, mit der Lenkung die Richtung.',
      'Tipp: Als Verfolger zählen 6–10 m Abstand am meisten. Zu dicht auffahren bringt weniger Punkte.',
      'Tipp: Saubere Übergänge zwischen zwei Drifts geben einen Flüssigkeits-Bonus.',
      'Tipp: Die Gegenlenk-Assistenz lässt sich in den Einstellungen von 0 bis 100 % anpassen.',
      'Tipp: Wandkontakt kostet Punkte und setzt deine Combo zurück.',
      'Tipp: In der Garage kannst du jedes Teil vor dem Kauf anprobieren.',
      'Tipp: Mit einem Look-Code kannst du deine Lackierung mit Freunden teilen.'
    ]
  },

  kamera: {
    verfolger: 'Kamera: Verfolger',
    weit: 'Kamera: Weit',
    oben: 'Kamera: Vogelperspektive',
    haube: 'Kamera: Motorhaube'
  },

  hud: {
    du: 'Du',
    pause: 'Pause',
    zuruecksetzen: 'Zurücksetzen',
    fuehrer: 'Führer',
    verfolger: 'Verfolger'
  },

  rennen: {
    los: 'LOS!',
    runde: 'Runde {n}',
    rundeVon: 'Runde {n}/{von}',
    rundeNr: 'Runde {n}',
    rundenzeit: 'Rundenzeit {zeit} s',
    bestzeit: 'Bestzeit!',
    falschrum: 'Falsche Richtung!',
    training: 'Training',
    zeitangriff: 'Zeitangriff',
    zeitAbgelaufen: 'Zeit abgelaufen',
    abgebrochen: 'abgebrochen',
    abkuerzung: 'Abkürzung zählt nicht'
  },

  medaille: {
    bronze: 'Bronze',
    silber: 'Silber',
    gold: 'Gold',
    champion: 'Champion'
  },

  ergebnis: {
    zeitangriffTitel: 'Zeitangriff beendet',
    belohnung: 'Belohnung',
    nochmal: 'Nochmal',
    menue: 'Menü',
    garage: 'Garage',
    revanche: 'Revanche'
  },

  pause: {
    titel: 'Pause',
    onlineTitel: 'Menü',
    onlineHinweis: 'Das Duell läuft weiter, solange dieses Menü offen ist.',
    fortsetzen: 'Fortsetzen',
    zurueck: 'Zurück zum Duell',
    neustart: 'Neustart',
    einstellungen: 'Einstellungen',
    beenden: 'Beenden',
    aufgeben: 'Aufgeben',
    aufgebenTitel: 'Duell aufgeben?',
    aufgebenText: 'Dein Gegner gewinnt das Duell. Wirklich aufgeben?'
  },

  menue: {
    hauptTitel: 'Hauptmenü',
    spielenTitel: 'Spielen',
    spielen: 'Spielen',
    spielenUnter: 'Battle, Zeitangriff, Freies Fahren',
    botBattle: 'Tandem-Battle',
    botBattleUnter: 'Gegen Bots um Driftmünzen',
    zeitangriff: 'Zeitangriff',
    zeitangriffUnter: '3 Runden, Medaillen',
    freiesFahren: 'Freies Fahren',
    freiesFahrenUnter: 'Training ohne Druck',
    online: 'Online-Duell',
    onlineUnter: 'Per Code gegen Freunde',
    garage: 'Garage',
    garageUnter: 'Lack, Aufkleber, Teile, Tuning',
    shop: 'Shop',
    shopUnter: 'Autos und Teile kaufen',
    einstellungen: 'Einstellungen',
    vollbild: 'Vollbild'
  },

  wahl: {
    zeitangriffTitel: 'Zeitangriff – Strecke wählen',
    freiTitel: 'Freies Fahren – Strecke wählen',
    schwierigkeit: 'Schwierigkeit {n} von 3',
    laenge: '{m} m',
    zonen: '{n} Drift-Zonen',
    bestRunde: 'Beste Runde: {zeit} s',
    bestPunkte: 'Bestwert: {n} Punkte',
    sperreKuestenpass: 'Gewinne 3 Bot-Battles auf dem Industriehof',
    sperreNeonhafen: 'Gewinne 3 Bot-Battles auf dem Küstenpass',
    starten: 'Starten'
  },

  layout: {
    titel: 'Tasten-Layout ({format})',
    hoch: 'Hochformat',
    quer: 'Querformat',
    hinweis: 'Taste antippen und ziehen zum Verschieben. Mit − und + änderst du die Größe der ausgewählten Taste.',
    standard: 'Standard'
  },

  fehlertexte: {
    name_ungueltig: 'Ungültiger Name.',
    name_zu_kurz: 'Der Name muss mindestens 2 Zeichen haben.',
    name_zu_lang: 'Der Name darf höchstens 16 Zeichen haben.',
    name_zeichen: 'Erlaubt sind Buchstaben, Zahlen, Leerzeichen und - _ .',
    name_anstoessig: 'Dieser Name ist nicht erlaubt.',
    kennzeichen_ungueltig: 'Ungültiges Kennzeichen.',
    kennzeichen_leer: 'Das Kennzeichen darf nicht leer sein.',
    kennzeichen_zu_lang: 'Das Kennzeichen darf höchstens 8 Zeichen haben.',
    kennzeichen_zeichen: 'Erlaubt sind Großbuchstaben, Zahlen, Leerzeichen und Bindestrich.',
    kennzeichen_anstoessig: 'Dieses Kennzeichen ist nicht erlaubt.',
    text_ungueltig: 'Ungültiger Text.',
    text_leer: 'Der Text darf nicht leer sein.',
    text_zu_lang: 'Höchstens 16 Zeichen.',
    text_zeichen: 'Dieses Zeichen ist nicht erlaubt.',
    text_anstoessig: 'Dieser Text ist nicht erlaubt.'
  },

  einst: {
    titel: 'Einstellungen',
    reiter: {
      grafik: 'Grafik',
      audio: 'Audio',
      steuerung: 'Steuerung',
      assistenz: 'Assistenz',
      zugang: 'Barrierefreiheit',
      spieler: 'Spieler',
      spielstand: 'Spielstand'
    },
    qualitaet: 'Grafikqualität',
    qualitaetHinweis: '„Automatisch“ startet auf Mittel und passt die Stufe an die Leistung deines Geräts an.',
    auto: 'Automatisch',
    niedrig: 'Niedrig',
    mittel: 'Mittel',
    hoch: 'Hoch',
    kamera: 'Kamera im Rennen',
    fps: 'FPS anzeigen',
    namensTag: 'Namensschild über dem Gegner',
    master: 'Gesamtlautstärke',
    effekte: 'Effekte',
    musik: 'Musik',
    musikAn: 'Hintergrundmusik',
    touch: 'Touch-Steuerung',
    touchModus: 'Lenken',
    touchHinweis: 'Gilt auf Geräten mit Touchscreen.',
    tasten: 'Pfeiltasten',
    lenkrad: 'Lenkrad-Schieber',
    neigung: 'Neigung',
    neigungEmpfindlichkeit: 'Neigungs-Empfindlichkeit',
    kalibrieren: 'Neigung kalibrieren',
    kalibriert: 'Mittelstellung übernommen',
    transparenz: 'Deckkraft der Tasten',
    linkshaender: 'Linkshänder-Modus',
    kupplungsKnopf: 'Kupplungs-Taste anzeigen',
    vibration: 'Vibration',
    vibrationHinweis: 'Nur auf Geräten, die Vibration unterstützen (nicht auf dem iPhone).',
    layout: 'Tasten-Layout',
    layoutBearbeiten: 'Bearbeiten',
    pc: 'Tastatur',
    getriebe: 'Getriebe',
    getriebeHinweis: 'Manuell: E hoch, Q runter (nur Tastatur/Gamepad).',
    automatik: 'Automatik',
    manuell: 'Manuell',
    tastenStandard: 'Tastenbelegung',
    gamepadStandard: 'Gamepad-Belegung',
    zuruecksetzen: 'Standard wiederherstellen',
    tasteDruecken: 'Taste drücken …',
    leertaste: 'Leertaste',
    gamepad: 'Gamepad',
    totzone: 'Totzone',
    gamepadTaste: 'Taste {n}',
    gamepadDruecken: 'Gamepad-Taste drücken …',
    gegenlenken: 'Gegenlenk-Assistenz',
    gegenlenkenHinweis: 'Hilft, den Wagen im Drift abzufangen. Driftet nie von allein.',
    driftHalten: 'Drift-Haltehilfe',
    driftHaltenHinweis: 'Kleine Gaskorrektur, die einen Drift hält. Standard: nur bei Touch.',
    driftHaltenStaerke: 'Stärke der Haltehilfe',
    nurTouch: 'Nur Touch',
    schrift: 'Schriftgröße',
    klein: 'Klein',
    normal: 'Normal',
    gross: 'Groß',
    farbenblind: 'Farbenblind-Modus',
    farbenblindHinweis: 'Zusätzliche Symbole und Muster statt nur Farben.',
    reduziert: 'Reduzierte Effekte',
    reduziertHinweis: 'Weniger Wackeln, Blitze und Zeitlupe. Folgt auch der Systemeinstellung „Bewegung reduzieren“.',
    spielerName: 'Spielername',
    spielerNameHinweis: 'Sichtbar für Online-Gegner. 2–16 Zeichen.',
    nameGespeichert: 'Name gespeichert',
    tutorial: 'Tutorial',
    tutorialStarten: 'Tutorial wiederholen',
    exportieren: 'Exportieren',
    importieren: 'Importieren',
    reset: 'Fortschritt zurücksetzen',
    resetHinweis: 'Löscht Autos, Teile, Münzen und Fortschritt. Kann nicht rückgängig gemacht werden.',
    resetKnopf: 'Zurücksetzen …',
    resetTitel: 'Fortschritt zurücksetzen?',
    resetText1: 'Alle Autos, Teile, Looks, Münzen und Freischaltungen gehen verloren.',
    resetWeiter: 'Weiter',
    resetTitel2: 'Wirklich alles löschen?',
    resetText2: 'Letzte Sicherheitsabfrage: Dieser Schritt kann nicht rückgängig gemacht werden.',
    resetEndgueltig: 'Endgültig löschen',
    resetFertig: 'Fortschritt wurde zurückgesetzt.',
    resetNichtImRennen: 'Das geht nur im Hauptmenü.'
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
