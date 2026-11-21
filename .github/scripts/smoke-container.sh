#!/usr/bin/env bash
set -euo pipefail

image=${1:?pass the locally built image name}
work=$(mktemp -d)
port_a=19101
port_b=19102
web_port=19180

cleanup() {
  docker rm -f wallpaper-web-smoke >/dev/null 2>&1 || true
  if [[ -n ${server_a:-} ]]; then kill "$server_a" 2>/dev/null || true; fi
  if [[ -n ${server_b:-} ]]; then kill "$server_b" 2>/dev/null || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

mkdir -p "$work/a/api/v1" "$work/b/api/v1"
printf 'upstream-a\n' > "$work/a/api/v1/wallpapers"
printf 'upstream-b\n' > "$work/b/api/v1/wallpapers"
python3 -m http.server "$port_a" --bind 0.0.0.0 --directory "$work/a" > "$work/a.log" 2>&1 &
server_a=$!
python3 -m http.server "$port_b" --bind 0.0.0.0 --directory "$work/b" > "$work/b.log" 2>&1 &
server_b=$!

for spec in "$port_a:upstream-a" "$port_b:upstream-b"; do
  port=${spec%%:*}
  expected=${spec#*:}
  docker run -d --rm --name wallpaper-web-smoke \
    --add-host=host.docker.internal:host-gateway \
    -e "API_UPSTREAM=http://host.docker.internal:$port" \
    -p "127.0.0.1:$web_port:8080" "$image" >/dev/null

  ready=false
  for _ in {1..30}; do
    if curl -fsS "http://127.0.0.1:$web_port/healthz" > /dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 1
  done
  [[ $ready == true ]] || { docker logs wallpaper-web-smoke; exit 1; }

  curl -fsS "http://127.0.0.1:$web_port/" -o "$work/index.html"
  curl -fsS "http://127.0.0.1:$web_port/deep/route" -o "$work/deep.html"
  cmp "$work/index.html" "$work/deep.html"
  asset=$(grep -oE '/assets/[^" ]+\.js' "$work/index.html" | head -1)
  [[ -n $asset ]] || { echo 'No compiled JavaScript asset in index.html' >&2; exit 1; }
  curl -fsS "http://127.0.0.1:$web_port$asset" -o /dev/null
  actual=$(curl -fsS "http://127.0.0.1:$web_port/api/v1/wallpapers?date=2026-10-01")
  [[ $actual == "$expected" ]] || { echo "Expected $expected, received $actual" >&2; exit 1; }
  docker rm -f wallpaper-web-smoke > /dev/null
done

echo 'Frontend image, SPA fallback, assets and deployment-time API switching passed.'
