# POST-001 evidence: the cinematic grade

Every scene gets ACES tone mapping, a touch of contrast and a soft vignette (they run inside the material shaders, so they
cost no extra pass, on both tiers). The `high` tier also gets a mild bloom, so Gargantua's disk and the lamps glow
(a rendering pipeline with extra full-screen passes, so not on `low`; a device that cannot create it keeps the plain image).
Tiers change looks only, never rules.

`desktop-miller.png`: Miller with the grade. Tuned down from a first pass that blew the disk out to white and made the water
inky; exposure 1.3, contrast 1.05, vignette 1.1, bloom threshold 0.92 and weight 0.18.

Creator review pending (D-24): exposure, bloom and vignette strength are taste. Frame-time on a real phone is still the
SPIKE-001 gate; the `low` tier adds no passes.
