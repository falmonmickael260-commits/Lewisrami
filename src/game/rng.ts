/** Générateur pseudo-aléatoire déterministe (mulberry32) : parties reproductibles en test. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange de Fisher–Yates, sans mutation de l'entrée. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i];
    const b = out[j];
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** Fait avancer la graine de manière déterministe entre deux manches. */
export function nextSeed(seed: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0) || 1;
}
