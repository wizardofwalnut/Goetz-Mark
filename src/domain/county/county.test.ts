import { describe, expect, it } from 'vitest';
import {
  GRAIN_STAGE_YIELD,
  SEASONS,
  SEASON_FARM_MODIFIER,
  describeTurn,
  grainStage,
  seasonOfTurn,
  yearOfTurn,
} from '../season';
import {
  MAX_HERD_PER_FIELD,
  allowedTransitions,
  createInterior,
  destroysCrop,
  fieldYieldShare,
  type FieldTile,
} from './interior';
import { healthFromRations, projectProduction } from './labour';
import { createRng } from '../rng';
import { CASTLES, upgradeCost } from '../../content/castles';
import { CASTLE_TIERS, castleRank, isStrongerCastle } from '../match/matchState';

const field = (over: Partial<FieldTile> = {}): FieldTile => ({
  id: 'f',
  col: 0,
  row: 0,
  status: 'fallow',
  seasonsGrown: 0,
  herd: 0,
  reclaimed: 0,
  ...over,
});

describe('seasons', () => {
  it('makes turn 1 spring of the opening year', () => {
    expect(seasonOfTurn(1)).toBe('spring');
    expect(describeTurn(1)).toBe('Spring 1268');
  });

  it('cycles through four seasons and rolls the year over', () => {
    expect(SEASONS.map((_, i) => seasonOfTurn(i + 1))).toEqual([
      'spring',
      'summer',
      'autumn',
      'winter',
    ]);
    expect(seasonOfTurn(5)).toBe('spring');
    expect(yearOfTurn(4)).toBe(1268);
    expect(yearOfTurn(5)).toBe(1269);
  });

  it('derives season and year rather than storing them', () => {
    // Guards the reason they are not fields on TurnState: three values that can
    // disagree eventually will, and in an async game they disagree on someone
    // else's device.
    for (let turn = 1; turn <= 40; turn++) {
      const expectedYear = 1268 + Math.floor((turn - 1) / 4);
      expect(yearOfTurn(turn), `turn ${turn}`).toBe(expectedYear);
    }
  });

  it('produces nothing from the fields in winter', () => {
    // Winter scarcity is what forces the food-shipping decision the design doc
    // keeps as its one real logistics choice.
    expect(SEASON_FARM_MODIFIER.winter).toBe(0);
    expect(SEASON_FARM_MODIFIER.autumn).toBeGreaterThan(SEASON_FARM_MODIFIER.summer);
  });
});

describe('grain cycle', () => {
  it('runs sown to mature over three seasons, then spoils', () => {
    expect(grainStage(0)).toBe('sown');
    expect(grainStage(1)).toBe('growing');
    expect(grainStage(2)).toBe('mature');
    expect(grainStage(3)).toBe('spoiled');
  });

  it('yields nothing when newly sown and most when mature', () => {
    expect(GRAIN_STAGE_YIELD.sown).toBe(0);
    expect(GRAIN_STAGE_YIELD.mature).toBeGreaterThan(GRAIN_STAGE_YIELD.growing);
    expect(GRAIN_STAGE_YIELD.spoiled).toBeLessThan(GRAIN_STAGE_YIELD.mature);
  });

  it('treats a standing mature crop as destroyable, a spoiled one as not', () => {
    // This drives the confirm prompt. Warning about a crop that is already
    // ruined trains players to dismiss the warning that matters.
    expect(destroysCrop(field({ status: 'grain', seasonsGrown: 2 }))).toBe(true);
    expect(destroysCrop(field({ status: 'grain', seasonsGrown: 3 }))).toBe(false);
    expect(destroysCrop(field({ status: 'fallow' }))).toBe(false);
  });
});

describe('fields', () => {
  it('suppresses yield in an overcrowded cattle field', () => {
    const roomy = fieldYieldShare(field({ status: 'cattle', herd: 1 }));
    const packed = fieldYieldShare(field({ status: 'cattle', herd: MAX_HERD_PER_FIELD }));
    expect(packed).toBeLessThan(roomy);
  });

  it('will not let barren land be replanted until it is reclaimed', () => {
    expect(allowedTransitions(field({ status: 'barren', reclaimed: 0.5 }))).toEqual([]);
    expect(allowedTransitions(field({ status: 'barren', reclaimed: 1 }))).toEqual(['fallow']);
  });

  it('locks storm-damaged fields entirely', () => {
    expect(allowedTransitions(field({ status: 'flooded' }))).toEqual([]);
    expect(allowedTransitions(field({ status: 'parched' }))).toEqual([]);
  });

  it('never offers a field its current use as a change', () => {
    expect(allowedTransitions(field({ status: 'grain' }))).not.toContain('grain');
  });
});

describe('interior generation', () => {
  it('is deterministic for a given seed', () => {
    const build = () => createInterior({ size: 4, resource: 'stone', rng: createRng(99).next });
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it('gives bigger counties more land', () => {
    const small = createInterior({ size: 1, resource: 'wheat', rng: createRng(1).next });
    const big = createInterior({ size: 5, resource: 'wheat', rng: createRng(1).next });
    expect(big.fields.length).toBeGreaterThan(small.fields.length);
  });

  it('leaves the town tile clear of fields', () => {
    const interior = createInterior({ size: 4, resource: 'wheat', rng: createRng(3).next });
    const onTown = interior.fields.some(
      (f) => f.col === interior.town.col && f.row === interior.town.row,
    );
    expect(onTown).toBe(false);
  });

  it('places an extraction site only where the county has that resource', () => {
    const farm = createInterior({ size: 3, resource: 'wheat', rng: createRng(5).next });
    const quarry = createInterior({ size: 3, resource: 'stone', rng: createRng(5).next });

    expect(farm.industry.map((i) => i.kind)).toEqual(['blacksmith']);
    expect(quarry.industry.map((i) => i.kind).sort()).toEqual(['blacksmith', 'quarry']);
  });

  it('starts every site inactive', () => {
    // Nothing produces until the player switches it on — otherwise the labour
    // slider appears to do nothing on turn one.
    const interior = createInterior({ size: 4, resource: 'ore', rng: createRng(7).next });
    expect(interior.industry.every((i) => !i.active)).toBe(true);
  });

  it('seeds some barren land so reclamation is met early', () => {
    const interior = createInterior({ size: 5, resource: 'wheat', rng: createRng(11).next });
    expect(interior.fields.some((f) => f.status === 'barren')).toBe(true);
  });
});

describe('labour projection', () => {
  const interior = createInterior({ size: 4, resource: 'stone', rng: createRng(2).next });

  const withFields = (statuses: Parameters<typeof field>[0]['status'][]) => ({
    ...interior,
    fields: statuses.map((status, i) =>
      field({ id: `f${i}`, status, seasonsGrown: status === 'grain' ? 2 : 0, herd: status === 'cattle' ? 1 : 0 }),
    ),
  });

  it('reports only what the county actually produces', () => {
    // The readout is variable length, keyed to active tasks — a fixed 3-slot
    // layout would be wrong for most counties.
    const p = projectProduction({
      interior: withFields(['grain', 'grain']),
      population: 200,
      split: { agricultureShare: 1 },
      season: 'autumn',
    });
    expect(p.lines.map((l) => l.key)).toEqual(['wheat']);
  });

  it('counts everyone as eating, harvest or not', () => {
    const p = projectProduction({
      interior: withFields(['fallow']),
      population: 200,
      split: { agricultureShare: 1 },
      season: 'winter',
    });
    const grain = p.lines.find((l) => l.key === 'wheat');
    expect(grain?.net).toBeLessThan(0);
    expect(grain?.produced).toBe(0);
  });

  it('produces no food from fields in winter', () => {
    const autumn = projectProduction({
      interior: withFields(['grain', 'grain']),
      population: 200,
      split: { agricultureShare: 1 },
      season: 'autumn',
    });
    const winter = projectProduction({
      interior: withFields(['grain', 'grain']),
      population: 200,
      split: { agricultureShare: 1 },
      season: 'winter',
    });
    expect(autumn.lines.find((l) => l.key === 'wheat')!.produced).toBeGreaterThan(0);
    expect(winter.lines.find((l) => l.key === 'wheat')!.produced).toBe(0);
  });

  it('yields nothing from a crop that is still growing', () => {
    const growing = {
      ...interior,
      fields: [field({ status: 'grain', seasonsGrown: 1 })],
    };
    const p = projectProduction({
      interior: growing,
      population: 100,
      split: { agricultureShare: 1 },
      season: 'summer',
    });
    expect(p.lines.find((l) => l.key === 'wheat')?.produced ?? 0).toBe(0);
  });

  it('reports workers as idle when their side has nothing running', () => {
    // The difference between "my slider is wrong" and "I have not switched the
    // quarry on yet" — the player must be able to tell which.
    const p = projectProduction({
      interior: { ...withFields(['fallow']), industry: [] },
      population: 200,
      split: { agricultureShare: 0 },
      season: 'summer',
    });
    expect(p.industryWorkers).toBe(200);
    expect(p.idleWorkers).toBe(200);
  });

  it('sends no labour to an inactive site', () => {
    const idle = { ...withFields(['grain']), industry: interior.industry };
    const p = projectProduction({
      interior: idle,
      population: 200,
      split: { agricultureShare: 0 },
      season: 'summer',
    });
    expect(p.lines.some((l) => l.key === 'stone')).toBe(false);
  });

  it('produces stone once the quarry is switched on', () => {
    const active = {
      ...withFields(['grain']),
      industry: interior.industry.map((s) =>
        s.kind === 'quarry' ? { ...s, active: true } : s,
      ),
    };
    const p = projectProduction({
      interior: active,
      population: 200,
      split: { agricultureShare: 0 },
      season: 'summer',
    });
    expect(p.lines.find((l) => l.key === 'stone')!.net).toBeGreaterThan(0);
  });

  it('is pure — safe to call on every slider frame', () => {
    const before = JSON.stringify(interior);
    for (let i = 0; i <= 10; i++) {
      projectProduction({
        interior,
        population: 200,
        split: { agricultureShare: i / 10 },
        season: 'summer',
      });
    }
    expect(JSON.stringify(interior)).toBe(before);
  });

  it('moves workers between sides as the split changes', () => {
    const all = projectProduction({
      interior,
      population: 100,
      split: { agricultureShare: 1 },
      season: 'summer',
    });
    const none = projectProduction({
      interior,
      population: 100,
      split: { agricultureShare: 0 },
      season: 'summer',
    });
    expect(all.farmWorkers).toBe(100);
    expect(none.farmWorkers).toBe(0);
    expect(none.industryWorkers).toBe(100);
  });
});

describe('health', () => {
  it('does not condemn a county for one bad season', () => {
    expect(healthFromRations(0.2, 1)).not.toBe('diseased');
    expect(healthFromRations(0.2, 8)).toBe('diseased');
  });

  it('improves with sustained generous rations', () => {
    expect(healthFromRations(1.8, 8)).toBe('perfect');
  });

  it('reports a named state rather than a number', () => {
    expect(['diseased', 'sick', 'average', 'good', 'perfect']).toContain(
      healthFromRations(1, 4),
    );
  });
});

describe('castles', () => {
  it('has a spec for every tier', () => {
    for (const tier of CASTLE_TIERS) {
      expect(CASTLES[tier], tier).toBeDefined();
    }
  });

  it('keeps the ladder in strength order', () => {
    // Comparisons use the array index, so a tier inserted out of order would
    // silently make a weaker castle rank higher than a stronger one.
    const ranks = CASTLE_TIERS.map((t) => CASTLES[t].defence);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(isStrongerCastle('royalCastle', 'woodenPalisade')).toBe(true);
    expect(isStrongerCastle('woodenPalisade', 'motteAndBailey')).toBe(false);
    expect(castleRank('none')).toBe(0);
  });

  it('charges only the difference when upgrading', () => {
    // Otherwise building up in steps would cost more than saving for the top
    // tier, making the early tiers a trap for anyone who intends to grow.
    const direct = CASTLES.normanKeep.cost.stone ?? 0;
    const stepped =
      (upgradeCost('none', 'motteAndBailey').stone ?? 0) +
      (upgradeCost('motteAndBailey', 'normanKeep').stone ?? 0);
    expect(stepped).toBe(direct);
  });

  it('costs more for each step up the ladder', () => {
    const stoneCosts = CASTLE_TIERS.map((t) => CASTLES[t].cost.stone ?? 0);
    expect([...stoneCosts].sort((a, b) => a - b)).toEqual(stoneCosts);
  });
});
