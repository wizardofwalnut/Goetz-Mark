"""Cut an object out of a solid #00FF00 background (Grok "green pack" format).

Usage: python3 tools/greenkey.py <in.png> <out.png>

Why: Grok's own transparent PNGs (and dark-background keying) punched holes
in dark parts of objects (Oct 11). Pure green never occurs in our props, so
keying on "how much greener than red/blue" is safe for dark pixels.

- alpha comes from greenness = G - max(R, B): fully opaque at <= LOW,
  fully transparent at >= HIGH, a soft ramp between (keeps edges smooth).
- despill: on partly-transparent edge pixels, G is clamped to max(R, B) so no
  green fringe remains when the sprite sits on brown or grey ground.
- the result is cropped to the object (plus a small margin).
Screen the output with tools/check_cutout.py afterwards.
"""
import sys

from PIL import Image

LOW, HIGH = 40, 140
MARGIN = 8


def key(src, dst):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    px = im.load()
    out = Image.new('RGBA', (W, H))
    op = out.load()
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            gr = g - max(r, b)
            if gr <= LOW:
                a = 255
            elif gr >= HIGH:
                a = 0
            else:
                a = round(255 * (HIGH - gr) / (HIGH - LOW))
            if gr > 0 and a < 255:
                g = max(r, b)  # despill the edge
            op[x, y] = (r, g, b, a)
    bb = out.getbbox()
    if bb:
        bb = (max(0, bb[0] - MARGIN), max(0, bb[1] - MARGIN), min(W, bb[2] + MARGIN), min(H, bb[3] + MARGIN))
        out = out.crop(bb)
    out.save(dst)
    return out.size


if __name__ == '__main__':
    print(key(sys.argv[1], sys.argv[2]))
