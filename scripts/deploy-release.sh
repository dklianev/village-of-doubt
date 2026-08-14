#!/usr/bin/env sh
set -eu

manifest_path="${1:-}"
if [ -z "$manifest_path" ]; then
  echo "Usage: scripts/deploy-release.sh <release.json>" >&2
  exit 2
fi

release_dir="${RELEASE_STATE_DIR:-/var/lib/werewolf/release-state}"
generated_env="$release_dir/candidate.env"
current_manifest="$release_dir/current.json"
previous_manifest="$release_dir/previous.json"
backup_service="${BACKUP_SYSTEMD_SERVICE:-werewolf-backup.service}"
manifest_signature="${RELEASE_MANIFEST_SIGNATURE:-${manifest_path}.sig}"

case "$backup_service" in
  ""|*[!A-Za-z0-9@_.-]*)
    echo "BACKUP_SYSTEMD_SERVICE contains unsafe characters." >&2
    exit 2
    ;;
esac

mkdir -p "$release_dir"
chmod 700 "$release_dir"
node --env-file-if-exists=.env scripts/release-manifest.mjs "$manifest_path" \
  --signature "$manifest_signature" \
  --env-output "$generated_env"
chmod 600 "$generated_env"

set -a
# shellcheck disable=SC1090
. "$generated_env"
set +a

node --env-file=.env scripts/check-production-env.mjs
docker compose --env-file .env --env-file "$generated_env" config --quiet
docker compose --env-file .env --env-file "$generated_env" pull migrate web game

if [ "${SKIP_DEPLOY_DRAIN:-0}" != "1" ] && docker compose ps -q game | grep -q .; then
  pnpm deploy:drain
fi

if [ "${SKIP_DEPLOY_BACKUP:-0}" != "1" ]; then
  if [ "$(id -u)" -eq 0 ]; then
    systemctl start "$backup_service"
  else
    sudo -n systemctl start "$backup_service"
  fi
fi

docker compose --env-file .env --env-file "$generated_env" up -d --wait postgres redis
docker compose --env-file .env --env-file "$generated_env" run --rm --no-deps postgres-roles
docker compose --env-file .env --env-file "$generated_env" run --rm --no-deps migrate
docker compose --env-file .env --env-file "$generated_env" run --rm --no-deps postgres-grants
docker compose --env-file .env --env-file "$generated_env" up -d --no-build --no-deps web game caddy

attempt=1
while [ "$attempt" -le 45 ]; do
  web_health="$(docker compose --env-file .env --env-file "$generated_env" ps --format json web 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  game_health="$(docker compose --env-file .env --env-file "$generated_env" ps --format json game 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  web_readiness="unready"
  if docker compose --env-file .env --env-file "$generated_env" exec -T web \
    wget -qO- http://127.0.0.1:3000/api/health/ready >/dev/null 2>&1; then
    web_readiness="ready"
  fi
  if [ "$web_health" = '"Health":"healthy"' ] && \
    [ "$game_health" = '"Health":"healthy"' ] && \
    [ "$web_readiness" = "ready" ]; then
    if [ -f "$current_manifest" ]; then
      cp "$current_manifest" "$previous_manifest"
      if [ -f "$current_manifest.sig" ]; then
        cp "$current_manifest.sig" "$previous_manifest.sig"
      else
        rm -f "$previous_manifest.sig"
      fi
    fi
    cp "$manifest_path" "$current_manifest"
    cp "$manifest_signature" "$current_manifest.sig"
    chmod 600 "$current_manifest"
    chmod 600 "$current_manifest.sig"
    rm -f "$generated_env"
    echo "Release $RELEASE_VERSION is healthy."
    exit 0
  fi
  sleep 2
  attempt=$((attempt + 1))
done

docker compose --env-file .env --env-file "$generated_env" ps
docker compose --env-file .env --env-file "$generated_env" logs --tail 150 web game
echo "Release failed readiness checks. The previous manifest remains unchanged." >&2
echo "Run scripts/rollback-release.sh $previous_manifest after diagnosing migration compatibility." >&2
exit 1
