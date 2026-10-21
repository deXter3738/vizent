#!/usr/bin/env node
import { runMcpServer } from "./mcp/server.js";

const USAGE = `visual-agent — visual context for your coding agent

Usage:
  visual-agent mcp     Run the MCP server over stdio (launched by your agent host)
  visual-agent --help  Show this message
`;

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case "mcp":
      await runMcpServer();
      return;
    case "--help":
    case "-h":
    case undefined:
      process.stdout.write(USAGE);
      return;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`visual-agent failed: ${String(error)}\n`);
  process.exitCode = 1;
});
