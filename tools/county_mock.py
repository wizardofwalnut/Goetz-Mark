"""Render a county's REAL layout (dumped from the game) with the new diamond tiles.

Usage: python3 tools/county_mock.py <interior.json> <out.png> <tile_width> [centre_col centre_row screen_w screen_h hud.png]

Without the screen args it renders the whole county. With them it renders a
phone-sized view centred on (centre_col, centre_row), with the game HUD on top.

Placeholders are marked in TILE_FOR: art that sheet 2 will replace.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

TS = 'art/tileset-grok/'
LAWN = os.environ.get('LAWN', 'lawn')      # 'lawnm' = colour-matched to target-look-5 (Oct 18)
RATIO = 1.55
SHEET_TALL = ('castle', 'house', 'barn', 'wheat', 'mountain', 'bushes', 'rocks', 'watch', 'pasture')

args = sys.argv
it = json.load(open(args[1]))
OUT, W = args[2], float(args[3])
H = W / RATIO
C, R = it['cols'], it['rows']

cell = {}
for g in it['ground']:
    cell[(g['col'], g['row'])] = {'water': 'water', 'ground': 'lawn', 'forest': 'bushes', 'mountain': 'mountain'}.get(g['kind'], 'lawn')
FIELD = {'grain': 'wheat-a', 'cattle': 'pasture-cows', 'fallow': 'grass-tufty', 'barren': 'tilled'}
# FIELDS=s2: the ChatGPT step-2 review tiles (Oct 16). Extra states (sown, growing, parched)
# only appear if the layout file sets them; real Hollowmere has grain/cattle/fallow/barren.
if os.environ.get('FIELDS') == 's2':
    R2 = '../review-s2/'
    FIELD = {'grain': 'wheat-a', 'cattle': R2 + 'pasture', 'fallow': R2 + 'fallow', 'barren': 'tilled',
             'sown': R2 + 'sown', 'growing': R2 + 'growing-wheat', 'parched': R2 + 'parched'}
for f in it['fields']:
    cell[(f['col'], f['row'])] = FIELD.get(f['status'], 'lawn')
S2 = os.environ.get('FIELDS') == 's2'
roads = {(r['col'], r['row']) for r in it['road'] if 0 <= r['col'] < C and 0 <= r['row'] < R}
big = {}   # cell -> (tile name, scale)
for k in it.get('castles', [it.get('castle')]):
    big[(k['col'], k['row'])] = ('standing/castle', 1.5)
for k in it.get('towns', [it.get('town')]):
    big[(k['col'], k['row'])] = ('standing/house-thatch', 1.6)
IND = {'lumberMill': ('standing/barn', 1.2), 'blacksmith': ('standing/house-blue', 1.1), 'quarry': ('standing/rocks', 1.1)}
sprites_on = {}
if os.environ.get('FIELDS') == 's2':
    for g in it['ground']:
        if g['kind'] == 'forest':
            cell[(g['col'], g['row'])] = '../review-s2/forest-floor'
            sprites_on[(g['col'], g['row'])] = ('art/review-s2/forest.png', 1.05)
# NEWART=1: the green-screen buildings accepted Oct 18 (art/review-s3/), standing on the lawn
NEWART = os.environ.get('NEWART') == '1'
if NEWART:
    R3 = 'art/review-s3/'
    for k in it.get('castles', [it.get('castle')]):
        big.pop((k['col'], k['row']), None)
        sprites_on[(k['col'], k['row'])] = (R3 + os.environ.get('CASTLE', 'castle-2-motte-bailey') + '.png', 1.5)
    for k in it.get('towns', [it.get('town')]):
        big.pop((k['col'], k['row']), None)
        sprites_on[(k['col'], k['row'])] = (R3 + 'town.png', 1.6)
    IND = {}
    NEW_IND = {'lumberMill': ('lumber-mill', 1.3), 'blacksmith': ('blacksmith', 1.2), 'quarry': ('quarry', 1.3), 'mine': ('mine', 0.85 * 1.15)}
for i in it['industry']:
    if NEWART and i['kind'] in NEW_IND:
        sprites_on[(i['col'], i['row'])] = (R3 + NEW_IND[i['kind']][0] + '.png', NEW_IND[i['kind']][1])
    elif i['kind'] in IND:
        big[(i['col'], i['row'])] = IND[i['kind']]
    elif i['kind'] == 'mine':
        sprites_on[(i['col'], i['row'])] = ('art/buildings/building-mine.png', float(os.environ.get('MINE_SCALE', '1.25')))

cache = {}
# decoration layer: seeded, cosmetic scatter on plain lawn (no gameplay effect)
import os, random
DECOR = os.environ.get('DECOR', '0') == '1'
decor = {}
if DECOR:
    rnd = random.Random(1)
    near_road = {(c + dc, r + dr) for c, r in roads for dc in (-1, 0, 1) for dr in (-1, 0, 1)}
    # keep the cells behind tall buildings clear, or a bush/rock reads as sitting on the roof
    behind_big = {(c + dc, r + dr) for c, r in list(big) + list(sprites_on) for dc in (-1, 0) for dr in (-1, 0)}
    for (c, r), n in list(cell.items()):
        if n != 'lawn' or (c, r) in roads or (c, r) in big or (c, r) in sprites_on or (c, r) in behind_big:
            continue
        x = rnd.random()
        if x < 0.16:
            decor[(c, r)] = ('standing/bushes', 0.75 + rnd.random() * 0.25)
        elif x < 0.22 and (c, r) not in near_road:
            decor[(c, r)] = ('standing/rocks', 0.6)


def tile(n, scale=1.0):
    k = (n, scale)
    if k in cache:
        return cache[k]
    # geometry always comes from the original slab tile, so a building cut off
    # its slab (tools/unslab.py, in standing/) is placed exactly where it was
    geo = n.split('/')[-1]
    if not os.path.exists(TS + geo + '.png'):      # e.g. '../review-s2/fallow': its own geometry
        geo = n
    im = Image.open(TS + n + '.png').convert('RGBA')
    a = np.array(Image.open(TS + geo + '.png').convert('RGBA'))[:, :, 3] > 128
    ys, xs = np.nonzero(a)
    minx, maxx = xs.min(), xs.max()
    L = np.nonzero(a[:, minx + 2])[0]
    cx = int((minx + maxx) / 2)
    Cc = np.nonzero(a[:, cx])[0]
    s = W * scale / (maxx - minx)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    cache[k] = (im, minx * s, L.min() * s, cx * s, Cc.max() * s)
    return cache[k]


def road(mask):
    k = ('road', mask)
    if k not in cache:
        # roads built at the sheet's angle from the sheet's dirt colour (tools/roadgen_iso.py)
        r = Image.open(f'art/road-sheet/road-{mask:02d}.png').convert('RGBA')
        cache[k] = r.resize((round(W), round(H)), Image.LANCZOS)
    return cache[k]


def mask(c, r):
    return ((1 if (c, r - 1) in roads else 0) | (2 if (c + 1, r) in roads else 0)
            | (4 if (c, r + 1) in roads else 0) | (8 if (c - 1, r) in roads else 0))


if len(args) > 4:
    ccol, crow, SW, SH = float(args[4]), float(args[5]), int(args[6]), int(args[7])
    HUD = args[8] if len(args) > 8 and os.path.exists(args[8]) else None
    ox = SW / 2 - (ccol - crow) * W / 2
    oy = SH * 0.42 - (ccol + crow) * H / 2
else:
    HUD = None
    SW = round((C + R) * W / 2 + 2 * W)
    SH = round((C + R) * H / 2 + 3 * W)
    ox = R * W / 2 + W
    oy = 1.5 * W
img = Image.new('RGBA', (SW, SH), (20, 24, 33, 255))
order = sorted(cell, key=lambda t: (t[0] + t[1], t[0]))


def corner(c, r):          # grid-left-corner of cell (c, r) on screen
    return ox + (c - r) * W / 2 - W / 2, oy + (c + r) * H / 2 + H / 2


def put(n, c, r, scale=1.0):
    im, lx, ly, bx, by = tile(n, scale)
    gx, gy = corner(c, r)
    if scale == 1.0:
        img.alpha_composite(im, (round(gx - lx), round(gy - ly)))
    else:                  # bigger than one tile: stand it on the cell's bottom vertex
        img.alpha_composite(im, (round(gx + W / 2 - bx), round(gy + H / 2 - by)))


def ground_name(c, r):
    n = cell[(c, r)]
    if 'review-s2' in n:
        return n if not n.endswith('growing-wheat') else f'{LAWN}-{c % 2}{r % 2}'
    if n == 'lawn' or (c, r) in roads or (c, r) in big or (c, r) in sprites_on or n.startswith(SHEET_TALL) and n not in ('pasture-cows',):
        if n in ('water',):
            return n
        return f'{LAWN}-{c % 2}{r % 2}'
    return n


# pass 1: flat ground + roads
for c, r in order:
    n = ground_name(c, r)
    if n.startswith(('lawn', 'water', 'tilled', 'grass', 'pasture')) or 'review-s2' in n:
        put(n, c, r)
    else:
        put(f'{LAWN}-{c % 2}{r % 2}', c, r)
    if (c, r) in roads:
        gx, gy = corner(c, r)
        img.alpha_composite(road(mask(c, r)), (round(gx), round(gy - H / 2)))
# pass 2: soft shadows down-right
sh = Image.new('L', img.size, 0)
dd = ImageDraw.Draw(sh)
for c, r in order:
    n = cell[(c, r)]
    k = None
    if (c, r) in decor:
        k = 0.5
    elif (c, r) in big:
        k = big[(c, r)][1] * 0.9
    elif (c, r) in sprites_on:
        k = 1.0
    elif n.startswith(('wheat', 'mountain', 'bushes')):
        k = 0.6 if n.startswith('wheat') else 1.0
    if k:
        gx, gy = corner(c, r)
        sx, sy = W * 0.30 * k, H * 0.30 * k
        dd.polygon([(gx + W / 2 + sx, gy - H / 2 + sy), (gx + W + sx, gy + sy), (gx + W / 2 + sx, gy + H / 2 + sy), (gx + sx, gy + sy)], fill=150)
dark = Image.new('RGBA', img.size, (18, 30, 12, 0))
dark.putalpha(sh.filter(ImageFilter.GaussianBlur(W * 0.10)))
img.alpha_composite(dark)
# county border wall (WALL=1): art/wall-sheet, the 2:1 run sheared to this grid's angle
WALLS = os.environ.get('WALL', '0') == '1'
CW, CR = it.get('countyCols', 7), it.get('countyRows', 19)
if WALLS:
    _run = Image.open('art/wall-sheet/wall-run.png').convert('RGBA')
    _a = np.array(_run)[..., 3] > 128
    _mx = _run.width // 2
    _wall_h = np.ptp(np.nonzero(_a[:, _mx])[0])            # face + cap height at the middle
    _base = np.nonzero(_a[:, _mx])[0].max()              # base-line y under the middle
    soldier_h = 58 * W / 154
    edge_dx = W / 2
    s_h = 0.40 * soldier_h / _wall_h                     # knee-to-waist on a soldier
    n_sec = max(1, round(edge_dx / (_run.width * s_h * 0.88)))
    s_w = edge_dx / n_sec / 0.88 / _run.width             # snap so whole sections fill the edge
    _rs = _run.resize((round(_run.width * s_w), round(_run.height * s_w)), Image.LANCZOS)
    WALL_RUN = (_rs, _rs.transpose(Image.FLIP_LEFT_RIGHT))
    _post = Image.open('art/wall-sheet/wall-post.png').convert('RGBA')
    _post = _post.crop(_post.getbbox())
    ph = 1.25 * _wall_h * s_w
    WALL_POST = _post.resize((round(_post.width * ph / _post.height), round(ph)), Image.LANCZOS)
    posts_done = set()


def county(c, r):
    return (c // CW, r // CR) if (c, r) in cell else None


def walls(c, r, back):
    if not WALLS:
        return
    gx, gy = corner(c, r)
    T, Rt, B, L = (gx + W / 2, gy - H / 2), (gx + W, gy), (gx + W / 2, gy + H / 2), (gx, gy)
    me = county(c, r)
    sides = [((0, -1), T, Rt, 1), ((-1, 0), L, T, 0)] if back else [((1, 0), B, Rt, 0), ((0, 1), L, B, 1)]
    for (dc, dr), p0, p1, flip in sides:
        if county(c + dc, r + dr) == me:
            continue
        if (c, r) in roads and (c + dc, r + dr) in roads:
            continue                                    # a road crosses the border: leave a gap
        im = WALL_RUN[flip]
        for i in range(n_sec):
            f = (i + 0.5) / n_sec
            px, py = p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f
            img.alpha_composite(im, (round(px - im.width / 2), round(py - _base * s_w)))
        for v in (p0, p1):
            k = (round(v[0]), round(v[1]))
            if k not in posts_done:
                posts_done.add(k)
                img.alpha_composite(WALL_POST, (round(v[0] - WALL_POST.width / 2), round(v[1] - WALL_POST.height * 0.92)))


# pass 3: tall things in depth order
for c, r in order:
    n = cell[(c, r)]
    walls(c, r, back=True)
    if (c, r) in big:
        put(big[(c, r)][0], c, r, big[(c, r)][1])
    elif (c, r) in sprites_on:
        p, sc = sprites_on[(c, r)]
        s = Image.open(p).convert('RGBA')
        s = s.crop(s.getbbox())
        w = round(W * sc)
        h = round(s.height * w / s.width)
        s = s.resize((w, h), Image.LANCZOS)
        gx, gy = corner(c, r)
        img.alpha_composite(s, (round(gx + W / 2 - w / 2), round(gy + H * 0.45 - h)))
    elif (c, r) in decor:
        put(decor[(c, r)][0], c, r, decor[(c, r)][1])
    elif n == 'mountain':
        put('standing/mountain-' + 'abc'[(c + r) % 3], c, r)
    elif n == 'bushes':
        put('standing/bushes', c, r)
    elif n.startswith('wheat') or n.endswith('growing-wheat'):
        put(n, c, r)
    walls(c, r, back=False)


def sprite(path, c, r, h, dx=0, dy=0):
    s = Image.open(path).convert('RGBA')
    s = s.crop(s.getbbox())
    h = round(h * W / 154)
    w = round(s.width * h / s.height)
    s = s.resize((w, h), Image.LANCZOS)
    x = ox + (c - r) * W / 2
    y = oy + (c + r) * H / 2 + H / 2
    img.alpha_composite(s, (round(x - w / 2 + dx * W / 154), round(y - h + dy * W / 154)))


sprite('art/wagon/wagon-toward.png', 3, 12, 62, 0, 10)
sprite('art/army/bearer-crimson-toward.png', 4, 9, 72, -10, 8)
sprite('art/army/soldier-toward.png', 4, 9, 58, 22, 14)
sprite('art/army/soldier-toward.png', 4, 9, 58, -38, 18)
if HUD:
    img.alpha_composite(Image.open(HUD).convert('RGBA').crop((0, 0, SW, SH)))
img.convert('RGB').save(OUT)
print(OUT, img.size)
