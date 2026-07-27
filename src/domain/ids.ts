/**
 * Branded ID types.
 *
 * These are plain strings at runtime (so they serialize cleanly to JSON /
 * Firestore) but are not interchangeable at compile time — passing a CountyId
 * where an ArmyId is expected is a type error.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type MatchId = Brand<string, 'MatchId'>;
export type PlayerId = Brand<string, 'PlayerId'>;
export type CountyId = Brand<string, 'CountyId'>;
export type ArmyId = Brand<string, 'ArmyId'>;
export type MapId = Brand<string, 'MapId'>;
export type FactionId = Brand<string, 'FactionId'>;
export type MercenaryBandId = Brand<string, 'MercenaryBandId'>;

export const matchId = (v: string) => v as MatchId;
export const playerId = (v: string) => v as PlayerId;
export const countyId = (v: string) => v as CountyId;
export const armyId = (v: string) => v as ArmyId;
export const mapId = (v: string) => v as MapId;
export const factionId = (v: string) => v as FactionId;
export const mercenaryBandId = (v: string) => v as MercenaryBandId;
