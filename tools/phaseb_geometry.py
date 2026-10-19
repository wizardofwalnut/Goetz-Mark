"""Phase B step 0+1: switch the living map to the diamond (isometric) grid.

Usage: python3 tools/phaseb_geometry.py <game.html>   (edits in place; asserts every anchor)

Game logic, pathing and saves stay in grid (col, row). Only drawing, tapping
and depth order change (PHASE_B_PLAN step 0). Projection, in SVG units:
    top vertex of cell (col, row) = ((col - row) * TILE_W/2 + ISO_X0, (col + row) * TILE_H/2)
with TILE_W = 58 (unchanged SVG unit per tile) and TILE_H = TILE_W / 1.55 (the
ChatGPT sheet's ratio). ISO_X0 = world rows * TILE_W/2 so x never goes negative.
The bake draws each county into one canvas per layer at BAKE_TILE_PX per tile
(decided Oct 18: 4 tiles across the phone, ~270 phone px per tile).
Ground tiles are pre-normalised by tools/phaseb_inject.py: diamond exactly
BAKE_TILE_PX wide, top vertex at y = BAKE_TILE_PX * TILE_TOP_PAD.
"""
import sys

p = sys.argv[1]
s = open(p, encoding='utf-8').read()


def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, f'expected {count} x, found {n}: {old[:90]!r}'
    s = s.replace(old, new)


# ---------------------------------------------------------------- projection
rep("""var TOP_FACE_RATIO = 23 / 32;
/** Vertical distance between rows. Rows overlap by the depth band. */
var STRIDE_Y = Math.round(58 * TOP_FACE_RATIO);
/** Scale factor from source art pixels to CSS pixels. */
var ART_SCALE = 58 / 32;
/** Where a grid cell's art canvas is drawn. */
var cellX = (col) => col * 58;
var cellY = (row) => row * STRIDE_Y;
/** Centre of a cell's visible top face — where a sprite standing on it sits. */
var cellCentre = (col, row) => ({
	x: cellX(col) + 58 / 2,
	y: cellY(row) + STRIDE_Y / 2
});
/** Total pixel extent of a grid, including the depth band of the last row. */
var gridSize = (cols, rows) => ({
	width: cols * 58,
	height: (rows - 1) * STRIDE_Y + Math.round(58 * (29 / 32))
});""",
"""var TOP_FACE_RATIO = 1 / 1.55;
/**
* Diamond (isometric) grid, Phase B (decided Oct 11; ratio 1.55 = the ChatGPT
* tile sheet's). TILE_W is one diamond's width in SVG units, TILE_H its height.
* STRIDE_Y keeps its old meaning for callers: the height of a tile's top face.
*/
var TILE_W = 58;
var TILE_H = TILE_W * TOP_FACE_RATIO;
var STRIDE_Y = TILE_H;
/** Slab depth below the bottom vertex, as a fraction of TILE_W (sheet tiles). */
var SLAB_DEPTH = .12;
/** Bake resolution: phone pixels per diamond at 4 across (Oct 18). */
var BAKE_TILE_PX = 200;
/** Ground tiles are normalised with this much headroom above the top vertex. */
var TILE_TOP_PAD = .5;
/** Scale factor from baked pixels to SVG units. */
var ART_SCALE = TILE_W / BAKE_TILE_PX;
/** X of the world's leftmost point; set from the world's row count. */
var ISO_X0 = 0;
/** Top vertex of a cell's diamond. */
var cellTop = (col, row) => ({
	x: (col - row) * TILE_W / 2 + ISO_X0,
	y: (col + row) * TILE_H / 2
});
/** Centre of a cell's top face — where a sprite standing on it sits. */
var cellCentre = (col, row) => {
	const t = cellTop(col, row);
	return { x: t.x, y: t.y + TILE_H / 2 };
};
/** The four corners of a cell's diamond, as an SVG points string. */
var cellDiamond = (col, row) => {
	const t = cellTop(col, row);
	return `${t.x},${t.y} ${t.x + TILE_W / 2},${t.y + TILE_H / 2} ${t.x},${t.y + TILE_H} ${t.x - TILE_W / 2},${t.y + TILE_H / 2}`;
};
/** Total extent of a diamond grid, including the slab under the front edges. */
var gridSize = (cols, rows) => ({
	width: (cols + rows) * TILE_W / 2,
	height: (cols + rows) * TILE_H / 2 + TILE_W * SLAB_DEPTH
});""")

rep("""var worldSize = (layout) => gridSize(layout.cols, layout.rows);""",
"""var worldSize = (layout) => {
	ISO_X0 = layout.rows * TILE_W / 2;
	return gridSize(layout.cols, layout.rows);
};""")

# ---------------------------------------------------------------- bake geometry
rep("""var BAKE_PAD_PX = 32;""", """var BAKE_PAD_PX = 200;""")
rep("""var nativeStride = Math.round(32 * TOP_FACE_RATIO);
var nativeX = (col) => col * 32 + BAKE_PAD_PX;
var nativeY = (row) => row * nativeStride + BAKE_PAD_PX;
var bakeSize = (cols, rows) => ({
	width: cols * 32 + BAKE_PAD_PX * 2,
	height: (rows - 1) * nativeStride + Math.round(32 * (29 / 32)) + BAKE_PAD_PX * 2
});
/** A tile, drawn at its full canvas so its depth band survives. */
function blitTile(ctx, url, col, row) {
	if (!url) return;
	const img = ready(url);
	if (img) ctx.drawImage(img, nativeX(col), nativeY(row), 32, 32);
}""",
"""var nativeStride = BAKE_TILE_PX * TOP_FACE_RATIO;
/** The county's row count, set per bake: the left half of its diamond. */
var bakeRows = 0;
/** Top vertex of a cell inside its county's bake canvas. */
var nativeX = (col, row) => (col - row) * BAKE_TILE_PX / 2 + bakeRows * BAKE_TILE_PX / 2 + BAKE_PAD_PX;
var nativeY = (col, row) => (col + row) * nativeStride / 2 + BAKE_PAD_PX;
var bakeSize = (cols, rows) => ({
	width: Math.ceil((cols + rows) * BAKE_TILE_PX / 2 + BAKE_PAD_PX * 2),
	height: Math.ceil((cols + rows) * nativeStride / 2 + BAKE_TILE_PX * SLAB_DEPTH + BAKE_PAD_PX * 2)
});
/**
* A ground tile. Tiles are normalised (phaseb_inject.py): the diamond spans the
* image's full width and its top vertex sits TILE_TOP_PAD x width from the top,
* so the slab sides and any overhang (wheat) keep their place.
*/
function blitTile(ctx, url, col, row) {
	if (!url) return;
	const img = ready(url);
	if (!img) return;
	const w = BAKE_TILE_PX, h = img.height * w / img.width;
	ctx.drawImage(img, nativeX(col, row) - w / 2, nativeY(col, row) - w * TILE_TOP_PAD, w, h);
}""")

rep("""	const x = nativeX(col), y = nativeY(row);
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, 32 * Math.min(1, fraction), 32);
	ctx.clip();
	ctx.drawImage(img, x, y, 32, 32);
	ctx.restore();""",
"""	const w = BAKE_TILE_PX, h = img.height * w / img.width;
	const x = nativeX(col, row) - w / 2, y = nativeY(col, row) - w * TILE_TOP_PAD;
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w * Math.min(1, fraction), h);
	ctx.clip();
	ctx.drawImage(img, x, y, w, h);
	ctx.restore();""")

rep("""	const w = 32 * size;
	const cx = nativeX(col) + 32 / 2;
	const cy = nativeY(row) + nativeStride / 2;
	ctx.drawImage(img, cx - w / 2, cy + nativeStride / 2 - w, w, w);""",
"""	// Standing art keeps its own aspect; its feet sit a little above the
	// diamond's bottom vertex (the sprites carry a ground skirt), as in county_mock.
	const w = BAKE_TILE_PX * size, h = img.height * w / img.width;
	const cx = nativeX(col, row);
	const foot = nativeY(col, row) + nativeStride * .95;
	ctx.drawImage(img, cx - w / 2, foot - h, w, h);""")

rep("""	if (ctx) ctx.imageSmoothingEnabled = false;""", """	if (ctx) {
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
	}""")

# one canvas per layer, county drawn back to front (col + row) so raised slabs overlap correctly
rep("""	const { width, height } = bakeSize(interior.cols, interior.rows);
	const layers = [];""", """	bakeRows = interior.rows;
	const { width, height } = bakeSize(interior.cols, interior.rows);
	const layers = [];
	const depth = (a, b) => (a.col + a.row) - (b.col + b.row) || a.col - b.col;""")

rep("""	await compose("ground", (ctx) => {
		const base = overheadGroundArt("ground", season);
		for (const cell of interior.ground) {
			blitTile(ctx, base.url, cell.col, cell.row);
			if (cell.kind !== "ground") blitTile(ctx, overheadGroundArt(cell.kind, season).url, cell.col, cell.row);
		}
	});
	await compose("fields", (ctx) => {
		for (const field of interior.fields) {""",
"""	/**
	* ONE land canvas: lawn, fields and roads drawn cell by cell back to front.
	* On the diamond grid a raised field's slab must cover the lawn in front of
	* it and be covered by the one behind — separate layers can't do that, and
	* one canvas is also a quarter of the memory at this resolution.
	*/
	const fieldAt = new Map(interior.fields.map((f) => [`${f.col},${f.row}`, f]));
	const roadAt = new Map(interior.road.map((c) => [`${c.col},${c.row}`, c]));
	await compose("ground", (ctx) => {
		for (const cell of [...interior.ground].sort(depth)) {
			const k = `${cell.col},${cell.row}`;
			const field = fieldAt.get(k);
			if (field) {
				drawField(ctx, field);
				continue;
			}
			const road = roadAt.get(k);
			const lawn = groundVariantArt(cell.col, cell.row).url;
			if (cell.kind === "ground" || cell.kind === "mountain") blitTile(ctx, lawn, cell.col, cell.row);
			else blitTile(ctx, overheadGroundArt(cell.kind, season).url, cell.col, cell.row);
			if (road) {
				const world = toWorld(origin, road);
				const mask = masks[`${world.col},${world.row}`];
				if (mask !== void 0) blitTile(ctx, overheadRoadArt(mask).url, cell.col, cell.row);
			}
		}
	});
	function drawField(ctx, field) {
		{""")

rep("""			blitTile(ctx, art.url, field.col, field.row);
		}
	});
	await compose("roads", (ctx) => {
		for (const cell of interior.road) {
			const world = toWorld(origin, cell);
			const mask = masks[`${world.col},${world.row}`];
			if (mask === void 0) continue;
			blitTile(ctx, overheadRoadArt(mask).url, cell.col, cell.row);
		}
	});""",
"""			blitTile(ctx, art.url, field.col, field.row);
		}
	}""")
# the field loop body used `continue` inside the old for-loop; inside drawField it must return
rep("""					blitPartialField(ctx, baseArt.url, art.url, field.col, field.row, fraction);
					continue;""", """					blitPartialField(ctx, baseArt.url, art.url, field.col, field.row, fraction);
					return;""")

rep("""			url: overheadMountainArt(season).url,
			size: 1.5
		});""", """			url: mountainVariantArt(cell.col, cell.row).url,
			size: 1.05
		});""")
rep("""			url: overheadForestArt(season).url,
			size: 1.4
		});""", """			url: overheadForestArt(season).url,
			size: 1.05
		});""")
rep("""			url: overheadIndustryArt(site.kind).url,
			size: 1.15
		});
		props.sort((a, b) => a.row - b.row);""", """			url: overheadIndustryArt(site.kind).url,
			size: INDUSTRY_SIZE[site.kind] ?? 1.2
		});
		props.sort(depth);""")

rep("""var overheadMountainArt = () => resolveAsset(["overhead.sprite.mountain"]);""",
"""var overheadMountainArt = () => resolveAsset(["overhead.sprite.mountain"]);
/** Lawn variant for a cell: (col % 2, row % 2), so the pattern repeats only every 2 tiles. */
var groundVariantArt = (col, row) => resolveAsset([`overhead.tile.ground.v${col % 2}${row % 2}`, "overhead.tile.ground"]);
/** Mountain variant: (col + row) % 3. */
var mountainVariantArt = (col, row) => resolveAsset([`overhead.sprite.mountain.${"abc"[(col + row) % 3]}`, "overhead.sprite.mountain"]);
/** Width of each industry building in tiles (mine 0.85 decided Oct 13). */
var INDUSTRY_SIZE = { mine: .98, quarry: 1.3, lumberMill: 1.3, blacksmith: 1.2 };""")

# ---------------------------------------------------------------- the SVG surface
rep("""			style: { width: `${layout.cols / VIEW_COLS * 100}%` },""",
"""			style: { width: `${(layout.cols + layout.rows) / 2 / VIEW_COLS * 100}%` },""")
rep("""var VIEW_COLS = 7;""", """var VIEW_COLS = 4;""")

rep("""		x: view.left / scale / 58,
		y: view.top / scale / STRIDE_Y,
		width: view.width / scale / 58,
		height: view.height / scale / STRIDE_Y,
		worldCols: worldW / 58,
		worldRows: worldH / STRIDE_Y""",
"""		x: view.left / scale / TILE_W,
		y: view.top / scale / TILE_H,
		width: view.width / scale / TILE_W,
		height: view.height / scale / TILE_H,
		worldCols: worldW / TILE_W,
		worldRows: worldH / TILE_H""")

rep("""		const x = plot.origin.col * 58 - BAKE_PAD_PX * ART_SCALE;
		const y = plot.origin.row * STRIDE_Y - BAKE_PAD_PX * ART_SCALE;""",
"""		const top = cellTop(plot.origin.col, plot.origin.row);
		const x = top.x - (plot.interior.rows * BAKE_TILE_PX / 2 + BAKE_PAD_PX) * ART_SCALE;
		const y = top.y - BAKE_PAD_PX * ART_SCALE;""")
rep("""			style: { imageRendering: layer.name === "fields" ? SMOOTH_ART_RENDERING : PIXEL_ART_RENDERING }""",
"""			style: { imageRendering: SMOOTH_ART_RENDERING }""")
rep("""	const ordered = [...layout.plots].sort((a, b) => a.origin.row - b.origin.row || a.origin.col - b.origin.col);""",
"""	const ordered = [...layout.plots].sort((a, b) => a.origin.row + a.origin.col - (b.origin.row + b.origin.col) || a.origin.col - b.origin.col);""")

# sprites: aspect kept, feet on the cell, depth = col + row
rep("""	sprites.sort((a, b) => (a.row - b.row) || (a.col - b.col));""",
"""	sprites.sort((a, b) => (a.row + a.col - (b.row + b.col)) || (a.col - b.col));""")
rep("""	const w = 58 * size;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("image", {
		href: art.url,
		x: centre.x - w / 2 + (offset?.x ?? 0) * 58,
		y: centre.y + STRIDE_Y / 2 - w + (offset?.y ?? 0) * STRIDE_Y,
		width: w,
		height: w,
		style: {
			imageRendering: PIXEL_ART_RENDERING,""",
"""	const w = TILE_W * size;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("image", {
		href: art.url,
		x: centre.x - w / 2 + (offset?.x ?? 0) * TILE_W,
		y: centre.y + TILE_H * .45 - w + (offset?.y ?? 0) * TILE_H,
		width: w,
		height: w,
		preserveAspectRatio: "xMidYMax meet",
		style: {
			imageRendering: SMOOTH_ART_RENDERING,""")

# tap / highlight areas: diamonds, not rects
rep("""		const centre = cellCentre(world.col, world.row);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
			x: centre.x - 29,
			y: centre.y - STRIDE_Y / 2,
			width: 58,
			height: STRIDE_Y,
			fill,""",
"""		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
			points: cellDiamond(world.col, world.row),
			fill,""")
rep("""			const centre = cellCentre(world.col, world.row);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: centre.x - 29,
				y: centre.y - STRIDE_Y / 2,
				width: 58,
				height: STRIDE_Y,
				fill: "transparent",""",
"""			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
				points: cellDiamond(world.col, world.row),
				fill: "transparent",""")

# county walls: along diamond edges (n = top-right edge, e = bottom-right, s = bottom-left, w = top-left)
rep("""			const x0 = cellX(seg.col);
			const y0 = cellY(seg.row);
			const x1 = seg.side === "e" ? x0 + 58 : x0;
			const y1 = seg.side === "s" ? y0 + STRIDE_Y : y0;
			const x2 = seg.side === "w" ? x0 : x0 + 58;
			const y2 = seg.side === "n" ? y0 : y0 + STRIDE_Y;""",
"""			const t = cellTop(seg.col, seg.row);
			const T = [t.x, t.y], R = [t.x + TILE_W / 2, t.y + TILE_H / 2], B = [t.x, t.y + TILE_H], L = [t.x - TILE_W / 2, t.y + TILE_H / 2];
			const [[x1, y1], [x2, y2]] = { n: [T, R], e: [R, B], s: [B, L], w: [L, T] }[seg.side];""")

open(p, 'w', encoding='utf-8').write(s)
print('geometry patch applied')
