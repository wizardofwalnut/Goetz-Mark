# Aldermarch — ChatGPT tile-sheet prompts

Run these in the **same ChatGPT chat** that made sheet 1, with
`art/tileset-grok/_src/sheet-1.png` attached as the locked reference. Staying in
one chat keeps the style consistent (Lessons, Theme B). If one tile comes out
wrong, ask ChatGPT to redo just that tile ("redo row 3, tile 2 with a taller
tower") rather than the whole sheet.

Claude cuts the sheet, checks each tile at true scale on a county mock-up, and
records what was accepted in `art/ART_BIBLE.md`.

## Sheet 2 (revised Oct 11, update 2)

Changes from the first draft (which lived only in chat):
- **Row 2 replaced.** The plain-grass row is done (lawn tiles from sheet 1).
  It now asks for a plain pasture and the two labor-screen buildings.
- **No flags anywhere.** Sheet 1's castle, blue house and watchtower fly
  painted blue flags; the game draws the owner's seat flag on top, so a
  painted flag is wrong for 3 of the 4 seats.
- **Pasture without animals.** The game draws the herd itself as separate cow
  sprites; cows painted into the tile would double up.
- **Sheep pen dropped** (no such building in the game).

```
Make a second sheet in EXACTLY the same format as the attached sheet: same isometric angle, same tile size, same raised slab with soil and stone sides, same lighting and style, 5 rows of 5 tiles on the same dark background, evenly spaced. Each tile is one separate square slab.

IMPORTANT for every tile: NO flags, banners or pennants anywhere, and NO animals or people.

Row 1 (fields): ploughed furrows with tiny green sprouts; fallow field of rough wild grass and weeds; parched field of pale cracked dry earth; green unripe wheat (same shape as the golden wheat tiles); plain bare dirt with no furrows.
Row 2 (farm and castle grounds): plain grazed pasture grass with a few worn patches (no animals, no fences); a second pasture variation; a small ring of stone wall around an EMPTY grass yard (castle bailey, nothing inside); an open-air forge (wooden canopy on posts, anvil, stone hearth, no walls); a stone well.
Row 3 (castle upgrades, smallest to largest): wooden palisade fort; motte and bailey (wooden tower on an earth mound); square stone keep; stone castle with walls and towers; large royal castle.
Row 4 (industry): lumber mill with log piles; blacksmith forge with chimney smoke; stone quarry pit; mine entrance in a rocky hillside; a woodcutter's stacked log pile.
Row 5 (land): dense forest; light woodland; rocky hills; village of 4 or 5 small houses close together with a well; larger town centre with a market square.
```

What each tile is for (Claude's side, not part of the prompt):

| Row | Tiles → keys |
|---|---|
| 1 | `overhead.field.grain.sown`, `.fallow`, `.parched` (new key), `.grain.growing`, spare dirt |
| 2 | `overhead.field.cattle` (+ variant), `overhead.sprite.castle-yard`, `overhead.sprite.forge-open`, well = decoration |
| 3 | `overhead.castle.*` (5 tiers, cut off their slab) |
| 4 | `overhead.industry.{lumberMill, blacksmith, quarry, mine}`, log pile = decoration |
| 5 | `overhead.tile.forest` / `overhead.sprite.forest`, light woodland = decoration, hills = spare, `overhead.town` (village), town centre = spare |


## Green-screen copies of the 9 approved canon buildings (Oct 18)

Attach the canon images from `art/_canon/`: castle-1..5, village-cluster,
industry-lumbermill, industry-blacksmith, industry-quarry. Then:

```
These nine buildings are already approved designs. Redraw each one as the SAME building — same shape, parts, materials, colours and camera angle — with only these changes:

1. Remove the square grass tile/slab it sits on, and its soil edges. The building stands directly on a SOLID flat #00FF00 green background. Keep only a thin strip of ground right at its foot.
2. Motte and bailey: keep the earth mound — it is part of the castle. Quarry: keep the pit and its rock rim — that IS the quarry.
3. No flags, banners or pennants anywhere. No people or animals.
4. Do not redesign, add or remove anything. This is a copy on a new background, not a new design.

Deliver nine separate files: castle-1-palisade.png, castle-2-motte-bailey.png, castle-3-norman-keep.png, castle-4-stone.png, castle-5-royal.png, town.png, lumber-mill.png, blacksmith.png, quarry.png. Do not clean up the green background.
```

## Castle yard ground — new tile (Oct 18)

Attach sheet 1 (for the slab format) and the approved fallow and sown tiles
(for the colours). Then:

```
Make one ground tile: the packed-earth work yard of a village forge.

- Trampled, hard-packed brown earth with a few flat stones, scattered ash and cinders, and thin worn patches of grass at the edges.
- Flat — nothing standing on it: no anvil, tools, barrels, people or buildings. The game places those on top.
- Same raised slab as the attached tiles: diamond about 1.55 wide to 1 tall, soil sides, on the same dark background. Same light and colours as the attached fallow and sown tiles, not the bright lime grass.
- It is laid in a 3x3 block, so no single feature in the middle and no strong pattern that would repeat visibly.

Deliver as castle-yard-ground.png.
```


## Mine — redo, lower and smaller (Oct 18)

Attach: the canon mine (`art/_canon/industry-mine.jpg`), today's mine
(`art/buildings/building-mine.png`) and one reference scene
(`art/_reference/target-look-hollowmere.jpg`). Then:

```
Redraw the mine. Today's mine (attached, tall wooden winding tower on a mound) is too big and too tall next to the fields and buildings. Use the attached canon mine as the design instead — a LOW, wide rocky outcrop with a timber-framed tunnel entrance cut into it, a short rail track coming out, one or two ore carts and a small pile of dark ore.

- Low and wide: about as tall as a cottage, no taller. No winding tower, no headframe, no crane.
- Grey, mossy rock like the rocky outcrops in the attached reference scene, with a few small bushes — not brown dirt.
- It must fit inside a 2x2 block of the same diamond tiles as the fields (diamond about 1.55 wide to 1 tall), seen from the same camera angle.
- SOLID flat #00FF00 green background. No square slab or tile under it — keep only a thin strip of ground at its foot.
- No people, no animals, no flags.

Deliver as mine.png. Do not clean up the green background.
```


## Labor screen — painted backdrop (Oct 18, revised: overhead camera)

Decided Oct 18: the labor screen is ONE painted village per county type, seen
from overhead like the LOTR2 labor panel (screenshots in
`art/_reference/labor-concepts/lotr2-labor-*.jpg`) — not the map's angled
diamond view. Layout follows LOTR2: mine/quarry, grain and cattle across the
top; forge and lumber on the left; idle peasants in the village square in the
middle; castle on the right. The game draws on top: worker crowds + the exact
number on a label, a red glow under a job short of workers, a blue glow under
the idle crowd. So the painting has NO people, NO labels and NO castle.

Images needed: (a) mine county, (b) quarry county — enough for the tutorial
(Hollowmere, Marlbrook: mine; Greyfen, Ravensgate: quarry; all have lumber and
forge). (c) 5 castle-site edits, one per castle tier. Later, for maps that
need them: the mine/quarry lot empty, no lumber mill, no forge.

Attach: the four LOTR2 screenshots, concept 6 (`concept-6-topdown-framed.jpg`),
and the Hollowmere target-look scene (for colours and materials). Then:

```
Paint the labor screen for a medieval county-management game. It is a fresh painting in the warm, detailed, painted style and colours of the attached Hollowmere scene, laid out like the attached Lords of the Realm II labor screens: one county village seen from almost directly overhead (a high, steep view — rooftops and the tops of walls visible, only a little of building sides). Portrait format for a phone, 2:3 (taller than wide). Fill the whole frame with land, edge to edge — no border, no frame, no floating platform.

Eight clearly separate work areas, each with its own ground and edged by dirt paths, low stone walls, fences or hedges, so no two areas blur together:
- Top row, left to right: (1) iron mine — a low grey rock outcrop with a timber tunnel mouth, ore carts and spoil; (2) grain field — golden wheat in rows; (3) cattle pasture — green grass inside a wooden fence.
- Middle: (4) open-air forge on the left — anvil, glowing hearth, under a small roof; (5) the village in the centre — four or five thatched and timber houses around an open earth square; (6) castle site on the right — an EMPTY, flat, cleared square of packed earth with stakes and a few building stones at its edges, about a third of the picture's width and height. No castle on it.
- Bottom: (7) lumber mill on the left — a sawmill shed at the edge of trees with log piles; (8) repair yard in the middle — bare earth with stacked timber and a sawhorse.

Every area must keep a clear, empty patch of ground big enough for a crowd of about 12 small figures; the village square needs the biggest one.
No people, no animals, no flags, no text, no labels, no numbers, no UI.
Deliver as labor-mine.png.
```

Then, in the same chat:

```
Make labor-quarry.png: the SAME image, identical in every other way, except replace the iron mine (area 1) with a stone quarry — a stepped grey stone pit with cut blocks and a small wooden crane, same size and position.
```

```
Make five more copies of labor-mine.png, identical except for the castle site (area 6), which now has a castle on it, seen from the same overhead view and filling the site: castle-1 a timber palisade with a hut inside; castle-2 a wooden tower on an earth mound inside a palisade (motte and bailey); castle-3 a square stone keep; castle-4 a stone castle with curtain walls and round towers; castle-5 a large royal castle with double walls and a gatehouse. Match the attached canon castles' designs. No flags. Deliver labor-castle-1.png to labor-castle-5.png.
```
