#!/usr/bin/env node
/** Generate ADMIN_PASS_SALT + ADMIN_PASS_HASH for Cloudflare Pages secrets.
 *  Usage: npm run hash-password -- <password>
 *         npm run hash-password -- <password> <optional-salt-hex>
 *  PBKDF2-SHA256, 100000 iterations, 256-bit key, hex output. */
import { randomBytes, pbkdf2Sync } from "node:crypto";
import { createInterface } from "node:readline";

function derive(password, saltHex) {
  const salt = saltHex || randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
  return { salt, hash };
}

async function readPassword() {
  const arg = process.argv[2];
  if (arg) return arg;
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  return new Promise((resolve) => {
    rl.question("Password (will not be stored): ", (ans) => {
      rl.close();
      resolve(ans);
    });
  });
}

const password = await readPassword();
if (!password || password.length < 8) {
  console.error("Password required (min 8 chars). Pass as argv or type when prompted.");
  process.exit(1);
}
if (password.length >= 256) {
  console.error("Password too long.");
  process.exit(1);
}
const saltArg = process.argv[3];
const { salt, hash } = derive(password, saltArg);
console.log("Set these as Cloudflare Pages secrets / environment variables:");
console.log("ADMIN_PASS_SALT=" + salt);
console.log("ADMIN_PASS_HASH=" + hash);
