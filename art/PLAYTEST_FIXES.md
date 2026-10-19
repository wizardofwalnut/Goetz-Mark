# Aldermarch — Playtest fixes (from Chris's S10e playtest, started Oct 18–19)

Living list. Add to it during playtests; move items to **Done** with the
commit when fixed. Builds are `aldermarch-playtest-phaseB-N.html`.

## Open

| # | Fix | Found | Notes / decision needed |
|---|---|---|---|
| 1 | **Labor allocation screen is too small** | Chris, Oct 19 | Chris isn't sure yet what he wants. Today the painting is fitted between the top bar and the bottom resource strip, so it shows at ~290 px wide on the S10e and the plates read at ~11 px. Options to show him as mockups: (a) let the screen cover the bottom strip while open, painting full width and taller (needs the strip's numbers moved into the header); (b) full width with vertical scroll; (c) tap a lot to zoom into it (2-lot view) with the stepper below; (d) a list/plate view beside a smaller painting. |
| 2 | **Field pop-up is too plain** | Chris, Oct 19 | The "Plant grain / Graze cattle" pop-up: grey stock buttons, plain dark box, no art. Also a real bug: its title shows the internal id ("Field f_5_10") instead of a name. Direction to pick: style it like the labor/army panels (gold-rimmed parchment, field icon per choice, the + workers needed in the game's own numerals). |
| 3 | Road corner under the town reads as a pale blob | Claude, Oct 19 | The road sheet draws corners as wide arcs; the corner next to the town sits half under the town sprite. Try a tighter corner piece or end the road with a straight piece into the plaza. |
| 4 | Units don't face the way they move | Plan step 6 | `.away` art is embedded; code (track last move, mirror) not written. |
| 5 | No bushes in the decoration | Oct 18 | Sheet-1 bush's lime skirt can't be cut cleanly. Needs a green-screen bush from ChatGPT. |
| 6 | Map sharpness / memory on the phone | Phase B step 9 | Bake is 200 px per tile; raise if the map looks soft on the S10e. |

## Done

- Oct 18 `77b2c9e`: quarry drawn 0.95 tiles (was 1.3); no wall on the world's outer edge (hid cows/fields); camera no longer snaps back to the town after a field edit or when panning into another county; road spur to an empty castle site hidden until a castle is built.
- Oct 19 `8cdc319`: road runs up to the castle gate (castle slid onto the road's entry edge); no road piece drawn under the town/castle.
