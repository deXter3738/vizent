import path from "node:path";
import { transformSync, types as t } from "@babel/core";
import type { NodePath, PluginObject } from "@babel/core";
import { COMPONENT_ATTR, LOOP_ATTR, SOURCE_ATTR } from "../shared/constants.js";

/** Array methods whose callbacks render many DOM nodes from one source line. */
const ITERATION_METHODS = new Set(["map", "flatMap", "forEach"]);

export type StampOptions = {
  /** Absolute path of the file being transformed. */
  filename: string;
  /** Absolute project root. Stamped paths are relative to this. */
  root: string;
};

export type StampResult = {
  code: string;
  map: unknown;
  /** How many opening tags were stamped. */
  stamped: number;
};

/** Turn an absolute path into the stable, forward-slashed form we stamp. */
export function toStampedPath(filename: string, root: string): string {
  const relative = path.relative(root, filename);
  return relative.split(path.sep).join("/");
}

/**
 * Only plain HTML elements get stamped. Components render their own intrinsic
 * elements, so stamping `<Button>` would point at the call site rather than at
 * the tag that actually produced the DOM node.
 */
function isIntrinsic(name: t.JSXOpeningElement["name"]): name is t.JSXIdentifier {
  // JSXNamespacedName (<svg:use>) and JSXMemberExpression (<Foo.Bar>) are out.
  if (!t.isJSXIdentifier(name)) return false;
  // JSX treats a lowercase first letter as a host element; so do we.
  return /^[a-z]/.test(name.name);
}

function hasAttribute(node: t.JSXOpeningElement, attr: string): boolean {
  return node.attributes.some(
    (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === attr,
  );
}

function startsUppercase(name: string): boolean {
  const first = name[0];
  return first !== undefined && first === first.toUpperCase() && first !== first.toLowerCase();
}

/**
 * Walk outwards to the nearest component-looking declaration. Covers
 * `function Button()`, `const Button = () => {}`, `const Button = memo(...)`
 * and `class Button extends Component`.
 */
function findComponentName(start: NodePath<t.JSXOpeningElement>): string | null {
  let current: NodePath | null = start.parentPath;
  while (current) {
    const node: t.Node = current.node;
    if (
      (t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) &&
      node.id &&
      startsUppercase(node.id.name)
    ) {
      return node.id.name;
    }
    if (t.isVariableDeclarator(node) && t.isIdentifier(node.id) && startsUppercase(node.id.name)) {
      return node.id.name;
    }
    if (
      (t.isClassExpression(node) || t.isFunctionExpression(node)) &&
      node.id &&
      startsUppercase(node.id.name)
    ) {
      return node.id.name;
    }
    current = current.parentPath;
  }
  return null;
}

/**
 * True when this tag sits inside the callback of a `.map()`-style call. Decided
 * from the AST rather than guessed from the DOM, so the overlay can show the
 * flag without heuristics.
 */
function isInsideIteration(start: NodePath<t.JSXOpeningElement>): boolean {
  let fn = start.getFunctionParent();
  while (fn) {
    const parent: NodePath | null = fn.parentPath;
    if (parent?.isCallExpression()) {
      const callee = parent.node.callee;
      const isIterationCall =
        t.isMemberExpression(callee) &&
        !callee.computed &&
        t.isIdentifier(callee.property) &&
        ITERATION_METHODS.has(callee.property.name);
      if (isIterationCall && parent.node.arguments.includes(fn.node as t.Expression)) {
        return true;
      }
    }
    fn = fn.getFunctionParent();
  }
  return false;
}

function stampPlugin(options: StampOptions, counter: { count: number }): PluginObject {
  const relativePath = toStampedPath(options.filename, options.root);
  const fallbackComponent = path.basename(options.filename).replace(/\.[jt]sx?$/, "");

  return {
    name: "visual-agent-stamp",
    visitor: {
      JSXOpeningElement(elementPath: NodePath<t.JSXOpeningElement>) {
        const node = elementPath.node;
        if (!isIntrinsic(node.name)) return;
        if (!node.loc) return;
        if (hasAttribute(node, SOURCE_ATTR)) return;

        // Babel columns are 0-based; editors and `file:line:col` are 1-based.
        const line = node.loc.start.line;
        const column = node.loc.start.column + 1;

        const attributes: t.JSXAttribute[] = [
          t.jsxAttribute(
            t.jsxIdentifier(SOURCE_ATTR),
            t.stringLiteral(`${relativePath}:${line}:${column}`),
          ),
          t.jsxAttribute(
            t.jsxIdentifier(COMPONENT_ATTR),
            t.stringLiteral(findComponentName(elementPath) ?? fallbackComponent),
          ),
        ];

        if (isInsideIteration(elementPath)) {
          attributes.push(t.jsxAttribute(t.jsxIdentifier(LOOP_ATTR), t.stringLiteral("true")));
        }

        // Pushed last so an earlier `{...props}` spread cannot overwrite them.
        node.attributes.push(...attributes);
        counter.count += 1;
      },
    },
  };
}

/**
 * Add `data-va-*` attributes to every intrinsic JSX element in `code`.
 * Returns null when the file has no JSX or cannot be parsed, so a syntax error
 * in user code never breaks the dev server.
 */
export function stampSource(code: string, options: StampOptions): StampResult | null {
  if (!code.includes("<")) return null;

  const isTypeScript = /\.tsx?$/.test(options.filename);
  const counter = { count: 0 };

  let result;
  try {
    result = transformSync(code, {
      filename: options.filename,
      root: options.root,
      cwd: options.root,
      configFile: false,
      babelrc: false,
      browserslistConfigFile: false,
      sourceType: "module",
      sourceMaps: true,
      sourceFileName: options.filename,
      compact: false,
      parserOpts: {
        plugins: isTypeScript ? ["jsx", "typescript"] : ["jsx"],
        errorRecovery: false,
      },
      plugins: [(): PluginObject => stampPlugin(options, counter)],
    });
  } catch {
    return null;
  }

  if (!result?.code || counter.count === 0) return null;
  return { code: result.code, map: result.map, stamped: counter.count };
}
