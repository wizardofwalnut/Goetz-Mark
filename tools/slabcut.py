"""Cut a tile-sheet style slab off its dark background (one tile per file).

Usage: python3 tools/slabcut.py <in.png> <out.png>

The background is a near-flat dark navy with a soft vignette (ChatGPT, Oct 16).
Estimate it from the border, take every pixel clearly different from it,
keep the largest connected blob (the slab), fill its holes, feather 1 px,
crop. Prints the slab's diamond ratio (width / top-face height) so it can be
checked against the grid's 1.55.
"""
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def cut(src, dst):
    im = np.array(Image.open(src).convert('RGB')).astype(float)
    h, w, _ = im.shape
    border = np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3), im[:, :8].reshape(-1, 3), im[:, -8:].reshape(-1, 3)])
    bg = np.median(border, 0)
    # local background: the vignette makes corners darker than the middle, so blur a
    # copy of the image with the slab pushed to the border colour... simpler: distance
    # from the border colour, with a threshold above the vignette's spread
    spread = np.percentile(np.linalg.norm(border - bg, axis=1), 99)
    d = np.linalg.norm(im - bg, axis=2)
    m = d > max(18, spread * 2.2)
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    m = lab == (1 + int(np.argmax(sizes)))
    m = ndimage.binary_fill_holes(m)
    m = ndimage.binary_opening(m, iterations=2)
    a = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = Image.open(src).convert('RGBA')
    out.putalpha(a)
    out = out.crop(out.getbbox())
    out.save(dst)
    # diamond ratio: top vertex, and the left corner (leftmost column) height
    al = np.array(out)[..., 3] > 128
    ys, xs = np.nonzero(al)
    top = ys.min()
    left_y = np.nonzero(al[:, xs.min() + 2])[0].min()
    wid = xs.max() - xs.min()
    ratio = wid / (2 * (left_y - top))
    print(f'{dst}: {out.size}, bg {bg.round()}, diamond ratio {ratio:.2f}')
    return ratio


if __name__ == '__main__':
    cut(sys.argv[1], sys.argv[2])
