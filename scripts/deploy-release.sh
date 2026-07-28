#!/usr/bin/env sh
set -eu

manifest_path="${1:-}"
if [ -z "$manifest_path" ]; then
  echo "Usage: scripts/deploy-release.sh <release.json>" >&2
  exit 2
fi

release_dir="${RELEASE_STATE_DIR:-.release-state}"
generated_env="$release_dir/candidate.env"
current_manifest="$release_dir/current.json"
previous_manifest="$release_dir/previous.json"

mkdir -p "$release_dir"
chmod 700 "$release_dir"
node scripts/release-manifest.mjs "$manifest_path" --env-output "$generated_env"
chmod 600 "$generated_env"

set -a
# shellcheck disable=SC1090
. "$generated_env"
set +a

if [ "${SKIP_DEPLOY_DRAIN:-0}" != "1" ] && docker compose ps -q game | grep -q .; then
  pnpm deploy:drain
fi

if [ "${SKIP_DEPLOY_BACKUP:-0}" != "1" ]; then
  scripts/backup-postgres.sh
fi

docker compose --env-file .env --env-file "$generated_env" pull migrate web game
docker compose --env-file .env --env-file "$generated_env" up -d postgres redis
docker compose --env-file .env --env-file "$generated_env" run --rm migrate
docker compose --env-file .env --env-file "$generated_env" up -d --no-build web game caddy

attempt=1
while [ "$attempt" -le 45 ]; do
  web_health="$(docker compose --env-file .env --env-file "$generated_env" ps --format json web 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  game_health="$(docker compose --env-file .env --env-file "$generated_env" ps --format json game 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  if [ "$web_health" = '"Health":"healthy"' ] && [ "$game_health" = '"Health":"healthy"' ]; then
    if [ -f "$current_manifest" ]; then
      cp "$current_manifest" "$previous_manifest"
    fi
    cp "$manifest_path" "$current_manifest"
    chmod 600 "$current_manifest"
    rm -f "$generated_env"
    echo "Release $RELEASE_VERSION is healthy."
    exit 0
  fi
  sleep 2
  attempt=$((attempt + 1))
done

docker compose --env-file .env --env-file "$generated_env" ps
docker compose --env-file .env --env-file "$generated_env" logs --tail 150 web game migrate
echo "Release failed readiness checks. The previous manifest remains unchanged." >&2
echo "Run scripts/rollback-release.sh $previous_manifest after diagnosing migration compatibility." >&2
exit 1
