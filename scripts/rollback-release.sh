#!/usr/bin/env sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# shellcheck disable=SC1091
. "$script_dir/deploy-operations-lib.sh"

release_dir="${RELEASE_STATE_DIR:-/var/lib/werewolf/release-state}"
manifest_path="${1:-$release_dir/previous.json}"
if [ ! -f "$manifest_path" ]; then
  echo "Rollback manifest not found: $manifest_path" >&2
  exit 2
fi

rollback_env="$release_dir/rollback.env"
schema_guard_env="$release_dir/schema-guard.env"
schema_manifest="$release_dir/schema-current.json"
pending_migration_manifest="$release_dir/migration-pending.json"
manifest_signature="${RELEASE_MANIFEST_SIGNATURE:-${manifest_path}.sig}"
mkdir -p "$release_dir"
chmod 700 "$release_dir"

operations_lock_dir="${OPERATIONS_LOCK_DIR:-$release_dir/operations.lock}"
git_command="${RELEASE_GIT_COMMAND:-git}"
drain_armed=0
forensics_enabled=0
operation_release="unvalidated"
cancel_drain_on_exit() {
  exit_code=$?
  trap - EXIT HUP INT TERM
  if [ "$drain_armed" -eq 1 ]; then
    pnpm deploy:cancel-drain >/dev/null 2>&1 || \
      echo "Warning: failed to cancel rollback drain; restart the existing game service before accepting traffic." >&2
  fi
  if [ "$exit_code" -ne 0 ] && [ "$forensics_enabled" -eq 1 ] && [ -f "$rollback_env" ]; then
    preserve_compose_forensics "rollback-failed" "$operation_release" "$release_dir" "$rollback_env"
  fi
  rm -f "$schema_guard_env"
  release_operations_lock
  exit "$exit_code"
}
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
trap cancel_drain_on_exit EXIT

acquire_operations_lock "rollback" "$operations_lock_dir"

node --env-file-if-exists=.env scripts/release-manifest.mjs "$manifest_path" \
  --signature "$manifest_signature" \
  --env-output "$rollback_env"
chmod 600 "$rollback_env"

set -a
# shellcheck disable=SC1090
. "$rollback_env"
set +a
operation_release="$RELEASE_VERSION"

source_commit="$({
  GIT_CONFIG_NOSYSTEM=1 \
  GIT_CONFIG_GLOBAL=/dev/null \
  "$git_command" -c "safe.directory=$PWD" -c core.hooksPath=/dev/null \
    rev-parse --verify 'HEAD^{commit}'
} 2>/dev/null)" || {
  echo "Rollback source checkout commit could not be verified." >&2
  exit 1
}
if [ "$(printf '%s' "$source_commit" | tr 'A-F' 'a-f')" != "$RELEASE_VERSION" ]; then
  echo "Rollback source checkout $source_commit does not match signed manifest sourceCommit $RELEASE_VERSION." >&2
  exit 1
fi

health_timeout_seconds="${RELEASE_HEALTH_TIMEOUT_SECONDS:-240}"
health_poll_seconds="${RELEASE_HEALTH_POLL_INTERVAL_SECONDS:-2}"
compose_wait_timeout_seconds="${COMPOSE_WAIT_TIMEOUT_SECONDS:-120}"
require_positive_integer "RELEASE_HEALTH_TIMEOUT_SECONDS" "$health_timeout_seconds"
require_positive_integer "RELEASE_HEALTH_POLL_INTERVAL_SECONDS" "$health_poll_seconds"
require_positive_integer "COMPOSE_WAIT_TIMEOUT_SECONDS" "$compose_wait_timeout_seconds"
health_attempts=$(( (health_timeout_seconds + health_poll_seconds - 1) / health_poll_seconds ))

if [ -e "$pending_migration_manifest" ] || [ -e "$pending_migration_manifest.sig" ]; then
  reason="migration pending marker exists; rollback safety cannot be proven"
  write_maintenance_marker "$release_dir" "$reason"
  echo "MAINTENANCE REQUIRED: migration is pending or unresolved. No images were changed." >&2
  exit 3
fi
if [ ! -f "$schema_manifest" ] || [ ! -f "$schema_manifest.sig" ]; then
  reason="signed applied-schema manifest is unavailable"
  write_maintenance_marker "$release_dir" "$reason"
  echo "MAINTENANCE REQUIRED: signed applied-schema provenance is unavailable. No images were changed." >&2
  exit 3
fi
node --env-file-if-exists=.env scripts/release-manifest.mjs "$schema_manifest" \
  --signature "$schema_manifest.sig" \
  --env-output "$schema_guard_env"
applied_migration_head="$(sed -n 's/^MIGRATION_HEAD=//p' "$schema_guard_env")"
applied_release_version="$(sed -n 's/^RELEASE_VERSION=//p' "$schema_guard_env")"
if [ -z "$applied_migration_head" ] || [ "$MIGRATION_HEAD" != "$applied_migration_head" ]; then
  reason="rollback target $RELEASE_VERSION ($MIGRATION_HEAD) differs from applied schema $applied_release_version ($applied_migration_head)"
  write_maintenance_marker "$release_dir" "$reason"
  echo "MAINTENANCE REQUIRED: $reason. No images were changed; use the database restore runbook." >&2
  exit 3
fi
rm -f "$schema_guard_env"

docker compose --env-file .env --env-file "$rollback_env" config --quiet
forensics_enabled=1
docker compose --env-file .env --env-file "$rollback_env" pull web game caddy
if [ "${SKIP_DEPLOY_DRAIN:-0}" != "1" ] && docker compose ps -q game | grep -q .; then
  if docker compose exec -T game \
    wget -qO- http://127.0.0.1:2567/health >/dev/null 2>&1; then
    pnpm deploy:drain
    drain_armed=1
  else
    echo "Warning: existing game service is unavailable; continuing without drain." >&2
  fi
fi
docker compose --env-file .env --env-file "$rollback_env" \
  up -d --wait --wait-timeout "$compose_wait_timeout_seconds" postgres redis
docker compose --env-file .env --env-file "$rollback_env" \
  up -d --force-recreate --no-build --no-deps web game caddy
drain_armed=0

attempt=1
health_deadline=$(( $(date +%s) + health_timeout_seconds ))
while [ "$attempt" -le "$health_attempts" ] && [ "$(date +%s)" -lt "$health_deadline" ]; do
  web_health="$(docker compose --env-file .env --env-file "$rollback_env" ps --format json web 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  game_health="$(docker compose --env-file .env --env-file "$rollback_env" ps --format json game 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  caddy_health="$(docker compose --env-file .env --env-file "$rollback_env" ps --format json caddy 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 || true)"
  web_readiness="unready"
  if docker compose --env-file .env --env-file "$rollback_env" exec -T web \
    wget -qO- http://127.0.0.1:3000/api/health/ready >/dev/null 2>&1; then
    web_readiness="ready"
  fi
  if [ "$web_health" = '"Health":"healthy"' ] && \
    [ "$game_health" = '"Health":"healthy"' ] && \
    [ "$caddy_health" = '"Health":"healthy"' ] && \
    [ "$web_readiness" = "ready" ] && \
    node --env-file=.env scripts/deploy-public-health.mjs; then
    cp "$manifest_path" "$release_dir/current.json"
    cp "$manifest_signature" "$release_dir/current.json.sig"
    chmod 600 "$release_dir/current.json"
    chmod 600 "$release_dir/current.json.sig"
    rm -f "$rollback_env"
    echo "Rollback to $RELEASE_VERSION is healthy. No database downgrade was attempted."
    exit 0
  fi
  sleep "$health_poll_seconds"
  attempt=$((attempt + 1))
done

docker compose --env-file .env --env-file "$rollback_env" ps
docker compose --env-file .env --env-file "$rollback_env" logs --tail 150 web game
echo "Rollback images did not become healthy. Escalate to the database restore runbook." >&2
exit 1
