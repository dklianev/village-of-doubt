#!/usr/bin/env sh

operations_lock_held=0
operations_lock_token=""
operations_lock_dir=""

require_positive_integer() {
  variable_name="$1"
  variable_value="$2"
  case "$variable_value" in
    ""|0|0[0-9]*|*[!0-9]*)
      printf '%s must be a positive integer.\n' "$variable_name" >&2
      return 2
      ;;
  esac
}

acquire_operations_lock() {
  operation_action="$1"
  requested_lock_dir="$2"
  case "$requested_lock_dir" in
    ""|"/")
      printf 'OPERATIONS_LOCK_DIR must identify a dedicated host directory.\n' >&2
      return 2
      ;;
    /*|[A-Za-z]:/*) ;;
    *)
      printf 'OPERATIONS_LOCK_DIR must be an absolute path.\n' >&2
      return 2
      ;;
  esac

  lock_parent="$(dirname -- "$requested_lock_dir")"
  umask 077
  mkdir -p "$lock_parent"
  if ! mkdir "$requested_lock_dir" 2>/dev/null; then
    printf 'Another production operation holds the host lock at %s.\n' "$requested_lock_dir" >&2
    if [ -r "$requested_lock_dir/owner" ]; then
      sed 's/^/  /' "$requested_lock_dir/owner" >&2 || true
    fi
    printf 'Verify the recorded PID and preserve the directory until the prior operation is resolved.\n' >&2
    return 73
  fi

  operations_lock_token="${operation_action}-$$-$(date -u +%Y%m%dT%H%M%SZ)"
  operations_lock_dir="$requested_lock_dir"
  operations_lock_held=1
  {
    printf 'token=%s\n' "$operations_lock_token"
    printf 'action=%s\n' "$operation_action"
    printf 'pid=%s\n' "$$"
    printf 'started_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'host=%s\n' "$(hostname 2>/dev/null || printf unknown)"
  } > "$operations_lock_dir/owner"
  chmod 600 "$operations_lock_dir/owner"
}

release_operations_lock() {
  if [ "$operations_lock_held" -ne 1 ]; then
    return
  fi
  if [ -f "$operations_lock_dir/owner" ] && \
    grep -Fqx "token=$operations_lock_token" "$operations_lock_dir/owner"; then
    rm -f "$operations_lock_dir/owner"
    rmdir "$operations_lock_dir" 2>/dev/null || true
  else
    printf 'Operation lock ownership changed; preserving %s for investigation.\n' "$operations_lock_dir" >&2
  fi
  operations_lock_held=0
}

run_with_process_timeout() {
  timeout_seconds="$1"
  shift
  require_positive_integer "process timeout" "$timeout_seconds"
  timeout_command="${OPERATIONS_TIMEOUT_COMMAND:-timeout}"
  if ! command -v "$timeout_command" >/dev/null 2>&1; then
    printf 'Required timeout command is unavailable: %s\n' "$timeout_command" >&2
    return 127
  fi
  "$timeout_command" --signal=TERM --kill-after=30s "${timeout_seconds}s" "$@"
}

write_maintenance_marker() {
  marker_state_dir="$1"
  marker_reason="$2"
  marker_path="$marker_state_dir/maintenance-required.txt"
  umask 077
  mkdir -p "$marker_state_dir"
  {
    printf 'recorded_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'reason=%s\n' "$marker_reason"
  } > "$marker_path"
  chmod 600 "$marker_path"
  printf 'Maintenance marker written to %s.\n' "$marker_path" >&2
}

preserve_compose_forensics() {
  forensic_action="$1"
  forensic_release="$2"
  forensic_state_dir="$3"
  forensic_env_file="$4"
  forensic_dir="${OPERATIONS_FORENSICS_DIR:-$forensic_state_dir/forensics}"
  forensic_timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  forensic_file="$forensic_dir/${forensic_timestamp}-${forensic_action}-$$.log"

  umask 077
  mkdir -p "$forensic_dir" || return 0
  {
    printf 'action=%s\n' "$forensic_action"
    printf 'release=%s\n' "$forensic_release"
    printf 'captured_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf '\n== docker compose ps ==\n'
    docker compose --env-file .env --env-file "$forensic_env_file" ps --all || true
    printf '\n== bounded service logs ==\n'
    docker compose --env-file .env --env-file "$forensic_env_file" \
      logs --no-color --tail 200 caddy web game migrate || true
  } > "$forensic_file" 2>&1
  chmod 600 "$forensic_file" 2>/dev/null || true
  printf 'Forensic diagnostics preserved at %s.\n' "$forensic_file" >&2
}

preserve_and_stop_container() {
  container_command="$1"
  container_name="$2"
  container_state_dir="$3"
  container_action="$4"
  if ! "$container_command" inspect "$container_name" >/dev/null 2>&1; then
    return
  fi

  container_forensic_dir="${OPERATIONS_FORENSICS_DIR:-$container_state_dir/forensics}"
  container_forensic_file="$container_forensic_dir/$(date -u +%Y%m%dT%H%M%SZ)-$container_action-$$.log"
  umask 077
  mkdir -p "$container_forensic_dir" || true
  {
    printf 'container=%s\n' "$container_name"
    printf 'captured_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    "$container_command" inspect "$container_name" || true
    "$container_command" logs "$container_name" || true
  } > "$container_forensic_file" 2>&1
  chmod 600 "$container_forensic_file" 2>/dev/null || true

  if ! "$container_command" rm -f "$container_name" >/dev/null 2>&1; then
    printf 'CRITICAL: timed-out migrator %s could not be stopped; preserving the host lock.\n' \
      "$container_name" >&2
    operations_lock_held=0
    return 1
  fi
  printf 'Stopped unresolved migrator %s; evidence is at %s.\n' \
    "$container_name" "$container_forensic_file" >&2
}
