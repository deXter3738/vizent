import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SESSION_DIR, SESSION_FILE } from "../shared/constants.js";
import type { SessionInfo } from "../shared/types.js";

/** Absolute path of the handshake file for a given project root. */
export function sessionFilePath(root: string): string {
  return path.join(root, SESSION_DIR, SESSION_FILE);
}

/**
 * Make sure `.visual-agent/` is gitignored. Appends to an existing .gitignore
 * rather than rewriting it, and creates one only if the project has none.
 */
export function ensureGitignored(root: string): void {
  const gitignorePath = path.join(root, ".gitignore");
  const entry = `${SESSION_DIR}/`;

  let existing = "";
  try {
    existing = fs.readFileSync(gitignorePath, "utf8");
  } catch {
    // No .gitignore yet; one is created below.
  }

  const alreadyIgnored = existing
    .split(/\r?\n/)
    .some((line) => line.trim() === entry || line.trim() === SESSION_DIR);
  if (alreadyIgnored) return;

  const prefix = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  fs.appendFileSync(gitignorePath, `${prefix}${entry}\n`, "utf8");
}

/**
 * Write the handshake file the MCP server reads to find this dev server.
 * The token is a fresh 256-bit secret per server start.
 */
export function writeSession(root: string, host: string, port: number): SessionInfo {
  const info: SessionInfo = {
    version: 1,
    projectRoot: root,
    host,
    port,
    token: crypto.randomBytes(32).toString("hex"),
    startedAt: new Date().toISOString(),
    pid: process.pid,
  };

  const target = sessionFilePath(root);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // 0600: the token is a local secret, so keep it owner-readable only.
  fs.writeFileSync(target, `${JSON.stringify(info, null, 2)}\n`, { mode: 0o600 });
  return info;
}

/** Remove the handshake file so a stale port is never advertised. */
export function clearSession(root: string): void {
  try {
    fs.rmSync(sessionFilePath(root));
  } catch {
    // Already gone.
  }
}
