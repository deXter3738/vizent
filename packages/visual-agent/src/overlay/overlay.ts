/**
 * Element picker overlay. Runs in the page, rendered entirely inside a Shadow
 * DOM so app CSS cannot reach it and its CSS cannot reach the app.
 *
 * This file must stay self-contained: the Vite plugin serves the compiled
 * output as a virtual module, where relative imports cannot be resolved.
 * Anything it needs from the Node side arrives through `OverlayConfig`.
 */

type OverlayConfig = {
  /** Toggles the picker when pressed with Alt/Option. */
  hotkey: string;
  /** Attribute names written by the stamping transform. */
  attrs: {
    source: string;
    component: string;
    loop: string;
  };
  /** HMR event names used to talk to the dev server. */
  events: {
    selection: string;
    ack: string;
  };
};

/** The slice of Vite's HMR client the overlay uses. */
type HotContext = {
  send(event: string, data: unknown): void;
  on(event: string, handler: (payload: unknown) => void): void;
};

declare global {
  interface ImportMeta {
    hot?: HotContext;
  }
}

type ParsedSource = {
  file: string;
  line: number;
  column: number;
};

type Target = {
  element: Element;
  /** Nearest element carrying a stamp, which may be an ancestor. */
  stamped: Element | null;
  /** Whether the stamp belongs to the hovered element or to an ancestor. */
  stampedFrom: "self" | "ancestor" | "none";
};

const HOST_ID = "visual-agent-overlay";

const STYLES = `
:host { all: initial; }
.layer {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.box {
  position: fixed;
  border: 1px solid #6366f1;
  background: rgba(99, 102, 241, 0.12);
  border-radius: 2px;
  transition: all 60ms linear;
  display: none;
}
.box.selected {
  border: 1px solid #22c55e;
  background: rgba(34, 197, 94, 0.1);
  border-style: solid;
}
.tag {
  position: fixed;
  padding: 2px 6px;
  font-size: 11px;
  line-height: 1.4;
  color: #fff;
  background: #6366f1;
  border-radius: 3px;
  white-space: nowrap;
  display: none;
}
.badge {
  position: fixed;
  left: 12px;
  bottom: 12px;
  padding: 6px 10px;
  font-size: 11px;
  color: #e2e8f0;
  background: #1e1b4b;
  border: 1px solid #4338ca;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}
.panel {
  position: fixed;
  right: 12px;
  bottom: 12px;
  width: 320px;
  max-height: 70vh;
  overflow: auto;
  padding: 12px;
  font-size: 11px;
  line-height: 1.5;
  color: #e2e8f0;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
  display: none;
}
.panel h2 {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #94a3b8;
}
.src {
  display: block;
  margin-bottom: 8px;
  padding: 6px 8px;
  color: #a5b4fc;
  background: #1e293b;
  border-radius: 4px;
  word-break: break-all;
}
.src.missing { color: #fca5a5; }
.meta { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.chip {
  padding: 1px 6px;
  color: #c7d2fe;
  background: #312e81;
  border-radius: 999px;
}
.chip.warn { color: #fde68a; background: #78350f; }
.section { margin-top: 10px; }
.section > .label {
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.classes { margin-top: 4px; word-break: break-all; color: #cbd5e1; }
table { width: 100%; margin-top: 4px; border-collapse: collapse; }
td { padding: 1px 0; vertical-align: top; }
td.k { width: 42%; color: #64748b; }
td.v { color: #e2e8f0; word-break: break-all; }
.hint { margin-top: 10px; color: #64748b; }
`;

function parseSource(raw: string | null): ParsedSource | null {
  if (!raw) return null;
  const match = /^(.*):(\d+):(\d+)$/.exec(raw);
  if (!match) return null;
  const [, file, line, column] = match;
  if (file === undefined || line === undefined || column === undefined) return null;
  return { file, line: Number(line), column: Number(column) };
}

function describeDomPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body && parts.length < 6) {
    let part = current.tagName.toLowerCase();
    if (current.id) part += `#${current.id}`;
    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current?.tagName,
      );
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    current = parent;
  }
  return parts.join(" > ");
}

function readComputedStyles(element: Element): Record<string, string> {
  const style = getComputedStyle(element);
  return {
    padding: style.padding,
    margin: style.margin,
    gap: style.gap === "normal" ? "—" : style.gap,
    "font size": style.fontSize,
    color: style.color,
    background: style.backgroundColor,
    "border radius": style.borderRadius,
  };
}

export function startVisualAgent(config: OverlayConfig): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  const style = document.createElement("style");
  style.textContent = STYLES;

  const layer = document.createElement("div");
  layer.className = "layer";

  const hoverBox = document.createElement("div");
  hoverBox.className = "box";

  const selectedBox = document.createElement("div");
  selectedBox.className = "box selected";

  const tagLabel = document.createElement("div");
  tagLabel.className = "tag";

  const badge = document.createElement("div");
  badge.className = "badge";

  const panel = document.createElement("div");
  panel.className = "panel";

  layer.append(hoverBox, selectedBox, tagLabel, badge, panel);
  shadow.append(style, layer);

  const hot = import.meta.hot;
  hot?.on(config.events.ack, (payload) => {
    const ok = typeof payload === "object" && payload !== null && "ok" in payload
      ? Boolean((payload as { ok: unknown }).ok)
      : false;
    if (!ok) console.warn("[visual-agent] dev server rejected the selection");
  });

  /** Push the selection to the dev server over Vite's existing HMR socket. */
  function onSelect(element: Element): void {
    if (!hot) return;
    hot.send(config.events.selection, buildSelection(element));
  }

  let enabled = false;
  let peeking = false;
  let hovered: Element | null = null;
  let selected: Element | null = null;

  const active = (): boolean => enabled || peeking;

  function resolveTarget(element: Element): Target {
    const own = element.getAttribute(config.attrs.source);
    if (own) return { element, stamped: element, stampedFrom: "self" };
    const ancestor = element.closest(`[${config.attrs.source}]`);
    if (ancestor) return { element, stamped: ancestor, stampedFrom: "ancestor" };
    return { element, stamped: null, stampedFrom: "none" };
  }

  function placeBox(box: HTMLElement, element: Element | null): void {
    if (!element) {
      box.style.display = "none";
      return;
    }
    const rect = element.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  }

  function placeTag(element: Element | null): void {
    if (!element || !active()) {
      tagLabel.style.display = "none";
      return;
    }
    const target = resolveTarget(element);
    const source = parseSource(target.stamped?.getAttribute(config.attrs.source) ?? null);
    const component = target.stamped?.getAttribute(config.attrs.component);
    const rect = element.getBoundingClientRect();
    const label = source
      ? `${element.tagName.toLowerCase()} · ${component ?? "?"} · ${source.line}`
      : element.tagName.toLowerCase();
    tagLabel.textContent = label;
    tagLabel.style.display = "block";
    const above = rect.top > 22;
    tagLabel.style.left = `${Math.max(2, rect.left)}px`;
    tagLabel.style.top = above ? `${rect.top - 20}px` : `${rect.bottom + 4}px`;
  }

  function renderBadge(): void {
    const key = config.hotkey.toUpperCase();
    badge.textContent = enabled
      ? `Visual Agent · picker on · Esc to exit`
      : `Visual Agent · Alt+${key}`;
    badge.style.opacity = enabled ? "1" : "0.55";
  }

  function escape(value: string): string {
    return value.replace(/[&<>"]/g, (char) => {
      if (char === "&") return "&amp;";
      if (char === "<") return "&lt;";
      if (char === ">") return "&gt;";
      return "&quot;";
    });
  }

  function renderPanel(element: Element | null): void {
    if (!element) {
      panel.style.display = "none";
      return;
    }
    const target = resolveTarget(element);
    const stamp = target.stamped?.getAttribute(config.attrs.source) ?? null;
    const source = parseSource(stamp);
    const component = target.stamped?.getAttribute(config.attrs.component);
    const inLoop = target.stamped?.getAttribute(config.attrs.loop) === "true";
    const styles = readComputedStyles(element);
    const classes = Array.from(element.classList);

    const rows = Object.entries(styles)
      .map(([key, value]) => `<tr><td class="k">${key}</td><td class="v">${escape(value)}</td></tr>`)
      .join("");

    const chips: string[] = [`<span class="chip">&lt;${element.tagName.toLowerCase()}&gt;</span>`];
    if (component) chips.push(`<span class="chip">${escape(component)}</span>`);
    if (inLoop) chips.push(`<span class="chip warn">in .map() loop</span>`);
    if (target.stampedFrom === "ancestor") {
      chips.push(`<span class="chip warn">stamp from ancestor</span>`);
    }

    panel.innerHTML = `
      <h2>Selected element</h2>
      <code class="src${source ? "" : " missing"}">${
        source ? escape(stamp ?? "") : "no data-va-source on this element"
      }</code>
      <div class="meta">${chips.join("")}</div>
      <div class="section">
        <div class="label">Classes (${classes.length})</div>
        <div class="classes">${classes.length ? escape(classes.join(" ")) : "—"}</div>
      </div>
      <div class="section">
        <div class="label">Computed</div>
        <table>${rows}</table>
      </div>
      <div class="section">
        <div class="label">DOM path</div>
        <div class="classes">${escape(describeDomPath(element))}</div>
      </div>
      <div class="hint">Esc clears · Alt+${config.hotkey.toUpperCase()} exits</div>
    `;
    panel.style.display = "block";
  }

  function buildSelection(element: Element): unknown {
    const target = resolveTarget(element);
    const stamp = target.stamped?.getAttribute(config.attrs.source) ?? null;
    const parsed = parseSource(stamp);
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      selectedAt: new Date().toISOString(),
      url: location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
      },
      darkMode: document.documentElement.classList.contains("dark"),
      tagName: element.tagName.toLowerCase(),
      source: parsed,
      component: target.stamped?.getAttribute(config.attrs.component) ?? null,
      inLoop: target.stamped?.getAttribute(config.attrs.loop) === "true",
      classList: Array.from(element.classList),
      // Page content: bounded here, labelled as untrusted by the MCP server.
      text: (element.textContent ?? "").trim().slice(0, 400),
      domPath: describeDomPath(element),
      computedStyles: {
        padding: style.padding,
        margin: style.margin,
        gap: style.gap,
        fontSize: style.fontSize,
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
      },
      bounds: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }

  function refresh(): void {
    placeBox(hoverBox, active() ? hovered : null);
    placeBox(selectedBox, selected);
    placeTag(hovered);
    renderBadge();
  }

  function isOurs(event: Event): boolean {
    return event.composedPath().includes(host);
  }

  function setEnabled(next: boolean): void {
    enabled = next;
    if (!enabled) {
      hovered = null;
      document.body.style.cursor = "";
    } else {
      document.body.style.cursor = "crosshair";
    }
    refresh();
  }

  document.addEventListener(
    "mousemove",
    (event) => {
      if (!active() || isOurs(event)) return;
      const target = event.target;
      if (!(target instanceof Element) || target === hovered) return;
      hovered = target;
      refresh();
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!active() || isOurs(event)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      event.preventDefault();
      event.stopPropagation();
      selected = target;
      onSelect(target);
      refresh();
      renderPanel(target);
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.key.toLowerCase() === config.hotkey) {
      event.preventDefault();
      setEnabled(!enabled);
      if (!enabled) {
        selected = null;
        renderPanel(null);
      }
      return;
    }
    if (event.key === "Alt" && !enabled) {
      peeking = true;
      refresh();
      return;
    }
    if (event.key === "Escape" && (enabled || selected)) {
      event.preventDefault();
      if (selected) {
        selected = null;
        renderPanel(null);
      } else {
        setEnabled(false);
      }
      refresh();
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "Alt" && peeking) {
      peeking = false;
      hovered = null;
      refresh();
    }
  });

  window.addEventListener("scroll", refresh, true);
  window.addEventListener("resize", refresh);

  renderBadge();
}
