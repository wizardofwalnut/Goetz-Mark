"""Labor screen idea C (Oct 18): the LOTR2 "Advanced Labor Panel" done with the
new art.

Usage: python3 tools/labor_mock3.py <out.png> [mine|quarry]

What it takes from where:
- LOTR2 (openlotr2, Part 3 "The Advanced Labor Panel"): the panel is split into
  one section per task, and the peasant FIGURES inside a section show the
  workers there; a task short of workers is outlined red. Opened by tapping the
  county town.
- Our Aug 5 spec: an 8-card grid; grain and cattle show a red negative number
  when short of workers, every other job a plain count.
- The Grok/canon concepts: each job is a small diorama plot; cows/figures come
  in 1-3 tiers (LOTR2 used the same 1-3 cow figures for crowding).
"""
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, 'tools')
from labor_mock import FONT, PLOTS, PW, SANS, TS, W, H, load, shadow  # noqa: E402
from labor_mock2 import WHOLE, header  # noqa: E402

R2 = 'art/review-s2/'
FIG = {'Grain': R2 + 'laborer-farmer.png', 'Pasture': R2 + 'laborer-herder.png'}
# job, workers (negative = short), plot key for the art
JOBS = [('Grain', -23, 'Grain'), ('Pasture', 20, 'Pasture'), ('Mine', 0, 'Mine'),
        ('Lumber', 0, 'Lumber'), ('Forge', 0, 'Forge'), ('Repair', 0, 'Repair'),
        ('Castle', 0, 'Castle'), ('Idle', 130, None)]


def tiers(n):
    """1-3 figures, like LOTR2's 1-3 cows."""
    n = abs(n)
    return 0 if n == 0 else 1 if n < 40 else 2 if n < 100 else 3


def vignette(key, n, w, h):
    S = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    s = 0.88                                   # plot scale inside a card
    tw, th = W * s, H * s
    cx, top = w / 2, h / 2 - th * 0.9
    if key in WHOLE:
        im = load(WHOLE[key], 2 * tw + 4)
        S.alpha_composite(im, (round(cx - im.width / 2), round(top + 2 * th + 0.1 * im.height - im.height + th * 0.3)))
    elif key:
        ground = PLOTS[key][2]
        for c, r in [(0, 0), (1, 0), (0, 1), (1, 1)]:
            t = load(ground, tw + 2)
            S.alpha_composite(t, (round(cx + (c - r) * tw / 2 - t.width / 2), round(top + (c + r) * th / 2)))
        bld, scale = PLOTS[key][3], PLOTS[key][4]
        if bld:
            im = load(bld, scale * tw * 0.95)
            S.alpha_composite(shadow(im), (round(cx - im.width / 2 + 4), round(top + 1.45 * th - im.height + 3)))
            S.alpha_composite(im, (round(cx - im.width / 2), round(top + 1.45 * th - im.height)))
        if key == 'Pasture':
            for dx, dy in [(-0.5, 0.9), (0.45, 0.7), (0.05, 1.25)]:
                cow = load('art/props/prop-cow.png', 0.42 * tw)
                S.alpha_composite(cow, (round(cx + dx * tw - cow.width / 2), round(top + dy * th + th * 0.5 - cow.height)))
    # worker figures in front, 1-3 by tier
    fig = FIG.get(key) or (R2 + 'laborer-farmer.png' if key is None else None)
    k = tiers(n)
    if key is None:
        k = 3
    if fig and k:
        src = Image.open(fig).convert('RGBA')
        src = src.crop(src.getbbox())
        fh = 0.62 * tw
        for i in range(k):
            f = src.resize((round(fh * src.width / src.height), round(fh)), Image.LANCZOS)
            if key is None and i % 2:
                hs = Image.open(R2 + 'laborer-herder.png').convert('RGBA')
                hs = hs.crop(hs.getbbox())
                f = hs.resize((round(fh * hs.width / hs.height), round(fh)), Image.LANCZOS)
            x = cx + (i - (k - 1) / 2) * 0.42 * tw
            y = top + 2.05 * th + (0 if key is None else 0.1 * th) - (0.6 * th if key is None else 0)
            S.alpha_composite(shadow(f), (round(x - f.width / 2 + 4), round(y - f.height + 3)))
            S.alpha_composite(f, (round(x - f.width / 2), round(y - f.height)))
    return S


def main(out, variant='mine'):
    jobs = [(('Quarry', n, 'Quarry') if j == 'Mine' and variant == 'quarry' else (j, n, key)) for j, n, key in JOBS]
    if variant == 'mine':
        jobs = [(j, n, None if key == 'Mine' and False else key) for j, n, key in jobs]
    CW, CH = (PW - 30 * 3) // 2, 380
    page = Image.new('RGBA', (PW, 290 + 4 * (CH + 24) + 110), (22, 20, 17, 255))
    pd = ImageDraw.Draw(page)
    header(pd)
    f_name = ImageFont.truetype(FONT, 34)
    f_num = ImageFont.truetype(FONT, 42)
    for i, (name, n, key) in enumerate(jobs):
        x0, y0 = 30 + (i % 2) * (CW + 30), 290 + (i // 2) * (CH + 24)
        short, idle = n < 0, key is None
        card = Image.new('RGBA', (CW, CH), (30, 38, 26, 255) if not idle else (40, 34, 24, 255))
        card.alpha_composite(vignette(key if key != 'Mine' else 'Mine', n, CW, CH - 64))
        cd = ImageDraw.Draw(card)
        cd.rectangle((0, CH - 64, CW, CH), fill=(24, 20, 16))
        cd.text((22, CH - 32), name, fill=(250, 238, 210), font=f_name, anchor='lm')
        col = (235, 70, 60) if short else (240, 200, 110) if n > 0 else (170, 160, 140)
        cd.text((CW - 22, CH - 32), f'{n:+d}' if short else str(n), fill=col, font=f_num, anchor='rm')
        page.alpha_composite(card, (x0, y0))
        oc = (220, 60, 50) if short else (212, 168, 80) if n > 0 and not idle else (90, 130, 200) if idle else (100, 90, 75)
        pd.rounded_rectangle((x0, y0, x0 + CW, y0 + CH), 16, outline=oc, width=5 if (short or n > 0) else 3)
    pd.text((40, page.height - 60), 'Tap a job, then + / − to move people. Red = short of workers.', fill=(190, 180, 160),
            font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf', 30), anchor='lm')
    page.convert('RGB').save(out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'mine')
