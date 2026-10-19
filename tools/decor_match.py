"""Strip the lime grass skirt from standing decor (bushes, rocks).

Usage: python3 tools/decor_match.py <sprite.png> <out.png> [rocks]
Sheet 1 drew every standing object on a smooth lime skirt; on the grainy
lawngm lawn it reads as a halo whatever its colour (a Lab mean shift was tried
Oct 18 and didn't help). Rocks: every green pixel goes. Bushes: everything outside
the filled outline of the dark foliage goes. A soft contact
shadow is drawn in the game, not here.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def main(src, out, rocks=False):
    im = Image.open(src).convert('RGBA')
    a = np.array(im)
    r, g, b = (a[..., i].astype(int) for i in range(3))
    grass = (g > r + 6) & (g > b + 18)
    alpha = a[..., 3].copy()
    if rocks:
        alpha[grass] = 0
    else:
        # foliage = the dark-green clumps; keep their filled outline (sunlit
        # leaf tops are as lime as the skirt, so a colour cut eats them)
        from scipy import ndimage
        dark = (a[..., 3] > 200) & ~(grass & (g > 115))
        dark = ndimage.binary_opening(dark, iterations=2)
        lab, n = ndimage.label(dark)
        sizes = ndimage.sum(dark, lab, range(1, n + 1))
        big = np.isin(lab, 1 + np.nonzero(sizes > dark.sum() * .03)[0])
        keep = ndimage.binary_fill_holes(ndimage.binary_closing(big, iterations=6))
        keep = ndimage.binary_dilation(keep, iterations=3)
        alpha[~keep] = 0
    m = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    a[..., 3] = np.minimum(np.array(m), a[..., 3])
    out_im = Image.fromarray(a)
    out_im = out_im.crop(out_im.getbbox())
    out_im.save(out)
    print(out, out_im.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], 'rocks' in sys.argv[3:])
