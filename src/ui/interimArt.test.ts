import { describe, expect, it } from 'vitest';
import { INTERIM_VISUALS, PLANNED_ART, awaitedArtKeys, isPlanned } from './interimArt';
import { MANIFEST, manifestKeys, pendingKeys, resolveAsset } from '../assets/assetManifest';

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

  it('accounts for every pending manifest key', () => {
    // Every queued asset must be justified one of two ways: something visible
    // is standing in for it right now, or it is named against a surface that
    // will consume it. Art ordered for neither reason is art nobody asked for.
    const awaited = new Set(awaitedArtKeys());
    const unaccounted = pendingKeys().filter((k) => !awaited.has(k) && !isPlanned(k));

    expect(
      unaccounted,
      `Pending art with no stopgap waiting on it and no planned surface — either add it to ` +
        `INTERIM_VISUALS, name it in PLANNED_ART, or drop it from the manifest:\n${unaccounted.join('\n')}`,
    ).toEqual([]);
  });

  it('does not leave a planned group pointing at art nobody queued', () => {
    // The mirror of the test above: a planned surface listing prefixes that
    // match no manifest entry means the art was never actually ordered.
    for (const planned of PLANNED_ART) {
      for (const prefix of planned.keyPrefixes) {
        const matches = manifestKeys().filter((k) => k.startsWith(prefix));
        expect(matches.length, `${planned.forSurface} → ${prefix}`).toBeGreaterThan(0);
      }
    }
  });

  it('has a non-empty register while art is still pending', () => {
    // If art were fully generated this list would be empty and the assertion
    // inverted — that is the point at which the allowance is fully retired.
    expect(pendingKeys().length).toBeGreaterThan(0);
    expect(INTERIM_VISUALS.length).toBeGreaterThan(0);
  });
});
