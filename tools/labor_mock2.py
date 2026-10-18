"""Two alternative labor-screen layouts (Oct 18), after the diamond scene read
as wasteful at the edges and congested.

Usage: python3 tools/labor_mock2.py <out_fill.png> <out_cards.png>

A "fill": the same isometric art, but the ground runs to every edge of a
  rectangular frame (a big lawn cropped to the frame, like the reference
  scenes), with the jobs spread out on a 3x3 layout and lawn between them.
B "cards": one small diorama per job in a 2-column grid of cards, label and
  count under each; no shared scene at all.
"""
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, 'tools')
from labor_mock import (A, FONT, PLOTS, PW, SANS, COUNTS, TS, W, H,  # noqa: E402
                        load, shadow)

JOBS = ['Grain', 'Pasture', 'Mine', 'Repair', 'Forge', 'Castle']
LAWN = [TS + 'lawn-%s.png' % v for v in ('00', '01', '10', '11')]


def header(d, title_y=75):
    d.rectangle((0, 0, PW, 150), fill=(30, 27, 22))
    d.text((40, title_y), 'Hollowmere — Town Centre', fill=(232, 196, 110), font=ImageFont.truetype(FONT, 48), anchor='lm')
    d.text((PW - 60, title_y), '✕', fill=(220, 210, 190), font=ImageFont.truetype(SANS, 36), anchor='mm')
    d.rounded_rectangle((30, 180, PW - 30, 260), 40, fill=(44, 38, 28), outline=(150, 120, 70), width=3)
    d.text((70, 220), '130 idle peasants', fill=(235, 220, 190), font=ImageFont.truetype(FONT, 38), anchor='lm')


def label(d, x, y, name, n, size=34):
    f = ImageFont.truetype(FONT, size)
    t = f'{name} {n}'
    tw = d.textlength(t, font=f)
    on = n > 0
    d.rounded_rectangle((x - tw / 2 - 18, y - 26, x + tw / 2 + 18, y + 26), 12,
                        fill=(60, 14, 14, 235) if on else (28, 24, 20, 225),
                        outline=(212, 168, 80, 255) if on else (120, 104, 80, 255), width=3)
    d.text((x, y), t, fill=(250, 238, 210), font=f, anchor='mm')


def dress(S, name, cx, cy, wscale=1.0):
    """Building, props and workers for one plot, centred at (cx, cy)."""
    c0, r0, ground, bld, scale, figs, props = PLOTS[name]
    items = []
    for i, (p, k) in enumerate(props):
        items.append((cx + [-0.55, 0.5, -0.15, 0.3][i % 4] * W, cy + [0.25, 0.35, 0.6, -0.2][i % 4] * H, p, k * W, 0))
    if bld:
        items.append((cx, cy + 0.45 * H, bld, scale * W * wscale, 0))
    for p, n in figs:
        for i in range(n):
            items.append((cx + (-0.6 + 0.3 * i) * W * 0.9, cy + (0.1 + 0.18 * (i % 2)) * H + (0.25 * H if name == 'Grain' else 0), p, 0, 1))
    for x, y, p, w, fig in sorted(items, key=lambda t: t[1]):
        if fig:
            src = Image.open(p).convert('RGBA')
            src = src.crop(src.getbbox())
            im = load(p, 0.36 * W * src.width / src.height)
        else:
            im = load(p, w)
        S.alpha_composite(shadow(im), (round(x - im.width / 2 + 6), round(y - im.height + 4)))
        S.alpha_composite(im, (round(x - im.width / 2), round(y - im.height)))


# Distinct grounds so no plot shares the lawn's colour (Oct 18: "areas easily
# distinctive, not blurring together").
DISTINCT = {'Mine': A + 'review-s2/parched.png', 'TOWN': TS + 'flagstone.png',
            'Castle': A + 'review-s2/sown.png', 'Forge': TS + 'tilled.png'}


# Canon industry on its own slab (cut for mock-ups only; the real art is the
# green-screen copy). Drawn as the whole plot.
WHOLE = {'Lumber': 'art/_preview/standins/lumbermill-slab.png',
         'Quarry': 'art/_preview/standins/quarry-slab.png'}
LAYOUT_MINE = {(-4, 6): 'Grain', (0, 6): 'Pasture', (4, 6): 'Mine',
               (-4, 12): 'Repair', (0, 12): 'TOWN', (4, 12): 'Lumber',
               (-4, 18): 'Castle', (0, 18): 'Forge', (4, 18): 'forest1'}
LAYOUT_QUARRY = dict(LAYOUT_MINE)
LAYOUT_QUARRY[(4, 6)] = 'Quarry'
COUNTS.update({'Lumber': 0, 'Quarry': 0})


def fill(out, distinct=False, spots=None):
    FW, FH = PW - 40, 1080
    LIFT = round(0.22 * H) if distinct else 0
    big = Image.new('RGBA', (FW + 4 * W, FH + 6 * H), (0, 0, 0, 0))
    ox, oy = big.width / 2, 2 * H + FH / 2 - 13 * H / 2 + 20
    # job layout on screen: 3 columns (u = c - r) x 3 rows (v = c + r)
    spots = spots or {(-4, 6): 'Grain', (0, 6): 'Pasture', (4, 6): 'Mine',
                      (-4, 12): 'Repair', (0, 12): 'TOWN', (4, 12): 'Forge',
                      (-4, 18): 'Castle', (0, 18): 'forest1', (4, 18): 'forest2'}
    plot_cells = {}
    centres = {}
    for (u, v), name in spots.items():
        c0, r0 = (u + v) // 2, (v - u) // 2
        for dc in range(2):
            for dr in range(2):
                plot_cells[(c0 + dc, r0 + dr)] = PLOTS[name][2] if name in PLOTS else LAWN[0]
        centres[name] = (ox + u * W / 2, oy + (v + 1) * H / 2)
    cells = sorted({(c, r) for c in range(-6, 30) for r in range(-10, 26)}, key=lambda k: (k[0] + k[1], k[0]))
    for c, r in cells:
        x, y = ox + (c - r) * W / 2, oy + (c + r) * H / 2
        if not (-W < x < big.width + W and -2 * H < y < big.height + H):
            continue
        src = LAWN[(c % 2) * 2 + r % 2] if distinct else plot_cells.get((c, r), LAWN[(c % 2) * 2 + r % 2])
        t = load(src, W + 2)
        big.alpha_composite(t, (round(x - t.width / 2), round(y)))
    d = ImageDraw.Draw(big)
    for name in sorted(centres, key=lambda n: centres[n][1]):
        if distinct:
            (u, v) = next(k for k, n in spots.items() if n == name)
            c0, r0 = (u + v) // 2, (v - u) // 2
            cx, cy = centres[name]
            if name in WHOLE:
                sh = Image.new('RGBA', big.size, (0, 0, 0, 0))
                ImageDraw.Draw(sh).polygon([(cx, cy - 0.5 * H + 8), (cx + W + 8, cy + 0.5 * H + 8), (cx, cy + 1.5 * H + 14), (cx - W - 8, cy + 0.5 * H + 8)], fill=(0, 0, 0, 120))
                big.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
                im = load(WHOLE[name], 2 * W + 6)
                big.alpha_composite(im, (round(cx - im.width / 2), round(cy + 1.5 * H - LIFT + 0.10 * im.height - im.height)))
                continue
            g = DISTINCT.get(name, PLOTS[name][2])
            # soft shadow under the raised plot
            sh = Image.new('RGBA', big.size, (0, 0, 0, 0))
            ImageDraw.Draw(sh).polygon([(cx, cy - 0.5 * H + 8), (cx + W + 8, cy + 0.5 * H + 8), (cx, cy + 1.5 * H + 14), (cx - W - 8, cy + 0.5 * H + 8)], fill=(0, 0, 0, 120))
            big.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
            for dc, dr in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                c, r = c0 + dc, r0 + dr
                x, y = ox + (c - r) * W / 2, oy + (c + r) * H / 2 - LIFT
                t = load(g, W + 2)
                big.alpha_composite(t, (round(x - t.width / 2), round(y)))
            top = [(cx, cy - 0.5 * H - LIFT), (cx + W, cy + 0.5 * H - LIFT), (cx, cy + 1.5 * H - LIFT), (cx - W, cy + 0.5 * H - LIFT)]
            if name in COUNTS:
                ImageDraw.Draw(big).line(top + [top[0]], fill=(240, 206, 130, 230), width=5, joint='curve')
            dress(big, name, cx, cy - LIFT)
        else:
            dress(big, name, *centres[name])
    d = ImageDraw.Draw(big)
    for name, (x, y) in centres.items():
        if name in COUNTS:
            label(d, x, y + H * 0.9 - LIFT, name, COUNTS[name])
    crop = big.crop((round(ox - FW / 2), 2 * H, round(ox + FW / 2), 2 * H + FH))
    page = Image.new('RGBA', (PW, 290 + FH + 160), (22, 20, 17, 255))
    pd = ImageDraw.Draw(page)
    header(pd)
    page.alpha_composite(crop, (20, 290))
    pd.rounded_rectangle((20, 290, PW - 20, 290 + FH), 18, outline=(170, 136, 70), width=6)
    pd.text((40, 290 + FH + 60), 'Tap a field, mine or building to move people to it.', fill=(190, 180, 160),
            font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf', 34), anchor='lm')
    page.convert('RGB').save(out)


def cards(out):
    CW, CH = (PW - 30 * 3) // 2, 470
    page = Image.new('RGBA', (PW, 290 + 3 * (CH + 30) + 120), (22, 20, 17, 255))
    pd = ImageDraw.Draw(page)
    header(pd)
    for i, name in enumerate(JOBS):
        x0, y0 = 30 + (i % 2) * (CW + 30), 290 + (i // 2) * (CH + 30)
        card = Image.new('RGBA', (CW, CH), (36, 44, 30, 255))
        S = Image.new('RGBA', (CW, CH - 70), (0, 0, 0, 0))
        cx, top = CW / 2, (CH - 70) / 2 - H
        ground = PLOTS[name][2]
        for c, r in [(0, 0), (1, 0), (0, 1), (1, 1)]:
            t = load(ground, W + 2)
            x, y = cx + (c - r) * W / 2, top + (c + r) * H / 2
            S.alpha_composite(t, (round(x - t.width / 2), round(y)))
        dress(S, name, cx, top + 1.5 * H, 0.9)
        card.alpha_composite(S, (0, 0))
        cd = ImageDraw.Draw(card)
        on = COUNTS[name] > 0
        cd.rectangle((0, CH - 70, CW, CH), fill=(60, 14, 14) if on else (28, 24, 20))
        cd.text((24, CH - 35), name, fill=(250, 238, 210), font=ImageFont.truetype(FONT, 36), anchor='lm')
        cd.text((CW - 24, CH - 35), str(COUNTS[name]), fill=(240, 200, 110), font=ImageFont.truetype(FONT, 40), anchor='rm')
        page.alpha_composite(card, (x0, y0))
        pd.rounded_rectangle((x0, y0, x0 + CW, y0 + CH), 16, outline=(212, 168, 80) if on else (120, 104, 80), width=4)
    pd.text((40, page.height - 60), 'Tap a card to move people to that job.', fill=(190, 180, 160),
            font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf', 34), anchor='lm')
    page.convert('RGB').save(out)


if __name__ == '__main__':
    fill(sys.argv[1])
    cards(sys.argv[2])
    if len(sys.argv) > 3:
        fill(sys.argv[3], distinct=True)
    if len(sys.argv) > 5:
        fill(sys.argv[4], distinct=True, spots=LAYOUT_MINE)
        fill(sys.argv[5], distinct=True, spots=LAYOUT_QUARRY)
