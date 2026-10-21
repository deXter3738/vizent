import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stampSource, toStampedPath } from "../src/plugin/stamp.js";
import { collectIntrinsics, collectStamped, parseStamp } from "./helpers/collect.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEMO_ROOT = path.resolve(here, "../../../examples/demo-react-app");

/** The gate from the PRD: 95% of selections must resolve to file and line. */
const REQUIRED_ACCURACY = 0.95;

function demoFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...demoFiles(full));
    else if (/\.[jt]sx$/.test(entry.name)) out.push(full);
  }
  return out.sort();
}

type Failure = {
  file: string;
  tag: string;
  reason: string;
};

type FileReport = {
  file: string;
  total: number;
  correct: number;
  failures: Failure[];
};

/**
 * Check one stamp against the original source: the stamped path must match the
 * file, and the character at line:col must be the `<` of a tag with the same
 * name as the element that carries the stamp.
 */
function checkStamp(
  expectedPath: string,
  sourceLines: string[],
  tag: string,
  stamp: string | null,
): string | null {
  if (!stamp) return "no data-va-source attribute";

  const parsed = parseStamp(stamp);
  if (!parsed) return `unparseable stamp "${stamp}"`;
  if (parsed.file !== expectedPath) {
    return `stamped path "${parsed.file}" is not "${expectedPath}"`;
  }

  const line = sourceLines[parsed.line - 1];
  if (line === undefined) return `line ${parsed.line} is past the end of the file`;

  const text = line.slice(parsed.column - 1);
  if (!text.startsWith("<")) {
    return `column ${parsed.column} on line ${parsed.line} is "${text.slice(0, 12)}", not an opening tag`;
  }

  const nameMatch = /^<\s*([A-Za-z0-9_$.:-]+)/.exec(text);
  if (!nameMatch?.[1]) return `no tag name after "<" at ${parsed.line}:${parsed.column}`;
  if (nameMatch[1] !== tag) return `stamp points at <${nameMatch[1]}> but sits on <${tag}>`;

  return null;
}

function measureFile(absolutePath: string): FileReport {
  const source = fs.readFileSync(absolutePath, "utf8");
  const relativePath = toStampedPath(absolutePath, DEMO_ROOT);
  const sourceLines = source.split("\n");

  const expected = collectIntrinsics(source, absolutePath);
  const result = stampSource(source, { filename: absolutePath, root: DEMO_ROOT });

  if (expected.length === 0) {
    return { file: relativePath, total: 0, correct: 0, failures: [] };
  }
  if (!result) {
    return {
      file: relativePath,
      total: expected.length,
      correct: 0,
      failures: [{ file: relativePath, tag: "*", reason: "transform returned null" }],
    };
  }

  const stamped = collectStamped(result.code, absolutePath);
  const failures: Failure[] = [];
  let correct = 0;

  for (const element of stamped) {
    const reason = checkStamp(relativePath, sourceLines, element.tag, element.stamp);
    if (reason) failures.push({ file: relativePath, tag: element.tag, reason });
    else correct += 1;
  }

  // An intrinsic element that vanished from the output is a mapping failure too.
  const missing = expected.length - stamped.length;
  for (let i = 0; i < missing; i += 1) {
    failures.push({ file: relativePath, tag: "?", reason: "intrinsic element missing from output" });
  }

  return { file: relativePath, total: expected.length, correct, failures };
}

describe("source mapping accuracy", () => {
  const files = demoFiles(path.join(DEMO_ROOT, "src"));

  it("finds demo files to measure", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [toStampedPath(file, DEMO_ROOT), file] as const))(
    "%s stamps every intrinsic element at its opening tag",
    (_name, file) => {
      const report = measureFile(file);
      expect(report.failures, report.failures.map((f) => f.reason).join("; ")).toEqual([]);
      expect(report.correct).toBe(report.total);
    },
  );

  it(`reaches at least ${REQUIRED_ACCURACY * 100}% accuracy across the demo app`, () => {
    const reports = files.map(measureFile);
    const total = reports.reduce((sum, r) => sum + r.total, 0);
    const correct = reports.reduce((sum, r) => sum + r.correct, 0);
    const accuracy = total === 0 ? 0 : correct / total;

    const lines = [
      "",
      "  Source mapping accuracy",
      "  " + "-".repeat(56),
      ...reports
        .filter((r) => r.total > 0)
        .map(
          (r) =>
            `  ${r.file.padEnd(38)} ${String(r.correct).padStart(3)}/${String(r.total).padEnd(3)}` +
            (r.failures.length ? `  ${r.failures.length} failed` : "  ok"),
        ),
      "  " + "-".repeat(56),
      `  ${"TOTAL".padEnd(38)} ${String(correct).padStart(3)}/${String(total).padEnd(3)}  ${(accuracy * 100).toFixed(1)}%`,
      "",
    ];
    for (const failure of reports.flatMap((r) => r.failures)) {
      lines.push(`  FAIL ${failure.file} <${failure.tag}>: ${failure.reason}`);
    }
    console.log(lines.join("\n"));

    expect(total).toBeGreaterThan(20);
    expect(accuracy).toBeGreaterThanOrEqual(REQUIRED_ACCURACY);
  });
});
