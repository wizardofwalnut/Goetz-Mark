import type { CountyId, PlayerId } from '../ids';
import type { MatchState, Regiment } from '../match/matchState';
import {
  countiesOwnedBy,
  garrisonOf,
  isAi,
  troopCount,
} from '../match/matchState';
import { aiWeightingOf, getFaction, type AiWeighting } from '../../content/factions';
import { neighboursOf, type MapIndex } from '../map/mapQueries';
import { moveArmy, recruitArmy, upkeepOf } from '../army/armyActions';
import { TERRAIN_DEFENCE_MODIFIER } from '../map/mapTypes';
import { CASTLES } from '../../content/castles';

/**
 * The AI's military.
 *
 * This is where `aggression` finally does something. It is derived from the
 * faction's attack and defence bonuses, so a Knight — whose attacks are cheap —
 * raises troops sooner and marches on weaker neighbours, while a Warden sits on
 * its walls and only garrisons. Nothing here is hand-tuned per faction; change
 * the bonuses and the behaviour follows.
 *
 * Deterministic: no clock, no Math.random. Targets are chosen by score and ties
 * broken by id, so an AI turn replays identically everywhere.
 */

export interface MilitaryDecision {
  readonly county: CountyId;
  readonly what: string;
}

export interface MilitaryResult {
  readonly match: MatchState;
  readonly decisions: readonly MilitaryDecision[];
}

/** Gold kept back so an army is not raised into instant desertion. */
const WAGE_RESERVE_SEASONS = 4;

/** Troops a county keeps at home regardless of how aggressive it feels. */
export const HOME_GARRISON = 10;

/**
 * How much force this faction wants standing before it considers attacking.
 * A cautious faction wants a large margin; an aggressive one will take a fight
 * closer to even.
 */
export const requiredAdvantage = (weighting: AiWeighting) => 2.4 - weighting.aggression * 1.2;

/** Score a county as a target: weak, valuable and adjacent beats strong. */
export function scoreTarget(
  match: MatchState,
  ix: MapIndex,
  countyId: CountyId,
): number {
  const def = ix.countyById.get(countyId);
  const state = match.counties[countyId];
  if (!def || !state) return -Infinity;

  const defenders = garrisonOf(match, countyId).reduce(
    (sum, a) => sum + troopCount(a.troops),
    0,
  );
  const castle = CASTLES[state.castleTier].defence;
  const terrain = TERRAIN_DEFENCE_MODIFIER[def.terrain];

  // Value what it produces and how much can be built there; discount how hard
  // it will be to hold and to take.
  const worth = def.size * 2 + def.yield / 4;
  const cost = defenders * 0.5 * castle * terrain;
  // Unclaimed ground is worth taking first — no owner means no reprisal.
  const freeLand = state.owner === null ? 6 : 0;

  return worth + freeLand - cost;
}

/**
 * Play one AI player's military turn.
 *
 * Order: garrison what is held, raise what can be afforded, then march. An AI
 * that marches before it garrisons loses the county it just left.
 */
export function takeMilitaryTurn(
  match: MatchState,
  ix: MapIndex,
  playerId: PlayerId,
): MilitaryResult {
  const player = match.players.find((p) => p.id === playerId);
  if (!player || !isAi(player) || player.status !== 'active') {
    return { match, decisions: [] };
  }

  const weighting = aiWeightingOf(getFaction(player.factionId));
  const decisions: MilitaryDecision[] = [];
  let current = match;

  // --- raise troops ------------------------------------------------------
  // A defensive faction still raises — it simply never marches them.
  for (const countyId of countiesOwnedBy(current, playerId)) {
    const county = current.counties[countyId];
    if (!county) continue;

    const here = garrisonOf(current, countyId).reduce(
      (sum, a) => sum + troopCount(a.troops),
      0,
    );

    // Want more than a home garrison only to the extent the faction is
    // inclined to use it.
    const want = Math.round(HOME_GARRISON + weighting.aggression * 30);
    if (here >= want) continue;

    const treasury = current.treasuries[playerId];
    if (!treasury) continue;

    const shortfall = want - here;
    const batch = composeLevy(shortfall, weighting);

    // Do not raise troops the treasury cannot keep paying — an army that
    // deserts next season was worse than no army at all.
    const projectedWages =
      (Object.values(current.armies)
        .filter((a) => a.owner === playerId)
        .reduce((s, a) => s + upkeepOf(a.troops), 0) +
        upkeepOf(batch)) *
      WAGE_RESERVE_SEASONS;
    if (treasury.gold < projectedWages) continue;

    const result = recruitArmy(current, countyId, batch);
    if (result.ok) {
      current = result.match;
      decisions.push({
        county: countyId,
        what: `raised ${troopCount(batch)} troops`,
      });
    }
  }

  // --- march -------------------------------------------------------------
  // A faction with no appetite for it stays home. This is the single clearest
  // expression of aggression in play.
  if (weighting.aggression >= 0.4) {
    for (const army of Object.values(current.armies)) {
      if (army.owner !== playerId) continue;
      if (army.location.kind !== 'garrison') continue;
      if (army.movementRemaining <= 0) continue;

      const from = army.location.county;
      const strength = troopCount(army.troops);
      // Never strip a county bare to go raiding.
      if (strength <= HOME_GARRISON) continue;

      // Only take ground that will still be connected once taken. Without this
      // an army whose home county falls behind it captures land that is
      // severed the same season it is won — the capture is thrown away, and
      // the pair of events reads as thrashing rather than as a campaign.
      const held = new Set(countiesOwnedBy(current, playerId));
      const connects = (target: CountyId) =>
        held.size === 0 || neighboursOf(ix, target).some((n) => held.has(n));

      const targets = neighboursOf(ix, from)
        .filter((n) => current.counties[n]?.owner !== playerId)
        .filter(connects)
        .map((n) => ({ id: n, score: scoreTarget(current, ix, n) }))
        .filter((t) => t.score > 0)
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

      const best = targets[0];
      if (!best) continue;

      const defenders = garrisonOf(current, best.id).reduce(
        (sum, a) => sum + troopCount(a.troops),
        0,
      );
      // Undefended ground is simply taken; otherwise the margin must be there.
      const needed = defenders * requiredAdvantage(weighting);
      if (defenders > 0 && strength < needed) continue;

      const result = moveArmy(current, ix, army.id, best.id);
      if (result.ok) {
        current = result.match;
        decisions.push({
          county: best.id,
          what: defenders === 0 ? `marched on undefended ${best.id}` : `attacked ${best.id}`,
        });
      }
    }
  }

  return { match: current, decisions };
}

/**
 * What to raise.
 *
 * Aggressive factions want knights to break a line; cautious ones want cheap
 * bodies and archers to bleed an attacker from behind a wall.
 */
export function composeLevy(size: number, weighting: AiWeighting): Regiment {
  const total = Math.max(1, size);
  const knights = Math.round(total * weighting.aggression * 0.25);
  const archers = Math.round(total * (0.2 + weighting.turtling * 0.25));
  const militia = Math.max(0, total - knights - archers);

  const levy: Regiment = {};
  if (militia > 0) levy.militia = militia;
  if (archers > 0) levy.archers = archers;
  if (knights > 0) levy.knights = knights;
  return levy;
}

/** Play every AI seat's military turn, in seat order. */
export function takeAllMilitaryTurns(match: MatchState, ix: MapIndex): MilitaryResult {
  let current = match;
  const decisions: MilitaryDecision[] = [];

  for (const player of [...match.players].sort((a, b) => a.seat - b.seat)) {
    if (!isAi(player)) continue;
    const result = takeMilitaryTurn(current, ix, player.id);
    current = result.match;
    decisions.push(...result.decisions);
  }

  return { match: current, decisions };
}
