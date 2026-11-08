// studio-hq-cron — snapshots the bots' script dashboards into KV (key "dashboards").
// Read-only: every request is a plain GET to a fixed URL below, no token, redirects not followed.
// Cron "*/10 * * * *" (free KV plan: 1000 writes/day -> max 144/day here, one put per run).
// A dashboard whose endpoints all fail keeps its previous value (stale:true); if every dashboard fails, nothing is written.
// Binding: STATUS (KV). No public routes (fetch -> 404).
// Cloudflare Workers cannot fetch bare IP addresses, so HOST must be a hostname that resolves to your panels.
// LINK is what the detail panel shows as the clickable URL (can be the same hostname or another public URL).
// Dashboard poll cadence: keep Cloudflare cron in sync with
// sync/config.json → dashboardSync.intervalMinutes (default 10).
// Do not change the live cron here unless you also edit that file
// and rebuild/redeploy UI labels. Schedule cadence is documented in sync/config.json (source of truth for UI labels).
const HOST = "http://panels.example.com";
const LINK = "http://panels.example.com";
const BJ_OFFSET = 8 * 3600e3;

const probe = {};
async function get(url, timeoutMs = 8000) {
  try {
    const r = await fetch(url, { method: "GET", redirect: "manual", headers: { "User-Agent": "studio-hq-cron/1 (read-only)", Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    probe[url] = r.status;
    if (r.status === 401 || r.status === 403) { await r.body?.cancel(); return [r.status, null, "需令牌，未接入"]; }
    if (r.status >= 300 && r.status < 400) { await r.body?.cancel(); return [r.status, null, null]; }
    if (!r.ok) { await r.body?.cancel(); return [r.status, null, "HTTP " + r.status]; }
    const t = await r.text();
    try { return [r.status, JSON.parse(t), null]; } catch (e) { return [r.status, t, null]; }
  } catch (e) {
    probe[url] = "ERR " + (e && e.name) + ": " + String(e && e.message).slice(0, 120);
    return [0, null, "无法连接（" + (e && e.name === "TimeoutError" ? "超时" : (e && e.name) || "Error") + "）"];
  }
}
const now = () => new Date(Date.now() + BJ_OFFSET).toISOString().slice(0, 19) + "+08:00";
const f = (x, d = 2) => { const n = parseFloat(x); return isNaN(n) ? x : Math.round(n * 10 ** d) / 10 ** d; };
const ts = (sec) => { const n = parseFloat(sec); if (isNaN(n)) return ""; const s = new Date(n * 1000 + BJ_OFFSET).toISOString(); return s.slice(5, 10) + " " + s.slice(11, 16); };
const pctFrac = (x, d = 1) => { const n = parseFloat(x); return isNaN(n) ? "" : (n * 100).toFixed(d) + "%"; };
const tone = (v) => { const n = parseFloat(v); return isNaN(n) || n === 0 ? undefined : n > 0 ? "good" : "bad"; };
const blank = (title, url) => ({ title, url, fetchedAt: now(), stats: [], tables: [], errors: [] });

async function entropy(get) {
  const b = HOST + ":8001";
  const d = blank("arb-bot · 跨场所套利", LINK + ":8001/#positions");
  const [[, tc, e1], [ls, lp, e2], [, pp], [, rh, e4], [, bd, e5]] = await Promise.all([
    get(b + "/api/trade/config"), get(b + "/api/positions?mode=live"), get(b + "/api/positions?mode=paper"), get(b + "/api/rh-spread"), get(b + "/api/board", 12000)]);
  if (tc && typeof tc === "object") {
    const live = tc.live || {};
    d.stats.push({ label: "实盘场所", value: (live.venues || []).join(" × ") });
    d.stats.push({ label: "实盘挂起", value: tc.live_pending ? "有" : "无" });
  } else if (e1) d.errors.push("trade/config：" + e1);
  if (lp && typeof lp === "object") {
    const rows = (lp.open || []).map((p) => [p.symbol || p.base || "", p.long || "", p.short || "", f(p.size ?? p.notional), f(p.pnl ?? p.unrealized_pnl)]);
    d.tables.push({ title: "实盘持仓", columns: ["标的", "多", "空", "规模", "盈亏"], rows });
  } else d.stats.push({ label: "实盘持仓", value: e2 || "未取到", tone: "warn" });
  if (pp && typeof pp === "object") d.stats.push({ label: "纸面持仓", value: `${(pp.open || []).length} 开 / ${(pp.closed || []).length} 已平` });
  if (rh && typeof rh === "object") {
    const conn = (rh.connected || {}).venues || {};
    const allOk = Object.values(conn).every(Boolean);
    d.stats.push({ label: "价差监控", value: (rh.enabled ? "开启" : "关闭") + " · " + Object.entries(conn).map(([k, v]) => k + (v ? "✓" : "✗")).join(" / "), tone: rh.enabled && allOk ? "good" : "warn" });
    d.stats.push({ label: "监控规模", value: `${rh.size_usdt} USDT` });
    const rows = (rh.lines || []).map((ln) => { const nm = ln.normal || {}, best = ln.best || {}; return [ln.base, ln.category, ln.session, f(ln.basis_pct, 3) + "%", f(nm.median, 3) + "%", f(ln.z), best.direction || "", f(best.net_usdt), best.signal ? "是" : "否"]; });
    d.tables.push({ title: "RH 价差监控（" + (rh.pairs || []).map((p) => p.id).join(" × ") + "）", columns: ["标的", "类别", "时段", "当前基差", "正常中位", "z", "最佳方向", "预计净收益 USDT", "信号"], rows, note: "监控数据时间 " + String(rh.updated_at || "").slice(0, 19).replace("T", " ") + " UTC" });
  } else if (e4) d.errors.push("rh-spread：" + e4);
  if (bd && typeof bd === "object") {
    const t = bd.totals || {};
    d.stats.push({ label: "扫描", value: `${t.venues_ok ?? "?"} 场所 · ${t.symbols ?? "?"} 币种 · ${t.profitable_pairs ?? "?"} 盈利组合` });
    const rows = (bd.funding || []).slice(0, 8).map((r) => [r.symbol, r.long, r.short, pctFrac(r.daily_spread, 3), pctFrac(r.funding_apr, 1), f(r.entry_basis_pct, 3) + "%"]);
    d.tables.push({ title: "资金费机会 Top 8（机会页）", columns: ["币种", "做多", "做空", "日费差", "年化", "入场基差"], rows });
  } else if (e5) d.errors.push("board：" + e5);
  if (ls === 401 || ls === 403) d.note = "实盘持仓 / 账户 / 日收益接口（/api/positions?mode=live、/api/trade/accounts、/api/trade/daily）需要交易令牌，按要求未接入。";
  return d;
}

const DIR = { short_rise_long_arcus: "RISE 空 / Arcus 多", long_rise_short_arcus: "RISE 多 / Arcus 空" };
async function parallax(get) {
  const b = HOST + ":8010";
  const d = blank("PARALLAX · 对冲刷量 / 价格套利（Arcus × RISEx）", LINK + ":8010/");
  const [[, st, e1], [, sa, e2], [, tk, e3], [, cy]] = await Promise.all([get(b + "/api/status"), get(b + "/api/stats"), get(b + "/api/tasks"), get(b + "/api/cycles?limit=40")]);
  if (st && typeof st === "object") {
    d.stats.push({ label: "版本 / 模式", value: `v${st.version} · ` + ({ price_arb: "价格套利", volume: "刷量" }[st.runtime_mode] || st.runtime_mode) });
    d.stats.push({ label: "实盘", value: (st.effective || {}).DRY_RUN ? "否（模拟）" : "是", tone: "good" });
  } else if (e1) d.errors.push("status：" + e1);
  if (sa && typeof sa === "object") {
    const bal = sa.balances || {}, tot = bal.total || {};
    d.stats.push({ label: "总权益", value: `${f(tot.equity)} USDC` });
    d.stats.push({ label: "可用", value: `${f(tot.available)} USDC` });
    d.stats.push({ label: "未实现盈亏", value: `${f(tot.unrealized_pnl, 3)} USDC`, tone: tone(tot.unrealized_pnl) });
    const led = (sa.ledger || {}).total || {};
    d.stats.push({ label: "台账成交额", value: `${f(led.volume)} USDC · ${led.fills || 0} 笔（自 ${ts((sa.ledger || {}).since)}）` });
    const rows = Object.entries(bal).filter(([k, v]) => k !== "total" && v && typeof v === "object").map(([k, v]) => [k, f(v.equity), f(v.available), f(v.unrealized_pnl, 3), v.open_positions]);
    d.tables.push({ title: "账户", columns: ["场所", "权益", "可用", "未实现盈亏", "持仓数"], rows });
  } else if (e2) d.errors.push("stats：" + e2);
  if (tk && typeof tk === "object") {
    const cycles = (cy && typeof cy === "object" && cy.cycles) || [];
    const opens = {};
    for (const c of cycles) if (c.plan === "open" && (c.result || {}).ok && !(c.asset in opens)) opens[c.asset] = c;
    const rows = (tk.tasks || []).map((t) => {
      const q = ((opens[t.asset] || {}).result || {}).quotes || null;
      return [t.asset, t.opened_at ? DIR[t.open_direction] || t.open_direction || "" : "未持仓", t.open_quantity, `${t.leverage}×`, q ? `${q.rise_vwap ?? ""} / ${q.arcus_vwap ?? ""}` : "", q ? f(q.effective_basis_pct, 3) + "%" : "", ts(t.opened_at)];
    });
    d.tables.push({ title: "持仓任务", columns: ["标的", "方向", "数量", "杠杆", "开仓价 RISE / Arcus", "开仓基差", "开仓时间"], rows });
    const recent = cycles.slice(0, 6).map((c) => [ts(c.created_at ?? c.at ?? c.ts), c.asset, c.plan, String(c.reason || "").slice(0, 60)]);
    if (recent.length) d.tables.push({ title: "最近周期", columns: ["时间", "标的", "动作", "说明"], rows: recent });
  } else if (e3) d.errors.push("tasks：" + e3);
  return d;
}

async function omni(get) {
  const b = HOST + ":8011";
  const d = blank("omni-ondo-arb · Ondo × Omni × Arcus", LINK + ":8011/");
  const [, , e] = await get(b + "/", 6000);
  if (e) { d.errors.push("面板 " + e); d.note = "8011 面板本次无法连接（端口未开放或服务未运行），没有数据。"; return d; }
  for (const ep of ["/api/pnl_summary", "/api/status"]) {
    const [, j, e2] = await get(b + ep);
    if (j && typeof j === "object") { for (const [k, v] of Object.entries(j).slice(0, 10)) if (v === null || typeof v !== "object") d.stats.push({ label: k, value: String(v) }); }
    else if (e2) d.errors.push(ep + "：" + e2);
  }
  return d;
}

async function pearl(get) {
  const b = HOST + ":8766";
  const d = blank("PEARL RIG · 矿机 / Vast 报价监控", LINK + ":8766/");
  const [, j, e] = await get(b + "/api/status");
  if (!j || typeof j !== "object") { d.errors.push("status：" + (e || "格式不对")); return d; }
  const m = j.market || {}, fm = j.farm || {}, v = j.vast || {};
  d.stats.push(
    { label: "PRL 价格", value: `$${f(m.prlPriceUsd, 4)}（24h ${m.prlChange24hPct}%）`, tone: tone(m.prlChange24hPct) },
    { label: "全网算力", value: `${m.networkHashEh} EH/s` },
    { label: "日收益 / TH", value: `$${f(m.revenuePerThUsd, 5)}` },
    { label: "在租矿机", value: `${fm.rented}/${fm.capacity} · ${fm.totalHashTh} TH` },
    { label: "日净收益", value: `$${f(fm.dailyNetUsd)}`, tone: tone(fm.dailyNetUsd) },
    { label: "待结 PRL", value: String(fm.pendingPrl) },
    { label: "Vast 模式", value: `${v.mode} · 可盈利报价 ${v.profitable_count}` });
  const rows = (v.hits || []).map((h) => [h.gpu, h.type, h.dph, h.day_cost, h.day_rev, h.net, `${h.roi_pct}%`, h.geo]);
  d.tables.push({ title: "Vast 可盈利报价", columns: ["GPU", "类型", "$/小时", "日成本", "日收入", "日净", "ROI", "地区"], rows, note: "Vast 数据时间 " + String(v.updated_at || "").replace("T", " ").slice(0, 16) });
  if ((j.rigs || []).length) d.tables.push({ title: "矿机", columns: ["名称", "状态"], rows: j.rigs.map((r) => [r.name || r.id, r.status]) });
  return d;
}

async function popdex(get) {
  const d = blank("PopDEX 站点巡检", LINK + ":8080/");
  const res = await Promise.all([["panels.example.com", LINK + "/"], ["panels.example.com:8080", HOST + ":8080/"]].map(async ([name, u]) => [name, await get(u, 8000)]));
  for (const [name, [s, , e]] of res) {
    const up = [200, 301, 302, 303, 307, 308, 401].includes(s);
    d.stats.push({ label: name, value: (up ? "在线" : "异常") + (s ? `（HTTP ${s}）` : `（${e}）`), tone: up ? "good" : "bad" });
  }
  d.note = "后台需登录（跳转 /login.html），只记录站点是否在线，不读取后台数据。";
  return d;
}

const JOBS = {
  "64bc81fe-462b-4a7a-ae86-96e2bf3fbb63": entropy,
  "dec85747-0ea6-4655-93d2-9a5e0b2e6b10": parallax,
  "eef4929f-3af1-4a90-b1a1-134eb093ff7e": omni,
  "463c6096-1807-47de-ab54-bed0b8fab06a": pearl,
  "c78a06c8-3b83-4670-b132-1b2090f71185": popdex,
};

popdex.alwaysFresh = true;

async function run(env) {
  for (const k of Object.keys(probe)) delete probe[k];
  const ids = Object.keys(JOBS);
  let prev = null;
  try { prev = JSON.parse((await env.STATUS.get("dashboards")) || "null"); } catch (e) {}
  const prevBots = (prev && prev.bots) || {};
  const attempt = now();
  const out = await Promise.all(ids.map(async (id) => {
    let reached = false;
    const tracked = async (u, t) => { const r = await get(u, t); if (r[0] >= 200 && r[0] < 500) reached = true; return r; }; // 5xx or no answer = failed
    let d;
    try { d = await JOBS[id](tracked); } catch (e) { d = { ...blank(JOBS[id].name, ""), errors: ["抓取出错：" + (e && e.name)] }; reached = false; }
    if (reached) return [true, { ...d, lastAttemptAt: attempt }];
    // site up/down check: "both unreachable" is itself the result, never replaced by an old "在线"
    if (JOBS[id].alwaysFresh) return [false, { ...d, lastAttemptAt: attempt }];
    const p = prevBots[id];
    if (p && !p.neverOk) {
      const errs = (p.errors || []).filter((x) => !String(x).startsWith("本次抓取失败")).concat(["本次抓取失败（" + ((d.errors || [])[0] || "无法连接") + "），显示上次成功的数据"]);
      return [false, { ...p, stale: true, lastAttemptAt: attempt, errors: errs }];
    }
    return [false, { ...d, neverOk: true, lastAttemptAt: attempt }];
  }));
  if (!out.some(([ok]) => ok)) { console.log("all dashboards failed; KV not written"); return; }
  const bots = {}; ids.forEach((id, i) => { bots[id] = out[i][1]; });
  const doc = { fetchedAt: attempt, source: "studio-hq-cron", bots, probe };
  await env.STATUS.put("dashboards", JSON.stringify(doc));
  console.log("dashboards written", attempt, ids.map((id, i) => id.slice(0, 8) + ":" + (out[i][0] ? "ok" : "fail")).join(" "));
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(run(env)); },
  async fetch() { return new Response("Not found", { status: 404 }); },
};
