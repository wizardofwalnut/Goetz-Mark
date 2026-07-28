import { describe, expect, it } from 'vitest';
import { E, N, S, W, STRIDE_Y, TILE_W, gridSize, roadMasks } from './overheadCamera';
import { createInterior, stageOf, type FieldTile } from '../../domain/county/interior';
import { overheadFieldArt } from '../../assets/assetManifest';
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

  it('lays no road OUT of a county with no neighbours, but still one to its keep', () => {
    // Nothing beside it means nothing to connect to, so no road reaches an
    // edge. The town-to-castle spur is internal and exists regardless — the
    // keep has to be reachable whether or not the county has neighbours.
    const interior = build([]);
    const onEdge = interior.road.filter(
      (c) =>
        c.col <= 0 || c.row <= 0 || c.col >= interior.cols - 1 || c.row >= interior.rows - 1,
    );
    expect(onEdge).toEqual([]);
    expect(interior.road).toContainEqual({ col: interior.castle.col, row: interior.castle.row });
    expect(interior.road).toContainEqual({ col: interior.town.col, row: interior.town.row });
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

  it('stands the castle apart from the town and off the rim', () => {
    const interior = build(['e', 's']);
    const { castle, town } = interior;
    expect(castle).not.toEqual(town);
    expect(castle.col).toBeGreaterThan(0);
    expect(castle.col).toBeLessThan(interior.cols - 1);
    expect(castle.row).toBeGreaterThan(0);
    expect(castle.row).toBeLessThan(interior.rows - 1);

    const onField = interior.fields.some((f) => f.col === castle.col && f.row === castle.row);
    expect(onField).toBe(false);
  });

  it('always puts a road to the castle gate', () => {
    // A keep a road cannot reach is a keep nothing can relieve, resupply or
    // besiege by the movement rules the rest of the map obeys.
    for (const exits of [['e', 's'], ['n'], ['n', 'e', 's', 'w'], []] as const) {
      const interior = build(exits);
      const onRoad = interior.road.some(
        (c) => c.col === interior.castle.col && c.row === interior.castle.row,
      );
      expect(onRoad, `exits=[${exits.join(',')}]`).toBe(true);
    }
  });

  it('keeps the castle road joined to the network, not a stranded stub', () => {
    // The spur has to actually connect: a road AT the gate that touches nothing
    // else would satisfy the test above while leading nowhere.
    const interior = build(['e', 's']);
    const road = new Set(interior.road.map((c) => `${c.col},${c.row}`));
    const { castle } = interior;
    const neighbours = [
      `${castle.col},${castle.row - 1}`,
      `${castle.col + 1},${castle.row}`,
      `${castle.col},${castle.row + 1}`,
      `${castle.col - 1},${castle.row}`,
    ].filter((k) => road.has(k));
    expect(neighbours.length).toBeGreaterThan(0);
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


describe('field art follows field state', () => {
  const field = (over: Partial<FieldTile>): FieldTile => ({
    id: 'f',
    col: 0,
    row: 0,
    status: 'fallow',
    seasonsGrown: 0,
    herd: 0,
    reclaimed: 0,
    ...over,
  });

  const keyFor = (f: FieldTile) => overheadFieldArt(f.status, stageOf(f)).key;

  it('draws every field state differently', () => {
    // A regression guard, not a hypothetical. An earlier pass drew fields from
    // a corner mask alone and silently dropped status entirely, so fallow,
    // barren, cattle and all four grain stages rendered identically. The
    // checkpoint hid it because every field starts fallow.
    const keys = [
      keyFor(field({ status: 'fallow' })),
      keyFor(field({ status: 'barren' })),
      keyFor(field({ status: 'cattle', herd: 2 })),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('walks grain through the season cycle', () => {
    // Grain visibly changing as it grows is a mechanic, not decoration: the
    // player reads when to harvest off the field itself.
    const stages = [0, 1, 2, 3, 4, 5].map((seasonsGrown) =>
      keyFor(field({ status: 'grain', seasonsGrown })),
    );
    expect(new Set(stages).size).toBeGreaterThan(1);
  });
});

describe('the keep sits off the highway, not off the square', () => {
  const build = (exits: readonly ('n' | 'e' | 's' | 'w')[]) =>
    createInterior({
      size: 4,
      resource: 'wheat',
      rng: createRng(4).next,
      exits,
      grid: { cols: 7, rows: 19 },
    });

  it('sets the castle back from the town rather than beside it', () => {
    // It previously sat one cell away, which made its spur look like it left
    // from the market square even though the path never crossed the town.
    for (const exits of [['e', 's'], ['n'], ['w']] as const) {
      const { castle, town } = build(exits);
      const gap = Math.abs(castle.col - town.col) + Math.abs(castle.row - town.row);
      expect(gap, `exits=[${exits.join(',')}]`).toBeGreaterThanOrEqual(4);
    }
  });

  it('joins the road by a short branch, not a long detour', () => {
    // The branch is what makes it read as an offshoot. A long one reads as a
    // second road and puts the traffic back through the middle of the county.
    const interior = build(['e', 's']);
    const road = new Set(interior.road.map((c) => `${c.col},${c.row}`));
    const { castle, town } = interior;

    // Walking from the keep back along the branch must reach the highway
    // within a couple of cells, and must not pass the town on the way.
    let steps = 0;
    let cell = { ...castle };
    while (cell.row !== town.row && steps < 5) {
      cell = { col: cell.col, row: cell.row + Math.sign(town.row - cell.row) };
      expect(road.has(`${cell.col},${cell.row}`)).toBe(true);
      expect(cell.col === town.col && cell.row === town.row).toBe(false);
      steps += 1;
    }
    expect(steps).toBeLessThanOrEqual(3);
  });
});
