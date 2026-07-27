import type { FactionId } from '../ids';
import type { Regiment, UnitKind } from '../match/matchState';
import { troopCount } from '../match/matchState';
import { COUNTER_BONUS, COUNTER_THRESHOLD, UNITS } from '../../content/units';
import { TERRAIN_DEFENCE_MODIFIER, type Terrain } from '../map/mapTypes';
import { FACTIONS_BY_ID } from '../../content/factions';
import { createRng, type Rng } from '../rng';

/**
 * Stat/stance auto-resolve combat.
 *
 * This REPLACES the source game's real-time battles entirely — the design doc
 * is explicit that the substitution is deliberate, so this file does not try to
 * approximate a real-time fight. A tactical grid mode is a later stretch goal,
 * and auto-resolve stays available as "quick battle" even after it ships.
 *
 * Two properties this must hold:
 *
 *  1. DETERMINISM. Same inputs and seed, same result, on every device. Nothing
 *     here reads the clock or Math.random.
 *  2. EXPLICABILITY. The design doc calls for a full math breakdown after the
 *     fight, so every multiplier is recorded as it is applied rather than
 *     folded into a single number. `BattleResult.rounds` is a transcript, not
 *     a summary.
 */

export type Stance = 'balanced' | 'shieldArchers' | 'aggressivePush';

export interface StanceProfile {
  readonly id: Stance;
  readonly name: string;
  readonly blurb: string;
  /** Multiplier on damage dealt. */
  readonly attack: number;
  /** Multiplier on damage received (lower is better). */
  readonly damageTaken: number;
  /** Share of casualties archers are shielded from, 0..1. */
  readonly archerProtection: number;
}

export const STANCES: Readonly<Record<Stance, StanceProfile>> = {
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    blurb: 'Hold the line and trade evenly.',
    attack: 1.0,
    damageTaken: 1.0,
    archerProtection: 0,
  },
  shieldArchers: {
    id: 'shieldArchers',
    name: 'Shield the Archers',
    blurb: 'Foot ranks absorb the charge so the bows keep firing.',
    attack: 0.9,
    damageTaken: 0.85,
    archerProtection: 0.6,
  },
  aggressivePush: {
    id: 'aggressivePush',
    name: 'Aggressive Push',
    blurb: 'Break them quickly, and accept the butcher’s bill.',
    attack: 1.3,
    damageTaken: 1.25,
    archerProtection: 0,
  },
};

export interface Combatant {
  readonly troops: Regiment;
  readonly stance: Stance;
  readonly factionId: FactionId | null;
}

export interface BattleInput {
  readonly attacker: Combatant;
  readonly defender: Combatant;
  readonly terrain: Terrain;
  /** Stored in match state so the fight can be replayed identically. */
  readonly seed: number;
  /** Safety valve against two immovable armies. */
  readonly maxRounds?: number;
}

/** One multiplier, recorded at the point it was applied. */
export interface Modifier {
  readonly label: string;
  readonly factor: number;
}

export interface SideRound {
  readonly troopsBefore: Regiment;
  readonly baseOutput: number;
  readonly modifiers: readonly Modifier[];
  readonly finalOutput: number;
  readonly casualtiesTaken: number;
  readonly losses: Regiment;
}

export interface BattleRound {
  readonly number: number;
  readonly attacker: SideRound;
  readonly defender: SideRound;
}

export type BattleOutcome = 'attackerWins' | 'defenderHolds' | 'mutualDestruction' | 'stalemate';

export interface BattleResult {
  readonly outcome: BattleOutcome;
  readonly rounds: readonly BattleRound[];
  readonly attackerSurvivors: Regiment;
  readonly defenderSurvivors: Regiment;
  readonly attackerLosses: Regiment;
  readonly defenderLosses: Regiment;
  readonly terrain: Terrain;
  readonly seed: number;
}

const KINDS: readonly UnitKind[] = ['militia', 'archers', 'knights', 'mercenaries'];

const clone = (r: Regiment): Regiment => ({ ...r });

const emptyRegiment = (): Regiment => ({});

function subtract(a: Regiment, b: Regiment): Regiment {
  const out: Regiment = {};
  for (const kind of KINDS) {
    const diff = (a[kind] ?? 0) - (b[kind] ?? 0);
    if (diff > 0) out[kind] = diff;
  }
  return out;
}

/** Share of an army made up of each unit kind. */
function composition(r: Regiment): Record<UnitKind, number> {
  const total = troopCount(r);
  const out = { militia: 0, archers: 0, knights: 0, mercenaries: 0 };
  if (total === 0) return out;
  for (const kind of KINDS) out[kind] = (r[kind] ?? 0) / total;
  return out;
}

/**
 * Counter-triangle bonus.
 *
 * Archers punish militia-heavy stacks, knights punish archer-heavy ones. The
 * bonus only applies once the enemy is ACTUALLY committed to that unit — a
 * token few archers should not hand the enemy a knight bonus — which is what
 * COUNTER_THRESHOLD enforces.
 */
function counterModifiers(own: Regiment, enemy: Regiment): Modifier[] {
  const ownShare = composition(own);
  const enemyShare = composition(enemy);
  const mods: Modifier[] = [];

  for (const kind of KINDS) {
    if (ownShare[kind] === 0) continue;
    const against = COUNTER_BONUS[kind];
    for (const [enemyKind, factor] of Object.entries(against) as [UnitKind, number][]) {
      if (enemyShare[enemyKind] < COUNTER_THRESHOLD) continue;
      // Weight by how much of OUR army can actually exploit the matchup, so a
      // handful of knights does not multiply the whole line's output.
      const weighted = 1 + (factor - 1) * ownShare[kind];
      mods.push({
        label: `${UNITS[kind].name} vs ${UNITS[enemyKind].name}-heavy`,
        factor: round3(weighted),
      });
    }
  }
  return mods;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Raw offensive power before any modifier. */
function baseOutput(r: Regiment, attacking: boolean): number {
  let total = 0;
  for (const kind of KINDS) {
    const count = r[kind] ?? 0;
    if (count === 0) continue;
    total += count * (attacking ? UNITS[kind].attack : UNITS[kind].defence);
  }
  return total;
}

function factionModifier(factionId: FactionId | null, attacking: boolean): Modifier | null {
  if (!factionId) return null;
  const faction = FACTIONS_BY_ID[factionId];
  if (!faction) return null;
  const factor = attacking ? faction.bonuses.attack : faction.bonuses.defence;
  if (factor === 1) return null;
  return { label: `${faction.name} ${attacking ? 'attack' : 'defence'}`, factor };
}

/**
 * Distribute casualties across an army.
 *
 * Militia soak first — that is their entire job per the design doc — then
 * mercenaries, then archers, with knights last because they are the hardest to
 * kill and the most expensive to replace. `archerProtection` from the stance
 * pushes archers further down that order.
 */
function applyCasualties(
  troops: Regiment,
  damage: number,
  archerProtection: number,
  rng: Rng,
): { losses: Regiment; remaining: Regiment } {
  const order: UnitKind[] =
    archerProtection > 0
      ? ['militia', 'mercenaries', 'knights', 'archers']
      : ['militia', 'mercenaries', 'archers', 'knights'];

  const losses: Regiment = {};
  const remaining = clone(troops);
  // Small variance so identical armies do not always trade identically, while
  // staying fully determined by the seed.
  let pool = damage * rng.range(0.92, 1.08);

  for (const kind of order) {
    if (pool <= 0) break;
    const available = remaining[kind] ?? 0;
    if (available === 0) continue;

    const hardiness = UNITS[kind].hardiness;
    const protection = kind === 'archers' ? 1 - archerProtection : 1;
    const effective = pool * protection;
    const killable = Math.floor(effective / hardiness);
    const killed = Math.min(available, Math.max(0, killable));

    if (killed > 0) {
      losses[kind] = killed;
      remaining[kind] = available - killed;
      if (remaining[kind] === 0) delete remaining[kind];
    }
    pool -= (killed * hardiness) / protection;
  }

  return { losses, remaining };
}

export function resolveBattle(input: BattleInput): BattleResult {
  const { terrain, seed } = input;
  const maxRounds = input.maxRounds ?? 12;
  const rng = createRng(seed);

  let attackerTroops = clone(input.attacker.troops);
  let defenderTroops = clone(input.defender.troops);

  const attackerStance = STANCES[input.attacker.stance];
  const defenderStance = STANCES[input.defender.stance];
  const rounds: BattleRound[] = [];

  const buildSide = (
    troops: Regiment,
    enemy: Regiment,
    stance: StanceProfile,
    factionId: FactionId | null,
    attacking: boolean,
  ) => {
    const base = baseOutput(troops, attacking);
    const mods: Modifier[] = [];

    if (stance.attack !== 1) mods.push({ label: `${stance.name} stance`, factor: stance.attack });
    mods.push(...counterModifiers(troops, enemy));

    const faction = factionModifier(factionId, attacking);
    if (faction) mods.push(faction);

    // Terrain favours whoever is holding the ground, never the attacker.
    if (!attacking) {
      const factor = TERRAIN_DEFENCE_MODIFIER[terrain];
      if (factor !== 1) mods.push({ label: `${terrain} terrain`, factor });
    }

    const final = mods.reduce((acc, m) => acc * m.factor, base);
    return { base, mods, final };
  };

  for (let n = 1; n <= maxRounds; n++) {
    if (troopCount(attackerTroops) === 0 || troopCount(defenderTroops) === 0) break;

    const atk = buildSide(
      attackerTroops,
      defenderTroops,
      attackerStance,
      input.attacker.factionId,
      true,
    );
    const def = buildSide(
      defenderTroops,
      attackerTroops,
      defenderStance,
      input.defender.factionId,
      false,
    );

    // Both sides strike simultaneously, so neither gains an edge purely from
    // being the one who declared the attack — position and stance decide it.
    const toDefender = atk.final * defenderStance.damageTaken;
    const toAttacker = def.final * attackerStance.damageTaken;

    const defHit = applyCasualties(
      defenderTroops,
      toDefender / 10,
      defenderStance.archerProtection,
      rng,
    );
    const atkHit = applyCasualties(
      attackerTroops,
      toAttacker / 10,
      attackerStance.archerProtection,
      rng,
    );

    rounds.push({
      number: n,
      attacker: {
        troopsBefore: clone(attackerTroops),
        baseOutput: round3(atk.base),
        modifiers: atk.mods,
        finalOutput: round3(atk.final),
        casualtiesTaken: troopCount(atkHit.losses),
        losses: atkHit.losses,
      },
      defender: {
        troopsBefore: clone(defenderTroops),
        baseOutput: round3(def.base),
        modifiers: def.mods,
        finalOutput: round3(def.final),
        casualtiesTaken: troopCount(defHit.losses),
        losses: defHit.losses,
      },
    });

    attackerTroops = atkHit.remaining;
    defenderTroops = defHit.remaining;

    // Neither side can hurt the other — stop rather than loop to maxRounds.
    if (troopCount(atkHit.losses) === 0 && troopCount(defHit.losses) === 0) break;
  }

  const attackerLeft = troopCount(attackerTroops);
  const defenderLeft = troopCount(defenderTroops);

  let outcome: BattleOutcome;
  if (attackerLeft === 0 && defenderLeft === 0) outcome = 'mutualDestruction';
  else if (defenderLeft === 0) outcome = 'attackerWins';
  else if (attackerLeft === 0) outcome = 'defenderHolds';
  // A surviving defender holds the ground: taking a castle requires clearing
  // it, so an inconclusive fight is not a capture.
  else outcome = 'stalemate';

  return {
    outcome,
    rounds,
    attackerSurvivors: attackerTroops,
    defenderSurvivors: defenderTroops,
    attackerLosses: subtract(input.attacker.troops, attackerTroops),
    defenderLosses: subtract(input.defender.troops, defenderTroops),
    terrain,
    seed,
  };
}

/**
 * Whether a battle result hands the county to the attacker.
 *
 * Only a cleared field takes ground — mutual destruction leaves nobody to
 * occupy it, and a stalemate leaves the defender in place.
 */
export const attackerTakesGround = (r: BattleResult) => r.outcome === 'attackerWins';

export { emptyRegiment };
