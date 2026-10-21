import { parseSync, traverse, types as t } from "@babel/core";
import { COMPONENT_ATTR, LOOP_ATTR, SOURCE_ATTR } from "../../src/shared/constants.js";

export type IntrinsicElement = {
  tag: string;
  /** 1-based line of the `<` character. */
  line: number;
  /** 1-based column of the `<` character. */
  column: number;
};

export type StampedElement = IntrinsicElement & {
  /** Raw `data-va-source` value, or null when the element was not stamped. */
  stamp: string | null;
  component: string | null;
  inLoop: boolean;
};

function parse(code: string, filename: string): t.File {
  const ast = parseSync(code, {
    filename,
    configFile: false,
    babelrc: false,
    browserslistConfigFile: false,
    sourceType: "module",
    parserOpts: { plugins: /\.tsx?$/.test(filename) ? ["jsx", "typescript"] : ["jsx"] },
  });
  if (!ast) throw new Error(`could not parse ${filename}`);
  return ast;
}

function isIntrinsic(name: t.JSXOpeningElement["name"]): name is t.JSXIdentifier {
  return t.isJSXIdentifier(name) && /^[a-z]/.test(name.name);
}

function attributeValue(node: t.JSXOpeningElement, attr: string): string | null {
  for (const candidate of node.attributes) {
    if (!t.isJSXAttribute(candidate)) continue;
    if (!t.isJSXIdentifier(candidate.name) || candidate.name.name !== attr) continue;
    return t.isStringLiteral(candidate.value) ? candidate.value.value : null;
  }
  return null;
}

/** Every intrinsic opening tag in the original, unmodified source. */
export function collectIntrinsics(code: string, filename: string): IntrinsicElement[] {
  const found: IntrinsicElement[] = [];
  traverse(parse(code, filename), {
    JSXOpeningElement(path) {
      const node = path.node;
      if (!isIntrinsic(node.name) || !node.loc) return;
      found.push({
        tag: node.name.name,
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
      });
    },
  });
  return found;
}

/** Every intrinsic opening tag in the stamped output, with its stamp read back. */
export function collectStamped(code: string, filename: string): StampedElement[] {
  const found: StampedElement[] = [];
  traverse(parse(code, filename), {
    JSXOpeningElement(path) {
      const node = path.node;
      if (!isIntrinsic(node.name) || !node.loc) return;
      found.push({
        tag: node.name.name,
        line: node.loc.start.line,
        column: node.loc.start.column + 1,
        stamp: attributeValue(node, SOURCE_ATTR),
        component: attributeValue(node, COMPONENT_ATTR),
        inLoop: attributeValue(node, LOOP_ATTR) === "true",
      });
    },
  });
  return found;
}

export type ParsedStamp = {
  file: string;
  line: number;
  column: number;
};

export function parseStamp(stamp: string): ParsedStamp | null {
  const match = /^(.*):(\d+):(\d+)$/.exec(stamp);
  if (!match) return null;
  const [, file, line, column] = match;
  if (file === undefined || line === undefined || column === undefined) return null;
  return { file, line: Number(line), column: Number(column) };
}
