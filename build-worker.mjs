import fs from "fs";
const t = fs.readFileSync("src/worker.template.js", "utf8");
const out = t
  .replace("__APP_HTML__", () => JSON.stringify(fs.readFileSync("dist/index.html", "utf8")))
  .replace("__FAVICON__", () => JSON.stringify(fs.readFileSync("dist/favicon.svg", "utf8")));
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/_worker.js", out);
console.log("wrote dist/_worker.js", out.length, "bytes");
console.log("Deploy dist/ to Cloudflare Pages (advanced mode / _worker.js). See docs/deploy.md");
