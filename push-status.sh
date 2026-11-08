#!/usr/bin/env bash
# Push a status JSON file to the 工作室 · 总部大楼 site.
# Usage: ./push-status.sh status.json [base_url]
# base_url defaults to http://127.0.0.1:8788 (local preview). Pass your Pages URL in production.
set -euo pipefail
FILE="${1:?usage: push-status.sh <status.json> [base_url]}"
BASE="${2:-http://127.0.0.1:8788}"
DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="$DIR/.update-token"
[ -r "$TOKEN_FILE" ] || { echo "missing $TOKEN_FILE — copy .update-token.example and put your UPDATE_TOKEN there" >&2; exit 1; }
python3 - "$FILE" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
bots = d if isinstance(d, list) else d.get("bots")
assert isinstance(bots, list) and bots, "bots must be a non-empty array"
for b in bots:
    assert isinstance(b.get("id"), str) and b["id"], "each bot needs id"
    assert b.get("state") in ("working", "idle", "paused"), f"bad state for {b.get('id')}"
print(f"ok: {len(bots)} bots")
PY
curl -sS --fail-with-body -X POST "$BASE/api/status" \
  -H "Authorization: Bearer $(tr -d '\n' < "$TOKEN_FILE")" \
  -H "Content-Type: application/json" \
  --data-binary @"$FILE"
echo
