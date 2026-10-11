"""Aldermarch ground/field tiles for the DIAMOND grid, from one flat texture.

Usage: python3 tools/groundgen_iso.py <texture.png> <out.png> [diamond_width] [soil_depth]

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
from roadgen import seamless  # noqa: E402


SOIL_LEFT = (104, 72, 46)    # lit side (light comes from the upper left)
SOIL_RIGHT = (78, 53, 34)    # shaded side


def build(tex_path, out_path, W=288, depth=None):
    H = W // 2
    depth = round(W * 0.12) if depth is None else depth
    tex = Image.open(tex_path).convert('RGB')
    side = min(tex.size)
    tex = tex.crop((0, 0, side, side)).resize((W * 2, W * 2), Image.LANCZOS)
    sq = seamless(tex).convert('RGB')
    # Tile the seamless square 3x3 and project the centre copy, so pixels just
    # outside the diamond still carry real texture. The mask is then grown by
    # ~1.5 px, so neighbouring tiles overlap instead of leaving a hairline gap
    # where the soil band of the tile behind shows through.
    s = sq.size[0]
    big = Image.new('RGB', (3 * s, 3 * s))
    for i in range(3):
        for j in range(3):
            big.paste(sq, (i * s, j * s))
    a, b, c = s / W, s / H, -s / 2 + s
    d_, e, f = -s / W, s / H, s / 2 + s
    top = big.transform((W, H), Image.AFFINE, (a, b, c, d_, e, f), resample=Image.BICUBIC).convert('RGBA')
    g = 1.5
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([(W / 2, -g), (W + 2 * g, H / 2), (W / 2, H + g), (-2 * g, H / 2)], fill=255)
    top.putalpha(m)

    out = Image.new('RGBA', (W, H + depth), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.polygon([(0, H / 2), (W / 2, H), (W / 2, H + depth), (0, H / 2 + depth)], fill=SOIL_LEFT + (255,))
    d.polygon([(W / 2, H), (W, H / 2), (W, H / 2 + depth), (W / 2, H + depth)], fill=SOIL_RIGHT + (255,))
    out.alpha_composite(top, (0, 0))
    out.save(out_path)
    return out.size


if __name__ == '__main__':
    a = sys.argv
    print(build(a[1], a[2], int(a[3]) if len(a) > 3 else 288, int(a[4]) if len(a) > 4 else None))
