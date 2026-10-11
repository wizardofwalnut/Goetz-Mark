"""Aldermarch ground/field tiles for the DIAMOND grid, from one flat texture.

Usage: python3 tools/groundgen_iso.py <texture.png> <out.png> [diamond_width] [soil_depth|-] [period]

- Crops the texture to a square, makes it seamless (same wrap-blend as the
  roads), and projects it onto a 2:1 diamond (projection shared with
  roadgen_iso.py, so ground and roads line up exactly).
- Adds a band of soil under the two lower front edges, so a tile reads as a
  raised slab. Tiles are drawn back-to-front (sorted by col + row), so a
  neighbour in front covers the band; it only shows at the county's front
  edges and where a tile has no neighbour, as in the target-look reference.
- Output canvas is W x (W/2 + soil_depth), transparent outside the slab;
  blit with its top-left at the diamond's bounding box.

Defaults: width 288 (the Oct 7 bake target), soil depth 0.12 x width.
"""
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import ImageChops  # noqa: E402


def seamless_narrow(img, band=0.15):
    """Wrap-blend like roadgen.seamless, but only within `band` of each edge."""
    W, H = img.size
    shifted = ImageChops.offset(img, W // 2, H // 2)
    m = Image.new('L', (W, H))
    bw, bh = W * band, H * band
    m.putdata([int(255 * min(1, min(x, W - 1 - x) / bw, min(y, H - 1 - y) / bh))
               for y in range(H) for x in range(W)])
    return Image.composite(img, shifted, m)


SOIL_LEFT = (104, 72, 46)    # lit side (light comes from the upper left)
SOIL_RIGHT = (78, 53, 34)    # shaded side


def build(tex_path, out_path, W=288, depth=None, period=1):
    """period > 1: the texture spans a period x period block of tiles and is
    cut into period^2 variants, written as <out>-<i><j>.png. The game picks the
    variant for tile (col, row) as (col % period, row % period), so neighbours
    continue one texture and a pattern repeats only every `period` tiles."""
    H = W // 2
    depth = round(W * 0.12) if depth is None else depth
    tex = Image.open(tex_path).convert('RGB')
    side = min(tex.size)
    # Grok's "seamless" textures come with soft, blurred borders: drop the
    # outer 8% before making the tile seamless ourselves.
    m8 = round(side * 0.08)
    tex = tex.crop((m8, m8, side - m8, side - m8)).resize((W * 2 * period,) * 2, Image.LANCZOS)
    # Narrow wrap-blend (Oct 11): the roads' wide blend averaged ~45% of the
    # tile, which on grass showed as a lighter, softer patch repeating on
    # every tile. A ~15% band hides the seam without a visible pattern.
    sq = seamless_narrow(tex).convert('RGB')
    # Tile the seamless square 3x3 and project from the centre copy, so pixels
    # just outside the diamond still carry real texture. The mask is grown by
    # ~1.5 px so neighbouring tiles overlap instead of leaving a hairline gap.
    s = sq.size[0]
    big = Image.new('RGB', (3 * s, 3 * s))
    for i in range(3):
        for j in range(3):
            big.paste(sq, (i * s, j * s))
    t = s / period
    g = 1.5
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([(W / 2, -g), (W + 2 * g, H / 2), (W / 2, H + g), (-2 * g, H / 2)], fill=255)
    stem, ext = os.path.splitext(out_path)
    written = []
    for i in range(period):
        for j in range(period):
            coeffs = (t / W, t / H, -t / 2 + s + i * t, -t / W, t / H, t / 2 + s + j * t)
            top = big.transform((W, H), Image.AFFINE, coeffs, resample=Image.BICUBIC).convert('RGBA')
            top.putalpha(m)
            out = Image.new('RGBA', (W, H + depth), (0, 0, 0, 0))
            d = ImageDraw.Draw(out)
            d.polygon([(0, H / 2), (W / 2, H), (W / 2, H + depth), (0, H / 2 + depth)], fill=SOIL_LEFT + (255,))
            d.polygon([(W / 2, H), (W, H / 2), (W, H / 2 + depth), (W / 2, H + depth)], fill=SOIL_RIGHT + (255,))
            out.alpha_composite(top, (0, 0))
            path = out_path if period == 1 else f'{stem}-{i}{j}{ext}'
            out.save(path)
            written.append(path)
    return (W, H + depth), written


if __name__ == '__main__':
    a = sys.argv
    print(build(a[1], a[2], int(a[3]) if len(a) > 3 else 288,
                int(a[4]) if len(a) > 4 and a[4] != '-' else None,
                int(a[5]) if len(a) > 5 else 1))
