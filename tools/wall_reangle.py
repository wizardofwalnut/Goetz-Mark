"""Re-angle the diagonal wall run to a new diamond ratio.

Usage: python3 tools/wall_reangle.py <wall-run.png> <out.png> [ratio]

The run was drawn for a 2:1 grid (base slope ~26 deg). The ChatGPT tile sheets
are ~1.55:1 (edge slope ~33 deg). A vertical shear (y shifted in proportion to
x) turns the base line to the new slope while keeping every vertical stroke
vertical and the wall's height unchanged — a rotate or a squash would tilt
or flatten the stones.
"""
import sys

import numpy as np
from PIL import Image


def base_slope(a):
    xs = np.arange(int(a.shape[1] * 0.23), int(a.shape[1] * 0.87), 10)
    bot = [np.nonzero(a[:, x])[0].max() for x in xs]
    return np.polyfit(xs, bot, 1)[0]          # negative: rises to the right


def reangle(src, dst, ratio=1.55):
    im = Image.open(src).convert('RGBA')
    im = im.crop(im.getbbox())
    a = np.array(im)[..., 3] > 128
    have = base_slope(a)
    want = -1 / ratio
    t = have - want                           # extra rise per px of x (>0)
    off = t * im.width
    out = im.transform((im.width, round(im.height + off)), Image.AFFINE,
                       (1, 0, 0, t, 1, -off), resample=Image.BICUBIC)
    out.save(dst)
    got = base_slope(np.array(out)[..., 3] > 128)
    print(f'slope {have:.3f} -> {got:.3f} (target {want:.3f})', out.size)


if __name__ == '__main__':
    reangle(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.55)
