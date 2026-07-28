import { describe, expect, it } from 'vitest';
import { ALDERMARCH } from '../../content/maps/aldermarch.generated';
import { createSoloMatch } from '../match/createMatch';
import { countyId, factionId } from '../ids';
import { createRng } from '../rng';
import { advanceSeason, REVOLT_AFTER_SEASONS } from './advanceTurn';
import { setFieldUse } from '../county/actions';
import { projectProduction } from '../county/labour';
import { seasonOfTurn, describeTurn } from '../season';
import type { MatchState } from '../match/matchState';

const HOLLOWMERE = countyId('hollowmere');

const newMatch = (): MatchState =>
  createSoloMatch({
    map: ALDERMARCH,
    playerName: 'You',
    factionId: factionId('warden'),
    opponents: [{ name: 'Rival', factionId: factionId('knight') }],
    now: 0,
    rng: createRng(1234).next,
  });

const county = (m: MatchState) => m.counties[HOLLOWMERE]!;

/** Sow every fallow field, so there is a crop to follow through the cycle. */
function sowEverything(m: MatchState): MatchState {
  let out = m;
  for (const f of county(m).interior!.fields.filter((x) => x.status === 'fallow')) {
    const r = setFieldUse(out, HOLLOWMERE, f.id, 'grain');
    if (r.ok) out = r.match;
  }
  return out;
}

describe('season resolution', () => {
  it('mutates nothing', () => {
    const match = newMatch();
    const before = JSON.stringify(match);
    advanceSeason(match);
    expect(JSON.stringify(match)).toBe(before);
  });

  it('advances the turn, and the season with it', () => {
    const match = newMatch();
    expect(describeTurn(match.turn.number)).toBe('Spring 1268');

    const after = advanceSeason(match).match;
    expect(after.turn.number).toBe(2);
    expect(seasonOfTurn(after.turn.number)).toBe('summer');
  });

  it('rolls the year over after four seasons', () => {
    let m = newMatch();
    for (let i = 0; i < 4; i++) m = advanceSeason(m).match;
    expect(describeTurn(m.turn.number)).toBe('Spring 1269');
  });

  it('delivers exactly what the labour panel promised', () => {
    // The rule the whole file exists for. The slider shows a net figure; the
    // season must produce that figure. A separate resolution path would let the
    // promise and the delivery drift, and the readout is the one piece of
    // feedback the economy runs on.
    let m = sowEverything(newMatch());
    // Grow to maturity so there is a harvest rather than zeros.
    m = advanceSeason(m).match;
    m = advanceSeason(m).match;

    const before = county(m);
    const promised = projectProduction({
      interior: before.interior!,
      population: before.population,
      split: { agricultureShare: before.agricultureShare },
      season: seasonOfTurn(m.turn.number),
      foodYieldBonus: 1,
    });
    const promisedWheat = promised.lines.find((l) => l.key === 'wheat')?.net ?? 0;

    const after = county(advanceSeason(m).match);
    const expected = Math.round(Math.max(0, before.food.wheat + promisedWheat));
    expect(after.food.wheat).toBe(expected);
  });

  it('grows a crop through sown, growing, then mature', () => {
    let m = sowEverything(newMatch());
    const id = county(m).interior!.fields.find((f) => f.status === 'grain')!.id;
    const stageOf = (s: MatchState) =>
      s.counties[HOLLOWMERE]!.interior!.fields.find((f) => f.id === id)!.seasonsGrown;

    expect(stageOf(m)).toBe(0);
    m = advanceSeason(m).match;
    expect(stageOf(m)).toBe(1);
    m = advanceSeason(m).match;
    expect(stageOf(m)).toBe(2);
  });

  it('reports a crop left standing too long as spoiled', () => {
    let m = sowEverything(newMatch());
    let sawSpoiled = false;
    for (let i = 0; i < 4; i++) {
      const r = advanceSeason(m);
      m = r.match;
      if (r.events.some((e) => e.kind === 'spoiled')) sawSpoiled = true;
    }
    expect(sawSpoiled).toBe(true);
  });

  it('feeds the county from stores in winter', () => {
    // Winter yields nothing from the fields, so the stores must carry it —
    // that scarcity is what gives food shipping its purpose.
    let m = sowEverything(newMatch());
    while (seasonOfTurn(m.turn.number) !== 'winter') m = advanceSeason(m).match;

    const before = county(m).food.wheat;
    const after = county(advanceSeason(m).match).food.wheat;
    expect(after).toBeLessThan(before);
  });

  it('never drives a store negative', () => {
    let m = newMatch();
    for (let i = 0; i < 12; i++) m = advanceSeason(m).match;
    for (const c of Object.values(m.counties)) {
      expect(c.food.wheat).toBeGreaterThanOrEqual(0);
      expect(c.food.cows).toBeGreaterThanOrEqual(0);
    }
    for (const t of Object.values(m.treasuries)) {
      for (const amount of Object.values(t)) expect(amount).toBeGreaterThanOrEqual(0);
    }
  });

  it('reclaims barren land gradually, not instantly', () => {
    let m = newMatch();
    const barren = county(m).interior!.fields.find((f) => f.status === 'barren');
    expect(barren, 'expected barren land in the generated interior').toBeDefined();

    const progress = () =>
      county(m).interior!.fields.find((f) => f.id === barren!.id)!.reclaimed;

    m = advanceSeason(m).match;
    expect(progress()).toBeGreaterThan(0);
    expect(progress()).toBeLessThan(1);

    for (let i = 0; i < 4; i++) m = advanceSeason(m).match;
    expect(progress()).toBe(1);
  });

  it('completes a castle only after its build time', () => {
    const base = newMatch();
    const m: MatchState = {
      ...base,
      counties: {
        ...base.counties,
        [HOLLOWMERE]: {
          ...county(base),
          building: { tier: 'normanKeep', seasonsLeft: 2 },
        },
      },
    };

    const after1 = advanceSeason(m);
    expect(after1.match.counties[HOLLOWMERE]!.castleTier).toBe('motteAndBailey');
    expect(after1.match.counties[HOLLOWMERE]!.building?.seasonsLeft).toBe(1);

    const after2 = advanceSeason(after1.match);
    expect(after2.match.counties[HOLLOWMERE]!.castleTier).toBe('normanKeep');
    expect(after2.match.counties[HOLLOWMERE]!.building).toBeNull();
    expect(after2.events.some((e) => e.kind === 'castleBuilt')).toBe(true);
  });

  it('settles storm damage to barren after one season', () => {
    const base = newMatch();
    const target = county(base).interior!.fields[0]!;
    const m: MatchState = {
      ...base,
      counties: {
        ...base.counties,
        [HOLLOWMERE]: {
          ...county(base),
          interior: {
            ...county(base).interior!,
            fields: county(base).interior!.fields.map((f) =>
              f.id === target.id ? { ...f, status: 'flooded' as const } : f,
            ),
          },
        },
      },
    };

    const after = advanceSeason(m).match;
    expect(
      after.counties[HOLLOWMERE]!.interior!.fields.find((f) => f.id === target.id)!.status,
    ).toBe('barren');
  });

  it('revolts only after sustained misery, not one bad season', () => {
    const base = newMatch();
    const miserable: MatchState = {
      ...base,
      counties: {
        ...base.counties,
        [HOLLOWMERE]: { ...county(base), happiness: 5, food: { wheat: 0, cows: 0 } },
      },
    };

    const first = advanceSeason(miserable);
    expect(first.events.some((e) => e.kind === 'revolt')).toBe(false);

    let m = first.match;
    let revolted = false;
    for (let i = 0; i < REVOLT_AFTER_SEASONS + 1; i++) {
      const r = advanceSeason(m);
      m = r.match;
      if (r.events.some((e) => e.kind === 'revolt')) revolted = true;
    }
    expect(revolted).toBe(true);
  });

  it('leaves unclaimed counties alone', () => {
    // Nobody allocates a neutral county's labour or ships it food, so resolving
    // one starves it to death and floods the player's season report with
    // events about land they do not own.
    let m = newMatch();
    const neutral = countyId('greyfen');
    expect(m.counties[neutral]!.owner).toBeNull();
    const before = JSON.stringify(m.counties[neutral]);

    for (let i = 0; i < 8; i++) m = advanceSeason(m).match;

    expect(JSON.stringify(m.counties[neutral])).toBe(before);
  });

  it('reports only on counties someone holds', () => {
    let m = newMatch();
    const owned = new Set(
      Object.entries(m.counties)
        .filter(([, c]) => c.owner)
        .map(([id]) => id),
    );
    for (let i = 0; i < 4; i++) {
      const r = advanceSeason(m);
      m = r.match;
      for (const e of r.events) expect(owned.has(e.county)).toBe(true);
    }
  });

  it('keeps happiness and rations inside their ranges', () => {
    let m = newMatch();
    for (let i = 0; i < 16; i++) {
      m = advanceSeason(m).match;
      for (const c of Object.values(m.counties)) {
        expect(c.happiness).toBeGreaterThanOrEqual(0);
        expect(c.happiness).toBeLessThanOrEqual(100);
        expect(c.rationLevel).toBeGreaterThanOrEqual(0);
        expect(c.rationLevel).toBeLessThanOrEqual(2);
        expect(c.population).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('pools quarried stone into the owner treasury, not the county', () => {
    // Materials pool empire-wide; food stays in the county that grew it. Give
    // an OWNED county a working quarry — Hollowmere farms wheat, so it has only
    // a blacksmith by default, and a blacksmith forges weapons rather than
    // materials.
    const base = newMatch();
    const withQuarry: MatchState = {
      ...base,
      counties: {
        ...base.counties,
        [HOLLOWMERE]: {
          ...county(base),
          agricultureShare: 0, // put the whole workforce on industry
          interior: {
            ...county(base).interior!,
            industry: [
              {
                kind: 'quarry' as const,
                col: 0,
                row: 0,
                active: true,
                workers: 0,
                weapon: null,
              },
            ],
          },
        },
      },
    };

    const owner = county(base).owner!;
    const stoneBefore = base.treasuries[owner]!.stone;
    const result = advanceSeason(withQuarry);

    expect(result.match.treasuries[owner]!.stone).toBeGreaterThan(stoneBefore);
    // The other player's pool must be untouched — "empire-wide" means one
    // player's empire, not everyone's.
    const other = base.players.find((p) => p.id !== owner)!.id;
    expect(result.match.treasuries[other]).toEqual(base.treasuries[other]);
  });
});
