import { describe, expect, it } from 'vitest';
import {
  STANCES,
  attackerTakesGround,
  resolveBattle,
  type BattleInput,
  type Stance,
} from './battleResolver';
import { troopCount, type Regiment } from '../match/matchState';
import { factionId } from '../ids';
import { seedFrom } from '../rng';

const battle = (over: Partial<BattleInput> = {}): BattleInput => ({
  attacker: { troops: { militia: 40 }, stance: 'balanced', factionId: null },
  defender: { troops: { militia: 40 }, stance: 'balanced', factionId: null },
  terrain: 'open',
  seed: 1234,
  ...over,
});

describe('battle resolver — determinism', () => {
  it('returns an identical result for the same seed', () => {
    // The property async multiplayer depends on: two devices replaying a
    // battle must not disagree about who won.
    const input = battle({
      attacker: { troops: { militia: 30, archers: 12 }, stance: 'aggressivePush', factionId: null },
      defender: { troops: { militia: 20, knights: 6 }, stance: 'shieldArchers', factionId: null },
      terrain: 'hills',
      seed: 987654,
    });
    expect(JSON.stringify(resolveBattle(input))).toBe(JSON.stringify(resolveBattle(input)));
  });

  it('returns different results for different seeds', () => {
    const a = resolveBattle(battle({ seed: 1 }));
    const b = resolveBattle(battle({ seed: 2 }));
    // Same armies, different variance rolls — the transcripts should not match.
    expect(JSON.stringify(a.rounds)).not.toBe(JSON.stringify(b.rounds));
  });

  it('derives a stable seed from match data', () => {
    expect(seedFrom('m_abc', 4, 'ironthroat')).toBe(seedFrom('m_abc', 4, 'ironthroat'));
    expect(seedFrom('m_abc', 4, 'ironthroat')).not.toBe(seedFrom('m_abc', 5, 'ironthroat'));
  });
});

describe('battle resolver — outcomes', () => {
  it('lets an overwhelming attacker take the ground', () => {
    const r = resolveBattle(
      battle({
        attacker: { troops: { knights: 60 }, stance: 'aggressivePush', factionId: null },
        defender: { troops: { militia: 3 }, stance: 'balanced', factionId: null },
      }),
    );
    expect(r.outcome).toBe('attackerWins');
    expect(attackerTakesGround(r)).toBe(true);
    expect(troopCount(r.defenderSurvivors)).toBe(0);
  });

  it('lets an overwhelming defender hold', () => {
    const r = resolveBattle(
      battle({
        attacker: { troops: { militia: 3 }, stance: 'balanced', factionId: null },
        defender: { troops: { knights: 60 }, stance: 'balanced', factionId: null },
      }),
    );
    expect(r.outcome).toBe('defenderHolds');
    expect(attackerTakesGround(r)).toBe(false);
  });

  it('does not hand the county over on a stalemate', () => {
    // Taking a castle requires clearing it. An inconclusive fight leaves the
    // defender in place — otherwise attacking would be free.
    const r = resolveBattle(
      battle({
        attacker: { troops: { militia: 40 }, stance: 'balanced', factionId: null },
        defender: { troops: { militia: 40 }, stance: 'balanced', factionId: null },
        maxRounds: 1,
      }),
    );
    expect(r.outcome).toBe('stalemate');
    expect(attackerTakesGround(r)).toBe(false);
  });

  it('never resurrects troops or invents them', () => {
    const input = battle({
      attacker: { troops: { militia: 25, archers: 10, knights: 4 }, stance: 'balanced', factionId: null },
      defender: { troops: { militia: 18, archers: 14 }, stance: 'balanced', factionId: null },
    });
    const r = resolveBattle(input);

    for (const [side, before, survivors, losses] of [
      ['attacker', input.attacker.troops, r.attackerSurvivors, r.attackerLosses],
      ['defender', input.defender.troops, r.defenderSurvivors, r.defenderLosses],
    ] as const) {
      expect(troopCount(survivors) + troopCount(losses), side).toBe(troopCount(before));
      for (const kind of Object.keys(survivors) as (keyof Regiment)[]) {
        expect(survivors[kind]!, `${side} ${kind}`).toBeLessThanOrEqual(before[kind] ?? 0);
      }
    }
  });

  it('resolves immediately when a side is empty', () => {
    const r = resolveBattle(
      battle({ defender: { troops: {}, stance: 'balanced', factionId: null } }),
    );
    expect(r.rounds).toHaveLength(0);
    expect(r.outcome).toBe('attackerWins');
  });
});

describe('battle resolver — the counter-triangle', () => {
  const seeds = [11, 22, 33, 44, 55, 66, 77, 88];

  /** Average defender losses across seeds, to see past per-battle variance. */
  const averageDefenderLosses = (attacker: Regiment, defender: Regiment) =>
    seeds.reduce((sum, seed) => {
      const r = resolveBattle(
        battle({
          attacker: { troops: attacker, stance: 'balanced', factionId: null },
          defender: { troops: defender, stance: 'balanced', factionId: null },
          seed,
          maxRounds: 1,
        }),
      );
      return sum + troopCount(r.defenderLosses);
    }, 0) / seeds.length;

  it('gives archers an edge against militia-heavy armies', () => {
    const vsMilitia = averageDefenderLosses({ archers: 30 }, { militia: 60 });
    const vsKnights = averageDefenderLosses({ archers: 30 }, { knights: 60 });
    expect(vsMilitia).toBeGreaterThan(vsKnights);
  });

  it('gives knights an edge against archer-heavy armies', () => {
    const knightsVsArchers = averageDefenderLosses({ knights: 20 }, { archers: 40 });
    const militiaVsArchers = averageDefenderLosses({ militia: 20 }, { archers: 40 });
    expect(knightsVsArchers).toBeGreaterThan(militiaVsArchers);
  });

  it('withholds the bonus when the enemy is not committed to that unit', () => {
    // A token few archers must not hand the enemy a full knight bonus.
    const r = resolveBattle(
      battle({
        attacker: { troops: { knights: 20 }, stance: 'balanced', factionId: null },
        defender: { troops: { militia: 90, archers: 10 }, stance: 'balanced', factionId: null },
        maxRounds: 1,
      }),
    );
    const labels = r.rounds[0]!.attacker.modifiers.map((m) => m.label);
    expect(labels.some((l) => l.includes('Archers-heavy'))).toBe(false);
  });

  it('scales the bonus by how much of the army can exploit it', () => {
    const mostlyKnights = resolveBattle(
      battle({
        attacker: { troops: { knights: 40, militia: 10 }, stance: 'balanced', factionId: null },
        defender: { troops: { archers: 50 }, stance: 'balanced', factionId: null },
        maxRounds: 1,
      }),
    );
    const fewKnights = resolveBattle(
      battle({
        attacker: { troops: { knights: 5, militia: 45 }, stance: 'balanced', factionId: null },
        defender: { troops: { archers: 50 }, stance: 'balanced', factionId: null },
        maxRounds: 1,
      }),
    );
    const factorOf = (r: typeof mostlyKnights) =>
      r.rounds[0]!.attacker.modifiers.find((m) => m.label.includes('Archers-heavy'))?.factor ?? 1;

    expect(factorOf(mostlyKnights)).toBeGreaterThan(factorOf(fewKnights));
  });
});

describe('battle resolver — terrain', () => {
  it('favours the defender and never the attacker', () => {
    const open = resolveBattle(battle({ terrain: 'open', maxRounds: 1 }));
    const pass = resolveBattle(battle({ terrain: 'chokepoint', maxRounds: 1 }));

    expect(pass.rounds[0]!.defender.finalOutput).toBeGreaterThan(
      open.rounds[0]!.defender.finalOutput,
    );
    // The attacker's output must be untouched by the ground being fought over.
    expect(pass.rounds[0]!.attacker.baseOutput).toBe(open.rounds[0]!.attacker.baseOutput);
    expect(
      pass.rounds[0]!.attacker.modifiers.some((m) => m.label.includes('terrain')),
    ).toBe(false);
  });

  it('makes the chokepoint the most defensible ground on the map', () => {
    const outputs = (['open', 'forest', 'hills', 'chokepoint'] as const).map(
      (terrain) => resolveBattle(battle({ terrain, maxRounds: 1 })).rounds[0]!.defender.finalOutput,
    );
    expect(Math.max(...outputs)).toBe(outputs[3]);
  });
});

describe('battle resolver — stances', () => {
  const run = (attackerStance: Stance, defenderStance: Stance = 'balanced') =>
    resolveBattle(
      battle({
        attacker: { troops: { militia: 30, archers: 20 }, stance: attackerStance, factionId: null },
        defender: { troops: { militia: 30, archers: 20 }, stance: defenderStance, factionId: null },
        maxRounds: 1,
      }),
    );

  it('trades output for survivability across the three stances', () => {
    const push = run('aggressivePush');
    const balanced = run('balanced');
    const shield = run('shieldArchers');

    expect(push.rounds[0]!.attacker.finalOutput).toBeGreaterThan(
      balanced.rounds[0]!.attacker.finalOutput,
    );
    expect(shield.rounds[0]!.attacker.finalOutput).toBeLessThan(
      balanced.rounds[0]!.attacker.finalOutput,
    );
  });

  it('makes an aggressive push cost the pusher more casualties', () => {
    const seeds = [3, 9, 27, 81, 243];
    const avg = (stance: Stance) =>
      seeds.reduce((sum, seed) => {
        const r = resolveBattle(
          battle({
            attacker: { troops: { militia: 40 }, stance, factionId: null },
            defender: { troops: { militia: 40 }, stance: 'balanced', factionId: null },
            seed,
            maxRounds: 1,
          }),
        );
        return sum + troopCount(r.attackerLosses);
      }, 0) / seeds.length;

    expect(avg('aggressivePush')).toBeGreaterThan(avg('balanced'));
  });

  it('shields archers from casualties when told to', () => {
    // Sized so casualties are PARTIAL. Against an overwhelming attacker the
    // whole army dies whatever its stance, and the protection has nothing to
    // show — that is correct behaviour, not a bug, so the test avoids it.
    const seeds = [5, 15, 45, 135];
    const archerLosses = (stance: Stance) =>
      seeds.reduce((sum, seed) => {
        const r = resolveBattle(
          battle({
            attacker: { troops: { knights: 20 }, stance: 'balanced', factionId: null },
            defender: { troops: { militia: 20, archers: 20 }, stance, factionId: null },
            seed,
            maxRounds: 1,
          }),
        );
        return sum + (r.defenderLosses.archers ?? 0);
      }, 0);

    expect(archerLosses('shieldArchers')).toBeLessThan(archerLosses('balanced'));
  });

  it('makes militia soak casualties before the specialists', () => {
    // Militia have one job per the design doc. A light attack should be
    // absorbed entirely by them, leaving archers and knights untouched.
    const r = resolveBattle(
      battle({
        attacker: { troops: { militia: 10 }, stance: 'balanced', factionId: null },
        defender: {
          troops: { militia: 40, archers: 20, knights: 10 },
          stance: 'balanced',
          factionId: null,
        },
        maxRounds: 1,
      }),
    );
    expect(r.defenderLosses.militia ?? 0).toBeGreaterThan(0);
    expect(r.defenderLosses.archers ?? 0).toBe(0);
    expect(r.defenderLosses.knights ?? 0).toBe(0);
  });

  it('exposes every stance the design doc names', () => {
    expect(Object.keys(STANCES).sort()).toEqual([
      'aggressivePush',
      'balanced',
      'shieldArchers',
    ]);
  });
});

describe('battle resolver — the breakdown', () => {
  it('records each modifier separately rather than one opaque number', () => {
    // The design doc calls for a full math breakdown after the fight, so a
    // player can see WHY they lost, not just that they did.
    const r = resolveBattle(
      battle({
        attacker: { troops: { knights: 30 }, stance: 'aggressivePush', factionId: factionId('knight') },
        defender: { troops: { archers: 40 }, stance: 'balanced', factionId: factionId('warden') },
        terrain: 'hills',
        maxRounds: 1,
      }),
    );

    const atk = r.rounds[0]!.attacker;
    const labels = atk.modifiers.map((m) => m.label);
    expect(labels).toContain('Aggressive Push stance');
    expect(labels.some((l) => l.includes('Archers-heavy'))).toBe(true);
    expect(labels.some((l) => l.includes('The Knight'))).toBe(true);

    // Applying the recorded modifiers to the recorded base must reproduce the
    // recorded final — otherwise the breakdown is decorative.
    const recomputed = atk.modifiers.reduce((acc, m) => acc * m.factor, atk.baseOutput);
    expect(recomputed).toBeCloseTo(atk.finalOutput, 1);
  });

  it('applies faction defence to the defender and attack to the attacker', () => {
    const r = resolveBattle(
      battle({
        attacker: { troops: { militia: 30 }, stance: 'balanced', factionId: factionId('knight') },
        defender: { troops: { militia: 30 }, stance: 'balanced', factionId: factionId('warden') },
        maxRounds: 1,
      }),
    );
    expect(r.rounds[0]!.attacker.modifiers.some((m) => m.label === 'The Knight attack')).toBe(true);
    expect(r.rounds[0]!.defender.modifiers.some((m) => m.label === 'The Warden defence')).toBe(true);
  });

  it('terminates instead of looping when neither side can hurt the other', () => {
    const r = resolveBattle(
      battle({
        attacker: { troops: { militia: 1 }, stance: 'shieldArchers', factionId: null },
        defender: { troops: { knights: 1 }, stance: 'shieldArchers', factionId: null },
        maxRounds: 50,
      }),
    );
    expect(r.rounds.length).toBeLessThan(50);
  });
});
