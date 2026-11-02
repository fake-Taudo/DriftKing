// Kauf-Flow für Garage und Shop: Preis und Bestätigung, atomarer Kauf bzw. Verkauf, Erfolgsmeldung.
// Nicht leistbares zeigt den fehlenden Betrag. Die Buchung selbst steht in shared/oekonomie.js.
import { dialog, toast } from './dom.js';
import { t, zahl } from '../i18n/de.js';
import { kaufen, besitzt, verkaufen, verkaufswert, autoKaufen, autoVerkaufen, autoVerkaufswert } from '../../shared/oekonomie.js';
import { teilInfo } from '../../shared/teile.js';
import { autoDaten } from '../../shared/autos.js';

function nichtLeistbar(spiel, namen, preis) {
  return dialog({
    titel: t('garage.nichtLeistbarTitel'),
    text: t('garage.nichtLeistbarText', { teile: namen, preis: zahl(preis), fehlt: zahl(preis - spiel.daten.waehrung) })
  });
}

function bestaetigen(spiel, namen, preis, titel) {
  return dialog({
    titel: titel || t('garage.kaufTitel'),
    text: t('garage.kaufText', { teile: namen, preis: zahl(preis), rest: zahl(spiel.daten.waehrung - preis) }),
    knoepfe: [
      { text: t('allgemein.abbrechen'), art: 'geist', wert: false },
      { text: t('garage.kaufen', { preis: zahl(preis) }), art: 'haupt', wert: true }
    ]
  });
}

/**
 * Kauft Teile nach Rückfrage.
 * @returns {Promise<boolean>} true, wenn gekauft (oder schon alles im Besitz)
 */
export async function teileKaufen(spiel, kaufIds, autoId, { titel } = {}) {
  const d = spiel.daten;
  const offen = kaufIds.filter((id) => !besitzt(d, id, autoId));
  if (!offen.length) return true;
  const summe = offen.reduce((s, id) => s + (teilInfo(id, autoId)?.preis ?? 0), 0);
  const namen = offen.map((id) => teilInfo(id, autoId)?.name ?? id).join(', ');
  if (summe > d.waehrung) {
    await nichtLeistbar(spiel, namen, summe);
    return false;
  }
  if ((await bestaetigen(spiel, namen, summe, titel)) !== true) return false;
  const r = kaufen(d, offen, autoId);
  if (!r.ok) {
    toast(t('garage.kaufFehler'), { art: 'fehler' });
    return false;
  }
  spiel.speicher.sofortSpeichern();
  spiel.audio?.ton?.('kasse');
  toast(t('garage.gekauft', { preis: zahl(r.preis) }), { art: 'erfolg' });
  return true;
}

/** Verkauft ein Teil nach Rückfrage. */
export async function teilVerkaufen(spiel, kaufId, autoId) {
  const info = teilInfo(kaufId, autoId);
  if (!info) return false;
  const erloes = verkaufswert(info.preis);
  const ja = await dialog({
    titel: t('shop.verkaufTitel'),
    text: t('shop.verkaufText', { name: info.name, erloes: zahl(erloes) }),
    knoepfe: [
      { text: t('allgemein.abbrechen'), art: 'geist', wert: false },
      { text: t('shop.verkaufen', { erloes: zahl(erloes) }), art: 'gefahr', wert: true }
    ]
  });
  if (ja !== true) return false;
  const r = verkaufen(spiel.daten, kaufId, autoId);
  if (!r.ok) {
    toast(t('garage.kaufFehler'), { art: 'fehler' });
    return false;
  }
  spiel.speicher.sofortSpeichern();
  toast(t('shop.verkauft', { erloes: zahl(r.erloes) }), { art: 'erfolg' });
  return true;
}

/** Kauft ein Auto nach Rückfrage. */
export async function autoKaufenFlow(spiel, autoId) {
  const a = autoDaten(autoId);
  if (a.preis > spiel.daten.waehrung) {
    await nichtLeistbar(spiel, a.name, a.preis);
    return false;
  }
  if ((await bestaetigen(spiel, a.name, a.preis)) !== true) return false;
  const r = autoKaufen(spiel.daten, autoId);
  if (!r.ok) {
    toast(t('garage.kaufFehler'), { art: 'fehler' });
    return false;
  }
  spiel.speicher.sofortSpeichern();
  spiel.audio?.ton?.('kasse');
  toast(t('shop.autoGekauft', { name: a.name }), { art: 'erfolg' });
  return true;
}

/** Verkauft ein Auto samt seiner Teile nach Rückfrage. */
export async function autoVerkaufenFlow(spiel, autoId) {
  const a = autoDaten(autoId);
  const erloes = autoVerkaufswert(spiel.daten, autoId);
  const ja = await dialog({
    titel: t('shop.verkaufTitel'),
    text: t('shop.autoVerkaufText', { name: a.name, erloes: zahl(erloes) }),
    knoepfe: [
      { text: t('allgemein.abbrechen'), art: 'geist', wert: false },
      { text: t('shop.verkaufen', { erloes: zahl(erloes) }), art: 'gefahr', wert: true }
    ]
  });
  if (ja !== true) return false;
  const r = autoVerkaufen(spiel.daten, autoId);
  if (!r.ok) {
    toast(t(r.grund === 'letztes' ? 'shop.letztesAuto' : 'garage.kaufFehler'), { art: 'fehler' });
    return false;
  }
  spiel.speicher.sofortSpeichern();
  toast(t('shop.verkauft', { erloes: zahl(r.erloes) }), { art: 'erfolg' });
  return true;
}
