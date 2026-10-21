import path from "node:path";
import { describe, expect, it } from "vitest";
import { stampSource } from "../src/plugin/stamp.js";
import { collectIntrinsics, collectStamped, parseStamp } from "./helpers/collect.js";

const ROOT = "/project";
const FILE = path.join(ROOT, "src/Edge.tsx");

type Stamped = ReturnType<typeof collectStamped>[number];

function stamp(code: string): Stamped[] {
  const result = stampSource(code, { filename: FILE, root: ROOT });
  if (!result) return [];
  return collectStamped(result.code, FILE);
}

/** Verify every stamp in `code` points at the `<` of its own opening tag. */
function verify(code: string): { total: number; correct: number; reasons: string[] } {
  const lines = code.split("\n");
  const elements = stamp(code);
  const reasons: string[] = [];
  let correct = 0;

  for (const element of elements) {
    const parsed = element.stamp ? parseStamp(element.stamp) : null;
    if (!parsed) {
      reasons.push(`<${element.tag}> has no usable stamp`);
      continue;
    }
    const line = lines[parsed.line - 1];
    const text = line?.slice(parsed.column - 1) ?? "";
    const nameMatch = /^<\s*([A-Za-z0-9_$.:-]+)/.exec(text);
    if (nameMatch?.[1] === element.tag) correct += 1;
    else reasons.push(`<${element.tag}> points at "${text.slice(0, 16)}"`);
  }

  return { total: elements.length, correct, reasons };
}

describe("what gets stamped", () => {
  it("skips fragments, which have no DOM node to carry an attribute", () => {
    const code = `export function A() {
  return (
    <>
      <span>one</span>
    </>
  );
}`;
    const elements = stamp(code);
    expect(elements.map((e) => e.tag)).toEqual(["span"]);
  });

  it("skips <React.Fragment> and other member-expression tags", () => {
    const code = `import React from "react";
export function A() {
  return (
    <React.Fragment>
      <p>text</p>
    </React.Fragment>
  );
}`;
    expect(stamp(code).map((e) => e.tag)).toEqual(["p"]);
  });

  it("skips namespaced tags such as <svg:use>", () => {
    const code = `export function A() {
  return (
    <svg viewBox="0 0 1 1">
      <svg:use href="#x" />
    </svg>
  );
}`;
    expect(stamp(code).map((e) => e.tag)).toEqual(["svg"]);
  });

  it("stamps the intrinsic tag, never the component that renders it", () => {
    const code = `import { Button } from "./Button";
export function A() {
  return (
    <div>
      <Button>go</Button>
    </div>
  );
}`;
    expect(stamp(code).map((e) => e.tag)).toEqual(["div"]);
  });

  it("stamps custom elements with a dash in the name", () => {
    const code = `export function A() {
  return <my-widget data-x="1" />;
}`;
    expect(stamp(code).map((e) => e.tag)).toEqual(["my-widget"]);
  });

  it("leaves an already-stamped element untouched", () => {
    const code = `export function A() {
  return <div data-va-source="hand-written:1:1" />;
}`;
    // Nothing left to stamp, so the transform declines to rewrite the file and
    // the hand-written value survives verbatim.
    expect(stampSource(code, { filename: FILE, root: ROOT })).toBeNull();
  });

  it("returns null for a file with no JSX at all", () => {
    expect(stampSource(`export const x = 1;`, { filename: FILE, root: ROOT })).toBeNull();
  });

  it("returns null rather than throwing on a syntax error", () => {
    expect(stampSource(`export function A() { return <div</div>; }`, { filename: FILE, root: ROOT }))
      .toBeNull();
  });

  it("produces a source map", () => {
    const result = stampSource(`export const A = () => <div />;`, { filename: FILE, root: ROOT });
    expect(result?.map).toBeTruthy();
  });

  it("is idempotent when run over its own output", () => {
    const first = stampSource(`export const A = () => <div><p>x</p></div>;`, {
      filename: FILE,
      root: ROOT,
    });
    expect(first).not.toBeNull();
    const second = stampSource(first!.code, { filename: FILE, root: ROOT });
    // Nothing left to stamp, so the transform declines to touch the file again.
    expect(second).toBeNull();
  });
});

describe("hard positions", () => {
  it("handles a multi-line opening tag", () => {
    const code = `export function A() {
  return (
    <div
      className="a"
      id="b"
    >
      text
    </div>
  );
}`;
    const result = verify(code);
    expect(result.reasons).toEqual([]);
    expect(result.correct).toBe(result.total);
    expect(stamp(code)[0]?.stamp).toBe("src/Edge.tsx:3:5");
  });

  it("handles two elements on the same line", () => {
    const code = `export const A = () => <div><span>x</span></div>;`;
    const elements = stamp(code);
    expect(elements.map((e) => e.stamp)).toEqual(["src/Edge.tsx:1:24", "src/Edge.tsx:1:29"]);
  });

  it("handles conditional rendering in a ternary", () => {
    const code = `export function A({ error }: { error?: string }) {
  return error ? <p className="err">{error}</p> : <span>ok</span>;
}`;
    const result = verify(code);
    expect(result.reasons).toEqual([]);
    expect(result.total).toBe(2);
  });

  it("handles logical-and rendering", () => {
    const code = `export function A({ show }: { show: boolean }) {
  return <div>{show && <aside>panel</aside>}</div>;
}`;
    const result = verify(code);
    expect(result.reasons).toEqual([]);
    expect(result.total).toBe(2);
  });

  it("handles JSX inside an array literal", () => {
    const code = `export function A() {
  const nodes = [<li key="a">a</li>, <li key="b">b</li>];
  return <ul>{nodes}</ul>;
}`;
    const result = verify(code);
    expect(result.reasons).toEqual([]);
    expect(result.total).toBe(3);
  });

  it("handles deeply indented and nested JSX", () => {
    const code = `export function A() {
  return (
    <div>
      <section>
        <article>
          <header>
            <h1>deep</h1>
          </header>
        </article>
      </section>
    </div>
  );
}`;
    const result = verify(code);
    expect(result.reasons).toEqual([]);
    expect(result.total).toBe(5);
  });
});

describe("prop spreads", () => {
  it("wins over a spread that could otherwise overwrite the stamp", () => {
    const code = `export function A(props: Record<string, unknown>) {
  return <div {...props} />;
}`;
    const result = stampSource(code, { filename: FILE, root: ROOT });
    const output = result?.code ?? "";
    // The stamp must appear after the spread in attribute order.
    expect(output.indexOf("...props")).toBeLessThan(output.indexOf("data-va-source"));
  });

  it("still stamps when the spread is the only attribute", () => {
    const code = `export const A = (props: object) => <span {...props} />;`;
    expect(stamp(code)[0]?.stamp).toBe("src/Edge.tsx:1:37");
  });
});

describe("loop detection", () => {
  it("flags elements inside a .map() callback", () => {
    const code = `export function A({ items }: { items: string[] }) {
  return <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}`;
    const elements = stamp(code);
    expect(elements.find((e) => e.tag === "ul")?.inLoop).toBe(false);
    expect(elements.find((e) => e.tag === "li")?.inLoop).toBe(true);
  });

  it("flags elements nested two loops deep", () => {
    const code = `export function A({ rows }: { rows: string[][] }) {
  return (
    <table>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell) => (
              <td key={cell}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}`;
    const elements = stamp(code);
    expect(elements.find((e) => e.tag === "table")?.inLoop).toBe(false);
    expect(elements.find((e) => e.tag === "tr")?.inLoop).toBe(true);
    expect(elements.find((e) => e.tag === "td")?.inLoop).toBe(true);
  });

  it("does not flag a method called map on something that is not iterated here", () => {
    const code = `export function A() {
  return <div>{cache.get("x")}</div>;
}`;
    expect(stamp(code)[0]?.inLoop).toBe(false);
  });

  it("misses loops expressed with a for statement, a known limitation", () => {
    const code = `export function A({ items }: { items: string[] }) {
  const out = [];
  for (const item of items) {
    out.push(<li key={item}>{item}</li>);
  }
  return <ul>{out}</ul>;
}`;
    const elements = stamp(code);
    // Documented gap: only .map/.flatMap/.forEach callbacks are detected.
    expect(elements.find((e) => e.tag === "li")?.inLoop).toBe(false);
  });
});

describe("component names", () => {
  const cases: Array<[string, string, string]> = [
    ["function declaration", `export function Button() { return <b />; }`, "Button"],
    ["arrow in a const", `export const Card = () => <div />;`, "Card"],
    [
      "forwardRef wrapper",
      `import { forwardRef } from "react";
export const Input = forwardRef(() => <input />);`,
      "Input",
    ],
    [
      "memo wrapper",
      `import { memo } from "react";
export const Row = memo(function Row() { return <tr />; });`,
      "Row",
    ],
    [
      "class component",
      `import { Component } from "react";
export class Panel extends Component { render() { return <section />; } }`,
      "Panel",
    ],
    [
      "nested render helper keeps the outer component name",
      `export function Page() {
  const renderItem = () => <li />;
  return <ul>{renderItem()}</ul>;
}`,
      "Page",
    ],
  ];

  it.each(cases)("resolves %s", (_name, code, expected) => {
    const elements = stamp(code);
    expect(elements.length).toBeGreaterThan(0);
    for (const element of elements) expect(element.component).toBe(expected);
  });

  it("falls back to the file name for JSX outside any component", () => {
    const code = `export const tree = <div />;`;
    expect(stamp(code)[0]?.component).toBe("Edge");
  });
});

describe("overall edge-case accuracy", () => {
  const samples: Array<[string, string]> = [
    ["fragment", `export const A = () => <><i>x</i></>;`],
    ["multi-line tag", `export const A = () => (\n  <div\n    id="x"\n  />\n);`],
    ["same line siblings", `export const A = () => <p><b>a</b><i>b</i></p>;`],
    ["map loop", `export const A = (xs: string[]) => <ul>{xs.map((x) => <li key={x} />)}</ul>;`],
    ["ternary", `export const A = (f: boolean) => (f ? <p /> : <span />);`],
    ["spread", `export const A = (p: object) => <div {...p} />;`],
    ["custom element", `export const A = () => <x-tag />;`],
    ["self closing", `export const A = () => <br />;`],
    ["svg child", `export const A = () => <svg><path d="M0 0" /></svg>;`],
    [
      "deep nesting",
      `export const A = () => (\n  <div>\n    <section>\n      <h2>t</h2>\n    </section>\n  </div>\n);`,
    ],
  ];

  it("stamps every intrinsic element correctly across all samples", () => {
    let total = 0;
    let correct = 0;
    const reasons: string[] = [];

    for (const [name, code] of samples) {
      const expected = collectIntrinsics(code, FILE).length;
      const result = verify(code);
      total += expected;
      correct += result.correct;
      if (result.total !== expected) {
        reasons.push(`${name}: stamped ${result.total} of ${expected} intrinsic elements`);
      }
      reasons.push(...result.reasons.map((r) => `${name}: ${r}`));
    }

    const accuracy = correct / total;
    console.log(
      `\n  Edge-case accuracy: ${correct}/${total} = ${(accuracy * 100).toFixed(1)}%` +
        (reasons.length ? `\n  ${reasons.join("\n  ")}` : ""),
    );
    expect(reasons).toEqual([]);
    expect(accuracy).toBe(1);
  });
});
