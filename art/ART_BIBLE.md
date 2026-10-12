# Aldermarch — Art Bible

**Version:** Oct 11, 2026, update 2 (replaces the Oct 6 version). Update 2
reconciles the Oct 11 changes: grid ratio, zoom, sheet 1, and the art that
was accepted Oct 11 but still listed as missing in the key tables below.
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
- **Zoom:** not locked yet — see "Zoom and bake resolution". Fields are
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

## Zoom and bake resolution — OPEN (your decision)

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
| overhead.tile.ground | `ground-meadow-??.png` |
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
| `bushes`, `rocks` (standing) | Decoration layer; bushes stand in for forest | ✅ decor, placeholder forest |
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

Still missing for the map: forest, the 5 castle tiers, town, lumber mill,
blacksmith, quarry, plain pasture, growing and sown wheat, fallow, parched
(all in sheet 2), castle yard, open forge, mercenary unit.

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
| overhead.tile.forest | ❌ MISSING | Forest tile is in sheet 2; bushes stand in. |
| overhead.tile.mountain | ✅ HAVE | Plain lawn under `overhead.sprite.mountain` (sheet 1 mountains are standing sprites). |
| overhead.tile.water | ⏸ DEFERRED | |
| overhead.tile.yard | ❌ MISSING | Check the canon zip first. |

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
| overhead.castle.* (5) | ❌ MISSING (sheet 2) | Sheet 2 row 3 asks for all 5 tiers in the sheet style, cut off their slab like sheet 1's castle (one stand-in today). The canon renders are a different style now. |
| overhead.castle.flag.0–3 | ✅ HAVE | `art/flag/flag-{crimson,azure,gold,sable}.png`, cut from the banner-bearers (Oct 7). Also drawn on player caravans; raise it above the canopy in Phase B. |

## Town (1 key)

| Key | Status | Notes |
|---|---|---|
| overhead.town | ❌ MISSING (sheet 2) | Village cluster (decided Oct 7). Sheet 2 row 5; `house-thatch` stands in. |

## Industry (8 `industry.*` UNREAD + 4 overhead + open forge)

| Key | Status | Notes |
|---|---|---|
| industry.{lumberMill, blacksmith, quarry}.idle / .working | UNREAD | Moot: the map draws `overhead.industry.*`, one image each — no idle/working pair needed. |
| industry.mine.idle / .working | UNREAD | |
| overhead.industry.mine | ✅ HAVE | `art/buildings/building-mine.png` (green pack, Oct 11). Check it beside sheet 2's mine; keep whichever matches the sheet. |
| overhead.industry.{blacksmith, quarry, lumberMill} | ❌ MISSING (sheet 2) | Sheet 2 row 4. Barn and blue house stand in. |

## Fields (6 `field.*` UNREAD + 6 overhead used)

| Key | Status | Notes |
|---|---|---|
| field.grain.growing | ✅ HAVE | Green wheat. |
| field.grain.mature, field.grain.sown, field.cattle | UNREAD | Moot: the map draws `overhead.field.*`. |
| field.barren | ✅ HAVE (furrowed dirt) | The code defines barren as bare dirt that must be reclaimed, and also draws it under half-sown crops and as the quarry pit floor. The furrowed tile fits. |
| field.fallow | UNREAD | Only the overhead key is drawn. |
| overhead.field.grain.mature | ✅ HAVE | Sheet 1 `wheat-a/b/c`. |
| overhead.field.barren | ✅ HAVE | Sheet 1 `tilled`. |
| overhead.field.fallow, .grain.sown, .grain.growing, .parched *(new key)* | ❌ MISSING (sheet 2) | Sheet 2 row 1. Grok fallbacks exist in `art/ground-iso/` (2:1). |
| overhead.field.cattle | ❌ MISSING (sheet 2) | Plain pasture, no animals — see the `pasture-cows` note above. |

The code also builds keys for parched and flooded fields that don't exist in
the manifest (Lessons, sweep item 4). Decide: add art, or drop those states.

## Units (6 keys)

| Key | Status | Notes |
|---|---|---|
| unit.militia, unit.archers, unit.knights | ⚠️ CHECK | Mapped by name (militia, archer, mounted knight with sword). Files are in the canon zip; check at 18 px. |
| unit.crossbowmen, unit.swordsmen, unit.macemen, unit.pikemen | ⚠️ NEW KEYS | The game has 8 troop kinds, not 4. Images exist (crossbow, swordsman, maceman, pikeman); add keys in Phase B. |
| unit.mercenaries | ❌ MISSING | No image. |
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
| resource.{crossbows, maces, pikes} | ⚠️ CHECK | Generated directly (decided Sep 4), not cropped. Check against the keys once the canon zip is here. |
| resource.bows | ⚠️ CHECK | Bow was accepted earlier but the file is **not in `art/icons/`** (checked update 2). Find it in the canon zip / earlier batch and add it. Known bug: key declared, file missing; wire in Phase B. |
| resource.{wheat, cows, wood, ore, stone, gold} | ❌ MISSING | |
| figma.resource.* (6) | ❌ MISSING | HUD versions; confirm style before making. |
| resource.armor | ✅ HAVE | `art/icons/item_knight_helm.png`, a great helm matching the knight. This is the "Knight Armor" icon the player sees. |
| equipment.knightArmour | UNREAD | Never read by the game. |

## Laborers, livestock, props

| Key | Status | Notes |
|---|---|---|
| overhead.sprite.laborer-{farmer, herder, woodcutter, miner, blacksmith} | ✅ HAVE | From the 44 canon assets. Not yet in `art/`. |
| overhead.sprite.laborer-idle | ✅ HAVE | `labor_unemployed.png` maps here. |
| *(new)* laborer-builder | ✅ HAVE, key needed | `labor_builder.png` is a new role (castle building). Add a key in Phase B. |
| overhead.sprite.cow | ✅ HAVE | `art/props/prop-cow.png`. (`sprite.cow` is UNREAD.) |
| overhead.sprite.ore-cart | ✅ HAVE | `art/props/prop-minecart.png`. |
| overhead.prop.{timber, graincart, barrels, spoil, sawhorse} | ✅ HAVE | `art/props/prop-{logs, cart, barrels, rubble, sawhorse}.png`. |
| overhead.sprite.castle-yard | ❌ MISSING | Wall ring with an empty yard (labor screen). In the sheet 2 prompt. |
| overhead.sprite.forge-open | ❌ MISSING | Canopy, anvil, hearth, no walls. In the sheet 2 prompt. |
| overhead.sprite.mountain | ✅ HAVE | Sheet 1 `standing/mountain-a/b/c`. |
| overhead.sprite.forest | ❌ MISSING (sheet 2) | Bushes stand in. |

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

## Scorecard (update 2)

- **Done:** roads (16, sheet angle), border wall (sheet angle), lawn, mountains,
  ripe wheat, barren field, army soldier + 4 bearers, wagon, banners (4),
  castle flags (4), knight helm, sword, props (5) + cow + ore cart, mine.
- **Waiting on ChatGPT sheet 2:** 5 castle tiers, town, lumber mill,
  blacksmith, quarry, forest, castle yard, open forge, fields (fallow, sown,
  growing, parched, plain pasture).
- **Canon set found (Oct 12)** in Downloads, now in `art/_canon/` (see its
  README): all 8 troop icons, 5 laborers + builder, castle tiers, industry,
  village. To do: check each at game size and accept. **Not found anywhere:**
  farmer and herder laborers, bow / crossbow / mace / pike icons, a diorama
  mercenary (the game has an old pixel one). Every asset has a page with a
  picture in `art/ART_BOOK.pdf`.
- **Not started:** resource icons (wheat, cows, wood, ore, stone, gold),
  crests, mercenary offer.
- **Being removed:** 5 chokepoint keys.

## Decisions only you can make

1. Best Noble fleur-de-lis.
2. Flooded fields: add art or drop the state? (Parched is in — it's in the target look.)
3. The 79 unread keys: delete from the manifest, or keep dormant? (Either way, no art for them this pass.)
4. **Zoom: 4 or 7 tiles across** (recommended 4 — see "Zoom and bake
   resolution"). This one blocks the bake test and Phase B step 1.
