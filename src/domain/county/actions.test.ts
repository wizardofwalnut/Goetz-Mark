import { describe, expect, it } from 'vitest';
import { ALDERMARCH } from '../../content/maps/aldermarch.generated';
import { createSoloMatch } from '../match/createMatch';
import { factionId, countyId } from '../ids';
import { createRng } from '../rng';
import { setFieldUse, setLabourSplit, toggleIndustry, moveHerd } from './actions';
import { MAX_HERD_PER_FIELD } from './interior';
import type { MatchState } from '../match/matchState';

const HOLLOWMERE = countyId('hollowmere');

const newMatch = (): MatchState =>
  createSoloMatch({
    map: ALDERMARCH,
    playerName: 'You',
    factionId: factionId('warden'),
    opponents: [{ name: 'Rival', factionId: factionId('knight') }],
    now: 0,
    rng: createRng(4242).next,
  });

const fieldsOf = (m: MatchState) => m.counties[HOLLOWMERE]!.interior!.fields;
const firstFallow = (m: MatchState) => fieldsOf(m).find((f) => f.status === 'fallow')!;

describe('county actions', () => {
  it('mutates nothing — returns new state', () => {
    const match = newMatch();
    const before = JSON.stringify(match);
    setFieldUse(match, HOLLOWMERE, firstFallow(match).id, 'grain');
    expect(JSON.stringify(match)).toBe(before);
  });

  it('sows a fallow field', () => {
    const match = newMatch();
    const target = firstFallow(match);
    const result = setFieldUse(match, HOLLOWMERE, target.id, 'grain');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.match.counties[HOLLOWMERE]!.interior!.fields.find(
      (f) => f.id === target.id,
    )!;
    expect(after.status).toBe('grain');
    expect(after.seasonsGrown).toBe(0);
  });

  it('refuses to replant barren land that is not reclaimed', () => {
    const match = newMatch();
    const barren = fieldsOf(match).find((f) => f.status === 'barren');
    // The generated interior seeds some barren land; if the seed ever changes
    // so that it does not, this test is meaningless rather than passing.
    expect(barren, 'expected some barren land in the generated interior').toBeDefined();

    const result = setFieldUse(match, HOLLOWMERE, barren!.id, 'grain');
    expect(result.ok).toBe(false);
  });

  it('refuses to destroy a standing crop unless confirmed', () => {
    // The rail the whole tap convention exists to protect. Enforcing it in the
    // action rather than the component means an AI cannot bulldoze its own
    // harvest either.
    const match = newMatch();
    const target = firstFallow(match);

    const sown = setFieldUse(match, HOLLOWMERE, target.id, 'grain');
    expect(sown.ok).toBe(true);
    if (!sown.ok) return;

    // Advance the crop to maturity.
    const grown: MatchState = {
      ...sown.match,
      counties: {
        ...sown.match.counties,
        [HOLLOWMERE]: {
          ...sown.match.counties[HOLLOWMERE]!,
          interior: {
            ...sown.match.counties[HOLLOWMERE]!.interior!,
            fields: sown.match.counties[HOLLOWMERE]!.interior!.fields.map((f) =>
              f.id === target.id ? { ...f, seasonsGrown: 2 } : f,
            ),
          },
        },
      },
    };

    const unconfirmed = setFieldUse(grown, HOLLOWMERE, target.id, 'cattle');
    expect(unconfirmed.ok).toBe(false);
    if (!unconfirmed.ok) expect(unconfirmed.reason).toMatch(/crop/i);

    const confirmed = setFieldUse(grown, HOLLOWMERE, target.id, 'cattle', { confirmed: true });
    expect(confirmed.ok).toBe(true);
  });

  it('does not require confirmation for a field with nothing growing', () => {
    const match = newMatch();
    const result = setFieldUse(match, HOLLOWMERE, firstFallow(match).id, 'cattle');
    expect(result.ok).toBe(true);
  });

  it('clears the crop clock and herd when use changes', () => {
    // Otherwise a player could launder a mature crop between field types.
    const match = newMatch();
    const target = firstFallow(match);
    const toCattle = setFieldUse(match, HOLLOWMERE, target.id, 'cattle');
    expect(toCattle.ok).toBe(true);
    if (!toCattle.ok) return;

    const field = toCattle.match.counties[HOLLOWMERE]!.interior!.fields.find(
      (f) => f.id === target.id,
    )!;
    expect(field.seasonsGrown).toBe(0);
    expect(field.herd).toBe(1);
  });

  it('toggles an industry site the county actually has', () => {
    const match = newMatch();
    const on = toggleIndustry(match, HOLLOWMERE, 'blacksmith');
    expect(on.ok).toBe(true);
    if (!on.ok) return;
    expect(
      on.match.counties[HOLLOWMERE]!.interior!.industry.find((s) => s.kind === 'blacksmith')!
        .active,
    ).toBe(true);
  });

  it('refuses to toggle a site the county does not have', () => {
    // Hollowmere farms wheat, so it has no quarry.
    const result = toggleIndustry(newMatch(), HOLLOWMERE, 'quarry');
    expect(result.ok).toBe(false);
  });

  it('clamps the labour split rather than rejecting it', () => {
    const match = newMatch();
    for (const [input, expected] of [
      [1.7, 1],
      [-3, 0],
      [0.42, 0.42],
    ] as const) {
      const result = setLabourSplit(match, HOLLOWMERE, input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.match.counties[HOLLOWMERE]!.agricultureShare).toBe(expected);
      }
    }
    expect(setLabourSplit(match, HOLLOWMERE, NaN).ok).toBe(false);
  });

  it('will not move a herd into an overcrowded pasture', () => {
    const match = newMatch();
    const [a, b] = fieldsOf(match).filter((f) => f.status === 'fallow');

    let m = match;
    for (const f of [a!, b!]) {
      const r = setFieldUse(m, HOLLOWMERE, f.id, 'cattle');
      expect(r.ok).toBe(true);
      if (r.ok) m = r.match;
    }

    const packed: MatchState = {
      ...m,
      counties: {
        ...m.counties,
        [HOLLOWMERE]: {
          ...m.counties[HOLLOWMERE]!,
          interior: {
            ...m.counties[HOLLOWMERE]!.interior!,
            fields: m.counties[HOLLOWMERE]!.interior!.fields.map((f) =>
              f.id === b!.id ? { ...f, herd: MAX_HERD_PER_FIELD } : f,
            ),
          },
        },
      },
    };

    expect(moveHerd(packed, HOLLOWMERE, a!.id, b!.id).ok).toBe(false);
    expect(moveHerd(packed, HOLLOWMERE, b!.id, a!.id).ok).toBe(true);
  });

  it('reports a reason on every refusal', () => {
    // The UI surfaces these directly, so a blank reason is a dead end.
    const match = newMatch();
    const refusals = [
      setFieldUse(match, HOLLOWMERE, 'nope', 'grain'),
      toggleIndustry(match, HOLLOWMERE, 'quarry'),
      moveHerd(match, HOLLOWMERE, 'nope', 'also-nope'),
    ];
    for (const r of refusals) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});
