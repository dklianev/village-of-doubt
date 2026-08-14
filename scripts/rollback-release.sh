#!/usr/bin/env sh
set -eu

release_dir="${RELEASE_STATE_DIR:-/var/lib/werewolf/release-state}"
manifest_path="${1:-$release_dir/previous.json}"
if [ ! -f "$manifest_path" ]; then
  echo "Rollback manifest not found: $manifest_path" >&2
  exit 2
fi

rollback_env="$release_dir/rollback.env"
manifest_signature="${RELEASE_MANIFEST_SIGNATURE:-${manifest_path}.sig}"
mkdir -p "$release_dir"
node --env-file-if-exists=.env scripts/release-manifest.mjs "$manifest_path" \
  --signature "$manifest_signature" \
  --env-output "$rollback_env"
chmod 600 "$rollback_env"

set -a
# shellcheck disable=SC1090
. "$rollback_env"
set +a

docker compose --env-file .env --env-file "$rollback_env" config --quiet
docker compose --env-file .env --env-file "$rollback_env" pull web game
pnpm deploy:drain
docker compose --env-file .env --env-file "$rollback_env" up -d --wait postgres redis
docker compose --env-file .env --env-file "$rollback_env" up -d --no-build --no-deps web game caddy

attempt=1
while [ "$attempt" -le 45 ]; do
  web_health="$(docker compose --env-file .env --env-file "$rollback_env" ps --format json web 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  game_health="$(docker compose --env-file .env --env-file "$rollback_env" ps --format json game 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  web_readiness="unready"
  if docker compose --env-file .env --env-file "$rollback_env" exec -T web \
    wget -qO- http://127.0.0.1:3000/api/health/ready >/dev/null 2>&1; then
    web_readiness="ready"
  fi
  if [ "$web_health" = '"Health":"healthy"' ] && \
    [ "$game_health" = '"Health":"healthy"' ] && \
    [ "$web_readiness" = "ready" ]; then
    cp "$manifest_path" "$release_dir/current.json"
    cp "$manifest_signature" "$release_dir/current.json.sig"
    chmod 600 "$release_dir/current.json"
    chmod 600 "$release_dir/current.json.sig"
    rm -f "$rollback_env"
    echo "Rollback to $RELEASE_VERSION is healthy. No database downgrade was attempted."
    exit 0
  fi
  sleep 2
  attempt=$((attempt + 1))
done

docker compose --env-file .env --env-file "$rollback_env" ps
docker compose --env-file .env --env-file "$rollback_env" logs --tail 150 web game
echo "Rollback images did not become healthy. Escalate to the database restore runbook." >&2
exit 1
