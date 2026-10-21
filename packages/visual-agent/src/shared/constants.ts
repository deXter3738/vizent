/** Attribute holding `<relative path>:<line>:<col>` for the element's opening tag. */
export const SOURCE_ATTR = "data-va-source";
/** Attribute holding the nearest enclosing component name. */
export const COMPONENT_ATTR = "data-va-component";
/** Attribute present when the element is rendered inside a `.map()`-style loop. */
export const LOOP_ATTR = "data-va-loop";

/** HMR channel the overlay uses to push selections to the dev server. */
export const SELECTION_EVENT = "visual-agent:selection";
/** HMR channel the dev server uses to acknowledge a selection. */
export const ACK_EVENT = "visual-agent:ack";

/** Virtual module id for the injected overlay bundle. */
export const OVERLAY_VIRTUAL_ID = "virtual:visual-agent/overlay";
/** Resolved form Vite uses internally for the overlay virtual module. */
export const RESOLVED_OVERLAY_ID = "\0" + OVERLAY_VIRTUAL_ID;

/** Dev-server route serving the latest selection to the MCP server. */
export const SELECTION_ROUTE = "/__visual-agent/api/selection";
/** Directory holding the gitignored session handshake file. */
export const SESSION_DIR = ".visual-agent";
/** File the MCP server reads to discover the dev server's port and token. */
export const SESSION_FILE = "session.json";

/** Hard cap on a selection payload, in bytes, before the bridge rejects it. */
export const MAX_SELECTION_BYTES = 64 * 1024;
