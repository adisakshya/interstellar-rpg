# Gargantua sky (GARG-001)

An offline ray tracer for a spinning (Kerr) black hole with a thin, opaque accretion disk. It makes the equirectangular
sky images in `public/sky/` that the scenes use (D-16). It is not part of the game build and is not run in CI; the baked
images are committed.

## Method

`gargantua.c` integrates null geodesics in Boyer-Lindquist coordinates in Mino time with the Carter constants, in the
second-order form for `r` and `u = cos(theta)` (so there are no turning-point sign flips), with RK4. The camera is a
locally non-rotating observer; each pixel is one photon direction, so the output is a full-sphere equirectangular
image. This follows James et al. 2015 (Class. Quantum Grav. 32, 065001), without their ray bundles or filtering.
`compose.py` lenses a procedural star field with the escape directions, adds the disk, a little glare and a filmic
tone curve, and downsamples (a 2x2 box at the 8192-wide render) to 4096 (`high`) and 2048 (`low`).

## What is physical and what is artistic

| Physical (from the code) | Artistic (chosen, and labelled so) |
| --- | --- |
| Light bending, the shadow, the lensed disk images above and below the shadow, the lensed star field | Spin `a = 0.998` (Thorne's accretion limit) instead of the speculative `1 - 1.33e-14` of D-12: the shadow converges as `a -> 1`, and BL coordinates are numerically stiff at the film's value. The time-dilation rates still come from the exact fixture |
| Doppler beaming and gravitational redshift of the disk (`g^4`, Keplerian orbits, ISCO inner edge) | Disk colour temperature scale (`T_MAX` 4600 K), the brightness fall-off exponent, the outer radius (10 M), the turbulence texture |
| Camera: ZAMO observer at `r = 30 M`, `theta = 82 deg` | The star field (random, with a faint band) and the glare |

## Validation

`python3 validate.py` renders a non-spinning hole with no disk and compares the shadow's angular radius with
Schwarzschild theory, `asin(3*sqrt(3) * sqrt(1 - 2/r0) / r0)`. Result at `r0 = 15 M`: measured 18.804 deg, theory
18.814 deg, error 0.053 %. The null condition at the camera holds to about `1e-10` for every ray.

## Reproduce

```
gcc -O3 -march=native -fopenmp -o gargantua gargantua.c -lm
./gargantua 8192 raw.bin 0.998 82 30 10      # width, output, spin, camera colatitude (deg), camera r, disk outer r
python3 compose.py raw.bin sky 1.1           # exposure; writes sky_4096.webp/png and sky_2048.webp/png
```

Needs gcc with OpenMP, Python 3 with numpy and Pillow. The 8192x4096 render took about 80 s on 4 cores. Copy the
WebP files to `public/sky/` as `gargantua-high.webp` and `gargantua-low.webp`.

Sizes: `high` 601 KB (budget 3 MB), `low` 301 KB (budget 1 MB).
