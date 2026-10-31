#!/usr/bin/env sh

operations_lock_held=0
operations_lock_token=""
operations_lock_dir=""

validate_compose_project() {
  case "$1" in
    ""|[!a-z0-9]*|*[!a-z0-9_-]*)
      printf 'COMPOSE_PROJECT_NAME must start with a lowercase letter or digit and contain only lowercase letters, digits, underscores and hyphens.\n' >&2
      return 2
      ;;
  esac
}

initialize_compose_project() {
  # Read dotenv with Node's parser, never execute a production env file as shell.
  if [ -z "${COMPOSE_PROJECT_NAME:-}" ]; then
    COMPOSE_PROJECT_NAME="$(
      unset COMPOSE_PROJECT_NAME
      "${node_command:-node}" --env-file-if-exists=.env \
        --print 'process.env.COMPOSE_PROJECT_NAME || ""'
    )"
  fi
  validate_compose_project "$COMPOSE_PROJECT_NAME"
  export COMPOSE_PROJECT_NAME
}

prepare_release_state() {
  umask 077
  mkdir -p "$1"
  chgrp "${RELEASE_STATE_GROUP:-werewolf-release-readers}" "$1"
  chmod 2750 "$1"
}

allow_release_state_readers() {
  # Root-run recovery must leave the directory's deploy user as provenance writer.
  for state_file do
    state_writer_uid="$(stat -c %u -- "$(dirname -- "$state_file")")" || return 1
    state_file_uid="$(stat -c %u -- "$state_file")" || return 1
    if [ "$state_file_uid" != "$state_writer_uid" ]; then
      chown "$state_writer_uid" "$state_file" || return 1
    fi
  done
  chgrp "${RELEASE_STATE_GROUP:-werewolf-release-readers}" "$@" || return 1
  chmod 640 "$@"
}

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

run_before_deadline() {
  operation_deadline="$1"
  operation_limit="$2"
  shift 2
  operation_remaining=$((operation_deadline - $(date +%s)))
  if [ "$operation_remaining" -le 0 ]; then
    return 124
  fi
  if [ "$operation_remaining" -gt "$operation_limit" ]; then
    operation_remaining="$operation_limit"
  fi
  run_with_process_timeout "$operation_remaining" "$@"
}

initialize_drain_timeouts() {
  drain_timeout_ms="${DEPLOY_DRAIN_TIMEOUT_MS:-1200000}"
  drain_cancel_timeout_ms="${DEPLOY_DRAIN_CANCEL_TIMEOUT_MS:-10000}"
  require_positive_integer DEPLOY_DRAIN_TIMEOUT_MS "$drain_timeout_ms"
  require_positive_integer DEPLOY_DRAIN_CANCEL_TIMEOUT_MS "$drain_cancel_timeout_ms"
  drain_process_timeout=$(( (drain_timeout_ms + drain_cancel_timeout_ms + 999) / 1000 + 5 ))
  drain_cleanup_timeout=$(( (drain_cancel_timeout_ms + 999) / 1000 + 5 ))
}

cancel_drain_bounded() {
  if ! run_with_process_timeout "$drain_cleanup_timeout" pnpm deploy:cancel-drain >/dev/null 2>&1; then
    operations_lock_held=0
    write_maintenance_marker "$release_dir" 'drain cancellation unconfirmed; host lock retained' || true
    printf 'CRITICAL: drain cancellation unconfirmed; preserving the host lock.\n' >&2
    return 1
  fi
}

run_deploy_drain() {
  drain_start_pending=1
  if run_with_process_timeout "$drain_process_timeout" node "$script_dir/deploy-drain.mjs"; then
    drain_start_pending=0
    return 0
  else
    drain_exit_code=$?
    # Exit 75 means the CLI aborted cleanly. Other exits
    # may leave a mutating exec queued/running even after a later DELETE succeeds.
    if [ "$drain_exit_code" -eq 75 ]; then
      drain_start_pending=0
    fi
    return "$drain_exit_code"
  fi
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
    printf '\n== allowlisted container status (at most 20 containers) ==\n'
    run_with_process_timeout 10 docker compose --env-file .env --env-file "$forensic_env_file" \
      ps --all --quiet 2>/dev/null | head -n 20 | while IFS= read -r forensic_container; do
        case "$forensic_container" in ""|*[!a-f0-9]*) continue ;; esac
        safe_container_status docker "$forensic_container"
      done
    printf 'Raw logs, health output, commands and environment are intentionally not collected.\n'
  } > "$forensic_file" 2>&1
  chmod 600 "$forensic_file" 2>/dev/null || true
  printf 'Forensic diagnostics preserved at %s.\n' "$forensic_file" >&2
}

safe_container_status() {
  # Health output, State.Error, Config and raw logs may contain credentials or PII.
  run_with_process_timeout 10 "$1" inspect --format \
    'id={{.Id}} status={{.State.Status}} running={{.State.Running}} oom_killed={{.State.OOMKilled}} exit_code={{.State.ExitCode}} started_at={{.State.StartedAt}} finished_at={{.State.FinishedAt}} restart_count={{.RestartCount}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
    "$2" 2>/dev/null | head -c 4096 || true
}

preserve_and_stop_container() {
  container_command="$1"
  container_name="$2"
  container_state_dir="$3"
  container_action="$4"
  # Only confirmed removal/absence can make releasing the lock safe again.
  container_cleanup_lock_held="$operations_lock_held"
  operations_lock_held=0

  container_forensic_dir="${OPERATIONS_FORENSICS_DIR:-$container_state_dir/forensics}"
  container_forensic_file="$container_forensic_dir/$(date -u +%Y%m%dT%H%M%SZ)-$container_action-$$.log"
  umask 077
  mkdir -p "$container_forensic_dir" || true
  {
    printf 'container=%s\n' "$container_name"
    printf 'captured_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    safe_container_status "$container_command" "$container_name"
    printf '\nRaw logs, health output, commands and environment are intentionally not collected.\n'
  } > "$container_forensic_file" 2>&1 || true
  chmod 600 "$container_forensic_file" 2>/dev/null || true

  if run_with_process_timeout 10 "$container_command" rm -f "$container_name" >/dev/null 2>&1; then
    operations_lock_held="$container_cleanup_lock_held"
    printf 'Stopped unresolved migrator %s; evidence is at %s.\n' \
      "$container_name" "$container_forensic_file" >&2
    return 0
  fi

  # A failed inspect/rm can mean a missing container OR an unavailable daemon.
  if container_cleanup_matches="$(run_with_process_timeout 10 "$container_command" \
    ps --all --filter "name=^/${container_name}$" --format '{{.ID}}' 2>/dev/null)" && \
    [ -z "$container_cleanup_matches" ]; then
    operations_lock_held="$container_cleanup_lock_held"
    printf 'Confirmed unresolved migrator %s is absent.\n' "$container_name" >&2
    return 0
  fi
  printf 'CRITICAL: could not confirm removal or absence of migrator %s; preserving the host lock.\n' \
    "$container_name" >&2
  return 1
}
