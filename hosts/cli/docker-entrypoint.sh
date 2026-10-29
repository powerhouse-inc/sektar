#!/bin/sh
# Starts the image's host: `ph run $PH_HOST $PH_VERB` (serve by default).
set -eu

# The switchboard takes its database from PH_SWITCHBOARD_DATABASE_URL (or
# PH_REACTOR_DATABASE_URL + DATABASE_URL). Without one it would quietly run
# on PGlite under /data: refuse, unless that is what is wanted.
if [ -z "${PH_SWITCHBOARD_DATABASE_URL:-}" ] \
  && [ -z "${PH_REACTOR_DATABASE_URL:-}" ] \
  && [ "${PH_ALLOW_PGLITE:-0}" != "1" ]; then
  echo "[entrypoint] PH_SWITCHBOARD_DATABASE_URL is not set (postgres://user:password@host:5432/db)." >&2
  echo "[entrypoint] Set it, or PH_ALLOW_PGLITE=1 to keep the stores in PGlite under ${PH_USER_DATA_DIR:-/data}." >&2
  exit 64
fi

exec node_modules/.bin/ph-cli run "${PH_HOST:-cli}" "${PH_VERB:-serve}"
