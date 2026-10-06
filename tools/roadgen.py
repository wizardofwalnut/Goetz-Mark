"""Aldermarch road autotile generator (v2).
Builds all 16 road masks (N=1 E=2 S=4 W=8, matching roadMasks in the game)
from ONE dirt texture, as transparent overlays for the 'roads' bake layer.
Usage: python3 roadgen.py <dirt_texture.png> <out_dir> [scale]
- The texture is cropped to exactly one tile and made seamless at that size,
  so every tile uses the same surface and neighbours join invisibly.
- Edge shading and roughness are computed on a padded canvas where the arms
  run past the tile border, so there is no seam line where a road leaves a tile.
"""
import sys
from PIL import Image, ImageFilter, ImageChops, ImageDraw
TILE_W, TILE_H = 58, 42
ROAD_FRAC = 0.34
def seamless(img):
    """Wrap-blend: cross-fade the image with a half-offset copy using a mask that is 0 at the edges."""
    W, H = img.size
    shifted = ImageChops.offset(img, W//2, H//2)
    m = Image.new('L', (W, H)); p = m.load()
    for y in range(H):
        for x in range(W):
            dx = min(x, W-1-x)/(W/2); dy = min(y, H-1-y)/(H/2)
            p[x, y] = int(255*min(1, min(dx, dy)*2.2))
    return Image.composite(img, shifted, m)
def build(tex_path, out, S=4):
    W, H = TILE_W*S, TILE_H*S
    tex = Image.open(tex_path).convert('RGB')
    side = min(tex.size); tex = tex.crop((0, 0, side, side))
    # one tile shows ~1/3 of the source so detail stays fine, then made seamless at tile size
    tile_tex = tex.resize((W*3, W*3), Image.LANCZOS).crop((W, W, 2*W, W+H))
    tile_tex = seamless(tile_tex)
    rw = round(W*ROAD_FRAC); rh = round(rw*TILE_H/TILE_W)
    P = S*8                                   # padding so arms run past the border
    PW, PH = W+2*P, H+2*P; cx, cy = PW//2, PH//2
    # tileable noise for the ragged edge (same noise at every border so it lines up)
    noise = seamless(Image.effect_noise((W, H), 90).filter(ImageFilter.GaussianBlur(S*0.9)).convert('RGB')).convert('L')
    noise_p = Image.new('L', (PW, PH))
    for ox in range(-1, 2):
        for oy in range(-1, 2): noise_p.paste(noise, (P+ox*W, P+oy*H))
    for mask in range(16):
        m = Image.new('L', (PW, PH), 0); d = ImageDraw.Draw(m)
        CORNERS = {3: (1, -1), 6: (1, 1), 12: (-1, 1), 9: (-1, -1)}   # N+E, E+S, S+W, W+N -> corner direction
        if mask == 0:
            d.ellipse((cx-rw*0.75, cy-rh*0.75, cx+rw*0.75, cy+rh*0.75), fill=255)
        elif mask in CORNERS:
            # a smooth curve: a band along an ellipse centred on the tile corner the two arms share
            sx, sy = CORNERS[mask]
            ex, ey = cx + sx*W//2, cy + sy*H//2          # tile corner (in padded coords)
            rx, ry = W//2, H//2                          # reaches the two edge midpoints
            d.ellipse((ex-rx-rw//2, ey-ry-rh//2, ex+rx+rw//2, ey+ry+rh//2), fill=255)
            d.ellipse((ex-rx+rw//2, ey-ry+rh//2, ex+rx-rw//2, ey+ry-rh//2), fill=0)
            # keep only the quarter inside this tile, then extend the two arms past the border
            clip = Image.new('L', (PW, PH), 0); ImageDraw.Draw(clip).rectangle((P, P, P+W-1, P+H-1), fill=255)
            m = ImageChops.multiply(m, clip); d = ImageDraw.Draw(m)
            if mask & 1: d.rectangle((cx-rw//2, 0, cx+rw//2, P), fill=255)
            if mask & 4: d.rectangle((cx-rw//2, P+H, cx+rw//2, PH), fill=255)
            if mask & 2: d.rectangle((P+W, cy-rh//2, PW, cy+rh//2), fill=255)
            if mask & 8: d.rectangle((0, cy-rh//2, P, cy+rh//2), fill=255)
        else:
            d.ellipse((cx-rw//2, cy-rh//2, cx+rw//2, cy+rh//2), fill=255)
            if mask & 1: d.rectangle((cx-rw//2, 0, cx+rw//2, cy), fill=255)
            if mask & 4: d.rectangle((cx-rw//2, cy, cx+rw//2, PH), fill=255)
            if mask & 2: d.rectangle((cx, cy-rh//2, PW, cy+rh//2), fill=255)
            if mask & 8: d.rectangle((0, cy-rh//2, cx, cy+rh//2), fill=255)
        soft = m.filter(ImageFilter.GaussianBlur(S*1.3))
        rough = ImageChops.add(soft, noise_p.point(lambda v: int((v-128)*1.8)), 1, 0)
        alpha = rough.point(lambda v: 0 if v < 95 else 255 if v > 150 else int((v-95)*255/55))
        rim = alpha.filter(ImageFilter.GaussianBlur(S*1.0))
        # rim strength: strongest just inside the edge (alpha high, blurred alpha lower)
        rim = ImageChops.subtract(alpha, rim).point(lambda v: min(200, v*5))
        alpha = alpha.crop((P, P, P+W, P+H)); rim = rim.crop((P, P, P+W, P+H))
        dark = Image.new("RGB", (W, H), (58, 32, 18))
        body = Image.composite(dark, tile_tex, rim)
        tile = body.convert('RGBA'); tile.putalpha(alpha)
        tile.save(f'{out}/road-{mask:02d}.png')
    tile_tex.save(f'{out}/_surface.png')
    return W, H
if __name__ == '__main__':
    print(build(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 4))
