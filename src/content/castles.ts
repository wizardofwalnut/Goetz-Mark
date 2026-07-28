import type { CastleTier } from '../domain/match/matchState';
import type { MaterialResource } from '../domain/resources';

/**
 * Fortification tiers.
 *
 * Five buildable steps, per the county-screen spec. Costs climb faster than the
 * defence they buy, so a Royal Castle is a commitment rather than the obvious
 * end state of every county — most counties should never justify one.
 *
 * `defence` multiplies the garrison's output when the castle is assaulted. It
 * stacks with terrain, which is why a Norman Keep in the pass is a different
 * proposition from the same keep on open ground.
 */

export interface CastleSpec {
  readonly tier: CastleTier;
  readonly name: string;
  readonly blurb: string;
  readonly cost: Partial<Record<MaterialResource, number>>;
  /** Seasons to build at a full industry workforce. */
  readonly seasons: number;
  /** Multiplier on defender output during an assault. */
  readonly defence: number;
  /** Extra troops the county can garrison. */
  readonly garrisonBonus: number;
}

export const CASTLES: Readonly<Record<CastleTier, CastleSpec>> = {
  none: {
    tier: 'none',
    name: 'No castle',
    blurb: 'Open ground. Anyone may walk in.',
    cost: {},
    seasons: 0,
    defence: 1,
    garrisonBonus: 0,
  },
  woodenPalisade: {
    tier: 'woodenPalisade',
    name: 'Wooden Palisade',
    blurb: 'A ditch and a timber wall. Stops raiders, not an army.',
    cost: { wood: 30 },
    seasons: 1,
    defence: 1.15,
    garrisonBonus: 10,
  },
  motteAndBailey: {
    tier: 'motteAndBailey',
    name: 'Motte & Bailey',
    blurb: 'Earthwork mound and timber keep. The honest first castle.',
    cost: { wood: 70, stone: 20 },
    seasons: 2,
    defence: 1.35,
    garrisonBonus: 25,
  },
  normanKeep: {
    tier: 'normanKeep',
    name: 'Norman Keep',
    blurb: 'Square stone tower. Expensive, and worth it on a border.',
    cost: { wood: 60, stone: 90, ore: 20 },
    seasons: 3,
    defence: 1.6,
    garrisonBonus: 45,
  },
  stoneCastle: {
    tier: 'stoneCastle',
    name: 'Stone Castle',
    blurb: 'Curtain wall and towers. A siege here takes a season.',
    cost: { wood: 80, stone: 180, ore: 45, gold: 200 },
    seasons: 4,
    defence: 1.9,
    garrisonBonus: 70,
  },
  royalCastle: {
    tier: 'royalCastle',
    name: 'Royal Castle',
    blurb: 'Concentric walls and a gatehouse. Ruinous to build, worse to storm.',
    cost: { wood: 120, stone: 320, ore: 90, gold: 600 },
    seasons: 6,
    defence: 2.3,
    garrisonBonus: 110,
  },
};

/** Buildable tiers in ladder order, excluding "no castle". */
export const BUILDABLE_TIERS = (
  Object.keys(CASTLES) as CastleTier[]
).filter((t) => t !== 'none');

/**
 * Cost to move from one tier to another.
 *
 * Upgrading pays only the difference, so building up in steps is not punished
 * relative to saving for the top tier — otherwise the early tiers would be
 * traps for anyone who intended to keep growing.
 */
export function upgradeCost(from: CastleTier, to: CastleTier): Partial<Record<MaterialResource, number>> {
  const a = CASTLES[from].cost;
  const b = CASTLES[to].cost;
  const out: Partial<Record<MaterialResource, number>> = {};
  for (const key of ['wood', 'ore', 'stone', 'gold'] as MaterialResource[]) {
    const diff = (b[key] ?? 0) - (a[key] ?? 0);
    if (diff > 0) out[key] = diff;
  }
  return out;
}
