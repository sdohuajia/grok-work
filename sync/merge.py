#!/usr/bin/env python3
"""Merge messages and script dashboards into status.json (in place).
usage: merge.py <status.json> <messages_dir> <dashboards.json>
messages_dir/<bot id>.json = output of extract_messages.py (missing file -> keep old messages).
dashboards.json = output of fetch_dashboards.py ({"<bot id>": {dashboard}}; bots not in it keep their old dashboard).

Preserves top-level `usage` if already present on status.json (do not drop it when
a conversation/dashboard sync forgets to re-include usage).

Sync cadence labels/UI come from sync/config.json (see README 使用方法).
Changing statusSync hours also requires updating the Grok Bot routine schedule;
changing dashboardSync.intervalMinutes requires updating the Cloudflare cron.
"""
import json, os, sys
st_path, mdir, dash_path = sys.argv[1:4]
st = json.load(open(st_path, encoding="utf-8"))
# Keep any existing top-level usage (do not drop when only bots/messages/dashboards change).
usage = st.get("usage")
dash = json.load(open(dash_path, encoding="utf-8")) if os.path.exists(dash_path) else {}
for b in st["bots"]:
    mp = os.path.join(mdir, b["id"] + ".json")
    if os.path.exists(mp): b["messages"] = json.load(open(mp, encoding="utf-8"))[:5]
    if b["id"] in dash: b["dashboard"] = dash[b["id"]]
if usage is not None:
    st["usage"] = usage
json.dump(st, open(st_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
n = len(json.dumps(st, ensure_ascii=False).encode())
print("merged", len(st["bots"]), "bots,", n, "bytes", "(limit 262144)",
      ("usage=yes" if st.get("usage") else "usage=no"))
assert n < 250000, "status.json too large"
