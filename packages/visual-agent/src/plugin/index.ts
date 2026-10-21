import path from "node:path";
import type { Plugin } from "vite";
import { stampSource } from "./stamp.js";
import { resolveOptions, type VisualAgentOptions } from "./options.js";

const JSX_FILE = /\.[jt]sx$/;

function shouldTransform(id: string): boolean {
  if (id.includes("\u0000")) return false;
  const [filename] = id.split("?");
  if (!filename) return false;
  if (filename.includes("node_modules")) return false;
  return JSX_FILE.test(filename);
}

/**
 * Dev-only Vite plugin. Stamps source locations onto intrinsic JSX elements.
 * Never applied to production builds.
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
  };
}

export type { VisualAgentOptions };
