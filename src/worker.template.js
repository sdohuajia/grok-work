// Cloudflare Pages advanced-mode worker for 工作室 · 总部大楼
// Env: ADMIN_USER, ADMIN_PASS_SALT, ADMIN_PASS_HASH (PBKDF2-SHA256, 100k), SESSION_SECRET, UPDATE_TOKEN; optional COMMAND_WEBHOOK_URL / COMMAND_WEBHOOK_KEY; KV binding STATUS
const APP_HTML = __APP_HTML__;
const FAVICON = __FAVICON__;
const COOKIE = "studio_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const STATES = new Set(["working", "idle", "paused"]);
const enc = new TextEncoder();
const SEC = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000",
};

function b64url(buf) {
  let s = ""; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function hex(buf) { return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let r = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
async function pbkdf2Hex(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return hex(bits);
}
function getCookie(req, name) {
  const h = req.headers.get("Cookie") || "";
  for (const part of h.split(/;\s*/)) { const i = part.indexOf("="); if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1); }
  return null;
}
async function makeSession(env, user) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = encodeURIComponent(user) + "." + exp;
  return payload + "." + (await hmac(env.SESSION_SECRET, payload));
}
async function authed(req, env) {
  if (!env.SESSION_SECRET) return false;
  const c = getCookie(req, COOKIE);
  if (!c) return false;
  const parts = c.split(".");
  if (parts.length !== 3) return false;
  const [u, exp, sig] = parts;
  if (!(Number(exp) > Date.now() / 1000)) return false;
  return safeEq(sig, await hmac(env.SESSION_SECRET, u + "." + exp));
}
function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...SEC, ...extra } });
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function loginPage(error, user) {
  return `<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>登录 · 工作室 · 总部大楼</title><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#0b1120"><link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC","Noto Sans CJK SC",system-ui,sans-serif;color:#e8edf5;background:radial-gradient(1000px 520px at 15% -10%,#1a2a48 0%,#0b1120 60%);display:grid;place-items:center;padding:24px}
.wrap{width:100%;max-width:400px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:22px;justify-content:center}
.logo{width:40px;height:40px}
h1{margin:0;font-size:24px;letter-spacing:.04em}
.card{background:rgba(18,27,46,.92);border:1px solid #1f2a40;border-radius:16px;padding:28px 26px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
.sub{margin:0 0 20px;color:#9aa6ba;font-size:13px;text-align:center}
label{display:block;font-size:12px;color:#9aa6ba;margin:14px 0 6px}
input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid #2a3852;background:#0f1728;color:#e8edf5;font-size:15px;outline:none;transition:border-color .15s,box-shadow .15s}
input:focus{border-color:#5cc8ff;box-shadow:0 0 0 3px rgba(92,200,255,.18)}
button{margin-top:22px;width:100%;padding:12px;border:0;border-radius:10px;font-size:15px;font-weight:600;color:#0b1120;background:linear-gradient(135deg,#5cc8ff,#3ecf8e);cursor:pointer}
button:hover{filter:brightness(1.06)}
.err{margin-top:14px;padding:9px 12px;border-radius:9px;background:rgba(239,95,95,.12);border:1px solid rgba(239,95,95,.35);color:#ff9b9b;font-size:13px}
.foot{margin-top:18px;text-align:center;color:#6b7891;font-size:12px}
</style></head><body><div class="wrap">
<div class="brand"><svg class="logo" viewBox="0 0 64 64"><polygon points="32,6 58,19 32,32 6,19" fill="#d4a06a"/><polygon points="6,19 32,32 32,58 6,45" fill="#efe9de"/><polygon points="58,19 32,32 32,58 58,45" fill="#c9c1b1"/><rect x="26" y="12" width="12" height="10" rx="2" fill="#5cc8ff"/></svg><h1>工作室 · 总部大楼</h1></div>
<form class="card" method="post" action="/login" autocomplete="on">
<p class="sub">请登录后查看各部门成员的实时状态</p>
<label for="u">账号</label><input id="u" name="username" autocomplete="username" required value="${esc(user || "")}" autofocus>
<label for="p">密码</label><input id="p" name="password" type="password" autocomplete="current-password" required>
${error ? `<div class="err">${esc(error)}</div>` : ""}
<button type="submit">登 录</button>
</form><div class="foot">登录状态保持 30 天</div></div></body></html>`;
}
function html(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...SEC, ...extra } });
}

function validateStatus(data) {
  const bots = Array.isArray(data) ? data : data && data.bots;
  if (!Array.isArray(bots) || bots.length === 0 || bots.length > 200) return "bots must be a non-empty array";
  for (const b of bots) {
    if (!b || typeof b.id !== "string" || !b.id) return "each bot needs a string id";
    if (!STATES.has(b.state)) return `bot ${b.id}: state must be working|idle|paused`;
    if (b.summary != null && typeof b.summary !== "string") return `bot ${b.id}: summary must be a string`;
    if (b.lastActive != null && b.lastActive !== "" && isNaN(Date.parse(b.lastActive))) return `bot ${b.id}: lastActive must be ISO 8601`;
    if (b.messages != null) {
      if (!Array.isArray(b.messages) || b.messages.length > 10) return `bot ${b.id}: messages must be an array (max 10)`;
      for (const m of b.messages) if (!m || typeof m.text !== "string" || m.text.length > 4000 || (m.at != null && typeof m.at !== "string")) return `bot ${b.id}: each message needs text (string ≤ 4000) and optional at`;
    }
    if (b.dashboard != null) {
      if (typeof b.dashboard !== "object" || Array.isArray(b.dashboard)) return `bot ${b.id}: dashboard must be an object`;
      if (JSON.stringify(b.dashboard).length > 60000) return `bot ${b.id}: dashboard too large`;
    }
  }
  return null;
}


function clipStr(v, n) {
  if (typeof v !== "string") return "";
  return v.length > n ? v.slice(0, n) : v;
}
function sanitizeUsage(u) {
  if (!u || typeof u !== "object" || Array.isArray(u)) return null;
  const out = {};
  if (typeof u.plan === "string") out.plan = clipStr(u.plan, 200);
  if (typeof u.percentUsed === "number" && Number.isFinite(u.percentUsed)) out.percentUsed = u.percentUsed;
  if (typeof u.usedLabel === "string") out.usedLabel = clipStr(u.usedLabel, 200);
  if (typeof u.limitKind === "string") out.limitKind = clipStr(u.limitKind, 200);
  if (typeof u.sharedWithOtherApps === "boolean") out.sharedWithOtherApps = u.sharedWithOtherApps;
  if (typeof u.resetsAt === "string") out.resetsAt = clipStr(u.resetsAt, 200);
  if (typeof u.resetsLabel === "string") out.resetsLabel = clipStr(u.resetsLabel, 200);
  if (typeof u.hasExtraCredits === "boolean") out.hasExtraCredits = u.hasExtraCredits;
  if (typeof u.fetchedAt === "string") out.fetchedAt = clipStr(u.fetchedAt, 200);
  if (typeof u.sourceNote === "string") out.sourceNote = clipStr(u.sourceNote, 200);
  return Object.keys(out).length ? out : null;
}
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
}
const FALLBACK_BOT_IDS = [
  "b72f5af7-af35-4be4-99e5-26e63c5fd282",
  "b0b237f9-1bf0-4351-99e8-7cb08e7280e9",
  "0f6b9c8c-b593-4aab-8952-70085ca38248",
  "eef4929f-3af1-4a90-b1a1-134eb093ff7e",
  "2d65bcdb-02a1-4079-96bb-d60864f5d3b1",
  "dec85747-0ea6-4655-93d2-9a5e0b2e6b10",
  "c78a06c8-3b83-4670-b132-1b2090f71185",
  "64bc81fe-462b-4a7a-ae86-96e2bf3fbb63",
  "7f2dd154-d1ac-4a87-a470-4896e3d882b2",
  "6fcbf63d-f5ef-48f7-b00c-275be133637f",
  "463c6096-1807-47de-ab54-bed0b8fab06a",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path.startsWith("/.well-known/")) {
      try { if (env.ASSETS) return await env.ASSETS.fetch(request); } catch (e) {}
      return new Response("Not found", { status: 404 });
    }
    if (path === "/favicon.svg" || path === "/favicon.ico") {
      return new Response(FAVICON, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400", ...SEC } });
    }
    if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });

    if (path === "/login") {
      if (method === "POST") {
        let user = "", pass = "";
        try { const f = await request.formData(); user = String(f.get("username") || "").trim(); pass = String(f.get("password") || ""); } catch (e) {}
        let ok = false;
        if (env.ADMIN_USER && env.ADMIN_PASS_HASH && env.ADMIN_PASS_SALT && env.SESSION_SECRET && user && pass && pass.length < 256) {
          const h = await pbkdf2Hex(pass, env.ADMIN_PASS_SALT);
          ok = safeEq(user, env.ADMIN_USER) & safeEq(h, env.ADMIN_PASS_HASH) ? true : false;
        }
        if (!ok) { await new Promise((r) => setTimeout(r, 600)); return html(loginPage("账号或密码不正确", user), 401); }
        return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": cookieHeader(await makeSession(env, user), MAX_AGE), "cache-control": "no-store", ...SEC } });
      }
      if (await authed(request, env)) return new Response(null, { status: 302, headers: { Location: "/" } });
      return html(loginPage("", ""));
    }
    if (path === "/logout") {
      return new Response(null, { status: 303, headers: { Location: "/login", "Set-Cookie": cookieHeader("", 0), "cache-control": "no-store", ...SEC } });
    }

    if (path === "/api/status") {
      if (method === "POST") {
        const auth = request.headers.get("Authorization") || "";
        const tok = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (!env.UPDATE_TOKEN || !safeEq(tok, env.UPDATE_TOKEN)) return json({ error: "unauthorized" }, 401);
        const len = Number(request.headers.get("content-length") || "0");
        if (len > 262144) return json({ error: "payload too large" }, 413);
        let data;
        try { data = JSON.parse(await request.text()); } catch (e) { return json({ error: "invalid JSON" }, 400); }
        const err = validateStatus(data);
        if (err) return json({ error: err }, 400);
        const now = new Date().toISOString();
        const bots = (Array.isArray(data) ? data : data.bots).map((b) => ({
          id: b.id, name: b.name || "", dept: b.dept || "", role: b.role || "", state: b.state,
          summary: b.summary || "", lastActive: b.lastActive || "", updatedAt: b.updatedAt || now,
          ...(b.messages ? { messages: b.messages.map((m) => ({ at: m.at || "", text: m.text })) } : {}),
          ...(b.dashboard ? { dashboard: b.dashboard } : {}),
        }));
        let prevUsage = null;
        try {
          const prevRaw = env.STATUS ? await env.STATUS.get("status") : null;
          if (prevRaw) {
            const prev = JSON.parse(prevRaw);
            if (prev && prev.usage) prevUsage = sanitizeUsage(prev.usage);
          }
        } catch (e) {}
        const incomingUsage = (!Array.isArray(data) && data && Object.prototype.hasOwnProperty.call(data, "usage"))
          ? sanitizeUsage(data.usage)
          : undefined;
        const doc = { updatedAt: (data && data.updatedAt) || now, receivedAt: now, bots };
        if (incomingUsage) doc.usage = incomingUsage;
        else if (incomingUsage === null) { /* explicit null -> drop */ }
        else if (prevUsage) doc.usage = prevUsage;
        await env.STATUS.put("status", JSON.stringify(doc));
        return json({ ok: true, count: bots.length, receivedAt: now });
      }
      if (method === "GET") {
        if (!(await authed(request, env))) return json({ error: "unauthorized" }, 401);
        const [raw, rawDash, rawCmd] = env.STATUS
          ? await Promise.all([env.STATUS.get("status"), env.STATUS.get("dashboards"), env.STATUS.get("commands")])
          : [null, null, null];
        if (!raw && !rawDash) return json({ updatedAt: null, bots: [], outbox: [] });
        let doc = { updatedAt: null, bots: [] };
        try { if (raw) doc = JSON.parse(raw); } catch (e) {}
        // KV "dashboards" is written every 10 min by the optional dashboard-cron Worker; per bot, the newer fetchedAt wins
        // over the twice-daily copy inside "status".
        try {
          const dash = rawDash ? JSON.parse(rawDash) : null;
          if (dash && dash.bots && Array.isArray(doc.bots)) {
            doc.dashboardsFetchedAt = dash.fetchedAt || null;
            const t = (x) => { const n = Date.parse((x && x.fetchedAt) || ""); return isNaN(n) ? -1 : n; };
            doc.bots = doc.bots.map((b) => {
              const c = dash.bots[b.id];
              if (!c || typeof c !== "object") return b;
              if (b.dashboard && (c.neverOk || t(b.dashboard) > t(c))) return b; // cron never reached it -> keep the snapshot
              const { neverOk, ...cd } = c;
              return { ...b, dashboard: { ...cd, auto: true } };
            });
          }
        } catch (e) {}
        try {
          const cmds = rawCmd ? JSON.parse(rawCmd) : null;
          doc.outbox = Array.isArray(cmds) ? cmds.slice(-40) : [];
        } catch (e) { doc.outbox = []; }
        return new Response(JSON.stringify(doc), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...SEC } });
      }
      return json({ error: "method not allowed" }, 405);
    }

    if (path === "/api/command") {
      if (method !== "POST") return json({ error: "method not allowed" }, 405);
      if (!(await authed(request, env))) return json({ error: "unauthorized" }, 401);
      const len = Number(request.headers.get("content-length") || "0");
      if (len > 16384) return json({ error: "payload too large" }, 413);
      let body;
      try { body = JSON.parse(await request.text()); } catch (e) { return json({ error: "invalid JSON" }, 400); }
      const botId = body && typeof body.botId === "string" ? body.botId.trim() : "";
      const textIn = body && typeof body.text === "string" ? body.text.trim() : "";
      if (!botId || !textIn) return json({ error: "botId and text required" }, 400);
      if (textIn.length < 1 || textIn.length > 4000) return json({ error: "text must be 1–4000 chars" }, 400);
      let known = FALLBACK_BOT_IDS.slice();
      let botName = "";
      try {
        const raw = env.STATUS ? await env.STATUS.get("status") : null;
        if (raw) {
          const doc = JSON.parse(raw);
          if (doc && Array.isArray(doc.bots) && doc.bots.length) {
            known = doc.bots.map((b) => b && b.id).filter(Boolean);
            const hit = doc.bots.find((b) => b && b.id === botId);
            if (hit && hit.name) botName = String(hit.name);
          }
        }
      } catch (e) {}
      if (!known.includes(botId)) return json({ error: "unknown botId" }, 400);
      let cmds = [];
      try {
        const rawCmd = env.STATUS ? await env.STATUS.get("commands") : null;
        if (rawCmd) { const parsed = JSON.parse(rawCmd); if (Array.isArray(parsed)) cmds = parsed; }
      } catch (e) {}
      const minuteAgo = Date.now() - 60_000;
      const recent = cmds.filter((c) => c && Date.parse(c.at || "") >= minuteAgo);
      if (recent.length >= 30) return json({ error: "rate limited" }, 429);
      const item = {
        id: uuid(),
        botId,
        botName: botName || "",
        text: textIn,
        at: new Date().toISOString(),
        status: "queued",
      };
      let forwarded = false;
      if (env.COMMAND_WEBHOOK_URL) {
        try {
          const headers = { "content-type": "application/json" };
          if (env.COMMAND_WEBHOOK_KEY) {
            headers["Authorization"] = "Bearer " + env.COMMAND_WEBHOOK_KEY;
            headers["X-Webhook-Key"] = env.COMMAND_WEBHOOK_KEY;
          }
          const wr = await fetch(env.COMMAND_WEBHOOK_URL, { method: "POST", headers, body: JSON.stringify(item) });
          if (wr.ok) { item.status = "notified"; forwarded = true; }
          else { item.status = "failed"; item.error = "webhook HTTP " + wr.status; }
        } catch (e) {
          item.status = "failed";
          item.error = "webhook unreachable";
        }
      }
      cmds.push(item);
      if (cmds.length > 100) cmds = cmds.slice(-100);
      if (env.STATUS) await env.STATUS.put("commands", JSON.stringify(cmds));
      return json({ ok: true, id: item.id, forwarded });
    }

    const ok = await authed(request, env);
    if (path === "/" || path === "/index.html") {
      if (!ok) return html(loginPage("", ""));
      return html(APP_HTML);
    }
    if (!ok) return new Response(null, { status: 302, headers: { Location: "/login" } });
    try { if (env.ASSETS) return await env.ASSETS.fetch(request); } catch (e) {}
    return new Response("Not found", { status: 404 });
  },
};
