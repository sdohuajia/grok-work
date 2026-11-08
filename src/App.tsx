import { Page, Segmented, Metrics, Properties, Status, Button, useGrokTheme, useState, useEffect, useRef, useMemo } from "./kit";
import type { ReactNode, CSSProperties } from "./kit";
import SNAPSHOT from "../status.json";
import { MessageList, DashboardView, type Msg, type Dash } from "./detail";
import { SYNC, statusSyncTooltip, dashboardSyncTooltip } from "./syncConfig";

type UsageInfo = {
  plan?: string; percentUsed?: number; usedLabel?: string; limitKind?: string;
  sharedWithOtherApps?: boolean; resetsAt?: string; resetsLabel?: string;
  hasExtraCredits?: boolean; fetchedAt?: string; sourceNote?: string;
};
type OutCmd = { id: string; botId: string; botName?: string; text: string; at: string; status: string; error?: string };

function usageBarColor(pct?: number): string {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return "#5cc8ff";
  if (pct >= 100) return "#ff6b6b";
  if (pct >= 80) return "#f5a524";
  return "#5cc8ff";
}
function usageTitle(u: UsageInfo): string {
  const parts: string[] = [];
  if (u.plan) parts.push("套餐：" + u.plan);
  parts.push("每周用量额度");
  if (u.sharedWithOtherApps) parts.push("与同计划其它应用共享");
  if (u.hasExtraCredits) parts.push("另有额外用量积分");
  if (u.resetsLabel) parts.push("重置：" + u.resetsLabel + "（北京时间）");
  return parts.join(" · ");
}

type St = "working" | "idle" | "paused";
type DeptId = "ceo" | "intel" | "trade" | "dev" | "pantry" | "content" | "archive" | "mine" | "lobby" | "meet";

interface Room { id: DeptId; name: string; x: number; y: number; w: number; h: number; floor: string; accent: string }
interface Person {
  id: string; name: string; dept: DeptId; role: string; tag: string; status: St; task: string; updated: string;
  dx: number; dy: number; dw?: number; shirt: string; hair: string;
  messages?: Msg[]; dashboard?: Dash;
}

/* ---------------- data (statuses from each bot's latest reply) ---------------- */
const ROOMS: Room[] = [
  { id: "ceo", name: "总经办", x: 0, y: 0, w: 6, h: 6, floor: "wood", accent: "#f5b942" },
  { id: "intel", name: "情报部", x: 6, y: 0, w: 7, h: 6, floor: "carpet", accent: "#5cc8ff" },
  { id: "trade", name: "交易部", x: 13, y: 0, w: 11, h: 6, floor: "wood", accent: "#3ecf8e" },
  { id: "dev", name: "自动化 · 研发部", x: 0, y: 6, w: 9, h: 6, floor: "carpetBlue", accent: "#a78bfa" },
  { id: "pantry", name: "茶水 · 休息区", x: 9, y: 6, w: 5, h: 6, floor: "tile", accent: "#9aa4b2" },
  { id: "content", name: "内容 · 社区部", x: 14, y: 6, w: 10, h: 6, floor: "woodLight", accent: "#ff8fab" },
  { id: "archive", name: "档案室", x: 0, y: 12, w: 5, h: 6, floor: "tileGrey", accent: "#9aa4b2" },
  { id: "mine", name: "矿场", x: 5, y: 12, w: 6, h: 6, floor: "concrete", accent: "#f59e0b" },
  { id: "lobby", name: "前台 · 接待", x: 11, y: 12, w: 5, h: 6, floor: "wood", accent: "#9aa4b2" },
  { id: "meet", name: "会议室", x: 16, y: 12, w: 8, h: 6, floor: "carpet", accent: "#9aa4b2" },
];

const PEOPLE: Person[] = [
  { id: "b72f5af7-af35-4be4-99e5-26e63c5fd282", name: "工作室", dept: "ceo", role: "总经理 · CEO", tag: "CEO", status: "working", task: "维护总部大楼网站与成员状态（示例；同步时刻见 sync/config.json）", updated: "11月7日 12:00", dx: 2.1, dy: 2.6, dw: 1.8, shirt: "#2f3a56", hair: "#2b1d14" },
  { id: "b0b237f9-1bf0-4351-99e8-7cb08e7280e9", name: "空投消息助手", dept: "intel", role: "情报员 · 推特一手消息", tag: "情报员", status: "working", task: "整理今日情报简报（示例）", updated: "11月7日 09:00", dx: 7.4, dy: 2.6, shirt: "#3b82f6", hair: "#1f2937" },
  { id: "0f6b9c8c-b593-4aab-8952-70085ca38248", name: "查询", dept: "intel", role: "数据查询员", tag: "查询员", status: "idle", task: "整理示例数据表，待命中", updated: "", dx: 10.4, dy: 2.6, shirt: "#14b8a6", hair: "#6b3e26" },
  { id: "eef4929f-3af1-4a90-b1a1-134eb093ff7e", name: "交易大神", dept: "trade", role: "首席交易员", tag: "首席交易", status: "idle", task: "监控套利脚本（示例）", updated: "", dx: 14.6, dy: 2.6, shirt: "#1f2937", hair: "#d4a017" },
  { id: "2d65bcdb-02a1-4079-96bb-d60864f5d3b1", name: "币安AI agent", dept: "trade", role: "交易员 · 链上卖出", tag: "交易员", status: "idle", task: "盯盘与链上交易示例任务已完成", updated: "", dx: 17.6, dy: 2.6, shirt: "#ef4444", hair: "#111111" },
  { id: "dec85747-0ea6-4655-93d2-9a5e0b2e6b10", name: "脚本检查执行", dept: "dev", role: "脚本工程师", tag: "脚本工程师", status: "idle", task: "检查脚本参数与面板连通性（示例）", updated: "", dx: 1.2, dy: 7.9, shirt: "#8b5cf6", hair: "#222222" },
  { id: "c78a06c8-3b83-4670-b132-1b2090f71185", name: "popdex自动化", dept: "dev", role: "自动化工程师 · PopDEX", tag: "巡检工程师", status: "working", task: "PopDEX 站点巡检中（示例）", updated: "11月7日 11:50", dx: 4.4, dy: 7.9, shirt: "#22c55e", hair: "#5a3825" },
  { id: "64bc81fe-462b-4a7a-ae86-96e2bf3fbb63", name: "Entropy套利", dept: "dev", role: "套利工程师", tag: "套利", status: "working", task: "监控跨场所套利脚本（示例）", updated: "11月7日 11:50", dx: 1.2, dy: 10.3, shirt: "#06b6d4", hair: "#1b1b1b" },
  { id: "7f2dd154-d1ac-4a87-a470-4896e3d882b2", name: "服务器维护", dept: "dev", role: "运维工程师 · 服务器安全", tag: "运维", status: "idle", task: "巡检服务器安全与系统更新（示例）", updated: "", dx: 4.4, dy: 10.3, shirt: "#0ea5e9", hair: "#3b2a1a" },
  { id: "6fcbf63d-f5ef-48f7-b00c-275be133637f", name: "挖矿", dept: "mine", role: "矿工", tag: "矿工", status: "paused", task: "挖矿任务已暂停（示例）", updated: "", dx: 6.0, dy: 15.6, shirt: "#a16207", hair: "#2a2a2a" },
  { id: "463c6096-1807-47de-ab54-bed0b8fab06a", name: "写作", dept: "content", role: "内容策划", tag: "内容策划", status: "idle", task: "准备下一期内容文案（示例）", updated: "", dx: 15.6, dy: 8.3, shirt: "#ec4899", hair: "#c2410c" },
];

/* embedded snapshot (same format as /api/status) merged over the defaults */
(function applySnapshot() {
  const bots = (SNAPSHOT as unknown as { bots: { id: string; state: string; summary: string; lastActive: string; messages?: Msg[]; dashboard?: Dash }[] }).bots;
  bots.forEach((b) => {
    const p = PEOPLE.find((q) => q.id === b.id);
    if (!p) return;
    if (b.state === "working" || b.state === "idle" || b.state === "paused") p.status = b.state;
    if (b.summary) p.task = b.summary;
    if (b.lastActive) p.updated = fmtCN(b.lastActive);
    if (Array.isArray(b.messages)) p.messages = b.messages;
    if (b.dashboard && typeof b.dashboard === "object") p.dashboard = b.dashboard;
  });
})();

const ST_LABEL: Record<St, string> = { working: "运行中", idle: "待命", paused: "暂停" };
const ST_DOT: Record<St, string> = { working: "#3ecf8e", idle: "#a3acb9", paused: "#f5a524" };
const FOCUS_DEPTS: DeptId[] = ["ceo", "intel", "trade", "dev", "content", "mine"];

/* ---------------- iso helpers ---------------- */
const HX = 32, HY = 16;
function iso(x: number, y: number, z = 0): [number, number] { return [(x - y) * HX, (x + y) * HY - z]; }
function pt(x: number, y: number, z = 0): string { const p = iso(x, y, z); return p[0].toFixed(1) + "," + p[1].toFixed(1); }
function poly(ps: number[][]): string { return ps.map((p) => pt(p[0], p[1], p[2] || 0)).join(" "); }
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return "rgb(" + c((n >> 16) & 255) + "," + c((n >> 8) & 255) + "," + c(n & 255) + ")";
}
const EDGE = "rgba(0,0,0,0.14)";
function box(k: string, x: number, y: number, z: number, w: number, d: number, h: number, c: string, op = 1): ReactNode {
  return (
    <g key={k} opacity={op}>
      <polygon points={poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])} fill={shade(c, 0.86)} stroke={EDGE} strokeWidth={0.5} />
      <polygon points={poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])} fill={shade(c, 0.7)} stroke={EDGE} strokeWidth={0.5} />
      <polygon points={poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])} fill={shade(c, 1.06)} stroke={EDGE} strokeWidth={0.5} />
    </g>
  );
}
function faceY(k: string, x1: number, x2: number, y: number, z1: number, z2: number, fill: string, op = 1): ReactNode {
  return <polygon key={k} points={poly([[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]])} fill={fill} opacity={op} />;
}
function faceX(k: string, x: number, y1: number, y2: number, z1: number, z2: number, fill: string, op = 1): ReactNode {
  return <polygon key={k} points={poly([[x, y1, z1], [x, y2, z1], [x, y2, z2], [x, y1, z2]])} fill={fill} opacity={op} />;
}
function textW(s: string): number { let w = 0; for (const ch of s) w += ch.charCodeAt(0) > 0x2e80 ? 11.2 : 6.3; return w; }

function plant(k: string, x: number, y: number): ReactNode {
  return (
    <g key={k}>
      {box(k + "p", x - 0.14, y - 0.14, 0, 0.28, 0.28, 9, "#d8cfbf")}
      {box(k + "a", x - 0.22, y - 0.22, 9, 0.44, 0.44, 10, "#3f8f52")}
      {box(k + "b", x - 0.15, y - 0.15, 19, 0.3, 0.3, 9, "#58ad68")}
      {box(k + "c", x - 0.07, y - 0.07, 28, 0.14, 0.14, 6, "#6cc27b")}
    </g>
  );
}
function sofa(k: string, x: number, y: number, w: number, c: string): ReactNode {
  return (
    <g key={k}>
      {box(k + "b", x, y, 0, w, 0.18, 19, c)}
      {box(k + "s", x, y + 0.18, 0, w, 0.5, 8, c)}
      {box(k + "l", x, y + 0.18, 0, 0.14, 0.5, 13, c)}
      {box(k + "r", x + w - 0.14, y + 0.18, 0, 0.14, 0.5, 13, c)}
    </g>
  );
}
const BOOKS = ["#c0392b", "#2e86de", "#f1c40f", "#27ae60", "#8e44ad", "#e67e22", "#ecf0f1"];
function shelf(k: string, x: number, y: number, w: number, h: number, c = "#6b4a2f"): ReactNode {
  const books: ReactNode[] = [];
  const rows = Math.floor(h / 12);
  for (let r = 0; r < rows; r++) {
    const n = Math.floor((w - 0.1) / 0.15);
    for (let i = 0; i < n; i++) {
      if ((i * 7 + r * 3) % 9 === 0) continue;
      const bx = x + 0.07 + i * 0.15;
      books.push(faceY(k + "bk" + r + "-" + i, bx, bx + 0.11, y + 0.36, 3 + r * 12, 3 + r * 12 + 7 + ((i + r) % 3), BOOKS[(i * 3 + r) % BOOKS.length]));
    }
  }
  return <g key={k}>{box(k + "f", x, y, 0, w, 0.36, h, c)}{books}</g>;
}

function floorColor(f: string): string {
  switch (f) {
    case "wood": return "#c68a52";
    case "woodLight": return "#d4a06a";
    case "carpet": return "#737d8b";
    case "carpetBlue": return "#5a6880";
    case "tile": return "#e9e2d4";
    case "tileGrey": return "#cfc9bd";
    default: return "#8d9299";
  }
}

/* ---------------- character ---------------- */
function charParts(p: Person, cx: number, cy: number): { chair: ReactNode; body: ReactNode } {
  const k = "c" + p.id;
  const paused = p.status === "paused";
  const hz = paused ? 21 : 24;
  const fy = cy + 0.18;
  const e1 = iso(cx - 0.09, fy, hz + 7), e2 = iso(cx + 0.09, fy, hz + 7);
  const b1 = iso(cx - 0.15, fy, hz + 4), b2 = iso(cx + 0.15, fy, hz + 4);
  const chair = (
    <g key={k + "ch"}>
      {box(k + "cb", cx - 0.24, cy - 0.3, 6, 0.48, 0.08, 22, "#3a3f4b")}
      {box(k + "cs", cx - 0.22, cy - 0.22, 0, 0.44, 0.42, 9, "#454b58")}
    </g>
  );
  const body = (
    <g key={k + "bd"}>
      {box(k + "t", cx - 0.17, cy - 0.13, 9, 0.34, 0.26, 15, p.shirt)}
      {box(k + "al", cx - 0.25, cy - 0.06, 13, 0.08, 0.3, 9, p.shirt)}
      {box(k + "ar", cx + 0.17, cy - 0.06, 13, 0.08, 0.3, 9, p.shirt)}
      {box(k + "hb", cx - 0.21, cy - 0.2, hz + 2, 0.42, 0.1, 12, p.hair)}
      {box(k + "h", cx - 0.2, cy - 0.18, hz, 0.4, 0.36, 14, "#f2c9a0")}
      {box(k + "hr", cx - 0.215, cy - 0.195, hz + 12, 0.43, 0.39, 5, p.hair)}
      {box(k + "fr", cx - 0.215, cy + 0.12, hz + 9, 0.43, 0.075, 3, p.hair)}
      {paused ? (
        <g>
          <line x1={e1[0] - 2} y1={e1[1]} x2={e1[0] + 2} y2={e1[1] - 1} stroke="#2a1e18" strokeWidth={1.1} strokeLinecap="round" />
          <line x1={e2[0] - 2} y1={e2[1]} x2={e2[0] + 2} y2={e2[1] - 1} stroke="#2a1e18" strokeWidth={1.1} strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <ellipse cx={e1[0]} cy={e1[1]} rx={1.4} ry={1.8} fill="#2a1e18" />
          <ellipse cx={e2[0]} cy={e2[1]} rx={1.4} ry={1.8} fill="#2a1e18" />
        </g>
      )}
      <ellipse cx={b1[0]} cy={b1[1]} rx={1.8} ry={1} fill="#ff8a8a" opacity={0.55} />
      <ellipse cx={b2[0]} cy={b2[1]} rx={1.8} ry={1} fill="#ff8a8a" opacity={0.55} />
    </g>
  );
  return { chair, body };
}
function seat(p: Person): [number, number] { return [p.dx + 0.5, p.dy - 0.42]; }
function monitorPos(p: Person): [number, number] { const w = p.dw || 1.4; return [p.dx + w - 0.36, p.dy + 0.18]; }

/* ---------------- viewBox ---------------- */
const FULL: number[] = [-600, -80, 1390, 785];
const ASPECT = FULL[2] / FULL[3];
function roomVB(id: string): number[] {
  const r = ROOMS.find((q) => q.id === id);
  if (!r) return FULL;
  const L = iso(r.x, r.y + r.h)[0] - 50, R = iso(r.x + r.w, r.y)[0] + 50;
  const T = iso(r.x, r.y, 80)[1] - 20, B = iso(r.x + r.w, r.y + r.h)[1] + 30;
  let w = R - L, h = B - T, x = L, y = T;
  if (w / h < ASPECT) { const nw = h * ASPECT; x -= (nw - w) / 2; w = nw; } else { const nh = w / ASPECT; y -= (nh - h) / 2; h = nh; }
  return [x, y, w, h];
}
function silhouette(r: Room, h: number): string {
  return "M" + [pt(r.x, r.y, h), pt(r.x + r.w, r.y, h), pt(r.x + r.w, r.y, 0), pt(r.x + r.w, r.y + r.h, 0), pt(r.x, r.y + r.h, 0), pt(r.x, r.y + r.h, h)].join(" L") + " Z";
}

/* ---------------- scene ---------------- */
interface Refs { chars: Map<string, SVGGElement>; screens: Map<string, SVGPolygonElement>; leds: { el: SVGElement; ph: number }[] }

function buildScene(night: boolean, refs: Refs, people: Person[]): { back: ReactNode[]; floor: ReactNode[]; sorted: ReactNode[]; depths: number[] } {
  refs.leds = [];
  const back: ReactNode[] = [];
  const floor: ReactNode[] = [];
  const items: { d: number; el: ReactNode }[] = [];
  const add = (d: number, el: ReactNode) => items.push({ d, el });
  const WALL = "#efe9de";
  const glass = night ? "#1b2a4a" : "#9fcdea";
  const glassHi = night ? "#2c4170" : "#cfe8f7";

  /* slab + shadow */
  back.push(<ellipse key="shadow" cx={iso(12, 9)[0]} cy={iso(12, 9)[1] + 40} rx={760} ry={330} fill="#000" opacity={0.22} />);
  back.push(box("slab", -0.25, -0.25, -18, 24.5, 18.5, 18, "#4a4038"));

  /* back outer walls with windows */
  const screensX: number[][] = [[7.6, 11.4], [14.7, 18.3], [19.1, 22.7]];
  const onScreen = (i: number) => screensX.some((s) => i + 0.5 > s[0] && i + 0.5 < s[1]);
  for (let i = 0; i < 24; i++) {
    back.push(box("wy" + i, i, -0.18, 0, 1, 0.18, 58, WALL));
    if (!onScreen(i) && i !== 6 && i !== 13) {
      back.push(faceY("wyg" + i, i + 0.14, i + 0.86, 0, 20, 50, glass));
      back.push(faceY("wyh" + i, i + 0.14, i + 0.34, 0, 20, 50, glassHi, 0.6));
    }
  }
  for (let j = 0; j < 18; j++) {
    back.push(box("wx" + j, -0.18, j, 0, 0.18, 1, 58, WALL));
    if (j !== 6 && j !== 12) {
      back.push(faceX("wxg" + j, 0, j + 0.14, j + 0.86, 20, 50, glass));
      back.push(faceX("wxh" + j, 0, j + 0.14, j + 0.34, 20, 50, glassHi, 0.6));
    }
  }
  back.push(box("wc", -0.18, -0.18, 0, 0.18, 0.18, 58, WALL));

  /* wall screens: intel map + trading charts */
  back.push(faceY("isf", 7.6, 11.4, 0, 16, 52, "#1d2433"));
  back.push(faceY("iss", 7.75, 11.25, 0, 19, 49, night ? "#10305a" : "#14365e"));
  for (let i = 0; i < 26; i++) {
    const x = 7.9 + ((i * 37) % 31) / 10, z = 22 + ((i * 53) % 25);
    const p = iso(x, 0, z);
    const hot = i % 5 === 0;
    back.push(<circle key={"imd" + i} cx={p[0]} cy={p[1]} r={hot ? 2.4 : 1.2} fill={hot ? "#5cc8ff" : "#6aa7d8"} opacity={hot ? 1 : 0.6} />);
  }
  const ip1 = iso(8.6, 0, 40), ip2 = iso(10.4, 0, 28);
  back.push(<line key="iln" x1={ip1[0]} y1={ip1[1]} x2={ip2[0]} y2={ip2[1]} stroke="#5cc8ff" strokeWidth={1} strokeDasharray="3 2" />);
  [[14.7, 18.3], [19.1, 22.7]].forEach((s, si) => {
    back.push(faceY("tsf" + si, s[0], s[1], 0, 16, 52, "#1d2433"));
    back.push(faceY("tss" + si, s[0] + 0.12, s[1] - 0.12, 0, 19, 49, "#0f1a14"));
    const n = 14;
    const line: string[] = [];
    for (let c = 0; c < n; c++) {
      const x = s[0] + 0.25 + c * ((s[1] - s[0] - 0.5) / n);
      const mid = 30 + Math.sin(c * 0.9 + si * 2) * 7 + c * 0.5;
      const up = (c + si) % 3 !== 0;
      const col = up ? "#3ecf8e" : "#ef5f5f";
      back.push(faceY("cd" + si + "-" + c, x, x + 0.12, 0, mid - 4, mid + 4, col));
      const wp = iso(x + 0.06, 0, mid + 7);
      const wq = iso(x + 0.06, 0, mid - 7);
      back.push(<line key={"cw" + si + "-" + c} x1={wp[0]} y1={wp[1]} x2={wq[0]} y2={wq[1]} stroke={col} strokeWidth={0.8} />);
      line.push(pt(x + 0.06, 0, mid + 10));
    }
    back.push(<polyline key={"tl" + si} points={line.join(" ")} fill="none" stroke="#f5b942" strokeWidth={1} opacity={0.9} />);
  });

  /* floors */
  ROOMS.forEach((r) => {
    const c = floorColor(r.floor);
    floor.push(<polygon key={"f" + r.id} points={poly([[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]])} fill={c} />);
    if (r.floor.indexOf("wood") === 0) {
      for (let yy = r.y + 0.34; yy < r.y + r.h; yy += 0.34) {
        floor.push(<polyline key={"pl" + r.id + yy.toFixed(2)} points={poly([[r.x, yy], [r.x + r.w, yy]])} stroke="#a66f3c" strokeWidth={0.6} opacity={0.55} />);
      }
      for (let yy = r.y; yy < r.y + r.h; yy += 0.34) {
        const off = ((Math.round(yy * 3) * 7) % 5) * 0.4;
        for (let xx = r.x + 0.4 + off; xx < r.x + r.w; xx += 2) {
          floor.push(<polyline key={"ps" + r.id + yy.toFixed(2) + "-" + xx.toFixed(1)} points={poly([[xx, yy], [xx, yy + 0.34]])} stroke="#a66f3c" strokeWidth={0.6} opacity={0.5} />);
        }
      }
    } else if (r.floor.indexOf("tile") === 0) {
      for (let i = 1; i < r.w * 2; i++) floor.push(<polyline key={"tx" + r.id + i} points={poly([[r.x + i / 2, r.y], [r.x + i / 2, r.y + r.h]])} stroke="#b9b09e" strokeWidth={0.5} opacity={0.6} />);
      for (let j = 1; j < r.h * 2; j++) floor.push(<polyline key={"ty" + r.id + j} points={poly([[r.x, r.y + j / 2], [r.x + r.w, r.y + j / 2]])} stroke="#b9b09e" strokeWidth={0.5} opacity={0.6} />);
    } else {
      for (let i = 1; i < r.w; i++) floor.push(<polyline key={"cx" + r.id + i} points={poly([[r.x + i, r.y], [r.x + i, r.y + r.h]])} stroke="#000" strokeWidth={0.5} opacity={0.08} />);
      for (let j = 1; j < r.h; j++) floor.push(<polyline key={"cy" + r.id + j} points={poly([[r.x, r.y + j], [r.x + r.w, r.y + j]])} stroke="#000" strokeWidth={0.5} opacity={0.08} />);
    }
  });
  /* rugs */
  floor.push(<polygon key="rug1" points={poly([[1.4, 1.5], [4.8, 1.5], [4.8, 4.2], [1.4, 4.2]])} fill="#8c3b3b" opacity={0.85} />);
  floor.push(<polygon key="rug1b" points={poly([[1.6, 1.7], [4.6, 1.7], [4.6, 4.0], [1.6, 4.0]])} fill="none" stroke="#e2b96f" strokeWidth={1} />);
  floor.push(<polygon key="rug2" points={poly([[20.8, 9.4], [23.4, 9.4], [23.4, 11.6], [20.8, 11.6]])} fill="#6b8f71" opacity={0.8} />);
  floor.push(<polygon key="rug3" points={poly([[11.6, 15.6], [15.4, 15.6], [15.4, 17.6], [11.6, 17.6]])} fill="#3b4a6b" opacity={0.75} />);

  /* internal walls */
  const H = 30;
  const hWalls: { y: number; x0: number; x1: number; gaps: number[]; glass?: number[] }[] = [
    { y: 6, x0: 0, x1: 24, gaps: [2, 10, 18] },
    { y: 12, x0: 0, x1: 24, gaps: [2, 7, 13, 19], glass: [16, 24] },
  ];
  hWalls.forEach((w) => {
    for (let i = w.x0; i < w.x1; i++) {
      if (w.gaps.indexOf(i) >= 0) continue;
      const isGlass = !!w.glass && i >= w.glass[0] && i < w.glass[1];
      add(i + 0.5 + w.y, isGlass
        ? <g key={"hw" + w.y + "-" + i}>{box("hwg" + w.y + i, i, w.y - 0.05, 0, 1, 0.1, H, "#bfe3f5", 0.38)}{box("hwt" + w.y + i, i, w.y - 0.06, H - 2, 1, 0.12, 2, "#8a96a3")}{box("hwb" + w.y + i, i, w.y - 0.06, 0, 1, 0.12, 3, "#8a96a3")}</g>
        : box("hw" + w.y + "-" + i, i, w.y - 0.08, 0, 1, 0.16, H, WALL));
    }
  });
  const vWalls: { x: number; y0: number; y1: number; gap: number; glass?: boolean }[] = [
    { x: 6, y0: 0, y1: 6, gap: 4 }, { x: 13, y0: 0, y1: 6, gap: 4 },
    { x: 9, y0: 6, y1: 12, gap: 9 }, { x: 14, y0: 6, y1: 12, gap: 9 },
    { x: 5, y0: 12, y1: 18, gap: 15 }, { x: 11, y0: 12, y1: 18, gap: 15 }, { x: 16, y0: 12, y1: 18, gap: 15, glass: true },
  ];
  vWalls.forEach((w) => {
    for (let j = w.y0; j < w.y1; j++) {
      if (j === w.gap) continue;
      add(w.x + j + 0.5, w.glass
        ? <g key={"vw" + w.x + "-" + j}>{box("vwg" + w.x + j, w.x - 0.05, j, 0, 0.1, 1, H, "#bfe3f5", 0.38)}{box("vwt" + w.x + j, w.x - 0.06, j, H - 2, 0.12, 1, 2, "#8a96a3")}{box("vwb" + w.x + j, w.x - 0.06, j, 0, 0.12, 1, 3, "#8a96a3")}</g>
        : box("vw" + w.x + "-" + j, w.x - 0.08, j, 0, 0.16, 1, H, WALL));
    }
  });
  /* front low walls */
  for (let i = 0; i < 24; i++) add(i + 18.6, box("fw" + i, i, 18, 0, 1, 0.16, 8, WALL));
  for (let j = 0; j < 18; j++) add(24.6 + j, box("rw" + j, 24, j, 0, 0.16, 1, 8, WALL));
  add(42.5, box("fwc", 24, 18, 0, 0.16, 0.16, 8, WALL));

  /* desks + people */
  people.forEach((p, idx) => {
    const w = p.dw || 1.4, d = p.dw ? 0.85 : 0.7;
    const ceo = p.dept === "ceo";
    const [mx, my] = monitorPos(p);
    const scr = p.status === "working" ? "#7fdcff" : p.status === "idle" ? "#4a6b8a" : "#1d232c";
    add(p.dx + w / 2 + p.dy + d / 2, (
      <g key={"desk" + p.id}>
        {box("dl" + p.id, p.dx + 0.05, p.dy + 0.05, 0, 0.1, d - 0.1, 12, "#3b3f47")}
        {box("dr" + p.id, p.dx + w - 0.15, p.dy + 0.05, 0, 0.1, d - 0.1, 12, "#3b3f47")}
        {box("dt" + p.id, p.dx, p.dy, 12, w, d, 3, ceo ? "#5b3a24" : "#a0693d")}
        {box("kb" + p.id, p.dx + 0.22, p.dy + 0.12, 15, 0.5, 0.18, 1, "#d7dbe0")}
        {box("mg" + p.id, p.dx + 0.1, p.dy + 0.45, 15, 0.12, 0.12, 4, BOOKS[idx % BOOKS.length])}
        {box("ms" + p.id, mx + 0.13, my + 0.02, 15, 0.08, 0.08, 4, "#2b2f36")}
        {box("mf" + p.id, mx - 0.05, my, 19, 0.44, 0.07, 15, "#22262d")}
        <polygon
          ref={(el) => { if (el) refs.screens.set(p.id, el); }}
          points={poly([[mx - 0.01, my + 0.07, 20.5], [mx + 0.35, my + 0.07, 20.5], [mx + 0.35, my + 0.07, 32.5], [mx - 0.01, my + 0.07, 32.5]])}
          fill={scr}
        />
        {p.status === "working" ? [0, 1, 2].map((l) => {
          const a = iso(mx + 0.04, my + 0.07, 29.5 - l * 3), b = iso(mx + 0.12 + ((l * 7 + idx) % 4) * 0.05, my + 0.07, 29.5 - l * 3);
          return <line key={"code" + l} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#0b3a52" strokeWidth={0.9} />;
        }) : null}
        {ceo ? box("lamp" + p.id, p.dx + 1.45, p.dy + 0.55, 15, 0.12, 0.12, 12, "#f5b942") : null}
      </g>
    ));
    const [cx, cy] = seat(p);
    const parts = charParts(p, cx, cy);
    add(cx + cy, <g key={"chair" + p.id}>{parts.chair}</g>);
  });

  /* ---- decor ---- */
  // CEO
  add(0.5 + 1.8, shelf("ceosh", 0.4, 0.15, 2.4, 40, "#5b3a24"));
  add(3.6 + 0.4, shelf("ceosh2", 3.1, 0.15, 1.6, 40, "#5b3a24"));
  add(3.8 + 4.6, sofa("ceosofa", 2.4, 4.3, 2.2, "#7a5c43"));
  add(5.4 + 0.6, plant("p1", 5.4, 0.6));
  add(0.6 + 5.4, plant("p2", 0.6, 5.4));
  // intel
  add(12.4 + 0.6, plant("p3", 12.4, 0.6));
  add(12.4 + 5.3, plant("p4", 12.4, 5.3));
  add(7 + 4.9, box("printer", 6.5, 4.6, 0, 0.7, 0.55, 14, "#d5d9df"));
  add(9.4 + 4.9, sofa("intelsofa", 8.6, 4.5, 1.8, "#3e5c7a"));
  // trade
  add(23.4 + 0.6, plant("p5", 23.4, 0.6));
  add(23.4 + 5.4, plant("p6", 23.4, 5.4));
  add(13.6 + 0.6, plant("p6b", 13.6, 0.6));
  add(17.5 + 4.9, box("tradeTable", 16.2, 4.4, 0, 2.6, 0.9, 12, "#e8e2d6"));
  // dev: server racks
  [6.5, 7.2, 7.9].forEach((yy, i) => {
    const leds: ReactNode[] = [];
    for (let l = 0; l < 6; l++) {
      const z = 8 + l * 6;
      const a = iso(7.75, yy + 0.6, z);
      leds.push(<rect key={"led" + i + l} ref={(el) => { if (el) refs.leds.push({ el, ph: i * 1.7 + l * 2.3 }); }} x={a[0] - 1.5} y={a[1] - 1} width={3} height={2} fill={l % 2 ? "#3ecf8e" : "#5cc8ff"} />);
    }
    add(7.9 + yy + 0.3, <g key={"rack" + i}>{box("rk" + i, 7.6, yy, 0, 0.6, 0.6, 46, "#2a2f3b")}{leds}</g>);
  });
  add(8.4 + 11.3, plant("p7", 8.4, 11.3));
  add(0.6 + 6.6, plant("p7b", 0.6, 6.6));
  add(3.5 + 6.35, box("whiteboard", 2.4, 6.1, 4, 2.2, 0.08, 26, "#f7f7f5"));
  // pantry
  add(11.2 + 6.55, box("counter", 9.3, 6.2, 0, 3.8, 0.6, 16, "#7b8794"));
  add(11.2 + 6.56, box("countertop", 9.3, 6.2, 16, 3.8, 0.6, 2, "#e9edf0"));
  add(10.2 + 6.5 + 0.02, box("coffee", 10, 6.3, 18, 0.4, 0.35, 12, "#1f2329"));
  add(11.5 + 6.5 + 0.02, box("kettle", 11.4, 6.35, 18, 0.25, 0.25, 7, "#c0392b"));
  add(13.5 + 6.5, box("fridge", 13.2, 6.2, 0, 0.62, 0.6, 42, "#dfe4ea"));
  add(11.4 + 9.6, box("ptable", 10.8, 9.0, 0, 1.2, 1.2, 12, "#c99a63"));
  [[10.5, 9.6], [12.3, 9.6], [11.4, 8.7], [11.4, 10.5]].forEach((s, i) => add(s[0] + s[1], box("stool" + i, s[0] - 0.16, s[1] - 0.16, 0, 0.32, 0.32, 8, "#e67e22")));
  add(9.6 + 11.3, plant("p8", 9.6, 11.3));
  add(13.4 + 11.3, plant("p9", 13.4, 11.3));
  // content
  add(22.6 + 6.45, shelf("cnsh", 21.4, 6.15, 2.4, 28, "#8a6a4a"));
  add(22.1 + 10.5, sofa("cnsofa", 21.0, 10.2, 2.2, "#d26b8a"));
  add(23.5 + 6.6, plant("p10", 23.5, 9.2));
  add(14.6 + 11.3, plant("p11", 14.6, 11.3));
  // tripod + camera
  add(17.6 + 10.6, <g key="tripod">{box("tp", 17.55, 10.55, 0, 0.06, 0.06, 26, "#333")}{box("cam", 17.42, 10.45, 26, 0.32, 0.26, 8, "#222")}{box("lens", 17.52, 10.71, 28, 0.12, 0.08, 4, "#5cc8ff")}</g>);
  // archive
  [12.6, 14.3, 16.0].forEach((yy, i) => add(2.4 + yy + 0.2, shelf("arch" + i, 0.5, yy, 3.8, 36, "#8a8f98")));
  // mine rigs
  const minePaused = people.some((p) => p.dept === "mine" && p.status === "paused");
  [5.5, 6.6, 7.7, 8.8, 9.9].forEach((xx, i) => {
    const fans: ReactNode[] = [];
    [0.2, 0.55].forEach((fx, f) => {
      const c = iso(xx + fx, 12.95, 14);
      fans.push(<ellipse key={"fan" + f} cx={c[0]} cy={c[1]} rx={6} ry={7} fill="#1b1e24" stroke={minePaused ? "#555b66" : "#f59e0b"} strokeWidth={1.2} />);
    });
    const lp = iso(xx + 0.65, 12.95, 25);
    const led = minePaused
      ? <rect key="led" x={lp[0] - 1.5} y={lp[1] - 1} width={3} height={2} fill="#ef5f5f" />
      : <rect key="led" ref={(el) => { if (el) refs.leds.push({ el, ph: i * 1.3 }); }} x={lp[0] - 1.5} y={lp[1] - 1} width={3} height={2} fill="#3ecf8e" />;
    add(xx + 0.4 + 12.65, <g key={"rig" + i}>{box("rg" + i, xx, 12.35, 0, 0.8, 0.6, 30, "#3b404c")}{fans}{led}</g>);
  });
  add(10.4 + 17.3, box("crate", 9.9, 16.9, 0, 0.8, 0.7, 12, "#a47c4a"));
  add(9.2 + 17.4, box("crate2", 8.9, 17.1, 0, 0.6, 0.5, 9, "#b88d58"));
  // lobby
  add(13.4 + 14.7, box("recep", 12.0, 14.4, 0, 2.8, 0.6, 16, "#f1ece2"));
  add(13.4 + 14.71, box("receptop", 11.95, 14.35, 16, 2.9, 0.7, 2, "#5b3a24"));
  add(15.1 + 14.3, box("recepS", 14.8, 13.8, 0, 0.6, 1.2, 16, "#f1ece2"));
  add(11.5 + 17.4, plant("p12", 11.5, 17.4));
  add(15.5 + 17.4, plant("p13", 15.5, 17.4));
  add(13.4 + 13.0, box("logo", 12.4, 12.12, 8, 2.0, 0.06, 18, "#1d2433"));
  // meeting
  add(20 + 15, box("mtable", 17.5, 14.3, 0, 5, 1.3, 12, "#e6d3b3"));
  for (let i = 0; i < 5; i++) {
    const xx = 18 + i;
    add(xx + 13.95, box("mcb" + i, xx - 0.2, 13.55, 0, 0.4, 0.4, 9, "#2f3540"));
    add(xx + 16.2, <g key={"mcf" + i}>{box("mcfs" + i, xx - 0.2, 15.85, 0, 0.4, 0.4, 9, "#2f3540")}{box("mcfb" + i, xx - 0.2, 16.2, 9, 0.4, 0.08, 12, "#2f3540")}</g>);
  }
  add(23.3 + 12.6, plant("p14", 23.3, 12.6));
  add(16.6 + 17.4, plant("p15", 16.6, 17.4));
  add(23.4 + 13.1, box("tv", 23.6, 13.4, 6, 0.08, 2.0, 26, "#11151c"));

  items.sort((a, b) => a.d - b.d);
  return { back, floor, sorted: items.map((i) => i.el), depths: items.map((i) => i.d) };
}

interface LiveBot { id: string; name?: string; dept?: string; role?: string; state?: string; summary?: string; lastActive?: string; updatedAt?: string; messages?: Msg[]; dashboard?: Dash }
function fmtCN(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => (parts.find((x) => x.type === t) || { value: "" }).value;
  return g("month") + "月" + g("day") + "日 " + (g("hour") === "24" ? "00" : g("hour")) + ":" + g("minute");
}
function latestDash(bots: LiveBot[], extra = ""): string {
  let best = extra && !isNaN(Date.parse(extra)) ? extra : "";
  (bots || []).forEach((b) => { const f = b && b.dashboard && b.dashboard.fetchedAt; if (f && !isNaN(Date.parse(f)) && (!best || Date.parse(f) > Date.parse(best))) best = f; });
  return best;
}
function hhmmCN(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/* ---------------- walkable grid (0.5-tile cells) ---------------- */
const GW = 48, GH = 36;
type Rect = [number, number, number, number];
const DECOR_OBS: Rect[] = [
  [0.4, 0.15, 2.4, 0.36], [3.1, 0.15, 1.6, 0.36], [2.4, 4.3, 2.2, 0.68],
  [6.5, 4.6, 0.7, 0.55], [8.6, 4.5, 1.8, 0.68], [16.2, 4.4, 2.6, 0.9],
  [7.6, 6.5, 0.6, 2.0], [2.4, 6.05, 2.2, 0.15], [9.3, 6.2, 3.8, 0.6], [13.2, 6.2, 0.62, 0.6],
  [10.8, 9.0, 1.2, 1.2], [10.34, 9.44, 0.32, 0.32], [12.14, 9.44, 0.32, 0.32], [11.24, 8.54, 0.32, 0.32], [11.24, 10.34, 0.32, 0.32],
  [21.4, 6.15, 2.4, 0.36], [21.0, 10.2, 2.2, 0.68], [17.4, 10.4, 0.4, 0.4],
  [0.5, 12.6, 3.8, 0.45], [0.5, 14.3, 3.8, 0.45], [0.5, 16.0, 3.8, 0.45],
  [5.5, 12.35, 5.2, 0.6], [9.9, 16.9, 0.8, 0.7], [8.9, 17.1, 0.6, 0.5],
  [11.95, 14.35, 2.9, 0.7], [14.8, 13.8, 0.6, 1.2],
  [17.5, 14.3, 5, 1.3], [17.8, 13.55, 4.4, 0.4], [17.8, 15.85, 4.4, 0.45], [23.55, 13.4, 0.15, 2.0],
];
const PLANTS: number[][] = [[5.4, 0.6], [0.6, 5.4], [12.4, 0.6], [12.4, 5.3], [23.4, 0.6], [23.4, 5.4], [13.6, 0.6], [8.4, 11.3], [0.6, 6.6], [9.6, 11.3], [13.4, 11.3], [23.5, 9.2], [14.6, 11.3], [11.5, 17.4], [15.5, 17.4], [23.3, 12.6], [16.6, 17.4]];
const H_WALLS = [{ y: 6, gaps: [2, 10, 18] }, { y: 12, gaps: [2, 7, 13, 19] }];
const V_WALLS = [{ x: 6, y0: 0, y1: 6, gap: 4 }, { x: 13, y0: 0, y1: 6, gap: 4 }, { x: 9, y0: 6, y1: 12, gap: 9 }, { x: 14, y0: 6, y1: 12, gap: 9 }, { x: 5, y0: 12, y1: 18, gap: 15 }, { x: 11, y0: 12, y1: 18, gap: 15 }, { x: 16, y0: 12, y1: 18, gap: 15 }];
interface Grid { blocked: Uint8Array; wallE: Uint8Array; wallS: Uint8Array }
function buildGrid(): Grid {
  const blocked = new Uint8Array(GW * GH), wallE = new Uint8Array(GW * GH), wallS = new Uint8Array(GW * GH);
  const obs: Rect[] = DECOR_OBS.slice();
  PLANTS.forEach((q) => obs.push([q[0] - 0.22, q[1] - 0.22, 0.44, 0.44]));
  PEOPLE.forEach((p) => {
    const w = p.dw || 1.4, d = p.dw ? 0.85 : 0.7;
    obs.push([p.dx, p.dy, w, d]);
    const sp = seat(p);
    obs.push([sp[0] - 0.22, sp[1] - 0.3, 0.44, 0.5]);
  });
  const m = 0.12;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = (i + 0.5) / 2, y = (j + 0.5) / 2;
    if (x < 0.3 || y < 0.3 || x > 23.75 || y > 17.75) { blocked[i + j * GW] = 1; continue; }
    for (const o of obs) if (x > o[0] - m && x < o[0] + o[2] + m && y > o[1] - m && y < o[1] + o[3] + m) { blocked[i + j * GW] = 1; break; }
  }
  H_WALLS.forEach((w) => { const j = w.y * 2 - 1; for (let i = 0; i < GW; i++) if (w.gaps.indexOf(Math.floor(i / 2)) < 0) wallS[i + j * GW] = 1; });
  V_WALLS.forEach((w) => { const i = w.x * 2 - 1; for (let j = w.y0 * 2; j < w.y1 * 2; j++) if (Math.floor(j / 2) !== w.gap) wallE[i + j * GW] = 1; });
  return { blocked, wallE, wallS };
}
const GRID = buildGrid();
function cellOf(x: number, y: number): number { const i = Math.max(0, Math.min(GW - 1, Math.floor(x * 2))), j = Math.max(0, Math.min(GH - 1, Math.floor(y * 2))); return i + j * GW; }
function cellCenter(c: number): [number, number] { return [((c % GW) + 0.5) / 2, (Math.floor(c / GW) + 0.5) / 2]; }
function findPath(from: number, to: number): number[] | null {
  if (from === to) return [to];
  const prev = new Int32Array(GW * GH).fill(-1);
  const q: number[] = [from]; prev[from] = from;
  const g = GRID;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (c === to) break;
    const i = c % GW, j = Math.floor(c / GW);
    const nb: number[] = [];
    if (i < GW - 1 && !g.wallE[c]) nb.push(c + 1);
    if (i > 0 && !g.wallE[c - 1]) nb.push(c - 1);
    if (j < GH - 1 && !g.wallS[c]) nb.push(c + GW);
    if (j > 0 && !g.wallS[c - GW]) nb.push(c - GW);
    for (const n of nb) {
      if (prev[n] !== -1) continue;
      if (g.blocked[n] && n !== to) continue;
      prev[n] = c; q.push(n);
    }
  }
  if (prev[to] === -1) return null;
  const path: number[] = [];
  for (let c = to; c !== from; c = prev[c]) path.push(c);
  path.reverse();
  return path;
}
function nearestFree(x: number, y: number): number {
  const c0 = cellOf(x, y);
  if (!GRID.blocked[c0]) return c0;
  let best = c0, bd = 1e9;
  for (let c = 0; c < GW * GH; c++) { if (GRID.blocked[c]) continue; const p = cellCenter(c); const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = c; } }
  return best;
}
const SPOTS: { c: number; icon: string }[] = ([
  [10.1, 7.1, "☕"], [11.0, 7.1, "☕"], [12.4, 7.1, "☕"], [10.0, 10.9, "💬"], [12.9, 8.8, "💬"], [12.9, 10.9, "💬"],
  [12.6, 16.1, "💬"], [14.4, 16.6, "💬"], [19.0, 16.9, "💬"], [21.2, 16.9, "💬"], [22.0, 11.4, "💬"], [3.4, 5.4, "💬"],
  [9.5, 5.5, "💬"], [17.4, 5.7, "💬"], [2.6, 13.7, "📄"], [7.6, 15.6, "⛏"], [16.8, 9.8, "💬"], [6.8, 9.6, "💬"],
] as [number, number, string][]).map((s) => ({ c: nearestFree(s[0], s[1]), icon: s[2] }));
const FREE_CELLS: number[] = (() => { const out: number[] = []; for (let c = 0; c < GW * GH; c++) if (!GRID.blocked[c]) out.push(c); return out; })();
interface Mover { x: number; y: number; mode: "sit" | "toSeat" | "walk" | "pause"; path: [number, number][]; wait: number; spot: number; icon: string; ph: number; tx: string }
function upperBound(a: number[], v: number): number { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m + 1; else hi = m; } return lo; }
function legs(k: string, cx: number, cy: number, refL: (el: SVGGElement | null) => void, refR: (el: SVGGElement | null) => void): ReactNode {
  const sh = iso(cx, cy, 0);
  return (
    <g key={k}>
      <ellipse cx={sh[0]} cy={sh[1]} rx={10} ry={5} fill="#000" opacity={0.2} />
      <g ref={refL}>{box(k + "l", cx - 0.14, cy - 0.06, 0, 0.11, 0.12, 9.5, "#2d3340")}</g>
      <g ref={refR}>{box(k + "r", cx + 0.03, cy - 0.06, 0, 0.11, 0.12, 9.5, "#2d3340")}</g>
    </g>
  );
}

/* ---------------- mini avatar for the side panel ---------------- */
function MiniAvatar(props: { p: Person; size: number }) {
  const parts = charParts(props.p, 0, 0);
  return (
    <svg viewBox="-26 -48 52 56" width={props.size} height={props.size * 56 / 52} style={{ display: "block", flex: "none" }} aria-hidden>
      {parts.chair}
      {parts.body}
    </svg>
  );
}

/* ---------------- page ---------------- */
export default function Studio() {
  const theme = useGrokTheme();
  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const qf = qs.get("focus") || "all";
  const [focus, setFocus] = useState<string>(qf === "all" || FOCUS_DEPTS.indexOf(qf as DeptId) >= 0 ? qf : "all");
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Shanghai" }).format(new Date())) % 24;
  const [light, setLight] = useState<string>(qs.get("light") === "night" || qs.get("light") === "day" ? (qs.get("light") as string) : (hour >= 18 || hour < 6 ? "night" : "day"));
  const qbot = qs.get("bot") || "";
  const initSel = qbot ? (PEOPLE.find((p) => p.id.startsWith(qbot) || p.name === qbot) || { id: null as string | null }).id : null;
  const [sel, setSel] = useState<string | null>(initSel);
  const [hover, setHover] = useState<string | null>(null);
  const night = light === "night";
  const [people, setPeople] = useState<Person[]>(PEOPLE);
  const peopleRef = useRef<Person[]>(PEOPLE);

  const refs = useRef<Refs>({ chars: new Map(), screens: new Map(), leds: [] });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const movers = useRef<Map<string, Mover>>(new Map());
  const moverEls = useRef<Map<string, SVGGElement>>(new Map());
  const tagEls = useRef<Map<string, SVGGElement>>(new Map());
  const bubbleEls = useRef<Map<string, SVGGElement>>(new Map());
  const legEls = useRef<Map<string, [SVGGElement | null, SVGGElement | null]>>(new Map());
  const orderRef = useRef<Record<string, number>>({});
  const [order, setOrder] = useState<Record<string, number>>({});
  const [standKey, setStandKey] = useState<string>("");
  const standRef = useRef<string>("");
  const depthsRef = useRef<number[]>([]);
  const vb0 = focus === "all" ? FULL.slice() : roomVB(focus);
  const vbCur = useRef<number[]>(vb0.slice());
  const vbTgt = useRef<number[]>(vb0.slice());

  const scene = useMemo(() => buildScene(night, refs.current, people), [night, people]);
  depthsRef.current = scene.depths;

  /* ---- live status sync ---- */
  const [statusAt, setStatusAt] = useState<string>(() => String((SNAPSHOT as unknown as { updatedAt?: string }).updatedAt || ""));
  const [dashAt, setDashAt] = useState<string>(() => latestDash((SNAPSHOT as unknown as { bots: LiveBot[] }).bots));
  const [usage, setUsage] = useState<UsageInfo | null>(() => {
    const u = (SNAPSHOT as unknown as { usage?: UsageInfo }).usage;
    return u && typeof u === "object" ? u : null;
  });
  const [outbox, setOutbox] = useState<OutCmd[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const [syncAt, setSyncAt] = useState<Date | null>(null);
  const [syncErr, setSyncErr] = useState(false);
  const [changed, setChanged] = useState<Record<string, number>>({});
  const [lastChange, setLastChange] = useState<string>("");
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/status", { credentials: "same-origin", cache: "no-store" });
        if (r.status === 401) { window.location.href = "/login"; return; }
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        if (!alive) return;
        const bots: LiveBot[] = Array.isArray(j) ? j : (j && Array.isArray(j.bots) ? j.bots : []);
        const byId = new Map<string, LiveBot>();
        bots.forEach((b) => { if (b && typeof b.id === "string") byId.set(b.id, b); });
        const prev = peopleRef.current;
        const ch: Record<string, number> = {};
        const notes: string[] = [];
        const next = prev.map((p) => {
          const b = byId.get(p.id);
          if (!b) return p;
          const st: St = b.state === "working" || b.state === "idle" || b.state === "paused" ? b.state : p.status;
          const q: Person = { ...p, status: st, task: typeof b.summary === "string" && b.summary ? b.summary : p.task, updated: b.lastActive ? fmtCN(b.lastActive) : p.updated };
          if (b.role && typeof b.role === "string") q.role = b.role;
          if (Array.isArray(b.messages)) q.messages = b.messages.filter((m) => m && typeof m.text === "string");
          if (b.dashboard && typeof b.dashboard === "object" && !Array.isArray(b.dashboard)) q.dashboard = b.dashboard;
          if (st !== p.status) { ch[p.id] = Date.now(); notes.push(p.name + " → " + ST_LABEL[st]); }
          return q;
        });
        peopleRef.current = next;
        setPeople(next);
        if (j && typeof j.updatedAt === "string" && j.updatedAt) setStatusAt(j.updatedAt);
        const da = latestDash(bots, j && typeof j.dashboardsFetchedAt === "string" ? j.dashboardsFetchedAt : "");
        if (da) setDashAt(da);
        if (j && j.usage && typeof j.usage === "object") setUsage(j.usage as UsageInfo);
        if (j && Array.isArray(j.outbox)) setOutbox(j.outbox as OutCmd[]);
        if (Object.keys(ch).length) {
          setChanged(ch);
          setLastChange(notes.join("，"));
          window.setTimeout(() => { if (alive) setChanged({}); }, 6000);
        }
        setSyncAt(new Date());
        setSyncErr(false);
      } catch (e) {
        if (alive) setSyncErr(true);
      }
    };
    load();
    const t = window.setInterval(load, Math.max(5, SYNC.pageRefreshSeconds) * 1000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const baseVB = () => (focusRef.current === "all" ? FULL.slice() : roomVB(focusRef.current));
  const focusRef = useRef<string>(focus);
  useEffect(() => { focusRef.current = focus; vbTgt.current = baseVB(); setZoomed(false); }, [focus]);

  /* ---- wheel / pinch zoom + drag pan ---- */
  const [zoomed, setZoomed] = useState(false);
  const dragMoved = useRef(false);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const scaleOf = () => { const r = svg.getBoundingClientRect(); const v = vbCur.current; return { r, k: Math.max(v[2] / r.width, v[3] / r.height) }; };
    const toSvg = (cx: number, cy: number) => {
      const { r, k } = scaleOf(); const v = vbCur.current;
      const ox = v[0] + v[2] / 2 - (r.width * k) / 2, oy = v[1] + v[3] / 2 - (r.height * k) / 2;
      return [ox + (cx - r.left) * k, oy + (cy - r.top) * k];
    };
    const zoomAt = (cx: number, cy: number, f: number) => {
      const v = vbCur.current.slice();
      const nw = Math.max(FULL[2] / 6, Math.min(FULL[2] * 1.4, v[2] / f));
      const ff = v[2] / nw;
      const pt0 = toSvg(cx, cy);
      const nv = [pt0[0] - (pt0[0] - v[0]) / ff, pt0[1] - (pt0[1] - v[1]) / ff, v[2] / ff, v[3] / ff];
      vbCur.current = nv.slice(); vbTgt.current = nv.slice();
      svg.setAttribute("viewBox", nv.map((x) => x.toFixed(1)).join(" "));
      setZoomed(true);
    };
    const pan = (dx: number, dy: number) => {
      const { k } = scaleOf();
      const v = vbCur.current; const nv = [v[0] - dx * k, v[1] - dy * k, v[2], v[3]];
      vbCur.current = nv.slice(); vbTgt.current = nv.slice();
      svg.setAttribute("viewBox", nv.map((x) => x.toFixed(1)).join(" "));
      setZoomed(true);
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); };
    const pts = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0 }, pinchD = 0;
    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { start = { x: e.clientX, y: e.clientY }; dragMoved.current = false; }
      if (pts.size === 2) { const a = [...pts.values()]; pinchD = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (pts.size === 1) {
        if (!dragMoved.current && Math.hypot(cur.x - start.x, cur.y - start.y) > 5) { dragMoved.current = true; try { svg.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } }
        if (dragMoved.current) pan(cur.x - prev.x, cur.y - prev.y);
      }
      pts.set(e.pointerId, cur);
      if (pts.size === 2) {
        dragMoved.current = true;
        const a = [...pts.values()]; const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (pinchD > 0 && d > 0) zoomAt((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, d / pinchD);
        pinchD = d;
      }
    };
    const onUp = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinchD = 0; };
    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
    svg.addEventListener("click", (e) => { if (dragMoved.current) { e.stopPropagation(); e.preventDefault(); dragMoved.current = false; } }, true);
    return () => { svg.removeEventListener("wheel", onWheel); svg.removeEventListener("pointerdown", onDown); svg.removeEventListener("pointermove", onMove); svg.removeEventListener("pointerup", onUp); svg.removeEventListener("pointercancel", onUp); };
  }, []);
  const [panelOpen, setPanelOpen] = useState<boolean>(typeof window === "undefined" ? true : (window.innerWidth >= 1360 || !!initSel));
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageH, setStageH] = useState<number>(640);
  useEffect(() => {
    const fit = () => { const el = stageRef.current; if (!el) return; const top = el.getBoundingClientRect().top + window.scrollY; setStageH(Math.max(440, Math.floor(window.innerHeight - top - 12))); };
    fit();
    window.addEventListener("resize", fit);
    const t = window.setTimeout(fit, 300);
    return () => { window.removeEventListener("resize", fit); window.clearTimeout(t); };
  }, [panelOpen, syncAt, syncErr, focus]);
  const resetView = () => { vbTgt.current = baseVB(); setZoomed(false); };

  useEffect(() => {
    let raf = 0;
    const reduce = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let lastT = 0, lastOrderT = 0;
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      const cur = vbCur.current, tgt = vbTgt.current;
      let changed = false;
      for (let i = 0; i < 4; i++) {
        const dv = tgt[i] - cur[i];
        if (Math.abs(dv) > 0.2) { cur[i] += reduce ? dv : dv * 0.12; changed = true; } else if (cur[i] !== tgt[i]) { cur[i] = tgt[i]; changed = true; }
      }
      if (changed && svgRef.current) svgRef.current.setAttribute("viewBox", cur.map((v) => v.toFixed(1)).join(" "));
      if (!reduce) {
        const dt = Math.min(0.1, Math.max(0, t - lastT));
        lastT = t;
        let orderDirty = false;
        const standing: string[] = [];
        const occupied = new Set<number>();
        movers.current.forEach((m) => { if (m.spot >= 0) occupied.add(m.spot); });
        peopleRef.current.forEach((p, i) => {
          const sp = seat(p);
          let m = movers.current.get(p.id);
          const working = p.status === "working";
          if (!m) {
            m = { x: sp[0], y: sp[1], mode: working ? "sit" : "pause", path: [], wait: 0.4 + ((i * 0.37) % 1) * 2.5, spot: -1, icon: "", ph: i, tx: "" };
            movers.current.set(p.id, m);
          }
          if (working && m.mode !== "sit" && m.mode !== "toSeat") {
            const path = findPath(cellOf(m.x, m.y), cellOf(sp[0], sp[1]));
            m.path = (path || []).map(cellCenter);
            m.path.push([sp[0], sp[1]]);
            m.mode = "toSeat"; m.spot = -1; m.icon = "";
          } else if (!working && (m.mode === "sit" || m.mode === "toSeat")) {
            m.mode = "pause"; m.path = []; m.wait = 0.5 + Math.random();
          }
          const speed = p.status === "paused" ? 0.9 : 1.45;
          let walking = false;
          if (m.path.length) {
            const tgt = m.path[0];
            const dx = tgt[0] - m.x, dy = tgt[1] - m.y, dist = Math.hypot(dx, dy), step = speed * dt;
            if (dist <= step) { m.x = tgt[0]; m.y = tgt[1]; m.path.shift(); } else { m.x += (dx / dist) * step; m.y += (dy / dist) * step; }
            walking = true;
          } else if (m.mode === "toSeat") {
            m.mode = "sit"; m.x = sp[0]; m.y = sp[1];
          } else if (m.mode === "walk") {
            m.mode = "pause"; m.wait = m.spot >= 0 ? 5 + Math.random() * 7 : 1.2 + Math.random() * 2.5;
          } else if (m.mode === "pause") {
            m.wait -= dt;
            if (m.wait <= 0) {
              let dest = -1, icon = "", spot = -1;
              if (Math.random() < 0.55) {
                const free = SPOTS.map((s, k) => k).filter((k) => !occupied.has(k));
                if (free.length) { spot = free[Math.floor(Math.random() * free.length)]; dest = SPOTS[spot].c; icon = SPOTS[spot].icon; }
              }
              if (dest < 0) dest = FREE_CELLS[Math.floor(Math.random() * FREE_CELLS.length)];
              const path = findPath(cellOf(m.x, m.y), dest);
              if (path && path.length) {
                if (m.spot >= 0) occupied.delete(m.spot);
                m.path = path.map(cellCenter); m.mode = "walk"; m.spot = spot; m.icon = icon;
                if (spot >= 0) occupied.add(spot);
              } else m.wait = 0.8;
            }
          }
          if (m.mode !== "sit") standing.push(p.id);
          // position
          const a = iso(m.x, m.y), b = iso(sp[0], sp[1]);
          const tx = "translate(" + (a[0] - b[0]).toFixed(1) + " " + (a[1] - b[1]).toFixed(1) + ")";
          if (tx !== m.tx) {
            m.tx = tx;
            const g = moverEls.current.get(p.id); if (g) g.setAttribute("transform", tx);
            const tg = tagEls.current.get(p.id); if (tg) tg.setAttribute("transform", tx);
          }
          // depth order
          const idx = upperBound(depthsRef.current, m.x + m.y);
          if (orderRef.current[p.id] !== idx) { orderRef.current[p.id] = idx; orderDirty = true; }
          // body + legs
          const body = refs.current.chars.get(p.id);
          if (walking) m.ph += dt * 11;
          if (body) {
            let dy = 0;
            if (m.mode === "sit") dy = working ? -Math.abs(Math.sin(t * 7 + i)) * 1.6 : Math.sin(t * 1.5 + i) * 0.8;
            else if (walking) dy = -Math.abs(Math.sin(m.ph)) * 1.4;
            else dy = Math.sin(t * 1.6 + i) * 0.5;
            body.setAttribute("transform", "translate(0 " + dy.toFixed(2) + ")");
          }
          const lg = legEls.current.get(p.id);
          if (lg) {
            const l = walking ? Math.max(0, Math.sin(m.ph)) * -2.2 : 0, r = walking ? Math.max(0, -Math.sin(m.ph)) * -2.2 : 0;
            if (lg[0]) lg[0].setAttribute("transform", "translate(0 " + l.toFixed(2) + ")");
            if (lg[1]) lg[1].setAttribute("transform", "translate(0 " + r.toFixed(2) + ")");
          }
          const bub = bubbleEls.current.get(p.id);
          if (bub) {
            const show = m.mode === "pause" && !!m.icon && m.wait > 0.3;
            const want = show ? "1" : "0";
            if (bub.getAttribute("opacity") !== want) {
              bub.setAttribute("opacity", want);
              const tx2 = bub.querySelector("text"); if (tx2 && show) tx2.textContent = m.icon;
            }
          }
          const s = refs.current.screens.get(p.id);
          if (s) {
            let o = 1;
            if (p.status === "working") o = m.mode === "sit" ? (((t + i * 0.77) % 4.5) < 0.12 ? 0.35 : 0.85 + 0.15 * Math.sin(t * 11 + i)) : 0.7;
            else if (p.status === "idle") o = 0.55 + 0.25 * Math.sin(t * 1.1 + i);
            else o = 0.6;
            s.setAttribute("opacity", o.toFixed(2));
          }
        });
        const sk = standing.sort().join(",");
        if (sk !== standRef.current) { standRef.current = sk; setStandKey(sk); }
        if (orderDirty && t - lastOrderT > 0.08) { lastOrderT = t; setOrder({ ...orderRef.current }); }
        refs.current.leds.forEach((l) => l.el.setAttribute("opacity", Math.sin(t * 4 + l.ph) > -0.2 ? "1" : "0.25"));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const standSet = new Set(standKey ? standKey.split(",") : []);
  const merged = useMemo(() => {
    const byIdx = new Map<number, Person[]>();
    people.forEach((p) => {
      const sp = seat(p);
      const k = order[p.id] != null ? order[p.id] : upperBound(scene.depths, sp[0] + sp[1]);
      const arr = byIdx.get(k) || []; arr.push(p); byIdx.set(k, arr);
    });
    const renderMover = (p: Person) => {
      const sp = seat(p);
      const parts = charParts(p, sp[0], sp[1]);
      const m = movers.current.get(p.id);
      const up = standSet.has(p.id);
      return (
        <g key={"mv" + p.id} transform={m && m.tx ? m.tx : undefined} ref={(el) => { if (el) moverEls.current.set(p.id, el); }}>
          <g transform={(() => { const f = iso(sp[0], sp[1]); return "translate(" + f[0] + " " + f[1] + ") scale(1.2) translate(" + -f[0] + " " + -f[1] + ")"; })()}>
          {up ? legs("lg" + p.id, sp[0], sp[1], (el) => { const v = legEls.current.get(p.id) || [null, null]; v[0] = el; legEls.current.set(p.id, v); }, (el) => { const v = legEls.current.get(p.id) || [null, null]; v[1] = el; legEls.current.set(p.id, v); }) : null}
          <g ref={(el) => { if (el) refs.current.chars.set(p.id, el); }}>{parts.body}</g>
          </g>
        </g>
      );
    };
    const out: ReactNode[] = [];
    scene.sorted.forEach((el, k) => { (byIdx.get(k) || []).forEach((p) => out.push(renderMover(p))); out.push(el); });
    byIdx.forEach((arr, k) => { if (k >= scene.sorted.length) arr.forEach((p) => out.push(renderMover(p))); });
    return out;
    // eslint-disable-next-line
  }, [scene, order, people, standKey]);

  const counts = {
    total: people.length,
    working: people.filter((p) => p.status === "working").length,
    idle: people.filter((p) => p.status === "idle").length,
    paused: people.filter((p) => p.status === "paused").length,
  };
  const selected = people.find((p) => p.id === sel) || null;
  const deptName = (id: DeptId) => (ROOMS.find((r) => r.id === id) || { name: "" }).name;
  const focusRoom = ROOMS.find((r) => r.id === focus) || null;
  const inFocus = (d: DeptId) => focus === "all" || focus === d;

  const segOptions = [{ value: "all", label: "全楼" }].concat(FOCUS_DEPTS.map((d) => ({ value: d as string, label: deptName(d).replace("自动化 · ", "").replace(" · 社区部", "部"), count: people.filter((p) => p.dept === d).length })));

  const sceneBg = night ? "linear-gradient(180deg,#141a2a 0%,#0b0f1a 100%)" : "linear-gradient(180deg,#e3edf6 0%,#c7d6e6 100%)";
  const card: CSSProperties = { background: theme.bg.elevated, border: "1px solid " + theme.border.subtle, borderRadius: theme.radius.lg };

  const onPick = (id: string) => {
    setSel(id);
    setPanelOpen(true);
    setDraft("");
    setSendErr("");
    const p = people.find((q) => q.id === id);
    if (p && focus !== "all" && focus !== p.dept && FOCUS_DEPTS.indexOf(p.dept) >= 0) setFocus(p.dept);
  };
  useEffect(() => {
    if (!sel) return;
    const t = window.setTimeout(() => { try { draftRef.current && draftRef.current.focus(); } catch (e) {} }, 50);
    return () => window.clearTimeout(t);
  }, [sel]);
  const sendCommand = async () => {
    if (!selected || sending) return;
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setSendErr("");
    const optimistic: OutCmd = {
      id: "local-" + Date.now(),
      botId: selected.id,
      botName: selected.name,
      text: body,
      at: new Date().toISOString(),
      status: "queued",
    };
    setOutbox((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      const r = await fetch("/api/command", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ botId: selected.id, text: body }),
      });
      if (r.status === 401) { window.location.href = "/login"; return; }
      const j = await r.json().catch(() => ({} as { error?: string }));
      if (!r.ok) {
        const err = (j && (j as { error?: string }).error) ? String((j as { error?: string }).error) : ("发送失败 HTTP " + r.status);
        setSendErr(err);
        setOutbox((prev) => prev.map((c) => c.id === optimistic.id ? { ...c, status: "failed", error: err } : c));
      } else {
        try {
          const sr = await fetch("/api/status", { credentials: "same-origin", cache: "no-store" });
          if (sr.ok) {
            const sj = await sr.json();
            if (sj && Array.isArray(sj.outbox)) setOutbox(sj.outbox as OutCmd[]);
            if (sj && sj.usage && typeof sj.usage === "object") setUsage(sj.usage as UsageInfo);
          }
        } catch (e) { /* keep optimistic */ }
      }
    } catch (e) {
      setSendErr("网络错误，请稍后重试");
      setOutbox((prev) => prev.map((c) => c.id === optimistic.id ? { ...c, status: "failed", error: "network" } : c));
    } finally {
      setSending(false);
      try { draftRef.current && draftRef.current.focus(); } catch (e) {}
    }
  };

  return (
    <Page title="工作室 · 总部大楼" summary="" width="full" sub={<>
      <span title={statusSyncTooltip()} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "#121b2e", border: "1px solid #1f2a40", fontSize: 12, color: "#9aa6ba", whiteSpace: "nowrap" }}><span style={{ width: 6, height: 6, borderRadius: 6, background: "#5cc8ff" }} />状态同步：<b style={{ color: "#e8edf5", fontWeight: 600 }}>{statusAt && fmtCN(statusAt) ? fmtCN(statusAt).replace(/^(\d+)月(\d+)日/, (_m, a, b) => String(a).padStart(2, "0") + "月" + String(b).padStart(2, "0") + "日") + "（北京时间）" : "未知"}</b></span>
      <span title={dashboardSyncTooltip()} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "#121b2e", border: "1px solid #1f2a40", fontSize: 12, color: "#9aa6ba", whiteSpace: "nowrap" }}><span style={{ width: 6, height: 6, borderRadius: 6, background: "#3ecf8e" }} />脚本面板：<b style={{ color: "#e8edf5", fontWeight: 600 }}>{dashAt && !isNaN(Date.parse(dashAt)) ? hhmmCN(new Date(dashAt)) : "未知"}</b></span>
      {usage ? (
        <span title={usageTitle(usage)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 8, background: "#121b2e", border: "1px solid #1f2a40", fontSize: 12, color: "#9aa6ba", whiteSpace: "nowrap" }}>
          <span style={{ width: 6, height: 6, borderRadius: 6, background: usageBarColor(usage.percentUsed) }} />
          Grok 用量：
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 48, height: 6, borderRadius: 4, background: "#0f1728", overflow: "hidden", border: "1px solid #1f2a40" }}>
              <span style={{ display: "block", height: "100%", width: Math.max(0, Math.min(100, typeof usage.percentUsed === "number" ? usage.percentUsed : 0)) + "%", background: usageBarColor(usage.percentUsed) }} />
            </span>
            <b style={{ color: "#e8edf5", fontWeight: 600 }}>已用 {usage.usedLabel || ((typeof usage.percentUsed === "number" ? usage.percentUsed : "?") + "%")}</b>
          </span>
          {usage.resetsLabel ? <span style={{ color: "#6b7891" }}>· {usage.resetsLabel} 重置</span> : null}
        </span>
      ) : null}
    </>} actions={<form method="post" action="/logout" style={{ margin: 0 }}><button type="submit" style={{ cursor: "pointer", padding: "7px 14px", borderRadius: 8, fontSize: 13, color: "#e8edf5", background: "#18233a", border: "1px solid #2a3852" }}>退出登录</button></form>}>
      <div style={{ fontFamily: theme.font.family, color: theme.text.primary, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <Segmented options={segOptions} value={focus} onChange={(v) => setFocus(v)} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["成员", counts.total, "#e8edf5"], ["进行中", counts.working, "#3ecf8e"], ["待命", counts.idle, "#a3acb9"], ["暂停", counts.paused, "#f5a524"]].map((x) => (
                <span key={x[0] as string} style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "5px 11px", borderRadius: 9, background: "#121b2e", border: "1px solid #1f2a40", fontSize: 12, color: "#9aa6ba" }}>
                  {x[0]}<b style={{ fontSize: 16, color: x[2] as string }}>{x[1]}</b>
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span title={lastChange ? "最近变更：" + lastChange : ""} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 4, fontSize: theme.font.label.fontSize, color: syncErr ? theme.text.warning : theme.text.secondary, whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: 9, background: syncErr ? "#f5a524" : syncAt ? "#3ecf8e" : "#6b7891", boxShadow: syncAt && !syncErr ? "0 0 0 3px rgba(62,207,142,0.18)" : "none" }} />
              {syncErr ? "同步失败，显示上次数据" : syncAt ? "页面刷新：" + hhmmCN(syncAt) : "正在同步…"}
            </span>
            <Segmented options={[{ value: "day", label: "☀ 日间" }, { value: "night", label: "☾ 夜间" }]} value={light} onChange={(v) => setLight(v)} />
            <button onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen} style={{ cursor: "pointer", padding: "7px 12px", borderRadius: 8, fontSize: 13, color: "#e8edf5", background: panelOpen ? "#1d3550" : "#18233a", border: "1px solid " + (panelOpen ? "#2f5b80" : "#2a3852") }}>{panelOpen ? "收起名单 ▸" : "◂ 成员名单"}</button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch", flex: 1, minHeight: 0 }}>
          {/* scene */}
          <div ref={stageRef} style={{ flex: "1 1 600px", minWidth: 0, height: stageH, borderRadius: theme.radius.lg, background: sceneBg, border: "1px solid " + theme.border.subtle, overflow: "hidden", position: "relative" }}>
            <svg ref={svgRef} viewBox={vbCur.current.map((v) => v.toFixed(1)).join(" ")} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block", userSelect: "none", touchAction: "none", cursor: "grab" }} role="img" aria-label="工作室总部大楼等距视图">
              <defs>
                <radialGradient id="gScreen"><stop offset="0%" stopColor="#7fdcff" stopOpacity={0.75} /><stop offset="100%" stopColor="#7fdcff" stopOpacity={0} /></radialGradient>
                <radialGradient id="gLamp"><stop offset="0%" stopColor="#ffd59a" stopOpacity={0.55} /><stop offset="100%" stopColor="#ffd59a" stopOpacity={0} /></radialGradient>
              </defs>
              <g onClick={() => setSel(null)}>
                {scene.back}
                {scene.floor}
                {merged}
              </g>

              {night ? (
                <g style={{ pointerEvents: "none" }}>
                  <rect x={-900} y={-400} width={2400} height={1600} fill="#0a1230" opacity={0.48} />
                  {ROOMS.map((r) => { const c = iso(r.x + r.w / 2, r.y + r.h / 2, 0); const rx = Math.min(r.w, r.h) * HX * 1.1; return <ellipse key={"lamp" + r.id} cx={c[0]} cy={c[1]} rx={rx} ry={rx / 2} fill="url(#gLamp)" style={{ mixBlendMode: "screen" }} />; })}
                  {people.filter((p) => p.status !== "paused").map((p) => { const m = monitorPos(p); const c = iso(m[0] + 0.15, m[1] + 0.3, 22); return <ellipse key={"gl" + p.id} cx={c[0]} cy={c[1]} rx={p.status === "working" ? 46 : 30} ry={p.status === "working" ? 26 : 17} fill="url(#gScreen)" opacity={p.status === "working" ? 1 : 0.55} style={{ mixBlendMode: "screen" }} />; })}
                </g>
              ) : null}

              {focusRoom ? (
                <path d={"M-900,-400 h2400 v1600 h-2400 Z " + silhouette(focusRoom, 76)} fillRule="evenodd" fill={night ? "#05070d" : "#1a2133"} opacity={0.55} style={{ pointerEvents: "none" }} />
              ) : null}

              {/* room labels */}
              <g style={{ pointerEvents: "none" }}>
                {ROOMS.map((r) => {
                  const z = r.y === 0 ? 70 : 42;
                  const c = r.y === 0 ? iso(r.x + r.w / 2, r.y + 0.25, z) : iso(r.x + r.w - 1.3, r.y + 0.3, z);
                  const w = textW(r.name) * 1.1 + 28;
                  return (
                    <g key={"rl" + r.id} opacity={inFocus(r.id) ? 1 : 0.35}>
                      <rect x={c[0] - w / 2} y={c[1] - 12} width={w} height={22} rx={5} fill="#1c2230" opacity={0.92} />
                      <rect x={c[0] - w / 2 + 6} y={c[1] - 6} width={3} height={10} rx={1.5} fill={r.accent} />
                      <text x={c[0] + 5} y={c[1] + 3.5} textAnchor="middle" fontSize={13} fontWeight={600} fill="#f4f6fa" style={{ fontFamily: theme.font.family }}>{r.name}</text>
                    </g>
                  );
                })}
              </g>

              {/* name tags + hit areas */}
              {people.map((p) => {
                const s = seat(p);
                const c = iso(s[0], s[1], 72);
                const base = iso(s[0], s[1], 0);
                const label = p.name + " · " + p.tag;
                const w = textW(label) * 1.2 + 30;
                const active = hover === p.id || sel === p.id || !!changed[p.id];
                const mv = movers.current.get(p.id);
                const col = ST_DOT[p.status];
                const zc = iso(s[0] + 0.25, s[1], 46);
                return (
                  <g key={"tag" + p.id} transform={mv && mv.tx ? mv.tx : undefined} ref={(el) => { if (el) tagEls.current.set(p.id, el); }}>
                  {sel === p.id ? <ellipse cx={base[0]} cy={base[1]} rx={24} ry={12} fill="none" stroke="#5cc8ff" strokeWidth={2} strokeDasharray="4 3" style={{ pointerEvents: "none" }} /> : null}
                  {changed[p.id] ? (
                    <g key={"pulse" + changed[p.id]} style={{ pointerEvents: "none" }}>
                      {[0, 0.4, 0.8].map((dl) => (
                        <ellipse key={dl} cx={base[0]} cy={base[1]} rx={10} ry={5} fill="none" stroke={col} strokeWidth={2.5} opacity={0}>
                          <animate attributeName="rx" from="10" to="58" dur="1.6s" begin={dl + "s"} repeatCount="3" />
                          <animate attributeName="ry" from="5" to="29" dur="1.6s" begin={dl + "s"} repeatCount="3" />
                          <animate attributeName="opacity" from="0.95" to="0" dur="1.6s" begin={dl + "s"} repeatCount="3" />
                        </ellipse>
                      ))}
                    </g>
                  ) : null}
                  {p.status === "paused" ? (
                    <g style={{ pointerEvents: "none" }}>
                      <animateTransform attributeName="transform" type="translate" values="0 0; 6 -12" dur="3s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur="3s" repeatCount="indefinite" />
                      <text x={zc[0]} y={zc[1]} fontSize={10} fontWeight={700} fill="#ffd166">z</text>
                      <text x={zc[0] + 6} y={zc[1] - 6} fontSize={12} fontWeight={700} fill="#ffd166">Z</text>
                    </g>
                  ) : null}
                  <g ref={(el) => { if (el) bubbleEls.current.set(p.id, el); }} opacity={0} style={{ pointerEvents: "none" }}>
                    <rect x={c[0] + textW(label) / 2 + 12} y={c[1] - 34} width={22} height={18} rx={9} fill="#ffffff" opacity={0.95} />
                    <text x={c[0] + textW(label) / 2 + 23} y={c[1] - 21} fontSize={11} textAnchor="middle">💬</text>
                  </g>
                  <g opacity={inFocus(p.dept) ? 1 : 0.3} style={{ cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); onPick(p.id); }}
                    onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
                    <rect x={c[0] - 28} y={c[1]} width={56} height={base[1] - c[1] + 8} fill="transparent" />
                    <g transform={active ? "translate(0 -2)" : undefined}>
                      <rect x={c[0] - w / 2} y={c[1] - 22} width={w} height={24} rx={12} fill={active ? "#0f2a3d" : "#20242e"} opacity={0.92} stroke={active ? "#5cc8ff" : "rgba(255,255,255,0.12)"} strokeWidth={active ? 1.5 : 1} />
                      <circle cx={c[0] - w / 2 + 13} cy={c[1] - 10} r={4.2} fill={ST_DOT[p.status]} />
                      <text x={c[0] - w / 2 + 23} y={c[1] - 5.3} fontSize={13.2} fontWeight={500} fill="#f4f6fa" style={{ fontFamily: theme.font.family }}>{label}</text>
                      <path d={"M" + (c[0] - 4) + "," + (c[1] + 2) + " L" + c[0] + "," + (c[1] + 6) + " L" + (c[0] + 4) + "," + (c[1] + 2) + " Z"} fill={active ? "#0f2a3d" : "#20242e"} opacity={0.92} />
                    </g>
                  </g>
                  </g>
                );
              })}
            </svg>
            <div style={{ position: "absolute", left: 12, bottom: 10, maxWidth: "calc(100% - 210px)", display: "flex", flexWrap: "wrap", gap: 12, padding: "6px 10px", borderRadius: theme.radius.md, background: "rgba(20,24,34,0.78)", color: "#e8ecf2", fontSize: theme.font.caption.fontSize, lineHeight: theme.font.caption.lineHeight }}>
              {(["working", "idle", "paused"] as St[]).map((s) => (
                <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 9999, background: ST_DOT[s] }} />{ST_LABEL[s]}</span>
              ))}
              <span style={{ opacity: 0.7 }}>没活的成员会起身走动，有活就回工位 · 滚轮缩放、拖动平移</span>
            </div>
            <div style={{ position: "absolute", right: 12, bottom: 10, display: "flex", gap: 6 }}>
              {[["＋", () => { const sv = svgRef.current; if (sv) { const r = sv.getBoundingClientRect(); sv.dispatchEvent(new WheelEvent("wheel", { deltaY: -300, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, cancelable: true })); } }], ["－", () => { const sv = svgRef.current; if (sv) { const r = sv.getBoundingClientRect(); sv.dispatchEvent(new WheelEvent("wheel", { deltaY: 300, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, cancelable: true })); } }]].map((b) => (
                <button key={b[0] as string} onClick={b[1] as () => void} style={{ cursor: "pointer", width: 32, height: 32, borderRadius: 8, fontSize: 16, color: "#e8edf5", background: "rgba(20,24,34,0.85)", border: "1px solid #2a3852" }}>{b[0] as string}</button>
              ))}
              <button onClick={resetView} disabled={!zoomed} style={{ cursor: zoomed ? "pointer" : "default", height: 32, padding: "0 12px", borderRadius: 8, fontSize: 12, color: zoomed ? "#e8edf5" : "#6b7891", background: "rgba(20,24,34,0.85)", border: "1px solid " + (zoomed ? "#5cc8ff" : "#2a3852") }}>重置视角</button>
            </div>
          </div>

          {/* side panel */}
          {panelOpen ? (
          <div style={{ ...card, flex: selected ? "0 1 430px" : "0 1 330px", minWidth: 260, padding: 16, display: "flex", flexDirection: "column", gap: 14, maxHeight: stageH, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}><button onClick={() => setPanelOpen(false)} aria-label="收起成员名单" style={{ all: "unset", cursor: "pointer", color: theme.text.tertiary, fontSize: 18, lineHeight: "18px", padding: "0 4px" }}>×</button></div>
            {selected ? (
              <Fragmentish>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ background: night ? "#141a2a" : "#e3edf6", borderRadius: theme.radius.md, padding: 6 }}><MiniAvatar p={selected} size={56} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: theme.font.heading3.fontSize, lineHeight: theme.font.heading3.lineHeight, fontWeight: theme.weight.semibold }}>{selected.name}</div>
                    <div style={{ fontSize: theme.font.subtext.fontSize, color: theme.text.secondary }}>{deptName(selected.dept)} · {selected.role}</div>
                    <div style={{ marginTop: 6 }}><Status tone={selected.status === "working" ? "success" : selected.status === "paused" ? "warning" : "neutral"}>{ST_LABEL[selected.status]}</Status></div>
                  </div>
                </div>
                <Properties items={[
                  { label: "部门", value: deptName(selected.dept) },
                  { label: "岗位", value: selected.role },
                  { label: "当前状态", value: selected.task },
                  { label: "最近活动", value: selected.updated ? selected.updated + "（北京时间）" : "未记录" },
                ]} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button label="返回名单" onClick={() => setSel(null)} />
                  {FOCUS_DEPTS.indexOf(selected.dept) >= 0 && focus !== selected.dept ? <Button label={"聚焦" + deptName(selected.dept)} onClick={() => setFocus(selected.dept)} /> : null}
                </div>
                {selected.dashboard ? <DashboardView d={selected.dashboard} /> : null}
                <MessageList msgs={selected.messages} />
                {(() => {
                  const mine = outbox.filter((c) => c.botId === selected.id).slice(-12);
                  const botMsgs = (selected.messages || []).map((m, i) => ({ kind: "in" as const, at: m.at || "", text: m.text, key: "in-" + i + "-" + (m.at || ""), status: "", error: "" }));
                  const outMsgs = mine.map((c) => ({ kind: "out" as const, at: c.at, text: c.text, key: "out-" + c.id, status: c.status, error: c.error || "" }));
                  const combined = [...botMsgs, ...outMsgs].sort((a, b) => (Date.parse(a.at || "") || 0) - (Date.parse(b.at || "") || 0));
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #22304a", paddingTop: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e8edf5" }}>对话 / 下达任务</div>
                      <div style={{ fontSize: 12, color: "#6b7891", lineHeight: "18px" }}>发送后会转达给 TA 执行，回复会回到这个面板。</div>
                      {combined.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                          {combined.map((m) => (
                            <div key={m.key} style={{ alignSelf: m.kind === "out" ? "flex-end" : "flex-start", maxWidth: "92%", background: m.kind === "out" ? "#1a3350" : "#111a2c", border: "1px solid " + (m.kind === "out" ? "#2f5b80" : "#22304a"), borderRadius: 10, padding: "7px 10px" }}>
                              <div style={{ fontSize: 11, color: "#6b7891", marginBottom: 3 }}>{m.at ? fmtCN(m.at) + "（北京时间）" : ""}{m.kind === "out" ? " · 我" : " · TA"}{m.kind === "out" && m.status ? " · " + m.status : ""}</div>
                              <div style={{ fontSize: 13, color: "#cfd8e6", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
                              {m.kind === "out" && m.error ? <div style={{ fontSize: 11, color: "#ff6b6b", marginTop: 4 }}>{m.error}</div> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#6b7891" }}>还没有通过面板发送过任务。</div>
                      )}
                      <textarea
                        ref={draftRef}
                        value={draft}
                        disabled={sending}
                        placeholder="给 TA 发消息或下达任务…"
                        rows={3}
                        onChange={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendCommand();
                          }
                        }}
                        style={{ width: "100%", resize: "vertical", minHeight: 64, padding: "8px 10px", borderRadius: 8, border: "1px solid #2a3852", background: "#0f1728", color: "#e8edf5", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {sendErr ? <span style={{ fontSize: 12, color: "#ff6b6b", flex: 1 }}>{sendErr}</span> : <span style={{ fontSize: 11, color: "#6b7891", flex: 1 }}>Enter 发送 · Shift+Enter 换行</span>}
                        <button
                          type="button"
                          disabled={sending || !draft.trim()}
                          onClick={() => { void sendCommand(); }}
                          style={{ cursor: sending || !draft.trim() ? "default" : "pointer", padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#0b1120", background: sending || !draft.trim() ? "#3a465c" : "linear-gradient(135deg,#5cc8ff,#3ecf8e)", border: 0 }}
                        >{sending ? "发送中…" : "发送"}</button>
                      </div>
                    </div>
                  );
                })()}
              </Fragmentish>
            ) : (
              <Fragmentish>
                <div style={{ fontSize: theme.font.heading3.fontSize, lineHeight: theme.font.heading3.lineHeight, fontWeight: theme.weight.semibold }}>{focusRoom ? focusRoom.name : "成员名单"}</div>
                {FOCUS_DEPTS.filter((d) => inFocus(d)).map((d) => (
                  <div key={d} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: theme.font.label.fontSize, color: theme.text.tertiary, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 3, height: 10, borderRadius: 2, background: (ROOMS.find((r) => r.id === d) || ROOMS[0]).accent }} />{deptName(d)}
                    </div>
                    {people.filter((p) => p.dept === d).map((p) => (
                      <button key={p.id} onClick={() => onPick(p.id)} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}
                        style={{ all: "unset", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", padding: "6px 8px", borderRadius: theme.radius.md, background: hover === p.id ? theme.fill.hover : "transparent", transition: "background " + theme.motion.hover + " " + theme.motion.easing }}>
                        <span style={{ width: 8, height: 8, borderRadius: 9999, background: ST_DOT[p.status], flex: "none" }} />
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: "block", fontSize: theme.font.body2.fontSize, fontWeight: theme.weight.medium }}>{p.name} <span style={{ color: theme.text.tertiary, fontWeight: theme.weight.regular }}>· {p.tag}</span></span>
                          <span style={{ display: "block", fontSize: theme.font.label.fontSize, color: theme.text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.task}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </Fragmentish>
            )}
          </div>
          ) : null}
        </div>
      </div>
    </Page>
  );
}

function Fragmentish(props: { children?: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{props.children}</div>;
}
