# Combat after ROTK11 — plan (d11, decided Oct 25)

Chris, Oct 25: "For battle, use R11 mechanics." Source: the project's
*ROTK11 Battle and Combat Mechanics* research PDF. Where ROTK11 doesn't fit
Aldermarch, Chris chose the adaptations below (all four recommended options).

## Decisions

| Question | Decision | From |
|---|---|---|
| Army make-up | **One troop type per field army.** A castle's garrison is a pool (as an ROTK11 city holds troops); armies leave it single-type. | ROTK11 |
| Stances | **None.** Each type's special move replaces them. (Stances were never in the UI; the resolver always used Balanced.) | ROTK11 |
| Special moves | **Morale meter** (Chris, Oct 25, changed from automatic). The attack prompt offers Attack or the type's move for a morale cost; the move carries the triangle bonus. Low morale means no special moves (siege engines can't fire). Morale fills by **drilling at home** (Chris, Oct 25): +10 a season in your own castle, new levies start at 30 and lower a garrison's average, mercenaries 60, +5 for winning an exchange; a move costs 20. Sieges and defenders use no moves (ROTK11: the triangle rides on the attacker's tactic only). | Chris |
| Officers | **None for now.** Every army has its type's move. Commanders can come later. | Chris (adaptation) |
| Time | **One exchange per season** (Chris, Oct 25, changed from several: "keep a season as 1 day, so years"). Fights and sieges last a year or more. | Chris |
| Troop roles | **Medieval triangle:** Pikemen = spears, Knights = cavalry, Swordsmen + Macemen = halberds. Pikes beat Knights, Knights beat Swords/Maces, Swords/Maces beat Pikes. Archers and Crossbows: ranged (2 squares, ~70% power, no melee reply), outside the triangle; Crossbows hit harder but move slower. Militia: weakest, no special move. | Chris |
| Zone of control | Enemy armies and castles stop movement on the squares next to them. | ROTK11 |
| Sieges | Wall strength and garrison are separate; a castle falls when either reaches zero. No starvation. | ROTK11 |
| Siege engines | Rams: next to the wall, walls only, can't hit troops. Siege tower: 2 squares, kills garrison. Catapult: 3 squares, walls and garrison. None fight back; they need an escort. | ROTK11 |

## Order (dependencies first)

1. **Combat maths** — triangle counters as special moves; drop the old LOTR2
   counters (archers vs militia, knights vs archers). Resolver only; sims
   before/after. *No UI.*
2. **Single-type armies** — the data model everything else rests on: levy
   raises one army per type; merge only same type; split by type; garrison
   stays a pool; old saves' mixed armies split on load; AI recruits per type;
   troop plates show the type.
3. **Exchanges in a season** — field fights between adjacent armies use the
   same per-season round count as sieges, ranged volleys first.
4. **Zone of control** — movement stops next to enemy armies/castles; the
   reachable-tile preview shows it.
5. **Sieges** — fall at zero walls *or* zero garrison; siege tower and
   catapult as new types (placeholder plates until art).
6. **Battle report (a6)** — rebuilt on the above: before/after counts, the
   special moves that fired, walls and garrison.
7. **Balance** — invariant audit + 128-game sims after each step; regress
   checks added per step.

Progress: steps 1-3 done Oct 25 (see PLAYTEST_FIXES.md); one exchange per season and morale done Oct 25. Oct 30: step 4 zone of control (orange stop tiles, red ring, key in the army panel; player armies only, since the AI moves county to county), step 5 sieges (walls down with troops at the gate = surrender; siege towers and catapults), difficulty order fixed (Very Hard grace 2 -> 4; AI wins of 32: 1 / 3 / 18 / 23). Waiting: battle report style A or B (mock-ups sent Oct 30).

Art needed later: siege tower and catapult (m-list), archer firing frames (m9).

## How we judge siege numbers (Oct 30, Chris: "how will we know what's a good cost, time, HP, damage?")

Numbers are fun when the *time* and *cost* of a siege land where we want them,
so we set targets first and tune the numbers to hit them, checked by sims and
then by Chris playing on the S10e.

Seasons to bring walls to zero with a 30-man crew (current numbers):

| Castle (walls) | Ram (90/season) | Catapult (57) | Siege Tower (22) |
|---|---|---|---|
| Wooden Palisade (60) | 1 | 2 | 3 |
| Motte & Bailey (100) | 2 | 2 | 5 |
| Norman Keep (150) | 2 | 3 | 7 |
| Stone Castle (280) | 4 | 5 | 13 |
| Royal Castle (450) | 5 | 8 | 20 |

Proposed targets (Chris to confirm): a Norman Keep with a proper siege train
falls in about a year (3-4 seasons); a Royal Castle in about two years; an
engine costs less than the castle tier it breaks but enough that you build one
or two, not ten. The tower is the garrison killer (30 crew kill ~24 a season),
not a wall breaker. If play feels too fast or slow, the one knob per engine is
its `walls` / `garrison` number in SIEGE_ENGINES.
