"""Build the Aldermarch Art Book: a flip-through PDF with one page per asset.

Usage: python3 tools/art_book.py <game.html> <out.pdf>

Every page shows what the game draws today (pulled from the art embedded in
the game file) next to the new art accepted for the Big Bang pass, with a
short description and its status. Pages follow the Art Bible's sections; the
79 manifest keys the game never reads are a thumbnail appendix at the end.

The catalog below is the source of truth for descriptions and new-art
mapping. When art is accepted, add its file here and rebuild.
"""
import base64
import importlib.util
import io
import os
import re
import sys

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

A = 'art/'
TS = A + 'tileset-grok/'
ST = TS + 'standing/'
GI = A + 'ground-iso/'

# status -> (label, colour)
STATUS = {
    'have': ('READY', '#3f8f4f'),
    'standin': ('STAND-IN', '#b07a1e'),
    'sheet2': ('SHEET 2', '#2f6fd0'),
    'canon': ('CANON ZIP', '#7a4fb0'),
    'missing': ('NOT MADE', '#b0413e'),
    'redo': ('REDO', '#b0413e'),
    'nokey': ('NEEDS KEY', '#5a6b7a'),
}

SEATS = ['crimson', 'azure', 'gold', 'sable']

# (section, title, [keys], [(caption, new-art path)], status, description)
CAT = []


def add(section, title, keys, new, status, desc):
    CAT.append((section, title, keys, new, status, desc))


# ---------------------------------------------------------------- ground
S = 'Ground'
add(S, 'Lawn', ['overhead.tile.ground'],
    [('variant 00', TS + 'lawn-00.png'), ('variant 11', TS + 'lawn-11.png')], 'have',
    'Plain open ground: most of every county. Four variants, chosen by '
    '(col % 2, row % 2) so the pattern does not repeat tile to tile. '
    'Known bug: today the key borrows road tile 0 (the no-road shape) through '
    'aliasOf instead of having its own ground image. Fixed when this is wired in Phase B.')
add(S, 'Forest ground', ['overhead.tile.forest'],
    [('stand-in: bushes', ST + 'bushes.png')], 'sheet2',
    'Ground under forest cells; trees are drawn on top as the forest sprite. '
    'The dense-forest tile comes in sheet 2 row 5. Bushes stand in on the mock-ups.')
add(S, 'Mountain ground', ['overhead.tile.mountain'],
    [('lawn under the mountain', TS + 'lawn-00.png')], 'have',
    'Ground under mountain cells. Plain lawn: the mountain itself is a '
    'standing sprite (next pages), so nothing extra is needed here.')
add(S, 'Water', ['overhead.tile.water'],
    [('sheet 1, not used', TS + 'water.png')], 'missing',
    'Water is a map-border element only, not a playable terrain (standing '
    'decision, LOTR2 precedent). Deferred: sheet 1 has a water tile if it is '
    'ever wanted.')
add(S, 'Castle yard ground', ['overhead.tile.yard'], [], 'missing',
    'Ground tile for the castle yard on the labor screen. Not made yet; '
    'check whether the castle-yard sprite (sheet 2 row 2) covers it.')

# ---------------------------------------------------------------- fields
S = 'Fields'
add(S, 'Ripe wheat', ['overhead.field.grain.mature'],
    [('a', TS + 'wheat-a.png'), ('b', TS + 'wheat-b.png'), ('c', TS + 'wheat-c.png')], 'have',
    'A grain field ready for harvest. Three variants from sheet 1. Fields keep '
    'their raised slab, like the fields in the reference picture.')
add(S, 'Green wheat', ['overhead.field.grain.growing'],
    [('Grok fallback (2:1)', GI + 'ground-wheat-growing.png')], 'sheet2',
    'A grain field part-way through the year. Sheet 2 row 1 makes it in the '
    'sheet style; the Grok tile is a fallback at the old angle.')
add(S, 'Sown field', ['overhead.field.grain.sown'],
    [('Grok fallback (2:1)', GI + 'ground-sown-00.png')], 'sheet2',
    'Ploughed furrows with sprouts: what a field looks like after winter sowing. '
    'Sheet 2 row 1.')
add(S, 'Fallow field', ['overhead.field.fallow'],
    [('Grok fallback (2:1)', GI + 'ground-fallow-00.png'), ('stand-in', TS + 'grass-tufty.png')], 'sheet2',
    'Wild grass and weeds: a field that is unused but can be planted. Sheet 2 row 1.')
add(S, 'Barren field', ['overhead.field.barren'],
    [('sheet 1 "tilled"', TS + 'tilled.png')], 'have',
    'Bare dirt that must be reclaimed before it can be planted. The code also '
    'draws it under half-sown crops and as the quarry pit floor.')
add(S, 'Pasture', ['overhead.field.cattle'],
    [('sheet 1: has cows painted in', TS + 'pasture-cows.png')], 'redo',
    'Grazing land for the county herd. The game draws each cow as its own '
    'sprite, so the tile must be plain grass. The fix prompt removes the '
    'cows; sheet 2 row 2 also asks for a plain pasture.')
add(S, 'Parched field', [], [('Grok fallback (2:1)', GI + 'ground-parched-00.png')], 'nokey',
    'Pale cracked earth after a drought. The code already builds this key '
    '(overhead.field.parched) but the manifest has no entry for it: add the key '
    'in Phase B. Sheet 2 row 1.')

# ---------------------------------------------------------------- land
S = 'Land'
add(S, 'Mountains', ['overhead.sprite.mountain'],
    [('a', ST + 'mountain-a.png'), ('b', ST + 'mountain-b.png'), ('c', ST + 'mountain-c.png')], 'have',
    'Standing mountain on a mountain cell, cut off its slab so it rises out of '
    'the lawn. Three variants, chosen by (col + row) % 3.')
add(S, 'Forest', ['overhead.sprite.forest'],
    [('stand-in: bushes', ST + 'bushes.png')], 'sheet2',
    'Trees standing on a forest cell. Dense forest and light woodland come in '
    'sheet 2 row 5.')

# ---------------------------------------------------------------- roads
add('Roads', 'Dirt roads (16 shapes)', ['overhead.road.%d' % i for i in range(16)],
    [('%02d' % i, 'LAWN:' + A + 'road-sheet/road-%02d.png' % i) for i in range(16)], 'have',
    'Every road shape a cell can need. The file number is the autotile mask: '
    'N=1, E=2, S=4, W=8 added together for each neighbouring road. Built by '
    'Claude from the sheet\'s own dirt (tools/roadgen_iso.py), so they join '
    'seamlessly. Phase B: today the keys point at shuffled file names.')

# ---------------------------------------------------------------- borders
add('Borders', 'County border wall', [],
    [('run', A + 'wall-sheet/wall-run.png'), ('post', A + 'wall-sheet/wall-post.png')], 'nokey',
    'Low dry-stone wall along county borders: cosmetic only, one look all year. '
    'One run piece (mirrored for the other edge direction) and a post at every '
    'corner; a gap is left where a road crosses. Today it is plain SVG lines; '
    'Phase B adds two manifest keys.')

# ---------------------------------------------------------------- settlements
S = 'Castles and town'
for k, name, d in [
    ('woodenPalisade', 'Wooden palisade', 'Tier 1: a timber stockade fort.'),
    ('motteAndBailey', 'Motte and bailey', 'Tier 2: a wooden tower on an earth mound.'),
    ('normanKeep', 'Norman keep', 'Tier 3: a square stone keep.'),
    ('stoneCastle', 'Stone castle', 'Tier 4: walls and towers.'),
    ('royalCastle', 'Royal castle', 'Tier 5: the largest castle.'),
]:
    add(S, name, ['overhead.castle.' + k],
        [('stand-in (has flags)', ST + 'castle.png')], 'sheet2',
        d + ' The castle on the county map, cut off its slab so it stands on the '
        'lawn. The owner\'s seat flag is drawn on top by the game, so the art must '
        'have no flags. All five tiers come in sheet 2 row 3.')
for i, c in enumerate(SEATS):
    add(S, 'Castle flag: ' + c, ['overhead.castle.flag.%d' % i],
        [(c, A + 'flag/flag-%s.png' % c)], 'have',
        'The owner\'s flag, drawn over their castle and on their caravans. Cut '
        'from the banner-bearer art. Phase B: raise it above the wagon canopy.')
add(S, 'Town', ['overhead.town'],
    [('stand-in', ST + 'house-thatch.png')], 'sheet2',
    'The county\'s town: a village cluster of several houses (decided Oct 7). '
    'Sheet 2 row 5.')

# ---------------------------------------------------------------- industry
S = 'Industry'
add(S, 'Mine', ['overhead.industry.mine'],
    [('green pack, Oct 11', A + 'buildings/building-mine.png')], 'have',
    'Mine entrance in a rocky mound with a winding frame. Too big at 1.25 tiles '
    'wide; 0.85 recommended (size pending). Compare with sheet 2\'s mine and '
    'keep whichever matches the sheet.')
add(S, 'Lumber mill', ['overhead.industry.lumberMill'],
    [('stand-in: barn', ST + 'barn.png')], 'sheet2',
    'Where woodcutters turn timber into wood. Sheet 2 row 4.')
add(S, 'Blacksmith', ['overhead.industry.blacksmith'],
    [('stand-in: house', ST + 'house-blue.png')], 'sheet2',
    'Forge that turns ore into weapons. Sheet 2 row 4.')
add(S, 'Quarry', ['overhead.industry.quarry'],
    [('stand-in: rocks', ST + 'rocks.png')], 'sheet2',
    'Stone pit. Its floor uses the barren-field tile. Sheet 2 row 4.')
add(S, 'Open-air forge', ['overhead.sprite.forge-open'], [], 'sheet2',
    'Canopy, anvil and hearth with no walls, on the labor screen. Sheet 2 row 2.')
add(S, 'Castle yard', ['overhead.sprite.castle-yard'], [], 'sheet2',
    'A ring of wall around an empty yard where the workforce stands on the '
    'labor screen. Sheet 2 row 2.')

# ---------------------------------------------------------------- props & animals
S = 'Props and animals'
add(S, 'Cow', ['overhead.sprite.cow'], [('', A + 'props/prop-cow.png')], 'have',
    'One grazing cow. The game draws a herd as several of these on the pasture.')
add(S, 'Ore cart', ['overhead.sprite.ore-cart'], [('', A + 'props/prop-minecart.png')], 'have',
    'Mine cart: what makes a mine entrance read as being worked.')
for k, f, d in [
    ('timber', 'prop-logs', 'Log pile beside the lumber mill.'),
    ('graincart', 'prop-cart', 'Hand cart on grain fields at harvest.'),
    ('barrels', 'prop-barrels', 'Barrels dressing a plot.'),
    ('spoil', 'prop-rubble', 'Rubble heap at the quarry. Gaps between stones are real, checked on magenta.'),
    ('sawhorse', 'prop-sawhorse', 'Sawhorse beside the lumber mill.'),
]:
    add(S, k.capitalize() if k != 'graincart' else 'Grain cart', ['overhead.prop.' + k],
        [('', A + 'props/%s.png' % f)], 'have',
        d + ' Plot dressing: says what a plot is, whoever is working on it.')

# ---------------------------------------------------------------- people on the map
S = 'People and wagons'
add(S, 'Wagon', ['overhead.sprite.wagon'],
    [('toward', A + 'wagon/wagon-toward.png'), ('away', A + 'wagon/wagon-away.png')], 'have',
    'Caravans and supply wagons. One wagon for all: the seat flag on top tells '
    'them apart. Faces its last move: two views, mirrored for the other two directions.')
add(S, 'Soldier', ['overhead.army.soldier'],
    [('toward', A + 'army/soldier-toward.png'), ('away', A + 'army/soldier-away.png')], 'have',
    'An army on the map is a banner-bearer plus soldiers. Faces its last move.')
for i, c in enumerate(SEATS):
    add(S, 'Banner-bearer: ' + c, ['overhead.army.bearer.%d' % i],
        [('toward', A + 'army/bearer-%s-toward.png' % c), ('away', A + 'army/bearer-%s-away.png' % c)], 'have',
        'Leads an army and carries the owner\'s colour. Seat %d is %s.' % (i + 1, c))
for job, d in [
    ('farmer', 'Works grain fields.'), ('herder', 'Tends the herd.'),
    ('woodcutter', 'Works the lumber mill.'), ('miner', 'Works the mine and quarry.'),
    ('blacksmith', 'Works the blacksmith.'), ('idle', 'Unassigned worker in the centre of the labor screen.'),
]:
    add(S, 'Laborer: ' + job, ['overhead.sprite.laborer-' + job], [], 'canon',
        d + ' Labor-screen figure (28 px). The diorama version is one of the 44 '
        'canon assets; copy it into art/ when the canon zip is attached.')
add(S, 'Laborer: builder', [], [], 'nokey',
    'New role for castle building (labor_builder in the canon set). Needs a key in Phase B.')

# ---------------------------------------------------------------- units
S = 'Troops (roster icons)'
for k, d in [('militia', 'Militia.'), ('archers', 'Archers.'), ('knights', 'Mounted knight with sword.'),
             ('mercenaries', 'Mercenaries. No image exists yet.')]:
    add(S, k.capitalize(), ['unit.' + k], [], 'canon' if k != 'mercenaries' else 'missing',
        d + ' Icon in the army roster panel; may keep its baked ground tile. Check at 18 px.')
for k in ['crossbowmen', 'swordsmen', 'macemen', 'pikemen']:
    add(S, k.capitalize(), [], [], 'nokey',
        'The game has 8 troop kinds, not 4. The image is in the canon set; add the '
        'key unit.%s in Phase B.' % k)
add(S, 'Knight overrides', ['unit.militia.knight', 'unit.knights.knight'], [], 'missing',
    'Faction overrides with no separate art. Being removed: the base key is used instead.')

# ---------------------------------------------------------------- banners & icons
S = 'Banners'
for k, f in [('crimson', 'crimson'), ('steel', 'steel'), ('gold', 'gold'), ('verdigris', 'sable')]:
    add(S, 'Banner: ' + f, ['banner.' + k], [('', A + 'banner/%s.png' % f)], 'have',
        'Seat banner, shown on the Best Noble screen and seat panels.' +
        (' Seat 4 is now sable, not verdigris (green was hard to tell from blue for '
         'colour-blind players). Phase B: rename the key and fix BEST_NOBLE_BANNERS.' if k == 'verdigris' else ''))

S = 'Weapons and armour'
add(S, 'Swords', ['resource.swords'], [('', A + 'icons/item_sword.png')], 'have',
    'Weapon stock icon. Redone Oct 11 (the first one read as a dagger). Navy background like the icon catalog.')
add(S, 'Knight armour', ['resource.armor'], [('', A + 'icons/item_knight_helm.png')], 'have',
    'The "Knight Armor" icon: a great helm matching the knight.')
add(S, 'Bows', ['resource.bows'], [], 'canon',
    'Accepted earlier, but the file is not in art/icons/. Known bug: the key is '
    'declared with no file, so nothing shows today. Find it in the canon zip.')
for k in ['crossbows', 'maces', 'pikes']:
    add(S, k.capitalize(), ['resource.' + k], [], 'canon',
        'Weapon stock icon, generated directly (Sep 4). Check against the key when the canon zip is here.')

S = 'Resources'
for k, d in [('wheat', 'Grain'), ('cows', 'Cattle'), ('wood', 'Wood'), ('ore', 'Iron ore'),
             ('stone', 'Stone'), ('gold', 'Gold')]:
    add(S, d, ['resource.' + k, 'figma.resource.' + k], [], 'missing',
        d + ' icon for panels and reports (resource.%s) and its HUD version '
        '(figma.resource.%s). Not started; confirm the HUD style first.' % (k, k))


# ================================================================ rendering
PW, PH = 420, 760                     # phone-shaped page, points
M = 22
BG = HexColor('#f4efe4')              # parchment
INK = HexColor('#2b2620')
SUB = HexColor('#7a6e5e')
PANEL = HexColor('#2a2f3a')           # dark panel: art is lit for a dark map

cache = {}


def prep(path_or_bytes, max_px=440):
    """PIL-load, upscale tiny pixel art with nearest, cap big images."""
    key = path_or_bytes if isinstance(path_or_bytes, str) else id(path_or_bytes)
    if key in cache:
        return cache[key]
    if isinstance(path_or_bytes, str) and path_or_bytes.startswith('LAWN:'):
        # a transparent road overlay shown on a lawn tile, uncropped, so every
        # shape is drawn at the same scale and reads as it will on the map
        road = Image.open(path_or_bytes[5:]).convert('RGBA')
        lawn = Image.open(TS + 'lawn-00.png').convert('RGBA')
        lb = lawn.getbbox()
        lawn = lawn.crop(lb)
        top_h = round(lawn.width / 1.55)          # lawn's top face; the rest is the slab side
        k = lawn.width / road.width
        road = road.resize((lawn.width, round(road.height * k)), Image.LANCZOS)
        im = lawn.copy()
        im.alpha_composite(road, (0, max(0, (top_h - road.height) // 2)))
    else:
        im = Image.open(path_or_bytes if isinstance(path_or_bytes, str) else io.BytesIO(path_or_bytes)).convert('RGBA')
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
    m = max(im.size)
    if m < 160:
        k = max(1, 200 // m)
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    elif m > max_px:
        k = max_px / m
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    buf.seek(0)
    r = (ImageReader(buf), im.size)
    cache[key] = r
    return r


def draw_img(c, src, x, y, w, h):
    ir, (iw, ih) = prep(src)
    k = min(w / iw, h / ih)
    dw, dh = iw * k, ih * k
    c.drawImage(ir, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask='auto')


def chip(c, x, y, status):
    label, col = STATUS[status]
    c.setFont('Helvetica-Bold', 8)
    w = c.stringWidth(label, 'Helvetica-Bold', 8) + 12
    c.setFillColor(HexColor(col))
    c.roundRect(x - w, y - 4, w, 15, 4, stroke=0, fill=1)
    c.setFillColor(HexColor('#ffffff'))
    c.drawString(x - w + 6, y + 0.5, label)


def footer(c, n, section):
    c.setFont('Helvetica', 7.5)
    c.setFillColor(SUB)
    c.drawString(M, 16, 'Aldermarch Art Book  ·  ' + section)
    c.drawRightString(PW - M, 16, str(n))


def panel(c, x, y, w, h, title):
    c.setFillColor(PANEL)
    c.roundRect(x, y, w, h, 6, stroke=0, fill=1)
    c.setFillColor(SUB)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(x, y + h + 5, title.upper())


def grid(c, items, x, y, w, h, cols=None):
    """items: [(caption, src)] laid out inside a panel."""
    n = len(items)
    cols = cols or (1 if n == 1 else 2 if n <= 4 else 4)
    rows = (n + cols - 1) // cols
    cw, ch = w / cols, h / rows
    cap = any(t for t, _ in items)
    for i, (t, src) in enumerate(items):
        cx, cy = x + (i % cols) * cw, y + h - (i // cols + 1) * ch
        pad = 8 if n > 1 else 14
        draw_img(c, src, cx + pad, cy + pad + (11 if cap else 0), cw - 2 * pad, ch - 2 * pad - (11 if cap else 0))
        if t:
            c.setFillColor(HexColor('#c9c2b4'))
            c.setFont('Helvetica', 7.5)
            c.drawCentredString(cx + cw / 2, cy + 6, t)


def empty(c, x, y, w, h, text):
    c.setFillColor(HexColor('#8d96a6'))
    c.setFont('Helvetica-Oblique', 9.5)
    c.drawCentredString(x + w / 2, y + h / 2 - 3, text)


def asset_page(c, n, entry, cur):
    section, title, keys, new, status, desc = entry
    c.setFillColor(BG)
    c.rect(0, 0, PW, PH, stroke=0, fill=1)
    c.setFillColor(SUB)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(M, PH - 34, section.upper())
    chip(c, PW - M, PH - 36, status)
    c.setFillColor(INK)
    c.setFont('Times-Bold', 24)
    c.drawString(M, PH - 66, title)
    c.setFont('Courier', 8)
    c.setFillColor(SUB)
    kt = ', '.join(keys) if len(keys) <= 2 else '%s ... %s (%d keys)' % (keys[0], keys[-1], len(keys))
    c.drawString(M, PH - 82, kt if keys else 'no manifest key yet')

    # new art (big)
    ny, nh = 250, 400
    panel(c, M, ny, PW - 2 * M, nh, 'New art')
    if new:
        grid(c, new, M, ny, PW - 2 * M, nh)
    else:
        empty(c, M, ny, PW - 2 * M, nh, {
            'canon': 'in the canon zip, not copied into art/ yet',
            'sheet2': 'comes in ChatGPT sheet 2',
            'nokey': 'art exists in the canon set; no key yet',
        }.get(status, 'no new art yet'))

    # in the game now (small)
    gy, gh = 100, 120
    panel(c, M, gy, 130, gh, 'In the game now')
    curs = [cur[k] for k in (keys[::-1] if len(keys) > 2 else keys) if cur.get(k)]   # roads: show the crossroads
    if curs:
        draw_img(c, curs[0], M + 10, gy + 8, 110, gh - 16)
    else:
        empty(c, M, gy, 130, gh, 'nothing')
    st = ParagraphStyle('d', fontName='Helvetica', fontSize=9.5, leading=13.2, textColor=INK)
    p = Paragraph(desc, st)
    w, h = p.wrap(PW - 2 * M - 146, 200)
    p.drawOn(c, M + 146, gy + gh - h)
    files = [s.replace('LAWN:', '') for _, s in new]
    if files:
        st2 = ParagraphStyle('f', fontName='Courier', fontSize=6.8, leading=8.5, textColor=SUB)
        txt = os.path.dirname(files[0]) + '/' if len(files) > 3 else '<br/>'.join(files)
        p2 = Paragraph(txt, st2)
        w2, h2 = p2.wrap(PW - 2 * M, 100)
        p2.drawOn(c, M, gy - 14 - h2)
    footer(c, n, section)
    c.showPage()


def text_page(c, n, title, paras, section='About'):
    c.setFillColor(BG)
    c.rect(0, 0, PW, PH, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont('Times-Bold', 26)
    c.drawString(M, PH - 70, title)
    st = ParagraphStyle('t', fontName='Helvetica', fontSize=10.5, leading=15, textColor=INK, spaceAfter=8)
    y = PH - 96
    for t in paras:
        p = Paragraph(t, st)
        w, h = p.wrap(PW - 2 * M, PH)
        p.drawOn(c, M, y - h)
        y -= h + 9
    footer(c, n, section)
    c.showPage()


def section_page(c, n, name, count):
    c.setFillColor(HexColor('#2a2f3a'))
    c.rect(0, 0, PW, PH, stroke=0, fill=1)
    c.setFillColor(HexColor('#e9dcc0'))
    c.setFont('Times-Bold', 32)
    c.drawCentredString(PW / 2, PH / 2 + 10, name)
    c.setFont('Helvetica', 10)
    c.setFillColor(HexColor('#a9b0bd'))
    c.drawCentredString(PW / 2, PH / 2 - 16, '%d page%s' % (count, '' if count == 1 else 's'))
    c.showPage()


def appendix(c, n0, keys, cur):
    per = 12
    n = n0
    for s in range(0, len(keys), per):
        chunk = keys[s:s + per]
        c.setFillColor(BG)
        c.rect(0, 0, PW, PH, stroke=0, fill=1)
        c.setFillColor(INK)
        c.setFont('Times-Bold', 18)
        c.drawString(M, PH - 56, 'Never read by the game (%d-%d of %d)' % (s + 1, s + len(chunk), len(keys)))
        cw, ch = (PW - 2 * M) / 3, 150
        for i, k in enumerate(chunk):
            x = M + (i % 3) * cw
            y = PH - 90 - (i // 3 + 1) * ch
            c.setFillColor(PANEL)
            c.roundRect(x + 4, y + 22, cw - 8, ch - 30, 5, stroke=0, fill=1)
            if cur.get(k):
                draw_img(c, cur[k], x + 12, y + 30, cw - 24, ch - 46)
            else:
                empty(c, x + 4, y + 22, cw - 8, ch - 30, 'no image')
            c.setFillColor(INK)
            c.setFont('Courier', 6.6)
            c.drawCentredString(x + cw / 2, y + 10, k)
        footer(c, n, 'Appendix')
        c.showPage()
        n += 1
    return n


def main(game, out):
    s = open(game, encoding='utf-8').read()
    body = re.search(r'entries:\s*\{(.*?)\n\t\}', s, re.DOTALL).group(1)
    ent = {}
    for m in re.finditer(r'"([a-zA-Z0-9_.\-]+)":\s*\{([^}]*)\}', body):
        d = dict((mm.group(1), mm.group(3)) for mm in re.finditer(r'"?(\w+)"?\s*:\s*"([^"]*)"', m.group(2)) if False)
        p = re.search(r'"path"\s*:\s*"([^"]+)"', m.group(2))
        a = re.search(r'"aliasOf"\s*:\s*"([^"]+)"', m.group(2))
        ent[m.group(1)] = (p.group(1) if p else None, a.group(1) if a else None)
    imgs = {m.group(1): base64.b64decode(m.group(2)) for m in re.finditer(
        r'"([a-zA-Z0-9_./\-]+\.(?:png|webp|jpg))"\s*:\s*"data:image/\w+;base64,([A-Za-z0-9+/=]+)"', s)}
    cur = {}
    for k, (p, a) in ent.items():
        q = p or (ent.get(a, (None,))[0] if a else None)
        if q in imgs:
            cur[k] = imgs[q]
    spec = importlib.util.spec_from_file_location('xc', os.path.join(os.path.dirname(__file__), 'extra_checks.py'))
    xc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(xc)
    text, code = xc.load(game)
    _, unread = xc.check_unread_keys(text, code)
    unread = sorted(set(unread) | {k for k in ent if k.startswith('field.')})   # fieldArt has no callers

    covered = {k for e in CAT for k in e[2]}
    missing = [k for k in ent if k not in covered and k not in unread]
    if missing:
        print('WARNING: read keys with no page:', missing)
    for e in CAT:
        for _, f in e[3]:
            if not os.path.exists(f.replace('LAWN:', '')):
                print('WARNING: missing file', f)

    c = canvas.Canvas(out, pagesize=(PW, PH))
    c.setTitle('Aldermarch Art Book')
    c.setAuthor('Aldermarch')
    counts = {}
    for e in CAT:
        counts[e[0]] = counts.get(e[0], 0) + 1
    ready = sum(1 for e in CAT if e[4] == 'have')
    # cover
    c.setFillColor(HexColor('#2a2f3a'))
    c.rect(0, 0, PW, PH, stroke=0, fill=1)
    draw_img(c, A + 'army/bearer-crimson-toward.png', PW / 2 - 70, PH / 2 - 10, 140, 230)
    c.setFillColor(HexColor('#e9dcc0'))
    c.setFont('Times-Bold', 36)
    c.drawCentredString(PW / 2, PH / 2 - 70, 'Aldermarch')
    c.setFont('Times-Roman', 18)
    c.drawCentredString(PW / 2, PH / 2 - 96, 'Art Book')
    c.setFont('Helvetica', 9)
    c.setFillColor(HexColor('#a9b0bd'))
    c.drawCentredString(PW / 2, 60, 'Every asset the game is made from  ·  Oct 11, 2026')
    c.showPage()
    n = 2
    text_page(c, n, 'How to read this', [
        'One page per asset. The <b>big panel</b> is the new art for the Big Bang '
        'pass; the <b>small panel</b> is what the game draws today, pulled straight '
        'from the art embedded in the game file.',
        'The tag in the top corner says where each one stands: '
        '<font color="#3f8f4f"><b>READY</b></font> accepted; '
        '<font color="#b07a1e"><b>STAND-IN</b></font> a placeholder on the mock-ups; '
        '<font color="#2f6fd0"><b>SHEET 2</b></font> comes in the next ChatGPT sheet; '
        '<font color="#7a4fb0"><b>CANON ZIP</b></font> exists in the canon set, not copied in yet; '
        '<font color="#b0413e"><b>NOT MADE</b></font> or <font color="#b0413e"><b>REDO</b></font>; '
        '<font color="#5a6b7a"><b>NEEDS KEY</b></font> art the game will use but has no manifest entry for yet.',
        '<b>%d asset pages, %d ready.</b> The game\'s manifest has %d keys; it reads %d. '
        'The %d it never reads are thumbnails in the appendix; art for those would never appear.'
        % (len(CAT), ready, len(ent), len(ent) - len(unread), len(unread)),
        'Built by <font face="Courier">tools/art_book.py</font> from the game file and '
        'the accepted art in <font face="Courier">art/</font>. Rebuild it whenever art is '
        'accepted; the Art Bible (<font face="Courier">art/ART_BIBLE.md</font>) stays the '
        'record of decisions.',
    ])
    n += 1
    last = None
    for e in CAT:
        if e[0] != last:
            section_page(c, n, e[0], counts[e[0]])
            n += 1
            last = e[0]
        asset_page(c, n, e, cur)
        n += 1
    section_page(c, n, 'Appendix', (len(unread) + 11) // 12)
    n += 1
    n = appendix(c, n, unread, cur)
    c.save()
    print(out, n - 1, 'pages;', len(CAT), 'assets;', ready, 'ready')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
