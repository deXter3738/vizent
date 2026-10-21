import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  ACK_EVENT,
  MAX_SELECTION_BYTES,
  SELECTION_EVENT,
  SELECTION_ROUTE,
} from "../shared/constants.js";
import type { Selection } from "../shared/types.js";
import { clearSession, ensureGitignored, writeSession } from "./session.js";

/** Loopback forms Node reports for a local socket. */
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** Exported for tests: only loopback peers may read a selection. */
export function isLoopback(req: Pick<IncomingMessage, "socket">): boolean {
  const address = req.socket.remoteAddress;
  return address !== undefined && LOOPBACK.has(address);
}

/** Constant-time comparison, so a wrong token leaks nothing by timing. */
function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function readToken(req: IncomingMessage): string | null {
  const header = req.headers["authorization"];
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  const custom = req.headers["x-visual-agent-token"];
  if (typeof custom === "string") return custom.trim();
  return null;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(payload);
}

/**
 * Validate an incoming selection. The page is untrusted, so every field is
 * checked and every string is bounded before it is kept.
 */
function parseSelection(raw: unknown): Selection | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value["tagName"] !== "string") return null;
  if (typeof value["url"] !== "string") return null;
  if (JSON.stringify(raw).length > MAX_SELECTION_BYTES) return null;
  return raw as Selection;
}

export type BridgeOptions = {
  root: string;
  verbose: boolean;
};

/**
 * Wires the page to the dev server: receives selections over the HMR socket,
 * keeps the latest one in memory, and serves it to the MCP server over a
 * token-guarded, loopback-only route.
 */
export function createBridge(server: ViteDevServer, options: BridgeOptions): void {
  let current: Selection | null = null;
  let token: string | null = null;

  ensureGitignored(options.root);

  const httpServer = server.httpServer;
  if (httpServer) {
    httpServer.once("listening", () => {
      const address = httpServer.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      const session = writeSession(options.root, "127.0.0.1", port);
      token = session.token;
      server.config.logger.info(
        `  \x1b[36m➜\x1b[0m  \x1b[1mVisual Agent\x1b[0m: picker ready — press Alt+V in the page`,
      );
    });
  }

  const cleanup = (): void => clearSession(options.root);
  httpServer?.once("close", cleanup);
  process.once("exit", cleanup);

  server.hot.on(SELECTION_EVENT, (data: unknown, client) => {
    const selection = parseSelection(data);
    if (!selection) {
      client.send(ACK_EVENT, { ok: false, reason: "invalid selection payload" });
      return;
    }
    current = selection;
    if (options.verbose) {
      const where = selection.source
        ? `${selection.source.file}:${selection.source.line}:${selection.source.column}`
        : "unstamped";
      server.config.logger.info(`  Visual Agent: selected <${selection.tagName}> at ${where}`);
    }
    client.send(ACK_EVENT, { ok: true });
  });

  server.middlewares.use(SELECTION_ROUTE, (req, res) => {
    if (!isLoopback(req)) {
      sendJson(res, 403, { error: "visual-agent only serves loopback requests" });
      return;
    }
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "use GET" });
      return;
    }
    const provided = readToken(req);
    if (!token || !provided || !tokensMatch(provided, token)) {
      sendJson(res, 401, { error: "missing or invalid token" });
      return;
    }
    sendJson(res, 200, { selection: current });
  });
}
