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
from reportlab import rl_config
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

rl_config.useA85 = 0      # no ASCII85 wrapping: it inflates every image ~25%
A = 'art/'
TS = A + 'tileset-grok/'
ST = TS + 'standing/'
GI = A + 'ground-iso/'

# status -> (label, colour)
STATUS = {
    'have': ('READY', '#3f8f4f'),
    'standin': ('STAND-IN', '#b07a1e'),
    'sheet2': ('SHEET 2', '#2f6fd0'),
    'canon': ('CANON', '#7a4fb0'),
    'missing': ('NOT MADE', '#b0413e'),
    'redo': ('REDO', '#b0413e'),
    'nokey': ('NEEDS KEY', '#5a6b7a'),
    'remove': ('REMOVE', '#5a6b7a'),
    'ref': ('REFERENCE', '#5a6b7a'),
    'old': ('SUPERSEDED', '#8a8a8a'),
}

CN = A + '_canon/'      # the canon set (Sep 4-5), copied from Downloads Oct 12

# Canon images shown under the new art (or instead of it when there is none).
# Keyed by page title. The canon set is the earlier Grok diorama pass: same
# style family, kept as the reference for what each asset should show.
CANON = {
    'Wooden palisade': [('canon tier 1', CN + 'castle-1-palisade.jpg')],
    'Motte and bailey': [('canon tier 2', CN + 'castle-2-motte-bailey.jpg')],
    'Norman keep': [('canon tier 3', CN + 'castle-3-norman-keep.jpg')],
    'Stone castle': [('canon tier 4', CN + 'castle-4-stone.jpg')],
    'Royal castle': [('canon tier 5', CN + 'castle-5-royal.jpg')],
    'Town': [('village cluster', CN + 'village-cluster.jpg'), ('small village', CN + 'village-small.jpg')],
    'Mine': [('canon', CN + 'industry-mine.jpg')],
    'Lumber mill': [('canon', CN + 'industry-lumbermill.jpg')],
    'Blacksmith': [('canon', CN + 'industry-blacksmith.jpg')],
    'Quarry': [('canon', CN + 'industry-quarry.jpg')],
    'Sown field': [('canon', CN + 'field-sown.jpg')],
    'Parched field': [('canon', CN + 'field-parched.jpg')],
    'Pasture': [('canon (cows painted in too)', CN + 'field-pasture.jpg')],
    'Laborer: woodcutter': [('canon labor_lumber', CN + 'labor-lumber.jpg')],
    'Laborer: miner': [('labor_miner', CN + 'labor-miner.jpg'), ('labor_quarry', CN + 'labor-quarry.jpg')],
    'Laborer: blacksmith': [('canon', CN + 'labor-blacksmith.jpg')],
    'Laborer: idle': [('canon labor_unemployed', CN + 'labor-unemployed.jpg')],
    'Laborer: builder': [('canon labor_builder', CN + 'labor-builder.jpg')],
    'Militia': [('canon', CN + 'unit-militia.jpg')],
    'Archers': [('canon', CN + 'unit-archer.jpg')],
    'Knights': [('plate, with sword', CN + 'unit-knight-plate.jpg'), ('mail, with lance', CN + 'unit-knight-mail.jpg')],
    'Crossbowmen': [('canon', CN + 'unit-crossbowman.jpg')],
    'Swordsmen': [('canon', CN + 'unit-swordsman.jpg')],
    'Macemen': [('canon', CN + 'unit-maceman.jpg')],
    'Pikemen': [('canon', CN + 'unit-pikeman.png')],
    'Siege ram': [('canon', CN + 'siege-ram.jpg')],
}
GAMEIMG = {}             # manifest key -> bytes, filled in main(); 'GAME:<key>' sources

SEATS = ['crimson', 'azure', 'gold', 'sable']

# (section, title, [keys], [(caption, new-art path)], status, description)
CAT = []


def add(section, title, keys, new, status, desc):
    CAT.append((section, title, keys, new, status, desc))


# ---------------------------------------------------------------- ground
S = 'Ground'
add(S, 'Lawn', ['overhead.tile.ground'],
    [('variant ' + v, TS + 'lawn-%s.png' % v) for v in ('00', '01', '10', '11')], 'have',
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
        d + ' Labor-screen figure (28 px). ' + ('The canon diorama version is shown; check it '
        'at 28 px, then accept it.' if job not in ('farmer', 'herder') else 'No canon diorama '
        'version was among the images found on your computer (Oct 12); the old figure is shown large.'))
add(S, 'Laborer: builder', [], [], 'nokey',
    'New role for castle building (labor_builder in the canon set). Needs a key in Phase B.')

# ---------------------------------------------------------------- units
S = 'Troops (roster icons)'
for k, d in [('militia', 'Militia.'), ('archers', 'Archers.'), ('knights', 'Mounted knight with sword.'),
             ('mercenaries', 'Mercenaries. The game has an old pixel-art icon; the canon set '
              'has no diorama version, so one still needs making.')]:
    add(S, k.capitalize(), ['unit.' + k], [], 'canon' if k != 'mercenaries' else 'missing',
        d + ' Icon in the army roster panel (18 px); may keep its baked ground tile.')
for k in ['crossbowmen', 'swordsmen', 'macemen', 'pikemen']:
    add(S, k.capitalize(), [], [], 'nokey',
        'The game has 8 troop kinds, not 4. The image is in the canon set; add the '
        'key unit.%s in Phase B.' % k)
add(S, 'Knight overrides', ['unit.militia.knight', 'unit.knights.knight'],
    [('militia (what shows)', 'GAME:unit.militia'), ('knights (what shows)', 'GAME:unit.knights')], 'remove',
    'Faction overrides for the Knight faction. Both keys are marked pending with no file, '
    'so the game already shows the plain militia and knight icons (shown). Delete the two keys in Phase B.')
add(S, 'Siege ram', [], [], 'nokey',
    'In the canon set, but no troop kind uses it. Kept for later; no key.')

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
add(S, 'Bows', ['resource.bows'], [('nearest: the canon archer\'s bow', CN + 'unit-archer.jpg')], 'missing',
    'Weapon stock icon. Known bug: the key is declared but its file was never embedded, so '
    'nothing shows today. The bow icon accepted earlier is not in the repo or in the canon '
    'images found on your computer (Oct 12). Make it with the other weapon icons; the archer '
    'is shown only as a reference for the bow.')
for k in ['crossbows', 'maces', 'pikes']:
    add(S, k.capitalize(), ['resource.' + k], [], 'missing',
        'Weapon stock icon. The game has an old pixel-art one (shown large). The canon '
        'images have no weapon icons, so the new one is still to make, in the same style '
        'as the new sword and knight helm (navy background).')

S = 'Resources'
for k, d in [('wheat', 'Grain'), ('cows', 'Cattle'), ('wood', 'Wood'), ('ore', 'Iron ore'),
             ('stone', 'Stone'), ('gold', 'Gold')]:
    add(S, d, ['resource.' + k, 'figma.resource.' + k],
        [('panels: resource.' + k, 'GAME:resource.' + k), ('top bar: figma.resource.' + k, 'GAME:figma.resource.' + k)],
        'missing',
        d + ' has two icons today, both old style: one for panels and reports '
        '(resource.%s) and the Figma version in the top bar (figma.resource.%s, '
        'preferred there). A set matching the new diorama art is not started; confirm '
        'the top-bar style first.' % (k, k))

# ---------------------------------------------------------------- decoration & spares
add('Land', 'Decoration: bushes and rocks', [],
    [('bushes', ST + 'bushes.png'), ('rocks', ST + 'rocks.png'), ('flowers', TS + 'grass-flowers.png')], 'nokey',
    'Cosmetic scatter on empty lawn so a county looks as busy as the concept art: about '
    '16% bushes and 6% rocks, seeded per county, never next to a road or just behind a '
    'tall building. No gameplay effect. Phase B: add keys for the pieces.')

S = 'Spare and reference art'
add(S, 'Sheet 1 spares', [],
    [('wooden bridge', TS + 'bridge-wood.png'), ('stone bridge', TS + 'bridge-stone.png'),
     ('flagstone', TS + 'flagstone.png'), ('shore', TS + 'shore.png'),
     ('plain grass', TS + 'grass.png'), ('watchtower', ST + 'watchtower.png'),
     ('wagon tile', TS + 'wagon-tile.png'), ('crossroads (road colour)', TS + 'road-cross.png')], 'nokey',
    'Tiles from ChatGPT sheet 1 with no use in the game today. The crossroads tile is where '
    'the road dirt colour came from. The watchtower is kept in case watchtowers are added later '
    '(it has a painted flag to remove first). Bridges and shore wait on water, which is deferred.')
add(S, 'Style reference scenes', [],
    [('target look', A + '_reference/target-look-hollowmere.jpg'), ('', A + '_reference/target-look-2.jpg'),
     ('', A + '_reference/target-look-3.jpg'), ('', A + '_reference/target-look-4.jpg'),
     ('canon scene', CN + 'scene-a.jpg'), ('', CN + 'scene-b.jpg'), ('', CN + 'scene-c.jpg'), ('', CN + 'scene-d.jpg')], 'ref',
    'Concept paintings that set the target look: warm light, chunky diorama tiles, small '
    'figures on big fields. Style references only. They are single paintings, not built from '
    'tiles, so no game art is cut from them (Lessons, Oct 11).')
add(S, 'Canon index sheets', [],
    [('troops', CN + '_index-units.jpg'), ('castles and laborers', CN + '_index-castles-labor.jpg')], 'ref',
    'The labelled contact sheets from the Sep 4-5 canon pass. The troop icons in this book are '
    'cut from the first one (about 280 px each, enough for an 18 px roster icon). Files: art/_canon/.')
add(S, 'Superseded: square-grid roads', [],
    [('%02d' % i, A + 'road/road-%02d.png' % i) for i in range(16)], 'old',
    'The Oct 6 road set for the square grid. Replaced by the diamond roads (Roads section). Kept for history.')
add(S, 'Superseded: 2:1 diamond roads', [],
    [('%02d' % i, A + 'road-iso/road-%02d.png' % i) for i in range(16)], 'old',
    'The first diamond roads, at 2:1 and in Grok\'s dirt colour. Replaced the same day by the '
    'sheet-angle set (1.55:1). Kept for history.')
add(S, 'Superseded: border walls', [],
    [('square: left-right', A + 'wall/wall-run-leftright.png'), ('square: front-back', A + 'wall/wall-run-frontback.png'),
     ('square: post', A + 'wall/wall-post.png'), ('2:1 run', A + 'wall-iso/wall-run.png')], 'old',
    'The square-grid wall kit (Oct 6) and the 2:1 diamond run (Oct 11). The current wall is '
    'the 2:1 run sheared to the sheet angle (Borders section).')
add(S, 'Fallback: Grok ground tiles', [],
    [(n, GI + 'ground-%s-00.png' % n) for n in ('meadow', 'forest', 'fallow', 'barren', 'sown', 'parched', 'pasture')]
    + [('ripe wheat', GI + 'ground-wheat-ripe.png')], 'old',
    'Ground tiles built from Grok textures at 2:1 (each type also has variants -01 -10 -11). '
    'Darker and more photo-like than ChatGPT sheet 1. Kept only in case sheet 2 misses a field '
    'type; re-project to 1.55 before using.')


# ================================================================ rendering
PW, PH = 420, 760                     # phone-shaped page, points
M = 22
BG = HexColor('#f4efe4')              # parchment
INK = HexColor('#2b2620')
SUB = HexColor('#7a6e5e')
PANEL = HexColor('#2a2f3a')           # dark panel: art is lit for a dark map

cache = {}
MAXPX = 440
import tempfile
JPG_DIR = tempfile.mkdtemp(prefix='artbook-')


def prep(path_or_bytes, max_px=440):
    """PIL-load, upscale tiny pixel art with nearest, cap big images."""
    key = (path_or_bytes if isinstance(path_or_bytes, str) else id(path_or_bytes), max_px)
    if key in cache:
        return cache[key]
    if isinstance(path_or_bytes, str) and path_or_bytes.startswith('GAME:'):
        path_or_bytes = GAMEIMG[path_or_bytes[5:]]
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
    if True:
        # every picture sits on the dark panel colour, so flatten transparency onto it and
        # hand ReportLab a JPEG file: embedded as-is (DCT), a fraction of a PNG's size
        if im.getchannel('A').getextrema()[0] < 255:
            bg = Image.new('RGBA', im.size, (0x2a, 0x2f, 0x3a, 255))
            bg.alpha_composite(im)
            im = bg
        os.makedirs(JPG_DIR, exist_ok=True)
        fn = os.path.join(JPG_DIR, '%d.jpg' % len(cache))
        im.convert('RGB').save(fn, 'JPEG', quality=86)
        r = (fn, im.size)
        cache[key] = r
        return r
    im.save(buf, 'PNG', optimize=True)
    buf.seek(0)
    r = (ImageReader(buf), im.size)
    cache[key] = r
    return r


def draw_img(c, src, x, y, w, h):
    # store each picture at ~2x the size it is drawn (sharp on a phone, small file)
    ir, (iw, ih) = prep(src, max_px=min(MAXPX, int(max(w, h) * 2.2)))
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

    # big area: new art, the canon version, or (if neither) today's art large
    ny, nh = 250, 400
    can = CANON.get(title, [])
    curs = [cur[k] for k in (keys[::-1] if len(keys) > 2 else keys) if cur.get(k)]
    if new and can:
        h1 = 200
        panel(c, M, ny + nh - h1, PW - 2 * M, h1, 'New art' if status == 'have' else 'New art (stand-in)' if status in ('sheet2', 'redo') else 'New art')
        grid(c, new, M, ny + nh - h1, PW - 2 * M, h1)
        h2 = nh - h1 - 22
        panel(c, M, ny, PW - 2 * M, h2, 'Canon set (Sep) - what it should show')
        grid(c, can, M, ny, PW - 2 * M, h2)
    elif new or can:
        title2 = {'ref': 'Reference', 'old': 'Kept for history', 'remove': 'What the game shows'}.get(status, 'New art')
        if new and all(src.startswith('GAME:') for _, src in new):
            title2 = "What the game shows today - no new version yet"
        panel(c, M, ny, PW - 2 * M, nh, title2 if new else 'Canon set (Sep) - no new version yet')
        grid(c, new or can, M, ny, PW - 2 * M, nh)
    elif curs:
        panel(c, M, ny, PW - 2 * M, nh, "Today's art, large - no new version yet")
        grid(c, [('', curs[0])], M, ny, PW - 2 * M, nh)
    else:
        empty(c, M, ny, PW - 2 * M, nh, 'no image anywhere yet')

    # in the game now (small)
    gy, gh = 100, 120
    panel(c, M, gy, 130, gh, 'In the game now')
    if curs:
        draw_img(c, curs[0], M + 10, gy + 8, 110, gh - 16)
    else:
        empty(c, M, gy, 130, gh, 'nothing')
    st = ParagraphStyle('d', fontName='Helvetica', fontSize=9.5, leading=13.2, textColor=INK)
    p = Paragraph(desc, st)
    w, h = p.wrap(PW - 2 * M - 146, 200)
    p.drawOn(c, M + 146, gy + gh - h)
    files = [s.replace('LAWN:', '') for _, s in new + can if not s.startswith('GAME:')]
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


def main(game, out, todo=False):
    s = open(game, encoding='utf-8').read()
    body = re.search(r'entries:\s*\{(.*?)\n\t\}', s, re.DOTALL).group(1)
    ent = {}
    for m in re.finditer(r'"([a-zA-Z0-9_.\-]+)":\s*\{([^}]*)\}', body):
        d = dict((mm.group(1), mm.group(3)) for mm in re.finditer(r'"?(\w+)"?\s*:\s*"([^"]*)"', m.group(2)) if False)
        p = re.search(r'"path"\s*:\s*"([^"]+)"', m.group(2))
        a = re.search(r'"aliasOf"\s*:\s*"([^"]+)"', m.group(2))
        ent[m.group(1)] = (p.group(1) if p else None, a.group(1) if a else None)
    imgs = {m.group(1): base64.b64decode(m.group(2)) for m in re.finditer(
        r'"([a-zA-Z0-9_./\-]+)"\s*:\s*"data:image/\w+;base64,([A-Za-z0-9+/=]+)"', s)}
    cur = {}
    for k, (p, a) in ent.items():
        q = p or (ent.get(a, (None,))[0] if a else None)
        if q in imgs:
            cur[k] = imgs[q]
    GAMEIMG.update(cur)
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
        for _, f in e[3] + CANON.get(e[1], []):
            if not f.startswith('GAME:') and not os.path.exists(f.replace('LAWN:', '')):
                print('WARNING: missing file', f)

    c = canvas.Canvas(out, pagesize=(PW, PH))
    c.setTitle('Aldermarch Art Book')
    c.setAuthor('Aldermarch')
    if todo:
        # handoff for an image AI: only what still needs art, no history or reference pages
        keep = ('sheet2', 'canon', 'missing', 'redo', 'nokey', 'standin')
        CAT[:] = [e for e in CAT if e[4] in keep and e[0] != 'Spare and reference art' and e[1] != 'Water']   # water is deferred
        global MAXPX
        MAXPX = 300
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
    c.drawCentredString(PW / 2, PH / 2 - 96, 'Art To-Do' if todo else 'Art Book')
    c.setFont('Helvetica', 9)
    c.setFillColor(HexColor('#a9b0bd'))
    c.drawCentredString(PW / 2, 60, 'Every asset the game is made from  ·  Oct 12, 2026')
    c.showPage()
    n = 2
    if todo:
        text_page(c, n, 'Rules for every image', [
            '<b>This is the to-do list:</b> %d assets that still need art. Each page shows what '
            'it is, what exists so far, and what the game draws today.' % len(CAT),
            '<b>Style:</b> the reference scenes and the canon set are THE look: colour, light, '
            'materials, scale. The ChatGPT tile sheet shows only the tile FORMAT (raised slab, '
            'angle, size); its grass is too lime and too bright, so do not copy its colours.',
            '<b>Ground tiles</b> (fields, lawn, pasture, forest floor): a raised slab with soil sides '
            'on the dark background. Diamond about 1.55 wide to 1 tall.',
            '<b>Everything that stands up</b> (castles, buildings, mines, trees, people, carts, '
            'animals): on a SOLID flat #00FF00 green background, no ground slab under it. Not '
            '"transparent", solid green.',
            '<b>Weapon, item and resource icons:</b> solid navy #020A1F background.',
            '<b>Never:</b> flags, banners or pennants on buildings; animals or people on tiles. The '
            'game draws those itself.',
            '<b>Size:</b> troop icons must read at 18 pixels, laborers at 28 pixels: simple, bold '
            'silhouettes.',
            '<b>Delivery:</b> each asset as its own separate image file, named after its page title. '
            'Not a collage, not a new PDF. Do not change any page text, tags or names; list '
            'suggestions separately at the end.',
        ], section='Rules')
        n += 1
        last = None
        for e in CAT:
            asset_page(c, n, e, cur)
            n += 1
        c.save()
        print(out, n - 1, 'pages;', len(CAT), 'to do')
        return
    text_page(c, n, 'How to read this', [
        'One page per asset. The <b>big panel</b> is the new art for the Big Bang '
        'pass; the <b>small panel</b> is what the game draws today, pulled straight '
        'from the art embedded in the game file.',
        'The tag in the top corner says where each one stands: '
        '<font color="#3f8f4f"><b>READY</b></font> accepted; '
        '<font color="#b07a1e"><b>STAND-IN</b></font> a placeholder on the mock-ups; '
        '<font color="#2f6fd0"><b>SHEET 2</b></font> comes in the next ChatGPT sheet; '
        '<font color="#7a4fb0"><b>CANON</b></font> the Sep canon version exists (shown), not yet checked at game size; '
        '<font color="#b0413e"><b>NOT MADE</b></font> or <font color="#b0413e"><b>REDO</b></font>; '
        '<font color="#5a6b7a"><b>NEEDS KEY</b></font> art the game will use but has no manifest entry for yet; '
        '<font color="#5a6b7a"><b>REMOVE</b></font>, <font color="#5a6b7a"><b>REFERENCE</b></font>, '
        '<font color="#8a8a8a"><b>SUPERSEDED</b></font> as named.',
        'Where there is no new art yet, the big panel shows the <b>canon set</b> (the Sep 4-5 '
        'Grok diorama pass, now in <font face="Courier">art/_canon/</font>), or failing that '
        "today's in-game art, enlarged. Every page has a picture.",
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
    # add --todo for the slim handoff (only unfinished assets + the rules page)
    main(sys.argv[1], sys.argv[2], '--todo' in sys.argv)
