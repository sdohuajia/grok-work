#!/usr/bin/env python3
"""Extract a bot's latest user-visible replies from a SearchTranscripts dump.

usage: extract_search.py --bot <id> [--topics sync/topics.json] [-n 5] <dump.txt> [...]

SearchTranscripts (no query, newest first) lines look like:
  - position 159 at 2026-11-07T01:21:41.827Z (assistant) message text...
Only assistant lines are kept. Topic filter and redaction match extract_messages.py.
Prefer extract_messages.py on a full ReadTranscript dump when that tool is available;
search results may truncate long replies — never paraphrase to fill them in.
"""
import json, re, sys, argparse, os
from datetime import datetime, timezone, timedelta

SECRET = [
    (re.compile(r"(?<!/tx/)\b0x[0-9a-fA-F]{24,}\b"), lambda m: m.group(0)[:6] + "…" + m.group(0)[-4:]),
    (re.compile(r"\b(sk|pk|ghp|gho|xox[abp]|AKIA)[-_A-Za-z0-9]{12,}"), lambda m: "［已隐藏］"),
    (re.compile(r"(?i)(token|password|passwd|secret|api[_-]?key|私钥|助记词|密码|令牌)(\s*[:=：]\s*)(\S{6,})"), lambda m: m.group(1) + m.group(2) + "［已隐藏］"),
    (re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{40,}\b"), lambda m: m.group(0)[:4] + "…" + m.group(0)[-4:]),
]
def redact(t):
    for rx, fn in SECRET:
        t = rx.sub(fn, t)
    return t[:1800] + ("…" if len(t) > 1800 else "")

LINE = re.compile(
    r"- position \d+ (?:at ([0-9T:\.\+\-Z]+) )?\((assistant|user)(?:, [^)]*)?\) (.*)$"
)

def to_bj(iso):
    if not iso:
        return ""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        bj = dt.astimezone(timezone(timedelta(hours=8)))
        return bj.strftime("%Y-%m-%dT%H:%M:00+08:00")
    except Exception:
        return ""

ap = argparse.ArgumentParser()
ap.add_argument("--bot")
ap.add_argument("--topics", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "topics.json"))
ap.add_argument("-n", type=int, default=5)
ap.add_argument("--all", action="store_true")
ap.add_argument("files", nargs="+")
A = ap.parse_args()

topic = (json.load(open(A.topics, encoding="utf-8")).get(A.bot) or {}) if A.bot else {}
INC = [k.lower() for k in topic.get("include", [])]
EXC = [k.lower() for k in topic.get("exclude", [])]

def on_topic(t):
    if A.all or not topic:
        return True
    low = t.lower()
    if len(re.sub(r"\W", "", low)) < 6:
        return False
    inc = sum(low.count(k) for k in INC)
    exc = sum(low.count(k) for k in EXC)
    return inc > 0 and (exc == 0 or inc > 2 * exc)

seen, out = set(), []
for path in A.files:
    for raw in open(path, encoding="utf-8"):
        line = raw.strip()
        m = LINE.search(line)
        if not m:
            continue
        iso, role, text = m.group(1), m.group(2), (m.group(3) or "").strip()
        if role != "assistant" or not text:
            continue
        text = redact(text)
        if text in seen:
            continue
        seen.add(text)
        at = to_bj(iso)
        if not at:
            continue
        if not on_topic(text):
            continue
        out.append({"at": at, "text": text})

# dumps are newest-first; keep chronological unique order then take newest n
out.sort(key=lambda x: x["at"], reverse=True)
print(json.dumps(out[: A.n], ensure_ascii=False, indent=1))
