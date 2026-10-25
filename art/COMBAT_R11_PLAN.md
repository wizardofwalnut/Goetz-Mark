# Combat after ROTK11 — plan (d11, decided Oct 25)

Chris, Oct 25: "For battle, use R11 mechanics." Source: the project's
*ROTK11 Battle and Combat Mechanics* research PDF. Where ROTK11 doesn't fit
Aldermarch, Chris chose the adaptations below (all four recommended options).

## Decisions

| Question | Decision | From |
|---|---|---|
| Army make-up | **One troop type per field army.** A castle's garrison is a pool (as an ROTK11 city holds troops); armies leave it single-type. | ROTK11 |
| Stances | **None.** Each type's special move replaces them. (Stances were never in the UI; the resolver always used Balanced.) | ROTK11 |
| Special moves | **Automatic.** An army uses its move when it faces the type it counters; the triangle bonus applies to those hits only. No Will meter. | Chris (adaptation) |
| Officers | **None for now.** Every army has its type's move. Commanders can come later. | Chris (adaptation) |
| Time | **Several exchanges inside a season** when armies meet (today's 3 siege rounds); unresolved fights carry into the next season. | Chris (adaptation: our turn is a season, ROTK11's is 10 days) |
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

Art needed later: siege tower and catapult (m-list), archer firing frames (m9).
