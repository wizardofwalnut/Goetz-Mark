"""Aldermarch road autotiles for the DIAMOND (isometric) grid.

Usage: python3 tools/roadgen_iso.py <dirt_texture.png> <out_dir> [diamond_width] [ratio]

Builds the 16 road masks (N=1 E=2 S=4 W=8, same as roadMasks in the game)
as square top-down tiles with roadgen.py, then projects each one onto a 2:1
diamond. Roads are flat, so the projection is exact: a seamless square tile
stays seamless as a diamond, and neighbours still join invisibly.

Grid-to-screen convention (matches the Phase B iso plan):
  +col (East)  -> down-right on screen
  +row (South) -> down-left on screen
so North points up-right and West points up-left.

Default diamond width is 288 px (the Oct 7 bake target); height is half.
"""
import os
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import roadgen  # noqa: E402


def to_diamond(sq, W, ratio=2.0):
    """Project a square top-down tile (x = East, y = South) onto a W x W/ratio diamond."""
    H = round(W / ratio)
    side = sq.size[0]
    # inverse map, screen (X, Y) -> source (x, y); top vertex of the diamond at (W/2, 0)
    a, b, c = side / W, side / H, -side / 2
    d, e, f = -side / W, side / H, side / 2
    return sq.transform((W, H), Image.AFFINE, (a, b, c, d, e, f), resample=Image.BICUBIC)


def build(tex, out, W=288, ratio=2.0):
    os.makedirs(out, exist_ok=True)
    roadgen.TILE_W = roadgen.TILE_H = 58   # square top-down tiles
    with tempfile.TemporaryDirectory() as tmp:
        S = max(4, round(W / 58 * 1.25))      # oversample the square source
        roadgen.build(tex, tmp, S)
        for m in range(16):
            sq = Image.open(f'{tmp}/road-{m:02d}.png').convert('RGBA')
            to_diamond(sq, W, ratio).save(f'{out}/road-{m:02d}.png')
    return W, round(W / ratio)


if __name__ == '__main__':
    print(build(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 288,
                float(sys.argv[4]) if len(sys.argv) > 4 else 2.0))
