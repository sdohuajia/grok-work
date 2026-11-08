/** Build-time sync schedule (from sync/config.json via esbuild define). */
export type SyncConfig = {
  timezone: string;
  statusSync: { hours: number[]; minute: number };
  dashboardSync: { intervalMinutes: number };
  pageRefreshSeconds: number;
};

export const SYNC_DEFAULTS: SyncConfig = {
  timezone: "Asia/Shanghai",
  statusSync: { hours: [0, 12], minute: 0 },
  dashboardSync: { intervalMinutes: 10 },
  pageRefreshSeconds: 60,
};

declare const __SYNC_CONFIG__: SyncConfig | undefined;

function load(): SyncConfig {
  try {
    const c = typeof __SYNC_CONFIG__ !== "undefined" ? __SYNC_CONFIG__ : undefined;
    if (!c || typeof c !== "object") return SYNC_DEFAULTS;
    const hours = Array.isArray(c.statusSync?.hours) ? c.statusSync.hours.map(Number).filter((n) => Number.isFinite(n)) : SYNC_DEFAULTS.statusSync.hours;
    const minute = Number.isFinite(Number(c.statusSync?.minute)) ? Number(c.statusSync.minute) : SYNC_DEFAULTS.statusSync.minute;
    const intervalMinutes = Number.isFinite(Number(c.dashboardSync?.intervalMinutes)) ? Number(c.dashboardSync.intervalMinutes) : SYNC_DEFAULTS.dashboardSync.intervalMinutes;
    const legacy = c as { pageRefreshSeconds?: number; pagePollSeconds?: number };
    const raw = legacy.pageRefreshSeconds ?? legacy.pagePollSeconds;
    const pageRefreshSeconds = Number.isFinite(Number(raw)) ? Number(raw) : SYNC_DEFAULTS.pageRefreshSeconds;
    return {
      timezone: typeof c.timezone === "string" && c.timezone ? c.timezone : SYNC_DEFAULTS.timezone,
      statusSync: { hours: hours.length ? hours : SYNC_DEFAULTS.statusSync.hours, minute },
      dashboardSync: { intervalMinutes: intervalMinutes > 0 ? intervalMinutes : SYNC_DEFAULTS.dashboardSync.intervalMinutes },
      pageRefreshSeconds: pageRefreshSeconds > 0 ? pageRefreshSeconds : SYNC_DEFAULTS.pageRefreshSeconds,
    };
  } catch {
    return SYNC_DEFAULTS;
  }
}

export const SYNC: SyncConfig = load();

function pad2(n: number): string {
  return String(Math.trunc(n)).padStart(2, "0");
}

/** e.g. "每天 00:00 / 12:00" */
export function statusSyncTimesLabel(): string {
  const m = pad2(SYNC.statusSync.minute);
  const times = SYNC.statusSync.hours.map((h) => pad2(h) + ":" + m).join(" / ");
  return "每天 " + times;
}

/** e.g. "每 10 分钟自动更新" */
export function dashboardAutoLabel(): string {
  return "每 " + SYNC.dashboardSync.intervalMinutes + " 分钟自动更新";
}

export function statusSyncTooltip(): string {
  return "成员状态与最新消息的同步时间（" + statusSyncTimesLabel() + "）";
}

export function dashboardSyncTooltip(): string {
  return "脚本面板数据时间（" + dashboardAutoLabel() + "）";
}

export function snapshotDashExtra(): string {
  return "快照 · " + statusSyncTimesLabel() + " 更新";
}
