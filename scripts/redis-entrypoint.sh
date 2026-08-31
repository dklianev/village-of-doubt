#!/bin/sh
set -eu

web_secret_file="${WEB_REDIS_PASSWORD_FILE:-/run/secrets/web_redis_password}"
game_secret_file="${GAME_REDIS_PASSWORD_FILE:-/run/secrets/game_redis_password}"
colyseus_secret_file="${COLYSEUS_REDIS_PASSWORD_FILE:-/run/secrets/colyseus_redis_password}"

read_secret() {
  label="$1"
  file="$2"
  if [ ! -r "$file" ]; then
    echo "$label Redis password secret is missing." >&2
    exit 1
  fi
  value="$(cat "$file")"
  if [ "${#value}" -lt 32 ]; then
    echo "$label Redis password secret must contain at least 32 characters." >&2
    exit 1
  fi
  printf '%s' "$value"
}

web_password="$(read_secret Web "$web_secret_file")"
game_password="$(read_secret Game "$game_secret_file")"
colyseus_password="$(read_secret Colyseus "$colyseus_secret_file")"
if [ "$web_password" = "$game_password" ] || [ "$web_password" = "$colyseus_password" ] || [ "$game_password" = "$colyseus_password" ]; then
  echo "Redis service identities must use distinct passwords." >&2
  exit 1
fi

web_password_hash="$(printf '%s' "$web_password" | sha256sum | cut -d ' ' -f 1)"
game_password_hash="$(printf '%s' "$game_password" | sha256sum | cut -d ' ' -f 1)"
colyseus_password_hash="$(printf '%s' "$colyseus_password" | sha256sum | cut -d ' ' -f 1)"
acl_directory="/tmp/werewolf-redis"
acl_file="$acl_directory/users.acl"
umask 077
mkdir -p "$acl_directory"
chmod 0711 "$acl_directory"
rm -f "$acl_file"
cat > "$acl_file" <<EOF
user default off
user werewolf_web on #$web_password_hash resetkeys resetchannels ~wm:rate:* ~wm:health:web:* ~wm:security:game-session-revoked:* &wm:security:game-session-revoked:v1 +@connection +eval +set +get +del +publish +incr +pttl +pexpire
user werewolf_security on #$game_password_hash resetkeys resetchannels ~wm:security:* ~wm:health:security:* &wm:security:game-session-revoked:v1 +@connection +eval +set +get +del +subscribe +unsubscribe +incr +pttl +pexpire +zremrangebyscore +zscore +zadd +zcard +zrevrange +pexpireat +zrem
user werewolf_colyseus on #$colyseus_password_hash resetkeys resetchannels ~roomcaches ~roomcount ~ch:* ~roomhistory ~processhistory &p:* &\$* &concurrent:* &ipc:* &wm:health:colyseus:* +@connection +@hash +@string +@set +@list +@pubsub +@transaction +expire +del +exists +info
EOF
chown redis:redis "$acl_file"

exec /usr/local/bin/docker-entrypoint.sh "$@" --aclfile "$acl_file"
