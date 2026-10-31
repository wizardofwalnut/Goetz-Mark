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
Paint the labor screen for a medieval county-management game. It is a fresh painting in the warm, detailed, painted style and colours of the attached Hollowmere scene, laid out like the attached Lords of the Realm II labor screens: one county village seen from almost directly overhead (a high, steep view — rooftops and the tops of walls visible, only a little of building sides). Portrait format for a phone, 2:3 (taller than wide). Fill the whole frame, edge to edge — no floating platform. The whole village sits inside a low grey stone curtain wall with round corner towers that runs just inside the picture's edges, like the attached walled concept; a little grass shows outside the wall.

Lay it out as a tidy GRID like the attached walled concept: rectangular compartments in rows and columns, divided by straight dirt paths and low walls meeting at right angles — not a winding, organic village with curving lanes.

Eight clearly separate work areas, each its own compartment with its own ground, so no two areas blur together:
- Top row, left to right: (1) iron mine — a low grey rock outcrop with a timber tunnel mouth, ore carts and spoil; (2) grain field — golden wheat in rows; (3) cattle pasture — green grass inside a wooden fence.
- Middle: (4) open-air forge on the left — anvil, glowing hearth, under a small roof; (5) the village in the centre — four or five thatched and timber houses around an open earth square; (6) castle site on the right — an EMPTY, flat, cleared square of packed earth with stakes and a few building stones at its edges, about a third of the picture's width and height. No castle on it.
- Bottom: (7) lumber mill on the left — a sawmill shed at the edge of trees with log piles; (8) repair yard in the middle — bare earth with stacked timber and a sawhorse.

Every area must keep a clear, empty patch of ground big enough for a crowd of about 12 small figures; the village square needs the biggest one.
No people, no animals, no flags, no text, no labels, no numbers, no UI.
Make THREE variations that keep the grid, the same eight areas and the outer wall but vary the compartment sizes and where the paths run, so we can compare which reads best. Deliver as labor-mine-a.png, labor-mine-b.png, labor-mine-c.png.
```

Once one variation is picked, rename it labor-mine.png and continue in the same chat:

```
Make labor-quarry.png: the SAME image, identical in every other way, except replace the iron mine (area 1) with a stone quarry — a stepped grey stone pit with cut blocks and a small wooden crane, same size and position.
```

```
Make five more copies of labor-mine.png, identical except for the castle site (area 6), which now has a castle on it, seen from the same overhead view and filling the site: castle-1 a timber palisade with a hut inside; castle-2 a wooden tower on an earth mound inside a palisade (motte and bailey); castle-3 a square stone keep; castle-4 a stone castle with curtain walls and round towers; castle-5 a large royal castle with double walls and a gatehouse. Match the attached canon castles' designs. No flags. Deliver labor-castle-1.png to labor-castle-5.png.
```


## Labor screen — follow-ups on the accepted grid backdrop (Oct 18)

Attach `art/labor/labor-grid-chatgpt-1.png` (and, for the castles, the five
canon castles). The accepted backdrop replaces the earlier walled prompt above.

```
Make labor-quarry.png: the SAME image, identical in every other way, except the mine compartment (second row, left): replace the rock outcrop, tunnel, rails and ore carts with a stone quarry — a stepped grey stone pit with cut blocks and a small wooden crane. Keep the same fence, the same size, and an open patch of grey ground at the front for workers to stand on. No people, no text.
```

```
Make five copies of the attached image, identical in every way except the castle site (bottom row, right). In each, a castle stands on that site, seen from the same high overhead view, filling the fenced square but leaving a strip of open ground at the front for workers to stand on. Match the attached canon castles' designs: castle-1 a timber palisade with a hut inside; castle-2 a wooden tower on an earth mound inside a palisade; castle-3 a square stone keep; castle-4 a stone castle with curtain walls and round towers; castle-5 a large royal castle with double walls and a gatehouse. Keep the fence. No flags, no people, no text. Deliver labor-castle-1.png to labor-castle-5.png.
```


## Grass texture — finer lawn (Oct 18)

Why a flat texture, not a tile: ChatGPT can't hold an exact diamond across
separate tiles, so a field of them shows seams (Lessons, Oct 11). From one
seamless top-down texture, `tools/groundgen_iso.py` builds the diamond lawn
tiles at the sheet angle and they join invisibly. Colour target: the matched
lawn Chris preferred (`art/tileset-grok/lawnm-00.png`, Oct 18).

Attach: `art/_reference/target-look-5-oct18.jpg` and `art/tileset-grok/lawnm-00.png`.

```
Make a grass TEXTURE for a game, seen from straight above (top-down, no perspective, no horizon).

- Short, healthy meadow grass: fine individual blades, a few tiny clover leaves and the odd darker tuft — the same grass as in the attached reference scene, up close.
- Colour: match the attached lawn tile — a deep, earthy, slightly olive green, not bright lime or yellow-green. Even lighting, no shadows from objects, no light spots.
- Even all over: no paths, flowers, rocks, patches of dirt or anything that would stand out when the texture repeats.
- It must tile seamlessly: the left edge continues into the right edge and the top into the bottom.
- Square, 1024 x 1024. No border, no text.

Deliver as grass-texture.png.
```

## Stone road texture (Oct 18, only if Chris switches roads to stone)

Same route as the dirt roads: one seamless top-down texture, then
`tools/roadgen_iso.py <texture> <out_dir> 270 1.55` builds all 16 road shapes.
Earlier idea, not decided: stone in central counties, dirt on the outskirts.

```
Make a cobblestone road TEXTURE for a game, seen from straight above (top-down, no perspective).

- Worn, rounded grey-brown medieval cobbles with dark gaps and a little dirt and moss between them; stones about 1/12 of the image wide.
- Even lighting, no shadows from objects. Warm and muted, to sit next to the attached grass and dirt road.
- Even all over — no edges, kerbs, puddles or anything that stands out when it repeats.
- It must tile seamlessly: left edge continues into the right, top into the bottom.
- Square, 1024 x 1024. No border, no text.

Deliver as stone-road-texture.png.
```


## Iron mine — redo (Oct 31)

Chris: the mine "looks off". In the game it is a small grey rubble pile with a
timber door, sitting on open lawn, so it reads like a toy dropped on the grass.
Attach as style references: `art/_reference/target-look-hollowmere.jpg`,
`art/review-s3/blacksmith.png`, `art/review-s3/lumber-mill.png`.

> Isometric game building in exactly the style of the attached references:
> warm hand-painted 3D diorama, soft light from the top left, same camera angle
> (about 30 degrees down), same scale as the attached blacksmith and lumber mill.
> An iron mine cut into the side of a grey rocky hill, like the rock outcrop in
> the reference scene: a timber-framed tunnel mouth set into the rock face, a
> short mine-cart track running out of it with one cart of dark iron ore, a
> small heap of reddish-grey spoil beside the entrance, a lantern on a post, and
> a few tufts of grass and one small tree on the rocks. Rock colour warm grey,
> not blue. Footprint about one and a half map tiles wide.
> Rules: SOLID flat #00FF00 green background filling the whole image (not
> transparent, no gradient, no shadow on the background); no ground slab under
> it; no people; no flags or banners; nothing touching the edges. One separate
> PNG named `mine.png`.
