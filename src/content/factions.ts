import { factionId } from '../domain/ids';
import type { FactionId } from '../domain/ids';

/**
 * Factions are player-chosen (Civ-style, not world-locked) and are ALWAYS free.
 * They are never sold — selling them would put a competitive edge behind a
 * paywall, which the design doc rules out permanently.
 *
 * Each faction's bonuses double as AI behaviour weighting: the same numbers
 * that make the Knight cheap to attack with also make an AI Knight attack
 * early. One set of numbers, two uses — an AI cannot drift from its faction's
 * stated identity because it is reading the same record the player is.
 */

export interface FactionBonuses {
  /** Multiplier on castle build material cost. <1 is cheaper. */
  readonly castleCost: number;
  /** Multiplier on this faction's units' attack output. */
  readonly attack: number;
  /** Multiplier on this faction's units' defence output. */
  readonly defence: number;
  /** Multiplier on gold income. */
  readonly goldIncome: number;
  /** Multiplier on food yield. */
  readonly foodYield: number;
  /** Flat happiness offset applied every turn. */
  readonly happiness: number;
  /** Multiplier on mercenary hire price. <1 is cheaper. */
  readonly mercenaryCost: number;
}

/** How strongly the AI leans toward each behaviour. 0..1. */
export interface AiWeighting {
  readonly aggression: number;
  readonly turtling: number;
  readonly economy: number;
  readonly diplomacy: number;
}

export interface Faction {
  readonly id: FactionId;
  readonly name: string;
  readonly blurb: string;
  readonly bonuses: FactionBonuses;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * How an AI of this faction plays — DERIVED from its bonuses, never authored
 * separately.
 *
 * This is the point of the whole arrangement. A hand-written behaviour table
 * beside the bonuses is a table that drifts: someone tunes the Warden's castle
 * discount for balance, and the Warden AI carries on playing to the old number
 * because nothing forced the two to agree. Deriving it means a faction's
 * identity has exactly one source, so an AI cannot play against its own sheet.
 *
 * Read each line as a claim about the faction:
 *  - Cheap attacks invite attacking; strong defence invites waiting.
 *  - Cheap walls and hard walls both reward turtling.
 *  - Gold and food surpluses reward building an economy.
 *  - Contentment and cheap mercenaries make friends worth keeping.
 */
export function deriveAiWeighting(b: FactionBonuses): AiWeighting {
  return {
    aggression: clamp01(0.5 + (b.attack - 1) * 2.5 - (b.defence - 1) * 1.5),
    turtling: clamp01(0.5 + (1 - b.castleCost) * 2.5 + (b.defence - 1) * 2),
    economy: clamp01(0.5 + (b.goldIncome - 1) * 1.5 + (b.foodYield - 1) * 1.5),
    diplomacy: clamp01(0.5 + b.happiness / 15 + (1 - b.mercenaryCost) * 0.8),
  };
}

/** Convenience: the weighting for a faction. */
export const aiWeightingOf = (faction: Faction): AiWeighting =>
  deriveAiWeighting(faction.bonuses);

const NEUTRAL: FactionBonuses = {
  castleCost: 1,
  attack: 1,
  defence: 1,
  goldIncome: 1,
  foodYield: 1,
  happiness: 0,
  mercenaryCost: 1,
};

export const FACTIONS: readonly Faction[] = [
  {
    id: factionId('knight'),
    name: 'The Knight',
    blurb: 'Takes ground early and does not apologise for it.',
    bonuses: { ...NEUTRAL, attack: 1.15, castleCost: 1.1, foodYield: 0.95 },
  },
  {
    id: factionId('warden'),
    name: 'The Warden',
    blurb: 'Cheap walls, patient hands. Bleeds attackers on their own advance.',
    bonuses: { ...NEUTRAL, castleCost: 0.8, defence: 1.15, attack: 0.95 },
  },
  {
    id: factionId('merchant'),
    name: 'The Merchant',
    blurb: 'Buys what others must build. Gold is a weapon in the right ledger.',
    bonuses: { ...NEUTRAL, goldIncome: 1.25, mercenaryCost: 0.8, defence: 0.95 },
  },
  {
    id: factionId('steward'),
    name: 'The Steward',
    blurb: 'Well-fed counties, content peasants, and quietly enormous armies.',
    bonuses: { ...NEUTRAL, foodYield: 1.2, happiness: 5, attack: 0.95 },
  },
];

export const FACTIONS_BY_ID: Readonly<Record<FactionId, Faction>> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f]),
) as Record<FactionId, Faction>;

export const getFaction = (id: FactionId): Faction => {
  const f = FACTIONS_BY_ID[id];
  if (!f) throw new Error(`Unknown faction: ${id}`);
  return f;
};
