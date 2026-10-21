# Visual Agent

Point at your running localhost UI and let your own coding agent edit the real
source code.

> **Status: spike.** This repository currently proves one thing — that a clicked
> element maps to the correct source file and line, and that an MCP host such as
> Claude Code can read that selection. Suggestions, the properties panel, the
> design-system gallery and any code editing are **not** built yet. See
> [`docs/PRD.md`](docs/PRD.md) for where this is going, and
> [`docs/SPIKE-REPORT.md`](docs/SPIKE-REPORT.md) for what the spike measured.

## What works today

| Capability | State |
| --- | --- |
| Stamp every plain HTML element with its source file, line and column | ✅ |
| Flag elements rendered inside a `.map()` loop | ✅ |
| Shadow-DOM element picker with hover, click and a details panel | ✅ |
| Push selections to the dev server over Vite's HMR socket | ✅ |
| Read the current selection from an MCP host | ✅ |
| Edit code, suggest changes, accept/reject | ❌ not in the spike |

## Requirements

- Node 24 (LTS) or newer
- pnpm 12
- A Vite + React project

## Quick start

```bash
pnpm install
pnpm dev          # builds the plugin, then starts the demo app
```

Open <http://localhost:5173> (the port is printed in the terminal), then:

1. Press **Alt + V** (**Option + V** on a Mac) to turn the picker on.
2. Hover to outline an element; **click** to select it.
3. **Esc** clears the selection; Esc again (or Alt + V) exits the picker.
4. Holding **Alt** on its own gives a temporary peek without entering the mode.

The panel in the bottom-right shows the source file, line and column, the
nearest component name, the class list, the DOM path, and the computed padding,
margin, gap, font size, color, background and border radius. It also warns when
the element renders inside a loop, or when the source stamp came from an
ancestor rather than the element itself.

## Using it in your own project

```bash
npm install -D visual-agent
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualAgent } from "visual-agent";

export default defineConfig({
  // visualAgent() must come first so it sees your JSX before it is compiled.
  plugins: [visualAgent(), react()],
});
```

Options:

| Option | Default | What it does |
| --- | --- | --- |
| `hotkey` | `"v"` | The key pressed with Alt/Option to toggle the picker. |
| `verbose` | `false` | Log each selection to the dev-server terminal. |

The plugin sets `apply: "serve"`, so it is inert during `vite build` and cannot
reach a production bundle.

## Connecting a coding agent

The MCP server is a separate process your agent host launches. In this repo both
a root `.mcp.json` and one inside `examples/demo-react-app` are already written,
so Claude Code will offer to connect on startup.

For your own project, add `.mcp.json` next to your `package.json`:

```json
{
  "mcpServers": {
    "visual-agent": {
      "command": "npx",
      "args": ["visual-agent", "mcp"]
    }
  }
}
```

Then, with the dev server running and an element selected, ask your agent:

> what element did I select?

### Tools

| Tool | What it returns |
| --- | --- |
| `get_browser_context` | The current selection: source file, line, column, component, loop flag, bounds and computed styles. Anything read from the DOM is fenced under an explicit **Untrusted page content** heading. |
| `debug_sleep(seconds)` | Waits, then reports actual elapsed time. Used to measure how long a given MCP host tolerates a blocking tool call. Capped at 120s. |

### How the agent finds the dev server

On start, the plugin writes `.visual-agent/session.json` with the project root,
port, pid and a fresh 256-bit token, with owner-only file permissions, and adds
`.visual-agent/` to `.gitignore`. The file is deleted when the server stops. The
MCP server walks up from its working directory to find it.

In a monorepo, where the agent host starts in the repo root but the dev server
runs in a sub-package, set `VISUAL_AGENT_ROOT` to that sub-package:

```json
{
  "mcpServers": {
    "visual-agent": {
      "command": "npx",
      "args": ["visual-agent", "mcp"],
      "env": { "VISUAL_AGENT_ROOT": "examples/demo-react-app" }
    }
  }
}
```

## Repository layout

```
packages/visual-agent     the plugin, overlay, bridge, MCP server and CLI
examples/demo-react-app   Vite + React 19 + Tailwind v4 test app
docs/PRD.md               the product requirements document
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Build the plugin, then run the demo app |
| `pnpm test` | Run the mapping-accuracy and edge-case suites |
| `pnpm typecheck` | Type-check every package |
| `pnpm build` | Build the plugin package |

## Security and privacy

- **No telemetry.** Nothing is sent anywhere. The only network traffic is between
  your browser, your dev server and your own agent.
- The selection route binds to loopback only and rejects any peer that is not
  `127.0.0.1` or `::1`, on top of requiring the session token.
- Selections are held in memory. Page content is never written to disk.
- DOM text and attributes are labelled as untrusted page content in every tool
  response, to limit prompt injection from a page the user is viewing.
- No MCP tool in this spike writes files or runs commands.

## License

MIT
