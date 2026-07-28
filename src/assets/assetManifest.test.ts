import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  MANIFEST,
  castleArt,
  crestArt,
  manifestKeys,
  resolveAsset,
  terrainArt,
  unitArt,
} from './assetManifest';
import { CASTLE_TIERS } from '../domain/match/matchState';
import { FACTIONS } from '../content/factions';
import { ALL_RESOURCES } from '../domain/resources';
import { factionId } from '../domain/ids';

describe('asset manifest', () => {
  it('declares an entry for every terrain, castle tier, unit and resource', () => {
    // Coverage, not availability. An undeclared thing has no art route at all,
    // which is a worse problem than art that is merely queued.
    for (const t of ['open', 'forest', 'hills', 'chokepoint'] as const) {
      expect(terrainArt(t).declared, t).toBe(true);
    }
    // 'none' is excluded on purpose: no castle means nothing is drawn. All
    // five buildable tiers must have a route, including the two the later
    // county-screen spec added.
    for (const tier of CASTLE_TIERS.filter((t) => t !== 'none')) {
      expect(castleArt(tier).declared, tier).toBe(true);
    }
    expect(castleArt('none').declared).toBe(false);
    for (const kind of ['militia', 'archers', 'knights', 'mercenaries'] as const) {
      expect(unitArt(kind).declared, kind).toBe(true);
    }
    for (const r of ALL_RESOURCES) {
      expect(resolveAsset([`resource.${r}`]).declared, r).toBe(true);
    }
  });

  it('gives every faction a crest', () => {
    for (const f of FACTIONS) {
      expect(crestArt(f.id).declared, f.id).toBe(true);
    }
  });

  it('never returns a url for art that has not been generated', () => {
    // Regression: the first render pointed SVG pattern fills at declared-but-
    // ungenerated paths. Every one 404'd and the map filled with the browser's
    // broken-image glyph instead of the designed fallback tint.
    for (const key of manifestKeys()) {
      const resolved = resolveAsset([key]);
      if (MANIFEST.entries[key]?.pending) {
        expect(resolved.url, key).toBeNull();
        expect(resolved.missing, key).toBe(true);
      } else {
        expect(resolved.url, key).not.toBeNull();
      }
    }
  });

  it('prefers faction art, then generic, and skips pending entries either way', () => {
    // Both are pending today, so both report missing — but the preference
    // order must still be right, because that is what starts working the
    // moment art lands.
    const knight = unitArt('knights', factionId('knight'));
    const warden = unitArt('knights', factionId('warden'));

    expect(knight.declared).toBe(true);
    expect(warden.declared).toBe(true);

    // With a manifest where the generic is ready and the faction sprite is not,
    // resolution must fall through rather than returning the pending one.
    const partial = {
      ...MANIFEST,
      entries: {
        'unit.knights': { path: 'unit/knights.png' },
        'unit.knights.knight': { pending: true, path: 'unit/knights-knight.png' },
      },
    };
    expect(resolveAsset(['unit.knights.knight', 'unit.knights'], partial).key).toBe(
      'unit.knights',
    );
  });

  it('reports missing rather than throwing for an unknown key', () => {
    const result = resolveAsset(['unit.trebuchet']);
    expect(result.missing).toBe(true);
    expect(result.declared).toBe(false);
    expect(result.url).toBeNull();
  });

  it('builds urls under the configured base path once art is ready', () => {
    const ready = {
      ...MANIFEST,
      entries: { 'terrain.hills': { path: 'terrain/hills.png', tile: true } },
    };
    expect(resolveAsset(['terrain.hills'], ready).url).toBe('/art/terrain/hills.png');
  });

  it('declares no duplicate file paths', () => {
    const paths = Object.values(MANIFEST.entries).map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('marks terrain tiles as seamlessly tileable', () => {
    // Terrain is drawn as a repeating fill; a non-tiling texture seams visibly.
    // Read from the entry directly — `tile` on a resolved asset is false while
    // the art is still pending, which says nothing about the declaration.
    for (const t of ['open', 'forest', 'hills', 'chokepoint'] as const) {
      expect(MANIFEST.entries[`terrain.${t}`]?.tile, t).toBe(true);
    }
  });

  it('gives every nine-slice exactly four insets', () => {
    for (const [key, entry] of Object.entries(MANIFEST.entries)) {
      if (!entry.nineSlice) continue;
      expect(entry.nineSlice, key).toHaveLength(4);
    }
  });
});

describe('no hardcoded art paths in game code', () => {
  /**
   * This is the test that actually enforces the structural rule. Everything
   * else above checks the manifest is well-formed; this checks nobody has
   * bypassed it.
   */
  const SRC = join(process.cwd(), 'src');
  const IMAGE_REF = /['"`][^'"`]*\.(png|jpe?g|webp|gif|svg)['"`]/i;

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
    });

  it('references image files only from the manifest', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      // The manifest module is the one place allowed to know about paths.
      if (file.endsWith('assetManifest.ts') || file.endsWith('assetManifest.test.ts')) continue;

      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return;
        if (IMAGE_REF.test(line)) {
          offenders.push(`${file.replace(process.cwd(), '.')}:${i + 1}  ${line.trim()}`);
        }
      });
    }

    expect(
      offenders,
      `Game code must resolve art through the manifest, not name files directly:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('exposes a stable key list for the art pipeline to fill', () => {
    expect(manifestKeys().length).toBeGreaterThan(20);
  });
});
