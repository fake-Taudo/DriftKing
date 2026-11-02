// Einfacher Wortfilter gegen Beleidigungen für Spielernamen, Kennzeichen und Text-Aufkleber.
// Normalisiert Eingaben (Kleinschreibung, Leetspeak, Umlaute, Sonderzeichen entfernen) und
// prüft auf enthaltene Wortstämme. Bewusst vorsichtig: lieber einmal zu viel ablehnen.

// Wortstämme (normalisiert, ohne Umlaute). Kurze Stämme nur dort, wo sie kaum Fehlalarme erzeugen.
const STAEMME = [
  'arsch', 'fick', 'fotze', 'hure', 'wichs', 'schlampe', 'bastard', 'spast', 'mongo',
  'missgeburt', 'nazi', 'hitler', 'kanake', 'schwuchtel', 'neger', 'nigg', 'nigga', 'niger',
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'fag',
  'retard', 'penis', 'vagina', 'porno', 'porn', 'sex', 'kotz', 'pisser', 'scheiss', 'scheis',
  'kacke', 'opfer', 'behindert', 'idiot', 'trottel', 'depp', 'vollpfosten', 'hurensohn',
  'motherf', 'asshole', 'nutte', 'titten', 'muschi', 'schwanz', 'pimmel',
  'kinderf', 'pedo', 'rape', 'vergewalt', 'ssbb', 'hhbb', 'kkk', 'jihad', 'terror'
]; // „ssbb“/„hhbb“ = normalisierte Form von SS88/HH88 (8 → b)

// Stämme, die nur als ganzes Wort geprüft werden (sonst zu viele Fehlalarme).
const GANZE_WOERTER = ['ss', 'sa', 'wtf', 'kz', 'nsdap', 'heil', 'isis'];

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i' };

export function normalisiere(text) {
  return String(text)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[0134578@$!|]/g, (z) => LEET[z] || z)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** true, wenn der Text als unzulässig eingestuft wird. */
export function istAnstoessig(text) {
  if (!text) return false;
  const norm = normalisiere(text);
  const kompakt = norm.replace(/[^a-z]/g, '');
  // Wiederholte Buchstaben zusammenfassen (z. B. „fuuuck“)
  const gestaucht = kompakt.replace(/(.)\1+/g, '$1');
  for (const s of STAEMME) {
    if (kompakt.includes(s)) return true;
    const sg = s.replace(/(.)\1+/g, '$1');
    // Gestauchter Vergleich nur bei ausreichend langen Stämmen: „kkk“ würde sonst zu „k“, und ein
    // verkürzter Stamm unter 4 Zeichen träfe harmlose Wörter (z. B. König, Honig)
    if (sg.length >= (sg === s ? 3 : 4) && gestaucht.includes(sg)) return true;
  }
  const woerter = norm.split(/[^a-z]+/).filter(Boolean);
  for (const w of woerter) if (GANZE_WOERTER.includes(w)) return true;
  return false;
}

/** Erlaubte Zeichen für Namen und Kennzeichen. */
export const NAMEN_ZEICHEN = /^[A-Za-z0-9ÄÖÜäöüß _\-.]+$/;
export const KENNZEICHEN_ZEICHEN = /^[A-Z0-9ÄÖÜ \-]+$/;

/**
 * Prüft einen Spielernamen. Liefert null (ok) oder einen Fehlerschlüssel.
 */
export function pruefeName(name, maxLaenge = 16) {
  if (typeof name !== 'string') return 'name_ungueltig';
  const t = name.trim();
  if (t.length < 2) return 'name_zu_kurz';
  if (t.length > maxLaenge) return 'name_zu_lang';
  if (!NAMEN_ZEICHEN.test(t)) return 'name_zeichen';
  if (istAnstoessig(t)) return 'name_anstoessig';
  return null;
}

/** Prüft ein Kennzeichen (max. 8 Zeichen). */
export function pruefeKennzeichen(text) {
  if (typeof text !== 'string') return 'kennzeichen_ungueltig';
  const t = text.trim().toUpperCase();
  if (t.length < 1) return 'kennzeichen_leer';
  if (t.length > 8) return 'kennzeichen_zu_lang';
  if (!KENNZEICHEN_ZEICHEN.test(t)) return 'kennzeichen_zeichen';
  if (istAnstoessig(t)) return 'kennzeichen_anstoessig';
  return null;
}

/** Prüft einen Text-Aufkleber (max. 16 Zeichen). */
export function pruefeAufkleberText(text) {
  if (typeof text !== 'string') return 'text_ungueltig';
  const t = text.trim();
  if (t.length < 1) return 'text_leer';
  if (t.length > 16) return 'text_zu_lang';
  if (/[<>{}\\]/.test(t)) return 'text_zeichen';
  if (istAnstoessig(t)) return 'text_anstoessig';
  return null;
}
