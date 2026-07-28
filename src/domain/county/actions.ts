import type { CountyId } from '../ids';
import type { CountyState, MatchState } from '../match/matchState';
import {
  allowedTransitions,
  destroysCrop,
  MAX_HERD_PER_FIELD,
  type FieldStatus,
  type IndustryKind,
  type Weapon,
} from './interior';

/**
 * County actions.
 *
 * Pure state transitions: each takes match state and returns new match state,
 * mutating nothing. The UI dispatches these directly today; the turn/action
 * layer will dispatch the same functions once it exists, so there is no
 * throwaway UI-only mutation to unpick later.
 *
 * Every action VALIDATES rather than trusting the caller. The UI already hides
 * illegal options, but an AI or a replayed action from another device does not
 * go through the UI, and a rule enforced only in a component is not a rule.
 */

export type ActionResult =
  | { readonly ok: true; readonly match: MatchState }
  | { readonly ok: false; readonly reason: string };

const fail = (reason: string): ActionResult => ({ ok: false, reason });

function updateCounty(
  match: MatchState,
  id: CountyId,
  change: (c: CountyState) => CountyState,
): MatchState {
  const county = match.counties[id];
  if (!county) return match;
  return {
    ...match,
    counties: { ...match.counties, [id]: change(county) },
    updatedAt: match.updatedAt,
  };
}

/**
 * Change what a field is used for.
 *
 * `confirmed` exists for the crop-destruction rail: the first call for a field
 * carrying a standing crop refuses and reports why, so the UI can ask. Making
 * that a required second call rather than a UI convention means an AI cannot
 * bulldoze its own harvest by accident either.
 */
export function setFieldUse(
  match: MatchState,
  countyId: CountyId,
  fieldId: string,
  next: FieldStatus,
  opts: { confirmed?: boolean } = {},
): ActionResult {
  const county = match.counties[countyId];
  if (!county?.interior) return fail('County has no interior');

  const field = county.interior.fields.find((f) => f.id === fieldId);
  if (!field) return fail('No such field');

  if (!allowedTransitions(field).includes(next)) {
    return fail(`Cannot change ${field.status} field to ${next}`);
  }
  if (destroysCrop(field) && !opts.confirmed) {
    return fail('Standing crop would be destroyed');
  }

  return {
    ok: true,
    match: updateCounty(match, countyId, (c) => ({
      ...c,
      interior: {
        ...c.interior!,
        fields: c.interior!.fields.map((f) =>
          f.id !== fieldId
            ? f
            : {
                ...f,
                status: next,
                // A change of use resets the crop clock and clears the herd —
                // carrying either over would let a player launder a mature
                // crop between field types.
                seasonsGrown: 0,
                herd: next === 'cattle' ? 1 : 0,
              },
        ),
      },
    })),
  };
}

/** Switch an industry site on or off. */
export function toggleIndustry(
  match: MatchState,
  countyId: CountyId,
  kind: IndustryKind,
): ActionResult {
  const county = match.counties[countyId];
  if (!county?.interior) return fail('County has no interior');
  if (!county.interior.industry.some((s) => s.kind === kind)) {
    return fail(`County has no ${kind}`);
  }

  return {
    ok: true,
    match: updateCounty(match, countyId, (c) => ({
      ...c,
      interior: {
        ...c.interior!,
        industry: c.interior!.industry.map((s) =>
          s.kind === kind ? { ...s, active: !s.active } : s,
        ),
      },
    })),
  };
}

/** Set what the blacksmith is forging. */
export function setWeapon(
  match: MatchState,
  countyId: CountyId,
  weapon: Weapon,
): ActionResult {
  const county = match.counties[countyId];
  if (!county?.interior) return fail('County has no interior');
  if (!county.interior.industry.some((s) => s.kind === 'blacksmith')) {
    return fail('County has no blacksmith');
  }

  return {
    ok: true,
    match: updateCounty(match, countyId, (c) => ({
      ...c,
      interior: {
        ...c.interior!,
        industry: c.interior!.industry.map((s) =>
          s.kind === 'blacksmith' ? { ...s, weapon } : s,
        ),
      },
    })),
  };
}

/** Move the workforce between agriculture and industry. */
export function setLabourSplit(
  match: MatchState,
  countyId: CountyId,
  agricultureShare: number,
): ActionResult {
  if (!Number.isFinite(agricultureShare)) return fail('Share must be a number');
  const clamped = Math.min(1, Math.max(0, agricultureShare));

  return {
    ok: true,
    match: updateCounty(match, countyId, (c) => ({ ...c, agricultureShare: clamped })),
  };
}

/** Move a head of cattle between fields within a county. */
export function moveHerd(
  match: MatchState,
  countyId: CountyId,
  fromFieldId: string,
  toFieldId: string,
): ActionResult {
  const county = match.counties[countyId];
  if (!county?.interior) return fail('County has no interior');

  const from = county.interior.fields.find((f) => f.id === fromFieldId);
  const to = county.interior.fields.find((f) => f.id === toFieldId);
  if (!from || !to) return fail('No such field');
  if (from.status !== 'cattle' || to.status !== 'cattle') return fail('Both fields must be pasture');
  if (from.herd <= 0) return fail('No cattle to move');
  if (to.herd >= MAX_HERD_PER_FIELD) return fail('Destination is already overcrowded');

  return {
    ok: true,
    match: updateCounty(match, countyId, (c) => ({
      ...c,
      interior: {
        ...c.interior!,
        fields: c.interior!.fields.map((f) =>
          f.id === fromFieldId
            ? { ...f, herd: f.herd - 1 }
            : f.id === toFieldId
              ? { ...f, herd: f.herd + 1 }
              : f,
        ),
      },
    })),
  };
}
