# 部署到 Cloudflare Pages

## 1. 构建

```bash
npm install
npm run build:worker   # 生成 dist/index.html、dist/favicon.svg、dist/_worker.js
```

## 2. 创建 KV

在 Cloudflare 控制台 → **Workers & Pages** → **KV**：

1. 新建命名空间，例如 `studio-hq-status`
2. 记下 namespace id（仅保存在你自己的账号里，不要提交到 Git）

## 3. 创建 Pages 项目（Advanced mode）

控制台 → **Workers & Pages** → **Create** → **Pages** → 直接上传 `dist/`，或连接 Git 仓库后设置：

- Build command: `npm run build:worker`
- Build output directory: `dist`
- 兼容性：本项目使用 **Advanced mode** 的 `_worker.js`（不是 Functions 目录）

绑定：

| Binding | 类型 | 名称 |
|---|---|---|
| `STATUS` | KV namespace | 你创建的 KV（如 `studio-hq-status`） |

## 4. 环境变量 / Secrets

在 Pages 项目 → **Settings** → **Environment variables**（Production）中设置：

| 名称 | 说明 |
|---|---|
| `ADMIN_USER` | 登录用户名 |
| `ADMIN_PASS_SALT` | 随机盐（hex 字符串） |
| `ADMIN_PASS_HASH` | `npm run hash-password -- yourpassword` 输出的哈希 |
| `SESSION_SECRET` | 长随机串，用于 HMAC 会话签名 |
| `UPDATE_TOKEN` | 长随机串；本地另存为 `.update-token`（已在 `.gitignore`） |
| `COMMAND_WEBHOOK_URL` | （可选）侧栏任务转发 webhook URL |
| `COMMAND_WEBHOOK_KEY` | （可选）webhook 鉴权（Bearer / X-Webhook-Key） |

生成密码哈希：

```bash
npm run hash-password -- 'your-own-password'
# 打印 ADMIN_PASS_SALT=... 与 ADMIN_PASS_HASH=...
```

生成随机密钥示例：

```bash
openssl rand -hex 32   # SESSION_SECRET 或 UPDATE_TOKEN
```

## 5. 会话 Cookie

登录成功后下发 HttpOnly + Secure + SameSite=Lax Cookie，有效期 **30 天**。  
未登录访问 `/` 会看到登录页；`GET /api/status` 需要有效会话。

## 6. 推送状态

```bash
cp .update-token.example .update-token
# 把 UPDATE_TOKEN 的值写入 .update-token（单行，无引号）
./push-status.sh status.json https://your-studio.pages.dev
# 期望：{"ok":true,"count":11}
```

`POST /api/status` 需要 header：`Authorization: Bearer <UPDATE_TOKEN>`，body 为 status JSON（≤ 256 KB）。

## 7. 可选：10 分钟脚本面板 Cron

见仓库根目录 `cron/`：

```bash
cd cron
cp wrangler.toml.example wrangler.toml
# 填入 KV namespace id，binding 名必须是 STATUS
npx wrangler deploy
```

- Cron：`*/10 * * * *`（约每天 144 次 KV 写入，免费档 KV 写配额约 1000/天）
- **Workers 不能请求裸 IP**，请把 `cron/worker.js` 顶部的 `HOST` / `LINK` 改成你的面板主机名（如 `http://panels.example.com`）
- 该 Worker 的 `fetch` 返回 404，无需公开路由

## 8. 本地预览办公室画面

```bash
npm run build
# 用浏览器打开 dist/index.html（内嵌演示 status.json；无登录、无 API）
```

完整登录 + API 行为需要部署到 Pages（或用 Wrangler Pages 本地模拟）。


## 9. 可选：侧栏任务转发（/api/command）

登录后可在成员面板底部发消息。Worker 会把命令写入 KV `commands`（页面以 `outbox` 返回），若配置了 `COMMAND_WEBHOOK_URL`，会再 POST JSON `{ id, botId, name, text, at, status }` 到该地址。未配置时状态为 `queued`，仍可在面板看到发出的任务。

## 同步参数（UI 文案）

`sync/config.json` 控制页头「状态同步 / 脚本面板」说明文案与前端轮询秒数，构建时嵌入。改完需重新 `npm run build:worker` 并部署。  
改 `statusSync` 或 `dashboardSync.intervalMinutes` 时，还须分别改状态推送定时任务与 Cloudflare Cron 的真实 schedule，使文案与调度一致。详见根目录 README「修改同步参数」。
