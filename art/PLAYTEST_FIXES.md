# Aldermarch — Playtest fixes and recommendations

Living list. Chris's S10e playtest (Oct 18–19) plus Claude's audit (Oct 19,
build `aldermarch-playtest-phaseB-3`): every screen played at S10e size,
a scripted conquest, save/load, a 100-turn passive game and a 40-turn
"keep grain staffed" game. Evidence screenshots: session scratchpad `aud/`.
Move items to **Done** with the commit when fixed.

Priority: **P1** = broken or misleading now · **P2** = hurts the game ·
**P3** = polish / recommendation. "Decide" = Chris's call.

---

## A. Bugs

| # | P | Bug | Where / cause |
|---|---|---|---|
| A1 | P1 | Attack prompt says **"Assault undefined's town?"** / "undefined's town is undefended" | `targetCounty.name` — the county *state* has no name; use the map county's name. Two copies (~20259, ~20381). |
| A2 | P1 | Event text uses the internal id in lower case: **"greyfen taken in the streets"**, "greyfen held by its own people", "… taken — nobody left" | `detail: \`${countyId} …\`` in the conquest code (~17420). Use the county name. |
| A3 | P1 | **Gold shows fractions** ("402.75") in the top bar; no thousands separator | `Readout` prints `String(value)`; army upkeep is 0.25 gold per soldier. Round for display (and consider whole-gold upkeep). |
| A4 | P1 | Labor **"+" can never close a gap under 10** — Grain sat at "178 (−2)" for 40 turns with 148 idle | `setWorkerAllocation` rejects a step that passes the ceiling instead of clamping. After a levy takes a share, counts stop being multiples of 10. Clamp the step to the ceiling. |
| A5 | P1 | Health report: **"Reaches target in ~-2 turns"** when health is above its target | Countdown goes negative; should read "falling to 50 in ~2 turns". |
| A6 | P2 | Field pop-up title shows the internal id: **"Field f_5_10"** | Give fields a readable label (e.g. "Field north of the mill", or just "Field"). |
| A7 | P2 | **Armies disappear behind the town/castle** — after taking Greyfen the army stood behind its town and only the flag showed | Side-effect of the new depth sort: a 1.9-tile town hides the cell behind it. Draw units above buildings, or nudge a unit forward when the cell behind a big sprite is occupied. |
| A8 | P2 | **Capturing a county isn't announced** — the town just changes hands at End Turn, no event line | Add a "Greyfen is yours" event (and "Hollowmere has fallen" for losses). |
| A9 | P2 | Settings offers **"Background Music: On"** but there is no music | Hide the toggle until the music ships. |
| A10 | P3 | Population/Happiness/Health reports read **"TREND — LAST 0 SEASONS"** on turn 1 | Hide the header until there's history. |
| A11 | P3 | Merchant: **Ale has no icon** (empty grey square) | Needs a `resource.ale` icon (art). |
| A12 | P3 | ☰ menu stays open while you open other panels (closes on a map tap) | Close it when any panel opens. |
| A13 | P3 | A player with 0 counties but an empty (0-troop) army still counts as "in the game", so no defeat screen | Drop 0-troop armies; only found by forcing state, rare in play. |

## B. Gameplay and balance

| # | P | Problem | Evidence | Recommendation |
|---|---|---|---|---|
| B1 | P1 | **The AI never attacks.** | 100 turns: AI held 33–35 troops per county the whole game while banking **92,000 gold, 35,000 wood, 6,000 stone**. It only took Hollowmere after it revolted to neutral. | AI troop target is "home guard + small strike" (~20–40) regardless of wealth, and it only attacks at 1.5–3× odds. Scale its army target with treasury and turn number, let it attack a weak player garrison, and spend surplus gold. Without this there's no pressure. |
| B2 | P1 | **Food barely matters.** Births ignore food; happiness stayed 80–100% with empty stores. | Population 240 → 1,232 while "Stores are empty" fired 47 times; ~1,000 people idle with no penalty. | Tie births (and happiness) to actual grain in store; make idle population cost something (unrest), or LOTR2-style: people only grow when fed. |
| B3 | P1 | **A new player starves without knowing why.** | Each county starts with 3 grain fields of 16 (7–11 fallow); Grain starts **72 workers short**; passive play empties the stores by ~turn 20 and the herd is eaten. | Start with the labor matching the need, and give a first-turn hint ("plant fallow fields to feed a growing town"). A tutorial/advisor line would cover this. |
| B4 | P2 | **Levy "Max" takes half the county in one tap**, happiness → 0%, county **revolts next turn**. | 120 of 240 raised; revolt the following season. | Cap Max at a safe share, or warn in red with the predicted happiness before "Raise this levy". |
| B5 | P2 | **Forge always shows red "short"** (−12 rising to −52) even if you never want weapons. | 40-turn run. | Only count the forge as short when a weapon is chosen and materials are waiting. |
| B6 | P2 | **"Residents left in search of a happier county" every single season** at 64–70% happiness. | Event History. | Emigration starts below 85% — too high for "normal". Lower the ceiling (~60) or hide 1–5-person moves. |
| B7 | P2 | **Castle upgrades are out of reach for the player.** | Norman Keep needs ~1,012 stone; you start with 10 and Hollowmere has a mine, not a quarry; stone costs 4 g at the merchant (~4,000 g) while gold drifts down at the 0% default tax. AI reached stone castles by turn ~80. | Give each start county a stone source or cheaper first stone tier; or explain the trade route. |
| B8 | P2 | **Two pop-ups after every End Turn** (Report Card + What Happened). | Every turn. | Merge into one season summary; Report Card as a tab. |
| B9 | P3 | Wood and ore pile up (3,000 each by turn 100) with nothing to spend them on. | Passive run. | Prompt toward the forge / castle, or let the merchant buy them. |
| B10 | P3 | Health is effectively ration-only — it sat at exactly 50 in every county for 100 turns. | Long run. | Fine if intended; otherwise tie it to crowding/food/plague. |
| B11 | P3 | Diplomacy only shows a relation number; nothing to do. | Panel. | Add actions (truce, tribute, alliance) or hide until it has some. |
| B12 | P3 | Plague can strike on turn 2. | Event History. | Grace period for random disasters in the first year. |

## C. Visual and UX

| # | P | Item | Notes |
|---|---|---|---|
| C1 | P2 | **Labor allocation screen too small** (Chris) | Painting ~290 px wide; plates ~11 px. Options to mock up: (a) cover the bottom strip while open → full width, taller; (b) full width + scroll; (c) tap a lot to zoom it; (d) list beside a smaller painting. **Decide.** |
| C2 | P2 | **Field pop-up too plain** (Chris) | Grey stock buttons, no art. Style like the army/labor panels, with a field picture per choice and the worker numbers. |
| C3 | P2 | **Emoji UI next to painted art** | Bottom stats (👥😊❤️🏰🤝👑), CARAVAN 🚚, LEVY ⚔️, map 🗺️, menu items, report icons are emoji; the resources are painted. 🤝 and 👑 have no label. Replace with painted icons in one batch (ChatGPT, navy icon style). |
| C4 | P2 | **Low-contrast numbers** in the bottom resource strip | "+35" in dark blue and "-23" in dark red on navy are hard to read on the phone. Use the light gold/green/red tones. |
| C5 | P2 | **No intro or goal** on New Game | Drops straight onto the map. A one-screen "You are Lord of Hollowmere — hold every county to win" and a first-season hint list. |
| C6 | P3 | Title screen is an emoji castle on black | A painted title backdrop (ChatGPT) would do a lot for first impressions and store screenshots. |
| C7 | P3 | Minimap is four flat coloured squares | Use a tiny version of the map or county crests. |
| C8 | P3 | Best Noble rampart is flat grey bricks on blue | Below the new art; candidate for a painted backdrop. |
| C9 | P3 | First view shows a band of black void at the world edge | Frame the start view on land, or clamp the camera nearer the edge. |
| C10 | P3 | Castle panel: "Full cost 220 Wood, 1100 Stone" then "You'll actually pay 1012 Stone" | The maths is right (credit for the current tier) but reads as a mistake. Label it "Upgrade cost (after credit for your Motte & Bailey)". |
| C11 | P3 | Road corner under the town reads as a pale blob | Road sheet draws corners as wide arcs. |
| C12 | P3 | Stat chips are clickable divs (no button role) | Screen readers / keyboard can't reach them. |
| C13 | P3 | Units don't face the way they move | `.away` art is embedded; code not written (plan step 6). |
| C14 | P3 | No bushes in the decoration | Needs a green-screen bush from ChatGPT. |
| C15 | P3 | Map sharpness on the phone | Bake 200 px per tile; raise if soft. |

---

## Second pass (Oct 19, late) — new findings

The tickable version of this whole list is the **Aldermarch Fix List** artifact (84 items, saves ticks).

**Bugs**
- **P1 Castle assault never fights; the county turns neutral.** Repro: army beside Marlbrook's castle (AI home county), confirm "Assault …'s castle?", End Turn → no battle report, event "marlbrook cut off and lost", AI garrison gone, county owner null; your army can't take it on later turns.
- **P2 Archer harassment report doesn't match the armies:** report says attacker archers lost 14; the army still has 30 (defenders 20 → 5).
- **P2 Castle plate "Building (800) 0" / "(80)"** = seasons left; cryptic, and 800 with no builders. Stepper header truncates to "Build…".
- **P3 Castle panel** "Assign builders from the Labor screen" sits outside the panel; no button to get there.

**Gameplay**
- **AI attacks only in trickles:** against an undefended Hollowmere it sent bands of 1–15 that the townsfolk beat every time ("held by its own people") for 20 turns.
- **Castle build times:** Norman Keep needs 800 builder-seasons (80 seasons with 10 builders).
- **Forge:** 10 smiths → 2 swords a season; plate demands −200 workers.
- **Tax** moves in 1% steps (20 taps to 20%).
- **Season report** lists every harvested field on its own line.
- **Town militia** defends automatically but is never shown.
- **"Cut off" rule** is invisible: a county not connected to your capital is lost at once.

**Look and feel**
- **Winter looks exactly like spring.**
- **Landscape is unusable** (map strip ~200 px, labor painting a thumbnail).
- **No owner colours on the map**; flags only on garrisoned castles.
- **No troop counts on armies**; you must tap to see size.
- Forge weapon buttons are tiny tap targets and push the labor painting smaller.

## Recommendations — add / change / remove

**Add:** first-game guidance (intro card + steward checklist); end-turn warnings strip; "Fill to need" and hold-to-repeat in the labor stepper; owner colours on towns and border posts; troop-count badges; a proper battle report; difficulty / AI personalities; map choice and more maps (paid content); season tint or snow; floating numbers at harvest/tax; sound effects; long-press help on stats; victory/defeat recap; store readiness (icon, splash, screenshots, privacy page, TWA packaging); optional auto-manage labor.

**Change:** AI army size and attack logic; food drives births and happiness; starting labor matches need; Levy "Safe max"; forge only "short" when a weapon is wanted; emigration threshold ~60; one season summary instead of two pop-ups; tax in 5% steps; castle and forge throughput; readable bottom-strip numbers; painted icons instead of emoji.

**Remove / cut:** music toggle until music ships; Report Card pop-up (keep as a tab); Levy "Max" as is; Diplomacy chip unless it gets actions; field-by-field harvest lines; 1–5 person emigration lines; dead code (old TownPlan labor screen, 79 unread manifest keys, leftover pixel art).

**Decisions for Chris:** labor layout; field pop-up style; AI difficulty; keep or drop the "cut off" rule; diplomacy build-or-hide; portrait lock vs landscape; season tint vs winter art; how the game makes money; how harsh famine should be.

## What's working (checked)

Save / Load / Continue / autosave; levy and mercenary hire; army select, reach
highlights, assault confirm and capture; merchant; caravan loading; castle
panel; 100 turns with no console errors and steady memory; county seams,
walls with road gaps, shadows, labor screen variants.

## Done

- Oct 18 `77b2c9e`: quarry drawn 0.95 tiles (was 1.3); no wall on the world's outer edge; camera no longer snaps back after a field edit or when panning into another county; road spur to an empty castle site hidden until a castle is built.
- Oct 19 `8cdc319`: road runs up to the castle gate; no road piece drawn under the town/castle.
- Oct 19 `f1bbb8f`: **AI difficulty + real military AI** (B1, "AI attacks only in trickles"): New Game rival picker (Easy/Normal/Hard/Very Hard); army scales with population, one campaign target valued by its real defence, gather-then-strike, threat-sized guards, mercenaries from spare gold. Rules fix: troops camped beside a castle now defend it. Cut-off counties kept with −5 happiness a season (fixes the castle-assault-goes-neutral bug); county names in events (A2); "undefined's town" prompt (A1). Sims vs a mirror player, player ahead: Easy ~75%, Normal ~69%, Hard ~34%, Very Hard ~16%. A passive player now loses Hollowmere around season 17–30 on Normal.
- Oct 19 `2954de0`: **Diplomacy** (B11): truce (8 seasons, optional tribute), gift, demand, break truce; AI offers truces when losing and demands gold when far stronger; truces enforced for both sides; Diplomacy panel rebuilt; 🤝 chip shows the relation or "!" for a waiting offer. Alliance shown as needing a third lord.

**Open from this pass (for Chris):** mercenaries are 20 elite troops for 60 gold, so late games turn into merc stalemates (both sides 3,000+ troops, the last county never falls) — price/upkeep is a balance call; the AI doesn't build rams yet. Capture/loss announcements (A8) still read from the attacker's side ("Hollowmere stormed — 6 lost taking it" when you lose it).
- Oct 19 `23ce1e6`: **Tutorial** (a1): Title → Tutorial runs the 4-county map against an Easy rival with an 11-step steward (staff grain, a field, tax, End Turn, levy, take a county, diplomacy, castle). Steps complete from game state; the control glows; the card docks over panels, minimises, and can be left. Labor stepper now stops at the limit instead of refusing (b5).

**Decisions Oct 19 (late):** no snow art for now, revisit later (d7); the 4-county map is the free tutorial (d8, rest of the money plan still open); phone orientation explained with real captures and a landscape mock-up, recommendation portrait-lock, Chris to choose (d6).
- Oct 20 `f7cbf32`: **Mercenary companies** (d10): LOTR2-style named companies (150–250 men, 1,800–6,000 gold), one visiting a held county at a time, wages double a citizen soldier's, gone the moment a wage is missed, never merged with other armies; coin-and-sword sign on the town; hire from the Levy panel. AI hires them and now builds and crews **rams**. Two latent ram bugs fixed (no counter entry; crews could never die). Merchant **wheat 4 / cows 24** (were reversed). Sims: games now end outright (median season 41–48); player ahead Easy 95%, Normal ~72%, Hard ~33%, Very Hard ~20%. Check script `tools/unit_table_check.py` added.
- Oct 20 `aa53be2`: gold shown as whole numbers with commas everywhere (b4); health report says "Falling/Rising to 50 in ~N turns" (b6).
- Oct 20 `6caff8c`: **Food (option A, LOTR2 achieved ration)** (g2, d9): people eat what's in store; the eaten ration drives health/happiness; Ration card shows "ate Half", panel forecasts next season. Idle people: no penalty.
- Oct 20 `bdd64f1`: **g3** grain plate shows the farmers needed to feed the county (no red −72 on turn one); advisor warns when hungry, when grain runs out within 2 seasons, and when fields are too few; tutorial starts 40 short. **b10** season report opens with "Greyfen is yours" / "Greyfen has fallen to Lady Aubrey"; on-the-spot assaults announce the result. **b8** armies show through towns and castles (70% x-ray copy on top). Fixed NaN when a county is emptied.
- Oct 20: **GitHub Pages** set-up like The Overland Trail (`pages/`, `tools/deploy_pages.py`, branch `gh-pages`); waiting on Chris to switch Pages on.
- Oct 20 `0dc0c51`: **Tutorial reworked** on LOTR2's Getting Started order across the first year (19 steps, one season per chapter, army in year 2) and **steward's notes** (LOTR2 tip screens) on first opening each screen, with a Settings switch.

- Oct 20 `9d75504`: as winter ends, every ripe grain field is now reaped before any is sown (was field by field, so the first field could go unsown with the harvest still in the other fields).

- Oct 20 (build 12): **Combat after ROTK11, first step** — one-way ranged volleys at 70% power (archers and crossbowmen), garrison bowmen shoot armies camped within 2 tiles (x1.5 from the walls), woods block arrows; Battle Report shows real losses, "walls spared N", and opens from the season report (it was unreachable) (b7).
- Oct 20: volleys scaled to wear, not wipe (~0.15 kills per bowman a season); walls give defence only, no shooting bonus. **Direction (Chris): combat overall should feel closer to ROTK11** — fights that last several seasons, ranged vs melee roles, siege engines with jobs.
- **Next for combat:** an on-map replay after End Turn (arrows in flight, floating losses) with longbow range 3 vs crossbow range 2; needs archer firing art (fix list m9). **Later:** catapults/siege towers; flesh combat out further along ROTK11 lines (Chris, Oct 20).

**Later (Chris, Oct 20):** a Civ-style advisor in normal games ("what I'd do next", New/Experienced levels) — LOTR2 "sort of had an advisor"; and **voiced explanations** like LOTR2's narrated screens, once the note texts settle.


- Oct 20 `602baae`: **b13** reports hide "Trend — Last 0 Seasons" until there's history · **b14** merchant shows a 🍺 stand-in until the painted ale icon (m6) lands · **b15** the ☰ menu closes on any press outside it · **b16** castle panel "👷 Assign builders" button opens the labor screen on the castle lot · **b17** a 0-troop army no longer keeps a beaten lord in the game (checked: old build never ends, new build declares the rival) · **u10** castle costs read "Cost from bare ground" / "Upgrade cost (after credit for your Motte & Bailey)".
- Oct 20 `121d92a`: **g4/r3** Levy "Max" → "Safe max" (stays 5 points above the unrest line: 89 of 240 at 70% happiness → 31%); the summary shows happiness before → after and warns in red past 25% · **g6** an unstaffed forge is no longer "short" · **g7/r7** emigration keeps LOTR2's sourced rate (people do leave at 73–80% in the real data, so the 85% ceiling stays); the season report says it once when a county starts losing people, then stays quiet until it stops · **g9/r5** one harvest line per county ("3 fields harvested 252 sacks") · **g13** no plague, storm or drought in the first year · **g14** castle panel shows "Town militia ~N if no soldiers defend" · **u4** strip deltas light green/red (contrast 1.6:1 → 7–10:1) · **u13** strip chips and resource cards are keyboard/screen-reader buttons. Sims, 24 seeds × 40 seasons: emigration lines 3,566 → 96, harvest lines 2,694 → 786, year-one disasters 28 → 0, biggest season report 26 → 8 lines.
- Oct 20 `4c8600a`: **g8/r2** one Season Summary after End Turn with "What happened" and "Standings" tabs (the Report Card); quiet seasons open on Standings when that setting is on. Settings: Season Summary → Standings.
- **r1** (hide the music toggle) dropped: Chris decided to keep it, music is coming (b12).
- Oct 20: **g10 dropped** — tax stays in 1% steps (Chris). The 5% steps from `121d92a` were reverted.
- Oct 21 `94f1fb2` (Chris picked each look first): **u5/a4** the owner's flag flies over every held county — on the castle, or above the town if there's none; neutral counties fly none · **u6/a5** troop plates (count on a dark plate edged in the owner's colour) under every field army and under each county flag for its garrison; top layer, never blocks a tap · **a2** warning strip above the county name: every steward warning across your counties, most urgent first (revolt → coming revolt → plague → hunger → grain → castle/repairs/ram stalled → ripe grain → herd → idle people); tap jumps to the county, shows the full text, moves to the next; never blocks End Turn. Nothing shows on turn one of a new game.
- Oct 21 `867457d` (Chris picked each first): **g5** castle costs stay at LOTR2's; when a tier is out of reach the castle panel's steward gives the shortfall, the merchant's price for it, and either "staff the quarry in X" or "Greyfen and Ravensgate have one — take one and its stone is yours" (Chris: "L2 routinely started you with iron and no stone; it's an incentive to conquer") · **a3** "→ N" button beside the labor stepper fills the chosen lot to exactly its need (shown only when off its need); hold + / − to repeat · **r6** (code only; the 80 unread art keys stay) removed the old TownPlan labor screen and five other unused helpers — sweep orphans 5 → 0.

## Overnight audit, Oct 22 (Chris asleep — no look-and-feel calls made beyond the list)

- `531f60a` **u9** the camera frames town + castle and slides just enough to keep the view on land (first-view void 16% → 5%; worst county 25% → 5%; a first try slid too far and hid Hollowmere under the top bar, so the slide is capped) · **u12** armies, caravans and the merchant face the way they last moved: "toward" art = down-left, "away" = up-left, mirrored for the other two; formation, bearer, flag and plate mirror too (display only, not saved).
- `51bee93` audit fixes:
  - **Map re-paint on every change (performance, pre-dates this week):** `layout` is rebuilt from the whole match and the map bake depended on it, so any change repainted all four counties — one labor tap froze the page ~1.2 s in desktop Chrome (more on the phone). Bakes are now cached per county and redone only when what they draw changes: labor tap 1,244 → 51 ms; tax tap: no repaint; field change: 1 county.
  - **More workers than people:** deaths, emigration, plague, levies and ram crews cut population but left people on their jobs (every simulated game; up to 443 working of 398). Jobs are now trimmed by the same share at season end and right after a levy/ram crew (idle people go first). 128 audit games: 0 anomalies after.
  - **Top bar clipped numbers on the S10e** ("74(" for 740) once the advisor icon shows: it tightens, then the readouts drop to a second row — only when they'd otherwise clip. Whole numbers kept (no "23k").
  - **Labor hold** stopped after one step when the Need button came and went (header reflow); its space is now always reserved.
- `3e36083` **End Turn freeze:** the bake keyed on the season though nothing baked changes by season yet, and encoded on the main thread. Now keyed on the art the season selects, encoded with toBlob + FileReader (still data: URLs). Longest End Turn task 1,392 → 114 ms. Same game state in both builds: 0 differing pixels.
- Checked, fine: 128 headless 100-season games (no NaN, negatives, errors); 60 + 25 seasons of scripted play through the UI (no stuck pop-ups, no odd text, warnings track the situation); memory flat over 24 seasons (5 → 7 MB); autosave → reload → Continue restores the exact state. `tools/audit_sim.py` added to re-run the invariant audit.

**For Chris (not changed):**
- **Normal is fast against a passive player:** a do-nothing player loses Hollowmere in ~11 seasons on Normal (3 after the 8-season grace), 6 on Hard, 25 on Easy — unchanged by this week's work (same on the Oct 20 build). The Oct 19 note said 17–30; that predates mercenary companies and rams. Fine if "challenging" (d3) means this; otherwise lengthen Normal's grace.
- **Win rates after the workforce fix** (32 games each, ±15% noise): stand-in wins Easy 28, Normal 22, Hard 3, Very Hard 7; a few more games run past 100 seasons undecided (builders no longer phantom).
- **g11** still true: wood/ore pass 3,000 in 19 of 32 Normal games. **g12** looks resolved by the food rule (health no longer sits at 50 in any game) — your call to tick.
- **Phone check:** the speed-ups were measured in desktop Chrome; worth a feel on the S10e (labor taps, End Turn).

- Oct 23 (Chris): **keep Normal's pace** as it is (d3). g12 left open for now.

## Overnight audit 2, Oct 23 (Chris asleep)

- **Fix List page repaired:** the Oct 22 update put a plain double quote in the page's script and the list stopped rendering; fixed, and every Fix List publish is now parse-checked and render-checked first.
- `c2f480d` **Fuzz audit** (a chaotic player firing random plausible actions — 27 kinds: labor, fields, levies, trades, caravans, moves, splits, merges, assaults, castles, rams, truces, gifts, raids, escorts, captures, mercenaries — with every invariant checked after every action; 24 games × 80 seasons, ~4,900 successful actions): 0 crashes. One gap: army/caravan moves accepted positions off the map; the rules now refuse them (play never sent them).
- `ed7fe4c` **War through the UI** (levy, march tile by tile, assault Greyfen, confirm, End Turn): works. Fixed: a capture that resolves on the spot showed a notice but left **no Event History line** (End Turn saw no change of hands to report); "**You's army**" / "held by You" → "Your army" / "held by you"; Event History no longer doubles the county name. Tour of ~25 screens with real actions: no errors, no undefined/NaN text.
- `95c512c` **`tools/regress.py`**: 23 phone-size checks of this week's fixes (≈3 min). 23/23 now; 9/23 on the Oct 20 build.
- `bb61821` **Privacy policy draft** (`docs/privacy-policy-draft.html`, a14): the game sends nothing anywhere — saves stay on the device, no analytics or accounts. Needs Chris's public contact address and a date, then move to `pages/`.

- Oct 23 `e71f34f`: **g11** (Chris: LOTR2-style trading) past a working reserve (wood 600, ore 600, stone 1,200), 1,000+ spare earns a warning-strip line and a steward note in the merchant panel: its sale value and what that gold would buy that you need (grain for a county running out, stone toward the next castle). · **g12 closed**: health already follows the LOTR2-sourced model (ration target; fast fall, fast out of Diseased, slow climb to Perfect; happiness +2…−10; plague odds by tier) — working as designed. · **a14 parked** (Chris): not ready; much more testing and tweaking first.
- Oct 23 `202cd14`: **g11 revised** (Chris: "sometimes you need a lot of a resource for castles or weapons"): "spare" now means past what's planned: each county's next two castle upgrades (stone, wood, at your faction's cost) plus a year of what each staffed forge uses (ore, wood), and a small 300 wood/ore floor. The note names what it kept ("after keeping 2,112 for Hollowmere's Stone Castle"). Privacy policy draft is single-player only; online multiplayer (Chris, Oct 23) will need a rewrite: accounts, servers, chat.

- Oct 25: **d11 decided** (Chris: "use R11 mechanics"; adaptations all his picks) — plan in `art/COMBAT_R11_PLAN.md`. Built: step 1 the ROTK11 triangle as automatic special moves (Pikemen > Knights > Swordsmen/Macemen > Pikemen, x2; tuned so the triangle holds at equal numbers); step 2 one troop kind per army (merges/escorts refuse mixed kinds with a reason, garrisons keep one army per kind, old saves split on load; audit flags any mixed army — 8,012 on the old build, 0 now); step 3 field fights are 3 exchanges a season at 0.35 bite (bowmen 0.15, no melee reply), attacking uses the army's season, and a summary pops up. Regress 26/26 (3 new checks; the merge check fails on the old build). Noticed: per material cost, Macemen (8 ore+wood) beat every type including Knights (21) — a cost/stat balance call for Chris.
- Oct 25 (later): Chris changed two picks: **one exchange per season** ("keep a season as 1 day, so years") and **a morale meter** instead of automatic moves (spent from the attack prompt; low morale = no moves). Built: one exchange a season for field fights and sieges (field bite .35, bowmen .3). Sims: Very Hard now easier than Hard (AI wins 8/32 vs 18/32) — AI odds need retuning (plan step 7). Open: how morale fills (Chris: "maybe training like R11").
- Oct 25: **morale built** (Chris: garrison drills on its own). Army panel shows "Morale: 50 / 100 · drilling +10 a season"; the attack prompt offers Cancel / Attack / the move ("Brace (20 morale)", greyed with the shortfall when low); the triangle now applies only to an attacker's special move (not to defenders or sieges, as in ROTK11). Old saves: 50. Regress 27/27 (morale prompt + cost checks). Sims unchanged (AI auto-battles use no moves); the Very Hard < Hard problem from one-exchange-a-season stands — step 7.
