# Visual Agent — PRD

Oct 21, 2026 · @shreyas Bhosale

## Overview and problem

Visual Agent is a free, open-source npm package that lets you point at your running localhost UI and have your own coding agent edit the real source code, with every change reviewed as an inline suggestion.

Today, refining UI with an AI agent means describing elements in words, guessing file names, and reading diffs that don't show what changed visually. The loop between browser, editor and agent is slow and lossy.

Visual Agent closes that loop: select an element, describe the change, watch the agent edit the code, then accept or reject each change on the element itself. It adds the visual context agents lack; it does not replace the agent or the editor.

## Goals, non-goals and success metrics

v1 succeeds when a design engineer can select an element, request a change, and accept the correct source edit without leaving the browser.

**Goals**

- Map a selected element to the correct source file and line
- Let any MCP-compatible agent edit the code, with Claude Code as the first-class host
- Review every change as an inline suggestion with accept, reject and a reason
- Keep everything local, free and open source

**Non-goals for v1**

- Running or hosting a model; users bring their own agent
- Production sites, non-localhost pages or a no-code editor
- Multiple agents editing at once
- A desktop app or browser extension
- Static export of the design-system gallery

**Success metrics**

| Metric | Target | How measured |
| --- | --- | --- |
| Source mapping accuracy | 95% of selections resolve to the correct file and line | Test suite on demo apps |
| Time from install to first accepted edit | Under 5 minutes | Tester sessions |
| Suggestions accepted without manual fixes | 70% | Tester feedback |
| Early adopters | 5 design engineers using it weekly | Direct outreach |

Targets are starting assumptions to revisit after the first tester round. There is no telemetry, so metrics come from tests and testers.

## Target users and use cases

The primary user is a design engineer, or a designer who writes frontend code, working in a Vite + React project with a coding agent.

They already run dev servers, use git and work in Claude Code or Cursor. They care about precise edits that respect the design system, and they sometimes work from Figma.

**Core use cases**

1. **Polish a component.** Select a card, ask for more padding and a softer shadow, and accept the change using existing tokens.
2. **Fix one instance or all.** Change only this button, or change the Button component everywhere.
3. **Work across states.** Adjust hover, focus, disabled and dark-mode styles, and check them at mobile and desktop widths.
4. **Match a design.** Attach a Figma frame link and ask the agent to make the element match it.
5. **Batch refinements.** Annotate several elements in one request and review each suggestion separately.
6. **Audit the design system (v1.5).** Open the live gallery to see every component and state, then edit from there.

## Principles and positioning

Visual Agent owns visual context and review; the coding agent owns source edits; MCP connects them.

**Principles**

- **Local-first:** nothing leaves the machine except what the user's own agent sends.
- **Agent-agnostic core:** MCP tools work in any host; host-specific features are optional layers.
- **Real code, not DOM patches:** every change is a source edit the user can review in git.
- **Design-system native:** edits use existing tokens and components, never hardcoded values.
- **User stays in control:** every change is a suggestion until accepted, and rollback is always one click.

**Positioning**

| Tool | What it does | Visual Agent's difference |
| --- | --- | --- |
| MCP Pointer | Option+Click an element and expose its DOM info over MCP | Precise source mapping, suggestion review, design-system awareness |
| Agent QA Console | Agent drives a Playwright browser, selects elements and verifies fixes | Works in the user's own browser and dev server, with per-change accept and reject |
| Built-in agent browsers | The agent screenshots and inspects a preview pane | Human-directed selection, annotations and a review layer |

Pitch: point at your running UI, and your agent edits it the way a design engineer would, with your tokens, in the right component, across states.

## v1 functional requirements

v1 supports Vite + React with Tailwind or CSS variables, in any browser, with Claude Code as the first-class host.

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| R1 | Install | `npm i -D visual-agent` plus `npx visual-agent init` adds the Vite plugin, writes `.mcp.json` and optionally installs Claude Code hooks | Must |
| R2 | Install | The plugin runs only in dev (`apply: "serve"`) and never ships in production builds | Must |
| R3 | Picker | Hover outlines, click to select, multi-select, and a floating instruction panel | Must |
| R4 | Picker | Capture DOM path, text, computed styles, bounds, a screenshot crop, and active state, theme and viewport | Must |
| R5 | Mapping | A compile-time transform stamps `data-va-source` (file, line, component) on elements | Must |
| R6 | Mapping | Fall back to framework debug info, then to rich context for the agent to search | Should |
| R7 | Scope | The user chooses "this instance" or "the component everywhere" per request | Must |
| R8 | Design system | Map computed values to Tailwind tokens and CSS variables in the element context | Must |
| R9 | Requests | One request queue fed by the browser panel and by agent chat | Must |
| R10 | Requests | Browser-panel requests reach the agent through a bounded long-poll tool and an MCP prompt | Must |
| R11 | Requests | Optional Figma frame link per request, passed through to the agent | Should |
| R12 | Suggestions | Diff against the checkpoint, split into hunks and map each hunk to its element | Must |
| R13 | Suggestions | An inline card per change shows what changed, the agent's reason, and Accept or Reject | Must |
| R14 | Suggestions | Accept all, reject all, and grouping of linked hunks into one suggestion | Must |
| R15 | Suggestions | Live agent presence and status labels on the element being edited | Should |
| R16 | Verify | After hot reload, re-find the element by source attribute and capture before and after | Must |
| R17 | Verify | A before and after toggle on each suggestion | Should |
| R18 | Rollback | Git checkpoint before each request; reject reverts only that hunk | Must |
| R19 | Rollback | Never overwrite or reset pre-existing uncommitted user changes | Must |

**Editing lifecycle**

1. Select one or more elements.
2. Describe the change in the browser panel or agent chat.
3. The bridge checkpoints git and queues the request.
4. The agent retrieves context through MCP and edits source with its own tools.
5. Hooks or MCP calls stream edits and status to the overlay.
6. The overlay shows a suggestion card per change after hot reload.
7. The user accepts or rejects each suggestion; rejected hunks are reverted.

## Properties panel

A Figma-style right panel lets users edit styles directly; simple edits commit through a deterministic codemod, and only ambiguous ones go to the agent.

| ID | Area | Requirement | Phase |
| --- | --- | --- | --- |
| P1 | Layout | Flex or grid, direction, gap, alignment, padding and wrap, like auto layout | v1 |
| P2 | Size | Fixed, hug or fill (fixed width, `fit-content`, `100%` or `flex-1`), plus min and max | v1 |
| P3 | Typography | Font, size, weight, line height, letter spacing, alignment | v1 |
| P4 | Fill and stroke | Background, text color, opacity, border width, color and style | v1 |
| P5 | Radius and effects | Corner radius, shadows, blur | v1 |
| P6 | Tokens | Inputs offer token names, not raw values | v1 |
| P7 | Tokens | Flag detached, hardcoded values with a one-click "use nearest token" | v1 |
| P8 | Provenance | Show whether a value comes from a class, CSS variable, prop or inheritance | v1 |
| P9 | States | A states bar for default, hover, focus, disabled, dark and breakpoints | v1.5 |
| P10 | Component props | Variant, size and boolean props from `cva` or TypeScript types | v1.5 |

**Commit rules**

Every edit previews instantly as an inline style, then commits on release or after a short pause, as one batched edit.

The deterministic path is used when:

- The stamped element has a literal `className`, or `cn()` and `clsx()` with literal strings; classes are swapped by AST edit using tailwind-merge conflict rules
- A state or breakpoint edit maps to a prefix such as `hover:`, `dark:` or `md:`
- A prop value is a string literal
- A component-scope edit targets a literal inside a `cva` definition

The agent path is used when:

- `className` is a dynamic expression or computed from props
- Styles live in CSS modules, styled-components or plain CSS files
- The value comes from a parent component or a passed-down prop
- The element renders inside a `.map()` loop and the user picks "only this one"

Editing a token's own value is global and always asks for confirmation. Both paths create a checkpoint and a suggestion card, labeled "Direct edit" or with the agent's name. After hot reload, the computed style is compared with the panel value; a mismatch escalates to the agent with that context.

## v1.5 design-system gallery

v1.5 adds a live, dev-only page at `/__visual-agent/design-system` that shows every token, component and state, rendered with the app's real CSS.

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| G1 | Tokens | Extract colors, spacing, typography, radii and shadows from the Tailwind theme and CSS variables | Must |
| G2 | Inventory | Find components and props by static TypeScript analysis; read `cva` and `tailwind-variants` definitions directly | Must |
| G3 | States | Render a matrix of variants, sizes and boolean props such as disabled and loading | Must |
| G4 | States | Force hover, focus and active by rewriting pseudo-class rules into classes | Must |
| G5 | States | Theme toggle and breakpoint iframes at mobile, tablet and desktop widths | Should |
| G6 | Fixtures | An `/extract-design-system` command asks the agent to write `*.va.tsx` fixtures with realistic props and providers | Must |
| G7 | Fixtures | Record real props seen while browsing the app; import existing Storybook stories when present | Could |
| G8 | Robustness | An error boundary per cell shows "needs fixture" instead of breaking the page | Must |
| G9 | Performance | Render cells lazily as they scroll into view | Should |
| G10 | Editing | The picker and suggestion cards work in the gallery, defaulting to component scope | Must |
| G11 | Insights | Report hardcoded values that miss tokens, near-duplicate components and missing states | Could |

Configuration accepts `globalStyles` and a provider `wrapper` file. Caches live in a gitignored `.visual-agent/` folder; teams choose whether to commit fixtures.

## Multi-agent collaboration (v2)

v1 stays single-agent; v2 adds light parallelism, with several agents on one branch coordinated by the bridge.

| Friction | v2 approach |
| --- | --- |
| Agents overwrite each other's edits to the same file | Leases: an agent claims a file or component before editing |
| A broken edit breaks hot reload for every agent | Pause other agents' verification until the page builds again |
| Diffs can't tell which agent wrote which hunk | Tag every edit with its session through hooks |
| Rejecting one suggestion breaks another that depends on it | Track dependencies; group suggestions per task |
| Agents duplicate or contradict each other | A planner splits requests into non-overlapping tasks with shared context |
| Two agents pull the same request over MCP | Session IDs on every tool call; each request assigned to one agent |
| Too many cards to review | "Accept this task" groups related suggestions |
| Usage limits drain faster | Show active agents and let users cap them |

Fully isolated agents in separate worktrees, with a merge preview, are out of scope until light parallelism works.

## Architecture and integration

One npm package provides the plugin, the overlay and the MCP server; the agent host edits source with its own tools.

&#91;embedded content: architecture · 5 parts, all local\]

The plugin is the hub: it talks to the page over the dev server's WebSocket, diffs edits against each checkpoint, and serves context to the MCP server.

**MCP tools (v1)**

| Tool | Purpose | Access |
| --- | --- | --- |
| `get_browser_context` | Current URL, viewport, selections and their source hints | Read |
| `inspect_element` | DOM structure, computed styles, tokens, state | Read |
| `get_pending_requests` | Requests queued from the browser panel | Read |
| `wait_for_request` | Bounded long-poll for new browser-panel requests | Read |
| `report_change` | File, lines and reason for each change | Write to overlay only |
| `set_status` | Presence label shown on the element | Write to overlay only |
| `request_visual_verification` | Capture the updated element after hot reload | Read |
| `get_project_info` | Active project, framework and styling system | Read |

**Claude Code layer (optional)**

- A plugin bundles the MCP config, hooks and an `/apply-visual-edits` command.
- A PostToolUse hook streams each file edit to the overlay as it happens.
- A Stop hook triggers verification and marks the request ready for review.

Other hosts get the same MCP tools without live hook events.

The plugin also hosts the codemod engine for deterministic panel edits: it parses the stamped file, applies the change and writes it through the same checkpoint and suggestion flow as agent edits.

## Security and privacy

Visual Agent exposes read-only visual context; all file and shell actions stay inside the agent's own permission system.

| Boundary | Required control |
| --- | --- |
| Page to overlay | Treat DOM text and attributes as untrusted; label them as page content in tool output to limit prompt injection |
| Overlay to bridge | Same-origin dev-server channel, session token, schema validation and message size limits |
| MCP server to bridge | Discover the dev server through `.visual-agent/session.json`; bind to `127.0.0.1` only |
| MCP host to server | Validate tool arguments and scope every request to the active project root |
| Agent to filesystem and shell | No MCP tool writes arbitrary files or runs commands in v1 |
| User to changes | Git checkpoint per request, per-hunk revert, no automatic resets |

**Privacy**

- No telemetry in v1, stated plainly in the README.
- Screenshots and page content stay local unless the user's agent sends them to its model.
- Logs record actions, not page content, and live in the gitignored `.visual-agent/` folder.
- The plugin is dev-only and cannot appear in production bundles.

## Roadmap and acceptance criteria

Work moves in four phases, and each phase starts only after the previous gate passes. No dates are set yet.

&#91;embedded content: roadmap · 4 phases, 3 gates\]

The spike gate is the critical one: if mapping misses the 95% target, fix it before building suggestions.

**v1 acceptance criteria**

- [ ] Install with `npm i -D visual-agent` and `npx visual-agent init` in a fresh Vite + React app
- [ ] Select an element and see its source file, line and tokens
- [ ] Request a change from the browser panel or Claude Code chat
- [ ] The agent edits the correct component through Visual Agent's MCP tools
- [ ] Each change appears as an inline suggestion with a reason
- [ ] Rejecting a suggestion reverts only that hunk; accept all keeps everything
- [ ] Uncommitted user changes are never lost
- [ ] The same MCP server works in a second host, such as Cursor

## Risks, open questions and cost

The biggest risk is unreliable source mapping; the build plugin spike must prove it before anything else is built.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Source mapping hits the wrong component or instance | Wrong edits erode trust immediately | Compile-time stamping first; test suite across demo apps |
| Host timeouts break the long-poll trigger | Browser-panel requests stall | Measure timeouts per host; bounded 25-second waits; MCP prompt fallback |
| Hunks don't map cleanly to elements | Suggestions appear in the wrong place | Group linked hunks; fall back to a file-level suggestion |
| Existing tools add the same features | Weaker differentiation | Lead on design-system awareness and per-change review |
| Maintenance load as an open-source project | Burnout, stale issues | Non-goals in the README, issue templates, narrow v1 scope |

**Open questions**

- [ ] Build fresh or fork MCP Pointer? Decide after reading its source and license.
- [ ] Final name, checked on npm and GitHub, with the npm scope reserved.
- [ ] MIT or Apache-2.0 license.
- [ ] When to add Next.js and React Server Components support.
- [ ] Whether per-change cost can be shown in any host.
- [ ] Which non-Vite bundler comes after Vite.

**Cost**

Building and running Visual Agent costs nothing: no servers, no paid APIs, and users bring their own agent. Testing uses the existing Claude Code subscription, so keep demo apps small to stay within usage limits.
