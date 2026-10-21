import fs from "node:fs";
import path from "node:path";
import { SESSION_DIR, SESSION_FILE } from "../shared/constants.js";
import type { SessionInfo } from "../shared/types.js";

/** Loopback hosts the MCP server is willing to talk to. */
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/**
 * Locate the running dev server's handshake file.
 *
 * Checks `VISUAL_AGENT_ROOT` first — useful in a monorepo, where the agent host
 * starts in the repo root but the dev server runs in a sub-package — then walks
 * up from `startDir`, so running the MCP server anywhere inside a project works.
 */
export function findSession(startDir: string = process.cwd()): SessionInfo | null {
  const override = process.env["VISUAL_AGENT_ROOT"];
  if (override) {
    const candidate = path.join(path.resolve(startDir, override), SESSION_DIR, SESSION_FILE);
    return fs.existsSync(candidate) ? readSession(candidate) : null;
  }

  let dir = path.resolve(startDir);

  for (;;) {
    const candidate = path.join(dir, SESSION_DIR, SESSION_FILE);
    if (fs.existsSync(candidate)) {
      const parsed = readSession(candidate);
      if (parsed) return parsed;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readSession(file: string): SessionInfo | null {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;

  const value = raw as Partial<SessionInfo>;
  if (value.version !== 1) return null;
  if (typeof value.port !== "number" || typeof value.token !== "string") return null;
  if (typeof value.host !== "string" || !ALLOWED_HOSTS.has(value.host)) return null;
  if (typeof value.projectRoot !== "string") return null;

  return value as SessionInfo;
}

/** URL of a dev-server route for this session. Always loopback. */
export function sessionUrl(session: SessionInfo, route: string): string {
  const host = session.host === "::1" ? "[::1]" : session.host;
  return `http://${host}:${session.port}${route}`;
}
