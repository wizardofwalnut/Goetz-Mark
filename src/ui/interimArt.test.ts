import { describe, expect, it } from 'vitest';
import { INTERIM_VISUALS, awaitedArtKeys } from './interimArt';
import { MANIFEST, pendingKeys, resolveAsset } from '../assets/assetManifest';

/**
 * Guards on the interim-art allowance.
 *
 * The project rule is that PixelLab generates all shipping art and hand-coded
 * visuals are a tracked stopgap only. These tests make the tracking real: the
 * register cannot name art nobody queued, and — critically — a stopgap cannot
 * outlive the asset that was supposed to replace it.
 */

describe('interim art register', () => {
  it('names only manifest keys that actually exist', () => {
    for (const visual of INTERIM_VISUALS) {
      for (const key of visual.replacedBy) {
        expect(MANIFEST.entries[key], `${visual.where} → ${key}`).toBeDefined();
      }
    }
  });

  it('flags any stopgap whose replacement art has already been generated', () => {
    // This is the test that stops interim art becoming permanent. Once a
    // PixelLab asset lands and its `pending` flag is dropped, this fails until
    // the hand-coded stopgap is deleted and its row removed from the register.
    const stale = INTERIM_VISUALS.filter((visual) =>
      visual.replacedBy.every((key) => !resolveAsset([key]).missing),
    ).map((v) => v.where);

    expect(
      stale,
      `Real art now exists for these — delete the interim visual and its register entry:\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('tracks every pending manifest key against something that consumes it', () => {
    // A pending key nothing is waiting on is art queued for no reason; a
    // stopgap waiting on nothing is art that will never arrive. Catch both.
    const awaited = new Set(awaitedArtKeys());
    const orphaned = pendingKeys().filter((k) => !awaited.has(k));

    // Unit and faction-variant sprites have no map-level stopgap yet because
    // armies are not rendered until interactivity lands in the next milestone.
    const expectedUnclaimed = orphaned.every(
      (k) => k.startsWith('unit.') || k === 'ui.waxStamp',
    );
    expect(expectedUnclaimed, `Unexpected orphaned art keys: ${orphaned.join(', ')}`).toBe(
      true,
    );
  });

  it('has a non-empty register while art is still pending', () => {
    // If art were fully generated this list would be empty and the assertion
    // inverted — that is the point at which the allowance is fully retired.
    expect(pendingKeys().length).toBeGreaterThan(0);
    expect(INTERIM_VISUALS.length).toBeGreaterThan(0);
  });
});
