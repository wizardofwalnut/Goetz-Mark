# Grok prompts — next batch (written Oct 7)

Everything here is art the game already has a key for and that nobody has made
yet. No design decisions are needed. Run them in this order; each one is a
separate Grok chat with its own attached references.

**Where the reference images are:** GitHub `wizardofwalnut/goetz-mark`, folder
`art/` (open the file, then "Download raw file"). Canon images from the Art
Bible docx are named by their bible label.

**Always attach as an extra reference:** `art/_reference/target-look-hollowmere.jpg`
(the target look) and add to the prompt: "Match the overall style, lighting and
colour of the third image (it is a style reference, do not copy its layout)."
The game uses the reference's diamond (isometric) grid, decided Oct 11.

**When a result comes back:** send it to Claude. It gets checked for real
transparency (pixel level) and at true in-game size before it's accepted —
props are small on the labour screen, so the silhouette
has to read at that size.

---

## 1. Props sheet — 6 separate files (one Grok chat)

Attach: `art/wagon/wagon-toward.png` and `art/army/soldier-toward.png`.

```
Using the two attached images as locked style references, generate 6 SEPARATE
image files, one object per file. Deliver 6 individual downloadable files,
NOT a contact sheet or grid.

Objects:
1. A short stack of cut timber logs, tied with rope
2. A small two-wheeled hand cart loaded with grain sacks
3. Three wooden barrels standing together
4. A small heap of broken rock and rubble (quarry spoil)
5. A simple wooden sawhorse with a log resting on it
6. A small wooden mine cart on two short rail pieces, full of dark ore

Match the references exactly: same 3D diorama rendering, same warm soft
lighting from the upper left, same camera angle (three-quarter view from above,
the same as the wagon), same level of painted detail and wear.

Hard requirements for every file:
- Truly transparent background (PNG alpha). No ground tile, no base slab,
  no shadow plane, no grass under the object.
- One object, centered, nothing else in frame. No text, no labels.
- Simple, chunky silhouette — it must read at a glance when shown only
  24 pixels tall.
- Same scale relationship to the soldier reference as in real life
  (a barrel reaches about his hip).
- Square image, at least 1024x1024.
```

## 2. Cow (one file)

Attach: `art/wagon/wagon-toward.png` and `art/army/soldier-toward.png`.

```
Using the two attached images as locked style references, generate ONE
standalone image: a single medieval dairy cow, brown and white, standing,
seen from the same three-quarter top-down camera angle as the wagon.

Same 3D diorama rendering, same warm soft light from the upper left, same
painted detail as the references.

Hard requirements:
- Truly transparent background (PNG alpha). No grass, no ground, no shadow plane.
- One cow, whole body in frame, centered. No text.
- Chunky readable silhouette — it is shown about 26 pixels tall.
- Square image, at least 1024x1024. Single downloadable file, not a grid.
```

## 3. Ground and field textures — flat states (one Grok chat, 7 files)

The map is now a diamond grid, so every ground and field tile is new. Flat
ground is made the same way as the roads: Grok paints a square, seamless,
straight-down texture, and `tools/` projects it onto the diamond and adds the
soil edge. That guarantees every tile is exactly 2:1 and joins its neighbours
with no seams — something Grok can't do reliably when asked for diamonds.

Attach: `art/_reference/target-look-hollowmere.jpg` and
`art/road/_source-grok-dirt.png` (the accepted dirt texture, for scale and
lighting).

```
Using the two attached images as references, generate 7 SEPARATE square
texture images. Deliver 7 individual downloadable files, NOT a contact sheet.

Each one is a seamless, tileable ground texture seen from DIRECTLY ABOVE
(straight down, no perspective, no horizon, no shadows from tall objects).
Match the colour, warmth and painted detail of the first reference image.

1. Short meadow grass (plain open ground)
2. Fallow field: rough wild grass with a few low weeds and small wildflowers
3. Barren field: bare ploughed brown soil in straight furrows
4. Sown field: ploughed furrows with tiny green sprouts in rows
5. Parched field: dry pale cracked earth, like the cracked tile in reference 1
6. Pasture: grazed grass, slightly worn, a few bare patches (no animals)
7. Forest floor: dark soil, moss, fallen leaves and needles (no trees)

Hard requirements for every file:
- Seamless: the left edge must continue into the right edge and the top into
  the bottom, so the texture repeats with no visible seam.
- Straight-down view only. No objects that stick up (no trees, rocks, fences,
  animals, people, buildings).
- Even lighting across the whole image (no vignette, no dark corners).
- Square, at least 1024x1024. No text, no border.
```

## 3b. Wheat tiles — growing and ripe (one Grok chat, 2 files)

Wheat stands tall, so it can't be a flat texture. These two are rendered
directly as diamond tiles, matching the reference's wheat.

Attach: `art/_reference/target-look-hollowmere.jpg` and
`art/road-iso/_preview.png` (shows the exact diamond tile shape and angle).

```
Using the two attached images as references, generate 2 SEPARATE image files.
Deliver 2 individual downloadable files, NOT a contact sheet.

Each is ONE isometric diamond-shaped field tile, exactly the shape and camera
angle of one tile in the second reference image: a diamond twice as wide as
it is tall, seen from the same isometric angle, with a thin band of brown
soil showing along its two lower front edges like a raised slab.

1. Growing wheat: dense green wheat, knee high, filling the whole tile
2. Ripe wheat: dense golden wheat, waist high, filling the whole tile — the
   same style as the golden wheat fields in the first reference image

Hard requirements:
- Transparent background (PNG alpha) everywhere outside the diamond and its
  soil edge. No ground, no shadow plane, no other tiles.
- The wheat fills the diamond right to its edges so neighbouring tiles join.
- No fence, no path, no people, no animals.
- Image at least 1024 px wide. No text.
```

## 4. Mine building (one file, map sprite)

Attach: the canon lumber mill building image and `art/wagon/wagon-toward.png`.

```
Using the two attached images as locked style references, generate ONE
standalone building: a small medieval mine entrance — a timber-framed adit
(tunnel mouth) cut into a low rocky outcrop, with a wooden headframe or
pulley over it and a small pile of dark ore beside it.

Match the lumber mill reference exactly: same 3D diorama rendering, same
camera angle, same warm light from the upper left, same building scale and
level of detail, so the two sit side by side on the map as one set.

Hard requirements:
- Truly transparent background (PNG alpha). No ground tile under it, no
  grass, no shadow plane. The rocky outcrop is part of the building itself.
- One building, centered. No people, no text.
- Square image, at least 1024x1024. Single downloadable file, not a grid.
```

## 5. Sword icon redo (one file)

The last sword read like a dagger at icon size.

Attach: the accepted bow icon and the canon `unit_swordsman` image.

```
Using the two attached images as locked references, generate ONE item icon:
the swordsman's sword on its own.

The sword must be the same weapon the swordsman (reference 2) is holding: a
plain medieval arming sword — straight double-edged blade clearly longer than
the forearm, simple cross guard, leather-wrapped grip, round pommel. It must
read as a SWORD, not a dagger or knife: the blade is at least 3x the length
of the grip.

Match the bow icon (reference 1) exactly: same 3D diorama rendering, same
lighting, same framing (one object, centered, even margins), same navy
background #020A1F, same diagonal presentation angle.

No hand, no scabbard, no text. Square image, at least 1024x1024. Single
downloadable file, not a grid.
```

---

## 6. County border wall for the diamond grid (one Grok chat, 2 files)

The accepted wall was drawn for the square grid. On diamonds, both edge
directions are mirror images, so only one run piece and the post are needed.

Attach: `art/wall/wall-run-leftright.png` (the accepted wall — same stones and
height), `art/wall/wall-post.png`, and `art/road-iso/_preview.png` (the
diamond angle).

```
Using the attached images as locked references, generate 2 SEPARATE image
files. Deliver 2 individual downloadable files, NOT a contact sheet.

1. One straight section of the SAME low dry-stone wall as reference 1 (same
   stones, colour, height and wear), seen from the isometric angle of
   reference 3, running diagonally from lower-left to upper-right — exactly
   along the edge of one diamond tile, so its length matches one tile edge.
2. The SAME stone post as reference 2, seen from that same isometric angle.

Hard requirements:
- Transparent background (PNG alpha). No ground, no grass, no shadow plane.
- One object per file, nothing else. No text.
- Both drawn at the same scale.
- Image at least 1024 px wide.
```

## Not in this batch (need you or the canon zip first)

- Crests (knight / warden / merchant / steward) — Scenario's Recraft SVG model
  is the better tool, web app only.
- Resource icons (wheat, cows, wood, ore, stone, gold) — check first whether
  the canon zip already has them.
- Castle yard, mercenary offer, army size sprites — check whether the game
  still uses these (see `PHASE_B_PLAN.md`).


---

## Redo on green (same Grok chat, Oct 11)

The cow, mine cart, mine, barrels and wall pieces came back with their dark
parts cut out along with the background. Ask for a solid green background
instead; Claude cuts it out (green never appears in these objects).

```
Request 8. Redo these 6 items. FORMAT CHANGE: do NOT make the background transparent. Put each object on a SOLID, flat, pure bright green background (#00FF00), with no shadow and no gradient on the green. Keep everything else from the locked rules. 6 separate files.

1. The black-and-white dairy cow (same as before)
2. The mine cart on short rails, full of dark ore (same as before)
3. The mine entrance in the rocky outcrop with the headframe (same as before)
4. The three barrels (same as before)
5. The dry-stone wall section along one diamond tile edge, lower-left to upper-right (same as before)
6. The stone post, but SQUAT: only slightly taller than the wall (about 1.2x the wall's height), not a tall column

Keep all dark areas (black cow spots, ore, shadows inside the cart and the mine, gaps between stones) fully solid and visible.
```
