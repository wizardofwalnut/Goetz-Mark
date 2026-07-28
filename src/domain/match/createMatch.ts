import { armyId, countyId, matchId, playerId } from '../ids';
import type { CountyId, FactionId, PlayerId } from '../ids';
import { emptyFoodStore, emptyTreasury } from '../resources';
import { createInterior } from '../county/interior';
import type { GameMap } from '../map/mapTypes';
import {
  MATCH_SCHEMA_VERSION,
  type Army,
  type CountyState,
  type MatchConfig,
  type MatchState,
  type Player,
  type PlayerController,
} from './matchState';

/**
 * Match creation.
 *
 * There is deliberately ONE way to start a game. A solo game against the AI is
 * `createMatch` with one human seat and the rest AI — it does not get its own
 * constructor, because the moment it does, the two paths drift and the
 * multiplayer one stops being the tested one.
 */

export interface SeatSpec {
  readonly displayName: string;
  readonly factionId: FactionId;
  readonly controller: PlayerController;
}

export interface CreateMatchOptions {
  readonly id?: string;
  readonly map: GameMap;
  readonly seats: readonly SeatSpec[];
  readonly config?: Partial<Omit<MatchConfig, 'mapId'>>;
  readonly now?: number;
  /** Injected so tests and replays are deterministic. */
  readonly rng?: () => number;
}

const DEFAULT_CONFIG: Omit<MatchConfig, 'mapId'> = {
  turnTimerHours: null,
  // Leaning auto-skip per the design doc's open question — configurable so
  // playtesting can change it without a code change.
  timeoutPolicy: 'autoSkip',
  victoryConditions: [{ kind: 'elimination' }],
  allyBetrayalCooldownTurns: 4,
};

const STARTING_POPULATION = 240;
const STARTING_HAPPINESS = 70;
const NEUTRAL_HAPPINESS = 50;
const STARTING_FOOD = { wheat: 180, cows: 40 };
const STARTING_TREASURY = { wood: 40, ore: 20, stone: 10, gold: 500 };
const STARTING_GARRISON = { militia: 12 } as const;

export function createMatch(options: CreateMatchOptions): MatchState {
  const { map, seats } = options;
  const now = options.now ?? Date.now();
  const rng = options.rng ?? Math.random;

  if (seats.length < map.minPlayers || seats.length > map.maxPlayers) {
    throw new Error(
      `${map.name} supports ${map.minPlayers}-${map.maxPlayers} players, got ${seats.length}`,
    );
  }
  if (seats.length > map.starts.length) {
    throw new Error(`${map.name} defines only ${map.starts.length} starting positions`);
  }

  const id = matchId(options.id ?? `m_${Math.floor(rng() * 1e12).toString(36)}`);

  const players: Player[] = seats.map((seat, i) => ({
    id: playerId(`p${i}`),
    seat: i,
    displayName: seat.displayName,
    factionId: seat.factionId,
    controller: seat.controller,
    status: 'active',
  }));

  const startByCounty = new Map<CountyId, PlayerId>();
  for (const player of players) {
    const start = map.starts.find((s) => s.seat === player.seat);
    if (!start) throw new Error(`Map has no starting position for seat ${player.seat}`);
    startByCounty.set(start.county, player.id);
  }

  const counties: Record<CountyId, CountyState> = {};
  for (const def of map.counties) {
    const owner = startByCounty.get(def.id) ?? null;
    counties[def.id] = {
      owner,
      // Starts open with the first real castle; the palisade is a step players
      // build for themselves on newly taken ground.
      castleTier: owner ? 'motteAndBailey' : 'none',
      building: null,
      food: owner ? { ...STARTING_FOOD } : emptyFoodStore(),
      happiness: owner ? STARTING_HAPPINESS : NEUTRAL_HAPPINESS,
      population: owner ? STARTING_POPULATION : Math.round(60 + def.size * 25),
      agricultureShare: 0.6,
      rationLevel: 1,
      seasonsAtRation: 0,
      unrestTurns: 0,
      // Interiors are generated for every county, not just owned ones — an
      // attacker must be able to see what they are marching into, and
      // generating on capture would change the board mid-match.
      interior: createInterior({ size: def.size, resource: def.resource, rng }),
    };
  }

  const armies: Record<string, Army> = {};
  for (const [county, owner] of startByCounty) {
    const id = armyId(`a_${owner}_0`);
    armies[id] = {
      id,
      owner,
      troops: { ...STARTING_GARRISON },
      location: { kind: 'garrison', county },
      movementRemaining: 0,
      unpaidUpkeepTurns: 0,
    };
  }

  const treasuries: Record<PlayerId, ReturnType<typeof emptyTreasury>> = {};
  for (const player of players) {
    treasuries[player.id] = { ...emptyTreasury(), ...STARTING_TREASURY };
  }

  const config: MatchConfig = { ...DEFAULT_CONFIG, ...options.config, mapId: map.id };

  return {
    id,
    schemaVersion: MATCH_SCHEMA_VERSION,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    config,
    players,
    turn: {
      number: 1,
      activeSeat: 0,
      phase: 'orders',
      startedAt: now,
      deadlineAt:
        config.turnTimerHours === null ? null : now + config.turnTimerHours * 3_600_000,
    },
    counties,
    armies,
    treasuries,
    winner: null,
  };
}

/**
 * A solo game is a real match with AI opponents in the other seats — the same
 * shape that will sync through Firebase in Milestone 2. This helper exists for
 * convenience only; it adds no structure of its own.
 */
export function createSoloMatch(opts: {
  map: GameMap;
  playerName: string;
  factionId: FactionId;
  opponents: readonly { factionId: FactionId; name: string }[];
  difficulty?: 'meek' | 'steady' | 'ruthless';
  now?: number;
  rng?: () => number;
}): MatchState {
  const difficulty = opts.difficulty ?? 'steady';
  return createMatch({
    map: opts.map,
    now: opts.now,
    rng: opts.rng,
    seats: [
      {
        displayName: opts.playerName,
        factionId: opts.factionId,
        controller: { kind: 'human', userId: null },
      },
      ...opts.opponents.map((o) => ({
        displayName: o.name,
        factionId: o.factionId,
        controller: { kind: 'ai' as const, difficulty },
      })),
    ],
  });
}

/** Convenience for callers that only have a raw string id. */
export const asCountyId = countyId;
