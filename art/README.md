# Aldermarch canon art (accepted assets awaiting Phase B wiring)

| File | Manifest key | Notes |
|---|---|---|
| banner/crimson.png | banner.crimson | Seat 1. Transparent PNG. |
| banner/steel.png | banner.steel | Seat 2 ("Azure"). Recoloured from crimson so all four are pixel-identical in shape. |
| banner/gold.png | banner.gold | Seat 3. |
| banner/sable.png | banner.sable (new) | Seat 4. Replaces verdigris — BEST_NOBLE_BANNERS still lists verdigris; fix in Phase B. Alpha taken from the gold banner (dark folds were keying out). |
| icons/item_knight_helm.png | item_knight_helm (replaces item_knight_plate_helm) | Great helm matching unit_knight. Navy #020A1F background, same as the other catalog icons. |

Seat colours: crimson #C0392B, azure #2F6FD0, gold #E8C33A, sable #26262E.

## Facing (decided Oct 5)

Wagons and armies turn to face the way they last moved. Each moving sprite
needs TWO views — toward camera (down-left) and away from camera (up-left);
the game mirrors each horizontally for the other two directions.

| Sprite | Toward | Away | Notes |
|---|---|---|---|
| overhead.sprite.wagon | wagon/wagon-toward.png ✓ | wagon/wagon-away.png ✓ | Merchant and player caravans share it. Player caravans already get a seat-colour flag overlay (castleFlagArt) — no flagged wagon art needed. |
| overhead.army.bearer.<seat> | army/bearer-<colour>-toward.png ✓ | army/bearer-<colour>-away.png ✓ | Colours crimson/azure/gold/sable (seat 0-3), recoloured from one render per view. Body scaled to match the soldier (701px helmet-to-feet in both). Flag flies sideways from the pole (reads better on the map than the hanging banner). |
| overhead.army.soldier | army/soldier-toward.png ✓ | army/soldier-away.png ✓ | Canon militia kit. Both files share one frame (420x852) so they swap in place. |

Phase B code: track each wagon's/army's last move direction, pick view +
CSS mirror from it, and mirror the flag overlay's x-offset with the sprite.

## County border wall (accepted Oct 6)

Run-and-post kit (replaces the straight/corner/T/end-cap plan — the overhead
camera makes left-right and front-back edges different drawings, so a
4-piece kit would need 8+ pieces; posts at every vertex give corners, Ts and
end caps for free and hide the run seams).

| File | Use | Placement at map scale (tile = 58 x 42 px) |
|---|---|---|
| wall/wall-run-leftright.png | north/south tile edges | scale to 58 px wide (~18 px tall); bottom of wall on the edge line |
| wall/wall-run-frontback.png | east/west tile edges | scale UNIFORMLY to 11 px wide (stone size then matches the left-right run); tiles seamlessly — crop a 42 px slice per tile, offset by row so slices don't repeat |
| wall/wall-post.png | every vertex where segments meet or end | scale to ~1.2x wall height (~21 px tall), centred on the vertex, drawn last |

Look: low dry-stone field wall, knee-to-waist on a soldier. Purely cosmetic
(wallSegments/CountyWalls — no effect on movement). A road crossing simply
has no segment there. One variant year-round.

## Roads (generator ready Oct 6; texture pending)

`tools/roadgen.py <dirt_texture.png> <out_dir> [scale]` builds all 16 road
autotiles (mask bits N=1 E=2 S=4 W=8, same as `roadMasks`) from ONE dirt
texture. Output is transparent overlays for the existing "roads" bake layer,
so one set works on every season's ground (checked on spring, autumn, winter).
- Road width = 0.34 tile; curved corners; ragged edge from tileable noise;
  dark rim so the road still reads on brown autumn ground.
- Surface is cropped to one tile and made seamless at that size, so tiles
  join invisibly. Arms and noise run past the border before cropping — no
  seam lines.
- Default output is 4x (232x168) for downscaling to the bake resolution.

`art/road-placeholder/` is built from a stand-in texture synthesised from the
canon road colours. Replace by re-running the script on the Grok texture
(prompt: seamless overhead packed-dirt surface, no ruts or directional marks).
Manifest note: current keys `overhead.road.0..15` point at shuffled file names
(tile-00/02/03/10/...) — wire road-NN.png directly by mask number in Phase B.
