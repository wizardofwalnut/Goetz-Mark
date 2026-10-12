# Phase B wiring plan (written Oct 7, not started)

Doc only — nothing here has been applied to the game file. This is the
ordered list of every change Phase B makes for the art accepted so far, so the
pass runs as one batch (BIG_BANG_ART_PASS_PLAN §5) instead of being worked out
mid-way. Checked against `aldermarch-single-file/aldermarch-game.html` at
commit `ee81e65`.

---

## Finding: 79 of 171 manifest keys are never read by the game

(An earlier count said 172; the real total is 171.)

Every art lookup in the game goes through `resolveAsset([...])`. Listing every
key the code can ask for — literal keys plus the patterns it builds, like
`overhead.road.${mask}` — and comparing with the manifest:

| Group | Keys | Read by code? |
|---|---|---|
| `terrain.*` (incl. chokepoint + seasons) | 20 | No |
| `tile.*` (incl. seasons) | 20 | No — the map uses `overhead.tile.*` |
| `castle.*` (the five tier pictures) | 5 | No — the map uses `overhead.castle.*` |
| `industry.*.idle / .working` | 8 | No — the map uses `overhead.industry.*` |
| `field.*` | 6 | No — `fieldArt()` has no callers; the map uses `overhead.field.*` |
| `sprite.*` (cow, wagons, army sizes, mercenary offer) | 7 | No |
| `crest.*` | 4 | No |
| `ui.*` (kit, wax stamp, app icon) | 8 | No |
| `equipment.knightArmour` | 1 | No |
| **Everything else** (`overhead.*`, `unit.*`, `resource.*`, `figma.resource.*`, `banner.*`) | 92 | Yes |

**What this means for the art list:** nothing drawn for those 79 keys would
ever appear in the game today. That makes several "missing" items and open
questions moot for this pass:
- Industry idle vs working — the game never shows either.
- `field.fallow` (grass) vs `overhead.field.fallow` — only the overhead one is drawn.
  The fallow tile in `GROK_PROMPTS.md` is still needed, for `overhead.field.fallow`.
- `sprite.cow`, `sprite.army.*`, `sprite.mercenaryOffer` — not drawn. The cow
  that matters is `overhead.sprite.cow`.
- `tile.*` vs `terrain.*` — neither is drawn; the map bakes `overhead.tile.*`.
- Crests and the UI kit — not drawn anywhere yet.

**Recommendation (your call, no rush):** leave these 79 keys out of Phase B —
don't make art for them, and either delete them from the manifest or mark them
dormant. The castle tier pictures and industry pictures that already exist
stay in `art/` in case a future screen wants them.

**Knight helm:** the helm was filed under `equipment.knightArmour`, which is
never read. The icon the player actually sees for knight armour is
`resource.armor` (label "Knight Armor" in `RESOURCE_LABEL`, shown by the
blacksmith and trade screens). Wire the helm to `resource.armor`.

## Finding: units need 8 keys, not 6

`unitArt(kind, faction)` is called with the army's troop kinds, and `UNITS`
has 8: militia, archers, crossbowmen, swordsmen, macemen, pikemen, knights,
mercenaries. The manifest only has militia, archers, knights, mercenaries (plus
two faction variants). The 8 sourced images map by name:

| Troop kind | Image | Key |
|---|---|---|
| militia | militia | `unit.militia` (exists) |
| archers | archer | `unit.archers` (exists) |
| crossbowmen | crossbow | `unit.crossbowmen` (new) |
| swordsmen | swordsman | `unit.swordsmen` (new) |
| macemen | maceman | `unit.macemen` (new) |
| pikemen | pikeman | `unit.pikemen` (new) |
| knights | mounted knight (sword version) | `unit.knights` (exists) |
| mercenaries | — none — | `unit.mercenaries` (exists, still missing) |
| — | siege ram | no troop kind uses it; keep in `art/` for later |

`unit.militia.knight` and `unit.knights.knight` are faction overrides; with
no separate faction art they can go, and `unitArt` falls back to the base key.
Unit icons are drawn 18x18 in the army panel, so the 8 need a size check at
18 px once the canon zip is here (the zip is still needed for the actual files).

## Finding: seasonal ground art isn't wired in this build

`overheadGroundArt(cell.kind, season)` is called with a season, but the
function only takes `kind`, so the season is dropped. The BB plan says the
season plumbing was built — it may exist in `src/` but it isn't in the
compiled file. Seasonal art is deferred anyway; just don't count on it
being ready.

---

## The Phase B changes, in order

Each step depends on the ones above it.

0. **Switch to the diamond grid (decided Oct 11).** Game logic, pathing, saves
   and the map generator stay in grid (col, row) coordinates — only drawing,
   tapping and depth order change. Checked Oct 11, the square-grid screen math
   is concentrated in a few places:
   - `cellX` / `cellY` / `cellCentre` / `STRIDE_Y` (~19250; `STRIDE_Y` has 15
     uses) → one `toScreen(col, row)`: x = (col − row)·W/2, y = (col + row)·H/2,
     with W = diamond width, H = W/2.
   - Bake: `nativeX` / `nativeY` / `bakeSize` / `blitTile` → same projection;
     the county canvas becomes the diamond's bounding box.
   - Depth order: the two sorts by row (`props.sort` ~19603, `sprites.sort`
     ~20728) → sort by `col + row`, then `col`. This is also the structural
     z-order fix from BB plan §2.
   - Tapping: SVG cell rects (highlights, move/target areas) → diamond
     polygons, and screen → grid uses the inverse projection. Re-test every
     tap path (Lessons Theme A).
   - County walls: `wallSegments` / `CountyWalls` follow diamond edges.
   - Camera/scroll: `VIEW_COLS` now counts diamond widths across the screen.
   Do this before step 1 — the bake sizes below are diamond sizes.

1. **Zoom and bake (revised Oct 11: ~7 tiles across — unchanged — and a 160 px bake).**
   - Keep `VIEW_COLS` at 7; tune on the S10e only if needed.
   - One `BAKE_TILE_PX = 160` constant (diamond width) replaces the hard-coded
     32 px native tile; scale `BAKE_PAD_PX` with it.
   - Bake only the county in view (+ neighbours lazily), and merge the
     ground/fields/roads layers into one canvas — all 4 counties x 4 layers at
     288 would be far too much memory.
   - Check memory and smoothness on the S10e before anything else; fallback 128.
   Everything below is resized against this.
2. **Fix the two old manifest bugs.**
   - `overhead.tile.ground`: drop `aliasOf: overhead.road.0`; point at a real
     ground tile.
   - `resource.bows`: add the accepted bow icon file.
3. **Rename and remove keys.**
   - `banner.verdigris` → `banner.sable`; `BEST_NOBLE_BANNERS` (line ~21321)
     `"verdigris"` → `"sable"`.
   - Remove the 5 `terrain.chokepoint*` keys (and, if you agree, the rest of
     the 79 unread keys above).
   - Add `unit.crossbowmen`, `unit.swordsmen`, `unit.macemen`, `unit.pikemen`.
   - Add `overhead.sprite.laborer-builder` (needs a job named `builder` in the
     labour code — check how castle building assigns workers first).
   - Add wall keys: `overhead.wall.run`, `overhead.wall.post`.
4. **Point every accepted key at its new file** (all at once, not by category):
   - `overhead.road.0..15` → `art/road-iso/road-NN.png` by mask number (today's
     paths are shuffled `tile-NN.png` names).
   - `overhead.castle.flag.0..3` → `art/flag/flag-{crimson,azure,gold,sable}.png`.
   - `overhead.army.bearer.0..3`, `overhead.army.soldier`, `overhead.sprite.wagon`
     → the `-toward` files (the `-away` files need step 6).
   - `banner.*` → `art/banner/`.
   - `resource.armor` → `art/icons/item_knight_helm.png`.
   - `overhead.field.barren` → the furrowed dirt tile (canon zip).
5. **Placement changes.**
   - Caravan flag: raise the offset (today `y: -0.95`, line ~20660) so the cloth
     flies above the canopy — see `art/flag/_preview-on-wagon.png`. Check on the S10e.
   - Castle flag (line ~20603): re-check against the new keep art.
   - Border wall: replace the SVG lines in `CountyWalls` with
     `art/wall-iso/` sprites — two overlapping sections per edge, mirrored
     for up-left edges, a post at every vertex (numbers in the Art Bible).
   - Ground tiles: pick variant `(col % 2, row % 2)` for every flat ground
     type (`ground-<type>-<i><j>.png`).
6. **Facing.** Track each wagon's and army's last move direction; choose the
   toward/away file and CSS-mirror it for the other two directions; mirror the
   flag overlay's x offset with it.
7. **Structural z-order fix** (BB plan §2) — taller diorama sprites make the
   row-sort overlap worse.
8. **Switch rendering to smooth** for everything; confirm nothing still uses
   `PIXEL_ART_RENDERING`.
9. **Verify:** health sweep clean, Playwright screenshots of every screen at
   S10e size, 40-turn autoplay, then on-device check.

## Also fix in Phase B (code, not art)

- Save Export (`exportSaveToFile`, line ~14523) uses `URL.createObjectURL` —
  the same `blob:` link that broke terrain on the S10e. Switch to a `data:`
  URL and test the download on the phone.

## Added Oct 11 (from the real-layout mock-up, `art/_preview/hollowmere-*`)

- **Tile sheets, not textures:** map art is the ChatGPT tile sheets
  (`art/tileset-grok/`), grid ratio ~1.55:1 (not 2:1), lawn tiles picked as
  `lawn-<col%2><row%2>`. Tall tiles (castle, town, buildings) stand on the
  cell's bottom vertex at 1.2–1.6x tile width. Renderer prototype:
  `tools/county_mock.py`.
- **Soft shadows:** one blurred shadow layer cast down-right from tall
  things, drawn between the flat ground and the tall tiles.
- **Decoration layer (new, cosmetic only):** Hollowmere has ~100 plain-ground
  cells of 133, so a real county looks emptier than the concept art. Scatter
  seeded, non-interactive decorations (bushes, trees, flowers, rocks, fences)
  on plain ground so the land reads as busy. No gameplay effect.
- **County shape on the diamond grid:** a 7x19 county becomes a diagonal
  band. Neighbouring counties fill most of the dark space around it in the
  world view; only the world's outer edge shows void. Check this on the real
  4-county world before changing any county dimensions.
- **Zoom:** ~4 tiles across reads closest to the reference; 160 px bake then
  becomes ~270 px — re-test bake size once the zoom is chosen.
