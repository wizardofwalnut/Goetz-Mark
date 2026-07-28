import { describe, expect, it } from 'vitest';
import { createInterior } from './interior';
import { createRng } from '../rng';
import {
  OFF_ROAD_COST,
  ON_ROAD_COST,
  canEnter,
  enterCost,
  isRoad,
  stepsFrom,
} from './movement';

const interior = () =>
  createInterior({
    size: 4,
    resource: 'wheat',
    rng: createRng(31).next,
    exits: ['n', 'e', 's', 'w'],
    grid: { cols: 7, rows: 19 },
  });

describe('county movement', () => {
  it('keeps a wagon on the road, always', () => {
    // The merchant constraint, and the reason wheeled is its own travel kind
    // rather than a large movement cost: off the road is not expensive, it is
    // impossible.
    const county = interior();
    const offRoad = county.ground.filter(
      (g) => g.kind === 'ground' && !isRoad(county, g),
    );
    expect(offRoad.length).toBeGreaterThan(0);
    for (const cell of offRoad) {
      expect(canEnter('wheeled', county, cell), `${cell.col},${cell.row}`).toBe(false);
    }
  });

  it('lets a wagon run the length of the road', () => {
    const county = interior();
    for (const cell of county.road) {
      if (cell.col < 0 || cell.row < 0 || cell.col >= county.cols || cell.row >= county.rows) {
        continue;
      }
      expect(canEnter('wheeled', county, cell), `${cell.col},${cell.row}`).toBe(true);
    }
  });

  it('lets a man on foot cross open ground, and charges him for it', () => {
    const county = interior();
    const open = county.ground.find((g) => g.kind === 'ground' && !isRoad(county, g))!;
    expect(canEnter('foot', county, open)).toBe(true);
    expect(enterCost('foot', county, open)).toBe(OFF_ROAD_COST);
  });

  it('makes the road meaningfully faster, not marginally', () => {
    // The spec asks for a felt difference rather than a hidden number, so the
    // gap has to be big enough to change a decision.
    expect(OFF_ROAD_COST / ON_ROAD_COST).toBeGreaterThanOrEqual(3);
  });

  it('stops everyone at forest, mountain and water', () => {
    const county = interior();
    const blocked = county.ground.filter((g) => g.kind !== 'ground' && !isRoad(county, g));
    expect(blocked.length).toBeGreaterThan(0);
    for (const cell of blocked) {
      expect(canEnter('foot', county, cell), `foot ${cell.kind}`).toBe(false);
      expect(canEnter('wheeled', county, cell), `wagon ${cell.kind}`).toBe(false);
    }
  });

  it('carries a road across ground that would otherwise stop you', () => {
    // A road laid through a wood must be passable along its length. Deriving
    // passability from the ground alone would make the road a wall.
    const county = interior();
    const woodedRoad = { col: 0, row: 0 };
    const patched = {
      ...county,
      ground: county.ground.map((g) =>
        g.col === woodedRoad.col && g.row === woodedRoad.row
          ? { ...g, kind: 'forest' as const }
          : g,
      ),
      road: [...county.road, woodedRoad],
    };
    expect(canEnter('foot', patched, woodedRoad)).toBe(true);
    expect(canEnter('wheeled', patched, woodedRoad)).toBe(true);
  });

  it('says "cannot" rather than "expensive" when the way is shut', () => {
    // A caller that reads a huge number instead of null will eventually let a
    // wagon off the road the moment it has points to spare.
    const county = interior();
    const open = county.ground.find((g) => g.kind === 'ground' && !isRoad(county, g))!;
    expect(enterCost('wheeled', county, open)).toBeNull();
  });

  it('offers a wagon only road steps out of a junction', () => {
    const county = interior();
    const steps = stepsFrom('wheeled', county, county.town);
    expect(steps.length).toBeGreaterThan(0);
    for (const at of steps) expect(isRoad(county, at)).toBe(true);
  });

  it('never steps off the edge of the county', () => {
    const county = interior();
    const corner = { col: 0, row: 0 };
    for (const at of stepsFrom('foot', county, corner)) {
      expect(at.col).toBeGreaterThanOrEqual(0);
      expect(at.row).toBeGreaterThanOrEqual(0);
      expect(at.col).toBeLessThan(county.cols);
      expect(at.row).toBeLessThan(county.rows);
    }
  });
});
