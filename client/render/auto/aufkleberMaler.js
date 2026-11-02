// Zeichnet einen Aufkleber (Vektor-Pfad per Path2D oder Text) in eine Livery-Zone. Gezeichnet wird in
// Metern auf der Karosserie, damit Formen auf jeder Zone unverzerrt bleiben (die Zonen des Atlas haben
// ein anderes Seitenverhältnis als die Flächen am Auto, siehe docs/LIVERY.md).
import { aufkleberDaten } from '../../assets/aufkleber.js';
import { SCHRIFTEN } from '../../../shared/look.js';

/** Kantenlänge eines Aufklebers mit Skala 1 auf der Karosserie (Meter). */
export const AUFKLEBER_METER = 1.0;

const pfadCache = new Map();
function pfadVon(a) {
  if (!pfadCache.has(a.id)) pfadCache.set(a.id, new Path2D(a.pfad));
  return pfadCache.get(a.id);
}

/** CSS-Schriftname zu einer Schrift-ID. */
export function schriftCss(id) {
  return (SCHRIFTEN.find((s) => s.id === id) || SCHRIFTEN[0]).css;
}

/** Alle Schriften, die ein Look braucht (für das Nachladen vor dem Zeichnen). */
export function schriftenVonLook(look) {
  const ids = new Set();
  for (const a of look.aufkleber) {
    if (a.id === 'text') ids.add(a.schrift);
    else {
      const d = aufkleberDaten(a.id);
      if (d?.text) ids.add(d.text.schrift);
    }
  }
  return [...ids].map(schriftCss);
}

/**
 * Zeichnet einen Aufkleber in lokale Zonen-Koordinaten.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} a Aufkleber aus dem Look
 * @param {number} b Zonenbreite in Pixeln
 * @param {number} h Zonenhöhe in Pixeln
 * @param {{b:number, h:number}} masse Zonengröße in Metern
 * @param {boolean} [ausgewaehlt] Markierung für die Garage
 */
export function zeichneAufkleber(ctx, a, b, h, masse, ausgewaehlt = false) {
  const s = (a.skala * AUFKLEBER_METER) / 100;
  ctx.save();
  ctx.translate(a.x * b, a.y * h);
  ctx.scale(b / masse.b, h / masse.h);
  ctx.rotate((a.rot * Math.PI) / 180);
  ctx.scale(a.spiegel ? -s : s, s);
  ctx.translate(-50, -50);
  ctx.globalAlpha = a.deckkraft;
  ctx.fillStyle = a.farbe;
  if (a.id === 'text') {
    ctx.font = `34px ${schriftCss(a.schrift)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(a.text, 50, 50);
  } else {
    const d = aufkleberDaten(a.id);
    if (d) {
      ctx.fill(pfadVon(d), d.regel === 'evenodd' ? 'evenodd' : 'nonzero');
      if (d.text) {
        ctx.font = `${d.text.groesse}px ${schriftCss(d.text.schrift)}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.text.wort, 50, d.text.y);
      }
    }
  }
  if (ausgewaehlt) {
    ctx.globalAlpha = 1;
    const breite = a.id === 'text' ? Math.max(100, ctx.measureText(a.text).width + 12) : 100;
    const links = 50 - breite / 2;
    ctx.lineWidth = Math.max(1, 0.012 / s);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#2ee6ff';
    ctx.strokeRect(links, a.id === 'text' ? 26 : 0, breite, a.id === 'text' ? 48 : 100);
    ctx.setLineDash([]);
  }
  ctx.restore();
}
