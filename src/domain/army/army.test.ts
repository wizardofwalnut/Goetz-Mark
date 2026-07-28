import { describe, expect, it } from 'vitest';
import { ALDERMARCH } from '../../content/maps/aldermarch.generated';
import { createMatch, createSoloMatch } from '../match/createMatch';
import { armyId, countyId, factionId, type PlayerId } from '../ids';
import { createRng } from '../rng';
import { indexMap } from '../map/mapQueries';
import {
  MIN_POPULATION_AFTER_LEVY,
  armySpeed,
  disbandArmy,
  equipmentCost,
  mergeArmies,
  moveArmy,
  recruitArmy,
  refreshMovement,
  upkeepOf,
} from './armyActions';
import { DESERTION_AFTER_SEASONS, resolveConquest } from './resolveConquest';
import { advanceSeason } from '../turn/advanceTurn';
import { countiesOwnedBy, garrisonOf, troopCount } from '../match/matchState';
import { takeAllMilitaryTurns, composeLevy, requiredAdvantage } from '../ai/militaryAi';
import { aiWeightingOf, getFaction, FACTIONS } from '../../content/factions';
import type { MatchState } from '../match/matchState';

const ix = indexMap(ALDERMARCH);
const HOLLOWMERE = countyId('hollowmere');
const GREYFEN = countyId('greyfen'); // neutral, borders Hollowmere

const newMatch = (): MatchState =>
  createSoloMatch({
    map: ALDERMARCH,
    playerName: 'You',
    factionId: factionId('warden'),
    opponents: [{ name: 'Rival', factionId: factionId('knight') }],
    now: 0,
    rng: createRng(31).next,
  });

/** Give a player materials so tests measure intent, not poverty. */
const rich = (m: MatchState): MatchState => ({
  ...m,
  treasuries: Object.fromEntries(
    m.players.map((p) => [p.id, { wood: 9999, ore: 9999, stone: 9999, gold: 9999 }]),
  ) as MatchState['treasuries'],
});

describe('recruitment', () => {
  it('takes peasants and materials, and costs happiness', () => {
    const m = rich(newMatch());
    const before = m.counties[HOLLOWMERE]!;
    const r = recruitArmy(m, HOLLOWMERE, { militia: 20 });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.match.counties[HOLLOWMERE]!;

    expect(after.population).toBeLessThan(before.population);
    expect(after.happiness).toBeLessThan(before.happiness);
    expect(r.match.treasuries[before.owner!]!.wood).toBeLessThan(9999);
    expect(troopCount(r.match.armies[r.armyId!]!.troops)).toBe(20);
  });

  it('refuses to empty a county of people', () => {
    const m = rich(newMatch());
    const huge = Math.ceil(m.counties[HOLLOWMERE]!.population / 2);
    const r = recruitArmy(m, HOLLOWMERE, { militia: huge });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/emptying/i);
  });

  it('refuses without the materials to arm them', () => {
    const m = newMatch(); // starting treasury only
    const r = recruitArmy(m, HOLLOWMERE, { knights: 60 });
    expect(r.ok).toBe(false);
  });

  it('will not raise mercenaries — they are hired, not levied', () => {
    const r = recruitArmy(rich(newMatch()), HOLLOWMERE, { mercenaries: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/hired/i);
  });

  it('mutates nothing', () => {
    const m = rich(newMatch());
    const before = JSON.stringify(m);
    recruitArmy(m, HOLLOWMERE, { militia: 10 });
    expect(JSON.stringify(m)).toBe(before);
  });

  it('prices equipment from the unit table', () => {
    // A regiment costs what its units cost — no separate schedule to drift.
    expect(equipmentCost({ militia: 10 }).wood).toBe(20);
    expect(equipmentCost({}).wood).toBeUndefined();
  });
});

describe('movement', () => {
  const withArmy = () => {
    const m = refreshMovement(rich(newMatch()));
    const r = recruitArmy(m, HOLLOWMERE, { militia: 20 });
    if (!r.ok) throw new Error(r.reason);
    return { match: refreshMovement(r.match), id: r.armyId! };
  };

  it('moves into an adjacent county and spends movement', () => {
    const { match, id } = withArmy();
    const r = moveArmy(match, ix, id, GREYFEN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const army = r.match.armies[id]!;
    expect(army.location).toEqual({ kind: 'garrison', county: GREYFEN });
    expect(army.movementRemaining).toBeLessThan(match.armies[id]!.movementRemaining);
  });

  it('refuses a county that does not border it', () => {
    const { match, id } = withArmy();
    expect(moveArmy(match, ix, id, countyId('marlbrook')).ok).toBe(false);
  });

  it('stops partway when it cannot cover the ground', () => {
    // Faithful to the source and a real decision: a slow host caught in the
    // open is a choice the player made, not friction to smooth away.
    const { match, id } = withArmy();
    const slow: MatchState = {
      ...match,
      armies: { ...match.armies, [id]: { ...match.armies[id]!, movementRemaining: 1 } },
    };
    const target = countyId('auldbarrow'); // forest, costs more than 1

    const r = moveArmy(slow, ix, id, target);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const loc = r.match.armies[id]!.location;
    expect(loc.kind).toBe('inTransit');
    if (loc.kind === 'inTransit') {
      expect(loc.from).toBe(HOLLOWMERE);
      expect(loc.to).toBe(target);
      expect(loc.progress).toBeGreaterThan(0);
      expect(loc.progress).toBeLessThan(1);
    }
  });

  it('will not re-order an army already on the march', () => {
    const { match, id } = withArmy();
    const marching: MatchState = {
      ...match,
      armies: {
        ...match.armies,
        [id]: {
          ...match.armies[id]!,
          location: { kind: 'inTransit', from: HOLLOWMERE, to: GREYFEN, progress: 0.5 },
        },
      },
    };
    expect(moveArmy(marching, ix, id, HOLLOWMERE).ok).toBe(false);
  });

  it('moves at the pace of the slowest contingent', () => {
    expect(armySpeed({ knights: 10 })).toBe(6);
    expect(armySpeed({ knights: 10, militia: 1 })).toBe(4);
    expect(armySpeed({})).toBe(0);
  });

  it('gives every army its allowance back each season', () => {
    const { match, id } = withArmy();
    const spent: MatchState = {
      ...match,
      armies: { ...match.armies, [id]: { ...match.armies[id]!, movementRemaining: 0 } },
    };
    expect(refreshMovement(spent).armies[id]!.movementRemaining).toBeGreaterThan(0);
  });
});

describe('conquest', () => {
  const marchOn = (target = GREYFEN) => {
    const m = refreshMovement(rich(newMatch()));
    const r = recruitArmy(m, HOLLOWMERE, { militia: 30 });
    if (!r.ok) throw new Error(r.reason);
    const moved = moveArmy(refreshMovement(r.match), ix, r.armyId!, target);
    if (!moved.ok) throw new Error(moved.reason);
    return moved.match;
  };

  it('makes an ungarrisoned county fight for itself rather than be walked into', () => {
    // No county changes hands for free, neutral ground included. The keep
    // shelters nobody when nobody is in it, so the town turns out instead.
    const m = marchOn();
    expect(m.counties[GREYFEN]!.owner).toBeNull();
    expect(m.counties[GREYFEN]!.population).toBeGreaterThan(0);

    const result = resolveConquest(m, ix);
    expect(result.events.some((e) => e.kind === 'annexed')).toBe(false);
    expect(result.events.some((e) => e.kind === 'battle' || e.kind === 'repelled')).toBe(true);
  });

  it('takes the county anyway when a real army comes — the levy is a speed bump', () => {
    // The levy exists to cost the attacker something, not to stop them. If 30
    // militia cannot take a town defended by a handful of townsfolk, the number
    // is wrong.
    const m = marchOn();
    const result = resolveConquest(m, ix);
    expect(result.match.counties[GREYFEN]!.owner).toBe(m.counties[HOLLOWMERE]!.owner);
  });

  it('takes the fallen out of the county population', () => {
    // The levy WAS the people. Storming a county costs it inhabitants, which
    // is the consequence that makes an empty castle a real risk.
    const m = marchOn();
    const before = m.counties[GREYFEN]!.population;
    const result = resolveConquest(m, ix);
    expect(result.match.counties[GREYFEN]!.population).toBeLessThan(before);
  });

  it('gives an empty castle no defensive credit', () => {
    // The point of the whole rule. A keep with a garrison multiplies what
    // survives; a keep with nobody in it must change nothing at all, so the
    // same assault on the same county resolves identically whatever tier of
    // castle is standing empty on it.
    const m = marchOn();
    const withKeep = {
      ...m,
      counties: {
        ...m.counties,
        [GREYFEN]: { ...m.counties[GREYFEN]!, castleTier: 'royalCastle' as const },
      },
    };
    const bare = resolveConquest(m, ix);
    const fortified = resolveConquest(withKeep, ix);

    expect(fortified.match.counties[GREYFEN]!.population).toBe(
      bare.match.counties[GREYFEN]!.population,
    );
    expect(fortified.match.counties[GREYFEN]!.owner).toBe(bare.match.counties[GREYFEN]!.owner);
  });

  it('forces a battle when the county is defended', () => {
    let m = marchOn();
    // Put a defender in place, owned by someone else.
    const rival = m.players[1]!.id;
    m = {
      ...m,
      counties: { ...m.counties, [GREYFEN]: { ...m.counties[GREYFEN]!, owner: rival } },
      armies: {
        ...m.armies,
        [armyId('def')]: {
          id: armyId('def'),
          owner: rival,
          troops: { militia: 40, archers: 20 },
          location: { kind: 'garrison', county: GREYFEN },
          movementRemaining: 0,
          unpaidUpkeepTurns: 0,
        },
      },
    };

    const result = resolveConquest(m, ix);
    expect(
      result.events.some((e) => e.kind === 'battle' || e.kind === 'repelled'),
    ).toBe(true);
  });

  it('leaves the county with its defender when the assault fails', () => {
    let m = marchOn();
    const rival = m.players[1]!.id;
    m = {
      ...m,
      counties: { ...m.counties, [GREYFEN]: { ...m.counties[GREYFEN]!, owner: rival } },
      armies: {
        ...m.armies,
        [armyId('def')]: {
          id: armyId('def'),
          owner: rival,
          troops: { knights: 90 },
          location: { kind: 'garrison', county: GREYFEN },
          movementRemaining: 0,
          unpaidUpkeepTurns: 0,
        },
      },
    };

    const result = resolveConquest(m, ix);
    // Clearing the field is required to take ground; a failed assault changes
    // nothing about who holds it.
    expect(result.match.counties[GREYFEN]!.owner).toBe(rival);
  });

  it('brings an army on the road closer each season', () => {
    const m = refreshMovement(rich(newMatch()));
    const r = recruitArmy(m, HOLLOWMERE, { militia: 10 });
    if (!r.ok) throw new Error(r.reason);
    const id = r.armyId!;
    const marching: MatchState = {
      ...r.match,
      armies: {
        ...r.match.armies,
        [id]: {
          ...r.match.armies[id]!,
          location: { kind: 'inTransit', from: HOLLOWMERE, to: GREYFEN, progress: 0.1 },
        },
      },
    };

    const after = resolveConquest(marching, ix).match.armies[id]!;
    if (after.location.kind === 'inTransit') {
      expect(after.location.progress).toBeGreaterThan(0.1);
    } else {
      expect(after.location.county).toBe(GREYFEN);
    }
  });

  it('unsettles a county that changes hands', () => {
    const result = resolveConquest(marchOn(), ix);
    expect(result.match.counties[GREYFEN]!.happiness).toBeLessThanOrEqual(45);
  });
});

describe('severed territory', () => {
  it('loses counties cut off from the capital', () => {
    // The rule that makes contiguous territory worth planning for.
    let m = newMatch();
    const player = m.players[0]!.id;
    // Hold the start plus a county with no connection to it.
    m = {
      ...m,
      counties: {
        ...m.counties,
        [countyId('marlbrook')]: {
          ...m.counties[countyId('marlbrook')]!,
          owner: player,
        },
      },
    };

    const result = resolveConquest(m, ix);
    expect(result.match.counties[countyId('marlbrook')]!.owner).toBeNull();
    expect(result.events.some((e) => e.kind === 'severed')).toBe(true);
  });

  it('gives a county taken this season a season of grace', () => {
    // Without this a lord storms a county and loses it in the same resolution,
    // before ever having a turn to link it up. The rule is meant to punish
    // letting a chain be cut, not to punish taking ground.
    const m = refreshMovement(rich(newMatch()));
    const player = m.counties[HOLLOWMERE]!.owner!;

    // March on a county that does NOT border the capital, so the moment it is
    // taken it is already disconnected. Hollowmere borders greyfen, auldbarrow
    // and kestrelHollow — blackrush borders none of the capital.
    const far = countyId('blackrush');
    const staged: MatchState = {
      ...m,
      armies: {
        [armyId('raider')]: {
          id: armyId('raider'),
          owner: player,
          troops: { militia: 25 },
          location: { kind: 'garrison', county: far },
          movementRemaining: 0,
          unpaidUpkeepTurns: 0,
        },
      },
    };

    const first = resolveConquest(staged, ix);
    expect(first.match.counties[far]!.owner).toBe(player);
    expect(first.events.some((e) => e.kind === 'severed' && e.county === far)).toBe(false);

    // The grace is one season only — still unconnected next time, still lost.
    const second = resolveConquest(first.match, ix);
    expect(second.match.counties[far]!.owner).toBeNull();
    expect(second.events.some((e) => e.kind === 'severed' && e.county === far)).toBe(true);
  });

  it('keeps a connected chain intact', () => {
    let m = newMatch();
    const player = m.players[0]!.id;
    // Greyfen borders Hollowmere, so the chain holds.
    m = {
      ...m,
      counties: {
        ...m.counties,
        [GREYFEN]: { ...m.counties[GREYFEN]!, owner: player },
      },
    };

    const result = resolveConquest(m, ix);
    expect(result.match.counties[GREYFEN]!.owner).toBe(player);
  });
});

describe('upkeep and desertion', () => {
  const withMercs = (gold: number): MatchState => {
    const m = newMatch();
    const owner = m.counties[HOLLOWMERE]!.owner!;
    return {
      ...m,
      treasuries: { ...m.treasuries, [owner]: { wood: 0, ore: 0, stone: 0, gold } },
      armies: {
        [armyId('merc')]: {
          id: armyId('merc'),
          owner,
          troops: { militia: 10, mercenaries: 20 },
          location: { kind: 'garrison', county: HOLLOWMERE },
          movementRemaining: 0,
          unpaidUpkeepTurns: 0,
        },
      },
    };
  };

  it('pays wages from the shared pool', () => {
    const m = withMercs(5000);
    const after = resolveConquest(m, ix).match;
    const owner = m.counties[HOLLOWMERE]!.owner!;
    expect(after.treasuries[owner]!.gold).toBeLessThan(5000);
  });

  it('lets unpaid mercenaries desert, but not immediately', () => {
    // They tolerate a lean season; they do not tolerate a habit.
    let m = withMercs(0);
    const id = armyId('merc');

    const first = resolveConquest(m, ix);
    expect(first.match.armies[id]!.troops.mercenaries).toBe(20);
    m = first.match;

    let deserted = false;
    for (let i = 0; i < DESERTION_AFTER_SEASONS + 1; i++) {
      const r = resolveConquest(m, ix);
      m = r.match;
      if (r.events.some((e) => e.kind === 'deserted')) deserted = true;
    }
    expect(deserted).toBe(true);
    expect(m.armies[id]?.troops.mercenaries ?? 0).toBe(0);
  });

  it('keeps the levied troops when the mercenaries walk', () => {
    let m = withMercs(0);
    for (let i = 0; i < DESERTION_AFTER_SEASONS + 1; i++) m = resolveConquest(m, ix).match;
    expect(m.armies[armyId('merc')]?.troops.militia).toBe(10);
  });

  it('prices upkeep from the unit table', () => {
    expect(upkeepOf({ militia: 10 })).toBe(10);
    expect(upkeepOf({ mercenaries: 2 })).toBe(16);
  });
});

describe('merging and disbanding', () => {
  const twoArmies = () => {
    let m = refreshMovement(rich(newMatch()));
    const a = recruitArmy(m, HOLLOWMERE, { militia: 15 });
    if (!a.ok) throw new Error(a.reason);
    m = a.match;
    const b = recruitArmy(m, HOLLOWMERE, { archers: 10 });
    if (!b.ok) throw new Error(b.reason);
    return { match: b.match, a: a.armyId!, b: b.armyId! };
  };

  it('merges two of your own armies standing together', () => {
    const { match, a, b } = twoArmies();
    const r = mergeArmies(match, a, b);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.match.armies[b]).toBeUndefined();
    expect(troopCount(r.match.armies[a]!.troops)).toBe(25);
  });

  it('refuses to merge mercenaries — rival bands will not serve together', () => {
    const { match, a, b } = twoArmies();
    const withMercs: MatchState = {
      ...match,
      armies: {
        ...match.armies,
        [b]: { ...match.armies[b]!, troops: { mercenaries: 10 } },
      },
    };
    const r = mergeArmies(withMercs, a, b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/mercenar/i);
  });

  it('returns some of the levy to the land on disband', () => {
    const { match, a } = twoArmies();
    const before = match.counties[HOLLOWMERE]!.population;
    const r = disbandArmy(match, a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.match.counties[HOLLOWMERE]!.population).toBeGreaterThan(before);
    expect(r.match.armies[a]).toBeUndefined();
  });
});

describe('aggression drives the military AI', () => {
  const allAi = (): MatchState =>
    rich(
      createMatch({
        map: ALDERMARCH,
        now: 0,
        rng: createRng(202).next,
        seats: FACTIONS.map((f) => ({
          displayName: f.name,
          factionId: f.id,
          controller: { kind: 'ai' as const, difficulty: 'steady' as const },
        })),
      }),
    );

  const seatOf = (m: MatchState, faction: string): PlayerId =>
    m.players.find((p) => p.factionId === factionId(faction))!.id;

  it('makes an aggressive faction raise a bigger host than a defensive one', () => {
    const m = refreshMovement(allAi());
    const after = takeAllMilitaryTurns(m, ix).match;

    const strength = (faction: string) =>
      Object.values(after.armies)
        .filter((a) => a.owner === seatOf(after, faction))
        .reduce((s, a) => s + troopCount(a.troops), 0);

    expect(strength('knight')).toBeGreaterThan(strength('warden'));
  });

  it('keeps a defensive faction at home', () => {
    const m = refreshMovement(allAi());
    const after = takeAllMilitaryTurns(m, ix).match;
    const warden = seatOf(after, 'warden');

    // The Warden garrisons but does not march — its aggression is below the
    // threshold for taking the field at all.
    for (const army of Object.values(after.armies)) {
      if (army.owner !== warden) continue;
      expect(army.location.kind).toBe('garrison');
    }
  });

  it('takes ground over a campaign', () => {
    let m = refreshMovement(allAi());
    const knight = seatOf(m, 'knight');
    const before = countiesOwnedBy(m, knight).length;

    for (let i = 0; i < 12; i++) {
      m = takeAllMilitaryTurns(m, ix).match;
      m = advanceSeason(m, ALDERMARCH).match;
    }

    expect(countiesOwnedBy(m, knight).length).toBeGreaterThan(before);
  });

  it('wants a bigger margin before attacking when it is cautious', () => {
    const knight = requiredAdvantage(aiWeightingOf(getFaction(factionId('knight'))));
    const warden = requiredAdvantage(aiWeightingOf(getFaction(factionId('warden'))));
    expect(warden).toBeGreaterThan(knight);
  });

  it('composes a levy that suits the faction', () => {
    const knight = composeLevy(40, aiWeightingOf(getFaction(factionId('knight'))));
    const warden = composeLevy(40, aiWeightingOf(getFaction(factionId('warden'))));

    expect(knight.knights ?? 0).toBeGreaterThan(warden.knights ?? 0);
    expect(warden.archers ?? 0).toBeGreaterThan(knight.archers ?? 0);
    expect(troopCount(knight)).toBe(40);
  });

  it('never leaves a county with no garrison at all', () => {
    let m = refreshMovement(allAi());
    for (let i = 0; i < 8; i++) {
      m = takeAllMilitaryTurns(m, ix).match;
      m = advanceSeason(m, ALDERMARCH).match;
    }

    for (const player of m.players) {
      for (const id of countiesOwnedBy(m, player.id)) {
        const here = garrisonOf(m, id).reduce((s, a) => s + troopCount(a.troops), 0);
        // Either defended, or the AI has genuinely nothing left to defend with.
        const total = Object.values(m.armies)
          .filter((a) => a.owner === player.id)
          .reduce((s, a) => s + troopCount(a.troops), 0);
        if (total > 0) expect(here + total).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic', () => {
    const m = refreshMovement(allAi());
    expect(JSON.stringify(takeAllMilitaryTurns(m, ix).match)).toBe(
      JSON.stringify(takeAllMilitaryTurns(m, ix).match),
    );
  });
});

describe('population floor', () => {
  it('never levies below the floor', () => {
    const m = rich(newMatch());
    const pop = m.counties[HOLLOWMERE]!.population;
    const max = Math.floor((pop - MIN_POPULATION_AFTER_LEVY) / 3);
    expect(recruitArmy(m, HOLLOWMERE, { militia: max }).ok).toBe(true);
    expect(recruitArmy(m, HOLLOWMERE, { militia: max + 5 }).ok).toBe(false);
  });
});
