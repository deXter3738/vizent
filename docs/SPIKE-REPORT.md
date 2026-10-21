# Spike report — source mapping

**Date:** 21 Oct 2026
**Gate:** PRD requires 95% of selections to resolve to the correct file and line.
**Result:** the gate passes. A second, harder problem showed up behind it.

---

## 1. Mapping accuracy

Two independent measurements.

### Static: does every stamp point at the right character?

`packages/visual-agent/test/mapping.test.ts` transforms each demo file, then
re-reads the *original* source and asserts that the character at the stamped
`line:column` is the `<` of an opening tag whose name matches the element
carrying the stamp.

```
src/App.tsx                             12/12   ok
src/components/Button.tsx                2/2    ok
src/components/Card.tsx                  7/7    ok
src/components/DataTable.tsx            12/12   ok
src/components/NavBar.tsx                7/7    ok
src/components/SignupForm.tsx           13/13   ok
-----------------------------------------------------
TOTAL                                   53/53   100.0%
```

A second suite (`edge-cases.test.ts`) adds 20 adversarial cases written
specifically to break it. Also 100%. 48 tests pass in total.

### Live: does every DOM node on the running page carry a stamp?

Measured in Chrome against the demo app:

| | |
| --- | --- |
| Elements rendered under `#root` | 99 |
| Carrying `data-va-source` | **99 (100%)** |
| Carrying no stamp | 0 |

No fallback was needed anywhere in the demo app.

---

## 2. The problem behind the gate

A stamp identifies **the tag that created the node**, not **which node it is**.
On the same page:

| | |
| --- | --- |
| Nodes a stamp identifies uniquely | 34 of 99 |
| Nodes sharing a stamp with another node | **65 of 99** |
|  — because they come from a `.map()` loop (flagged) | 39 |
|  — because the same component is used more than once (**not flagged**) | 26 |

The worst case: eleven different `<button>` elements across the page all report
`src/components/Button.tsx:45:5`, because they are all the same `<button>` tag
inside `Button`, rendered eleven times from eleven different call sites.

This matters directly for two v1 requirements:

- **R7** — "the user chooses *this instance* or *the component everywhere*". The
  stamp alone cannot tell those apart.
- **R12** — "map each hunk to its element". A hunk in `Button.tsx` maps to
  eleven elements, not one.

Loop instances at least carry a warning (`data-va-loop`). Repeated component
usage carries nothing, which is the more dangerous of the two: the user selects
one button, the agent edits `Button.tsx`, and every button on the page changes
with no warning that it would.

---

## 3. Cases that fail or stay ambiguous

| Case | Behaviour | Severity |
| --- | --- | --- |
| **Same component used many times** | All instances share one stamp. No flag. | **High** — silently global edits |
| **`.map()` loops** | All rows share one stamp. Flagged with `data-va-loop`. | Medium — flagged, so recoverable |
| **Props passed down** | Stamp points at the child's tag, where the DOM node is born, not at the parent that supplied the class. Correct, but the agent often needs the parent. | Medium |
| **Fragments (`<>`, `React.Fragment`)** | Deliberately not stamped — there is no DOM node to attach an attribute to. The picker falls back to the nearest stamped ancestor and says so in the panel. | Low — by design |
| **`for`-loop rendering** | Not flagged. Only `.map`, `.flatMap` and `.forEach` callbacks are detected. | Low — uncommon in React |
| **Third-party components** | `node_modules` is skipped, so their internals are unstamped. Falls back to the nearest stamped ancestor. | Low — correct scope |
| **`createElement`, portals, `dangerouslySetInnerHTML`** | Unstamped. No JSX tag to stamp. | Low |
| **Conditional rendering (ternary, `&&`)** | Works correctly. Verified. | None |
| **Prop spreads (`{...props}`)** | Works correctly — the stamp is appended last, so a spread cannot overwrite it. Verified. | None |
| **Multi-line tags, siblings on one line, deep nesting** | Work correctly. Verified. | None |

---

## 4. Not yet verified

Stated plainly, because these are gaps in evidence rather than in code:

- **Claude Code's own MCP client.** The server was driven directly over stdio
  (initialize → tools/list → tools/call), and both tools returned correct
  results. It has not yet been exercised through Claude Code's client, which
  requires approving the server in a new session.
- **Per-host tool timeouts.** `debug_sleep` exists and reports accurate elapsed
  time, but no host's actual limit has been measured yet. That is the next
  concrete task for the long-poll design in R10.
- **Non-loopback rejection.** Covered by a unit test over the address predicate,
  not by a real request from another machine. The dev server binds to loopback
  by default, so reaching the branch for real means deliberately exposing the
  port.
- **One framework, one bundler.** Vite + React only. No Next.js, no RSC, no
  Webpack.

---

## 5. Recommendation for the next phase

**Do not start suggestions yet.** The PRD's phase order assumes mapping is the
only hard part; the measurement above says instance identity is a second hard
part, and suggestions (R12–R14) are built directly on top of it. Building the
review layer first would mean rebuilding it.

Three pieces of work, in order:

1. **Stamp the render path, not just the tag.** Add the chain of component call
   sites above each element, so a selection carries both "the `<button>` is at
   `Button.tsx:45:5`" and "it was rendered from `App.tsx:52:15`". This is what
   makes "this instance" vs "everywhere" answerable, and it is what the agent
   needs when the class comes from a parent. React's own `_debugSource` and
   fiber `_debugOwner` chain can supply this in dev.

2. **Give loop instances an index.** `data-va-loop-index`, derived from the
   element's position among its siblings, so row 3 is distinguishable from row 1
   without inventing keys.

3. **Then warn in the picker, before any editing exists.** When a selection
   shares its stamp with other nodes on the page, say so and say how many: "this
   `<button>` and 10 others come from this line". That one sentence removes the
   worst failure mode in the table above, and it is cheap to build now.

After those three, the suggestion layer has something unambiguous to attach to.

### Smaller follow-ups worth doing in the same pass

- Measure `debug_sleep` against Claude Code and Cursor; record the numbers.
- Decide the licence (the PRD leaves MIT vs Apache-2.0 open; the package
  currently declares MIT).
- Check the `visual-agent` name on npm before it is relied on.
