"""Lift a building off its tile-sheet slab so it stands directly on the lawn.

Usage: python3 tools/unslab.py <tile.png> <out.png> [skirt_px]

The ChatGPT sheet draws every tile as a raised slab (grass top, soil/stone
sides). Fields should keep that look; buildings should not — on the map they
looked like they sat on a platform above the ground (Oct 11).

1. Find the slab's top-face diamond from its silhouette (left/right corners,
   bottom vertex minus the side depth) and delete everything below its two
   lower edges: the soil and stone sides.
2. Find the building: pixels that are not grass-green. Keep the grass only
   within `skirt_px` of the building (feathered), so a little ground stays
   under it and blends into the lawn instead of a hard square.
"""
import sys

import cv2
import numpy as np


def unslab(src, dst, skirt=10):
    im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
    a = im[..., 3].astype(np.float32) / 255
    solid = a > 0.5
    ys, xs = np.nonzero(solid)
    minx, maxx = xs.min(), xs.max()
    L = np.nonzero(solid[:, minx + 2])[0]
    R = np.nonzero(solid[:, maxx - 2])[0]
    cx = (minx + maxx) // 2
    Cc = np.nonzero(solid[:, cx])[0]
    depth = ((L.max() - L.min()) + (R.max() - R.min())) / 2
    left = (minx, L.min())
    right = (maxx, R.min())
    bottom = (cx, Cc.max() - depth)
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w]

    # below the line left->bottom or bottom->right = slab side
    def below(p, q):
        return (yy - p[1]) * (q[0] - p[0]) - (xx - p[0]) * (q[1] - p[1]) > 0
    side = (below(left, bottom) & (xx <= cx)) | (below(bottom, right) & (xx >= cx))
    side &= yy > min(left[1], right[1])
    a[side] = 0

    hsv = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2HSV)
    grass = (hsv[..., 0] > 25) & (hsv[..., 0] < 50) & (hsv[..., 1] > 90) & (hsv[..., 2] > 70)
    building = (a > 0.5) & ~grass
    building = cv2.morphologyEx(building.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    dist = cv2.distanceTransform((1 - building).astype(np.uint8), cv2.DIST_L2, 5)
    keep = np.clip((skirt - dist) / (skirt * 0.6), 0, 1)       # 1 near the building, 0 beyond the skirt
    a = np.where(grass, a * keep, a)
    out = im.copy()
    out[..., 3] = (a * 255).astype(np.uint8)
    cv2.imwrite(dst, out)


if __name__ == '__main__':
    unslab(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 10)
