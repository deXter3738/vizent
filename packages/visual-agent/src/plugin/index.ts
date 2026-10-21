import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { stampSource } from "./stamp.js";
import { resolveOptions, type VisualAgentOptions } from "./options.js";
import {
  COMPONENT_ATTR,
  LOOP_ATTR,
  OVERLAY_VIRTUAL_ID,
  RESOLVED_OVERLAY_ID,
  SOURCE_ATTR,
} from "../shared/constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Built by `tsc -p tsconfig.overlay.json`; served as a virtual module. */
const OVERLAY_BUNDLE = path.resolve(here, "../overlay/overlay.js");

const JSX_FILE = /\.[jt]sx$/;

function shouldTransform(id: string): boolean {
  if (id.includes("\u0000")) return false;
  const [filename] = id.split("?");
  if (!filename) return false;
  if (filename.includes("node_modules")) return false;
  return JSX_FILE.test(filename);
}

/**
 * Dev-only Vite plugin. Stamps source locations onto intrinsic JSX elements and
 * injects the element picker overlay. Never applied to production builds.
 */
export function visualAgent(userOptions: VisualAgentOptions = {}): Plugin {
  const options = resolveOptions(userOptions);
  let root = process.cwd();

  return {
    name: "visual-agent",
    apply: "serve",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
    },

    transform(code, id) {
      if (!shouldTransform(id)) return null;
      const [filename] = id.split("?");
      if (!filename) return null;
      const result = stampSource(code, { filename, root });
      if (!result) return null;
      if (options.verbose) {
        this.info(`stamped ${result.stamped} elements in ${path.relative(root, filename)}`);
      }
      return { code: result.code, map: result.map as never };
    },

    resolveId(id) {
      return id === OVERLAY_VIRTUAL_ID ? RESOLVED_OVERLAY_ID : null;
    },

    load(id) {
      if (id !== RESOLVED_OVERLAY_ID) return null;
      const bundle = fs.readFileSync(OVERLAY_BUNDLE, "utf8");
      const overlayConfig = {
        hotkey: options.hotkey,
        attrs: { source: SOURCE_ATTR, component: COMPONENT_ATTR, loop: LOOP_ATTR },
      };
      return `${bundle}\nstartVisualAgent(${JSON.stringify(overlayConfig)});\n`;
    },

    transformIndexHtml() {
      return [
        {
          tag: "script",
          // Vite's /@id/ route encodes a leading NUL byte as __x00__.
          attrs: {
            type: "module",
            src: `/@id/${RESOLVED_OVERLAY_ID.replace("\0", "__x00__")}`,
          },
          injectTo: "body" as const,
        },
      ];
    },
  };
}

export type { VisualAgentOptions };
