import type { CountyId, PlayerId } from '../ids';
import type { CountyState, MatchState } from '../match/matchState';
import { CASTLES } from '../../content/castles';
import {
  RECLAIM_PER_SEASON,
  MAX_HERD_PER_FIELD,
  type FieldTile,
} from '../county/interior';
import { projectProduction, healthFromRations, HEALTH_HAPPINESS } from '../county/labour';
import { SEASON_HAPPINESS_DRIFT, grainStage, seasonOfTurn } from '../season';
import { getFaction } from '../../content/factions';
import type { MaterialResource } from '../resources';
import { refreshMovement } from '../army/armyActions';
import { resolveConquest, type ConquestEvent } from '../army/resolveConquest';
import { indexMap } from '../map/mapQueries';
import type { GameMap } from '../map/mapTypes';

/**
 * Season resolution.
 *
 * THE RULE THIS FILE EXISTS TO KEEP: resolution uses the SAME
 * `projectProduction` the labour panel shows. The slider promises a number and
 * the season must deliver that number — a separate resolution path would let
 * the promise and the delivery drift, and the player would learn to distrust
 * the readout, which is the one piece of feedback the whole economy runs on.
 *
 * Pure: takes match state, returns new match state. The AI, a replayed action
 * from another device and the End Turn button all go through this.
 */

export interface SeasonEvent {
  readonly county: CountyId;
  readonly kind:
    | 'harvest'
    | 'spoiled'
    | 'reclaimed'
    | 'starving'
    | 'revolt'
    | 'castleBuilt'
    | ConquestEvent['kind'];
  readonly detail: string;
}

export interface AdvanceResult {
  readonly match: MatchState;
  /** What changed, for the end-of-season report. */
  readonly events: readonly SeasonEvent[];
}

/** Happiness at or below this for too long and the county revolts. */
export const REVOLT_THRESHOLD = 25;
export const REVOLT_AFTER_SEASONS = 3;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Advance one full turn: resolve every county, then move to the next season.
 *
 * Seats are not stepped here. Whose turn it is within a season is the turn
 * ORDER's business; this is what happens when the season itself rolls over.
 */
export function advanceSeason(match: MatchState, map?: GameMap): AdvanceResult {
  const season = seasonOfTurn(match.turn.number);
  const events: SeasonEvent[] = [];

  // Marching, battles and wages settle BEFORE the economy. A county taken this
  // season should be worked by its new owner, not resolve one more season under
  // the lord who just lost it.
  let working = match;
  if (map) {
    const conquest = resolveConquest(match, indexMap(map));
    working = conquest.match;
    events.push(...conquest.events);
  }

  const counties: Record<CountyId, CountyState> = { ...working.counties };
  const treasuries = { ...working.treasuries };

  for (const [id, county] of Object.entries(working.counties) as [CountyId, CountyState][]) {
    if (!county.interior) continue;

    // Unclaimed counties do not run an economy. Nobody is allocating their
    // labour or shipping them food, so resolving them starves every neutral
    // county on the map to death within a few seasons and buries the player's
    // own report under the noise. They hold as they are until someone takes
    // them.
    if (!county.owner) continue;

    const faction = county.owner
      ? working.players.find((p) => p.id === county.owner)?.factionId
      : null;
    const bonuses = faction ? getFaction(faction).bonuses : null;

    // Same projection the player was shown while dragging the slider.
    const projection = projectProduction({
      interior: county.interior,
      population: county.population,
      split: { agricultureShare: county.agricultureShare },
      season,
      foodYieldBonus: bonuses?.foodYield ?? 1,
    });

    // --- stores ----------------------------------------------------------
    let wheat = county.food.wheat;
    let cows = county.food.cows;
    const materials: Partial<Record<MaterialResource, number>> = {};

    for (const line of projection.lines) {
      if (line.key === 'wheat') wheat += line.net;
      else if (line.key === 'cows') cows += line.net;
      else if (['wood', 'ore', 'stone', 'gold'].includes(line.key)) {
        materials[line.key as MaterialResource] =
          (materials[line.key as MaterialResource] ?? 0) + line.net;
      }
    }

    // Materials pool empire-wide; food stays in the county that grew it.
    if (county.owner && Object.keys(materials).length > 0) {
      const pool = { ...(treasuries[county.owner] ?? { wood: 0, ore: 0, stone: 0, gold: 0 }) };
      for (const [key, amount] of Object.entries(materials)) {
        pool[key as MaterialResource] = Math.max(
          0,
          Math.round(pool[key as MaterialResource] + (amount ?? 0)),
        );
      }
      treasuries[county.owner as PlayerId] = pool;
    }

    const starving = wheat < 0;
    if (starving) events.push({ county: id, kind: 'starving', detail: 'Stores are empty' });
    wheat = Math.max(0, wheat);
    cows = Math.max(0, cows);

    // --- fields ----------------------------------------------------------
    const fields: FieldTile[] = county.interior.fields.map((field) => {
      // Storm damage settles to barren after one season, per the spec.
      if (field.status === 'parched' || field.status === 'flooded') {
        return { ...field, status: 'barren', reclaimed: 0 };
      }

      if (field.status === 'barren') {
        // Reclamation only progresses if anyone is actually on the land.
        if (projection.farmWorkers <= 0) return field;
        const reclaimed = Math.min(1, field.reclaimed + RECLAIM_PER_SEASON);
        if (reclaimed >= 1 && field.reclaimed < 1) {
          events.push({ county: id, kind: 'reclaimed', detail: `Field ${field.id} reclaimed` });
        }
        return { ...field, reclaimed };
      }

      if (field.status === 'grain') {
        const before = grainStage(field.seasonsGrown);
        const grown = field.seasonsGrown + 1;
        const after = grainStage(grown);

        if (before === 'mature' && after === 'spoiled') {
          events.push({
            county: id,
            kind: 'spoiled',
            detail: `Field ${field.id} was left standing and rotted`,
          });
        } else if (after === 'mature') {
          events.push({ county: id, kind: 'harvest', detail: `Field ${field.id} is ready` });
        }
        return { ...field, seasonsGrown: grown };
      }

      if (field.status === 'cattle' && field.herd > 0 && field.herd < MAX_HERD_PER_FIELD) {
        // Herds grow on their own, up to the crowding limit.
        return { ...field, herd: cows > 0 ? field.herd + 1 : field.herd };
      }

      return field;
    });

    // --- castle ----------------------------------------------------------
    let castleTier = county.castleTier;
    let building = county.building;
    if (building) {
      const seasonsLeft = building.seasonsLeft - 1;
      if (seasonsLeft <= 0) {
        castleTier = building.tier;
        building = null;
        events.push({
          county: id,
          kind: 'castleBuilt',
          detail: `${CASTLES[castleTier].name} completed`,
        });
      } else {
        building = { ...building, seasonsLeft };
      }
    }

    // --- health, happiness, revolt ---------------------------------------
    const needed = county.population * 0.08;
    const rationLevel = needed > 0 ? clamp(wheat / needed, 0, 2) : 1;
    const seasonsAtRation =
      Math.abs(rationLevel - county.rationLevel) < 0.15 ? county.seasonsAtRation + 1 : 1;
    const health = healthFromRations(rationLevel, seasonsAtRation);

    let happiness = clamp(
      county.happiness + SEASON_HAPPINESS_DRIFT[season] + HEALTH_HAPPINESS[health],
      0,
      100,
    );
    if (starving) happiness = clamp(happiness - 10, 0, 100);

    const unrestTurns = happiness <= REVOLT_THRESHOLD ? county.unrestTurns + 1 : 0;
    if (unrestTurns >= REVOLT_AFTER_SEASONS && county.unrestTurns < REVOLT_AFTER_SEASONS) {
      events.push({ county: id, kind: 'revolt', detail: 'The county is in revolt' });
    }

    // Population follows food and mood, not a fixed curve.
    const growth = starving ? -0.04 : happiness > 60 ? 0.02 : 0;
    const population = Math.max(20, Math.round(county.population * (1 + growth)));

    counties[id] = {
      ...county,
      castleTier,
      building,
      food: { wheat: Math.round(wheat), cows: Math.round(cows) },
      happiness,
      population,
      rationLevel,
      seasonsAtRation,
      unrestTurns,
      interior: { ...county.interior, fields },
    };
  }

  const nextTurn = working.turn.number + 1;
  const timerHours = working.config.turnTimerHours;

  // Every army gets its movement allowance back for the new season.
  const refreshed = refreshMovement({
    ...working,
    counties,
    treasuries,
    turn: {
      ...working.turn,
      number: nextTurn,
      phase: 'orders',
      startedAt: working.turn.startedAt,
      deadlineAt: timerHours === null ? null : working.turn.startedAt + timerHours * 3_600_000,
    },
    updatedAt: working.updatedAt,
  });

  return { match: refreshed, events };
}
