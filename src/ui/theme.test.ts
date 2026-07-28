import { describe, expect, it } from 'vitest';
import { seatColors } from './theme';

/**
 * Seat colours have a job: they answer "whose army is that?" off a token about
 * fifteen pixels wide. A pair that is hard to tell apart is not a matter of
 * taste, it is a player misreading the board — so the separation is measured
 * and enforced rather than eyeballed once and hoped about.
 *
 * The set these replaced (crimson/steel/gold/verdigris) scored 33 here.
 */

type Rgb = readonly [number, number, number];

const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/**
 * Colour-blindness simulations, ~5% and ~0.5% of players respectively for the
 * red-green pair, tritanopia rarer. Standard linear approximations: precise
 * enough to catch a palette that collapses, which is all this needs to do.
 */
const SIMULATIONS: Record<string, (c: Rgb) => Rgb> = {
  normal: (c) => c,
  deuteranopia: (c) => [0.625 * c[0] + 0.375 * c[1], 0.7 * c[0] + 0.3 * c[1], 0.3 * c[1] + 0.7 * c[2]],
  protanopia: (c) => [0.567 * c[0] + 0.433 * c[1], 0.558 * c[0] + 0.442 * c[1], 0.242 * c[1] + 0.758 * c[2]],
  tritanopia: (c) => [0.95 * c[0] + 0.05 * c[1], 0.433 * c[1] + 0.567 * c[2], 0.475 * c[1] + 0.525 * c[2]],
};

const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Minimum acceptable separation, in RGB distance.
 *
 * Not a standards figure — a line drawn from measurement. The rejected palette
 * scored 33 and two of its colours were genuinely confusable on the map; the
 * chosen one scores 110. 100 leaves room to retune a colour without letting
 * the set quietly degrade back to where it was.
 */
const MIN_SEPARATION = 100;

/** The fill the minimap uses for unclaimed land. Must not resemble a seat. */
const UNCLAIMED_GRASS = '#6f9a4e';

describe('seat colours', () => {
  it('keeps every pair apart under normal vision and colour blindness', () => {
    const failures: string[] = [];

    for (const [name, simulate] of Object.entries(SIMULATIONS)) {
      for (let i = 0; i < seatColors.length; i++) {
        for (let j = i + 1; j < seatColors.length; j++) {
          const a = seatColors[i]!;
          const b = seatColors[j]!;
          const apart = distance(simulate(rgb(a.base)), simulate(rgb(b.base)));
          if (apart < MIN_SEPARATION) {
            failures.push(`${a.name}/${b.name} under ${name}: ${Math.round(apart)}`);
          }
        }
      }
    }

    expect(failures, `Seat colours too close to tell apart:\n${failures.join('\n')}`).toEqual([]);
  });

  it('keeps no seat colour close to unclaimed grass', () => {
    // Verdigris used to sit 49 away from this, so a county it held read as
    // nobody's on the minimap. A team colour must never be mistakable for
    // "unowned".
    const grass = rgb(UNCLAIMED_GRASS);
    for (const seat of seatColors) {
      expect(
        distance(rgb(seat.base), grass),
        `${seat.name} is too close to unclaimed grass`,
      ).toBeGreaterThan(MIN_SEPARATION);
    }
  });

  it('spreads the colours across the greyscale range too', () => {
    // Hue separation is the case that matters most, but a set that is all one
    // brightness disappears in a screenshot, a printout, or a dark room.
    const luminance = (hex: string) => {
      const [r, g, b] = rgb(hex);
      return 0.299 * r! + 0.587 * g! + 0.114 * b!;
    };
    const greys = seatColors.map((s) => luminance(s.base));
    expect(Math.max(...greys) - Math.min(...greys)).toBeGreaterThan(120);
  });
});
