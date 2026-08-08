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

There are 30 such regions for this project's own source. **Everything before
the first `//#region src/` is React** — roughly the first 9,500 lines. Skip it.

## What this build is

A single screen: the **living map**, four counties tiled onto one scrollable
surface with roads joining across the borders and a minimap to travel between
them. There are no tabs — the old isometric `CountyScreen`, `MapView` and
`App.tsx` were removed when the map migration landed.

Tapping a county's **town centre** opens the **town-centre labor screen**
(`LaborScreen` → `TownPlan`): a framed plan of that county laid out 3×3 with the
town at the middle of a crossroads and the work plots ringing it. Tapping a plot
opens a +/- stepper that moves real workers through `adjustSlot`.

## How the labor screen is put together

- `planPlots(county, ctx)` decides which plots exist. Sites the county lacks are
  **omitted** — no quarry unless `mineral === 'stone'`, no mine unless `'ore'`,
  no lumber mill without wood. Do not assume a fixed set.
- Per-site staffing already works. `adjustSlot` handles the named slots
  (`farm`, `cattle`, `repair`, `castle`) *and* industry by kind, via
  `interior.industry.find(s => s.kind === slot).workers`. `projectProduction`
  sums those per site.
- Each plot carries its own ground, an optional building, an optional `props`
  list, and figures. **Props draw regardless of staffing** — they say what a
  plot *is*, where figures say who is *on* it. An unstaffed Repair plot still
  shows timber and sawhorses.
- The castle is an `enclosure`: a wall ring whose figure scatter is inset to the
  bailey floor, so builders stand inside the walls.
- Staffing rings are only drawn where the model knows what "enough" means —
  grain and cattle have a required figure, industry does not.

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
