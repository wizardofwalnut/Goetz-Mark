import type { ArmyId, CountyId, PlayerId } from '../ids';
import type { Army, MatchState } from '../match/matchState';
import { garrisonOf, troopCount, countiesOwnedBy } from '../match/matchState';
import { resolveBattle, attackerTakesGround, type Stance } from '../combat/battleResolver';
import { seedFrom } from '../rng';
import { severedFrom, type MapIndex } from '../map/mapQueries';
import { CASTLES } from '../../content/castles';
import { upkeepOf } from './armyActions';
import type { MaterialResource } from '../resources';

/**
 * Conquest, upkeep and desertion — resolved once per season.
 *
 * Three rules from the design doc meet here, and each is a deliberate departure
 * from or fidelity to the source:
 *
 *  1. An UNDEFENDED county is annexed peacefully. The original forced a battle
 *     even against nothing; the doc cuts that on purpose.
 *  2. A DEFENDED county forces a battle, and only a cleared field takes the
 *     ground. A stalemate leaves the defender holding it, so attacking is never
 *     free.
 *  3. Counties CUT OFF from their owner's capital fall away. Holding a
 *     connected chain is what makes contiguous territory worth planning for.
 */

export interface ConquestEvent {
  readonly county: CountyId;
  readonly kind: 'annexed' | 'battle' | 'repelled' | 'severed' | 'deserted';
  readonly detail: string;
}

export interface ConquestResult {
  readonly match: MatchState;
  readonly events: readonly ConquestEvent[];
}

/** Stance an AI or an unattended garrison defends with. */
const DEFAULT_DEFENCE_STANCE: Stance = 'balanced';
const DEFAULT_ATTACK_STANCE: Stance = 'balanced';

/** Seasons a mercenary contingent tolerates going unpaid before it walks. */
export const DESERTION_AFTER_SEASONS = 2;

export function resolveConquest(match: MatchState, ix: MapIndex): ConquestResult {
  const events: ConquestEvent[] = [];
  let current = match;
  /** Counties that changed hands during THIS resolution. */
  const takenThisSeason = new Set<CountyId>();

  // --- 1. armies still on the road finish their march --------------------
  current = advanceTransits(current);

  // --- 2. contested counties resolve, in a stable order -------------------
  // Sorted so two devices resolve the same battles in the same sequence.
  const contested = [...new Set(
    Object.values(current.armies)
      .filter((a) => a.location.kind === 'garrison')
      .map((a) => (a.location as { county: CountyId }).county),
  )].sort();

  for (const countyId of contested) {
    const county = current.counties[countyId];
    if (!county) continue;

    const present = garrisonOf(current, countyId).filter((a) => troopCount(a.troops) > 0);
    const attackers = present.filter((a) => a.owner !== county.owner);
    if (attackers.length === 0) continue;

    const defenders = present.filter((a) => a.owner === county.owner);
    // Whoever brought the most is treated as leading the assault.
    const lead = [...attackers].sort(
      (a, b) => troopCount(b.troops) - troopCount(a.troops),
    )[0]!;

    if (defenders.length === 0) {
      // Rule 1: nothing to fight. The county changes hands quietly.
      current = setOwner(current, countyId, lead.owner);
      takenThisSeason.add(countyId);
      events.push({
        county: countyId,
        kind: 'annexed',
        detail: `${countyId} annexed without a fight`,
      });
      continue;
    }

    // Rule 2: a defended county forces a battle.
    const defenderTroops = mergeTroops(defenders);
    const attackerTroops = mergeTroops(attackers);
    const castle = CASTLES[county.castleTier];

    const result = resolveBattle({
      attacker: {
        troops: attackerTroops,
        stance: DEFAULT_ATTACK_STANCE,
        factionId: factionOf(current, lead.owner),
      },
      defender: {
        troops: defenderTroops,
        stance: DEFAULT_DEFENCE_STANCE,
        factionId: county.owner ? factionOf(current, county.owner) : null,
      },
      terrain: 'open',
      // Derived from match data so the same battle replays identically
      // everywhere, rather than being stored separately.
      seed: seedFrom(current.id, current.turn.number, countyId),
    });

    // The castle multiplies what survives on the defending side — a keep is
    // worth more than the open field the resolver scored.
    const survivorBias = castle.defence;
    current = applyCasualties(current, attackers, result.attackerLosses, 1);
    current = applyCasualties(current, defenders, result.defenderLosses, survivorBias);

    if (attackerTakesGround(result)) {
      current = setOwner(current, countyId, lead.owner);
      takenThisSeason.add(countyId);
      events.push({
        county: countyId,
        kind: 'battle',
        detail: `${countyId} stormed — ${troopCount(result.attackerLosses)} lost taking it`,
      });
    } else {
      events.push({
        county: countyId,
        kind: 'repelled',
        detail: `assault on ${countyId} thrown back`,
      });
    }
  }

  // --- 3. territory cut off from its capital falls away -------------------
  for (const player of current.players) {
    const owned = countiesOwnedBy(current, player.id);
    if (owned.length <= 1) continue;

    // The capital is the seat's starting county if still held, else the
    // largest holding — a player should not lose everything for losing one.
    const capital = capitalOf(current, ix, player.id, owned);
    if (!capital) continue;

    for (const lost of severedFrom(ix, owned, capital)) {
      // A county taken THIS season gets a season's grace. Without it a lord can
      // storm a county and lose it in the same resolution, before ever having a
      // turn to link it up — the capture is simply thrown away, and the report
      // reads as thrashing rather than as a campaign. The rule is meant to
      // punish letting a chain be cut, not to punish taking ground.
      if (takenThisSeason.has(lost)) continue;

      current = setOwner(current, lost, null);
      events.push({
        county: lost,
        kind: 'severed',
        detail: `${lost} cut off and lost`,
      });
    }
  }

  // --- 4. wages, and mercenaries who have had enough ----------------------
  const paid = payUpkeep(current);
  current = paid.match;
  events.push(...paid.events);

  return { match: current, events };
}

/** Armies mid-march continue; those that arrive drop into the county. */
function advanceTransits(match: MatchState): MatchState {
  const armies: Record<string, Army> = { ...match.armies };

  for (const [id, army] of Object.entries(match.armies)) {
    if (army.location.kind !== 'inTransit') continue;
    const { from, to, progress } = army.location;
    // A season of marching closes the remaining distance in most cases; a very
    // slow host may need another.
    const next = progress + 0.6;
    armies[id] =
      next >= 1
        ? { ...army, location: { kind: 'garrison', county: to }, movementRemaining: 0 }
        : { ...army, location: { kind: 'inTransit', from, to, progress: next } };
  }

  return { ...match, armies };
}

const mergeTroops = (armies: readonly Army[]) => {
  const total: Record<string, number> = {};
  for (const army of armies) {
    for (const [kind, count] of Object.entries(army.troops)) {
      total[kind] = (total[kind] ?? 0) + (count ?? 0);
    }
  }
  return total as Army['troops'];
};

const factionOf = (match: MatchState, id: PlayerId) =>
  match.players.find((p) => p.id === id)?.factionId ?? null;

function setOwner(match: MatchState, countyId: CountyId, owner: PlayerId | null): MatchState {
  const county = match.counties[countyId];
  if (!county) return match;
  return {
    ...match,
    counties: {
      ...match.counties,
      [countyId]: {
        ...county,
        owner,
        // A change of hands unsettles the county; it does not carry the old
        // lord's contentment across.
        happiness: Math.min(county.happiness, 45),
        unrestTurns: 0,
      },
    },
  };
}

/**
 * Spread a side's losses across the armies that made it up.
 *
 * `survivorBias` above 1 means fewer die — a castle's protection applied after
 * the fact, so the resolver stays a pure function of composition and stance.
 */
function applyCasualties(
  match: MatchState,
  armies: readonly Army[],
  losses: Army['troops'],
  survivorBias: number,
): MatchState {
  const totalBefore = armies.reduce((s, a) => s + troopCount(a.troops), 0);
  if (totalBefore === 0) return match;

  const next: Record<string, Army> = { ...match.armies };

  for (const army of armies) {
    const share = troopCount(army.troops) / totalBefore;
    const troops = { ...army.troops };

    for (const [kind, lost] of Object.entries(losses) as [keyof Army['troops'], number][]) {
      const take = Math.round(((lost ?? 0) * share) / survivorBias);
      const have = troops[kind] ?? 0;
      const removed = Math.min(have, take);
      if (removed > 0) troops[kind] = have - removed;
      if ((troops[kind] ?? 0) <= 0) delete troops[kind];
    }

    if (troopCount(troops) === 0) delete next[army.id];
    else next[army.id] = { ...army, troops };
  }

  return { ...match, armies: next };
}

/** Wages come out of the shared pool; unpaid mercenaries eventually walk. */
function payUpkeep(match: MatchState): ConquestResult {
  const events: ConquestEvent[] = [];
  const treasuries = { ...match.treasuries };
  const armies: Record<string, Army> = { ...match.armies };

  for (const player of match.players) {
    const owed = Object.values(match.armies)
      .filter((a) => a.owner === player.id)
      .reduce((sum, a) => sum + upkeepOf(a.troops), 0);
    if (owed === 0) continue;

    const pool = treasuries[player.id];
    if (!pool) continue;

    if (pool.gold >= owed) {
      treasuries[player.id] = { ...pool, gold: pool.gold - owed } as Record<
        MaterialResource,
        number
      >;
      for (const army of Object.values(match.armies)) {
        if (army.owner === player.id && army.unpaidUpkeepTurns > 0) {
          armies[army.id] = { ...army, unpaidUpkeepTurns: 0 };
        }
      }
      continue;
    }

    // Cannot cover the wage bill: pay what there is and start the clock.
    treasuries[player.id] = { ...pool, gold: 0 } as Record<MaterialResource, number>;

    for (const army of Object.values(match.armies)) {
      if (army.owner !== player.id) continue;
      const unpaid = army.unpaidUpkeepTurns + 1;

      if (unpaid >= DESERTION_AFTER_SEASONS && (army.troops.mercenaries ?? 0) > 0) {
        const troops = { ...army.troops };
        delete troops.mercenaries;
        events.push({
          county:
            army.location.kind === 'garrison'
              ? army.location.county
              : army.location.to,
          kind: 'deserted',
          detail: 'unpaid mercenaries have deserted',
        });
        if (troopCount(troops) === 0) delete armies[army.id];
        else armies[army.id] = { ...army, troops, unpaidUpkeepTurns: unpaid };
      } else {
        armies[army.id] = { ...army, unpaidUpkeepTurns: unpaid };
      }
    }
  }

  return { match: { ...match, treasuries, armies }, events };
}

/** A player's seat of power: their starting county if held, else their largest. */
function capitalOf(
  match: MatchState,
  ix: MapIndex,
  player: PlayerId,
  owned: readonly CountyId[],
): CountyId | null {
  const seat = match.players.find((p) => p.id === player)?.seat;
  const start = ix.map.starts.find((s) => s.seat === seat)?.county;
  if (start && owned.includes(start)) return start;

  return (
    [...owned].sort(
      (a, b) =>
        (ix.countyById.get(b)?.size ?? 0) - (ix.countyById.get(a)?.size ?? 0) ||
        a.localeCompare(b),
    )[0] ?? null
  );
}

export const _internal = { advanceTransits, payUpkeep, capitalOf };
export type { ArmyId };
