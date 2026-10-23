# Aldermarch — notes for the next session (prepared Oct 23, 1 am)

**Build:** `aldermarch-single-file/aldermarch-game.html` on branch
`claude/pixellab-mcp-integration-vqqks6`. **Fix List:** 59 of 89 done.
**Checks:** `python3 tools/regress.py` (23 phone-size checks, ~3 min) and
`python3 tools/audit_sim.py` (invariant audit) — both clean at the end of the
overnight sweep (see the bottom of this file).

---

## Quick decisions waiting on you (one line each is enough)

| # | Question | Options |
|---|---|---|
| g11 | Wood and ore pile up (past 3,000 in most Normal games) | **A** leave it · **B** steward suggests selling surplus / moving mill and mine workers to farms · **C** add more things to spend them on |
| g12 | Should anything besides food move health? | **A** no, food only (works today) · **B** add crowding · **C** add plague recovery |
| d6 | Phone orientation | **A** lock portrait (recommended earlier, see the Phone Orientation page) · **B** design a landscape layout |
| d8 | What the paid part is | e.g. one-time unlock for full play after the free tutorial map, or map packs — and a price |
| — | Public contact email for the privacy policy | the address you're happy to show on a public page |
| — | GitHub Pages | switch it on: repo **Settings → Pages → Branch: `gh-pages`, `/ (root)`** |
| — | Phone feel | try a few labor taps and End Turns on the S10e (they were ~1.2 s freezes before Oct 22) |

---

## The next 3 tasks

### 1 · a6 — a proper battle report (P2)
Today the Battle Report is a short list. It's the screen your ROTK11 combat
direction (d11) builds on, and it opens from the season summary. Questions to
settle before I build or mock anything (your standing rule):

1. **What it shows first:** **A** a big before → after troop count for both
   sides with who won · **B** a short "story" of the fight in 3–4 lines
   ("Your archers loosed two volleys, the walls spared 40, the gate held") ·
   **C** both, numbers on top and the story underneath.
2. **Why it went that way:** list the factors (castle walls, archers, stance,
   numbers) with a +/− for each, or leave it to the story?
3. **Look:** the Steward's-panel style used by the field pop-up and labor
   screen, or a parchment "dispatch" look?
4. **When it opens:** only when you tap a battle in the season summary (as
   now), or automatically after any battle you fought in?

Once answered: I build it, check at S10e size, add a regress check.
Later step (d11, needs **m9** archer art): an on-map replay of the volleys.

### 2 · u3 + m4 — painted icons instead of the emoji buttons (P2)
Fifteen emoji still sit next to painted art: the six bottom chips, Caravan,
Levy, the minimap button, the two corner buttons, three menu items, and ale.
You make them in ChatGPT; I cut, check and wire them the same session.
**Paste-ready prompt** (attach `art/_reference/target-look-hollowmere.jpg`
and the current in-game icons exported to `art/_reference/icon-style/`
(wood, gold, bows, stone) as style references):

> Paint a set of 15 game UI icons in exactly the style of the attached
> resource icons: hand-painted, warm medieval, soft light from the top left,
> one object per icon, centred, filling about 80% of the square.
> Rules: each icon a **separate 1024×1024 PNG**; background **solid flat navy
> #020A1F (the Art Bible's icon navy)** filling the whole square (no gradient, no vignette, no border,
> no frame, no text, no shadow on the background); no flags or animals unless
> listed; nothing touching the edges. Name each file exactly as below.
> 1. `icon_population.png` — three medieval peasants standing together
> 2. `icon_happiness.png` — a smiling peasant face with a straw hat
> 3. `icon_health.png` — a red heart with a sprig of green healing herbs
> 4. `icon_castle.png` — a stone keep with one tower
> 5. `icon_diplomacy.png` — two hands clasping over a rolled scroll with a red wax seal
> 6. `icon_noble.png` — a gold crown with red gems
> 7. `icon_caravan.png` — a covered wooden wagon, side view
> 8. `icon_levy.png` — a sword and a spear crossed
> 9. `icon_map.png` — a folded parchment map
> 10. `icon_next_army.png` — a steel helmet with a red plume
> 11. `icon_next_county.png` — a small village of three timber houses
> 12. `icon_save.png` — a closed leather-bound book with a brass clasp
> 13. `icon_history.png` — an unrolled parchment scroll with writing lines
> 14. `icon_settings.png` — a brass cogwheel
> 15. `icon_ale.png` — a wooden tankard of ale with foam
> Deliver them as 15 separate downloads, not a sheet or a PDF.

Labels: 🤝 and 👑 and the two corner buttons get short text labels too
(they have none today).

### 3 · a14 — store readiness (P2)
What the Play Store needs, checked Oct 23 against Google's help pages:
- **App icon** 512×512 PNG (have: `pages/icon-512.png`).
- **Feature graphic** 1024×500, no transparency — needs art (a cropped
  title painting would do; pairs with **m7**).
- **Screenshots:** at least 2; for games, at least 3 at 1080×1920 portrait
  (or 1920×1080 landscape) are recommended. I can capture these from the
  real build at true size once the icons are in.
- **Privacy policy:** drafted (`docs/privacy-policy-draft.html`) — needs your
  public email and a date, then it moves to `pages/`.
- **Closed testing first:** a new personal developer account must run a
  closed test with **at least 12 testers opted in for 14 days in a row**
  before it can publish to everyone. Worth lining up 12 testers early (the
  Mission?).
- **Packaging:** the PWA becomes an Android app as a Trusted Web Activity
  (Bubblewrap). Needs Pages live first, then a signing key you keep safe.

Order: Pages on + email → I publish the privacy page and capture
screenshots → you create the developer account → I build the TWA package →
closed test with 12 testers for 14 days → production.

---

## Your art and music jobs (no rush, from the Fix List)
- **Suno:** m1 listen to the Shire checks · m2 make Realm and Crown · m3 the six stings.
- **ChatGPT:** m4 the icon set above · m5 bush on green screen · m7 title painting · m8 Best Noble backdrop.
- **Animation:** m9 archer firing frames (for the combat replay).

---

## Overnight sweep results (Oct 23) — all clean

| Check | Result |
|---|---|
| Health sweep (`codebase_health_sweep.py`) | PASS: 0 broken art refs, 0 banned APIs, 0 orphaned code. The 6 "orphaned" Figma icons are a false positive (looked up by a built name). |
| Unit tables, extra checks | PASS |
| Regression suite (`tools/regress.py`) | 23/23 |
| Full tutorial through the UI (`tools/tutorial_run.py`, new) | all 19 steps complete |
| Invariant audit, 128 games × 100 seasons, all difficulties | 0 anomalies, 0 errors |
| Fuzz: chaotic player, 32 games × 100 seasons (~5,400 actions, 28 kinds, now including wall repairs) | 0 crashes, 0 broken invariants |
| Console during the tutorial and a 25-screen tour | silent — no warnings or errors |
| Phone sizes 320, 360 and 412 wide, and landscape | nothing off-screen or clipped; End Turn always reachable |
| A save from the Oct 20 build, loaded into this one | loads and plays on; nothing lost |

**Fixed in the sweep:** season-report lines that still showed internal field
ids ("Field f_3_5 reclaimed" → "1 field reclaimed from barren land");
accessible names for seven controls; stale comments; the Phase B plan and
Big Bang status (facing is done).

**Noticed, not changed:** in landscape the map strip is ~200 px tall and the
warning strip takes 30 px of it — part of the d6 orientation decision.
