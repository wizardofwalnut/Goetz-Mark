/**
 * Seasons.
 *
 * A turn IS a season, following the source game. This is not cosmetic: grain is
 * sown, grows, matures and is harvested across the four-season cycle, cattle
 * breed on their own schedule, and food is consumed every season regardless. A
 * turn counter with no season attached cannot express any of that, which is why
 * this went in before the county screen rather than after.
 *
 * The turn number stays the canonical value in match state — season and year are
 * DERIVED from it. Storing all three would let them disagree, and in an async
 * game they would disagree on someone else's device.
 */

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/** Year the campaign opens in. Flavour only; nothing keys off the number. */
export const START_YEAR = 1268;

/** Turn 1 is spring of START_YEAR. */
export function seasonOfTurn(turn: number): Season {
  const index = (turn - 1) % SEASONS.length;
  return SEASONS[index < 0 ? index + SEASONS.length : index]!;
}

export function yearOfTurn(turn: number): number {
  return START_YEAR + Math.floor((turn - 1) / SEASONS.length);
}

export const describeTurn = (turn: number) =>
  `${capitalise(seasonOfTurn(turn))} ${yearOfTurn(turn)}`;

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Growth stage of a sown grain field, by how many seasons it has been growing.
 *
 * Sown in spring, mature by autumn — harvest in autumn or lose it to winter.
 * The stage drives both yield and which sprite the tile draws, so the two can
 * never disagree about what the player is looking at.
 */
export const GRAIN_STAGES = ['sown', 'growing', 'mature', 'spoiled'] as const;
export type GrainStage = (typeof GRAIN_STAGES)[number];

export function grainStage(seasonsGrown: number): GrainStage {
  if (seasonsGrown <= 0) return 'sown';
  if (seasonsGrown === 1) return 'growing';
  if (seasonsGrown === 2) return 'mature';
  // Left standing past maturity: it rots in the field.
  return 'spoiled';
}

/** Share of a field's full yield available at each stage. */
export const GRAIN_STAGE_YIELD: Record<GrainStage, number> = {
  sown: 0,
  growing: 0.35,
  mature: 1,
  spoiled: 0.15,
};

/**
 * Seasonal multiplier on farm output.
 *
 * Winter produces nothing from the fields — the stores have to carry the
 * county through it. That scarcity is the point: it forces the food-shipping
 * decision the design doc keeps as the one real logistics choice.
 */
export const SEASON_FARM_MODIFIER: Record<Season, number> = {
  spring: 0.6,
  summer: 1.0,
  autumn: 1.4,
  winter: 0,
};

/** Industry slows in winter but never stops. */
export const SEASON_INDUSTRY_MODIFIER: Record<Season, number> = {
  spring: 1.0,
  summer: 1.1,
  autumn: 1.0,
  winter: 0.7,
};

/** Winter costs happiness; a good harvest season restores it. */
export const SEASON_HAPPINESS_DRIFT: Record<Season, number> = {
  spring: 1,
  summer: 2,
  autumn: 3,
  winter: -4,
};
