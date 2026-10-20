#!/usr/bin/env bash
# Flip mock-target /health to 500 for N seconds (default 45), then restore 200.
# Intended for `docker compose up --wait`. Admin lives on mock-target only.
set -euo pipefail

base="${MOCK_TARGET_URL:-http://127.0.0.1:8080}"
default_seconds=45

usage() {
  cat <<EOF
usage: $0 [seconds|--fail|--ok]

  seconds   Return 500 for this many seconds, then restore 200 (default ${default_seconds})
  --fail    Return 500 until --ok (no timer)
  --ok      Restore 200 immediately
EOF
}

require_ready() {
  if ! curl -fsS "$base/ready" >/dev/null; then
    echo "mock-target is not reachable at $base (start Compose with: docker compose up --wait)" >&2
    exit 1
  fi
}

print_health() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$base/health" || true)"
  echo "mock-target /health -> ${code}"
}

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
  --fail)
    require_ready
    curl -fsS -X POST "$base/admin/fail"
    echo
    echo "mock-target /health returning 500 until restore"
    print_health
    ;;
  --ok)
    require_ready
    curl -fsS -X POST "$base/admin/ok"
    echo
    echo "mock-target /health restored to 200"
    print_health
    ;;
  '')
    seconds="$default_seconds"
    ;;
  *)
    seconds="$1"
    if ! [[ "$seconds" =~ ^[0-9]+$ ]]; then
      echo "duration must be a non-negative integer" >&2
      usage
      exit 1
    fi
    ;;
esac

if [[ "${1:-}" == "--fail" || "${1:-}" == "--ok" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  exit 0
fi

require_ready
curl -fsS -X POST "$base/admin/fail?seconds=${seconds}"
echo
echo "mock-target /health returning 500 for ${seconds}s, then 200"
print_health
if [[ "$seconds" -gt 0 ]]; then
  sleep "$seconds"
fi
curl -fsS -X POST "$base/admin/ok" >/dev/null
echo "mock-target /health restored to 200"
print_health
