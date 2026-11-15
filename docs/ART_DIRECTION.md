# Art Direction

Status: **Approved in principle by the creator (D-14 to D-23); creator review of the finished look is pending** (ART-001). Decisions it rests on: D-14 to D-21 in [DECISIONS.md](DECISIONS.md).
Requirements: FR-20 to FR-25 in [PRD.md](PRD.md). The download budgets were approved as D-23.

## 1. The look in one line

**Cinematic realism:** believable light, air, water and scale, framed like the film, inside a browser budget. Shapes can
be simple; light, atmosphere and scale must not be. Every visual should make the player feel *where* they are and
*what time is costing*.

## 2. Constraints

| Constraint | Effect on the art |
| --- | --- |
| Free assets only (C-13); sources are CC0/free libraries and procedural generation in code, **no AI-generated assets** (D-17) | Every asset is listed in `docs/ASSETS.md` with source, author and licence before it merges |
| iPhone 16e at 30 FPS on `low`, desktop 60 FPS on `high` (P-03) | Lighting is baked or cheap on `low`; post-processing only on `high` |
| ≤ 15 MB before the first frame, ≤ 75 MB for the episode (P-03) | Compressed formats only (glTF/GLB with meshopt or Draco, KTX2 textures); per-scene budgets in §8 |
| Unofficial fan project (D-21) | A "not affiliated" notice on the title screen and in the credits; no film footage, stills, score or logos |

## 3. Visual language

- **Light:** one strong, soft key light per scene. On Miller there is no sun: the light is Gargantua's accretion disk,
  so it is diffuse, cool, a little silver, and comes from the part of the sky the disk occupies.
- **Air:** distance fog on every exterior. Scale is read through haze: near things crisp, the horizon soft.
- **Colour:** desaturated and natural. Miller: grey-blue water, pale overcast sky, near-black waves. Endurance: off-white
  panels, warm practical lamps, black space outside. Ranger: dark grey cockpit, amber and white instrument light.
  Strong colour is reserved for warnings and for Gargantua's disk.
- **Scale:** humans are small. Cameras sit low and wide on Miller so the horizon and the waves dominate.
- **Materials:** physically based (albedo, roughness, metalness, normal). Wet surfaces read wet. Suits are scuffed
  fabric and painted metal, not plastic.
- **Motion:** heavy and deliberate (see §6). Nothing bounces.
- **UI:** quiet. Thin type, translucent dark panels, no ornament. Text over the world is subtitle-style, bottom centre.
  The HUD already built (UI-001) is restyled to this, not redesigned.

## 4. Scenes

| Scene | What the player sees | Camera |
| --- | --- | --- |
| **Miller's surface** | Endless knee-deep water to a flat horizon; low swell; Gargantua huge in the sky with its lensed disk; the Ranger standing in the water; the beacon on a short mast; the wreck of Miller's lander half submerged; Brand and Doyle in suits; the "mountains" on the horizon that are waves | Third person, low, wide lens |
| **Ranger cockpit** | Two seats, a cramped dark cabin, physical switches, small instrument screens with real values (fuel, altitude, time for each character), forward windows showing Miller's ocean or Gargantua | First person |
| **Endurance interior** | A section of the rotating ring: corridor, a module window with stars and Gargantua, Romilly's workstation. The room changes with years passed (§6) | Third person, close |
| **Gargantua sky** | A physically rendered image of a rapidly spinning black hole with a thin accretion disk, baked offline (§7) and used as the sky on Miller, outside Endurance and in the cockpit windows | — |
| **Earth farmhouse** (M2) | Dust, cornfields, a bookshelf, evening light | Third person |

## 5. Characters

Suited 3D figures (D-15). Helmets with reflective visors outside; on Endurance, Romilly wears a flight suit and is seen
mostly from behind or at a distance, so no detailed face is needed. One base humanoid rig (CC0) with a suit built in
code or from CC0 parts; each character differs by suit markings, colour band and posture. Animations: idle, walk,
heavy wade (§6), turn, kneel (beacon, wreck), radio gesture.

## 6. Physics made visible

| Physics | How the player feels it | When |
| --- | --- | --- |
| **Time dilation** (real Kerr rates, D-12) | (a) An original tick sound: **one tick per day of Romilly's time**. On Miller that is a tick about every 1.43 s of Cooper's time (86 400 s × 1.6546×10⁻⁵); while Romilly is controlled it falls silent, because a day passes in a day. Actions that skip time play the ticks as a fast, rising run with the day count. (b) The HUD's clocks. (c) Endurance changes with years passed: dust, a wall of tally marks, logbook stacks, a plant that grows, the message queue piling up. (d) On every switch, a title card: *"Romilly. 23 years, 4 months since you left."* | M1 |
| **Heavy gravity** (Miller ≈ 1.3 g, the film's figure; not modelled in PHYSICS) | Slower walk and acceleration, shorter strides, no jumping, a heavier camera bob, extra drag wading through knee-deep water, spray at the shins | M1 |
| **The tidal wave** (mechanism per Thorne [P3]; height about a kilometre, film reference) | A real object on the episode timeline: from the warning it rises on the horizon and approaches at a speed fixed so it arrives exactly at the hard deadline. If it reaches you, the outcome already in the rules plays (Doyle, flooded engines). It is never faked by a cut | M1 |
| **Flight** | M1: assisted descent, ascent and docking as in-engine sequences (camera moves, engine light, the cockpit instruments showing real fuel and time). M2: physically simulated thrust, fuel and orbits, still assisted (FR-24) | M1 / M2 |

## 7. Gargantua image (offline, physically based)

Rendered offline by our own code, not drawn: a ray tracer for a spinning (Kerr) black hole with a thin, geometrically
flat accretion disk, following the method of James et al. 2015 [P4]. Output: an equirectangular sky image (and a
smaller one for `low`), committed with the script that made it, the parameters used, and the runtime it took. Spin and
mass match PHYSICS §4; the disk's brightness and colour are artistic choices and are labelled as such. It is a
rendering approximation, as PHYSICS §1 already says.

## 8. Asset pipeline and budgets

- **Sources:** CC0 or similarly free libraries (for example Poly Haven for skies and textures, ambientCG for materials,
  Quaternius and Kenney for models), plus procedural geometry and textures generated in code. No AI-generated assets.
- **Formats:** GLB with meshopt or Draco; KTX2 (Basis) textures, 1K on `low`, 2K on `high`; audio as Opus/AAC.
- **Record:** `docs/ASSETS.md` lists every file: path, source URL, author, licence, changes made.
- **Per-scene budgets (compressed, approved as D-23):** Miller 6 MB, cockpit 3 MB, Endurance 3 MB, Gargantua sky 1 MB
  (`low`) / 3 MB (`high`), tick and UI sounds 0.2 MB. That keeps the first scene plus the shell under 15 MB.
- **Quality tiers:** `low` has baked lighting, no post-processing, opaque water with a cheap normal map and fog. `high`
  adds ACES tone mapping, mild bloom on the disk and lamps, screen-space reflections on water where affordable, and a
  very light film grain. Tiers never change rules (ARCHITECTURE §7).

## 9. Visuals by milestone

| Milestone | What it looks like |
| --- | --- |
| **M1** (revised) | The three scenes dressed to this document; Gargantua sky; suited Cooper, Brand and Doyle; Romilly in Endurance; the visible wave; heavy-gravity movement; assisted landing and ascent sequences; the tick; subtitle-style story text for all 12 beats; title screen with the fan notice. Simple geometry, but lit, fogged and framed like the film |
| **M2** | Earth farmhouse; Brand and Murph playable; simulated flight with real instruments; music and sound effects with captions; codex screens; an art polish pass (better water and spray, level of detail, rain on visors) |
| **M3** | No new content. Performance and compression work, contrast and caption checks, device-tested visuals, credits screen with every licence |
| **M4** | New places per episode (for example Mann's ice world, a Gargantua flyby). A real-time lensing renderer is considered only against a measured need |
| **M5** | Co-op presence (who is where, who is driving time); no change of style |

## 10. Review

1. **Mood board** (ART-001): a reference page with the palette, lighting rules, the CC0 assets picked, and written
   shot descriptions, plus screenshots of a quick in-engine lighting test of Miller's surface. Creator signs off.
2. **One scene first:** Miller's surface fully dressed (SCENE-002), shown as screenshots and on a preview link. Creator
   signs off before the cockpit and Endurance are dressed.
3. Every later art PR includes desktop and phone screenshots.
