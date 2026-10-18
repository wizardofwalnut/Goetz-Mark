"""Labor screen mock-up: the painted grid backdrop with the game's overlays.

Usage: python3 tools/labor_overlay.py <backdrop.png> <out.png>

Overlays (decided Oct 18): a worker crowd per job that grows with the count
(1 figure per 10 workers, max 12), the job name + exact number on a plate,
a red glow under a job short of workers, a blue glow under the idle crowd.
Zones are hand-measured boxes on labor-grid-chatgpt-1.png (1024x1536); the
game would store the same boxes per backdrop as tap areas.
"""
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

R2 = 'art/review-s2/'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
# name: (box x0,y0,x1,y1 of the compartment, crowd centre, workers, short?, figure)
ZONES = {
    'Grain':   ((20, 40, 490, 305), (255, 240), 90, -23, 'farmer'),
    'Pasture': ((545, 40, 1005, 305), (775, 190), 20, 0, 'herder'),
    'Mine':    ((20, 340, 490, 665), (250, 585), 30, 0, 'herder'),
    'Lumber':  ((545, 340, 1005, 665), (760, 590), 40, 0, 'farmer'),
    'Forge':   ((20, 705, 490, 1035), (250, 960), 0, 0, 'herder'),
    'Repair':  ((545, 705, 1005, 1035), (775, 880), 0, 0, 'farmer'),
    'Idle':    ((20, 1080, 490, 1460), (240, 1290), 130, 0, 'mixed'),
    'Castle':  ((545, 1080, 1005, 1460), (775, 1270), 0, 0, 'farmer'),
}
FIG_H = 50
COW_W = 74
# cow spots in the pasture (backdrop px), kept clear of the herders in the middle
COWS = [(640, 150), (900, 140), (610, 270), (930, 265), (700, 215), (860, 205)]


def fig(kind):
    p = R2 + ('laborer-%s.png' % kind)
    im = Image.open(p).convert('RGBA')
    im = im.crop(im.getbbox())
    return im.resize((round(FIG_H * im.width / im.height), FIG_H), Image.LANCZOS)


def glow(base, centre, rx, ry, rgb):
    g = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    cx, cy = centre
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=rgb + (150,))
    base.alpha_composite(g.filter(ImageFilter.GaussianBlur(22)))


def main(src, out):
    random.seed(4)
    base = Image.open(src).convert('RGBA')
    figs = {k: fig(k) for k in ('farmer', 'herder')}
    d = ImageDraw.Draw(base)
    f_plate = ImageFont.truetype(FONT, 30)
    for name, (box, (cx, cy), n, short, kind) in ZONES.items():
        k = min(12, math.ceil(n / 10))
        cols = min(k, 4) or 1
        rows = math.ceil(k / cols) if k else 0
        if short or name == 'Idle':
            glow(base, (cx, cy - 10), 40 + cols * 26, 30 + rows * 18,
                 (230, 50, 40) if short else (60, 120, 255))
        spots = []
        for i in range(k):
            r, c = divmod(i, cols)
            x = cx + (c - (cols - 1) / 2) * 42 + random.randint(-6, 6) + (r % 2) * 14
            y = cy + (r - (rows - 1) / 2) * 30 + random.randint(-4, 4)
            spots.append((x, y, i))
        for x, y, i in sorted(spots, key=lambda t: t[1]):
            kk = kind if kind != 'mixed' else ('farmer', 'herder')[i % 2]
            im = figs[kk]
            sh = Image.new('RGBA', base.size, (0, 0, 0, 0))
            ImageDraw.Draw(sh).ellipse((x - 14, y - 4, x + 14, y + 5), fill=(0, 0, 0, 90))
            base.alpha_composite(sh)
            base.alpha_composite(im, (round(x - im.width / 2), round(y - im.height)))
        if name == 'Pasture':
            # the herd: the game draws one cow sprite per few head (as on the map)
            cow = Image.open('art/props/prop-cow.png').convert('RGBA')
            cow = cow.crop(cow.getbbox())
            for i, (x, y) in enumerate(COWS):
                c = cow.resize((COW_W, round(COW_W * cow.height / cow.width)), Image.LANCZOS)
                if i % 2:
                    c = c.transpose(Image.FLIP_LEFT_RIGHT)
                sh = Image.new('RGBA', base.size, (0, 0, 0, 0))
                ImageDraw.Draw(sh).ellipse((x - COW_W / 2 + 6, y - 6, x + COW_W / 2 - 6, y + 6), fill=(0, 0, 0, 80))
                base.alpha_composite(sh)
                base.alpha_composite(c, (round(x - c.width / 2), round(y - c.height)))
        # plate: name + exact number, at the top of the compartment
        label = f'{name}  {short:+d}' if short else f'{name}  {n}'
        tw = d.textlength(label, font=f_plate)
        px, py = (box[0] + box[2]) / 2, box[1] + 42
        on = n > 0 or short
        fill = (120, 22, 18, 235) if short else (40, 70, 140, 235) if name == 'Idle' else (52, 24, 16, 230) if on else (30, 26, 22, 215)
        d.rounded_rectangle((px - tw / 2 - 18, py - 24, px + tw / 2 + 18, py + 24), 8, fill=fill,
                            outline=(226, 186, 110, 255) if on else (140, 120, 90, 255), width=3)
        d.text((px, py), label, fill=(250, 238, 210), font=f_plate, anchor='mm')
    # phone frame: S10e width 1080; the backdrop scales to fill the width
    W = 1080
    sc = base.resize((W, round(base.height * W / base.width)), Image.LANCZOS)
    page = Image.new('RGBA', (W, sc.height + 120), (22, 20, 17, 255))
    pd = ImageDraw.Draw(page)
    pd.text((36, 60), 'Hollowmere — Town Centre', fill=(232, 196, 110), font=ImageFont.truetype(FONT, 44), anchor='lm')
    pd.text((W - 50, 60), '✕', fill=(220, 210, 190), font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 36), anchor='mm')
    page.alpha_composite(sc, (0, 120))
    page.convert('RGB').save(out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
