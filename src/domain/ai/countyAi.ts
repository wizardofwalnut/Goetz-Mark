import type { CountyId, PlayerId } from '../ids';
import type { MatchState } from '../match/matchState';
import { countiesOwnedBy, isAi, castleRank, CASTLE_TIERS } from '../match/matchState';
import { aiWeightingOf, getFaction, type AiWeighting } from '../../content/factions';
import { CASTLES, upgradeCost } from '../../content/castles';
import { projectProduction, GRAIN_PER_HEAD } from '../county/labour';
import { setFieldUse, setLabourSplit, toggleIndustry } from '../county/actions';
import { seasonOfTurn } from '../season';
import type { MaterialResource } from '../resources';

/**
 * The AI's county management.
 *
 * It plays to its FACTION, and the faction's behaviour is derived from the same
 * bonuses the player sees — so a Warden AI walls up because the Warden's walls
 * are cheap, not because a separate table told it to. Changing a faction's
 * bonuses changes how its AI plays, automatically.
 *
 * Personalities are deliberately generic: there are no named rivals with
 * hand-written quirks. Four factions, four ways of playing, and an AI seat is
 * locked to its faction for the life of the match.
 *
 * Deterministic — no clock, no Math.random. The AI's turn has to replay
 * identically on every device, exactly like combat.
 */

/** Seasons of food in store an AI wants before it stops worrying about food. */
const FOOD_BUFFER_SEASONS = 3;

export interface AiDecision {
  readonly county: CountyId;
  readonly what: string;
}

export interface AiTurnResult {
  readonly match: MatchState;
  readonly decisions: readonly AiDecision[];
}

/**
 * Play one AI player's county-management turn.
 *
 * Order matters and is not arbitrary: feed the county, then work it, then build.
 * An AI that starts a castle while its people starve loses the county before
 * the castle is finished.
 */
export function takeAiTurn(match: MatchState, playerId: PlayerId): AiTurnResult {
  const player = match.players.find((p) => p.id === playerId);
  if (!player || !isAi(player) || player.status !== 'active') {
    return { match, decisions: [] };
  }

  const weighting = aiWeightingOf(getFaction(player.factionId));
  const season = seasonOfTurn(match.turn.number);
  const decisions: AiDecision[] = [];
  let current = match;

  for (const countyId of countiesOwnedBy(current, playerId)) {
    const county = current.counties[countyId];
    if (!county?.interior) continue;

    // --- 1. feed the county ---------------------------------------------
    const needPerSeason = county.population * GRAIN_PER_HEAD;
    const buffer = needPerSeason * FOOD_BUFFER_SEASONS;
    const hungry = county.food.wheat < buffer;

    // Sow every fallow field while short of food; otherwise leave room for
    // pasture, which keeps herds growing without a harvest window.
    const fallow = county.interior.fields.filter((f) => f.status === 'fallow');
    let sown = 0;
    let grazed = 0;

    for (const [index, field] of fallow.entries()) {
      // A quarter to pasture once fed — cattle need no harvest and survive
      // winter, so they are the safer half of a food supply.
      const wantCattle = !hungry && index % 4 === 3;
      const result = setFieldUse(
        current,
        countyId,
        field.id,
        wantCattle ? 'cattle' : 'grain',
      );
      if (result.ok) {
        current = result.match;
        if (wantCattle) grazed++;
        else sown++;
      }
    }
    if (sown > 0 || grazed > 0) {
      decisions.push({
        county: countyId,
        what: `sowed ${sown} field${sown === 1 ? '' : 's'}${grazed ? `, grazed ${grazed}` : ''}`,
      });
    }

    // --- 2. put the industry to work -------------------------------------
    // An economic faction runs everything it has; a martial one leaves sites
    // idle rather than pulling hands off the land.
    const runIndustry = weighting.economy >= 0.45;
    for (const site of current.counties[countyId]?.interior?.industry ?? []) {
      if (site.active === runIndustry) continue;
      const result = toggleIndustry(current, countyId, site.kind);
      if (result.ok) {
        current = result.match;
        decisions.push({
          county: countyId,
          what: `${runIndustry ? 'opened' : 'closed'} the ${site.kind}`,
        });
      }
    }

    // --- 3. point the workforce ------------------------------------------
    const share = chooseLabourSplit({
      weighting,
      hungry,
      // Winter fields produce nothing, so hands are better spent at the forge.
      winter: season === 'winter',
      buildingCastle: county.building !== null,
    });
    const setShare = setLabourSplit(current, countyId, share);
    if (setShare.ok) current = setShare.match;

    // --- 4. build ---------------------------------------------------------
    const after = current.counties[countyId];
    if (after && !after.building && !hungry) {
      const next = nextCastleTier(after.castleTier);
      if (next && wantsCastle(weighting, after.castleTier)) {
        const treasury = current.treasuries[playerId];
        const cost = scaledCost(after.castleTier, next, getFaction(player.factionId).bonuses.castleCost);
        if (treasury && canAfford(treasury, cost)) {
          current = {
            ...current,
            treasuries: { ...current.treasuries, [playerId]: spend(treasury, cost) },
            counties: {
              ...current.counties,
              [countyId]: {
                ...after,
                building: { tier: next, seasonsLeft: CASTLES[next].seasons },
              },
            },
          };
          decisions.push({ county: countyId, what: `began a ${CASTLES[next].name}` });
        }
      }
    }
  }

  return { match: current, decisions };
}

/**
 * Where to point the workforce.
 *
 * Food comes first regardless of faction — a starving county revolts and is
 * lost, and no bonus is worth that. Only once fed does the faction's own
 * leaning decide anything.
 */
export function chooseLabourSplit(opts: {
  weighting: AiWeighting;
  hungry: boolean;
  winter: boolean;
  buildingCastle: boolean;
}): number {
  const { weighting, hungry, winter, buildingCastle } = opts;

  if (hungry && !winter) return 0.9;
  // Nothing grows in winter, so hands on the land are hands wasted.
  if (winter) return 0.15;

  // Base leaning: an economic faction pushes industry, a martial one keeps the
  // land fed and the population growing for conscription.
  let share = 0.65 - weighting.economy * 0.3;
  if (buildingCastle) share -= 0.2 * weighting.turtling;

  return Math.min(0.95, Math.max(0.1, share));
}

/** The next rung up the ladder, or null at the top. */
export function nextCastleTier(current: string) {
  const index = CASTLE_TIERS.indexOf(current as (typeof CASTLE_TIERS)[number]);
  if (index < 0 || index >= CASTLE_TIERS.length - 1) return null;
  return CASTLE_TIERS[index + 1] ?? null;
}

/**
 * Whether this faction wants to keep building.
 *
 * A turtling faction climbs the whole ladder; an aggressive one stops once it
 * has walls worth the name and spends the rest on troops.
 */
export function wantsCastle(weighting: AiWeighting, current: string): boolean {
  const ceiling = Math.round(1 + weighting.turtling * (CASTLE_TIERS.length - 2));
  return castleRank(current as (typeof CASTLE_TIERS)[number]) < ceiling;
}

const scaledCost = (
  from: string,
  to: string,
  costMultiplier: number,
): Partial<Record<MaterialResource, number>> => {
  const base = upgradeCost(
    from as (typeof CASTLE_TIERS)[number],
    to as (typeof CASTLE_TIERS)[number],
  );
  const out: Partial<Record<MaterialResource, number>> = {};
  for (const [key, value] of Object.entries(base)) {
    out[key as MaterialResource] = Math.round((value ?? 0) * costMultiplier);
  }
  return out;
};

const canAfford = (
  treasury: Record<MaterialResource, number>,
  cost: Partial<Record<MaterialResource, number>>,
) => Object.entries(cost).every(([k, v]) => treasury[k as MaterialResource] >= (v ?? 0));

const spend = (
  treasury: Record<MaterialResource, number>,
  cost: Partial<Record<MaterialResource, number>>,
): Record<MaterialResource, number> => {
  const out = { ...treasury };
  for (const [k, v] of Object.entries(cost)) {
    out[k as MaterialResource] -= v ?? 0;
  }
  return out;
};

/** Play every AI seat's turn, in seat order so the result is reproducible. */
export function takeAllAiTurns(match: MatchState): AiTurnResult {
  let current = match;
  const decisions: AiDecision[] = [];

  for (const player of [...match.players].sort((a, b) => a.seat - b.seat)) {
    if (!isAi(player)) continue;
    const result = takeAiTurn(current, player.id);
    current = result.match;
    decisions.push(...result.decisions);
  }

  return { match: current, decisions };
}

/** Exposed for the projection the AI reasons about, so tests can check it. */
export const projectFor = projectProduction;
