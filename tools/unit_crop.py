"""Crop canon troop icons to the figure (Phase B, decided Oct 16: roster
troops at 28 px read only when the grass base doesn't shrink the figure).

Usage: python3 tools/unit_crop.py <src.jpg|png> <out.png>
Figure = pixels that are not navy/black backdrop and not grass-green;
the square crop around them keeps a sliver of the base so feet stay grounded.
"""
import sys
import numpy as np
from PIL import Image


def crop(src):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(int)
    h, w, _ = a.shape
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # the backdrop is a navy vignette (blue-dominant, dark) or black
    far = ~(((b > r + 6) & (b >= g) & (r + g + b < 330)) | (r + g + b < 45))
    grass = (g >= r - 6) & (g > b + 22)   # olive/green turf
    m = far & ~grass
    # feet stand ~62% down the turf diamond; the figure is everything
    # non-backdrop, non-turf from its top row down to the feet
    gr = np.nonzero(grass.sum(1) > w * .02)[0]
    gy0, gy1 = gr.min(), gr.max()
    feet = int(gy0 + .62 * (gy1 - gy0))
    top = np.nonzero(m[:feet].sum(1) > w * .01)[0].min()
    # width from the part standing above the turf (the slab's dirt rim
    # shares the feet rows and would widen the box to the whole tile)
    band = m[top:max(gy0, top + 4)]
    xs = np.nonzero(band.sum(0) > 0)[0]
    x0, x1, y0, y1 = xs.min(), xs.max(), top, feet
    side = max(y1 - y0, x1 - x0) * 1.06
    cx, cy = (x0 + x1) / 2, y1 + side * .04 - side / 2
    box = (round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2))
    return im.crop(box)


if __name__ == '__main__':
    crop(sys.argv[1]).save(sys.argv[2])
