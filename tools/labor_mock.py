"""Mock-up of the labor screen (Town Centre) in the diorama style, at S10e size.

Usage: python3 tools/labor_mock.py <out.png>

Same layout and controls as today's screen (plots around the town, tap a plot
to staff it, a label with the job and worker count); only the art changes, to
the accepted diamond-grid tiles and sprites. A 6x6 diamond grid, each job a
2x2 plot. Stand-ins are labelled in the legend: canon buildings that still need
their green-screen copy, and the forge yard (its tile was rejected Oct 18).
"""
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

A = 'art/'
R2 = A + 'review-s2/'
TS = A + 'tileset-grok/'
ST = TS + 'standing/'
W = 165                       # tile width in real px (S10e, 3x)
H = round(W / 1.55)
PW = 1080                     # phone width, real px
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

# plot -> (col0, row0, ground tile, building, scale in tiles, figures, props)
PLOTS = {
    'Grain':   (0, 0, R2 + 'growing-wheat.png', None, 0, [(R2 + 'laborer-farmer.png', 5)], [(A + 'props/prop-cart.png', 0.55)]),
    'Pasture': (2, 0, R2 + 'pasture.png', None, 0, [(R2 + 'laborer-herder.png', 2)], [(A + 'props/prop-cow.png', 0.42)] * 4),
    'Mine':    (4, 0, TS + 'lawn-01.png', A + 'buildings/building-mine.png', 0.85 * 2, [], [(A + 'props/prop-minecart.png', 0.45)]),
    'Repair':  (0, 2, R2 + 'fallow.png', None, 0, [], [(A + 'props/prop-logs.png', 0.55), (A + 'props/prop-sawhorse.png', 0.4)]),
    'TOWN':    (2, 2, TS + 'lawn-10.png', ST + 'house-thatch.png', 1.5, [], []),
    'Forge':   (4, 2, TS + 'tilled.png', R2 + 'open-forge.png', 1.3, [], [(A + 'props/prop-barrels.png', 0.4)]),
    'Castle':  (0, 4, TS + 'lawn-11.png', R2 + 'castle-yard.png', 1.7, [], []),
    'forest1': (2, 4, R2 + 'forest-floor.png', R2 + 'forest.png', 1.5, [], []),
    'forest2': (4, 4, R2 + 'forest-floor.png', R2 + 'forest.png', 1.3, [], []),
}
COUNTS = {'Grain': 90, 'Pasture': 20, 'Mine': 0, 'Repair': 0, 'Forge': 0, 'Castle': 0}


def load(p, w):
    im = Image.open(p).convert('RGBA')
    im = im.crop(im.getbbox())
    return im.resize((round(w), round(im.height * w / im.width)), Image.LANCZOS)


def iso(c, r, ox, oy):
    """Top vertex of the diamond for cell (c, r)."""
    return ox + (c - r) * W / 2, oy + (c + r) * H / 2


def shadow(im):
    a = im.split()[3].point(lambda v: 90 if v > 40 else 0)
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    sh.putalpha(a.filter(ImageFilter.GaussianBlur(6)))
    return sh


def scene():
    S = Image.new('RGBA', (PW - 40, 6 * H + 260), (0, 0, 0, 0))
    ox, oy = S.width / 2, 120
    tiles = {}
    for name, (c0, r0, ground, *_rest) in PLOTS.items():
        for dc in range(2):
            for dr in range(2):
                tiles[(c0 + dc, r0 + dr)] = ground
    for (c, r) in sorted(tiles, key=lambda k: (k[0] + k[1], k[0])):
        t = load(tiles[(c, r)], W + 2)
        x, y = iso(c, r, ox, oy)
        S.alpha_composite(t, (round(x - t.width / 2), round(y)))
    labels = []
    order = sorted(PLOTS.items(), key=lambda kv: kv[1][0] + kv[1][1])
    for name, (c0, r0, ground, bld, scale, figs, props) in order:
        cx, cy = iso(c0 + 1, r0 + 1, ox, oy)          # centre of the 2x2 plot
        items = []
        for i, (p, k) in enumerate(props):
            items.append((cx + [-0.55, 0.5, -0.15, 0.3][i % 4] * W, cy + [0.25, 0.35, 0.6, -0.2][i % 4] * H, p, k * W))
        if bld:
            items.append((cx, cy + 0.45 * H, bld, scale * W))
        for p, n in figs:
            for i in range(n):
                items.append((cx + (-0.6 + 0.3 * i) * W * 0.9, cy + (0.1 + 0.18 * (i % 2)) * H + (0.25 * H if name == 'Grain' else 0), p, 0.16 * W, 'fig'))
        for it in sorted(items, key=lambda t: t[1]):
            x, y, p, w = it[:4]
            im = load(p, w)
            if len(it) == 5:                           # figures: fit by height
                hgt = 0.36 * W
                im = load(p, hgt * Image.open(p).convert('RGBA').crop(Image.open(p).convert('RGBA').getbbox()).width
                          / Image.open(p).convert('RGBA').crop(Image.open(p).convert('RGBA').getbbox()).height)
            S.alpha_composite(shadow(im), (round(x - im.width / 2 + 6), round(y - im.height + 4)))
            S.alpha_composite(im, (round(x - im.width / 2), round(y - im.height)))
        if name in COUNTS:
            labels.append((cx, cy + H * 0.85, f'{name} {COUNTS[name]}', COUNTS[name] > 0))
    d = ImageDraw.Draw(S)
    f = ImageFont.truetype(FONT, 34)
    for x, y, t, on in labels:
        tw = d.textlength(t, font=f)
        box = (x - tw / 2 - 18, y - 26, x + tw / 2 + 18, y + 26)
        d.rounded_rectangle(box, 12, fill=(60, 14, 14, 235) if on else (28, 24, 20, 225),
                            outline=(212, 168, 80, 255) if on else (120, 104, 80, 255), width=3)
        d.text((x, y), t, fill=(250, 238, 210), font=f, anchor='mm')
    return S.crop(S.getbbox())


def main(out):
    PH = 2220
    bg = Image.new('RGBA', (PW, PH), (22, 20, 17, 255))
    d = ImageDraw.Draw(bg)
    f1 = ImageFont.truetype(FONT, 48)
    f2 = ImageFont.truetype(SANS, 36)
    f3 = ImageFont.truetype(FONT, 38)
    d.rectangle((0, 0, PW, 150), fill=(30, 27, 22))
    d.text((40, 75), 'Hollowmere — Town Centre', fill=(232, 196, 110), font=f1, anchor='lm')
    d.text((PW - 60, 75), '✕', fill=(220, 210, 190), font=f2, anchor='mm')
    d.rounded_rectangle((30, 180, PW - 30, 260), 40, fill=(44, 38, 28), outline=(150, 120, 70), width=3)
    d.text((70, 220), '130 idle peasants', fill=(235, 220, 190), font=f3, anchor='lm')
    sc = scene()
    frame = (20, 290, PW - 20, 290 + sc.height + 60)
    d.rounded_rectangle(frame, 18, fill=(36, 44, 30), outline=(170, 136, 70), width=6)
    bg.alpha_composite(sc, ((PW - sc.width) // 2, 320))
    y = frame[3] + 50
    d.text((40, y), 'Tap a field, mine or building to move people to it.', fill=(190, 180, 160),
           font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf', 34), anchor='lm')
    y += 70
    f4 = ImageFont.truetype(SANS, 28)
    for line in ['Mock-up, Oct 18. All art is accepted art except:',
                 '• Town: sheet-1 house stands in until the canon town copy arrives.',
                 '• Forge yard: plain dirt stands in (yard tile rejected).',
                 '• Miner and blacksmith figures appear once canon copies are cut.']:
        d.text((40, y), line, fill=(150, 145, 135), font=f4, anchor='lm')
        y += 44
    bg.crop((0, 0, PW, min(PH, y + 40))).convert('RGB').save(out)


if __name__ == '__main__':
    main(sys.argv[1])
