import { armyId, type ArmyId, type CountyId, type PlayerId } from '../ids';
import type { Army, MatchState, Regiment, UnitKind } from '../match/matchState';
import { troopCount } from '../match/matchState';
import { UNITS } from '../../content/units';
import { areAdjacent, moveCost, type MapIndex } from '../map/mapQueries';
import type { MaterialResource } from '../resources';

/**
 * Army orders.
 *
 * Pure transitions like the county actions: take match state, return new match
 * state, validate rather than trust. The UI, the AI and a replayed order from
 * another device all come through here, so a rule enforced in a component is
 * not enforced at all.
 */

export type ArmyResult =
  | { readonly ok: true; readonly match: MatchState; readonly armyId?: ArmyId }
  | { readonly ok: false; readonly reason: string };

const fail = (reason: string): ArmyResult => ({ ok: false, reason });

/** Peasants pulled per soldier. Conscription costs the county its workforce. */
export const PEASANTS_PER_SOLDIER = 3;
/** Happiness lost per 10 troops raised — conscription is never popular. */
export const CONSCRIPTION_UNHAPPINESS = 1.5;
/** A county will not conscript itself below this population. */
export const MIN_POPULATION_AFTER_LEVY = 60;

/** Materials needed to equip a regiment. */
export function equipmentCost(troops: Regiment): Partial<Record<MaterialResource, number>> {
  const total: Partial<Record<MaterialResource, number>> = {};
  for (const [kind, count] of Object.entries(troops) as [UnitKind, number][]) {
    if (!count) continue;
    for (const [res, amount] of Object.entries(UNITS[kind].buildCost) as [
      MaterialResource,
      number,
    ][]) {
      total[res] = (total[res] ?? 0) + amount * count;
    }
  }
  return total;
}

/** Gold per season to keep an army in the field. */
export const upkeepOf = (troops: Regiment): number =>
  (Object.entries(troops) as [UnitKind, number][]).reduce(
    (sum, [kind, count]) => sum + UNITS[kind].upkeep * (count ?? 0),
    0,
  );

/** An army moves at the pace of its slowest contingent. */
export const armySpeed = (troops: Regiment): number => {
  const speeds = (Object.entries(troops) as [UnitKind, number][])
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([kind]) => UNITS[kind].speed);
  return speeds.length === 0 ? 0 : Math.min(...speeds);
};

const freeArmyId = (match: MatchState, owner: PlayerId): ArmyId => {
  let n = 0;
  let candidate = armyId(`a_${owner}_${n}`);
  while (match.armies[candidate]) candidate = armyId(`a_${owner}_${++n}`);
  return candidate;
};

/**
 * Raise an army from a county's population.
 *
 * Conscription is deliberately expensive in more than materials: it takes
 * peasants off the land and costs happiness. An empire that levies everything
 * it can starves and revolts, which is the intended pressure against
 * doomstacking.
 */
export function recruitArmy(
  match: MatchState,
  countyId: CountyId,
  troops: Regiment,
): ArmyResult {
  const county = match.counties[countyId];
  if (!county) return fail('No such county');
  if (!county.owner) return fail('County is unclaimed');

  const size = troopCount(troops);
  if (size <= 0) return fail('No troops specified');

  for (const kind of Object.keys(troops) as UnitKind[]) {
    if ((troops[kind] ?? 0) > 0 && !UNITS[kind].recruitable) {
      return fail(`${UNITS[kind].name} are hired, not raised`);
    }
  }

  const peasants = size * PEASANTS_PER_SOLDIER;
  if (county.population - peasants < MIN_POPULATION_AFTER_LEVY) {
    return fail('Not enough people to levy without emptying the county');
  }

  const owner = county.owner;
  const treasury = match.treasuries[owner];
  if (!treasury) return fail('Player has no treasury');

  const cost = equipmentCost(troops);
  for (const [res, amount] of Object.entries(cost) as [MaterialResource, number][]) {
    if (treasury[res] < amount) return fail(`Not enough ${res} to arm them`);
  }

  const spent = { ...treasury };
  for (const [res, amount] of Object.entries(cost) as [MaterialResource, number][]) {
    spent[res] -= amount;
  }

  const id = freeArmyId(match, owner);
  const army: Army = {
    id,
    owner,
    troops: { ...troops },
    location: { kind: 'garrison', county: countyId },
    // A new levy can march the season it is raised. Conscription already costs
    // peasants, materials and happiness; making it also sit idle a season made
    // the March button dead on arrival and read as a bug rather than a rule.
    movementRemaining: armySpeed(troops),
    unpaidUpkeepTurns: 0,
  };

  return {
    ok: true,
    armyId: id,
    match: {
      ...match,
      armies: { ...match.armies, [id]: army },
      treasuries: { ...match.treasuries, [owner]: spent },
      counties: {
        ...match.counties,
        [countyId]: {
          ...county,
          population: county.population - peasants,
          happiness: Math.max(
            0,
            county.happiness - (size / 10) * CONSCRIPTION_UNHAPPINESS,
          ),
        },
      },
    },
  };
}

/**
 * Order an army into an adjacent county.
 *
 * If it cannot cover the ground this season it STOPS PARTWAY and is attackable
 * there. That is faithful to the source and is a real decision — marching a
 * slow army across open country in reach of a fast one is a choice, not
 * friction to be smoothed away.
 */
export function moveArmy(
  match: MatchState,
  ix: MapIndex,
  id: ArmyId,
  to: CountyId,
): ArmyResult {
  const army = match.armies[id];
  if (!army) return fail('No such army');
  if (troopCount(army.troops) === 0) return fail('Army has no troops');
  if (army.location.kind === 'inTransit') return fail('Army is already on the march');

  const from = army.location.county;
  if (from === to) return fail('Army is already there');
  if (!areAdjacent(ix, from, to)) return fail('Counties do not border each other');

  const cost = moveCost(ix, from, to);
  if (!Number.isFinite(cost)) return fail('No route');

  const budget = army.movementRemaining;
  if (budget <= 0) return fail('Army has no movement left this season');

  if (budget >= cost) {
    return {
      ok: true,
      match: {
        ...match,
        armies: {
          ...match.armies,
          [id]: {
            ...army,
            location: { kind: 'garrison', county: to },
            movementRemaining: budget - cost,
          },
        },
      },
    };
  }

  // Short of the far side: stop on the road and be caught there if unlucky.
  return {
    ok: true,
    match: {
      ...match,
      armies: {
        ...match.armies,
        [id]: {
          ...army,
          location: { kind: 'inTransit', from, to, progress: budget / cost },
          movementRemaining: 0,
        },
      },
    },
  };
}

/** Disband an army back into the county it stands in. */
export function disbandArmy(match: MatchState, id: ArmyId): ArmyResult {
  const army = match.armies[id];
  if (!army) return fail('No such army');
  if (army.location.kind !== 'garrison') return fail('Cannot disband on the march');

  const countyId = army.location.county;
  const county = match.counties[countyId];
  const armies = { ...match.armies };
  delete armies[id];

  // Half the levy goes home; the rest has scattered.
  const returning = Math.floor((troopCount(army.troops) * PEASANTS_PER_SOLDIER) / 2);

  return {
    ok: true,
    match: {
      ...match,
      armies,
      counties: county
        ? {
            ...match.counties,
            [countyId]: { ...county, population: county.population + returning },
          }
        : match.counties,
    },
  };
}

/**
 * Merge one army into another.
 *
 * Blocked when either carries mercenaries: rival bands will not serve in the
 * same host, which the design doc keeps from the original.
 */
export function mergeArmies(match: MatchState, intoId: ArmyId, fromId: ArmyId): ArmyResult {
  const into = match.armies[intoId];
  const from = match.armies[fromId];
  if (!into || !from) return fail('No such army');
  if (into.owner !== from.owner) return fail('Cannot merge another lord’s army');
  if (into.location.kind !== 'garrison' || from.location.kind !== 'garrison') {
    return fail('Both armies must be halted');
  }
  if (into.location.county !== from.location.county) return fail('Armies are not together');
  if ((into.troops.mercenaries ?? 0) > 0 || (from.troops.mercenaries ?? 0) > 0) {
    return fail('Mercenary bands will not serve alongside rivals');
  }

  const troops: Regiment = {};
  for (const kind of ['militia', 'archers', 'knights', 'mercenaries'] as UnitKind[]) {
    const total = (into.troops[kind] ?? 0) + (from.troops[kind] ?? 0);
    if (total > 0) troops[kind] = total;
  }

  const armies = { ...match.armies };
  delete armies[fromId];
  armies[intoId] = {
    ...into,
    troops,
    // The merged host moves at its slowest contingent's remaining pace.
    movementRemaining: Math.min(into.movementRemaining, from.movementRemaining),
  };

  return { ok: true, match: { ...match, armies } };
}

/** Refresh every army's movement allowance at the start of a season. */
export function refreshMovement(match: MatchState): MatchState {
  const armies: Record<string, Army> = {};
  for (const [id, army] of Object.entries(match.armies)) {
    armies[id] = { ...army, movementRemaining: armySpeed(army.troops) };
  }
  return { ...match, armies };
}
