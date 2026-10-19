"""Build a labor-screen backdrop from the accepted base plus patched lots.

Usage: python3 tools/labor_patch.py <out.png> [quarry] [castle-N]

ChatGPT's "same image, change one area" edits also shift the rest of the
picture slightly (Oct 18: ~30% of changed pixels were outside the target lot),
so only the target lot is taken from each edit, with a soft edge that falls on
the dirt path around the fence. The game does the same at runtime.
"""
import sys

from PIL import Image, ImageDraw, ImageFilter

BASE = 'art/labor/labor-grid-chatgpt-1.png'
# lot boxes including their fence, extended to the middle of the paths
LOTS = {'mine': (0, 322, 517, 686), 'castle': (517, 1058, 1024, 1490)}
FEATHER = 8


def patch(img, src, box):
    m = Image.new('L', img.size, 0)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(m).rectangle((x0 + FEATHER, y0 + FEATHER, x1 - FEATHER, y1 - FEATHER), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(FEATHER / 2))
    img.paste(Image.open(src).convert('RGB'), (0, 0), m)


def build(out, *opts):
    img = Image.open(BASE).convert('RGB')
    for o in opts:
        if o == 'quarry':
            patch(img, 'art/labor/labor-quarry.png', LOTS['mine'])
        elif o.startswith('castle-'):
            patch(img, 'art/labor/labor-%s.png' % o, LOTS['castle'])
    img.save(out)


if __name__ == '__main__':
    build(sys.argv[1], *sys.argv[2:])
