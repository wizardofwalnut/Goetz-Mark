# Aldermarch — Art Bible

**Version:** Oct 17, 2026, update 3 (replaces update 2 of Oct 11). Update 3
adds the ChatGPT sheet-2 batch accepted Oct 15–17 (fields, forest, castle
yard, open forge, farmer, herder, mercenary, all 10 weapon and resource icons),
the mine size and the Phase B icon-size change. **Revised Oct 18:** you
reviewed everything not marked ready and approved all the canon art as is
(castles, town, industry, laborers, troops, siege ram); only the castle yard
ground was rejected. Left: green-screen copies of the 9 canon buildings and
one new yard tile.
**What this is:** every art key in the game's manifest, with its status and
where the art lives. Checked against the live game file on GitHub
(`aldermarch-single-file/aldermarch-game.html`): **171 manifest keys** (the
Sep 5 count of 162 missed 9 keys with hyphens in their names — laborers,
castle yard, open forge, ore cart).

**Important (Oct 7):** 79 of the 171 keys are never read by the game code
(`terrain.*`, `tile.*`, `castle.*`, `industry.*`, `field.*`, `sprite.*`,
`crest.*`, `ui.*`, `equipment.*`). Art for those would never appear. See
`PHASE_B_PLAN.md` — the rows below are marked **UNREAD** where this applies.

**Art Book (picture version of this file):** `art/ART_BOOK.pdf`, one page per
asset with the new art next to what the game draws today. Rebuild it with
`python3 tools/art_book.py aldermarch-single-file/aldermarch-game.html art/ART_BOOK.pdf`
whenever art is accepted; add the file to the catalog at the top of that
script first.

**Where accepted art lives:** GitHub `wizardofwalnut/goetz-mark`, folder
`art/`. Placement numbers, facing rules and seat colours are in
`art/README.md` — this file does not repeat them.

**Status key:**
- ✅ **HAVE** — accepted and checked.
- ⚠️ **CHECK** — art probably exists but the key match isn't confirmed.
- ❌ **MISSING** — not made yet.
- 🚫 **REMOVE / EXCLUDED** — not canon, or the key is being deleted.
- ⏸ **DEFERRED** — out of scope for this pass on purpose.

---

## Target look (decided Oct 7)

Reference: `art/_reference/target-look-hollowmere.jpg`. Match its **style**,
not the exact picture:
- **Zoom:** 4 tiles across the phone (decided Oct 18). Fields are
  groups of tiles that join seamlessly into big blocks.
- **Chunky diorama tiles:** each tile reads as a raised slab with soil showing
  on its front edge; rich texture (wheat stalks, furrows, cracked earth).
- **Small figures on big tiles:** soldiers, horses, cows and wagons are small
  next to a field, so the land dominates.
- **Warm, soft light; saturated but natural colour.**
- **Diamond (isometric) grid** — decided Oct 11, replacing the Oct 7
  "square grid" call. Tiles are diamonds at the ChatGPT sheet's ratio,
  **~1.55:1** (width:height, measured on sheet 1), not 2:1. Screen
  directions: North = up-right, East = down-right, South = down-left,
  West = up-left. Game logic stays in grid coordinates; only drawing,
  tapping and depth order change (see `PHASE_B_PLAN.md`).
- From the reference: the **parched field** (cracked earth) is in; the
  **town is a village cluster** (several houses).

## Zoom and bake resolution — DECIDED Oct 18: 4 across

Chris chose **4 tiles across** after the side-by-side with the accepted Oct 18
buildings (`art/_preview/zoom-compare-newart.jpg`): closest to the reference,
buildings and soldiers read clearly; more scrolling. Tile ≈ 270 px wide on the
S10e, so bake at ~270 px — still to test on the phone (memory, smoothness).
The candidates as they were compared:

Two candidates, both mocked up at the S10e's real 1080 px width with the real
HUD on top:

| | 7 tiles across | 4 tiles across |
|---|---|---|
| Tile width on the phone | ~154 px | ~270 px |
| Bake size per tile | 160 px (tested Oct 7: sharp) | ~270 px (not tested yet) |
| Look | Today's zoom. More of the county on screen; buildings small | Closest to the reference; bigger buildings; more scrolling |
| Mock-up | `art/_preview/mock-7-across.png` | `art/_preview/hollowmere-phone-4-across.png` |

**Recommendation: 4 across** (from the Oct 11 evening mock-ups). How it got
here: Oct 7 said 4 across; on the morning of Oct 11 a grid laid over the
reference showed its fields are blocks of several tiles, which pointed to 7;
the mock-ups with the sheet-1 tiles then read closest to the reference at 4.

Once chosen: test the bake size on the S10e (memory and smoothness; bake one
county at a time either way), then rebuild roads, wall and any texture-built
ground at that width. Sources are kept, so that is one command per set
(`roadgen_iso.py <dirt> <out> <width> 1.55`, `wall_reangle.py`,
`groundgen_iso.py <tex> <out> <width> - 2 1.55`).

## Image tool and tile-sheet format (Oct 11)

**ChatGPT (Plus) is the image tool** from Oct 11; Grok lapses in November.
Map art comes as **tile sheets**: 5x5 separate isometric tiles, each a raised
slab with soil/stone sides, on a dark background, made in one ChatGPT chat
with sheet 1 (`art/tileset-grok/_src/sheet-1.png`, despite the folder name
it came from ChatGPT) attached as the locked reference. Claude cuts the
sheet, scales tiles to one width and anchors each on its slab's left corner;
test map: `art/tileset-grok/_preview-map.png`.

Measured on sheet 1: the slabs are ~1.55:1, not 2:1 — the grid uses the
sheet's ratio. Tiles vary ~10% in width (normalised on cut). Roads are built
by Claude from the sheet's dirt. Faint seams between busy grass tiles: ask
for plain-edged grass variants.

## Oct 11 art packs — what was accepted

**Ground and field tiles — FALLBACK ONLY since sheet 1.** Darker and more
photo-like than the sheet, and built at 2:1, not 1.55. Kept in case sheet 2
misses a field type; if one is used, re-project it at 1.55 first
(`groundgen_iso.py ... - 2 1.55`). (`art/ground-iso/`, 288x179 diamonds with soil edge,
built by `tools/groundgen_iso.py` from the Grok textures in `_src/`).
Each flat ground type comes as **4 variants** `-00 -01 -10 -11`: one texture
spans a 2x2 block of tiles, and tile (col, row) uses variant
`(col % 2, row % 2)`. That cuts visible repetition 4x and gave chunkier detail
closer to the target look (`_preview-variants.png`).

| Key | File(s) |
|---|---|
| overhead.tile.ground | ✅ HAVE (Oct 18: grass texture) | **Use `art/tileset-grok/lawngm-??.png`** — built by `groundgen_iso.py` (240 px, 2x2 variants, 1.55) from ChatGPT's seamless grass texture (`_src/grass-texture-chatgpt.png`), then colour-matched to `target-look-5` by `tools/lawn_match.py` (hue 70, brightness 52%, texture close to the reference). Chris: "good enough, for now I'll go with it" (Oct 18). Seamless across tiles. Earlier candidates kept: `lawnm-??` (matched sheet-1 lawn), `lawn-??` (sheet 1). Rebuild at the bake size (~270) in Phase B. Known bug: today the key points at a road tile through `aliasOf`; fix in Phase B. |
| overhead.tile.forest | `ground-forest-??.png` (trees still drawn on top) |
| overhead.field.fallow | `ground-fallow-??.png` |
| overhead.field.barren | `ground-barren-??.png` |
| overhead.field.grain.sown | `ground-sown-??.png` |
| overhead.field.cattle | `ground-pasture-??.png` |
| overhead.field.parched *(new key)* | `ground-parched-??.png` |
| overhead.field.grain.growing | `ground-wheat-growing.png` (single tile) |
| overhead.field.grain.mature | `ground-wheat-ripe.png` (single tile) |

Wheat: Grok's diamond wheat tiles were separate slabs at a slightly-off angle
and showed a grid when several sat together; the centre of each was lifted
into a seamless texture (`_src/tex-wheat-*.png`) and rebuilt. Single tile
(2x2 would make the stalks too big).

**Props** (`art/props/`, transparent): logs → `overhead.prop.timber`,
cart → `overhead.prop.graincart`, sawhorse → `overhead.prop.sawhorse`,
rubble → `overhead.prop.spoil`, barrels → `overhead.prop.barrels`,
mine cart → `overhead.sprite.ore-cart`, cow → `overhead.sprite.cow`.
Barrels, mine cart and cow came from the green pack (cut out with
`tools/greenkey.py`; originals in `_src/`). Rubble scores 6.7% in
`check_cutout.py` — real gaps between stones, checked on magenta.

**Building:** `art/buildings/building-mine.png` → `overhead.industry.mine`
(green pack).

**Wall** (`art/wall-iso/`, green pack — **superseded by `art/wall-sheet/`**,
the same run re-angled to 1.55; see the wall table below. Notes kept for
history): `wall-run.png` runs lower-left to upper-right (25.7° vs the tiles'
26.6° — not visible); the up-left edges use it mirrored. `wall-post.png` at
every vertex. Placement tested (`_preview.png`): **two sections per tile
edge** (one full-length section stands as tall as a soldier; two halves give
the knee-to-waist height), each scaled so its width ≈ edge width / 2 / 0.88
so neighbours overlap a little (at /0.93 a slit showed at the midpoint);
post height ≈ 1.25x the wall's face. Known nit: the mirrored run's light comes
from the wrong side — fine at map size.

**Icon:** `art/icons/item_sword.png` → `resource.swords` (navy #020A1F).

## Sheet 1 (ChatGPT, Oct 11) — what each tile is for

Cut into `art/tileset-grok/` (tiles on their slab) and `standing/` (cut off
the slab with `tools/unslab.py`, for things that should stand on the lawn).
Source: `_src/sheet-1.png`.

| Tile(s) | Use | Status |
|---|---|---|
| `lawn-00/01/10/11` | `overhead.tile.ground` (2x2 variants, `(col%2, row%2)`) | ✅ HAVE |
| `grass`, `grass-tufty`, `grass-flowers` | Decoration / fallback lawn; tufty is the fallow stand-in | placeholder |
| `bushes`, `rocks` (standing) | Decoration layer (forest now has its own sprite, sheet-2 batch) | ✅ decor |
| `mountain-a/b/c` (standing) | `overhead.sprite.mountain`, 3 variants by `(col+row)%3` | ✅ HAVE |
| `wheat-a/b/c` | `overhead.field.grain.mature` (all three are ripe) | ✅ HAVE |
| `tilled` | `overhead.field.barren` (ploughed, no sprouts) | ✅ HAVE |
| `pasture-cows` | ❌ **Not usable as-is**: the game already draws the herd as separate cow sprites (`CattleHerds`), so baked-in cows would double up and misstate herd size. Needs a plain pasture tile. | redo |
| `castle` (standing) | Stand-in for the castle tiers | placeholder |
| `house-thatch`, `house-blue`, `barn` (standing) | Stand-ins for town, blacksmith, lumber mill | placeholder |
| `watchtower` (standing) | No key | spare |
| `water`, `shore` | Map border only (water is deferred) | ⏸ |
| `road-cross` | Dirt colour source for `art/road-sheet/` | used |
| `flagstone`, `bridge-wood`, `bridge-stone`, `wagon-tile` | No key today | spare |

**Found in update 2 — baked-in flags.** The castle, the blue house and the
watchtower fly blue flags painted into the art. The game draws the owner's
seat flag on top (`castleFlagArt`), so a baked blue flag is wrong for three of
the four seats. These are placeholders, so nothing to fix now — but the sheet 2
prompt (`art/CHATGPT_PROMPTS.md`) now asks for **no flags or banners on any
building**.

Still missing for the map: green-screen copies of the 9 approved canon
buildings (5 castle tiers, town, lumber mill, blacksmith, quarry) and the castle
yard ground. Everything else that was listed here came in the sheet-2 batch below.

## Sheet-2 batch (ChatGPT, Oct 15–17) — what was accepted

Made in ChatGPT from the uploaded Art Book with the reference scenes and canon
set as the style anchor (sheet 1 only for tile format — its grass is too lime).
Files: `art/review-s2/` (cut-outs and slabs) and `art/review-s2/_raw/` (as
delivered; the icons are used straight from here, on their navy square).
Standing objects were cut off solid green with `tools/greenkey.py`; every
cut-out scored under 2% in `check_cutout.py` and was checked on magenta.
Previews: `art/review-s2/_preview/`.

| File | Key | Notes |
|---|---|---|
| `fallow`, `sown`, `growing-wheat`, `parched`, `pasture` | `overhead.field.{fallow, grain.sown, grain.growing, parched, cattle}` | Raised slabs at the sheet angle. Earthier than sheet 1 and closer to the reference on the county mock-up. Pasture is plain (no cows). |
| `forest-floor` | `overhead.tile.forest` | Ground under trees. |
| `forest` | `overhead.sprite.forest` | Tree stand, cut off green. |
| `castle-yard`, `open-forge` | `overhead.sprite.castle-yard`, `.forge-open` | Labor screen. |
| `laborer-herder` | `overhead.sprite.laborer-herder` | Hood, apron, crook. |
| `laborer-farmer` | `overhead.sprite.laborer-farmer` | **Redone Oct 17**: straw hat, linen shirt, big scythe. The first try (`laborer-farmer-v1.png`, kept) was the same hooded man as the herder. The new one cuts clean (0.8%) and is clearly not the herder at 28 px on the phone. The scythe rises above his hat, so if Phase B fits laborers by height, his body comes out ~10% smaller than the herder's — fit by body, or accept it. |
| `mercenary` | `unit.mercenaries` | No grass base, unlike the canon troops; fine, because Phase B crops every roster troop to the figure. |
| `_raw/{grain, cattle, wood, iron-ore, stone, gold}` | `resource.{wheat, cows, wood, ore, stone, gold}` **and** `figma.resource.*` | One icon for both keys. Clear at the 45 px top bar (your check, Oct 15). |
| `_raw/{bow, crossbow, mace, pike}` | `resource.{bows, crossbows, maces, pikes}` | Navy background like the sword and helm. Pike and bow go thin below ~20 px; fine once lists use 24 px (Phase B). |

**Phase B change that came out of the small-size test (decided Oct 16):** icons
in lists go to at least 24 px, roster troops from 18 px to 28 px cropped to the
figure. On the S10e (≈3 screen pixels per CSS pixel) 16–18 px was too small
for any art, old or new. In `art/PHASE_B_PLAN.md`.

**Open from this batch:** the lawn. With the new fields in, sheet 1's lime lawn
is the odd one out on the mock-up. Plan: colour-match it toward the reference in
code (free, reversible), show you before/after; redraw only if that isn't
enough. Not done yet.

## Style rules (locked)

- 3D diorama style, warm soft light, the same camera angle for everything.
- **Map sprites (`overhead.*`) must be truly transparent** — no ground tile
  baked under them, because they sit on live terrain.
- **Panel icons (`unit.*`) may keep their baked ground tile** — they only
  show in the roster panel.
- Item icons (helm, weapons) sit on navy `#020A1F`, like the rest of the icon
  catalog.
- Everything this pass touches uses smooth rendering, not pixel-art rendering.
- **Moving sprites face the way they last moved:** two views each (toward and
  away from the camera), mirrored for the other two directions. On the diamond
  grid this is exact: toward = South (down-left), mirrored = East; away = West
  (up-left), mirrored = North.
- **Seat colours:** crimson `#C0392B`, azure `#2F6FD0`, gold `#E8C33A`,
  sable `#26262E`. Sable replaced verdigris (green was hard to tell from blue
  for colour-blind players, and from the green map).
- New art is generated against 2–3 locked reference images, never as a
  one-off prompt (style drift, Lessons Theme B).

---

## Terrain (20 keys) — UNREAD by the game

| Key | Status | Notes |
|---|---|---|
| terrain.open, terrain.forest, terrain.hills | ✅ HAVE | Cropped from the terrain tile batch (Sep 6). Not yet copied into `art/`. |
| terrain.chokepoint + 4 seasonal | 🚫 REMOVE | Chokepoint was never a tile: it's a map layout idea (one way into a county). Nothing but the manifest uses these keys. Delete in Phase B. |
| terrain.{open,forest,hills}.{spring,summer,autumn,winter} (12) | ⏸ DEFERRED | Seasonal art waits until after this pass. The code for it is ready. |

## Base tiles (20 `tile.*` UNREAD + 5 `overhead.tile.*` used)

**Diamond grid (Oct 11): every ground and field tile is remade**, from the
ChatGPT tile sheets (see "Sheet 1" above; sheet 2 for the rest). The Grok
texture tiles in `art/ground-iso/` are fallback only. Canon square-grid tiles
are reference only.

| Key | Status | Notes |
|---|---|---|
| tile.ground, tile.forest, tile.mountain | UNREAD | Moot: the map draws `overhead.tile.*`. |
| tile.water (+ seasonal) | ⏸ DEFERRED | Water is a map-border element only. |
| tile.* seasonal (16) | ⏸ DEFERRED | |
| overhead.tile.ground | ✅ HAVE | `art/tileset-grok/lawn-??.png`. Known bug: today the key points at a road tile through `aliasOf`; fix in Phase B. |
| overhead.tile.forest | ✅ HAVE | `art/review-s2/forest-floor.png` (sheet-2 batch). |
| overhead.tile.mountain | ✅ HAVE | Plain lawn under `overhead.sprite.mountain` (sheet 1 mountains are standing sprites). |
| overhead.tile.water | ⏸ DEFERRED | |
| overhead.tile.yard | 🚫 REMOVE | Was the ground under the forge on the old tile-built labor screen. The labor screen is now one painted backdrop, so nothing draws it. Dropped Oct 18; remove the key in Phase B. |

## Roads (16 keys) — done

| Key | Status | Notes |
|---|---|---|
| overhead.road.0–15 | ✅ HAVE (sheet angle, Oct 11) | `art/road-sheet/road-00..15.png`, 240 wide at the sheet's 1.55 ratio, tan dirt colour-matched to the sheet's own road tile. File number = mask (N=1 E=2 S=4 W=8). Made by `tools/roadgen_iso.py <dirt> <out> 240 1.55`: built square then projected — roads are flat, so the projection is exact and tiles join seamlessly. `art/road-iso/` (2:1, Grok colour) and `art/road/` (square) are superseded. |

Phase B: today's keys point at shuffled file names. Wire `road-sheet/road-NN.png`
by mask number.

## County border wall (no manifest key yet) — done

| Piece | Status | Notes |
|---|---|---|
| Diagonal run + post | ✅ HAVE (Oct 11, re-angled) | **Use `art/wall-sheet/`**: the run sheared to the sheet's 1.55 angle by `tools/wall_reangle.py` (vertical shear — stones stay upright, height unchanged); post unchanged. Sized to ~0.4x a soldier's height (one section per edge at 4 across); gap where a road crosses a border. Previews: `art/_preview/phone-border-wall.png`, `world-walls.png`. `art/wall-iso/` (2:1) and `art/wall/` (square) are superseded. Low dry-stone wall, cosmetic, one look all year. |

Phase B: add manifest keys for the two pieces. The wall is drawn today as
plain SVG lines in `CountyWalls`.

## Castles (5 `castle.*` UNREAD + 5 overhead + 4 flags)

| Key | Status | Notes |
|---|---|---|
| castle.{woodenPalisade, motteAndBailey, normanKeep, stoneCastle, royalCastle} | ✅ HAVE | The `4pjSa` file was a duplicate of the Norman keep. |
| overhead.castle.* (5) | ✅ HAVE (Oct 18) | Green-screen copies of the canon tiers, `art/review-s3/castle-{1-palisade, 2-motte-bailey, 3-norman-keep, 4-stone, 5-royal}.png` (raw in `_raw/`), all cut with no holes. Tier 3 is a square stone keep — Chris updated it to look more like a Norman keep (Oct 18), replacing the canon round-tower cluster. |
| overhead.castle.flag.0–3 | ✅ HAVE | `art/flag/flag-{crimson,azure,gold,sable}.png`, cut from the banner-bearers (Oct 7). Also drawn on player caravans; raise it above the canopy in Phase B. |

## Town (1 key)

| Key | Status | Notes |
|---|---|---|
| overhead.town | ✅ HAVE (Oct 18) | `art/review-s3/town.png`, green-screen copy of the canon village cluster. |

## Industry (8 `industry.*` UNREAD + 4 overhead + open forge)

| Key | Status | Notes |
|---|---|---|
| industry.{lumberMill, blacksmith, quarry}.idle / .working | UNREAD | Moot: the map draws `overhead.industry.*`, one image each — no idle/working pair needed. |
| industry.mine.idle / .working | UNREAD | |
| overhead.industry.mine | ✅ HAVE (Oct 18) | `art/review-s3/mine.png`: low grey outcrop, timber tunnel, rails, carts, no tower (redo of the too-big Oct 11 version). Size it at 0.85 tiles wide on the map and check it there. |
| overhead.industry.{blacksmith, quarry, lumberMill} | ✅ HAVE (Oct 18) | `art/review-s3/{blacksmith, quarry, lumber-mill}.png`. Lumber mill recut with a tighter green key (LOW 150 / HIGH 215) so its bright grass stays; the gaps between log piles are real. |

## Fields (6 `field.*` UNREAD + 6 overhead used)

| Key | Status | Notes |
|---|---|---|
| field.grain.growing | ✅ HAVE | Green wheat. |
| field.grain.mature, field.grain.sown, field.cattle | UNREAD | Moot: the map draws `overhead.field.*`. |
| field.barren | ✅ HAVE (furrowed dirt) | The code defines barren as bare dirt that must be reclaimed, and also draws it under half-sown crops and as the quarry pit floor. The furrowed tile fits. |
| field.fallow | UNREAD | Only the overhead key is drawn. |
| overhead.field.grain.mature | ✅ HAVE | Sheet 1 `wheat-a/b/c`. |
| overhead.field.barren | ✅ HAVE | Sheet 1 `tilled`. |
| overhead.field.fallow, .grain.sown, .grain.growing | ✅ HAVE | `art/review-s2/{fallow, sown, growing-wheat}.png` (sheet-2 batch). |
| overhead.field.parched *(new key)* | ✅ HAVE, key needed | `art/review-s2/parched.png`. Add the manifest key in Phase B. |
| overhead.field.cattle | ✅ HAVE | `art/review-s2/pasture.png`, plain grass; cows drawn on top. |

The code also builds keys for parched and flooded fields that don't exist in
the manifest (Lessons, sweep item 4). Decide: add art, or drop those states.

## Units (6 keys)

| Key | Status | Notes |
|---|---|---|
| unit.militia, unit.archers, unit.knights | ✅ HAVE | Canon `art/_canon/unit-*.jpg`, approved Oct 18. Phase B crops to the figure at 28 px. Knights: the plate-with-sword version. |
| unit.crossbowmen, unit.swordsmen, unit.macemen, unit.pikemen | ✅ HAVE, keys needed | Canon art approved Oct 18. Add the keys in Phase B (8 troop kinds, not 4). |
| unit.mercenaries | ✅ HAVE | `art/review-s2/mercenary.png` (sheet-2 batch). |
| unit.militia.knight, unit.knights.knight | 🚫 REMOVE | Faction overrides with no separate art; the base key is used instead. |
| *(siege ram image)* | — | No troop kind uses it. Kept for later. |

## Armies and wagons (map sprites)

| Key | Status | Notes |
|---|---|---|
| overhead.army.soldier | ✅ HAVE (fits diamond) | `art/army/soldier-toward.png`, `soldier-away.png`. |
| overhead.army.bearer.0–3 | ✅ HAVE | `art/army/bearer-{crimson,azure,gold,sable}-{toward,away}.png`. Flag flies sideways. |
| overhead.sprite.wagon | ✅ HAVE | `art/wagon/wagon-toward.png`, `wagon-away.png`. |
| sprite.merchantWagon, sprite.supplyWagon | ✅ HAVE | Both use the one wagon (your call: the flag tells them apart). No separate flagged wagon. |
| sprite.army.small / .medium / .large | UNREAD | Not used; armies are bearer + soldiers. |
| sprite.mercenaryOffer | UNREAD | |

## Banners and crests

| Key | Status | Notes |
|---|---|---|
| banner.crimson, banner.steel, banner.gold | ✅ HAVE | `art/banner/`. |
| banner.verdigris → banner.sable | ✅ HAVE | `art/banner/sable.png`. Phase B: rename the key and fix `BEST_NOBLE_BANNERS`. |
| crest.{knight, warden, merchant, steward} | UNREAD | Scenario's "Recraft V4.1 Pro SVG" model is built for crests (web app only). |
| Best Noble fleur-de-lis | ⚠️ DECISION | Still open. |

## Resources and items (12 + 6 figma + 1 equipment)

| Key | Status | Notes |
|---|---|---|
| resource.swords | ✅ HAVE | `art/icons/item_sword.png` (Oct 11 redo; the old one read as a dagger). |
| resource.{crossbows, maces, pikes} | ✅ HAVE | `art/review-s2/_raw/{crossbow, mace, pike}.png` (sheet-2 batch, navy). |
| resource.bows | ✅ HAVE | `art/review-s2/_raw/bow.png` (sheet-2 batch). The earlier "accepted" bow was never found. Known bug: key declared, file missing in the game; wire in Phase B. |
| resource.{wheat, cows, wood, ore, stone, gold} | ✅ HAVE | `art/review-s2/_raw/{grain, cattle, wood, iron-ore, stone, gold}.png` (sheet-2 batch). |
| figma.resource.* (6) | ✅ HAVE | Same six icons as above: one set for panels and the top bar. |
| resource.armor | ✅ HAVE | `art/icons/item_knight_helm.png`, a great helm matching the knight. This is the "Knight Armor" icon the player sees. |
| equipment.knightArmour | UNREAD | Never read by the game. |

## Laborers, livestock, props

| Key | Status | Notes |
|---|---|---|
| overhead.sprite.laborer-{farmer, herder} | ✅ HAVE | `art/review-s2/laborer-{farmer, herder}.png` (sheet-2 batch; farmer redone Oct 17). |
| overhead.sprite.laborer-{woodcutter, miner, blacksmith} | ✅ HAVE | Canon `art/_canon/labor-*.jpg`, approved Oct 18. Phase B crops to the figure. |
| overhead.sprite.laborer-idle | ✅ HAVE | `labor_unemployed.png` maps here. |
| *(new)* laborer-builder | ✅ HAVE, key needed | `labor_builder.png` is a new role (castle building). Add a key in Phase B. |
| overhead.sprite.cow | ✅ HAVE | `art/props/prop-cow.png`. (`sprite.cow` is UNREAD.) |
| overhead.sprite.ore-cart | ✅ HAVE | `art/props/prop-minecart.png`. |
| overhead.prop.{timber, graincart, barrels, spoil, sawhorse} | ✅ HAVE | `art/props/prop-{logs, cart, barrels, rubble, sawhorse}.png`. |
| overhead.sprite.castle-yard | ✅ HAVE | `art/review-s2/castle-yard.png` (sheet-2 batch). |
| overhead.sprite.forge-open | ✅ HAVE | `art/review-s2/open-forge.png` (sheet-2 batch). |
| overhead.sprite.mountain | ✅ HAVE | Sheet 1 `standing/mountain-a/b/c`. |
| overhead.sprite.forest | ✅ HAVE | `art/review-s2/forest.png` (sheet-2 batch). |

## UI kit (8 keys) — UNREAD by the game

| Key | Status | Notes |
|---|---|---|
| ui.waxStamp, appIcon, kit.panel, kit.button, kit.scroll, panelFrame, buttonPrimary, scrollHeader | ⏸ DEFERRED | Goes with the info-panel restyle, after you pick a direction. |

## Excluded — not canon

| Item | Why |
|---|---|
| Tavern | No key. Grok invented it. |
| `4pjSa` castle | Duplicate of the Norman keep. |
| `item_knight_plate_helm`, the mailed suit | Drifted back to plate armour. Replaced by `item_knight_helm`. |
| `land_plow` | Not needed. |
| `land_dirt_road`, `land_stone_road`, `land_border_wall` | Full scenes kept as style reference only, not tiles. |
| Flooded-field image | Matches no current key (see the Fields note). |

## Deferred on purpose

Seasonal art, water tiles, stone roads (need new road-material code first:
central counties stone, outskirts dirt — not decided), audio.

---

## Labor screen (decided Oct 18)

**Accepted backdrop:** `art/labor/labor-grid-chatgpt-1.png` (ChatGPT, 1024x1536):
a 2x4 grid of fenced compartments seen from overhead — Grain | Pasture,
Mine | Lumber, Forge | Repair, Village (idle) | Castle site. Chris picked
ChatGPT's grid over Grok's and over the organic-village layouts. The fences do
the separating, so no outer castle wall. Mock-up with overlays:
`art/_preview/labor-grid-overlay.png` (`tools/labor_overlay.py`, zones = the
fenced boxes, which are also the tap areas).

**Overlays the game draws (locked Oct 18):**
- Worker crowd per job: 1 figure per 10 workers, max 12, on the open ground of
  the compartment. **Figures 72 px tall on the 1024 px backdrop** (~24 CSS px
  on the S10e) — enlarged from 50 at Chris's request.
- Plate at the top of each compartment: job name + exact number. Red plate and
  **red glow** when short of workers (grain, cattle); blue plate and **blue
  glow** under the idle crowd in the village square; dark when empty.
- Pasture: **two cows in the right-hand corner**, decorative (not tied to herd
  size — Chris: six was too many).
- Stand-ins: miner, woodcutter and idle figures borrow the farmer/herder
  sprites until the canon figures are cut.

**Delivered Oct 18:** `art/labor/labor-quarry.png` and `labor-castle-1..5.png`.
Each edit also shifted the rest of the picture slightly (24–39% of changed
pixels fell outside the target lot), so the game takes **only the edited lot**
from each one and lays it on the base. `tools/labor_patch.py` does this with a
soft edge on the dirt path; no visible seam (checked on quarry + castle 4).
Mock-up: `art/_preview/labor-grid-overlay-quarry-castle4.png`. Later, for maps
that need them: empty-lot / no-lumber / no-forge edits.

**Plate wording when short (decided Oct 18, option B):** "Grain 90 (−23)" —
workers there plus the shortfall in brackets; same for Pasture. Options
compared in `art/_preview/labor-grain-plate-options.png`.

## Look: why the map read as "cartoony" (Oct 18)

Measured against `art/_reference/target-look-5-oct18.jpg`:
1. **Lawn too bright and lime** — fixed by the colour match (`lawnm-??`).
2. **No long cast shadows** — the reference's cows, wagons, castle and houses
   all throw soft shadows one way across the grass. Phase B: draw a soft,
   offset shadow under every standing sprite (added to the Phase B plan).
3. **Grass too smooth up close** — fixed with ChatGPT's grass texture (`lawngm-??`, accepted Oct 18).
4. **Lime fringes** — roads and bush clumps still carry thin strips of the old lime grass at their edges; colour-match them to the new lawn (Claude, to do).

**Roads:** Chris is considering going back to stone roads. Undecided; a stone
road texture prompt is ready in `CHATGPT_PROMPTS.md` and the 16 shapes rebuild
from it in one command.

## Scorecard (update 3, revised Oct 18 evening)

The Art Book (`art/ART_BOOK.pdf`) has a page per asset. Rebuild with
`tools/art_book.py`; counts are printed on its "How to read this" page.

- **Done:** every map asset in Phase A, including the 5 castle tiers, town,
  lumber mill, blacksmith, quarry and mine (green-screen batch, Oct 18), and
  the labor screen (base, quarry, 5 castle lots).
- **Decided Oct 18:** tier 3 is the square Norman keep.
- **Open:** lime grass fringes on roads and bushes (colour-match to the new lawn); stone vs dirt roads (Chris).
- **Code only (Phase B):** keys for parched, border wall, decoration, builder,
  crossbow/sword/mace/pike troops; the labor-screen overlays and lot patching.
- **Not started:** crests, mercenary offer (both unread keys today).
- **Being removed:** 5 chokepoint keys. **Dropped:** castle yard ground tile.

## Decisions only you can make

1. Best Noble fleur-de-lis.
2. Flooded fields: add art or drop the state? (Parched is in — it's in the target look.)
3. The 79 unread keys: delete from the manifest, or keep dormant? (Either way, no art for them this pass.)
4. ~~Zoom~~ — decided Oct 18: 4 across. Next: the ~270 px bake test on the S10e.
