# `aldermarch-game.html` — what this file is

A single self-contained build of **The Aldermarch**, a mobile async 2–4 player
county-conquest strategy game. No server, no network, no build step: open it in
a browser and it runs. Every image is inlined as a data URI.

Rebuild it with `npm run standalone`.

## It is deliberately not minified

The bundle keeps its real identifiers and its module structure, so it can be
read and changed rather than only run. Rolldown marks every module with its
original repo path:

```js
//#region src/domain/army/resolveConquest.ts
...
//#endregion
```

There are 36 such regions for this project's own source. **Everything before
the first `//#region src/` is React** — roughly the first 7,500 lines. Skip it.

## The two tabs

| Tab | What it is |
| --- | --- |
| **Realm — playable** | The actual game. Turn loop, AI opponents, battles, county management, treasury. This is `src/App.tsx`. |
| **Living map — new** | The new overhead world: four counties tiled onto one scrollable surface, roads joining across the borders, minimap to travel. This is `src/ui/county/LivingMap.tsx`. Currently **static** — it draws, it does not yet accept input. |

## The open task

**Those two are not joined yet, and joining them is the work.**

The Realm tab still uses the ground-level isometric `CountyScreen`. The Living
map is where the game is going, but it has no interaction: you cannot tap a
field to plant it, move the labour slider, or end a season from it.

So the job is to make `LivingMap` interactive — tap-to-assign fields, the labour
panel, end-season — and then retire `CountyScreen`. `MapView` (the old strategic
map) goes at the same time: the living map already covers the whole realm, so a
separate strategic map is a second, worse picture of the same world.

## Where things live

| Concern | Module region |
| --- | --- |
| Turn loop, season advance | `src/domain/turn/advanceTurn.ts`, `src/domain/season.ts` |
| County interiors, fields, roads | `src/domain/county/interior.ts` |
| Labour and production | `src/domain/county/labour.ts` |
| Battles, conquest rules | `src/domain/army/resolveConquest.ts`, `src/domain/combat/battleResolver.ts` |
| Map, borders, movement | `src/domain/map/mapQueries.ts`, `src/domain/map/mapTypes.ts` |
| The world camera and tiling | `src/ui/county/worldCamera.ts` |
| The living map | `src/ui/county/LivingMap.tsx` |
| Baking the land to bitmaps | `src/ui/county/bakeCounty.ts` |

## Two rules that are structural, not preferences

1. **Art is data-driven.** No component or rule ever names an image file. Art is
   requested from the manifest by a logical key — `overheadIndustryArt('blacksmith')`
   — and `src/assets/assetManifest.ts` maps that to a path. If you find yourself
   writing an image path anywhere outside the manifest, that is the bug.

2. **All real art comes from PixelLab**, generated outside this file. Do not
   hand-author SVG illustrations, CSS-gradient "sprites", or drawn shapes as
   finished visuals. Placeholder blocks are fine if clearly marked interim.

## Getting changes home

Edits made in this file do **not** flow back to the repository — it is a build
output. When proposing a change, name the source file and the region it belongs
to (`src/domain/county/labour.ts`, inside `projectProduction`) and give the edit
against that file, so it can be applied to source and rebuilt.

The repository has 243 tests (`npx vitest run`). Behaviour changes should come
with one; several existing tests exist specifically because a screenshot caught
something the tests had agreed with.
