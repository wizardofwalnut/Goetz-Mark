import type { CountyId, PlayerId } from './ids';
import type { MatchState } from './match/matchState';
import { countiesOwnedBy } from './match/matchState';
import { neighboursOf, type MapIndex } from './map/mapQueries';

/**
 * What a given player can see.
 *
 * v1 has no fog of war — every query below returns everything. The point of the
 * indirection is that fog stays a FILTER rather than a rewrite: UI and AI ask
 * "what can this player see?" from the start, so switching the mode later does
 * not mean auditing every call site for hidden omniscience.
 *
 * That is the whole reason this file exists while doing nothing interesting.
 * The moment a component reads `match.counties` directly to decide what to
 * draw, fog becomes a rewrite again.
 */

export type VisibilityMode = 'open' | 'fog';

export interface VisibilityRules {
  readonly mode: VisibilityMode;
}

export const OPEN_WORLD: VisibilityRules = { mode: 'open' };

/**
 * Counties this player may see the detail of.
 *
 * Under fog that becomes owned counties plus their neighbours plus anywhere an
 * army of theirs stands.
 */
export function visibleCounties(
  match: MatchState,
  ix: MapIndex,
  player: PlayerId,
  rules: VisibilityRules = OPEN_WORLD,
): Set<CountyId> {
  const all = Object.keys(match.counties) as CountyId[];
  if (rules.mode === 'open') return new Set(all);

  const seen = new Set<CountyId>();
  for (const county of countiesOwnedBy(match, player)) {
    seen.add(county);
    for (const n of neighboursOf(ix, county)) seen.add(n);
  }
  for (const army of Object.values(match.armies)) {
    if (army.owner !== player) continue;
    if (army.location.kind === 'garrison') {
      seen.add(army.location.county);
      for (const n of neighboursOf(ix, army.location.county)) seen.add(n);
    } else {
      seen.add(army.location.from);
      seen.add(army.location.to);
    }
  }
  return seen;
}

export const canSeeCounty = (
  match: MatchState,
  ix: MapIndex,
  player: PlayerId,
  county: CountyId,
  rules: VisibilityRules = OPEN_WORLD,
) => rules.mode === 'open' || visibleCounties(match, ix, player, rules).has(county);

/**
 * Whether a player may see another's army composition.
 *
 * Even with no fog this is not automatically yes — the spec's info panel for an
 * enemy army is deliberately limited. Ownership and rough size are public;
 * exact composition is not.
 */
export const canInspectArmy = (player: PlayerId, armyOwner: PlayerId) => player === armyOwner;
