import type { Resource } from '../resources';
import type { CountyInterior, Weapon } from './interior';
import { fieldYieldShare, stageOf } from './interior';
import {
  SEASON_FARM_MODIFIER,
  SEASON_INDUSTRY_MODIFIER,
  type Season,
} from '../season';

/**
 * Labour allocation and the live net-production readout.
 *
 * The spec singles this out as the loop worth replicating exactly: drag the
 * slider, watch the deltas flip, decide. No confirm step, no recalculate
 * button. That only works if projection is a PURE function of state — the UI
 * calls it on every drag frame, so it must be cheap and must never mutate.
 *
 * Two rules the original enforces and this keeps:
 *
 *  1. Labour only flows to tasks that are actually running. Dragging toward
 *     industry does nothing in a county with no active site, and the readout
 *     must show that rather than promising output that will not arrive.
 *  2. The readout is VARIABLE LENGTH, keyed to what the county actually
 *     produces. A cattle-and-stone county shows cattle and stone. Hardcoding
 *     three slots would be wrong for most counties.
 */

/** Where a county's workforce is pointed. 0 = all industry, 1 = all agriculture. */
export interface LabourSplit {
  readonly agricultureShare: number;
  /**
   * Optional per-task override for players who want the hands-on version —
   * the Advanced Labour Panel. Absent means use the single-slider split.
   */
  readonly overrides?: Readonly<Record<string, number>>;
}

/** One row of the net-production readout. */
export interface ProductionLine {
  /** Resource, or a weapon when the blacksmith is running. */
  readonly key: Resource | Weapon;
  readonly label: string;
  /** Net change next season. Negative means the stores are draining. */
  readonly net: number;
  readonly produced: number;
  readonly consumed: number;
}

export interface ProductionProjection {
  readonly lines: readonly ProductionLine[];
  readonly farmWorkers: number;
  readonly industryWorkers: number;
  /** Workers with nothing to do, because their side has no active task. */
  readonly idleWorkers: number;
}

const RESOURCE_LABEL: Record<string, string> = {
  wheat: 'Grain',
  cows: 'Cattle',
  wood: 'Wood',
  ore: 'Iron',
  stone: 'Stone',
  gold: 'Gold',
  swords: 'Swords',
  bows: 'Bows',
  crossbows: 'Crossbows',
  maces: 'Maces',
  pikes: 'Pikes',
};

/** Grain eaten per head per season. */
export const GRAIN_PER_HEAD = 0.08;

/** Output per worker on a fully productive field or site. */
const FARM_OUTPUT_PER_WORKER = 0.55;
const INDUSTRY_OUTPUT_PER_WORKER = 0.4;
const WEAPON_OUTPUT_PER_WORKER = 0.12;

export interface ProjectionInput {
  readonly interior: CountyInterior;
  readonly population: number;
  readonly split: LabourSplit;
  readonly season: Season;
  /** Multiplier from the owning player's faction. */
  readonly foodYieldBonus?: number;
}

/**
 * Project next season's net production.
 *
 * Pure and cheap — safe to call on every slider frame.
 */
export function projectProduction(input: ProjectionInput): ProductionProjection {
  const { interior, population, split, season } = input;
  const foodBonus = input.foodYieldBonus ?? 1;

  const share = clamp01(split.agricultureShare);
  const farmWorkers = Math.round(population * share);
  const industryWorkers = population - farmWorkers;

  // --- agriculture -------------------------------------------------------
  const grainFields = interior.fields.filter((f) => f.status === 'grain');
  const cattleFields = interior.fields.filter((f) => f.status === 'cattle');
  const activeFarmFields = grainFields.length + cattleFields.length;

  const farmModifier = SEASON_FARM_MODIFIER[season];
  // Workers spread across whatever is planted; unplanted land uses nobody.
  const perFarmField = activeFarmFields > 0 ? farmWorkers / activeFarmFields : 0;

  let grainProduced = 0;
  for (const f of grainFields) {
    // Only a mature crop is harvested — a growing one yields nothing yet, and
    // the readout must show that rather than flattering the player.
    const stage = stageOf(f);
    const harvestable = stage === 'mature' || stage === 'spoiled';
    if (!harvestable) continue;
    grainProduced +=
      perFarmField * FARM_OUTPUT_PER_WORKER * fieldYieldShare(f) * farmModifier * foodBonus;
  }

  let cattleProduced = 0;
  for (const f of cattleFields) {
    cattleProduced +=
      perFarmField * FARM_OUTPUT_PER_WORKER * fieldYieldShare(f) * farmModifier * foodBonus * 0.4;
  }

  // --- industry ----------------------------------------------------------
  const activeSites = interior.industry.filter((s) => s.active);
  const industryModifier = SEASON_INDUSTRY_MODIFIER[season];
  const perSite = activeSites.length > 0 ? industryWorkers / activeSites.length : 0;

  const materialOutput: Partial<Record<string, number>> = {};
  for (const site of activeSites) {
    if (site.kind === 'blacksmith') {
      if (!site.weapon) continue;
      materialOutput[site.weapon] =
        (materialOutput[site.weapon] ?? 0) +
        perSite * WEAPON_OUTPUT_PER_WORKER * industryModifier;
      continue;
    }
    const resource =
      site.kind === 'quarry' ? 'stone' : site.kind === 'mine' ? 'ore' : 'wood';
    materialOutput[resource] =
      (materialOutput[resource] ?? 0) + perSite * INDUSTRY_OUTPUT_PER_WORKER * industryModifier;
  }

  // --- consumption -------------------------------------------------------
  // Everyone eats, every season, harvest or not. Winter is where that bites.
  const grainConsumed = population * GRAIN_PER_HEAD;

  // --- idle --------------------------------------------------------------
  // Workers pointed at a side with nothing running have no work to do. Naming
  // that explicitly is the difference between "my slider is wrong" and "I have
  // not activated the quarry yet".
  const idleFarm = activeFarmFields === 0 ? farmWorkers : 0;
  const idleIndustry = activeSites.length === 0 ? industryWorkers : 0;

  const lines: ProductionLine[] = [];
  const push = (key: string, produced: number, consumed: number) => {
    if (produced === 0 && consumed === 0) return;
    lines.push({
      key: key as Resource | Weapon,
      label: RESOURCE_LABEL[key] ?? key,
      net: round1(produced - consumed),
      produced: round1(produced),
      consumed: round1(consumed),
    });
  };

  push('wheat', grainProduced, grainConsumed);
  push('cows', cattleProduced, 0);
  for (const [key, amount] of Object.entries(materialOutput)) {
    push(key, amount ?? 0, 0);
  }

  return {
    lines,
    farmWorkers,
    industryWorkers,
    idleWorkers: idleFarm + idleIndustry,
  };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Health, driven by how well the county has been fed over time.
 *
 * Deliberately five named states rather than a number — the spec calls for a
 * glance-readable fill, and a percentage invites the player to optimise a
 * statistic instead of noticing their people are starving.
 */
export const HEALTH_STATES = ['diseased', 'sick', 'average', 'good', 'perfect'] as const;
export type Health = (typeof HEALTH_STATES)[number];

/** `rationLevel` is the share of full rations being served, 0..2. */
export function healthFromRations(rationLevel: number, seasonsAtLevel: number): Health {
  // A single bad season does not cause plague; a sustained one does.
  const weight = Math.min(1, seasonsAtLevel / 4);
  const effective = rationLevel * weight + 1 * (1 - weight);

  if (effective < 0.5) return 'diseased';
  if (effective < 0.8) return 'sick';
  if (effective < 1.1) return 'average';
  if (effective < 1.5) return 'good';
  return 'perfect';
}

/** Happiness change per season contributed by health. */
export const HEALTH_HAPPINESS: Record<Health, number> = {
  diseased: -8,
  sick: -4,
  average: 0,
  good: 3,
  perfect: 6,
};
