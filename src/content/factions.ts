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

/** How strongly the AI leans toward each behaviour. 0..1, read from bonuses. */
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
  readonly ai: AiWeighting;
}

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
    ai: { aggression: 0.85, turtling: 0.15, economy: 0.35, diplomacy: 0.25 },
  },
  {
    id: factionId('warden'),
    name: 'The Warden',
    blurb: 'Cheap walls, patient hands. Bleeds attackers on their own advance.',
    bonuses: { ...NEUTRAL, castleCost: 0.8, defence: 1.15, attack: 0.95 },
    ai: { aggression: 0.2, turtling: 0.9, economy: 0.6, diplomacy: 0.45 },
  },
  {
    id: factionId('merchant'),
    name: 'The Merchant',
    blurb: 'Buys what others must build. Gold is a weapon in the right ledger.',
    bonuses: { ...NEUTRAL, goldIncome: 1.25, mercenaryCost: 0.8, defence: 0.95 },
    ai: { aggression: 0.4, turtling: 0.45, economy: 0.9, diplomacy: 0.6 },
  },
  {
    id: factionId('steward'),
    name: 'The Steward',
    blurb: 'Well-fed counties, content peasants, and quietly enormous armies.',
    bonuses: { ...NEUTRAL, foodYield: 1.2, happiness: 5, attack: 0.95 },
    ai: { aggression: 0.3, turtling: 0.5, economy: 0.75, diplomacy: 0.85 },
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
