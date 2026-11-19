# Agent rules for this repository (gta6-01 entry)

## NEVER render or screenshot on this VPS
This machine has 2 vCPU, ~500 MB free RAM and **no GPU** (WebGL runs on SwiftShader). Running
chromium or any browser here can thrash swap and kill the build session.

- Do **not** run `chromium`, `google-chrome`, `playwright`, `puppeteer`, or any headless browser locally.
- Do **not** open the game in a local browser to "check pixels".
- To verify rendering or take screenshots, run exactly:
  `bash tools/shoot_ibx.sh`
  It tars `game/`, uploads it to an InstaBox box (4 vCPU / 8 GB, real chromium), renders every entry
  in `shots.json` at 1280x720 and pulls the PNGs back into `screenshots/`. It also prints OK/FAIL
  per file against the competition caps (<=256 KiB, long side <=1280, short side >=480).
- To read one of those images, use your own image/vision tool on the file in `screenshots/`.
  (If your model cannot see images, ask the operator to look and describe it.)

## Static, offline, no network
- Everything the game loads is a file under `game/` or a `data:` URI. No CDN, no remote fonts, no fetch.
- `game/vendor/three.min.js` is the only vendored library and must stay the minified build.
- `vendor/makefun-game.ts` is the kit's copy: never edit it.
- `main.ts` must keep working: `MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Screenshot poses
`shots.json` holds `[{ "name": "...", "query": "?shot=...&seed=1" }]`. Every query must produce a
deterministic frame of the real game (same seed -> same bytes), so the capture is reproducible.
