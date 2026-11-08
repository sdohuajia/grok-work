import { useState, type ReactNode } from "react";
import { statusSyncTimesLabel, dashboardAutoLabel, snapshotDashExtra } from "./syncConfig";

export interface Msg { at: string; text: string }
export interface DashStat { label: string; value: string; tone?: "good" | "bad" | "warn" }
export interface DashTable { title: string; columns: string[]; rows: (string | number | null)[][]; note?: string }
export interface Dash { title?: string; url?: string; fetchedAt?: string; note?: string; stats?: DashStat[]; tables?: DashTable[]; errors?: string[]; stale?: boolean; auto?: boolean; lastAttemptAt?: string }

const C = { text: "#e8edf5", sub: "#9aa7bd", dim: "#6b7891", card: "#111a2c", line: "#22304a", code: "#0b1322", link: "#5cc8ff", good: "#3ecf8e", bad: "#ff6b6b", warn: "#f5a524" };

export function fmtBJ(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => (parts.find((x) => x.type === t) || { value: "" }).value;
  return g("month") + "月" + g("day") + "日 " + (g("hour") === "24" ? "00" : g("hour")) + ":" + g("minute");
}

const safeUrl = (u: string) => /^https?:\/\//i.test(u) ? u : null;

/* inline: **bold**, `code`, [text](url), bare urls — React elements only, no innerHTML */
function inline(s: string, k: string): ReactNode[] {
  const out: ReactNode[] = [];
  const rx = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))|(https?:\/\/[^\s)）]+)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = rx.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const key = k + "-" + i++;
    if (m[1]) out.push(<b key={key} style={{ color: C.text }}>{m[2]}</b>);
    else if (m[3]) out.push(<code key={key} style={{ background: C.code, padding: "0 4px", borderRadius: 4, fontSize: "0.92em" }}>{m[4]}</code>);
    else {
      const href = safeUrl(m[7] || m[8]);
      const label = m[6] || m[8];
      out.push(href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" style={{ color: C.link, wordBreak: "break-all" }}>{label}</a> : label);
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Rich(props: { text: string }) {
  const blocks = props.text.split(/```[a-zA-Z]*\n?/);
  return (
    <div style={{ fontSize: 13, lineHeight: "20px", color: "#cfd8e6", wordBreak: "break-word" }}>
      {blocks.map((b, bi) => bi % 2 === 1
        ? <pre key={bi} style={{ margin: "6px 0", padding: 8, background: C.code, borderRadius: 6, fontSize: 11.5, lineHeight: "16px", overflowX: "auto", whiteSpace: "pre" }}>{b.replace(/\n$/, "")}</pre>
        : b.split("\n").map((ln, li) => {
            const t = ln.replace(/^#{1,4}\s+/, "");
            if (!t.trim()) return <div key={bi + "-" + li} style={{ height: 6 }} />;
            const bullet = /^\s*([-*]|\d+\.)\s+/.exec(t);
            return <div key={bi + "-" + li} style={bullet ? { paddingLeft: 14, textIndent: -10 } : undefined}>{inline(bullet ? (bullet[1].endsWith(".") ? bullet[1] + " " : "• ") + t.slice(bullet[0].length) : t, bi + "-" + li)}</div>;
          }))}
    </div>
  );
}

function MsgCard(props: { m: Msg }) {
  const long = props.m.text.length > 160 || props.m.text.split("\n").length > 5;
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>{props.m.at ? fmtBJ(props.m.at) + "（北京时间）" : "时间未记录"}</div>
      <div style={{ position: "relative", maxHeight: long && !open ? 104 : undefined, overflow: "hidden" }}>
        <Rich text={props.m.text} />
        {long && !open ? <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 32, background: "linear-gradient(rgba(17,26,44,0), " + C.card + ")" }} /> : null}
      </div>
      {long ? <button onClick={() => setOpen(!open)} style={{ all: "unset", cursor: "pointer", marginTop: 4, fontSize: 12, color: C.link }}>{open ? "收起" : "展开全文"}</button> : null}
    </div>
  );
}

export function Section(props: { title: string; extra?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, borderTop: "1px solid " + C.line, paddingTop: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{props.title}</span>
        {props.extra ? <span style={{ fontSize: 11, color: C.dim, textAlign: "right" }}>{props.extra}</span> : null}
      </div>
      {props.children}
    </div>
  );
}

export function MessageList(props: { msgs?: Msg[] }) {
  const msgs = props.msgs || [];
  if (!msgs.length) return null;  // no on-topic replies -> no section at all
  return (
    <Section title="最新消息" extra={statusSyncTimesLabel() + " 同步"}>
      {msgs.map((m, i) => <MsgCard key={i + m.at} m={m} />)}
    </Section>
  );
}

const toneColor = (t?: string) => t === "good" ? C.good : t === "bad" ? C.bad : t === "warn" ? C.warn : C.text;
function cellTone(v: unknown, col: string): string | undefined {
  if (!/盈亏|净|收益|PnL/i.test(col)) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n) || n === 0) return undefined;
  return n > 0 ? C.good : C.bad;
}

export function DashboardView(props: { d: Dash }) {
  const d = props.d;
  const url = d.url && safeUrl(d.url);
  const age = d.fetchedAt ? Date.now() - new Date(d.fetchedAt).getTime() : Infinity;
  return (
    <Section title="脚本面板" extra={<>数据时间 {fmtBJ(d.fetchedAt) || "未知"}（北京时间）<br />{d.auto ? (d.stale ? <span style={{ color: C.warn }}>最近一次抓取失败，显示上次成功的数据</span> : age > 25 * 60e3 ? <span style={{ color: C.warn }}>数据已超过 25 分钟未更新</span> : dashboardAutoLabel()) : snapshotDashExtra()}</>}>
      <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{d.title}{url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, fontSize: 11, color: C.link, fontWeight: 400 }}>打开面板 ↗</a> : null}</div>
      {d.stats && d.stats.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
          {d.stats.map((s, i) => (
            <div key={i} style={{ background: C.card, border: "1px solid " + C.line, borderRadius: 8, padding: "6px 8px", minWidth: 0 }}>
              <div style={{ fontSize: 11, color: C.dim }}>{s.label}</div>
              <div style={{ fontSize: 12.5, color: toneColor(s.tone), fontWeight: 500, wordBreak: "break-word" }}>{s.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {(d.tables || []).map((t, ti) => (
        <div key={ti} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>{t.title}</div>
          {t.rows.length ? (
            <div style={{ overflowX: "auto", border: "1px solid " + C.line, borderRadius: 8 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5, whiteSpace: "nowrap" }}>
                <thead><tr>{t.columns.map((c, ci) => <th key={ci} style={{ textAlign: "left", padding: "5px 8px", color: C.dim, fontWeight: 500, background: C.code, borderBottom: "1px solid " + C.line }}>{c}</th>)}</tr></thead>
                <tbody>{t.rows.map((r, ri) => <tr key={ri}>{r.map((v, ci) => <td key={ci} style={{ padding: "5px 8px", color: cellTone(v, t.columns[ci] || "") || "#cfd8e6", borderTop: ri ? "1px solid " + C.line : undefined, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }} title={v == null ? "" : String(v)}>{v == null || v === "" ? "—" : String(v)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : <div style={{ fontSize: 12, color: C.dim }}>暂无数据</div>}
          {t.note ? <div style={{ fontSize: 11, color: C.dim }}>{t.note}</div> : null}
        </div>
      ))}
      {d.note ? <div style={{ fontSize: 12, color: C.warn, lineHeight: "18px" }}>ⓘ {d.note}</div> : null}
      {(d.errors || []).map((e, i) => <div key={i} style={{ fontSize: 12, color: C.bad }}>⚠ {e}</div>)}
    </Section>
  );
}
