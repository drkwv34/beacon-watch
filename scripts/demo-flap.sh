#!/usr/bin/env bash
# Flip mock-target /health to 500 (or back to 200 with --ok) for Compose demos.
set -euo pipefail
base="${MOCK_TARGET_URL:-http://127.0.0.1:8080}"
if [[ "${1:-}" == "--ok" ]]; then
  curl -fsS -X POST "$base/admin/ok"
else
  curl -fsS -X POST "$base/admin/fail"
fi
echo
