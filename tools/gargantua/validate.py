#!/usr/bin/env python3
"""Validate gargantua.c against a known result: with no spin (a ~ 0) and no disk, the shadow seen by a static
observer at radius r0 has angular radius asin(3*sqrt(3) * sqrt(1 - 2/r0) / r0). Prints the measured and theoretical
radii and exits non-zero if they differ by more than 1%.
Usage: build gargantua, then  python3 validate.py"""
import math, os, subprocess, sys, tempfile
import numpy as np

here = os.path.dirname(os.path.abspath(__file__))
exe = os.path.join(here, "gargantua")
if not os.path.exists(exe):
    subprocess.check_call(["gcc", "-O3", "-fopenmp", "-o", exe, os.path.join(here, "gargantua.c"), "-lm"])
r0 = 15.0
with tempfile.TemporaryDirectory() as d:
    raw = os.path.join(d, "schw.bin")
    subprocess.check_call([exe, "2048", raw, "0.0001", "90", str(r0), "0.0"], stderr=subprocess.DEVNULL)
    with open(raw, "rb") as f:
        W, H = np.frombuffer(f.read(8), dtype=np.int32)
        f.read(48)
        n = int(W) * int(H)
        f.read(12 * n)
        code = np.frombuffer(f.read(n), dtype=np.uint8).reshape(H, W)
lat = (0.5 - (np.arange(H) + 0.5) / H) * math.pi
wt = np.cos(lat)[:, None] * np.ones((1, W))
solid = (wt * (code == 2)).sum() / wt.sum() * 4 * math.pi
measured = math.acos(1 - solid / (2 * math.pi))
theory = math.asin(3 * math.sqrt(3) * math.sqrt(1 - 2 / r0) / r0)
err = abs(measured - theory) / theory
print(f"shadow angular radius: measured {math.degrees(measured):.3f} deg, theory {math.degrees(theory):.3f} deg, error {100 * err:.3f}%")
sys.exit(0 if err < 0.01 else 1)
