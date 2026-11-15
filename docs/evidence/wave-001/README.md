# WAVE-001 evidence

The wave is a real object on the episode timeline. It is not there before the warning (the recall decision opening, T =
60 000 000 s), rises on the horizon at the warning, comes closer and taller as reference time runs, and arrives exactly at
the decision's hard deadline (T = 75 000 000 s). It then passes over and is gone. Its position is a pure function of `T`
(`src/render/wave.ts`), so it can never arrive at the wrong time or be a cut.

| Frame | Reference time | |
| --- | --- | --- |
| `01-warning.png` | 1.9 years: the warning has just opened | A thin dark line on the horizon |
| `02-approaching.png` | 2.2 years | A dark band rising in front of Gargantua |
| `03-arrival.png` | 2.4 years: the deadline, time held | The wall is upon the crew |

The consequence matches the picture: Doyle's death is a hazard that applies when `T` reaches the deadline, not at the
choice (`tests/domain/hazards.test.ts`, `tests/slice/slice.test.ts`). Creator review pending (D-24).
