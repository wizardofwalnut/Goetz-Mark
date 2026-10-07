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
The camera stays the square front-facing view of the wagon reference, not the
reference's 45-degree angle.

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

## 3. Fallow field tile (one file)

Fallow = an unused field gone back to wild grass, ready to be ploughed.
(Barren — the furrowed bare dirt — is already done.)

Attach: the canon furrowed-dirt field tile and the canon `field.grain.growing`
(green wheat) tile.

```
Using the two attached field tiles as locked references, generate ONE new
field tile in exactly the same format: an unused fallow field that has gone
back to rough wild grass and a few low weeds and wildflowers. No crops, no
furrows, no fence, no buildings, no people or animals.

Match the references exactly: same camera angle, same tile shape and framing,
same scale of detail, same warm soft lighting, same 3D diorama style. It must
sit next to the green-wheat tile on a map and look like it belongs to the same
set — clearly grass, clearly not wheat.

Single downloadable square image, at least 1024x1024. Not a grid of options.
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

## Not in this batch (need you or the canon zip first)

- Crests (knight / warden / merchant / steward) — Scenario's Recraft SVG model
  is the better tool, web app only.
- Resource icons (wheat, cows, wood, ore, stone, gold) — check first whether
  the canon zip already has them.
- Castle yard, mercenary offer, army size sprites — check whether the game
  still uses these (see `PHASE_B_PLAN.md`).
