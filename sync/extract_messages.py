#!/usr/bin/env python3
"""Extract a bot's latest user-visible replies from a ReadTranscript dump.
usage: extract_messages.py --bot <id> [--topics sync/topics.json] [-n 5] <dump.txt> [<older dump.txt> ...]
       -> JSON list on stdout (newest first, only replies on the bot's own job)
Several ReadTranscript pages may be passed in any order; they are sorted by position.
Each item: {"at": ISO+08:00 of the turn's <timestamp>, "text": reply text}
Only real SendToUser contents (what the user actually saw); nothing is invented."""
import json, re, sys
from datetime import datetime
MON = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}
TS = re.compile(r"<timestamp>\w+, (\w{3})\w*\.? (\d+), (\d{4}), (\d+):(\d+) (AM|PM) \(UTC\+8\)</timestamp>")
def ts(t):
    m = TS.search(t)
    if not m: return None
    mo, d, y, h, mi, ap = m.groups(); h = int(h) % 12 + (12 if ap == "PM" else 0)
    return datetime(int(y), MON[mo], int(d), h, int(mi)).strftime("%Y-%m-%dT%H:%M:00+08:00")
SECRET = [
    (re.compile(r"(?<!/tx/)\b0x[0-9a-fA-F]{24,}\b"), lambda m: m.group(0)[:6] + "…" + m.group(0)[-4:]),
    (re.compile(r"\b(sk|pk|ghp|gho|xox[abp]|AKIA)[-_A-Za-z0-9]{12,}"), lambda m: "［已隐藏］"),
    (re.compile(r"(?i)(token|password|passwd|secret|api[_-]?key|私钥|助记词|密码|令牌)(\s*[:=：]\s*)(\S{6,})"), lambda m: m.group(1) + m.group(2) + "［已隐藏］"),
    (re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{40,}\b"), lambda m: m.group(0)[:4] + "…" + m.group(0)[-4:]),
]
def redact(t):
    for rx, fn in SECRET: t = rx.sub(fn, t)
    return t[:1800] + ("…" if len(t) > 1800 else "")
import argparse, os
ap = argparse.ArgumentParser()
ap.add_argument("--bot"); ap.add_argument("--topics", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "topics.json"))
ap.add_argument("-n", type=int, default=5); ap.add_argument("--all", action="store_true", help="debug: skip topic filter")
ap.add_argument("files", nargs="+")
A = ap.parse_args(); n = A.n
topic = (json.load(open(A.topics, encoding="utf-8")).get(A.bot) or {}) if A.bot else {}
INC = [k.lower() for k in topic.get("include", [])]; EXC = [k.lower() for k in topic.get("exclude", [])]
def on_topic(t):
    if A.all or not topic: return True
    low = t.lower()
    if len(re.sub(r"\W", "", low)) < 6: return False          # bare acks like "DYOR。"
    inc = sum(low.count(k) for k in INC); exc = sum(low.count(k) for k in EXC)
    return inc > 0 and (exc == 0 or inc > 2 * exc)
def startpos(f):
    m = re.search(r"positions (\d+)", open(f, encoding="utf-8").read(4000)); return int(m.group(1)) if m else 0
lines = []
for path in sorted(A.files, key=startpos): lines += open(path, encoding="utf-8").read().split("\n")
cur, out = None, []
for line in lines:
    line = line.strip()
    if not line.startswith("{"): continue
    try: o = json.loads(line)
    except Exception: continue
    items = (o.get("message") or {}).get("content") or []
    if isinstance(items, str): items = [{"type": "text", "text": items}]
    if o.get("role") == "user":
        for it in items:
            if it.get("type") == "text":
                t = ts(it.get("text", ""))
                if t: cur = t
    elif o.get("role") == "assistant":
        for it in items:
            txt = None
            if it.get("type") != "tool_use": continue
            inp = it.get("input") or {}
            if isinstance(inp, str):
                try:
                    inp = json.loads(inp)
                except Exception:
                    continue
            if not isinstance(inp, dict):
                continue
            if it.get("name") == "SendToUser":
                txt = inp.get("content")
            elif it.get("name") == "CallDynamicTool" and inp.get("toolName") == "SendToUser":
                args = inp.get("arguments") or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        args = {}
                txt = args.get("content") if isinstance(args, dict) else None
            if isinstance(txt, str) and txt.strip():
                txt = txt.strip()
                if any(m["text"] == txt for m in out[-6:]): continue  # retried/duplicated sends
                out.append({"at": cur or "", "text": redact(txt)})
out = [m for m in out if m["at"] and on_topic(m["text"])]   # no timestamp -> its turn is on an unread page; skip
print(json.dumps(out[-n:][::-1], ensure_ascii=False, indent=1))
