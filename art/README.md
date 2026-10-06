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
| overhead.sprite.wagon | canon wagon_caravan (no slab) | TODO | Merchant and player caravans share it. Player caravans already get a seat-colour flag overlay (castleFlagArt) — no flagged wagon art needed. |
| overhead.army.bearer.<seat> | TODO | TODO | One render per view, recoloured to crimson/azure/gold/sable. |
| overhead.army.soldier | TODO | TODO | |

Phase B code: track each wagon's/army's last move direction, pick view +
CSS mirror from it, and mirror the flag overlay's x-offset with the sprite.
