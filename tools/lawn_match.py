"""Pull the lawn tiles toward a reference scene's grass (Oct 18).

Usage: python3 tools/lawn_match.py <reference.jpg> x0 y0 x1 y1 <out_prefix>

Measured on target-look-5: our lawn was brighter (74% vs 59%), more lime
(hue 64 vs 74) and about half as textured as the reference grass, which is what
read as "cartoony". This matches mean and spread per channel in Lab space
(Reinhard transfer) inside the tile's opaque area, so the slab sides are left
alone, and adds back fine grain so a field of lawn isn't one flat colour.
Writes <out_prefix>-00/01/10/11.png next to the originals; the originals stay.
"""
import sys

import numpy as np
from PIL import Image
from skimage import color

ref = np.array(Image.open(sys.argv[1]).convert('RGB'))
x0, y0, x1, y1 = map(int, sys.argv[2:6])
out = sys.argv[6]
r = color.rgb2lab(ref[y0:y1, x0:x1] / 255.0).reshape(-1, 3)
rm, rs = r.mean(0), r.std(0)
rng = np.random.default_rng(7)
for v in ('00', '01', '10', '11'):
    im = np.array(Image.open(f'art/tileset-grok/lawn-{v}.png').convert('RGBA'))
    a = im[..., 3]
    lab = color.rgb2lab(im[..., :3] / 255.0)
    # top face only: the soil sides are much darker, so take the grass by hue
    hsv = np.array(Image.fromarray(im[..., :3]).convert('HSV')).astype(float)
    top = (a > 250) & (hsv[..., 1] > 80) & (hsv[..., 0] > 25) & (hsv[..., 0] < 90)
    m, s = lab[top].mean(0), lab[top].std(0)
    # match the MEAN only (colour + brightness). Matching the spread too (first try)
    # amplified the tile's own soft shading into blotches that repeat tile by tile.
    new = lab - m + rm
    # fine grain: low-amplitude luminance noise, softened
    noise = rng.normal(0, 2.2, a.shape)
    from scipy.ndimage import gaussian_filter
    new[..., 0] += gaussian_filter(noise, 0.8) * 1.6
    rgb = np.clip(color.lab2rgb(new), 0, 1) * 255
    res = im.copy()
    res[..., :3][top] = rgb[top].astype(np.uint8)
    Image.fromarray(res).save(f'art/tileset-grok/{out}-{v}.png')
print('done')
