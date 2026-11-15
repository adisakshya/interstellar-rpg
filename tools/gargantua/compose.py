#!/usr/bin/env python3
"""Compose the Gargantua sky: lens a procedural star field with the escape directions from gargantua.c, add the disk,
apply a little bloom and a filmic tone curve, and write PNG/WebP. Usage: compose.py raw.bin out_prefix [exposure]"""
import sys
import numpy as np
from PIL import Image

def read(path):
    with open(path, "rb") as f:
        W, H = np.frombuffer(f.read(8), dtype=np.int32)
        meta = np.frombuffer(f.read(48), dtype=np.float64)
        n = int(W) * int(H)
        rgb = np.frombuffer(f.read(12 * n), dtype=np.float32).reshape(H, W, 3)
        code = np.frombuffer(f.read(n), dtype=np.uint8).reshape(H, W)
        th = np.frombuffer(f.read(4 * n), dtype=np.float32).reshape(H, W)
        ph = np.frombuffer(f.read(4 * n), dtype=np.float32).reshape(H, W)
    return int(W), int(H), meta, rgb, code, th, ph

def star_map(w=4096, h=2048, seed=7):
    rng = np.random.default_rng(seed)
    img = np.zeros((h, w), np.float32)
    n = 26000
    lon = rng.uniform(-np.pi, np.pi, n)
    z = rng.uniform(-1, 1, n)
    lat = np.arcsin(z)
    mag = rng.uniform(0, 1, n) ** 9.0 * 0.8            # many faint, few bright
    x = ((lon / (2 * np.pi)) + 0.5) * w
    y = (0.5 - lat / np.pi) * h
    for xi, yi, m, la in zip(x, y, mag, lat):
        sx = 0.75 / max(np.cos(la), 0.3)
        r = int(max(2, 3 * sx))
        x0, y0 = int(xi), int(yi)
        for dy in range(-2, 3):
            for dx in range(-r, r + 1):
                px, py = (x0 + dx) % w, y0 + dy
                if 0 <= py < h:
                    img[py, px] += m * np.exp(-((dx + 0.5 - (xi - x0)) ** 2 / (2 * sx ** 2) + (dy + 0.5 - (yi - y0)) ** 2 / 1.6))
    # faint milky band
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    band = np.exp(-(((yy / h - 0.5 - 0.18 * np.sin(xx / w * 2 * np.pi * 1.0)) / 0.09) ** 2)) * 0.006
    noise = rng.standard_normal((h // 32, w // 32)).astype(np.float32)
    noise = np.array(Image.fromarray(noise).resize((w, h), Image.BICUBIC))
    img += band * (0.6 + 0.4 * np.clip(noise, -1, 1))
    return img

def sample(img, th, ph):
    h, w = img.shape
    x = ((ph / (2 * np.pi)) % 1.0) * w - 0.5
    y = (th / np.pi) * h - 0.5
    x0 = np.floor(x).astype(int); y0 = np.clip(np.floor(y).astype(int), 0, h - 2)
    fx, fy = x - x0, np.clip(y - y0, 0, 1)
    x0 %= w; x1 = (x0 + 1) % w
    return (img[y0, x0] * (1 - fx) + img[y0, x1] * fx) * (1 - fy) + (img[y0 + 1, x0] * (1 - fx) + img[y0 + 1, x1] * fx) * fy

def blur(a, s):
    from numpy.fft import rfft2, irfft2
    h, w = a.shape[:2]
    fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.rfftfreq(w)[None, :]
    k = np.exp(-2 * (np.pi * s) ** 2 * (fx ** 2 + fy ** 2))
    return np.stack([irfft2(rfft2(a[..., c]) * k, s=a.shape[:2]) for c in range(a.shape[2])], -1)

def aces(x):
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return np.clip((x * (a * x + b)) / (x * (c * x + d) + e), 0, 1)

def srgb(x):
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.maximum(x, 0), 1 / 2.4) - 0.055)

def main():
    raw, prefix = sys.argv[1], sys.argv[2]
    exposure = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    W, H, meta, rgb, code, th, ph = read(raw)
    stars = star_map()
    s = sample(stars, th, ph)
    sky = np.where((code == 0)[..., None], s[..., None] * np.array([1.0, 0.96, 0.9], np.float32), 0)
    lin = sky * 3.0 + np.where((code == 1)[..., None], rgb, 0)
    glow = blur(np.where((code == 1)[..., None], rgb, 0), max(2, W / 260)) * 0.35 + blur(np.where((code == 1)[..., None], rgb, 0), max(6, W / 70)) * 0.25
    lin = (lin + glow) * exposure
    lin = lin / (1 + 0.35 * lin)   # soft knee: keeps the Doppler-bright side from clipping to flat white
    outs = []
    for target in (2048, 1024):
        k = W // target
        small = lin.reshape(H // k, k, W // k, k, 3).mean(axis=(1, 3)) if k > 1 else lin
        out = (srgb(aces(small)) * 255 + 0.5).astype(np.uint8)
        img = Image.fromarray(out)
        img.save(f"{prefix}_{target}.png")
        img.save(f"{prefix}_{target}.webp", quality=88, method=6)
        import os
        print("wrote", f"{prefix}_{target}", out.shape, "webp %d KB" % (os.path.getsize(f"{prefix}_{target}.webp") // 1024))
    print("meta a=%.4f r_h=%.4f r_isco=%.4f cam_r=%.1f theta=%.1f out=%.1f" % tuple(meta))

main()
