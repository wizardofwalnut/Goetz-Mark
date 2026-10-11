"""Check transparent PNGs for holes punched into the object by background removal.

Usage: python3 tools/check_cutout.py <file.png> [more.png ...]

Found Oct 11: a Grok batch came back with dark parts of the objects keyed
out together with the dark background (the cow's black spots, the mine cart,
the mine's rock shadows, barrel hoops, wall mortar). The RGB under those
holes was wiped to black, so they can't be repaired, only re-generated.

Method: close the alpha silhouette (dilate then erode 15 px) to get the
object's filled outline, then count pixels inside it that are transparent.
Real gaps (between stacked logs, cart spokes, loose rubble) score low;
keyed-out dark regions score high. It is a SCREEN, not a verdict: on the
Oct 11 pack, broken files scored 4.6-23% and good ones 0.3-6.7% (wagon
spokes ~5%, loose rubble 6.7%). Anything over 4% is flagged; look at
flagged files composited on a bright colour (magenta) before deciding.
"""
import sys

from PIL import Image, ImageFilter

LIMIT = 4.0


def hole_percent(path):
    im = Image.open(path)
    if im.mode != 'RGBA':
        return None
    a = im.split()[3]
    solid = a.point(lambda v: 255 if v > 128 else 0)
    sil = solid.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MinFilter(15))
    s, al = sil.tobytes(), a.tobytes()
    inside = sum(1 for v in s if v == 255)
    holes = sum(1 for sv, av in zip(s, al) if sv == 255 and av < 128)
    return 100 * holes / max(inside, 1)


def main(paths):
    bad = 0
    for p in paths:
        h = hole_percent(p)
        if h is None:
            print(f'  --    {p}  (no alpha channel — not a cut-out)')
            continue
        flag = 'HOLES' if h > LIMIT else 'ok'
        bad += flag == 'HOLES'
        print(f'  {flag:5s} {h:5.1f}%  {p}')
    print(f'{bad} file(s) over {LIMIT}%')


if __name__ == '__main__':
    main(sys.argv[1:])
