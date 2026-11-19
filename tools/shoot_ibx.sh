#!/bin/bash
# Capture screenshots/ from the real game on an InstaBox box (no GPU here: SwiftShader is too slow).
# Reads shots.json ([{name, query}]), uploads game/ to the box, renders each pose with headless
# chromium at 1280x720, and pulls the PNGs back into screenshots/.
# Usage: bash tools/shoot_ibx.sh [--keep] [name...]
set -euo pipefail
cd "$(dirname "$0")/.."

: "${INSTABOX_API_KEY:=$(cat "$HOME/.instabox_key" 2>/dev/null || true)}"
export INSTABOX_API_KEY
[ -n "${INSTABOX_API_KEY:-}" ] || { echo "no INSTABOX_API_KEY"; exit 1; }

IBX="$HOME/.hermes/skills/instabox-remotion-render/scripts/ibx.py"
REMOTE=/data/gt_shot
STAMP=$(date +%s)

mapfile -t SHOTS < <(node -e '
const s=require("./shots.json");
const want=process.argv.slice(1).filter(a=>!a.startsWith("--"));
for (const x of s) if (!want.length || want.includes(x.name)) console.log(x.name+"\t"+x.query);
' "$@")
[ ${#SHOTS[@]} -gt 0 ] || { echo "shots.json is empty"; exit 1; }

tar czf "/tmp/gt_game_$STAMP.tgz" game
python3 "$IBX" put "/tmp/gt_game_$STAMP.tgz" "$REMOTE/game.tgz" >/dev/null

CMD="rm -rf $REMOTE/g && mkdir -p $REMOTE/g $REMOTE/out && tar xzf $REMOTE/game.tgz -C $REMOTE/g"
python3 "$IBX" exec "$CMD" >/dev/null

CMD="pkill -f 'http.server 8123' || true; cd $REMOTE/g/game && nohup python3 -m http.server 8123 >/tmp/gt_http.log 2>&1 & sleep 2; curl -s -o /dev/null -w 'http:%{http_code}\n' http://127.0.0.1:8123/index.html"
python3 "$IBX" exec "$CMD" | tail -1

for row in "${SHOTS[@]}"; do
  name="${row%%$'\t'*}"; query="${row#*$'\t'}"
  echo "shot $name  $query"
  # Render in the foreground (a detached child dies with its exec) but keep each call well under the
  # ~120 s exec drop: budget 15 s virtual time, one shot per exec, stale file removed first.
  res=""
  for attempt in 1 2; do
    res=$(python3 "$IBX" exec "rm -f $REMOTE/out/$name; cd $REMOTE && chromium --headless=new --no-sandbox --hide-scrollbars --enable-unsafe-swiftshader --use-angle=swiftshader --window-size=1280,720 --virtual-time-budget=1500 --screenshot=$REMOTE/out/$name 'http://127.0.0.1:8123/index.html$query' >/tmp/gt_shot_${name}.log 2>&1; [ -s $REMOTE/out/$name ] && echo CAPTURED $(stat -c '%s' $REMOTE/out/$name) || echo MISSING" 2>&1 | grep -E "CAPTURED|MISSING" | tail -1)
    echo "  remote: $res"
    case "$res" in CAPTURED*) break;; esac
    echo "  retry $name (attempt $attempt dropped)"
  done
  case "$res" in
    MISSING*|"") echo "FAIL $name — no capture"; rm -f "screenshots/$name"; continue;;
  esac
  mkdir -p screenshots
  python3 "$IBX" get "$REMOTE/out/$name" "screenshots/$name" >/dev/null
  if [ "${TITLE_PROBE:-0}" = "1" ]; then
    python3 "$IBX" exec "chromium --headless=new --no-sandbox --virtual-time-budget=8000 --dump-dom 'http://127.0.0.1:8123/index.html$query' 2>/dev/null | grep -o '<title>[^<]*</title>' | head -1"
  fi
done

echo "--- local:"
ls -la screenshots
node -e '
const fs=require("fs");
for (const f of fs.readdirSync("screenshots")) {
  const b=fs.readFileSync("screenshots/"+f);
  const kb=(b.length/1024).toFixed(0);
  let dim="?";
  if (b[0]===0x89 && b.toString("ascii",1,4)==="PNG") { dim=b.readUInt32BE(16)+"x"+b.readUInt32BE(20); }
  else if (b[0]===0xFF && b[1]===0xD8) {
    for (let i=2;i<b.length-9;i++){ if(b[i]===0xFF&&(b[i+1]===0xC0||b[i+1]===0xC2)){ dim=b.readUInt16BE(i+7)+"x"+b.readUInt16BE(i+5); break; } }
  }
  const ok = b.length<=262144 && dim!=="?" && Math.max(...dim.split("x").map(Number))<=1280 && Math.min(...dim.split("x").map(Number))>=480;
  console.log((ok?"OK  ":"FAIL")+" "+f+" "+dim+" "+kb+"KiB");
}'
