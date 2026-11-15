"""Generate and check the Miller's-planet time-dilation fixtures (DOCS-002).

Kerr black hole, prograde circular equatorial orbits, Boyer-Lindquist
coordinates, geometric units G = c = M = 1. Standard library only.

Two independent methods compute dt/dtau (t = time of a distant observer,
tau = proper time of the orbiting body):
  A. closed form of Bardeen, Press & Teukolsky (1972)
  B. direct contraction of the equatorial Kerr metric with the orbit's
     4-velocity, using Omega = 1 / (r^1.5 + a)
The script refuses to write fixtures unless A and B agree.

Usage:
  python3 docs/physics/kerr_fixtures.py          # print and write fixtures.json
  python3 docs/physics/kerr_fixtures.py --check  # recompute and compare
"""

import json
import sys
from decimal import Decimal as D, getcontext
from pathlib import Path

getcontext().prec = 60
ONE = D(1)
HOURS_PER_YEAR = D("365.25") * 24
GM_SUN_OVER_C3_S = D("4.925490947e-6")  # seconds (IAU nominal GM_sun / c^3)
PI = D("3.14159265358979323846264338327950288419716939937510")
FIXTURE = Path(__file__).with_name("fixtures.json")

# Chosen parameters (see docs/PHYSICS.md and docs/DECISIONS.md D-12, P-07).
MASS_SOLAR = D("1e8")            # Gargantua mass
TARGET_S = 7 * HOURS_PER_YEAR    # film line: 1 h on Miller = 7 yr on Earth
R_ENDURANCE = D(100)             # Endurance parking orbit, in units of M (Proposed P-07)
AGREE = D("1e-30")               # required relative agreement between methods A and B
TOLERANCE = 1e-9                 # relative tolerance for --check and consumers


def cbrt(x):
    return x ** (ONE / 3) if x > 0 else D(0)


def r_isco(a):
    """Prograde innermost stable circular orbit radius (BPT 1972)."""
    z1 = 1 + cbrt(1 - a * a) * (cbrt(1 + a) + cbrt(1 - a))
    z2 = (3 * a * a + z1 * z1).sqrt()
    return 3 + z2 - ((3 - z1) * (3 + z1 + 2 * z2)).sqrt()


def rate_bpt(r, a):
    """Method A: dtau/dt for a prograde circular equatorial orbit."""
    r32 = r ** D("1.5")
    return r ** D("0.75") * (r32 - 3 * r.sqrt() + 2 * a).sqrt() / (r32 + a)


def rate_metric(r, a):
    """Method B: dtau/dt = sqrt(-(g_tt + 2 g_tphi W + g_phiphi W^2))."""
    w = ONE / (r ** D("1.5") + a)
    g_tt = -(1 - 2 / r)
    g_tphi = -2 * a / r
    g_phiphi = r * r + a * a + 2 * a * a / r
    return (-(g_tt + 2 * g_tphi * w + g_phiphi * w * w)).sqrt()


def slowdown(r, a):
    """dt/dtau, checked by both methods."""
    sa, sb = 1 / rate_bpt(r, a), 1 / rate_metric(r, a)
    if abs(sa - sb) / sa > AGREE:
        raise SystemExit(f"methods disagree at r={r}, a={a}: {sa} vs {sb}")
    return sa


def solve_delta():
    """Find delta = 1 - a/M such that dt/dtau at the ISCO equals TARGET_S."""
    lo, hi = D("1e-20"), D("1e-6")
    for _ in range(300):
        mid = (lo * hi).sqrt()
        a = ONE - mid
        if slowdown(r_isco(a), a) > TARGET_S:
            lo = mid
        else:
            hi = mid
    return (lo * hi).sqrt()


def build():
    delta = solve_delta()
    a = ONE - delta
    r_m = r_isco(a)
    s_m = slowdown(r_m, a)
    s_e = slowdown(R_ENDURANCE, a)
    gm_c3 = GM_SUN_OVER_C3_S * MASS_SOLAR
    period = 2 * PI * (r_m ** D("1.5") + a) * gm_c3
    reference = []
    for label, aa in [("0", D(0)), ("0.9", D("0.9")), ("0.998", D("0.998")),
                      ("1-1e-6", ONE - D("1e-6")), ("1-1e-10", ONE - D("1e-10"))]:
        rr = r_isco(aa)
        reference.append({"spin": label, "r_isco_over_M": float(rr),
                          "dt_dtau_at_isco": float(slowdown(rr, aa))})
    return {
        "generated_by": "docs/physics/kerr_fixtures.py",
        "units": "geometric (G=c=M=1) unless a field says otherwise",
        "tolerance_relative": TOLERANCE,
        "parameters": {
            "mass_solar": float(MASS_SOLAR),
            "spin_delta_1_minus_a_over_M": float(delta),
            "miller_r_over_M": float(r_m),
            "miller_orbit": "prograde circular equatorial at the ISCO (marginally stable)",
            "endurance_r_over_M": float(R_ENDURANCE),
            "earth_clock": "assumed equal to a distant Gargantua observer (speculative wormhole assumption)",
        },
        "derived": {
            "miller_dt_dtau_vs_distant": float(s_m),
            "endurance_dt_dtau_vs_distant": float(s_e),
            "game_rates_dtau_dT": {
                "_comment": "T = Endurance proper time (docs/TIMELINES.md section 1)",
                "endurance": 1.0,
                "miller_surface": float(s_e / s_m),
                "earth": float(s_e),
            },
            "miller_hours_to_endurance_years": float(s_m / s_e / HOURS_PER_YEAR),
            "miller_orbital_period_distant_hours": float(period / 3600),
            "miller_orbital_period_own_seconds": float(period / s_m),
        },
        "reference_isco_table": reference,
        "test_only": {"synthetic_ratio": 10,
                      "_comment": "for unit tests only; no astrophysical validity"},
    }


def main():
    data = build()
    if "--check" in sys.argv:
        stored = json.loads(FIXTURE.read_text())
        bad = []
        def cmp(x, y, path):
            if isinstance(x, dict):
                for k in x:
                    cmp(x[k], y.get(k), f"{path}.{k}")
            elif isinstance(x, list):
                for i, (p, q) in enumerate(zip(x, y)):
                    cmp(p, q, f"{path}[{i}]")
            elif isinstance(x, float):
                if y is None or abs(x - y) > TOLERANCE * max(abs(x), 1e-300):
                    bad.append(path)
            elif x != y:
                bad.append(path)
        cmp(data, stored, "fixtures")
        print("OK: fixtures.json reproduces" if not bad else f"MISMATCH: {bad}")
        sys.exit(1 if bad else 0)
    FIXTURE.write_text(json.dumps(data, indent=2) + "\n")
    print(json.dumps(data["parameters"], indent=2))
    print(json.dumps(data["derived"], indent=2))


if __name__ == "__main__":
    main()
