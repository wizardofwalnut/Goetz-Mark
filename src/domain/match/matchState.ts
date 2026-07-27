import type { ArmyId, CountyId, FactionId, MapId, MatchId, PlayerId } from '../ids';
import type { FoodStore, Treasury } from '../resources';

/**
 * Match state — the single source of truth for a game in progress.
 *
 * ARCHITECTURAL CONTRACT (do not break this, it is why the file looks like it
 * does):
 *
 *  1. Every match has a `players` array, even a solo one. A single-player game
 *     is a Match with one human player and N AI players — there is no separate
 *     single-player data structure anywhere in this codebase.
 *
 *  2. Everything here is JSON-serializable. No class instances, no Map/Set, no
 *     Date objects, no functions, no undefined-as-a-value. Timestamps are epoch
 *     milliseconds. This state is written to Firestore verbatim in Milestone 2,
 *     so anything that does not survive `JSON.parse(JSON.stringify(x))` does
 *     not belong in it.
 *
 *  3. Collections are keyed records, not arrays, wherever an entry is addressed
 *     by id. Firestore merges keyed maps field-by-field; it replaces arrays
 *     wholesale. `players` is the deliberate exception — seat order is
 *     meaningful and the list is fixed at match creation.
 *
 *  4. Derived values are never stored. Army strength, income, and territory
 *     counts are computed from this state, so two clients cannot disagree
 *     about them.
 */

export const MATCH_SCHEMA_VERSION = 1;

export type UnitKind = 'militia' | 'archers' | 'knights' | 'mercenaries';

/** Troop counts. Absent kinds are treated as zero. */
export type Regiment = Partial<Record<UnitKind, number>>;

export type PlayerController =
  | { readonly kind: 'human'; readonly userId: string | null }
  | { readonly kind: 'ai'; readonly difficulty: 'meek' | 'steady' | 'ruthless' };

export type PlayerStatus = 'active' | 'eliminated' | 'resigned';

export interface Player {
  readonly id: PlayerId;
  /** 0-based seat. Fixed at creation; determines turn order and map start. */
  readonly seat: number;
  readonly displayName: string;
  readonly factionId: FactionId;
  readonly controller: PlayerController;
  readonly status: PlayerStatus;
}

export const isHuman = (p: Player) => p.controller.kind === 'human';
export const isAi = (p: Player) => p.controller.kind === 'ai';

export type VictoryCondition =
  | { readonly kind: 'elimination' }
  | { readonly kind: 'holdCounty'; readonly county: CountyId; readonly turns: number }
  | { readonly kind: 'countyThreshold'; readonly count: number }
  | { readonly kind: 'turnCapScoring'; readonly turns: number };

/**
 * Fallback when a player misses their turn timer.
 *
 * Design doc lists this as an open question (auto-skip vs. AI takeover), leaning
 * auto-skip. Modelled as config rather than hardcoded so playtesting can settle
 * it without a code change.
 */
export type TimeoutPolicy = 'autoSkip' | 'aiTakeover';

export interface MatchConfig {
  readonly mapId: MapId;
  /** Host-configurable turn timer in hours. `null` means untimed (solo/hotseat). */
  readonly turnTimerHours: number | null;
  readonly timeoutPolicy: TimeoutPolicy;
  readonly victoryConditions: readonly VictoryCondition[];
  /** Turns a player may not attack a former ally after breaking a pact. */
  readonly allyBetrayalCooldownTurns: number;
}

export type TurnPhase = 'orders' | 'resolution' | 'complete';

export interface TurnState {
  /** 1-based. Increments after the last seat in the order finishes. */
  readonly number: number;
  /** Seat whose turn it currently is. */
  readonly activeSeat: number;
  readonly phase: TurnPhase;
  readonly startedAt: number;
  /** Epoch ms the active player's timer expires, or null if untimed. */
  readonly deadlineAt: number | null;
}

export interface CountyState {
  readonly owner: PlayerId | null;
  readonly castleTier: CastleTier;
  /** Food is stored per county — it is NOT pooled empire-wide. */
  readonly food: FoodStore;
  /** 0..100. Sustained low happiness eventually triggers a revolt. */
  readonly happiness: number;
  readonly population: number;
  /** Fraction of the workforce on agriculture; the rest is on industry. 0..1. */
  readonly agricultureShare: number;
  /** Consecutive turns spent below the revolt threshold. */
  readonly unrestTurns: number;
}

export const CASTLE_TIERS = ['none', 'motteAndBailey', 'normanKeep', 'royalCastle'] as const;
export type CastleTier = (typeof CASTLE_TIERS)[number];

/**
 * An army in the field.
 *
 * `location` covers the mid-transit case from the design doc: an army that
 * cannot finish its move in one turn stops between counties and is attackable
 * there. That is a real decision point, so it is a first-class state, not an
 * animation.
 */
export type ArmyLocation =
  | { readonly kind: 'garrison'; readonly county: CountyId }
  | {
      readonly kind: 'inTransit';
      readonly from: CountyId;
      readonly to: CountyId;
      /** 0..1 along the border link. Where the army is caught if attacked. */
      readonly progress: number;
    };

export interface Army {
  readonly id: ArmyId;
  readonly owner: PlayerId;
  readonly troops: Regiment;
  readonly location: ArmyLocation;
  /** Movement points remaining this turn. */
  readonly movementRemaining: number;
  /**
   * Turns of wages owed to mercenary contingents. Unpaid mercenaries desert,
   * per the design doc.
   */
  readonly unpaidUpkeepTurns: number;
}

export type MatchStatus = 'lobby' | 'active' | 'finished' | 'abandoned';

export interface MatchState {
  readonly id: MatchId;
  /** Bumped when this shape changes, so saved matches can be migrated. */
  readonly schemaVersion: number;
  readonly status: MatchStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly config: MatchConfig;
  /** 2-4 entries. Seat order is turn order. */
  readonly players: readonly Player[];
  readonly turn: TurnState;
  readonly counties: Readonly<Record<CountyId, CountyState>>;
  readonly armies: Readonly<Record<ArmyId, Army>>;
  /** Empire-wide pooled building materials, one pool per player. */
  readonly treasuries: Readonly<Record<PlayerId, Treasury>>;
  readonly winner: PlayerId | null;
}

// ---------------------------------------------------------------------------
// Queries. Derived state is computed, never stored.
// ---------------------------------------------------------------------------

export const activePlayer = (m: MatchState): Player | undefined =>
  m.players.find((p) => p.seat === m.turn.activeSeat);

export const playerById = (m: MatchState, id: PlayerId): Player | undefined =>
  m.players.find((p) => p.id === id);

export const countiesOwnedBy = (m: MatchState, id: PlayerId): CountyId[] =>
  (Object.keys(m.counties) as CountyId[]).filter((c) => m.counties[c]?.owner === id);

export const armiesOwnedBy = (m: MatchState, id: PlayerId): Army[] =>
  Object.values(m.armies).filter((a) => a.owner === id);

export const troopCount = (r: Regiment): number =>
  (r.militia ?? 0) + (r.archers ?? 0) + (r.knights ?? 0) + (r.mercenaries ?? 0);

/**
 * Garrison defending a county. An empty result means the county annexes
 * peacefully rather than forcing a battle — the design doc's deliberate
 * modernisation of the original's "always fight" rule.
 */
export const garrisonOf = (m: MatchState, county: CountyId): Army[] =>
  Object.values(m.armies).filter(
    (a) => a.location.kind === 'garrison' && a.location.county === county,
  );

export const isDefended = (m: MatchState, county: CountyId): boolean =>
  garrisonOf(m, county).some((a) => troopCount(a.troops) > 0);
