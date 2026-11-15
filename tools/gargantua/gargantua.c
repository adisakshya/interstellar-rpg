/*
 * Gargantua: an offline ray tracer for a spinning (Kerr) black hole with a thin, opaque accretion disk.
 *
 * Method: null geodesics in Boyer-Lindquist coordinates, integrated in Mino time with the Carter constants
 * (second-order form in r and u = cos(theta), so there are no turning-point sign flips), RK4. The camera is a ZAMO
 * (locally non-rotating) observer; each pixel of an equirectangular sky image is one photon direction. This follows
 * the approach of James et al. 2015 (Class. Quantum Grav. 32, 065001), without their ray bundles or filtering.
 *
 * Output: a binary file with, per pixel, the disk colour, a code (0 = escaped to the sky, 1 = hit the disk,
 * 2 = captured by the horizon) and the asymptotic direction (theta, phi) of an escaped ray, so a star field can be
 * lensed in a second pass (compose.py).
 *
 * Units: G = c = M = 1. Build: gcc -O3 -march=native -fopenmp -o gargantua gargantua.c -lm
 */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct { double r, pr, u, pu, phi; } State;

static double A_SPIN = 0.998;     /* a/M */
static double R_OUT = 10.0;       /* outer edge of the disk */
static double CAM_R = 15.0;       /* camera radius */
static double CAM_THETA_DEG = 82; /* camera colatitude */

static double isco(double a) {
  double z1 = 1 + cbrt(1 - a * a) * (cbrt(1 + a) + cbrt(1 - a));
  double z2 = sqrt(3 * a * a + z1 * z1);
  return 3 + z2 - sqrt((3 - z1) * (3 + z1 + 2 * z2));
}

typedef struct { double L, Q; } Consts;

static void deriv(const State *s, const Consts *c, double a, State *d, double *dphi_out) {
  double r = s->r, u = s->u, a2 = a * a, L = c->L, Q = c->Q;
  double Delta = r * r - 2 * r + a2;
  double P = r * r + a2 - a * L;
  double Rp = 4 * r * P - (2 * r - 2) * (Q + (L - a) * (L - a));
  double Up = -2 * u * (Q + a2 * u * u) + (1 - u * u) * 2 * a2 * u - 2 * L * L * u;
  double om = 1 - u * u;
  if (om < 1e-12) om = 1e-12;
  d->r = s->pr;
  d->pr = 0.5 * Rp;
  d->u = s->pu;
  d->pu = 0.5 * Up;
  d->phi = -a + L / om + a * P / Delta;
  (void)dphi_out;
}

static void rk4(State *s, const Consts *c, double a, double h) {
  State k1, k2, k3, k4, t;
  deriv(s, c, a, &k1, NULL);
#define ADD(dst, src, k, f) { (dst).r = (src).r + (f) * (k).r; (dst).pr = (src).pr + (f) * (k).pr; (dst).u = (src).u + (f) * (k).u; (dst).pu = (src).pu + (f) * (k).pu; (dst).phi = (src).phi + (f) * (k).phi; }
  ADD(t, *s, k1, h / 2) deriv(&t, c, a, &k2, NULL);
  ADD(t, *s, k2, h / 2) deriv(&t, c, a, &k3, NULL);
  ADD(t, *s, k3, h) deriv(&t, c, a, &k4, NULL);
  s->r += h / 6 * (k1.r + 2 * k2.r + 2 * k3.r + k4.r);
  s->pr += h / 6 * (k1.pr + 2 * k2.pr + 2 * k3.pr + k4.pr);
  s->u += h / 6 * (k1.u + 2 * k2.u + 2 * k3.u + k4.u);
  s->pu += h / 6 * (k1.pu + 2 * k2.pu + 2 * k3.pu + k4.pu);
  s->phi += h / 6 * (k1.phi + 2 * k2.phi + 2 * k3.phi + k4.phi);
}

/* Smooth hash noise in (x, y), x periodic with period 'per'. */
static double hash2(int i, int j) {
  uint32_t h = (uint32_t)i * 374761393u + (uint32_t)j * 668265263u;
  h = (h ^ (h >> 13)) * 1274126177u;
  return ((h ^ (h >> 16)) & 0xffffff) / (double)0xffffff;
}
static double vnoise(double x, double y, int per) {
  int xi = (int)floor(x), yi = (int)floor(y);
  double fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  int x0 = ((xi % per) + per) % per, x1 = (x0 + 1) % per;
  double a = hash2(x0, yi), b = hash2(x1, yi), c = hash2(x0, yi + 1), d = hash2(x1, yi + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/* Blackbody colour (linear sRGB, normalised to luminance 1) for temperature T in kelvin (Planckian locus fit). */
static void bb_rgb(double T, double *rgb) {
  double t = T / 100.0, r, g, b;
  if (t < 66) { r = 255; g = 99.4708025861 * log(t) - 161.1195681661; }
  else { r = 329.698727446 * pow(t - 60, -0.1332047592); g = 288.1221695283 * pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * log(t - 10) - 305.0447927307;
  r = fmin(255, fmax(0, r)) / 255; g = fmin(255, fmax(0, g)) / 255; b = fmin(255, fmax(0, b)) / 255;
  /* to linear */
  double lr = pow(r, 2.2), lg = pow(g, 2.2), lb = pow(b, 2.2);
  double Y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  if (Y < 1e-6) Y = 1e-6;
  rgb[0] = lr / Y; rgb[1] = lg / Y; rgb[2] = lb / Y;
}

int main(int argc, char **argv) {
  int W = argc > 1 ? atoi(argv[1]) : 512, H = W / 2;
  const char *out = argc > 2 ? argv[2] : "gargantua.bin";
  if (argc > 3) A_SPIN = atof(argv[3]);
  if (argc > 4) CAM_THETA_DEG = atof(argv[4]);
  if (argc > 5) CAM_R = atof(argv[5]);
  if (argc > 6) R_OUT = atof(argv[6]);
  double a = A_SPIN, a2 = a * a;
  double rH = 1 + sqrt(1 - a2), rI = isco(a);
  double th0 = CAM_THETA_DEG * M_PI / 180.0, r0 = CAM_R;
  fprintf(stderr, "a=%.6f r_horizon=%.5f r_isco=%.5f camera r=%.1f theta=%.1f deg disk out=%.1f  %dx%d\n", a, rH, rI, r0, CAM_THETA_DEG, R_OUT, W, H);

  /* ZAMO camera */
  double c0 = cos(th0), s0 = sin(th0);
  double Sig0 = r0 * r0 + a2 * c0 * c0, Del0 = r0 * r0 - 2 * r0 + a2;
  double A0 = (r0 * r0 + a2) * (r0 * r0 + a2) - a2 * Del0 * s0 * s0;
  double alpha = sqrt(Sig0 * Del0 / A0), omega = 2 * a * r0 / A0, varpi = sqrt(A0 / Sig0) * s0;

  float *rgb = malloc(sizeof(float) * 3 * W * H);
  uint8_t *code = malloc(W * H);
  float *th_inf = malloc(sizeof(float) * W * H), *ph_inf = malloc(sizeof(float) * W * H);
  double maxres = 0;

  /* Peak disk emission for normalisation: F(r) = r^-3 (1 - sqrt(rI/r)), maximised numerically. */
  double Fmax = 0;
  for (double r = rI; r < R_OUT; r += 0.001) { double F = pow(r, -3) * (1 - sqrt(rI / r)); if (F > Fmax) Fmax = F; }
  const double T_MAX = 4600.0;  /* artistic: warm white-orange; the real temperature scale is not modelled */

#pragma omp parallel for schedule(dynamic, 4) reduction(max : maxres)
  for (int j = 0; j < H; j++) {
    for (int i = 0; i < W; i++) {
      double lon = ((i + 0.5) / W - 0.5) * 2 * M_PI;      /* -pi..pi, 0 looks at the hole */
      double lat = (0.5 - (j + 0.5) / H) * M_PI;          /* +pi/2 north .. -pi/2 south */
      double nr = -cos(lat) * cos(lon), nph = cos(lat) * sin(lon), nth = -sin(lat);
      double E = alpha + omega * varpi * nph, L = varpi * nph / E;
      double dth = nth * sqrt(Sig0) / E, dr = nr * sqrt(Del0 * Sig0) / E;
      double Q = dth * dth - c0 * c0 * (a2 - L * L / (s0 * s0));
      Consts k = {L, Q};
      /* consistency: R(r0) must equal dr^2 for a null ray */
      double P0 = r0 * r0 + a2 - a * L, R0 = P0 * P0 - Del0 * (Q + (L - a) * (L - a));
      double res = fabs(R0 - dr * dr) / (1 + dr * dr);
      if (res > maxres) maxres = res;
      State s = {r0, dr, c0, -s0 * dth, 0.0};
      double col[3] = {0, 0, 0};
      int cd = 0;
      double tin = 0, pin = 0;
      for (int step = 0; step < 8000; step++) {
        double Sig = s.r * s.r + a2 * s.u * s.u;
        (void)Sig;
        /* Mino step ~ 0.04 / r, refined near the horizon where Delta -> 0 and the equations stiffen. */
        double h = 0.04 / fmax(s.r, 1.4);
        double near = (s.r - rH) / rH;
        if (near < 1.0) h *= fmax(0.05, near);
        /* Near a pole phi changes quickly (dphi/dtau ~ L / (1 - u^2)): refine so a ray that skirts the axis is resolved. */
        double polar = (1 - s.u * s.u) * 25;
        if (polar < 1.0) h *= fmax(0.01, polar);
        State prev = s;
        rk4(&s, &k, a, h);
        if (fabs(s.u) > 1) { /* turned over a pole: reflect (u'' is smooth, so this is only a rounding guard) */
          s.u = (s.u > 0 ? 1 : -1) * (2 - fabs(s.u));
          s.pu = -s.pu;
        }
        if (s.r <= rH + 1e-4) { cd = 2; break; }
        if (prev.u * s.u < 0) {
          double f = fabs(prev.u) / (fabs(prev.u) + fabs(s.u));
          double rc = prev.r + f * (s.r - prev.r);
          if (rc >= rI && rc <= R_OUT) {
            double phic = prev.phi + f * (s.phi - prev.phi);
            double Om = 1.0 / (pow(rc, 1.5) + a);
            double ut = (pow(rc, 1.5) + a) / (pow(rc, 0.75) * sqrt(pow(rc, 1.5) - 3 * sqrt(rc) + 2 * a));
            double den = E * ut * (1 - Om * L);
            if (!(den > 1e-6)) { cd = 2; break; } /* unphysical (integration error at the horizon): treat as captured */
            double gfac = 1.0 / den;
            if (gfac > 4) gfac = 4;
            double F = pow(pow(rc, -3) * (1 - sqrt(rI / rc)) / Fmax, 1.25); /* steeper than the thin-disk law: the outer disk is dim (artistic) */
            if (F < 0) F = 0;
            /* turbulence: streaks along the flow, brighter and dimmer bands */
            double ph = fmod(phic, 2 * M_PI); if (ph < 0) ph += 2 * M_PI;
            double n1 = vnoise(ph * 64 / (2 * M_PI), log(rc) * 14, 64), n2 = vnoise(ph * 128 / (2 * M_PI), log(rc) * 40, 128);
            double tex = 0.55 + 0.9 * (0.65 * n1 + 0.35 * n2);
            double Tobs = gfac * T_MAX * pow(F, 0.25) * (0.85 + 0.3 * tex);
            double lum = pow(gfac, 4) * F * tex * 14.0;
            double rgbn[3];
            bb_rgb(fmin(fmax(Tobs, 1500.0), 40000.0), rgbn);
            col[0] = lum * rgbn[0]; col[1] = lum * rgbn[1]; col[2] = lum * rgbn[2];
            cd = 1;
            break;
          }
        }
        if (s.r > 4000) {
          cd = 0;
          double uu = s.u > 1 ? 1 : (s.u < -1 ? -1 : s.u);
          tin = acos(uu); pin = s.phi;
          break;
        }
        if (step == 7999) cd = 2;
      }
      int idx = j * W + i;
      rgb[3 * idx] = (float)col[0]; rgb[3 * idx + 1] = (float)col[1]; rgb[3 * idx + 2] = (float)col[2];
      code[idx] = (uint8_t)cd; th_inf[idx] = (float)tin; ph_inf[idx] = (float)pin;
    }
  }
  fprintf(stderr, "max null-condition residual at the camera: %.3e\n", maxres);
  FILE *f = fopen(out, "wb");
  int32_t hdr[2] = {W, H};
  fwrite(hdr, sizeof hdr, 1, f);
  double meta[6] = {a, rH, rI, r0, CAM_THETA_DEG, R_OUT};
  fwrite(meta, sizeof meta, 1, f);
  fwrite(rgb, sizeof(float) * 3, (size_t)W * H, f);
  fwrite(code, 1, (size_t)W * H, f);
  fwrite(th_inf, sizeof(float), (size_t)W * H, f);
  fwrite(ph_inf, sizeof(float), (size_t)W * H, f);
  fclose(f);
  return 0;
}
