import type { CountyDef, GameMap } from '../../domain/map/mapTypes';
import type { MatchState } from '../../domain/match/matchState';
import type { CountyInterior } from '../../domain/county/interior';
import { cellCentre, gridSize, roadMasks, type Cell } from './overheadCamera';

/**
 * The world camera: many counties on ONE surface.
 *
 * The living map used to draw a single county and nothing past its edges, so
 * marching an army into a neighbour meant leaving the screen the march was
 * happening on. This lays every county's interior out side by side on one
 * scrollable surface, which is what makes "walk from here to there" a thing the
 * player can actually watch.
 *
 * The projection is unchanged — every helper here is built on overheadCamera's
 * geometry rather than beside it. What is new is only the OFFSET: a county at
 * plot (1, 0) draws its cells shifted one county-width to the right.
 *
 * WHY TILING WORKS AT ALL, since it looks like luck: every interior is
 * generated on the same grid with its town at the centre, and the roads to each
 * exit run out along the town's row and column. Two counties laid side by side
 * therefore meet road-to-road at the same row. The out-of-grid sentinel cell
 * each road carries past the boundary lands exactly on the neighbour's first
 * real road cell, so the seam joins itself — see `worldRoad` below.
 */

export interface WorldPlot {
  readonly county: CountyDef;
  readonly interior: CountyInterior;
  /** Top-left cell of this county in world coordinates. */
  readonly origin: { readonly col: number; readonly row: number };
}

export interface WorldLayout {
  readonly plots: readonly WorldPlot[];
  /** Extent of the whole surface, in cells. */
  readonly cols: number;
  readonly rows: number;
  /** Extent of ONE county, in cells. Every county shares it. */
  readonly countyCols: number;
  readonly countyRows: number;
}

/**
 * Lay the map's counties out as a tiled world.
 *
 * Returns null when the map is not a grid — a map pack of irregular shires has
 * no plots, and a world invented from its centroids would tear along the seams.
 * Callers fall back to drawing one county at a time.
 */
export function worldLayout(map: GameMap, match: MatchState): WorldLayout | null {
  const plotted = map.counties.filter((c) => c.plot !== undefined);
  if (plotted.length !== map.counties.length || plotted.length === 0) return null;

  const first = match.counties[plotted[0]!.id]?.interior;
  if (!first) return null;
  const countyCols = first.cols;
  const countyRows = first.rows;

  const plots: WorldPlot[] = [];
  for (const county of plotted) {
    const interior = match.counties[county.id]?.interior;
    if (!interior) return null;
    // A world tiled from interiors of different sizes has gaps and overlaps
    // along every seam. That is a torn map, and it must not render quietly —
    // the failure is far easier to understand here than as a visual artefact.
    if (interior.cols !== countyCols || interior.rows !== countyRows) {
      throw new Error(
        `Cannot tile the world: ${county.id} is ${interior.cols}x${interior.rows}, ` +
          `expected ${countyCols}x${countyRows}. Every interior must share a grid.`,
      );
    }
    plots.push({
      county,
      interior,
      origin: { col: county.plot!.col * countyCols, row: county.plot!.row * countyRows },
    });
  }

  const cols = (Math.max(...plotted.map((c) => c.plot!.col)) + 1) * countyCols;
  const rows = (Math.max(...plotted.map((c) => c.plot!.row)) + 1) * countyRows;
  return { plots, cols, rows, countyCols, countyRows };
}

/** A county-local cell in world coordinates. */
export const toWorld = (origin: { col: number; row: number }, cell: Cell): Cell => ({
  col: cell.col + origin.col,
  row: cell.row + origin.row,
});

/** Pixel extent of the whole surface. */
export const worldSize = (layout: WorldLayout) => gridSize(layout.cols, layout.rows);

/**
 * Road pieces for the WHOLE world, computed in one pass.
 *
 * This is the load-bearing part of joining the counties up, and it needs no new
 * autotiling code at all — just a wider `bounds`.
 *
 * Each county's road carries one sentinel cell past its own boundary. Per
 * county those sentinels are out of bounds and draw nothing; in world space
 * they land ON the neighbour's first real road cell. So a border cell sees a
 * road continuing across the seam and picks the connecting piece instead of a
 * dead-end stub, and the duplicate resolves to the same mask from both sides.
 *
 * Computed per county instead, this cannot work: neither county can see the
 * other's road, so both would draw stubs facing each other across the border.
 */
export function worldRoad(layout: WorldLayout): Record<string, number> {
  const cells = layout.plots.flatMap(({ interior, origin }) =>
    interior.road.map((c) => toWorld(origin, c)),
  );
  return roadMasks(cells, { cols: layout.cols, rows: layout.rows });
}

/** Where a county's town sits in world coordinates — what the camera centres on. */
export const townOf = (plot: WorldPlot): Cell => toWorld(plot.origin, plot.interior.town);

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/**
 * Scroll offsets that put a world cell in the middle of the viewport.
 *
 * Pure, and separate from the component, because this is the one bit of the
 * camera that is easy to get subtly wrong and impossible to eyeball: an
 * off-by-half-a-viewport lands the town near an edge rather than centred, which
 * looks like a rendering bug rather than a maths one.
 *
 * `scale` converts SVG user units to rendered pixels — the surface is drawn at
 * a fixed cell size and then scaled to whatever width the stage gives it.
 */
export function focusScroll(
  cell: Cell,
  scale: number,
  viewport: Viewport,
  surface: Viewport,
): { readonly left: number; readonly top: number } {
  const centre = cellCentre(cell.col, cell.row);
  const clamp = (value: number, extent: number, window: number) =>
    // A surface smaller than its window cannot scroll at all, so the max is
    // floored at zero rather than allowed to go negative.
    Math.max(0, Math.min(value, Math.max(0, extent - window)));

  return {
    left: clamp(centre.x * scale - viewport.width / 2, surface.width, viewport.width),
    top: clamp(centre.y * scale - viewport.height / 2, surface.height, viewport.height),
  };
}
