import { build } from "esbuild"; import fs from "fs";
const syncConfig = JSON.parse(fs.readFileSync("sync/config.json", "utf8"));
const r = await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  minify: true,
  write: false,
  jsx: "automatic",
  format: "iife",
  define: {
    "process.env.NODE_ENV": '"production"',
    __SYNC_CONFIG__: JSON.stringify(syncConfig),
  },
  target: "es2019",
  charset: "utf8",
});
const js = r.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
const fav = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><polygon points='32,6 58,19 32,32 6,19' fill='%23d4a06a'/><polygon points='6,19 32,32 32,58 6,45' fill='%23efe9de'/><polygon points='58,19 32,32 32,58 58,45' fill='%23c9c1b1'/><rect x='26' y='12' width='12' height='10' rx='2' fill='%235cc8ff'/></svg>`;
const html = `<!doctype html><html lang="zh-Hans"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>工作室 · 总部大楼</title><meta name="description" content="工作室 · 总部大楼：11 个 Grok Bot 的等距办公楼"><meta name="theme-color" content="#0b1120"><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${fav}"><style>html,body{margin:0;background:#0b1120}*{box-sizing:border-box}button:focus-visible{outline:2px solid #5cc8ff;outline-offset:2px}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
fs.mkdirSync("dist", { recursive: true }); fs.writeFileSync("dist/index.html", html);
fs.writeFileSync("dist/favicon.svg", decodeURIComponent(fav));
console.log("ok", html.length, "sync", JSON.stringify(syncConfig));
