import type { ResolvedAsset } from '../assets/assetManifest';

/**
 * Renders a manifest-resolved asset, or its fallback when the art is not there.
 *
 * Every art-bearing spot in the UI goes through this so the pending case is
 * handled once rather than at each call site. Art lands incrementally — a
 * component must not care whether a given sprite exists yet.
 *
 * Note it takes a ResolvedAsset, never a path or a key string. Callers get one
 * from a typed accessor (`castleArt`, `resourceArt`, …), which is what keeps
 * file paths out of component code.
 */

interface SpriteProps {
  readonly asset: ResolvedAsset;
  readonly size: number;
  /** Drawn when the art is missing. Falls back to nothing if not supplied. */
  readonly fallback?: React.ReactNode;
  readonly alt: string;
  readonly className?: string;
}

export function Sprite({ asset, size, fallback, alt, className }: SpriteProps) {
  if (asset.missing || !asset.url) return <>{fallback ?? null}</>;

  return (
    <img
      className={className}
      src={asset.url}
      width={size}
      height={size}
      alt={alt}
      // Generated art is pixel art — smoothing it on upscale destroys it.
      style={{ imageRendering: 'pixelated' }}
      loading="lazy"
    />
  );
}
