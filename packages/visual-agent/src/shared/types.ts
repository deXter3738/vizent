/** A source location stamped at compile time. 1-based line and column. */
export type SourceLocation = {
  /** Project-root-relative, forward-slashed. */
  file: string;
  line: number;
  column: number;
};

/** Computed styles the overlay reads back off the selected element. */
export type ComputedStyleSnapshot = {
  padding: string;
  margin: string;
  gap: string;
  fontSize: string;
  color: string;
  backgroundColor: string;
  borderRadius: string;
};

/** Element bounds in CSS pixels, relative to the viewport. */
export type ElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * One selected element. Every string field sourced from the DOM is page
 * content and must be treated as untrusted when shown to an agent.
 */
export type Selection = {
  /** ISO timestamp of when the user clicked. */
  selectedAt: string;
  /** Page URL at selection time. */
  url: string;
  viewport: { width: number; height: number; dpr: number };
  /** True when the page has a `dark` class on <html>. */
  darkMode: boolean;
  /** Lowercase tag name, e.g. "button". */
  tagName: string;
  /** Stamped source location, or null when the element was not stamped. */
  source: SourceLocation | null;
  /** Nearest enclosing component name from the stamp, or null. */
  component: string | null;
  /** True when the stamp says this element renders inside a loop. */
  inLoop: boolean;
  /** Class names on the element, in document order. */
  classList: string[];
  /** Trimmed, truncated textContent. Untrusted page content. */
  text: string;
  /** Short CSS-ish path from <body>, for orientation only. */
  domPath: string;
  computedStyles: ComputedStyleSnapshot;
  bounds: ElementBounds;
};

/** What the bridge keeps in memory and serves over HTTP. */
export type SelectionState = {
  /** Most recent selection, or null when nothing is selected. */
  current: Selection | null;
};

/** Handshake file written to `.visual-agent/session.json` on server start. */
export type SessionInfo = {
  /** Schema version, bumped on breaking changes. */
  version: 1;
  /** Absolute path of the Vite project root. */
  projectRoot: string;
  /** Dev server host, always a loopback address. */
  host: string;
  port: number;
  /** Shared secret required by the selection route. */
  token: string;
  /** ISO timestamp of when the dev server started. */
  startedAt: string;
  /** PID of the dev server process. */
  pid: number;
};
