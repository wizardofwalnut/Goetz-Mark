/**
 * The overhead camera.
 *
 * v2 of the county-map spec makes the camera a decision rather than an
 * accident: a god's-eye strategic view looking down at the land, the same
 * category of camera as Civilization IV — NOT the close ground-level
 * isometric tilt the LOTR2 reference screenshots show. The earlier
 * CountyScreen used a 64x32 two-to-one isometric diamond, which is exactly
 * the camera v2 rules out, so this is a different projection rather than a
 * tweak of that one.
 *
 * Two consequences follow from the angle, and both are load-bearing:
 *
 *   1. The grid is AXIS-ALIGNED SQUARES, not rotated diamonds. Looking
 *      straight down at a square field shows a square.
 *   2. Tiles still carry a depth band along their bottom edge, so the land
 *      reads with relief instead of as a flat paper map. Rows therefore
 *      OVERLAP: each row's depth band is covered by the row in front of it,
 *      which is why the vertical stride is smaller than the tile art.
 *
 * The numbers below are measured from the generated art, not chosen by eye.
 * PixelLab produced the set at tile_view_angle 60 with tile_depth_ratio 0.2,
 * giving a 32x32 canvas whose opaque area is 32 wide and 29 tall: a 23px top
 * face with a 6px depth band under it. Change the generation parameters and
 * these must be re-measured — see tools/batches/overhead-camera.json.
 */

/** Native art size, in source pixels. The whole set shares this canvas. */
export const ART_TILE_PX = 32;

/**
 * Top-face height as a fraction of tile width. The stride between rows.
 *
 * NOT 1.0: at a 60-degree camera a square tile is foreshortened. NOT the full
 * 29px opaque height either — that includes the depth band, and striding by it
 * would leave the relief hanging in mid-air below each row.
 */
export const TOP_FACE_RATIO = 23 / 32;

/**
 * On-screen tile width in CSS pixels.
 *
 * Sized for a thumb, not for density. v2 is explicit that fitting more of the
 * county on screen is the wrong trade: "Sprites and tiles should read
 * noticeably larger relative to the screen than LOTR2's originals", with a
 * comfortable minimum tap target of roughly 44-48pt. 58 clears that with room
 * to spare and still puts a 7-wide county inside a 414pt phone viewport.
 */
export const TILE_W = 58;

/** Vertical distance between rows. Rows overlap by the depth band. */
export const STRIDE_Y = Math.round(TILE_W * TOP_FACE_RATIO);

/** Scale factor from source art pixels to CSS pixels. */
export const ART_SCALE = TILE_W / ART_TILE_PX;

/** Where a grid cell's art canvas is drawn. */
export const cellX = (col: number) => col * TILE_W;
export const cellY = (row: number) => row * STRIDE_Y;

/** Centre of a cell's visible top face — where a sprite standing on it sits. */
export const cellCentre = (col: number, row: number) => ({
  x: cellX(col) + TILE_W / 2,
  y: cellY(row) + STRIDE_Y / 2,
});

/**
 * Painter's order.
 *
 * Rows overlap, so a row must be drawn after everything behind it. Column
 * order within a row does not matter — tiles in the same row never overlap.
 */
export const depthOf = (cell: { readonly row: number }) => cell.row;

/** Total pixel extent of a grid, including the depth band of the last row. */
export const gridSize = (cols: number, rows: number) => ({
  width: cols * TILE_W,
  height: (rows - 1) * STRIDE_Y + Math.round(TILE_W * (29 / 32)),
});

// ---------------------------------------------------------------------------
// Road autotiling
// ---------------------------------------------------------------------------

/**
 * Edge bitmask for a road cell: bit0=N bit1=E bit2=S bit3=W, a set bit meaning
 * the road continues across that edge.
 *
 * This is PixelLab's own convention for the generated path set, kept rather
 * than translated — the manifest keys the 16 pieces by this exact number, so
 * there is no lookup table anywhere that could disagree with the art.
 */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

export interface Cell {
  readonly col: number;
  readonly row: number;
}

/**
 * Which road piece belongs in each cell of a road network.
 *
 * A road that leaves the county carries one cell PAST the boundary in the
 * generated path. That sentinel is never drawn — it is out of bounds — but it
 * is what makes the last visible cell connect outward instead of rendering as
 * a dead-end stub at the county edge. Deriving "does it leave here?" from
 * position alone cannot work: a road that merely runs along the boundary would
 * be indistinguishable from one that crosses it.
 */
export function roadMasks(
  road: readonly Cell[],
  bounds: { readonly cols: number; readonly rows: number },
): Record<string, number> {
  const key = (c: number, r: number) => `${c},${r}`;
  const set = new Set(road.map((c) => key(c.col, c.row)));
  const inside = (c: Cell) =>
    c.col >= 0 && c.row >= 0 && c.col < bounds.cols && c.row < bounds.rows;

  const masks: Record<string, number> = {};
  for (const cell of road) {
    if (!inside(cell)) continue;
    const links = (dc: number, dr: number) => set.has(key(cell.col + dc, cell.row + dr));
    let mask = 0;
    if (links(0, -1)) mask |= N;
    if (links(1, 0)) mask |= E;
    if (links(0, 1)) mask |= S;
    if (links(-1, 0)) mask |= W;
    masks[key(cell.col, cell.row)] = mask;
  }
  return masks;
}
