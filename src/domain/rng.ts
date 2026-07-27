/**
 * Seeded, deterministic PRNG.
 *
 * Battles must resolve to the same result on every device. If combat called
 * Math.random, two clients replaying the same match would disagree about who
 * won — and in an async game the disagreement would surface hours later, on
 * someone else's turn.
 *
 * So randomness is always explicit: a battle stores its seed in match state and
 * anyone can recompute the identical outcome from it. That also makes the
 * "full math breakdown" the design doc asks for reproducible rather than a
 * one-off log.
 */

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** The seed this generator was created from. */
  readonly seed: number;
}

/** mulberry32 — small, fast, and good enough for combat variance. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed,
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
  };
}

/**
 * Derive a seed from a string, so a battle's seed can be built from stable
 * match data (match id + turn + county) rather than stored separately.
 */
export function seedFrom(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const part of parts.join('|')) {
    h ^= part.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
