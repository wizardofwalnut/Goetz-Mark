import { describe, expect, it } from 'vitest';
import { ALDERMARCH } from '../../content/maps/aldermarch.generated';
import { createMatch } from '../match/createMatch';
import { factionId, type FactionId, type PlayerId } from '../ids';
import { createRng } from '../rng';
import {
  chooseLabourSplit,
  nextCastleTier,
  takeAiTurn,
  takeAllAiTurns,
  wantsCastle,
} from './countyAi';
// takeAiTurn is exercised directly below to prove a single seat acts alone.
import {
  FACTIONS,
  aiWeightingOf,
  deriveAiWeighting,
  getFaction,
} from '../../content/factions';
import { advanceSeason } from '../turn/advanceTurn';
import { countiesOwnedBy, castleRank } from '../match/matchState';
import type { MatchState } from '../match/matchState';

/** All four seats AI, one per faction, so each can be observed in isolation. */
const allAiMatch = (): MatchState =>
  createMatch({
    map: ALDERMARCH,
    now: 0,
    rng: createRng(777).next,
    seats: FACTIONS.map((f) => ({
      displayName: f.name,
      factionId: f.id,
      controller: { kind: 'ai' as const, difficulty: 'steady' as const },
    })),
  });

const seatOf = (m: MatchState, faction: string): PlayerId =>
  m.players.find((p) => p.factionId === factionId(faction))!.id;

describe('faction weighting is derived, not authored', () => {
  it('gives every faction a distinct way of playing', () => {
    const profiles = FACTIONS.map((f) => JSON.stringify(aiWeightingOf(f)));
    expect(new Set(profiles).size).toBe(FACTIONS.length);
  });

  it('makes the Knight aggressive and the Warden not', () => {
    const knight = aiWeightingOf(getFaction(factionId('knight')));
    const warden = aiWeightingOf(getFaction(factionId('warden')));
    expect(knight.aggression).toBeGreaterThan(warden.aggression);
    expect(warden.turtling).toBeGreaterThan(knight.turtling);
  });

  it('makes the Merchant and Steward the economic ones', () => {
    const econ = (id: string) => aiWeightingOf(getFaction(factionId(id))).economy;
    expect(econ('merchant')).toBeGreaterThan(econ('knight'));
    expect(econ('steward')).toBeGreaterThan(econ('knight'));
  });

  it('follows the bonuses when the bonuses change', () => {
    // The whole reason the weighting is derived. Tune a faction's sheet and its
    // AI must play the new sheet — a hand-written table would keep playing the
    // old one, and nothing would catch it.
    const base = getFaction(factionId('warden')).bonuses;
    const before = deriveAiWeighting(base);
    const after = deriveAiWeighting({ ...base, castleCost: 1.4, attack: 1.3 });

    expect(after.turtling).toBeLessThan(before.turtling);
    expect(after.aggression).toBeGreaterThan(before.aggression);
  });

  it('keeps every derived value inside 0..1', () => {
    for (const attack of [0.5, 1, 2]) {
      for (const castleCost of [0.4, 1, 2]) {
        const w = deriveAiWeighting({
          castleCost,
          attack,
          defence: 1.5,
          goldIncome: 2,
          foodYield: 2,
          happiness: 20,
          mercenaryCost: 0.2,
        });
        for (const v of Object.values(w)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('AI turn', () => {
  it('mutates nothing', () => {
    const match = allAiMatch();
    const before = JSON.stringify(match);
    takeAllAiTurns(match);
    expect(JSON.stringify(match)).toBe(before);
  });

  it('is deterministic — same state in, same state out', () => {
    const match = allAiMatch();
    expect(JSON.stringify(takeAllAiTurns(match).match)).toBe(
      JSON.stringify(takeAllAiTurns(match).match),
    );
  });

  it('ignores human seats', () => {
    const match = createMatch({
      map: ALDERMARCH,
      now: 0,
      rng: createRng(5).next,
      seats: [
        {
          displayName: 'You',
          factionId: factionId('warden'),
          controller: { kind: 'human', userId: null },
        },
        {
          displayName: 'Rival',
          factionId: factionId('knight'),
          controller: { kind: 'ai', difficulty: 'steady' },
        },
      ],
    });

    const human = match.players[0]!.id;
    const before = JSON.stringify(
      countiesOwnedBy(match, human).map((c) => match.counties[c]),
    );
    const after = takeAllAiTurns(match).match;
    expect(
      JSON.stringify(countiesOwnedBy(after, human).map((c) => after.counties[c])),
    ).toBe(before);
  });

  it('acts for one seat only when asked for one seat', () => {
    const match = allAiMatch();
    const knight = seatOf(match, 'knight');
    const after = takeAiTurn(match, knight).match;

    // The seat asked for changed; every other seat's counties did not.
    for (const player of after.players) {
      const before = JSON.stringify(
        countiesOwnedBy(match, player.id).map((c) => match.counties[c]),
      );
      const now = JSON.stringify(
        countiesOwnedBy(after, player.id).map((c) => after.counties[c]),
      );
      if (player.id === knight) expect(now).not.toBe(before);
      else expect(now).toBe(before);
    }
  });

  it('plants its land rather than leaving it fallow', () => {
    const match = allAiMatch();
    const after = takeAllAiTurns(match).match;

    for (const player of after.players) {
      for (const id of countiesOwnedBy(after, player.id)) {
        const fields = after.counties[id]!.interior!.fields;
        expect(fields.some((f) => f.status === 'grain' || f.status === 'cattle')).toBe(true);
      }
    }
  });

  it('never touches a county it does not own', () => {
    const match = allAiMatch();
    const neutralBefore = JSON.stringify(
      Object.entries(match.counties).filter(([, c]) => !c.owner),
    );
    const after = takeAllAiTurns(match).match;
    expect(
      JSON.stringify(Object.entries(after.counties).filter(([, c]) => !c.owner)),
    ).toBe(neutralBefore);
  });
});

describe('AI plays to its faction', () => {
  it('opens industry for economic factions and not for martial ones', () => {
    const match = allAiMatch();
    const after = takeAllAiTurns(match).match;

    const industryActive = (faction: string) => {
      const id = seatOf(after, faction);
      return countiesOwnedBy(after, id).every((c) =>
        after.counties[c]!.interior!.industry.every((s) => s.active),
      );
    };

    expect(industryActive('merchant')).toBe(true);
    expect(industryActive('steward')).toBe(true);
    expect(industryActive('knight')).toBe(false);
  });

  it('lets a turtling faction climb higher up the castle ladder', () => {
    const warden = aiWeightingOf(getFaction(factionId('warden')));
    const knight = aiWeightingOf(getFaction(factionId('knight')));

    // The Warden keeps wanting to build well past where the Knight stops.
    expect(wantsCastle(warden, 'normanKeep')).toBe(true);
    expect(wantsCastle(knight, 'normanKeep')).toBe(false);
  });

  it('builds castles over a campaign, and the Warden builds the best one', () => {
    let m = allAiMatch();
    // Give everyone the materials so the test measures INTENT, not luck.
    m = {
      ...m,
      treasuries: Object.fromEntries(
        m.players.map((p) => [p.id, { wood: 9999, ore: 9999, stone: 9999, gold: 9999 }]),
      ) as MatchState['treasuries'],
    };

    for (let i = 0; i < 24; i++) {
      m = takeAllAiTurns(m).match;
      m = advanceSeason(m).match;
    }

    const bestTier = (faction: string) => {
      const id = seatOf(m, faction);
      return Math.max(
        ...countiesOwnedBy(m, id).map((c) => castleRank(m.counties[c]!.castleTier)),
      );
    };

    expect(bestTier('warden')).toBeGreaterThan(bestTier('knight'));
  });

  it('stops the aggressive faction short of the top of the ladder', () => {
    const knight = aiWeightingOf(getFaction(factionId('knight')));
    expect(wantsCastle(knight, 'royalCastle')).toBe(false);
    expect(wantsCastle(knight, 'stoneCastle')).toBe(false);
  });
});

describe('AI labour choices', () => {
  const weighting = (id: string) => aiWeightingOf(getFaction(factionId(id) as FactionId));

  it('feeds the county before anything else, whatever the faction', () => {
    // A starving county revolts and is lost; no bonus is worth that.
    for (const f of ['knight', 'warden', 'merchant', 'steward']) {
      const share = chooseLabourSplit({
        weighting: weighting(f),
        hungry: true,
        winter: false,
        buildingCastle: false,
      });
      expect(share, f).toBeGreaterThan(0.8);
    }
  });

  it('moves hands off the land in winter, when nothing grows', () => {
    for (const f of ['knight', 'steward']) {
      const share = chooseLabourSplit({
        weighting: weighting(f),
        hungry: false,
        winter: true,
        buildingCastle: false,
      });
      expect(share, f).toBeLessThan(0.3);
    }
  });

  it('sends an economic faction to industry sooner than a martial one', () => {
    const merchant = chooseLabourSplit({
      weighting: weighting('merchant'),
      hungry: false,
      winter: false,
      buildingCastle: false,
    });
    const knight = chooseLabourSplit({
      weighting: weighting('knight'),
      hungry: false,
      winter: false,
      buildingCastle: false,
    });
    expect(merchant).toBeLessThan(knight);
  });

  it('keeps the split inside its bounds', () => {
    for (const hungry of [true, false]) {
      for (const winter of [true, false]) {
        for (const buildingCastle of [true, false]) {
          for (const f of FACTIONS) {
            const share = chooseLabourSplit({
              weighting: aiWeightingOf(f),
              hungry,
              winter,
              buildingCastle,
            });
            expect(share).toBeGreaterThanOrEqual(0);
            expect(share).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe('AI survives a campaign', () => {
  it('does not starve itself over four years', () => {
    let m = allAiMatch();
    for (let i = 0; i < 16; i++) {
      m = takeAllAiTurns(m).match;
      m = advanceSeason(m).match;
    }

    for (const player of m.players) {
      for (const id of countiesOwnedBy(m, player.id)) {
        const county = m.counties[id]!;
        // Not thriving necessarily, but not collapsed either.
        expect(county.population, `${player.displayName} ${id}`).toBeGreaterThan(20);
      }
    }
  });

  it('reports what it decided', () => {
    const result = takeAllAiTurns(allAiMatch());
    expect(result.decisions.length).toBeGreaterThan(0);
    for (const d of result.decisions) expect(d.what.length).toBeGreaterThan(0);
  });
});

describe('castle ladder helpers', () => {
  it('walks the ladder in order and stops at the top', () => {
    expect(nextCastleTier('none')).toBe('woodenPalisade');
    expect(nextCastleTier('normanKeep')).toBe('stoneCastle');
    expect(nextCastleTier('royalCastle')).toBeNull();
  });
});
