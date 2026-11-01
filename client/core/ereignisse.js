// Minimaler Ereignis-Bus für lose Kopplung zwischen Modulen.

export class Ereignisse {
  constructor() {
    this.hoerer = new Map();
  }

  an(name, fn) {
    if (!this.hoerer.has(name)) this.hoerer.set(name, new Set());
    this.hoerer.get(name).add(fn);
    return () => this.aus(name, fn);
  }

  aus(name, fn) {
    this.hoerer.get(name)?.delete(fn);
  }

  senden(name, daten) {
    const liste = this.hoerer.get(name);
    if (!liste) return;
    for (const fn of [...liste]) {
      try {
        fn(daten);
      } catch (e) {
        console.error(`[Ereignis ${name}]`, e);
      }
    }
  }
}
