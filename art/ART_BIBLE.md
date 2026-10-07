# Aldermarch — Art Bible

**Version:** Oct 6, 2026 (replaces the Sep 5 version).
**What this is:** every art key in the game's manifest, with its status and
where the art lives. Checked against the live game file on GitHub
(`aldermarch-single-file/aldermarch-game.html`): **172 manifest keys** (the
Sep 5 count of 162 missed 10 keys with hyphens in their names — laborers,
castle yard, open forge, ore cart).

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
  away from the camera), mirrored for the other two directions.
- **Seat colours:** crimson `#C0392B`, azure `#2F6FD0`, gold `#E8C33A`,
  sable `#26262E`. Sable replaced verdigris (green was hard to tell from blue
  for colour-blind players, and from the green map).
- New art is generated against 2–3 locked reference images, never as a
  one-off prompt (style drift, Lessons Theme B).

---

## Terrain (20 keys)

| Key | Status | Notes |
|---|---|---|
| terrain.open, terrain.forest, terrain.hills | ✅ HAVE | Cropped from the terrain tile batch (Sep 6). Not yet copied into `art/`. |
| terrain.chokepoint + 4 seasonal | 🚫 REMOVE | Chokepoint was never a tile: it's a map layout idea (one way into a county). Nothing but the manifest uses these keys. Delete in Phase B. |
| terrain.{open,forest,hills}.{spring,summer,autumn,winter} (12) | ⏸ DEFERRED | Seasonal art waits until after this pass. The code for it is ready. |

## Base tiles (20 `tile.*` + 5 `overhead.tile.*`)

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
| overhead.road.0–15 | ✅ HAVE | `art/road/road-00..15.png`. File number = mask (N=1 E=2 S=4 W=8). Made by `tools/roadgen.py` from one Grok dirt texture; works on every season's ground. |

Phase B: today's keys point at shuffled file names. Wire `road-NN.png` by
mask number.

## County border wall (no manifest key yet) — done

| Piece | Status | Notes |
|---|---|---|
| Left-right run, front-back run, post | ✅ HAVE | `art/wall/`. Low dry-stone wall, cosmetic only, one look all year. |

Phase B: add manifest keys for the three pieces. The wall is drawn today as
plain SVG lines in `CountyWalls`.

## Castles (5 keys + 5 overhead + 4 flags)

| Key | Status | Notes |
|---|---|---|
| castle.{woodenPalisade, motteAndBailey, normanKeep, stoneCastle, royalCastle} | ✅ HAVE | The `4pjSa` file was a duplicate of the Norman keep. |
| overhead.castle.* (5) | ⚠️ CHECK | Need transparent versions. The `canon_no_tile` batch may cover them; list exactly once the canon zip is attached. |
| overhead.castle.flag.0–3 | ✅ HAVE | `art/flag/flag-{crimson,azure,gold,sable}.png`, cut from the banner-bearers (Oct 7). Also drawn on player caravans; raise it above the canopy in Phase B. |

## Town (1 key)

| Key | Status | Notes |
|---|---|---|
| overhead.town | ⚠️ DECISION | Open: `building_town_center` or `village_cluster` (maybe village for small counties, town center for large). |

## Industry (8 keys + 4 overhead + open forge)

| Key | Status | Notes |
|---|---|---|
| industry.lumberMill.idle / .working | ⚠️ CHECK | One image. Which state, and is the other needed? |
| industry.blacksmith.idle / .working | ⚠️ CHECK | Same question. |
| industry.quarry.idle / .working | ⚠️ CHECK | The image is a pit landscape, not a building like the others. |
| industry.mine.idle / .working | ❌ MISSING | |
| overhead.industry.{blacksmith, mine, quarry, lumberMill} | ⚠️ CHECK | Second-pass transparent renders, list pending the zip. |
| overhead.sprite.forge-open | ⚠️ CHECK | Not in the Sep 5 bible. |

## Fields (6 keys + 6 overhead)

| Key | Status | Notes |
|---|---|---|
| field.grain.growing | ✅ HAVE | Green wheat. |
| field.grain.mature, field.grain.sown, field.cattle | ⚠️ CHECK | Likely matches, not confirmed. |
| field.barren | ✅ HAVE (furrowed dirt) | The code defines barren as bare dirt that must be reclaimed, and also draws it under half-sown crops and as the quarry pit floor. The furrowed tile fits. |
| field.fallow | ❌ MISSING | Code defines fallow as wild grass (unused, plantable). Needs a grassy unplanted field tile. |
| overhead.field.* (6) | ⚠️ CHECK | Transparent second pass, pending the zip. |

The code also builds keys for parched and flooded fields that don't exist in
the manifest (Lessons, sweep item 4). Decide: add art, or drop those states.

## Units (6 keys)

| Key | Status | Notes |
|---|---|---|
| unit.militia, unit.archers, unit.knights, unit.mercenaries, unit.militia.knight, unit.knights.knight | ⚠️ CHECK | 8 images for 6 keys: pikeman, militia, archer, crossbow, swordsman, maceman, siege ram, mounted knight. Mapping needs the canon zip. The knight's spear was swapped to a sword with Scenario (Flux Kontext). |

## Armies and wagons (map sprites)

| Key | Status | Notes |
|---|---|---|
| overhead.army.soldier | ✅ HAVE | `art/army/soldier-toward.png`, `soldier-away.png`. |
| overhead.army.bearer.0–3 | ✅ HAVE | `art/army/bearer-{crimson,azure,gold,sable}-{toward,away}.png`. Flag flies sideways. |
| overhead.sprite.wagon | ✅ HAVE | `art/wagon/wagon-toward.png`, `wagon-away.png`. |
| sprite.merchantWagon, sprite.supplyWagon | ✅ HAVE | Both use the one wagon (your call: the flag tells them apart). No separate flagged wagon. |
| sprite.army.small / .medium / .large | ❌ MISSING | Check whether these are still used now that armies are bearer + soldiers. |
| sprite.mercenaryOffer | ❌ MISSING | |

## Banners and crests

| Key | Status | Notes |
|---|---|---|
| banner.crimson, banner.steel, banner.gold | ✅ HAVE | `art/banner/`. |
| banner.verdigris → banner.sable | ✅ HAVE | `art/banner/sable.png`. Phase B: rename the key and fix `BEST_NOBLE_BANNERS`. |
| crest.{knight, warden, merchant, steward} | ❌ MISSING | Scenario's "Recraft V4.1 Pro SVG" model is built for crests (web app only). |
| Best Noble fleur-de-lis | ⚠️ DECISION | Still open. |

## Resources and items (12 + 6 figma + 1 equipment)

| Key | Status | Notes |
|---|---|---|
| resource.{swords, bows, crossbows, maces, pikes, armor} | ⚠️ CHECK | Generated directly (decided Sep 4), not cropped. Bow is accepted. The sword reads like a dagger: redo. Check the rest against the keys once the zip is here. |
| resource.bows | ⚠️ CHECK | Known bug: key declared, file missing. The art exists now; wire it in Phase B. |
| resource.{wheat, cows, wood, ore, stone, gold} | ❌ MISSING | |
| figma.resource.* (6) | ❌ MISSING | HUD versions; confirm style before making. |
| equipment.knightArmour | ✅ HAVE (confirm key) | `art/icons/item_knight_helm.png`, a great helm matching the knight. Replaces `item_knight_plate_helm`. |

## Laborers, livestock, props

| Key | Status | Notes |
|---|---|---|
| overhead.sprite.laborer-{farmer, herder, woodcutter, miner, blacksmith} | ✅ HAVE | From the 44 canon assets. Not yet in `art/`. |
| overhead.sprite.laborer-idle | ✅ HAVE | `labor_unemployed.png` maps here. |
| *(new)* laborer-builder | ✅ HAVE, key needed | `labor_builder.png` is a new role (castle building). Add a key in Phase B. |
| sprite.cow, overhead.sprite.cow | ❌ MISSING | |
| overhead.sprite.ore-cart, overhead.prop.{timber, graincart, barrels, spoil, sawhorse} | ❌ MISSING | |
| overhead.sprite.castle-yard | ❌ MISSING | |
| overhead.sprite.mountain, overhead.sprite.forest | ⚠️ CHECK | Not in the Sep 5 bible. |

## UI kit (8 keys)

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

1. Bake resolution (64px was not good enough on the S10e).
2. Best Noble fleur-de-lis.
3. Town: `building_town_center`, `village_cluster`, or both by county size.
4. Parched/flooded fields: add art or drop the states?
5. Industry: do idle and working need different art?
