/**
 * Resource model.
 *
 * Per the design doc, resources split into two classes with different logistics:
 *
 *   - Building materials (Wood/Ore/Stone/Gold) are POOLED EMPIRE-WIDE in one
 *     shared treasury. There is no shipping decision for these.
 *   - Food (Wheat/Cows) is held PER COUNTY and must be manually shipped
 *     county-to-county by wagon. This is the one real logistics decision.
 *
 * That split is the reason food and materials are separate types rather than
 * one big record — it makes "you cannot pool food" a compile-time property
 * rather than a rule someone has to remember.
 */

export const FOOD_RESOURCES = ['wheat', 'cows'] as const;
export const MATERIAL_RESOURCES = ['wood', 'ore', 'stone', 'gold'] as const;

export type FoodResource = (typeof FOOD_RESOURCES)[number];
export type MaterialResource = (typeof MATERIAL_RESOURCES)[number];
export type Resource = FoodResource | MaterialResource;

export const ALL_RESOURCES: readonly Resource[] = [...FOOD_RESOURCES, ...MATERIAL_RESOURCES];

export const isFood = (r: Resource): r is FoodResource =>
  (FOOD_RESOURCES as readonly string[]).includes(r);

export const isMaterial = (r: Resource): r is MaterialResource =>
  (MATERIAL_RESOURCES as readonly string[]).includes(r);

/** Empire-wide pooled materials. One of these per player, not per county. */
export type Treasury = Record<MaterialResource, number>;

/** Food stored in a single county. Never pooled across counties. */
export type FoodStore = Record<FoodResource, number>;

export const emptyTreasury = (): Treasury => ({ wood: 0, ore: 0, stone: 0, gold: 0 });
export const emptyFoodStore = (): FoodStore => ({ wheat: 0, cows: 0 });

export const RESOURCE_LABELS: Record<Resource, string> = {
  wheat: 'Wheat',
  cows: 'Cows',
  wood: 'Wood',
  ore: 'Ore',
  stone: 'Stone',
  gold: 'Gold',
};
