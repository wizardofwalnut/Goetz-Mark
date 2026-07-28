import { describe, expect, it } from 'vitest';
import { E, N, S, W, STRIDE_Y, TILE_W, gridSize, roadMasks } from './overheadCamera';
import { createInterior } from '../../domain/county/interior';
import { createRng } from '../../domain/rng';

describe('overhead camera', () => {
  it('foreshortens rows — a square tile is not square from above', () => {
    // The whole point of the v2 camera correction. If the stride ever equals
    // the tile width the projection has silently become a flat paper map, and
    // if it drops to half the width it has become the ground-level isometric
    // tilt the spec rules out.
    expect(STRIDE_Y).toBeLessThan(TILE_W);
    expect(STRIDE_Y / TILE_W).toBeGreaterThan(0.6);
  });

  it('leaves room for the last row to show its depth band', () => {
    // Sizing the grid by stride alone crops the relief off the bottom row,
    // which is exactly the flattening the camera exists to avoid.
    const { height } = gridSize(5, 5);
    expect(height).toBeGreaterThan(4 * STRIDE_Y + STRIDE_Y);
  });
});

describe('road autotiling', () => {
  const straight = [
    { col: 1, row: 0 },
    { col: 1, row: 1 },
    { col: 1, row: 2 },
  ];

  it('joins a run end to end', () => {
    const masks = roadMasks(straight, { cols: 3, rows: 3 });
    expect(masks['1,1']).toBe(N | S);
  });

  it('ends a road that stops inside the county as a dead end', () => {
    const masks = roadMasks(straight, { cols: 3, rows: 3 });
    // Nothing continues past row 2, so the last piece must not pretend a road
    // carries on into open ground.
    expect(masks['1,2']).toBe(N);
  });

  it('carries a road that leaves the county across its edge', () => {
    // The out-of-bounds sentinel is the whole mechanism: it is what tells a
    // boundary cell that the road continues, which position alone cannot.
    const leaving = [...straight, { col: 1, row: 3 }];
    const masks = roadMasks(leaving, { cols: 3, rows: 3 });
    expect(masks['1,2']).toBe(N | S);
  });

  it('never emits a piece for a cell outside the grid', () => {
    const leaving = [...straight, { col: 1, row: 3 }];
    const masks = roadMasks(leaving, { cols: 3, rows: 3 });
    expect(masks['1,3']).toBeUndefined();
  });

  it('makes a crossroads where four ways meet', () => {
    const cross = [
      { col: 1, row: 1 },
      { col: 0, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 0 },
      { col: 1, row: 2 },
    ];
    expect(roadMasks(cross, { cols: 3, rows: 3 })['1,1']).toBe(N | E | S | W);
  });
});

describe('county roads', () => {
  const build = (exits: readonly ('n' | 'e' | 's' | 'w')[]) =>
    createInterior({
      size: 4,
      resource: 'wheat',
      rng: createRng(4).next,
      exits,
      grid: { cols: 5, rows: 13 },
    });

  it('reaches every edge it has a neighbour behind', () => {
    const interior = build(['e', 's']);
    const masks = roadMasks(interior.road, interior);
    // A road that leaves eastward must show an east-going piece in the last
    // column, not a stub one cell short of the border.
    const lastCol = interior.road.filter((c) => c.col === interior.cols - 1);
    expect(lastCol.length).toBeGreaterThan(0);
    for (const cell of lastCol) expect(masks[`${cell.col},${cell.row}`]! & E).toBe(E);
  });

  it('lays no road at all for a county with no neighbours', () => {
    // Not a crash and not a road to nowhere: a county with nothing beside it
    // still has a town, it just has nothing to connect to.
    expect(build([]).road).toEqual([{ col: 2, row: 6 }]);
  });

  it('keeps the road clear of fields and impassable ground', () => {
    const interior = build(['n', 'e', 's', 'w']);
    const onRoad = new Set(interior.road.map((c) => `${c.col},${c.row}`));
    for (const field of interior.fields) {
      expect(onRoad.has(`${field.col},${field.row}`), field.id).toBe(false);
    }
    for (const cell of interior.ground) {
      if (!onRoad.has(`${cell.col},${cell.row}`)) continue;
      expect(cell.kind, `${cell.col},${cell.row}`).toBe('ground');
    }
  });

  it('stands the castle apart from the town, off the road and off the rim', () => {
    const interior = build(['e', 's']);
    const { castle, town } = interior;
    expect(castle).not.toEqual(town);
    expect(castle.col).toBeGreaterThan(0);
    expect(castle.col).toBeLessThan(interior.cols - 1);
    expect(castle.row).toBeGreaterThan(0);
    expect(castle.row).toBeLessThan(interior.rows - 1);

    const onRoad = interior.road.some((c) => c.col === castle.col && c.row === castle.row);
    expect(onRoad).toBe(false);
    const onField = interior.fields.some((f) => f.col === castle.col && f.row === castle.row);
    expect(onField).toBe(false);
  });

  it('gives a county its hard-mineral site and no other', () => {
    // Stone OR ore, never both. The exclusivity has to hold in the generated
    // interior, not merely in whichever site the UI happens to draw.
    const ore = createInterior({
      size: 4,
      resource: 'wheat',
      mineral: 'ore',
      rng: createRng(9).next,
    });
    const kinds = ore.industry.map((s) => s.kind);
    expect(kinds).toContain('mine');
    expect(kinds).not.toContain('quarry');
  });
});
