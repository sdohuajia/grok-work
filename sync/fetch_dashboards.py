# Dashboard fetch helper. UI label cadence lives in sync/config.json
# (dashboardSync.intervalMinutes). Cloudflare cron Worker schedule must match.
#!/usr/bin/env python3
"""Snapshot the bots' script dashboards (read-only HTTP GET only) for status.json.

usage: fetch_dashboards.py > dashboards.json      -> {"<bot id>": {dashboard}, ...}

Every request is a plain GET to a fixed allowlisted URL below. Nothing is POSTed,
no token is sent, nothing is clicked. Endpoints that answer 401/403 are reported
as "需令牌，未接入" instead of being worked around.

dashboard object (rendered generically by the page):
  {"title", "url", "fetchedAt" (ISO +08:00), "note"?,
   "stats":  [{"label", "value", "tone"?: "good"|"bad"|"warn"}],
   "tables": [{"title", "columns": [...], "rows": [[...], ...], "note"?}],
   "errors": ["..."]}
"""
import json, sys, os, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

BJ = timezone(timedelta(hours=8))
HOST = os.environ.get("SCRIPT_HOST", "http://127.0.0.1")
POPDEX_URL = os.environ.get("POPDEX_URL", "https://panels.example.com/")

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
OPENER = urllib.request.build_opener(NoRedirect)

def get(url, timeout=25):
    """GET only. returns (status, parsed json | text | None, error str | None)"""
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": "studio-hq-sync/1 (read-only)", "Accept": "application/json"})
    try:
        with OPENER.open(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", "replace")
            try: return r.status, json.loads(body), None
            except Exception: return r.status, body, None
    except urllib.error.HTTPError as e:
        return e.code, None, ("需令牌，未接入" if e.code in (401, 403) else f"HTTP {e.code}")
    except Exception as e:
        return 0, None, "无法连接（" + type(e).__name__ + "）"

def now(): return datetime.now(BJ).strftime("%Y-%m-%dT%H:%M:%S+08:00")
def f(x, d=2):
    try: return round(float(x), d)
    except Exception: return x
def ts(sec):
    try: return datetime.fromtimestamp(float(sec), BJ).strftime("%m-%d %H:%M")
    except Exception: return ""
def pct_frac(x, d=1):  # API fractions -> percent text
    try: return f"{float(x) * 100:.{d}f}%"
    except Exception: return ""
def tone(v):
    try: v = float(v)
    except Exception: return None
    return "good" if v > 0 else ("bad" if v < 0 else None)

# ---------------- Entropy套利 · arb-bot (8001) ----------------
def entropy():
    base = HOST + ":8001"
    d = {"title": "arb-bot · 跨场所套利", "url": base + "/#positions", "fetchedAt": now(), "stats": [], "tables": [], "errors": []}
    _, tc, e = get(base + "/api/trade/config")
    if tc:
        live = tc.get("live") or {}
        d["stats"].append({"label": "实盘场所", "value": " × ".join(live.get("venues") or [])})
        d["stats"].append({"label": "实盘挂起", "value": "无" if not tc.get("live_pending") else "有"})
    elif e: d["errors"].append("trade/config：" + e)
    s, lp, e = get(base + "/api/positions?mode=live")
    if lp and isinstance(lp, dict):
        rows = [[p.get("symbol") or p.get("base") or "", p.get("long") or "", p.get("short") or "", f(p.get("size") or p.get("notional")), f(p.get("pnl") or p.get("unrealized_pnl"))] for p in lp.get("open") or []]
        d["tables"].append({"title": "实盘持仓", "columns": ["标的", "多", "空", "规模", "盈亏"], "rows": rows})
    else:
        d["stats"].append({"label": "实盘持仓", "value": e or "未取到", "tone": "warn"})
    _, pp, e = get(base + "/api/positions?mode=paper")
    if isinstance(pp, dict):
        d["stats"].append({"label": "纸面持仓", "value": f"{len(pp.get('open') or [])} 开 / {len(pp.get('closed') or [])} 已平"})
    _, rh, e = get(base + "/api/rh-spread")
    if isinstance(rh, dict):
        conn = (rh.get("connected") or {}).get("venues") or {}
        d["stats"].append({"label": "价差监控", "value": ("开启" if rh.get("enabled") else "关闭") + " · " + " / ".join(k + ("✓" if v else "✗") for k, v in conn.items()), "tone": "good" if rh.get("enabled") and all(conn.values()) else "warn"})
        d["stats"].append({"label": "监控规模", "value": f"{rh.get('size_usdt')} USDT"})
        rows = []
        for ln in rh.get("lines") or []:
            nm = ln.get("normal") or {}; best = ln.get("best") or {}
            rows.append([ln.get("base"), ln.get("category"), ln.get("session"), f"{f(ln.get('basis_pct'), 3)}%", f"{f(nm.get('median'), 3)}%", f(ln.get("z")), best.get("direction") or "", f(best.get("net_usdt")), "是" if best.get("signal") else "否"])
        d["tables"].append({"title": "RH 价差监控（" + " × ".join(p.get("id", "") for p in rh.get("pairs") or []) + "）", "columns": ["标的", "类别", "时段", "当前基差", "正常中位", "z", "最佳方向", "预计净收益 USDT", "信号"], "rows": rows, "note": "监控数据时间 " + str(rh.get("updated_at", ""))[:19].replace("T", " ") + " UTC"})
    elif e: d["errors"].append("rh-spread：" + e)
    _, bd, e = get(base + "/api/board", timeout=40)
    if isinstance(bd, dict):
        t = bd.get("totals") or {}
        d["stats"].append({"label": "扫描", "value": f"{t.get('venues_ok', '?')} 场所 · {t.get('symbols', '?')} 币种 · {t.get('profitable_pairs', '?')} 盈利组合"})
        rows = []
        for r in (bd.get("funding") or [])[:8]:
            rows.append([r.get("symbol"), r.get("long"), r.get("short"), pct_frac(r.get("daily_spread"), 3), pct_frac(r.get("funding_apr"), 1), f"{f(r.get('entry_basis_pct'), 3)}%"])
        d["tables"].append({"title": "资金费机会 Top 8（机会页）", "columns": ["币种", "做多", "做空", "日费差", "年化", "入场基差"], "rows": rows})
    elif e: d["errors"].append("board：" + e)
    d["note"] = "实盘持仓 / 账户 / 日收益接口（/api/positions?mode=live、/api/trade/accounts、/api/trade/daily）需要交易令牌，按要求未接入。" if s in (401, 403) else None
    return d

# ---------------- 脚本检查执行 · PARALLAX (8010) ----------------
def parallax():
    base = HOST + ":8010"
    d = {"title": "PARALLAX · 对冲刷量 / 价格套利（Arcus × RISEx）", "url": base + "/", "fetchedAt": now(), "stats": [], "tables": [], "errors": []}
    _, st, e = get(base + "/api/status")
    if isinstance(st, dict):
        d["stats"].append({"label": "版本 / 模式", "value": f"v{st.get('version')} · " + {"price_arb": "价格套利", "volume": "刷量"}.get(st.get("runtime_mode"), str(st.get("runtime_mode")))})
        d["stats"].append({"label": "实盘", "value": "否（模拟）" if (st.get("effective") or {}).get("DRY_RUN") else "是", "tone": "good"})
    elif e: d["errors"].append("status：" + e)
    _, sa, e = get(base + "/api/stats")
    if isinstance(sa, dict):
        b = sa.get("balances") or {}; tot = b.get("total") or {}
        d["stats"].append({"label": "总权益", "value": f"{f(tot.get('equity'))} USDC"})
        d["stats"].append({"label": "可用", "value": f"{f(tot.get('available'))} USDC"})
        d["stats"].append({"label": "未实现盈亏", "value": f"{f(tot.get('unrealized_pnl'), 3)} USDC", "tone": tone(tot.get("unrealized_pnl"))})
        led = (sa.get("ledger") or {}).get("total") or {}
        d["stats"].append({"label": "台账成交额", "value": f"{f(led.get('volume'))} USDC · {led.get('fills', 0)} 笔（自 {ts((sa.get('ledger') or {}).get('since'))}）"})
        rows = [[k, f(v.get("equity")), f(v.get("available")), f(v.get("unrealized_pnl"), 3), v.get("open_positions")] for k, v in b.items() if k != "total" and isinstance(v, dict)]
        d["tables"].append({"title": "账户", "columns": ["场所", "权益", "可用", "未实现盈亏", "持仓数"], "rows": rows})
    elif e: d["errors"].append("stats：" + e)
    _, tk, e = get(base + "/api/tasks")
    _, cy, _ = get(base + "/api/cycles?limit=40")
    if isinstance(tk, dict):
        opens = {}
        for c in (cy or {}).get("cycles") or [] if isinstance(cy, dict) else []:
            if c.get("plan") == "open" and (c.get("result") or {}).get("ok") and c.get("asset") not in opens: opens[c.get("asset")] = c
        rows = []
        for t in tk.get("tasks") or []:
            q = ((opens.get(t.get("asset")) or {}).get("result") or {}).get("quotes") or {}
            direction = {"short_rise_long_arcus": "RISE 空 / Arcus 多", "long_rise_short_arcus": "RISE 多 / Arcus 空"}.get(t.get("open_direction"), t.get("open_direction") or "")
            rows.append([t.get("asset"), direction if t.get("opened_at") else "未持仓", t.get("open_quantity"), f"{t.get('leverage')}×", f"{q.get('rise_vwap', '')} / {q.get('arcus_vwap', '')}" if q else "", f"{f(q.get('effective_basis_pct'), 3)}%" if q else "", ts(t.get("opened_at"))])
        d["tables"].append({"title": "持仓任务", "columns": ["标的", "方向", "数量", "杠杆", "开仓价 RISE / Arcus", "开仓基差", "开仓时间"], "rows": rows})
        recent = []
        for c in ((cy or {}).get("cycles") or [])[:6] if isinstance(cy, dict) else []:
            recent.append([ts(c.get("created_at") or c.get("at") or c.get("ts")), c.get("asset"), c.get("plan"), (c.get("reason") or "")[:60]])
        if recent: d["tables"].append({"title": "最近周期", "columns": ["时间", "标的", "动作", "说明"], "rows": recent})
    elif e: d["errors"].append("tasks：" + e)
    return d

# ---------------- 交易大神 · omni-ondo-arb (8011) ----------------
def omni():
    base = HOST + ":8011"
    d = {"title": "omni-ondo-arb · Ondo × Omni × Arcus", "url": base + "/", "fetchedAt": now(), "stats": [], "tables": [], "errors": []}
    s, _, e = get(base + "/", timeout=12)
    if e:
        d["errors"].append("面板 " + e)
        d["note"] = "8011 面板本次无法从外网连接（端口未开放或服务未运行），没有数据。"
        return d
    for ep in ("/api/pnl_summary", "/api/status"):
        _, j, e = get(base + ep)
        if isinstance(j, dict):
            for k, v in list(j.items())[:10]:
                if not isinstance(v, (dict, list)): d["stats"].append({"label": k, "value": str(v)})
        elif e: d["errors"].append(ep + "：" + e)
    return d

# ---------------- 写作 (ex-Vearl) · PEARL RIG (8766) ----------------
def pearl():
    base = HOST + ":8766"
    d = {"title": "PEARL RIG · 矿机 / Vast 报价监控", "url": base + "/", "fetchedAt": now(), "stats": [], "tables": [], "errors": []}
    _, j, e = get(base + "/api/status")
    if not isinstance(j, dict):
        d["errors"].append("status：" + (e or "格式不对")); return d
    m = j.get("market") or {}; fm = j.get("farm") or {}; v = j.get("vast") or {}
    d["stats"] += [
        {"label": "PRL 价格", "value": f"${f(m.get('prlPriceUsd'), 4)}（24h {m.get('prlChange24hPct')}%）", "tone": tone(m.get("prlChange24hPct"))},
        {"label": "全网算力", "value": f"{m.get('networkHashEh')} EH/s"},
        {"label": "日收益 / TH", "value": f"${f(m.get('revenuePerThUsd'), 5)}"},
        {"label": "在租矿机", "value": f"{fm.get('rented')}/{fm.get('capacity')} · {fm.get('totalHashTh')} TH"},
        {"label": "日净收益", "value": f"${f(fm.get('dailyNetUsd'))}", "tone": tone(fm.get("dailyNetUsd"))},
        {"label": "待结 PRL", "value": str(fm.get("pendingPrl"))},
        {"label": "Vast 模式", "value": f"{v.get('mode')} · 可盈利报价 {v.get('profitable_count')}"},
    ]
    rows = [[h.get("gpu"), h.get("type"), h.get("dph"), h.get("day_cost"), h.get("day_rev"), h.get("net"), f"{h.get('roi_pct')}%", h.get("geo")] for h in v.get("hits") or []]
    d["tables"].append({"title": "Vast 可盈利报价", "columns": ["GPU", "类型", "$/小时", "日成本", "日收入", "日净", "ROI", "地区"], "rows": rows, "note": "Vast 数据时间 " + str(v.get("updated_at", "")).replace("T", " ")[:16]})
    if j.get("rigs"):
        d["tables"].append({"title": "矿机", "columns": ["名称", "状态"], "rows": [[r.get("name") or r.get("id"), r.get("status")] for r in j["rigs"]]})
    return d

# ---------------- popdex自动化 · PopDEX 主站 / 8080 ----------------
def popdex():
    d = {"title": "PopDEX 站点巡检", "url": POPDEX_URL, "fetchedAt": now(), "stats": [], "tables": [], "errors": []}
    for name, u in (("panels (POPDEX_URL)", POPDEX_URL), ("panels:8080", HOST + ":8080/")):
        s, _, e = get(u, timeout=15)
        up = s in (200, 301, 302, 303, 307, 308, 401)
        d["stats"].append({"label": name, "value": ("在线" if up else "异常") + (f"（HTTP {s}）" if s else f"（{e}）"), "tone": "good" if up else "bad"})
    d["note"] = "后台需登录（跳转 /login.html），只记录站点是否在线，不读取后台数据。"
    return d

JOBS = {
    "64bc81fe-462b-4a7a-ae86-96e2bf3fbb63": entropy,   # Entropy套利
    "dec85747-0ea6-4655-93d2-9a5e0b2e6b10": parallax,  # 脚本检查执行
    "eef4929f-3af1-4a90-b1a1-134eb093ff7e": omni,      # 交易大神
    "463c6096-1807-47de-ab54-bed0b8fab06a": pearl,     # 写作 (ex-Vearl)
    "c78a06c8-3b83-4670-b132-1b2090f71185": popdex,    # popdex自动化
}
if __name__ == "__main__":
    out = {}
    for bid, fn in JOBS.items():
        try: out[bid] = fn()
        except Exception as ex: out[bid] = {"title": fn.__name__, "fetchedAt": now(), "stats": [], "tables": [], "errors": ["抓取脚本出错：" + type(ex).__name__]}
        for k in ("note",):
            if out[bid].get(k) is None: out[bid].pop(k, None)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
