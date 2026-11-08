import React from "react";
import type { ReactNode, CSSProperties } from "react";
export type { ReactNode, CSSProperties } from "react";
export { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC","Noto Sans CJK SC",system-ui,-apple-system,"Segoe UI",sans-serif';
const T = {
  kind: "dark" as const,
  bg: { base: "#0b1120", subtle: "#111a2c", elevated: "#121b2e" },
  text: { primary: "#e8edf5", secondary: "#9aa6ba", tertiary: "#6b7891", accent: "#5cc8ff", success: "#3ecf8e", warning: "#f5a524", danger: "#ef5f5f" },
  fill: { hover: "rgba(92,200,255,0.08)", accentSubtle: "rgba(92,200,255,0.14)" },
  border: { subtle: "#1f2a40", default: "#2a3852" },
  radius: { sm: 4 as const, md: 8 as const, lg: 12 as const, xl: 16 as const, full: 9999 as const },
  motion: { hover: "140ms", easing: "cubic-bezier(.2,.7,.3,1)" },
  weight: { regular: 400 as const, medium: 500 as const, semibold: 600 as const },
  font: {
    family: FONT, mono: "ui-monospace,Menlo,monospace",
    heading1: { fontSize: "28px", lineHeight: "36px", letterSpacing: "0" },
    heading3: { fontSize: "20px", lineHeight: "26px", letterSpacing: "0" },
    subtext: { fontSize: "14px", lineHeight: "20px", letterSpacing: "0" },
    body2: { fontSize: "13px", lineHeight: "18px", letterSpacing: "0" },
    label: { fontSize: "12px", lineHeight: "16px", letterSpacing: "0" },
    caption: { fontSize: "11px", lineHeight: "16px", letterSpacing: "0" },
  },
};
export const useGrokTheme = () => T;

export function Page(p: { title: string; summary?: string; width?: string; actions?: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(1200px 600px at 20% -10%, #16223a 0%, #0b1120 60%)", color: T.text.primary, fontFamily: FONT, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px clamp(10px,1.4vw,22px) 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg,#5cc8ff,#3ecf8e)", display: "grid", placeItems: "center", color: "#0b1120", fontWeight: 800 }}>工</div>
          <h1 style={{ margin: 0, fontSize: "22px", lineHeight: "28px", fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{p.title}</h1>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>{p.sub}</div>
          {p.actions}
        </div>
        {p.summary ? <p style={{ margin: "0 0 20px", color: T.text.secondary, fontSize: 14, lineHeight: "22px", maxWidth: 900 }}>{p.summary}</p> : null}
        {p.children}
      </div>
    </div>
  );
}

export function Segmented<V extends string>(p: { options: (V | { value: V; label: string; count?: number })[]; value: V; onChange: (v: V) => void }) {
  const opts = p.options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)) as { value: V; label: string; count?: number }[];
  return (
    <div role="tablist" style={{ display: "inline-flex", flexWrap: "wrap", gap: 4, padding: 4, borderRadius: 10, background: "#0f1728", border: "1px solid " + T.border.default }}>
      {opts.map((o) => {
        const on = o.value === p.value;
        return (
          <button key={o.value} role="tab" aria-selected={on} onClick={() => p.onChange(o.value)}
            style={{ all: "unset", cursor: "pointer", padding: "6px 12px", borderRadius: 7, fontSize: 13, lineHeight: "18px", fontWeight: on ? 600 : 500, color: on ? "#e8f6ff" : T.text.secondary, background: on ? "#1d3550" : "transparent", boxShadow: on ? "inset 0 0 0 1px #2f5b80" : "none", transition: "all " + T.motion.hover, whiteSpace: "nowrap" }}>
            {o.label}{o.count != null ? <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Metrics(p: { metrics: { value: string; label: string; detail?: string; tone?: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
      {p.metrics.map((m) => (
        <div key={m.label} style={{ background: T.bg.elevated, border: "1px solid " + T.border.subtle, borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 12, color: T.text.tertiary, marginBottom: 4 }}>{m.label}</div>
          <div style={{ fontSize: 28, lineHeight: "34px", fontWeight: 700, color: m.tone === "warning" ? T.text.warning : T.text.primary }}>{m.value}</div>
          {m.detail ? <div style={{ fontSize: 12, color: T.text.secondary, marginTop: 2 }}>{m.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function Properties(p: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid " + T.border.subtle }}>
      {p.items.map((i) => (
        <div key={i.label} style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: 10, padding: "10px 0", borderBottom: "1px solid " + T.border.subtle, fontSize: 13, lineHeight: "20px" }}>
          <div style={{ color: T.text.tertiary }}>{i.label}</div>
          <div style={{ color: T.text.primary }}>{i.value}</div>
        </div>
      ))}
    </div>
  );
}

export function Status(p: { tone?: string; children?: ReactNode }) {
  const c = p.tone === "success" ? T.text.success : p.tone === "warning" ? T.text.warning : p.tone === "danger" ? T.text.danger : "#a3acb9";
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 999, fontSize: 12, lineHeight: "18px", color: c, background: c + "1f", border: "1px solid " + c + "40" }}><span style={{ width: 6, height: 6, borderRadius: 9, background: c }} />{p.children}</span>;
}

export function Button(p: { label: string; onClick: () => void; variant?: string }) {
  return <button onClick={p.onClick} style={{ cursor: "pointer", padding: "7px 14px", borderRadius: 8, fontSize: 13, fontFamily: FONT, color: T.text.primary, background: p.variant === "primary" ? "#1d3550" : "#18233a", border: "1px solid " + T.border.default }}>{p.label}</button>;
}
