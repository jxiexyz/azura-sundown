# azura-sundown

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/jxiexyz/azura-sundown/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/jxiexyz/azura-sundown/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**AZURA SUNDOWN — Port Azura.** An original 3D open-world crime game in the spirit of GTA 6, playable offline in a desktop browser from static files. A sunset coastal metropolis with a drivable city on foot and by car: traffic and pedestrians, cars to steal, a five-level wanted system with police pursuit, roadblocks and a search helicopter, four story missions, arcade combat, a live HUD with a real-road minimap and a circular speedometer, wet-asphalt reflections, rain, and a hand-written bloom pass. All geometry, textures and audio are procedural and original — nothing from Rockstar Games.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
```

Or any static server rooted at `game/` (e.g. `cd game && python3 -m http.server 8080`). Controls: WASD/arrows drive or walk, SHIFT sprint, SPACE handbrake/jump, F enter/exit or carjack, Q/RMB aim, Z/LMB fire, V reload, E interact, R reset car, ESC pause.

The entrypoint `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `buildDossier`:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=qzmx5tn6&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

<!-- build: v3 visual+aim -->
