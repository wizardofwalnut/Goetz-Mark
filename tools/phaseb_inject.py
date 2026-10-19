"""Phase B: embed the accepted art into the game file and point manifest keys at it.

Usage: python3 tools/phaseb_inject.py <game.html> [stage ...]   (edits in place)

- Ground tiles (lawn, fields, roads, forest floor, water) are normalised for
  the diamond bake: the diamond spans the full image width (BAKE px) and its
  top vertex sits TOP_PAD x width below the image top, so overhang (wheat) and
  slab sides keep their place. Geometry is measured from alpha the same way
  tools/county_mock.py does (left-most column -> left corner).
- Standing art (buildings, castles, mountains, trees) is cropped to its bbox
  and capped at SPRITE_MAX px wide.
- Everything is stored as WebP (alpha kept) in window.__ALDERMARCH_ART__ under
  a new "bb/..." path, and the manifest entry is rewritten to that path
  (aliasOf / pending dropped). New keys are added before the manifest closes.
"""
import base64
import io
import json
import re
import sys

import numpy as np
from PIL import Image

BAKE = 200          # must match BAKE_TILE_PX in the game
TOP_PAD = .5        # must match TILE_TOP_PAD
SPRITE_MAX = 480
A = 'art/'
TS = A + 'tileset-grok/'
R2 = A + 'review-s2/'
R3 = A + 'review-s3/'

GROUND = {
    'overhead.tile.ground': TS + 'lawngm-00.png',
    'overhead.tile.ground.v00': TS + 'lawngm-00.png',
    'overhead.tile.ground.v01': TS + 'lawngm-01.png',
    'overhead.tile.ground.v10': TS + 'lawngm-10.png',
    'overhead.tile.ground.v11': TS + 'lawngm-11.png',
    'overhead.tile.mountain': TS + 'lawngm-00.png',
    'overhead.tile.forest': R2 + 'forest-floor.png',
    'overhead.tile.water': TS + 'water.png',
    'overhead.field.fallow': R2 + 'fallow.png',
    'overhead.field.barren': TS + 'tilled.png',
    'overhead.field.cattle': R2 + 'pasture.png',
    'overhead.field.parched': R2 + 'parched.png',
    'overhead.field.grain.sown': R2 + 'sown.png',
    'overhead.field.grain.growing': R2 + 'growing-wheat.png',
    'overhead.field.grain.mature': TS + 'wheat-a.png',
}
for i in range(16):
    GROUND[f'overhead.road.{i}'] = A + f'road-sheet/road-{i:02d}.png'

SPRITES = {
    'overhead.sprite.mountain': TS + 'standing/mountain-a.png',
    'overhead.sprite.mountain.a': TS + 'standing/mountain-a.png',
    'overhead.sprite.mountain.b': TS + 'standing/mountain-b.png',
    'overhead.sprite.mountain.c': TS + 'standing/mountain-c.png',
    'overhead.sprite.forest': R2 + 'forest.png',
    'overhead.industry.mine': R3 + 'mine.png',
    'overhead.industry.quarry': R3 + 'quarry.png',
    'overhead.industry.lumberMill': R3 + 'lumber-mill.png',
    'overhead.industry.blacksmith': R3 + 'blacksmith.png',
    'overhead.town': R3 + 'town.png',
    'overhead.castle.woodenPalisade': R3 + 'castle-1-palisade.png',
    'overhead.castle.motteAndBailey': R3 + 'castle-2-motte-bailey.png',
    'overhead.castle.normanKeep': R3 + 'castle-3-norman-keep.png',
    'overhead.castle.stoneCastle': R3 + 'castle-4-stone.png',
    'overhead.castle.royalCastle': R3 + 'castle-5-royal.png',
}


def diamond_geometry(im):
    """(minx, maxx, top-vertex y) of the slab's diamond, measured from alpha."""
    a = np.array(im)[:, :, 3] > 128
    ys, xs = np.nonzero(a)
    minx, maxx = xs.min(), xs.max()
    left = np.nonzero(a[:, min(minx + 2, a.shape[1] - 1)])[0]
    left_corner_y = left.min()
    w = maxx - minx
    # top vertex sits half a diamond-height above the left corner (ratio 1.55)
    return minx, maxx, left_corner_y - (w / 1.55) / 2


def norm_ground(path):
    im = Image.open(path).convert('RGBA')
    minx, maxx, ty = diamond_geometry(im)
    w = maxx - minx
    k = BAKE / w
    big = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    out_h = round(BAKE * TOP_PAD + (big.height - ty * k))
    out = Image.new('RGBA', (BAKE, max(out_h, 1)), (0, 0, 0, 0))
    out.alpha_composite(big, (round(-minx * k), round(BAKE * TOP_PAD - ty * k)))
    return out


def norm_sprite(path):
    im = Image.open(path).convert('RGBA')
    im = im.crop(im.getbbox())
    if im.width > SPRITE_MAX:
        im = im.resize((SPRITE_MAX, round(im.height * SPRITE_MAX / im.width)), Image.LANCZOS)
    return im


def webp(im):
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=90, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def main(p, tables=None, remove=(), renames=()):
    tables = tables or ((GROUND, norm_ground), (SPRITES, norm_sprite))
    s = open(p, encoding='utf-8').read()
    # the inlined art map is one JSON object on one line
    head = '<script>window.__ALDERMARCH_ART__ = '
    a0 = s.index(head) + len(head)
    a1 = s.index('</script>', a0)
    art = json.loads(s[a0:a1].strip().rstrip(';'))
    mani_end = s.index('\n\t}\n};\nvar inlinedArt')
    added, changed = [], []
    for old, new_key in renames:
        n0 = s.count(f'\t\t"{old}": {{')
        assert n0 == 1, (old, n0)
        s = s.replace(f'\t\t"{old}": {{', f'\t\t"{new_key}": {{')
    removed = []
    for key in remove:
        entry = re.compile(r',?\n\t\t"' + re.escape(key) + r'": \{[^}]*\}')
        if entry.search(s):
            s = entry.sub('', s, count=1)
            removed.append(key)
    mani_end = s.index('\n\t}\n};\nvar inlinedArt')
    for table, norm in tables:
        for key, src in table.items():
            path = 'bb/' + key.replace('.', '/') + '.webp'
            art[path] = webp(norm(src))
            entry = re.compile(r'\t\t"' + re.escape(key) + r'": \{[^}]*\}')
            new = f'\t\t"{key}": {{ "path": "{path}" }}'
            if entry.search(s[:mani_end]):
                s = entry.sub(lambda _m: new, s, count=1)
                changed.append(key)
            else:
                mani_end = s.index('\n\t}\n};\nvar inlinedArt')
                s = s[:mani_end] + ',\n' + new + s[mani_end:]
                added.append(key)
            mani_end = s.index('\n\t}\n};\nvar inlinedArt')
    blob = json.dumps(art, separators=(',', ':'))
    a0 = s.index(head) + len(head)
    a1 = s.index('</script>', a0)
    s = s[:a0] + blob + ';' + s[a1:]
    open(p, 'w', encoding='utf-8').write(s)
    print(f'changed {len(changed)} keys, added {len(added)}: {added}; removed {removed}')
    print(f'file now {len(s) / 1e6:.1f} MB')


if __name__ == '__main__':
    main(sys.argv[1])
