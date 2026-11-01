// Kodierung für Look-Codes und Spielstand-Text-Codes:
// JSON → (deflate-raw per CompressionStream, falls verfügbar) → Base64URL.
// Präfix-Zeichen kennzeichnet das Format: "D" = komprimiert, "R" = unkomprimiert (Rückfall
// für ältere Browser ohne CompressionStream, z. B. iOS < 16.4).
// Läuft in Browser und Node (beide haben btoa/atob, TextEncoder und CompressionStream).

const textKodierer = new TextEncoder();
const textDekodierer = new TextDecoder();

export function base64urlAusBytes(bytes) {
  let bin = '';
  const BLOCK = 0x8000;
  for (let i = 0; i < bytes.length; i += BLOCK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + BLOCK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function bytesAusBase64url(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]*$/.test(text)) {
    throw new Error('ungueltige_zeichen');
  }
  let b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function kompressionVerfuegbar() {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

async function stromVerarbeiten(bytes, strom) {
  const antwort = new Response(new Blob([bytes]).stream().pipeThrough(strom));
  return new Uint8Array(await antwort.arrayBuffer());
}

/**
 * Begrenzte Dekompression: bricht ab, sobald mehr als maxBytes entstehen
 * (Schutz gegen „Zip-Bomben“ in manipulierten Codes).
 */
async function dekomprimiereBegrenzt(bytes, maxBytes) {
  const leser = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const teile = [];
  let gesamt = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    gesamt += value.length;
    if (gesamt > maxBytes) {
      try { await leser.cancel(); } catch { /* egal */ }
      throw new Error('zu_gross');
    }
    teile.push(value);
  }
  const ergebnis = new Uint8Array(gesamt);
  let pos = 0;
  for (const t of teile) { ergebnis.set(t, pos); pos += t.length; }
  return ergebnis;
}

/** Objekt → Text-Code. */
export async function kodiere(objekt) {
  const roh = textKodierer.encode(JSON.stringify(objekt));
  if (kompressionVerfuegbar()) {
    const gepackt = await stromVerarbeiten(roh, new CompressionStream('deflate-raw'));
    return 'D' + base64urlAusBytes(gepackt);
  }
  return 'R' + base64urlAusBytes(roh);
}

/**
 * Text-Code → Objekt. Wirft Error mit sprechendem Code:
 * leer, zu_gross, ungueltige_zeichen, format, kompression_fehlt, json
 */
export async function dekodiere(code, { maxCodeLaenge = 200000, maxRohBytes = 400000 } = {}) {
  if (typeof code !== 'string') throw new Error('format');
  const text = code.trim().replace(/\s+/g, '');
  if (!text) throw new Error('leer');
  if (text.length > maxCodeLaenge) throw new Error('zu_gross');
  const art = text[0];
  const nutzlast = bytesAusBase64url(text.slice(1));
  let roh;
  if (art === 'D') {
    if (!kompressionVerfuegbar()) throw new Error('kompression_fehlt');
    try {
      roh = await dekomprimiereBegrenzt(nutzlast, maxRohBytes);
    } catch (e) {
      if (e && e.message === 'zu_gross') throw e;
      throw new Error('format');
    }
  } else if (art === 'R') {
    roh = nutzlast;
    if (roh.length > maxRohBytes) throw new Error('zu_gross');
  } else {
    throw new Error('format');
  }
  try {
    return JSON.parse(textDekodierer.decode(roh));
  } catch {
    throw new Error('json');
  }
}

/** FNV-1a 32 Bit als 8-stelliger Hex-String (Prüfsumme, kein Kryptoschutz). */
export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
