# Aldermarch — Asset List (art, music, sound)

Running list of everything the game has and everything it still needs (Chris, Oct 30:
"keep a running list of EVERYTHING we have and will still need"). Art waits until
the game settles; music is Chris's next job. Updated whenever an asset lands or a
new need turns up. The page version is the "Aldermarch Asset List" artifact.

Counts checked against the game on Oct 30: 160 art files stored; the game never uses 27 of them (old 64-pixel versions, crests, wax stamp), and a few more are only fallbacks (old 64-pixel tiles, the miner/woodcutter/smith figures). Style check (Oct 30): the "Aldermarch Style Check" page.

## Still needed

| What | For | Made with | Status |
|---|---|---|---|
| 15 painted UI icons (population, happiness, health, castle, diplomacy, noble, caravan, levy, map, next army, next county, save, history, settings, ale) | replace the emoji buttons (u3, m4, m6) | ChatGPT (Chris, decided Oct 30) | prompt ready in NEXT_SESSION.md |
| Ram: troop portrait + map sprite | army panel, battle report, map | ChatGPT | lettered stand-in tile "RAM" today |
| Siege Tower: troop portrait + map sprite | new engine (Oct 30) | ChatGPT | stand-in "TOWER" |
| Catapult: troop portrait + map sprite | new engine (Oct 30) | ChatGPT | stand-in "CATAPULT" |
| Archer and crossbowman firing frames (draw, loose) | on-map volleys (m9) | animation tool | not started |
| Title screen painting | title screen (m7); also the Play Store feature graphic 1024×500 | ChatGPT | not started |
| Best Noble backdrop | Best Noble screen (m8, u8) | ChatGPT | not started |
| Bush on green screen | map decoration (m5) | ChatGPT | not started |
| Shire check: listen to tier_step_hearth_to_shire, shire1_seam_check, shire1_10min_test | Tier 2 map music (m1) | Chris's ears | waiting |
| Realm and Crown (covers of Hearth 2, no tempo in prompts) | Tier 3–4 map music (m2) | Suno | not started |
| Six stings: war declared, enemy army arrives, castle finished, harvest in, county gained, county lost | big moments (m3) | Suno Sounds, One Shot, A minor | not started |
| Sound effects: taps, harvest, battle horn, siege hits | a11 | to choose | not started |
| ~20 painted report icons (births, deaths, taxes, ration, health, ale, events, crowding, food eaten, balance, calves, counties, castle, troops, gold, happiness, population, Best Noble tabs) | replace emoji in reports, season summary and Best Noble (style check, Oct 30) | ChatGPT, same navy style as the 15 | not started |
| Laborer figures: miner, woodcutter, smith, builder at full size | labor screen (today they reuse the farmer and herder) | ChatGPT | canon versions exist only at 64 px |
| Knights portrait redo (chibi figure on a grass diamond, slate background like the other six) | troop portraits (style check: clashes) | ChatGPT | optional |
| Mercenaries portrait with the shared background | troop portraits (style check: slightly off) | ChatGPT | optional |
| Iron mine redo (map) | the mine reads as a small rubble pile dropped on the lawn (Chris, Oct 31: "looks off") | ChatGPT, prompt in CHATGPT_PROMPTS.md | not started |
| Store screenshots (3+ at 1080×1920) | Play Store (a14, parked) | Claude captures from the game | after icons |

### Maybe later (not decided)

- From the style check: warmer stone for the quarry, rocks and mountains; less saturated water; slightly darker, more textured roads; full-size timber and barrel props.

- A map soldier per troop type (pikemen, knights, archers…), now that every army is one type. Today every army uses the same soldier and banner bearers.
- Winter / season art (d7: tint or snow, parked).
- Minimap art (u7), road corner under the town (u11).

## In the game now

**Map**
- Ground tiles: 8 (grass + 4 variants, forest, mountain, water)
- Fields: 7 (fallow, barren, parched, cattle, grain sown / growing / mature)
- Roads: 16 pieces
- Town: 1; castles: 5 tiers; castle flags: 4 colours; walls: run + post
- Industry buildings: 4 (mine, quarry, lumber mill, blacksmith)
- Props: 5 (timber, grain cart, barrels, spoil heap, sawhorse); decor: 4 mountains, forest, rock
- Movers: soldier + 4 banner bearers, each facing both ways (10); wagon (2 facings); cow

**Screens and panels**
- Castle pictures: 5 tiers
- Industry pictures: 4, idle and working (8)
- Labor screen: backdrop + 6 lot pictures (quarry, 5 castle tiers)
- Troop portraits: 8 (militia, archers, crossbowmen, swordsmen, macemen, pikemen, knights, mercenaries)
- Resource icons: 12 (grain, cattle, wood, iron, stone, gold, swords, bows, crossbows, maces, pikes, armour) + 6 Figma resource icons
- Lord banners: 4 colours; crests: 4 (knight, warden, merchant, steward); knight armour; wax stamp
- Army sprites: small / medium / large; mercenary offer, merchant wagon, supply wagon, cow
- App icon (512)

**Music (made, not yet wired into the game)**
- Hearth v2 — Tier 1 theme, locked Oct 11 (loop found, seam and 10-minute test passed)
- Shire v1 — Tier 2, melody checked by measurement; waiting on Chris's ear check (m1)
