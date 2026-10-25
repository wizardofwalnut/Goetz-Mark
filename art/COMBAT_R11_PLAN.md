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

Progress: steps 1-3 done Oct 25 (see PLAYTEST_FIXES.md); one exchange per season done Oct 25. Morale built Oct 25. Next: 4-7. Sims after the switch to one exchange: Very Hard got easier than Hard (AI wins 24 to 8 of 32) - the AI's attack odds were tuned for 3 rounds; retune in step 7.

Art needed later: siege tower and catapult (m-list), archer firing frames (m9).
