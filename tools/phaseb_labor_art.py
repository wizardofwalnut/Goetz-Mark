"""Phase B stage 3: embed the painted labor-screen backdrop and its lot patches.

Usage: python3 tools/phaseb_labor_art.py <game.html>   (edits in place)

The base (art/labor/labor-grid-chatgpt-1.png, mine + empty castle lot) goes in
once; the quarry lot and the five castle tiers go in as feathered patches cut
from ChatGPT's edits (only the lot - the edits shift the rest of the picture,
LESSONS Oct 18), so the game composes any county from one base + <=2 patches.
Everything is stored at SCALE of the 1024x1536 source; the game keeps its
overlay coordinates in source pixels and the patch boxes in LOTS.
"""
import sys

from PIL import Image, ImageDraw, ImageFilter

import phaseb_inject as pi

SCALE = .84         # 860 px wide: the screen shows it at ~290 css px x 3 DPR
L = 'art/labor/'
LOTS = {'mine': (0, 322, 517, 686), 'castle': (517, 1058, 1024, 1490)}   # = labor_patch.py
FEATHER = 8
TIERS = ['woodenPalisade', 'motteAndBailey', 'normanKeep', 'stoneCastle', 'royalCastle']


def scaled(im):
    return im.resize((round(im.width * SCALE), round(im.height * SCALE)), Image.LANCZOS)


def base(path):
    return scaled(Image.open(path).convert('RGB'))


def lot(which):
    def cut(path):
        im = Image.open(path).convert('RGBA')
        x0, y0, x1, y1 = LOTS[which]
        m = Image.new('L', im.size, 0)
        ImageDraw.Draw(m).rectangle((x0 + FEATHER, y0 + FEATHER, x1 - FEATHER, y1 - FEATHER), fill=255)
        im.putalpha(m.filter(ImageFilter.GaussianBlur(FEATHER / 2)))
        return scaled(im.crop((x0, y0, x1, y1)))
    return cut


def main(p):
    # painted backdrops are photographic: q80 halves them with no visible loss at phone size
    import base64, io
    def webp80(im):
        b = io.BytesIO()
        im.save(b, 'WEBP', quality=80, method=6)
        return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    pi.webp = webp80
    tables = [({'labor.backdrop': L + 'labor-grid-chatgpt-1.png'}, base),
              ({'labor.lot.quarry': L + 'labor-quarry.png'}, lot('mine'))]
    tables.append(({f'labor.lot.castle.{t}': L + f'labor-castle-{i + 1}.png' for i, t in enumerate(TIERS)}, lot('castle')))
    pi.main(p, tables=tables)


if __name__ == '__main__':
    main(sys.argv[1])
