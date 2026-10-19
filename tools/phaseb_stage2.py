"""Phase B stage 2: troops, icons, banners, flags, army, wagon, props.

Usage: python3 tools/phaseb_stage2.py <game.html>   (edits in place)

Reuses phaseb_inject.main. Standing art is cropped to its bbox (norm_sprite);
icons keep their navy square (Art Bible: icons on #020A1F) and are shrunk to
ICON px; troop icons come from tools/unit_crop.py (art/units/, cropped to the
figure so they read at 28 px).
The `-away` army/wagon files go in now under `.away` keys so stage 4 (facing)
only touches code.
"""
import sys

from PIL import Image

import phaseb_inject as pi

ICON = 192
A = 'art/'
RAW = A + 'review-s2/_raw/'
SEATS = ['crimson', 'azure', 'gold', 'sable']   # seat index order (Art Bible)


def norm_icon(path):
    im = Image.open(path).convert('RGBA')
    k = ICON / max(im.size)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def norm_unit(path):
    im = Image.open(path).convert('RGBA')
    return im.resize((160, round(160 * im.height / im.width)), Image.LANCZOS)


UNITS = {f'unit.{k}': A + f'units/{k}.png' for k in
         ('militia', 'archers', 'crossbowmen', 'swordsmen', 'macemen', 'pikemen', 'knights')}

ICONS = {}
for res, f in (('wheat', 'grain'), ('cows', 'cattle'), ('wood', 'wood'),
               ('ore', 'iron-ore'), ('stone', 'stone'), ('gold', 'gold')):
    ICONS[f'resource.{res}'] = RAW + f + '.png'
    ICONS[f'figma.resource.{res}'] = RAW + f + '.png'
for res, f in (('bows', 'bow'), ('crossbows', 'crossbow'), ('maces', 'mace'), ('pikes', 'pike')):
    ICONS[f'resource.{res}'] = RAW + f + '.png'
ICONS['resource.swords'] = A + 'icons/item_sword.png'
ICONS['resource.armor'] = A + 'icons/item_knight_helm.png'

SPRITES = {
    'unit.mercenaries': A + 'review-s2/mercenary.png',
    'overhead.sprite.wagon': A + 'wagon/wagon-toward.png',
    'overhead.sprite.wagon.away': A + 'wagon/wagon-away.png',
    'overhead.army.soldier': A + 'army/soldier-toward.png',
    'overhead.army.soldier.away': A + 'army/soldier-away.png',
    'overhead.sprite.cow': A + 'props/prop-cow.png',
    'overhead.sprite.ore-cart': A + 'props/prop-minecart.png',
    'overhead.sprite.castle-yard': A + 'review-s2/castle-yard.png',
    'overhead.sprite.forge-open': A + 'review-s2/open-forge.png',
    'overhead.sprite.laborer-farmer': A + 'review-s2/laborer-farmer.png',
    'overhead.sprite.laborer-herder': A + 'review-s2/laborer-herder.png',
    'overhead.wall.run': A + 'wall-sheet/wall-run.png',
    'overhead.wall.post': A + 'wall-sheet/wall-post.png',
}
for i, seat in enumerate(SEATS):
    SPRITES[f'overhead.army.bearer.{i}'] = A + f'army/bearer-{seat}-toward.png'
    SPRITES[f'overhead.army.bearer.{i}.away'] = A + f'army/bearer-{seat}-away.png'
    SPRITES[f'overhead.castle.flag.{i}'] = A + f'flag/flag-{seat}.png'
for c in ('crimson', 'steel', 'gold', 'sable'):
    SPRITES[f'banner.{c}'] = A + f'banner/{c}.png'

REMOVE = ['terrain.chokepoint'] + [f'terrain.chokepoint.{s}' for s in ('spring', 'summer', 'autumn', 'winter')] + [
    'overhead.tile.yard', 'unit.militia.knight', 'unit.knights.knight']
RENAMES = [('banner.verdigris', 'banner.sable')]


SMALL_MAX = 280   # long side for figures/flags/banners: none draws above ~250 device px


def norm_small(path):
    im = pi.norm_sprite(path)
    k = SMALL_MAX / max(im.size)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS) if k < 1 else im


BIG = {'overhead.sprite.castle-yard', 'overhead.sprite.forge-open', 'overhead.wall.run'}


def main(p):
    small = {k: v for k, v in SPRITES.items() if k not in BIG}
    big = {k: v for k, v in SPRITES.items() if k in BIG}
    pi.main(p, tables=((UNITS, norm_unit), (ICONS, norm_icon), (small, norm_small), (big, pi.norm_sprite)),
            remove=REMOVE, renames=RENAMES)
    s = open(p, encoding='utf-8').read()
    old = 'var BEST_NOBLE_BANNERS = ["crimson", "steel", "gold", "verdigris"];'
    assert s.count(old) == 1
    s = s.replace(old, 'var BEST_NOBLE_BANNERS = ["crimson", "steel", "gold", "sable"];')
    open(p, 'w', encoding='utf-8').write(s)


if __name__ == '__main__':
    main(sys.argv[1])
