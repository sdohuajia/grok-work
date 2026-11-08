# 工作室 · 总部大楼 — status JSON

用 `./push-status.sh <file.json> https://your-studio.pages.dev` 推送（`POST /api/status`，header `Authorization: Bearer <token in .update-token>`），写入 KV（示例命名空间名 `studio-hq-status`，key `status`）。页面登录后每 60 秒 `GET /api/status`。

## Format

```json
{
  "updatedAt": "2026-11-07T12:00:00+08:00",
  "bots": [
    {
      "id": "b0b237f9-1bf0-4351-99e8-7cb08e7280e9",
      "name": "空投消息助手",
      "dept": "intel",
      "role": "情报员 · 推特一手消息",
      "state": "working",
      "summary": "整理今日情报简报（示例）",
      "lastActive": "2026-11-07T09:00:00+08:00",
      "messages": [{ "at": "2026-11-07T09:00:00+08:00", "text": "…" }],
      "dashboard": { "title": "…", "url": "…", "fetchedAt": "…", "stats": [], "tables": [], "errors": [] }
    }
  ]
}
```

| field | required | notes |
|---|---|---|
| `updatedAt` | no | 快照构建时间（ISO 8601，建议 `+08:00`）。缺失时服务端用接收时间。 |
| `bots[].id` | yes | bot/agent id（见下表）。未知 id 会存入但不画桌子。 |
| `bots[].state` | yes | `working` / `idle` / `paused`。其它值 → 400。 |
| `bots[].summary` | no | 一句中文当前任务/最新结果。建议 ≤ 80 字。 |
| `bots[].lastActive` | no | ISO 8601；页面显示为「11月7日 09:00（北京时间）」。未知用 `""`。 |
| `bots[].name/dept/role` | no | 信息性；`role` 可覆盖展示职位。桌位由前端按 id 固定。 |
| `bots[].messages` | no | 最新可见回复，新→旧，最多 10（页面显示 5）：`[{"at","text"}]`。`text` ≤ 4000。由 `sync/extract_messages.py` 生成。 |
| `bots[].dashboard` | no | 脚本面板快照（≤ 60 KB）：`{title,url,fetchedAt,note?,stats,tables,errors}`。无脚本的 bot 可省略。 |

服务端 GET 返回 `{ updatedAt, receivedAt, bots }`。Body 上限 256 KB，最多 200 bots。

GET 实际还可包含 `usage?`、`outbox?`、`dashboardsFetchedAt?`。

### `usage`（可选）

每周额度百分比等字段；省略时 Worker 保留旧值。页面顶栏「Grok 用量」药丸展示；无数据则隐藏。不要编造绝对总量。

### `POST /api/command` + `outbox`

登录 Cookie；`{ botId, text }`；命令存 KV `commands`（不进 status 文档）。可选 webhook：`COMMAND_WEBHOOK_URL` / `COMMAND_WEBHOOK_KEY`。

### 同步参数

`sync/config.json`（见 `sync/config.example.json`）控制构建期文案与页面轮询；改真正的 cron 需另改定时任务。


## Bot mapping（演示阵容，与 `src/App.tsx` PEOPLE 一致）

| id | name | dept | role |
|---|---|---|---|
| b72f5af7-af35-4be4-99e5-26e63c5fd282 | 工作室 | ceo 总经办 | 总经理 · CEO |
| b0b237f9-1bf0-4351-99e8-7cb08e7280e9 | 空投消息助手 | intel 情报部 | 情报员 · 推特一手消息 |
| 0f6b9c8c-b593-4aab-8952-70085ca38248 | 查询 | intel 情报部 | 数据查询员 |
| eef4929f-3af1-4a90-b1a1-134eb093ff7e | 交易大神 | trade 交易部 | 首席交易员 |
| 2d65bcdb-02a1-4079-96bb-d60864f5d3b1 | 币安AI agent | trade 交易部 | 交易员 · 链上卖出 |
| dec85747-0ea6-4655-93d2-9a5e0b2e6b10 | 脚本检查执行 | dev 自动化 · 研发部 | 脚本工程师 |
| c78a06c8-3b83-4670-b132-1b2090f71185 | popdex自动化 | dev 自动化 · 研发部 | 自动化工程师 · PopDEX |
| 64bc81fe-462b-4a7a-ae86-96e2bf3fbb63 | Entropy套利 | dev 自动化 · 研发部 | 套利工程师 |
| 6fcbf63d-f5ef-48f7-b00c-275be133637f | 挖矿 | mine 矿场 | 矿工 |
| 463c6096-1807-47de-ab54-bed0b8fab06a | 写作 | content 内容 · 社区部 | 内容策划 |
| 7f2dd154-d1ac-4a87-a470-4896e3d882b2 | 服务器维护 | dev 自动化 · 研发部 | 运维工程师 · 服务器安全 |

自定义成员时：同时改 `src/App.tsx` 的 `PEOPLE`、`status.json`、`sync/topics.json`，以及（若用面板）`cron/worker.js` / `sync/fetch_dashboards.py` 的 `JOBS`。

## state 建议

- `paused` — 已停/暂停且未恢复
- `working` — 仍在盯盘、巡检、跑脚本等
- `idle` — 上一个任务已交付，等待新指令

`working` 的角色会坐回工位；`idle` / `paused` 会在楼里闲逛。

## 最新消息（messages）— 只保留本职话题

关键词在 `sync/topics.json`。流程概要：

1. 用 Grok Bot 的 `ReadTranscript`（或 `SearchTranscripts`）拉某 bot 对话到本地 dump
2. `python3 sync/extract_messages.py --bot <id> dump.txt … > sync/messages/<id>.json`
3. 或搜索兜底：`python3 sync/extract_search.py --bot <id> dump.txt …`
4. 人工删掉仍偏题的条目（不要改写原文）
5. `python3 sync/merge.py status.json sync/messages sync/dashboards.json`

定时任务环境未必有 `ReadTranscript`；完整同步更适合在可交互的对话里跑。

## 脚本面板（dashboard）

**可选主源：** Cloudflare Worker `studio-hq-cron`（`cron/worker.js`，`*/10 * * * *`）与 `fetch_dashboards.py` 同源解析，写入 KV key `dashboards`。GET `/api/status` 按 bot 取 `fetchedAt` 更新的那份。抓不到的面板保留上次成功数据并标 `stale`。

本地抓取（面板需 HTTP 可达）：

```bash
export SCRIPT_HOST=http://panels.example.com   # Workers/本机均需主机名，勿用裸 IP
export POPDEX_URL=https://panels.example.com/
python3 sync/fetch_dashboards.py > sync/dashboards.json
```

演示 JOBS 端口约定（可按你的面板改）：

| bot | 默认端口 / 路径 |
|---|---|
| Entropy套利 | `:8001` arb-bot |
| 脚本检查执行 | `:8010` PARALLAX |
| 交易大神 | `:8011` |
| 写作 | `:8766` |
| popdex自动化 | `POPDEX_URL` + `:8080` 仅探活 |

## 合并与推送

```bash
python3 sync/merge.py status.json sync/messages sync/dashboards.json
# 设置 updatedAt 为当前时间后：
./push-status.sh status.json https://your-studio.pages.dev
```

页头显示「状态同步」与「脚本面板」时间；务必写真实的 `updatedAt`。浏览器不会去轮询你的面板 IP/主机。


## Sync schedule labels

UI copy for status/dashboard cadence and the browser poll interval come from `sync/config.json` (see `sync/config.example.json`). Defaults: status sync 00:00 & 12:00 (Asia/Shanghai), dashboard every 10 minutes, page poll 60s. Editing the file alone does not change Cloudflare cron or the Grok routine schedule — update those to match if you change the numbers, then rebuild the frontend.
