# Aldermarch — Art Bible

**Version:** Oct 6, 2026 (replaces the Sep 5 version).
**What this is:** every art key in the game's manifest, with its status and
where the art lives. Checked against the live game file on GitHub
(`aldermarch-single-file/aldermarch-game.html`): **171 manifest keys** (the
Sep 5 count of 162 missed 9 keys with hyphens in their names — laborers,
castle yard, open forge, ore cart).

**Important (Oct 7):** 79 of the 171 keys are never read by the game code
(`terrain.*`, `tile.*`, `castle.*`, `industry.*`, `field.*`, `sprite.*`,
`crest.*`, `ui.*`, `equipment.*`). Art for those would never appear. See
`PHASE_B_PLAN.md` — the rows below are marked **UNREAD** where this applies.

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
- **Zoom:** about 7 tiles across the phone, same as today (revised Oct 11 —
  see "Zoom and bake resolution"). Fields are groups of tiles that join
  seamlessly into big blocks.
- **Chunky diorama tiles:** each tile reads as a raised slab with soil showing
  on its front edge; rich texture (wheat stalks, furrows, cracked earth).
- **Small figures on big tiles:** soldiers, horses, cows and wagons are small
  next to a field, so the land dominates.
- **Warm, soft light; saturated but natural colour.**
- **Diamond (isometric) grid** — decided Oct 11, replacing the Oct 7
  "square grid" call. Tiles are 2:1 diamonds, like the reference. Screen
  directions: North = up-right, East = down-right, South = down-left,
  West = up-left. Game logic stays in grid coordinates; only drawing,
  tapping and depth order change (see `PHASE_B_PLAN.md`).
- From the reference: the **parched field** (cracked earth) is in; the
  **town is a village cluster** (several houses).

## Zoom and bake resolution (revised Oct 11)

**About 7 tiles across the phone (today's zoom), bake 160 px per tile**
(diamond width; height 80). Oct 7 said ~4 across / 288, which assumed each
field in the reference is one tile. It isn't: overlaying the diamond grid on
the reference (`art/_reference/zoom-grid-compare.png`) shows fields are
blocks of several tiles, and at 7 across the castle is ~1.5 tiles and the
village ~2 — the sizes the game already uses (castle 1.5, town 1.9). So the
reference look is today's zoom with bigger, joined fields.

At 7 across the S10e shows ~154 real px per tile; the Oct 7 test showed 160
is sharp and anything above adds nothing. Memory is fine (single-county
bake still recommended). Roads and ground tiles were built at 288; their
sources are kept, so they are rebuilt at 160 with the same tools
(`roadgen_iso.py ... 160`, `groundgen_iso.py ... 160 - 2`).
## Oct 11 art packs — what was accepted

**Ground and field tiles** (`art/ground-iso/`, 288x179 diamonds with soil edge,
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

**Wall** (`art/wall-iso/`, green pack, replaces the square-grid `art/wall/`
kit): `wall-run.png` runs lower-left to upper-right (25.7° vs the tiles'
26.6° — not visible); the up-left edges use it mirrored. `wall-post.png` at
every vertex. Placement tested (`_preview.png`): **two sections per tile
edge** (one full-length section stands as tall as a soldier; two halves give
the knee-to-waist height), each scaled so its width ≈ edge width / 2 / 0.88
so neighbours overlap a little (at /0.93 a slit showed at the midpoint);
post height ≈ 1.25x the wall's face. Known nit: the mirrored run's light comes
from the wrong side — fine at map size.

**Icon:** `art/icons/item_sword.png` → `resource.swords` (navy #020A1F).

Still missing for the map: mountain ground tile, overhead castles / town /
other industry buildings (canon zip), mercenary unit.

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

**Diamond grid (Oct 11): every ground and field tile is remade.** Flat ones
(grass, forest floor, fallow, barren, sown, parched, pasture) come from a
seamless Grok texture run through `tools/groundgen_iso.py` (exact 2:1
diamond, soil edge, no seams — tested with stand-in textures,
`art/road-iso/_preview-ground.png`). Wheat (growing, ripe) is rendered as
diamonds directly. Prompts: `GROK_PROMPTS.md` §3 and §3b. Canon square-grid
tiles are reference only.

| Key | Status | Notes |
|---|---|---|
| tile.ground, tile.forest, tile.mountain | ⚠️ CHECK | Still open: same art as `terrain.*` or separate? |
| tile.water (+ seasonal) | ⏸ DEFERRED | Water is a map-border element only. |
| tile.* seasonal (16) | ⏸ DEFERRED | |
| overhead.tile.ground | ⚠️ CHECK | Known bug: points at a road tile through `aliasOf`. Fix in Phase B. |
| overhead.tile.forest, overhead.tile.mountain | ⚠️ CHECK | |
| overhead.tile.water | ⏸ DEFERRED | |
| overhead.tile.yard | ❌ MISSING | Check the canon zip first. |

## Roads (16 keys) — done

| Key | Status | Notes |
|---|---|---|
| overhead.road.0–15 | ✅ HAVE (diamond) | `art/road-iso/road-00..15.png`, 288x144 diamonds. File number = mask (N=1 E=2 S=4 W=8). Made by `tools/roadgen_iso.py`: the same Grok dirt texture, built square then projected — roads are flat, so the projection is exact and tiles still join seamlessly (`_preview.png`). The square set in `art/road/` is superseded. |

Phase B: today's keys point at shuffled file names. Wire `road-iso/road-NN.png`
by mask number.

## County border wall (no manifest key yet) — done

| Piece | Status | Notes |
|---|---|---|
| Diagonal run + post | ✅ HAVE (Oct 11) | `art/wall-iso/` — see "Oct 11 art packs". Old row: | The `art/wall/` kit was drawn for the square grid. On diamonds, both edge directions are mirror images, so the new kit is just ONE diagonal run + the post (prompt in `GROK_PROMPTS.md`). Same look: low dry-stone wall, cosmetic, one look all year. |

Phase B: add manifest keys for the two pieces. The wall is drawn today as
plain SVG lines in `CountyWalls`.

## Castles (5 `castle.*` UNREAD + 5 overhead + 4 flags)

| Key | Status | Notes |
|---|---|---|
| castle.{woodenPalisade, motteAndBailey, normanKeep, stoneCastle, royalCastle} | ✅ HAVE | The `4pjSa` file was a duplicate of the Norman keep. |
| overhead.castle.* (5) | ⚠️ CHECK | Need transparent versions. The `canon_no_tile` batch may cover them; list exactly once the canon zip is attached. |
| overhead.castle.flag.0–3 | ✅ HAVE | `art/flag/flag-{crimson,azure,gold,sable}.png`, cut from the banner-bearers (Oct 7). Also drawn on player caravans; raise it above the canopy in Phase B. |

## Town (1 key)

| Key | Status | Notes |
|---|---|---|
| overhead.town | ⚠️ CHECK | Village cluster (decided Oct 7 from the target look). Use the canon `village_cluster` image. |

## Industry (8 `industry.*` UNREAD + 4 overhead + open forge)

| Key | Status | Notes |
|---|---|---|
| industry.lumberMill.idle / .working | ⚠️ CHECK | One image. Which state, and is the other needed? |
| industry.blacksmith.idle / .working | ⚠️ CHECK | Same question. |
| industry.quarry.idle / .working | ⚠️ CHECK | The image is a pit landscape, not a building like the others. |
| industry.mine.idle / .working | ❌ MISSING | |
| overhead.industry.{blacksmith, mine, quarry, lumberMill} | ⚠️ CHECK | Second-pass transparent renders, list pending the zip. |
| overhead.sprite.forge-open | ⚠️ CHECK | Not in the Sep 5 bible. |

## Fields (6 `field.*` UNREAD + 6 overhead used)

| Key | Status | Notes |
|---|---|---|
| field.grain.growing | ✅ HAVE | Green wheat. |
| field.grain.mature, field.grain.sown, field.cattle | ⚠️ CHECK | Likely matches, not confirmed. |
| field.barren | ✅ HAVE (furrowed dirt) | The code defines barren as bare dirt that must be reclaimed, and also draws it under half-sown crops and as the quarry pit floor. The furrowed tile fits. |
| field.fallow / overhead.field.fallow | ❌ MISSING | Wild grass (unused, plantable). Prompt in `GROK_PROMPTS.md`; only the overhead key is drawn. |
| overhead.field.* (6) | ⚠️ CHECK | Transparent second pass, pending the zip. |

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
| resource.{swords, bows, crossbows, maces, pikes, armor} | ⚠️ CHECK | Generated directly (decided Sep 4), not cropped. Bow is accepted. The sword reads like a dagger: redo. Check the rest against the keys once the zip is here. |
| resource.bows | ⚠️ CHECK | Known bug: key declared, file missing. The art exists now; wire it in Phase B. |
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
| overhead.sprite.cow | ❌ MISSING | Prompt in `GROK_PROMPTS.md`. (`sprite.cow` is UNREAD.) |
| overhead.sprite.ore-cart, overhead.prop.{timber, graincart, barrels, spoil, sawhorse} | ❌ MISSING | |
| overhead.sprite.castle-yard | ❌ MISSING | |
| overhead.sprite.mountain, overhead.sprite.forest | ⚠️ CHECK | Not in the Sep 5 bible. |

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

## Scorecard

- **Done:** castles (5), roads (16), wall kit, army soldier + 4 bearers, wagon (3 keys), banners (4), castle flags (4), knight helm, barren field, laborers (6 + builder), terrain open/forest/hills.
- **Waiting on the canon zip:** unit mapping, every `overhead.*` second pass, weapon icon check, props/cow/yard.
- **Not started:** crests, fallow field, mine, resource icons, mercenary offer.
- **Being removed:** 5 chokepoint keys.

## Decisions only you can make

1. Best Noble fleur-de-lis.
2. Flooded fields: add art or drop the state? (Parched is in — it's in the target look.)
3. The 79 unread keys: delete from the manifest, or keep dormant? (Either way, no art for them this pass.)
