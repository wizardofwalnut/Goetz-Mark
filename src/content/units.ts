import type { UnitKind } from '../domain/match/matchState';
import type { MaterialResource } from '../domain/resources';

/**
 * The roster is deliberately four units, down from the original's seven. Each
 * one has to earn its slot, so each has a clear job and a clear counter:
 *
 *   Militia  — cheap bodies, soaks casualties, wins nothing alone
 *   Archers  — punish militia-heavy stacks, fold to knights
 *   Knights  — expensive, break stalls, punish archer-heavy stacks
 *   Mercs    — bought with gold rather than built; desert if unpaid
 *
 * The counter-triangle lives in `COUNTER_BONUS` and is read by the battle
 * resolver. Numbers here are first-pass and expected to move in playtesting.
 */

export interface UnitStats {
  readonly kind: UnitKind;
  readonly name: string;
  readonly attack: number;
  readonly defence: number;
  /** Casualties absorbed before the unit is removed. */
  readonly hardiness: number;
  /** Movement points contributed; an army moves at its slowest unit's rate. */
  readonly speed: number;
  /** Build cost in pooled materials. Mercenaries are hired, so this is empty. */
  readonly buildCost: Partial<Record<MaterialResource, number>>;
  /** Gold per turn to keep in the field. */
  readonly upkeep: number;
  readonly recruitable: boolean;
}

export const UNITS: Readonly<Record<UnitKind, UnitStats>> = {
  militia: {
    kind: 'militia',
    name: 'Militia',
    attack: 4,
    defence: 5,
    hardiness: 1.0,
    speed: 4,
    buildCost: { wood: 2 },
    upkeep: 1,
    recruitable: true,
  },
  archers: {
    kind: 'archers',
    name: 'Archers',
    attack: 7,
    defence: 4,
    hardiness: 0.8,
    speed: 4,
    buildCost: { wood: 4, ore: 1 },
    upkeep: 2,
    recruitable: true,
  },
  knights: {
    kind: 'knights',
    name: 'Knights',
    attack: 12,
    defence: 9,
    hardiness: 1.6,
    speed: 6,
    buildCost: { ore: 6, wood: 2, gold: 4 },
    upkeep: 5,
    recruitable: true,
  },
  mercenaries: {
    kind: 'mercenaries',
    name: 'Mercenaries',
    attack: 9,
    defence: 7,
    hardiness: 1.2,
    speed: 5,
    buildCost: {},
    upkeep: 8,
    recruitable: false,
  },
};

/**
 * Counter-triangle. `COUNTER_BONUS[a][b]` is the output multiplier `a` gets
 * when the enemy army is heavily composed of `b`.
 */
export const COUNTER_BONUS: Readonly<Record<UnitKind, Partial<Record<UnitKind, number>>>> = {
  militia: {},
  archers: { militia: 1.35 },
  knights: { archers: 1.4 },
  mercenaries: {},
};

/** Enemy composition share above which a counter bonus applies. */
export const COUNTER_THRESHOLD = 0.4;

/**
 * Named mercenary bands. These appear randomly in a player's territory and are
 * hired with gold at a premium over building the equivalent gear. Two rival
 * bands will not serve in the same army — `rivals` is what enforces that.
 */
export interface MercenaryBand {
  readonly id: string;
  readonly name: string;
  readonly strength: number;
  /** Gold to hire, before faction modifiers. */
  readonly hirePrice: number;
  readonly upkeep: number;
  readonly rivals: readonly string[];
}

export const MERCENARY_BANDS: readonly MercenaryBand[] = [
  {
    id: 'danishSwordsmen',
    name: 'Danish Swordsmen',
    strength: 40,
    hirePrice: 320,
    upkeep: 26,
    rivals: ['frisianAxemen'],
  },
  {
    id: 'burgundyMacemen',
    name: 'Burgundy Macemen',
    strength: 35,
    hirePrice: 280,
    upkeep: 22,
    rivals: ['lombardLances'],
  },
  {
    id: 'frisianAxemen',
    name: 'Frisian Axemen',
    strength: 30,
    hirePrice: 240,
    upkeep: 19,
    rivals: ['danishSwordsmen'],
  },
  {
    id: 'lombardLances',
    name: 'Lombard Lances',
    strength: 45,
    hirePrice: 400,
    upkeep: 33,
    rivals: ['burgundyMacemen'],
  },
];

export const bandsCanServeTogether = (a: MercenaryBand, b: MercenaryBand): boolean =>
  !a.rivals.includes(b.id) && !b.rivals.includes(a.id);
