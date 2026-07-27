#!/bin/sh
set -eu

secret_file="${REDIS_PASSWORD_FILE:-/run/secrets/redis_password}"
if [ ! -r "$secret_file" ]; then
  echo "Redis password secret is missing." >&2
  exit 1
fi

password="$(cat "$secret_file")"
if [ "${#password}" -lt 32 ]; then
  echo "Redis password secret must contain at least 32 characters." >&2
  exit 1
fi

password_hash="$(printf '%s' "$password" | sha256sum | cut -d ' ' -f 1)"
acl_directory="/tmp/werewolf-redis"
acl_file="$acl_directory/users.acl"
umask 077
mkdir -p "$acl_directory"
chmod 0711 "$acl_directory"
rm -f "$acl_file"
printf 'user default on #%s ~* &* +@all\n' "$password_hash" > "$acl_file"
chown redis:redis "$acl_file"

exec /usr/local/bin/docker-entrypoint.sh "$@" --aclfile "$acl_file"
