"""Lumigrid 3D object renderer.

Ray-marches signed distance functions with numpy and writes transparent WebP
images to assets/img/3d/. No 3D software or stock assets involved.

    python _src/tools/render3d.py            # render all objects
    python _src/tools/render3d.py panel orb  # render a subset

Materials use the Lumigrid palette: brand amber (#F0B030) as polished metal,
brand sky (#1098D8) as glossy lacquer, plus a pearl white and graphite.
"""
import os
import sys
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "img", "3d")
SIZE = 560          # final canvas before crop
SS = 2              # supersampling factor
FINAL = 480         # exported square size


# ---------------------------------------------------------------- vector utils
def norm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)


def dot(a, b):
    return np.sum(a * b, axis=-1)


def rot(rx, ry, rz):
    rx, ry, rz = np.radians([rx, ry, rz])
    X = np.array([[1, 0, 0], [0, np.cos(rx), -np.sin(rx)], [0, np.sin(rx), np.cos(rx)]])
    Y = np.array([[np.cos(ry), 0, np.sin(ry)], [0, 1, 0], [-np.sin(ry), 0, np.cos(ry)]])
    Z = np.array([[np.cos(rz), -np.sin(rz), 0], [np.sin(rz), np.cos(rz), 0], [0, 0, 1]])
    return Z @ Y @ X


# ---------------------------------------------------------------- 2D / 3D SDFs
def sd_round_rect(qx, qy, bx, by, r):
    dx, dy = np.abs(qx) - bx + r, np.abs(qy) - by + r
    out = np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2)
    return out + np.minimum(np.maximum(dx, dy), 0) - r


def sd_round_box(p, b, r):
    q = np.abs(p) - (np.array(b) - r)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(q.max(-1), 0) - r


def sd_round_cyl(p, ra, h, rb):
    dx = np.sqrt(p[..., 0] ** 2 + p[..., 2] ** 2) - ra + rb
    dy = np.abs(p[..., 1]) - h + rb
    return np.minimum(np.maximum(dx, dy), 0) + np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2) - rb


# ---------------------------------------------------------------- objects
# Each object: sdf(p) -> distance, mat(p, n) -> material id per pixel
# Material ids: 0 amber metal, 1 sky lacquer, 2 pearl, 3 graphite, 4 solar cell,
# 5 glowing amber (emissive)
def ring_sdf(p):
    """Sun arc: a rounded band swept round a circle (echoes the logo's sun)."""
    q = np.sqrt(p[..., 0] ** 2 + p[..., 2] ** 2) - 1.0
    return sd_round_rect(q, p[..., 1], 0.17, 0.30, 0.10)


def ring_mat(p, n):
    inner = np.sqrt(p[..., 0] ** 2 + p[..., 2] ** 2) < 0.86
    return np.where(inner, 1, 0)


def orb_sdf(p):
    return np.linalg.norm(p, axis=-1) - 1.0


def orb_mat(p, n):
    """Glossy sky body with amber inlaid grid lines (a 'grid' globe)."""
    lat = np.degrees(np.arcsin(np.clip(p[..., 1], -1, 1)))
    lon = np.degrees(np.arctan2(p[..., 2], p[..., 0]))
    on_lat = np.abs(((lat + 90) % 25.7) - 12.85) > 11.9
    on_lon = (np.abs((lon % 30) - 15) > 14.1) & (np.abs(lat) < 72)
    return np.where(on_lat | on_lon, 0, 1)


def battery_sdf(p):
    body = sd_round_cyl(p, 0.62, 1.05, 0.16)
    cap = sd_round_cyl(p - np.array([0, 1.12, 0]), 0.26, 0.12, 0.05)
    return np.minimum(body, cap)


def battery_mat(p, n):
    y = p[..., 1]
    m = np.full(y.shape, 2)                       # pearl body
    m = np.where(y > 0.62, 1, m)                  # sky top section
    m = np.where((y > 0.50) & (y <= 0.62), 0, m)  # amber band
    m = np.where(y > 1.0, 0, m)                   # amber terminal
    # three charge bars on the front face
    front = (p[..., 2] > 0.3) & (np.abs(p[..., 0]) < 0.16)
    for c in (-0.55, -0.15, 0.25):
        m = np.where(front & (np.abs(y - c) < 0.13), 5, m)
    return m


def panel_sdf(p):
    plate = sd_round_box(p, (1.25, 0.05, 0.85), 0.04)
    post = sd_round_cyl(p - np.array([0, -0.55, 0]), 0.07, 0.5, 0.03)
    return np.minimum(plate, post)


def panel_mat(p, n):
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    face = (y > 0.035) & (np.abs(x) < 1.17) & (np.abs(z) < 0.77)
    gx = np.abs(((x + 1.17) % (2.34 / 8)) - 2.34 / 16) > 2.34 / 16 - 0.012
    gz = np.abs(((z + 0.77) % (1.54 / 5)) - 1.54 / 10) > 1.54 / 10 - 0.012
    cell = face & ~(gx | gz)
    return np.where(cell, 4, np.where(face, 2, np.where(y < -0.06, 3, 0)))


def ribbon_sdf(p):
    """Strip swept round a circle with one half twist — an endless energy loop."""
    a = np.arctan2(p[..., 2], p[..., 0])
    qx = np.sqrt(p[..., 0] ** 2 + p[..., 2] ** 2) - 1.0
    qy = p[..., 1]
    c, s = np.cos(a / 2), np.sin(a / 2)
    rx, ry = c * qx - s * qy, s * qx + c * qy
    return sd_round_rect(rx, ry, 0.36, 0.05, 0.04) * 0.55


def ribbon_mat(p, n):
    a = np.arctan2(p[..., 2], p[..., 0])
    qx = np.sqrt(p[..., 0] ** 2 + p[..., 2] ** 2) - 1.0
    qy = p[..., 1]
    c, s = np.cos(a / 2), np.sin(a / 2)
    side = s * qx + c * qy  # sign tells which face
    return np.where(side > 0, 0, 1)


def hex_sdf(p):
    """Hexagonal prism tile — a cell of the grid."""
    k = np.array([-0.8660254, 0.5, 0.57735])
    q = np.abs(p)
    xy = q[..., [0, 2]]
    d = np.minimum(dot(xy, k[:2]), 0)
    xy = xy - 2 * d[..., None] * k[:2]
    hx = 0.9
    lx = np.clip(xy[..., 0], -k[2] * hx, k[2] * hx)
    dx = np.linalg.norm(xy - np.stack([lx, np.full_like(lx, hx)], -1), axis=-1) * np.sign(xy[..., 1] - hx)
    dy = q[..., 1] - 0.28
    r = 0.08
    dx, dy = dx + r, dy + r
    return np.minimum(np.maximum(dx, dy), 0) + np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2) - r


def hex_mat(p, n):
    return np.where(p[..., 1] > 0.2, 1, 0)


OBJECTS = {
    #  name     sdf          material     pose (x, y, z)   scale
    "ring":    (ring_sdf,    ring_mat,    (58, 18, -22),   1.00),
    "orb":     (orb_sdf,     orb_mat,     (20, -30, -12),  0.95),
    "battery": (battery_sdf, battery_mat, (12, -28, -8),   0.80),
    "panel":   (panel_sdf,   panel_mat,   (48, -26, -8),   0.85),
    "ribbon":  (ribbon_sdf,  ribbon_mat,  (62, 18, -30),   1.05),
    "hex":     (hex_sdf,     hex_mat,     (48, 22, -6),    1.00),
}


# ---------------------------------------------------------------- environment
LIGHTS = [  # direction, sharpness, strength, colour
    ((-0.55, 0.75, 0.65), 22, 4.2, (1.00, 0.98, 0.95)),   # key, warm white
    ((0.85, 0.25, -0.45), 10, 1.6, (0.75, 0.88, 1.00)),   # rim, cool blue
    ((0.0, 1.0, 0.1),      6, 0.6, (1.00, 1.00, 1.00)),   # top
    ((0.6, -0.4, 0.7),     9, 0.5, (1.00, 0.80, 0.55)),   # fill, warm amber
]


def env(d):
    y = d[..., 1:2]
    sky = np.array([0.95, 0.97, 1.0])
    hor = np.array([0.30, 0.34, 0.42])
    flo = np.array([0.16, 0.11, 0.04])
    t = np.clip(y * 2.2, 0, 1)
    col = np.where(y > 0, hor + (sky - hor) * t, hor + (flo - hor) * np.clip(-y * 3, 0, 1))
    col = col * (0.75 + 0.25 * np.clip(d[..., 2:3] + 0.4, 0, 1)) * (0.85 + 0.15 * np.clip(d[..., 0:1] + 0.5, 0, 1))
    col = col + 1.6 * np.exp(-((y - 0.18) / 0.06) ** 2)            # horizontal softbox
    col = col + 1.1 * np.exp(-((d[..., 0:1] - 0.75) / 0.08) ** 2) * (y > -0.2)  # vertical strip
    for ldir, sharp, strength, lc in LIGHTS:
        l = norm(np.array(ldir, float))
        col = col + strength * 0.25 * np.maximum(dot(d, l), 0)[..., None] ** (sharp * 4) * np.array(lc)
    return col


def fresnel(f0, cosv):
    return f0 + (1 - f0) * (1 - cosv) ** 5


def shade(p, n, v, mat, sdf):
    nv = np.clip(dot(n, v), 0, 1)[..., None]
    r = norm(2 * dot(n, v)[..., None] * n - v)
    refl = env(r)
    key = norm(np.array(LIGHTS[0][0], float))
    nl = np.clip(dot(n, key), 0, 1)[..., None]
    h = norm(key + v)
    nh = np.clip(dot(n, h), 0, 1)[..., None]

    # ambient occlusion: 5 samples along the normal
    ao = np.zeros(nv.shape)
    for i in range(1, 6):
        dd = 0.06 * i
        ao += (dd - sdf(p + n * dd))[..., None] * (0.5 ** i)
    ao = np.clip(1 - ao * 2.4, 0.35, 1)

    out = np.zeros(p.shape)

    # 0 amber metal
    f0 = np.array([1.00, 0.72, 0.26])
    gold = refl * fresnel(f0, nv) * 0.95 + f0 * 0.12 * nl + 2.2 * nh ** 120 * np.array([1, 0.95, 0.85])
    gold *= np.array([1.05, 0.95, 0.80])

    # 1 sky lacquer (brand #1098D8)
    base = np.array([0.02, 0.36, 0.78])
    sky = base * (0.30 + 0.9 * nl) + refl * fresnel(0.04, nv) * 0.75 + 1.4 * nh ** 90
    sky += np.array([0.15, 0.55, 0.95]) * (1 - nv) ** 3 * 0.35

    # 2 pearl white
    pb = np.array([0.86, 0.88, 0.91])
    pearl = pb * (0.45 + 0.6 * nl) + refl * fresnel(0.05, nv) * 0.6 + 1.6 * nh ** 160 + 0.14 * nh ** 10

    # 3 graphite
    gb = np.array([0.05, 0.055, 0.065])
    graph = gb * (0.4 + 0.8 * nl) + refl * fresnel(0.05, nv) * 0.7 + 1.2 * nh ** 80

    # 4 solar cell: deep blue with tight sparkle
    cb = np.array([0.01, 0.05, 0.20])
    cell = cb * (0.5 + 0.8 * nl) + refl * fresnel(0.06, nv) * 0.85 * np.array([0.6, 0.75, 1.0]) + 1.8 * nh ** 200

    m = mat[..., None]
    out = np.where(m == 0, gold, out)
    out = np.where(m == 1, sky, out)
    out = np.where(m == 2, pearl, out)
    out = np.where(m == 3, graph, out)
    out = np.where(m == 4, cell, out)
    out = out * ao
    glow = np.array([2.2, 1.25, 0.25]) * (0.8 + 0.4 * nv) + 0.6 * nh ** 60
    return np.where(m == 5, glow, out)


# ---------------------------------------------------------------- render
def render(name):
    sdf0, mat0, pose, scale = OBJECTS[name]
    R = rot(*pose)
    Rt = R.T

    def sdf(p):  # object space: rotate world point into object frame
        return sdf0((p @ R) / scale) * scale

    n_px = SIZE * SS
    ys, xs = np.mgrid[0:n_px, 0:n_px]
    u = (xs + 0.5) / n_px * 2 - 1
    w = -((ys + 0.5) / n_px * 2 - 1)
    ro = np.array([0, 0, 5.0])
    rd = norm(np.stack([u * 0.33 * 1.6, w * 0.33 * 1.6, -np.ones_like(u)], -1)).reshape(-1, 3)

    t = np.full(rd.shape[0], 2.5)
    hit = np.zeros(rd.shape[0], bool)
    alive = np.ones(rd.shape[0], bool)
    step = 0.9 if name == "ribbon" else 1.0
    for _ in range(260):
        idx = np.nonzero(alive)[0]
        if idx.size == 0:
            break
        p = ro + rd[idx] * t[idx, None]
        d = sdf(p)
        h = d < 0.0008
        hit[idx[h]] = True
        t[idx] += d * step
        alive[idx[h | (t[idx] > 7.5)]] = False

    img = np.zeros((rd.shape[0], 4))
    idx = np.nonzero(hit)[0]
    p = ro + rd[idx] * t[idx, None]
    e = 0.0015
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], float)
    n = norm(sum(k[i] * sdf(p + k[i] * e)[:, None] for i in range(4)))
    pl = (p @ R) / scale              # object-space point for material lookup
    mat = mat0(pl, n @ R)
    col = shade(p, n, -rd[idx], mat, sdf)
    col = 1 - np.exp(-1.75 * col)    # tone map
    img[idx, :3] = col
    img[idx, 3] = 1

    img = img.reshape(n_px, n_px, 4)
    # premultiplied 2x2 downsample
    pre = img[..., :3] * img[..., 3:4]
    pre = pre.reshape(SIZE, SS, SIZE, SS, 3).mean((1, 3))
    a = img[..., 3].reshape(SIZE, SS, SIZE, SS).mean((1, 3))
    rgb = np.where(a[..., None] > 0, pre / np.maximum(a[..., None], 1e-6), 0)
    arr = np.dstack([np.clip(rgb, 0, 1) * 255, a * 255]).astype(np.uint8)
    im = Image.fromarray(arr, "RGBA")

    bbox = im.getbbox()
    im = im.crop(bbox)
    side = max(im.size) + 32
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    sq = sq.resize((FINAL, FINAL), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"obj-{name}.webp")
    sq.save(path, "WEBP", quality=90, method=6)
    print("wrote", os.path.normpath(path))


if __name__ == "__main__":
    for nm in sys.argv[1:] or OBJECTS:
        render(nm)
