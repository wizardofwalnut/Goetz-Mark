import { describe, expect, it } from 'vitest';
import { REALM } from '../../content/maps/realm.generated';
import { createMatch } from '../../domain/match/createMatch';
import { createRng } from '../../domain/rng';
import { factionId } from '../../domain/ids';
import type { CountyId } from '../../domain/ids';
import { E, N, S, W, TILE_W, STRIDE_Y } from './overheadCamera';
import { focusScroll, townOf, worldLayout, worldRoad, worldSize } from './worldCamera';
import { layerSignatures } from './bakeCounty';
import { fitMinimap } from './Minimap';

/**
 * The world is a TILED map, and the tiling is a claim that can be wrong.
 *
 * These tests exist because the seams are where a continuous world can fail
 * invisibly: a road that stops one cell short of a border still looks like a
 * road, and a county laid at the wrong offset still looks like a county. Both
 * only read as broken once you scroll to the join, which is exactly the place a
 * screenshot of one county will never show you.
 */

const GRID = { cols: 7, rows: 19 };

const build = () =>
  createMatch({
    map: REALM,
    rng: createRng(20260728).next,
    interiorGrid: GRID,
    seats: [
      {
        displayName: 'You',
        factionId: factionId('knight'),
        controller: { kind: 'human', userId: null },
      },
      {
        displayName: 'Lady Aubrey',
        factionId: factionId('warden'),
        controller: { kind: 'ai', difficulty: 'steady' },
      },
    ],
  });

describe('the realm is laid out as a grid', () => {
  it('gives every county a plot', () => {
    // The living map tiles by plot. One county without one and the world has a
    // hole in it, so this is checked on the shipped map rather than trusted.
    for (const county of REALM.counties) {
      expect(county.plot, county.name).toBeDefined();
    }
  });

  it('never puts two counties on the same plot', () => {
    const seen = REALM.counties.map((c) => `${c.plot!.col},${c.plot!.row}`);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('agrees with the border list about who touches whom', () => {
    // The two ways of describing the world must not drift. A border between
    // counties that are not adjacent plots would draw a road running out into
    // open ground; adjacent plots with no border would draw two roads meeting
    // at a seam armies are not allowed to cross.
    const plotOf = new Map(REALM.counties.map((c) => [c.id, c.plot!]));
    const step = (a: CountyId, b: CountyId) => {
      const p = plotOf.get(a)!;
      const q = plotOf.get(b)!;
      return Math.abs(p.col - q.col) + Math.abs(p.row - q.row);
    };

    for (const border of REALM.borders) {
      expect(step(border.a, border.b), `${border.a}|${border.b}`).toBe(1);
    }

    const bordered = new Set(
      REALM.borders.map((b) => [b.a, b.b].sort().join('|')),
    );
    for (const a of REALM.counties) {
      for (const b of REALM.counties) {
        if (a.id === b.id) continue;
        if (step(a.id, b.id) !== 1) continue;
        expect(bordered.has([a.id, b.id].sort().join('|')), `${a.id}|${b.id}`).toBe(true);
      }
    }
  });

  it('keeps the two seats off a shared border', () => {
    // v2's whole opening premise: the seats share a CORNER, and a corner is not
    // adjacency, so neither lord can reach the other without first taking
    // neutral ground. If the layout ever drifts to putting them side by side,
    // the map stops being the map the design describes.
    const seats = REALM.starts.map((s) => REALM.counties.find((c) => c.id === s.county)!);
    expect(seats).toHaveLength(2);
    const [a, b] = seats;
    const gap = Math.abs(a!.plot!.col - b!.plot!.col) + Math.abs(a!.plot!.row - b!.plot!.row);
    expect(gap).toBe(2);
  });
});

describe('world layout', () => {
  it('offsets each county by its plot', () => {
    const layout = worldLayout(REALM, build())!;
    expect(layout).not.toBeNull();
    expect(layout.cols).toBe(GRID.cols * 2);
    expect(layout.rows).toBe(GRID.rows * 2);

    for (const plot of layout.plots) {
      expect(plot.origin.col).toBe(plot.county.plot!.col * GRID.cols);
      expect(plot.origin.row).toBe(plot.county.plot!.row * GRID.rows);
    }
  });

  it('refuses to tile interiors of different sizes', () => {
    // A torn world must fail loudly. Rendered quietly it shows as gaps and
    // double-drawn ground along every seam, which reads as an art bug and sends
    // you looking in completely the wrong place.
    const match = build();
    const victim = REALM.counties[1]!.id;
    const state = match.counties[victim]!;
    if (!state.interior) throw new Error('Expected an interior to tear');
    const torn = {
      ...match,
      counties: {
        ...match.counties,
        [victim]: { ...state, interior: { ...state.interior, cols: 5 } },
      },
    };
    expect(() => worldLayout(REALM, torn)).toThrow(/Cannot tile the world/);
  });

  it('falls back to nothing when the map is not a grid', () => {
    // A map pack of irregular shires has no plots. Inventing a layout for it
    // would tile counties that were never meant to tile.
    const shapeless = {
      ...REALM,
      counties: REALM.counties.map(({ plot: _plot, ...rest }) => rest),
    };
    expect(worldLayout(shapeless, build())).toBeNull();
  });
});

describe('roads join across the seams', () => {
  const layout = () => worldLayout(REALM, build())!;

  it('carries every border road across the join from both sides', () => {
    // THE point of computing masks over the world rather than per county.
    // Per county, neither side can see the other's road, so both draw a stub
    // facing the border and the highway visibly stops twice at every seam.
    const world = layout();
    const masks = worldRoad(world);
    const plotOf = new Map(world.plots.map((p) => [p.county.id, p]));

    for (const border of REALM.borders) {
      const a = plotOf.get(border.a)!;
      const b = plotOf.get(border.b)!;
      const horizontal = a.county.plot!.row === b.county.plot!.row;
      const [near, far] = horizontal
        ? a.county.plot!.col < b.county.plot!.col
          ? [a, b]
          : [b, a]
        : a.county.plot!.row < b.county.plot!.row
          ? [a, b]
          : [b, a];

      // The last cell of the near county and the first of the far one.
      const seam = horizontal
        ? { near: near.origin.col + world.countyCols - 1, far: far.origin.col }
        : { near: near.origin.row + world.countyRows - 1, far: far.origin.row };

      const crossings = Object.keys(masks).filter((key) => {
        const [col, row] = key.split(',').map(Number);
        const onNear = horizontal ? col === seam.near : row === seam.near;
        if (!onNear) return false;
        const partner = horizontal ? `${seam.far},${row}` : `${col},${seam.far}`;
        return masks[partner] !== undefined;
      });

      expect(crossings.length, `${border.a}|${border.b}`).toBeGreaterThan(0);

      for (const key of crossings) {
        const [col, row] = key.split(',').map(Number);
        const partner = horizontal ? `${seam.far},${row}` : `${col},${seam.far}`;
        // Each side must point AT the other. A cell whose mask lacks the
        // crossing bit renders as a dead end however many roads touch it.
        expect(masks[key]! & (horizontal ? E : S), `${key} -> ${partner}`).toBeGreaterThan(0);
        expect(masks[partner]! & (horizontal ? W : N), `${partner} -> ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('draws no road piece outside the world', () => {
    // Every county's road carries a sentinel one cell past its own boundary.
    // Inside the world those land on a neighbour and are what makes the join
    // work; at the world's outer edge they must still draw nothing.
    const world = layout();
    for (const key of Object.keys(worldRoad(world))) {
      const [col, row] = key.split(',').map(Number);
      expect(col).toBeGreaterThanOrEqual(0);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(world.cols);
      expect(row).toBeLessThan(world.rows);
    }
  });

  it('puts every town on the road network', () => {
    const world = layout();
    const masks = worldRoad(world);
    for (const plot of world.plots) {
      const town = townOf(plot);
      expect(masks[`${town.col},${town.row}`], plot.county.name).toBeDefined();
    }
  });
});

describe('focusing the camera', () => {
  const viewport = { width: 400, height: 800 };
  const surface = { width: 4000, height: 8000 };

  it('centres the cell in the viewport', () => {
    const { left, top } = focusScroll({ col: 20, row: 20 }, 1, viewport, surface);
    expect(left).toBeCloseTo(20 * TILE_W + TILE_W / 2 - 200);
    expect(top).toBeCloseTo(20 * STRIDE_Y + STRIDE_Y / 2 - 400);
  });

  it('clamps at the near edges rather than scrolling negative', () => {
    // A negative scroll offset is silently ignored by the browser, so getting
    // this wrong looks like the camera simply refusing to move.
    const { left, top } = focusScroll({ col: 0, row: 0 }, 1, viewport, surface);
    expect(left).toBe(0);
    expect(top).toBe(0);
  });

  it('clamps at the far edges rather than scrolling past the world', () => {
    const { left, top } = focusScroll({ col: 999, row: 999 }, 1, viewport, surface);
    expect(left).toBe(surface.width - viewport.width);
    expect(top).toBe(surface.height - viewport.height);
  });

  it('cannot scroll a surface smaller than its window', () => {
    const { left, top } = focusScroll({ col: 3, row: 3 }, 1, viewport, {
      width: 100,
      height: 100,
    });
    expect(left).toBe(0);
    expect(top).toBe(0);
  });

  it('accounts for the scale the surface is drawn at', () => {
    const half = focusScroll({ col: 20, row: 20 }, 0.5, viewport, surface);
    const full = focusScroll({ col: 20, row: 20 }, 1, viewport, surface);
    expect(half.left).toBeLessThan(full.left);
  });

  it('brings every county town on screen, corner counties included', () => {
    // Visibility is the real requirement, and it is not the same as centring:
    // a town less than half a viewport from the world's edge CANNOT be centred,
    // because the scroll clamps. Asserting "centred" would fail on the corner
    // counties for a camera that is behaving correctly, so assert what the
    // player actually needs — that tapping a county shows you its town.
    const world = worldLayout(REALM, build())!;
    const size = worldSize(world);

    for (const plot of world.plots) {
      const town = townOf(plot);
      const { left, top } = focusScroll(town, 1, viewport, size);
      const x = town.col * TILE_W + TILE_W / 2;
      const y = town.row * STRIDE_Y + STRIDE_Y / 2;

      expect(x, plot.county.name).toBeGreaterThanOrEqual(left);
      expect(x, plot.county.name).toBeLessThanOrEqual(left + viewport.width);
      expect(y, plot.county.name).toBeGreaterThanOrEqual(top);
      expect(y, plot.county.name).toBeLessThanOrEqual(top + viewport.height);
    }
  });
});

describe('the minimap fits its corner', () => {
  it('shrinks a tall world to the height budget instead of overflowing it', () => {
    // The regression this guards is real and was caught in a screenshot: sizing
    // by width alone turned a realm twice as tall as it is wide into a 108x211
    // panel covering a quarter of the map.
    const box = fitMinimap(108, 148, 2);
    expect(box.height).toBeLessThanOrEqual(148);
    expect(box.width).toBeLessThanOrEqual(108);
  });

  it('uses the full width when the world is not too tall for it', () => {
    const box = fitMinimap(108, 148, 1);
    expect(box.width).toBe(108);
    expect(box.height).toBe(108);
  });

  it('keeps the world proportions whichever axis is the constraint', () => {
    for (const aspect of [0.4, 1, 1.95, 4]) {
      const box = fitMinimap(108, 148, aspect);
      expect(box.height / box.width).toBeCloseTo(aspect, 1);
    }
  });

  it('fits the real realm inside the corner box', () => {
    const world = worldLayout(REALM, build())!;
    const { width, height } = worldSize(world);
    const box = fitMinimap(108, 148, height / width);
    expect(box.width).toBeLessThanOrEqual(108);
    expect(box.height).toBeLessThanOrEqual(148);
  });
});

describe('bake signatures decide what is recomposed', () => {
  const interiorOf = () => {
    const interior = build().counties[REALM.counties[0]!.id]?.interior;
    if (!interior) throw new Error('Expected the first county to have an interior');
    return interior;
  };

  it('does not change when nothing changes', () => {
    const interior = interiorOf();
    expect(layerSignatures(interior)).toEqual(layerSignatures(interior));
  });

  it('re-bakes fields when a field is planted, and only fields', () => {
    // The efficiency claim, asserted rather than assumed. A signature that
    // moved on every render would silently recompose the whole world every
    // frame — no visible bug, just a map that feels slow for no reason.
    const interior = interiorOf();
    const before = layerSignatures(interior);

    const [first, ...rest] = interior.fields;
    const planted = {
      ...interior,
      fields: [{ ...first!, status: 'grain' as const, seasonsGrown: 1 }, ...rest],
    };
    const after = layerSignatures(planted);

    expect(after.fields).not.toBe(before.fields);
    expect(after.ground).toBe(before.ground);
    expect(after.roads).toBe(before.roads);
    expect(after.props).toBe(before.props);
  });

  it('re-bakes fields as a crop matures, because the art changes', () => {
    const interior = interiorOf();
    const [first, ...rest] = interior.fields;
    const at = (seasonsGrown: number) =>
      layerSignatures({
        ...interior,
        fields: [{ ...first!, status: 'grain' as const, seasonsGrown }, ...rest],
      }).fields;

    expect(at(0)).not.toBe(at(4));
  });

  it('ignores state that does not change a tile', () => {
    // Reclamation progress is a number in a panel, not a different picture.
    // Including it would recompose the layer for a change nobody can see.
    const interior = interiorOf();
    const [first, ...rest] = interior.fields;
    const before = layerSignatures(interior).fields;
    const after = layerSignatures({
      ...interior,
      fields: [{ ...first!, reclaimed: 0.75 }, ...rest],
    }).fields;

    expect(after).toBe(before);
  });
});
