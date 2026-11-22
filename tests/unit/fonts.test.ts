import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { locales } from "../../src/i18n";
import en from "../../src/i18n/locales/en";
import zhCN from "../../src/i18n/locales/zh-CN";

interface UnicodeRange {
  start: number;
  end: number;
}

interface FontFace {
  file: string;
  version: string;
  ranges: UnicodeRange[];
}

const projectRoot = resolve(process.cwd());
const fontsDir = resolve(projectRoot, "public/fonts");
const stylesheet = readFileSync(resolve(fontsDir, "wenkai.css"), "utf8");

// Typography helpers and Intl output add glyphs that do not appear verbatim in
// a dictionary string; scripts/build-fonts.py keeps them in the priority chunk.
const DYNAMIC_CHARS = "—–·…©，。：（）";
const INTERFACE_EXTENSIONS = new Set([".css", ".ts", ".vue"]);
const PRIMARY_CHUNK = "wenkai-000.woff2";

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (INTERFACE_EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) files.push(path);
  }
  return files;
}

function parseRange(part: string): UnicodeRange | undefined {
  const match = /^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i.exec(part);
  if (!match?.[1]) return undefined;
  const start = Number.parseInt(match[1], 16);
  const end = match[2] ? Number.parseInt(match[2], 16) : start;
  return { start, end };
}

function parseFontFaces(css: string): FontFace[] {
  const faces: FontFace[] = [];
  for (const block of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = block[1] ?? "";
    const source = /url\("\.\/(wenkai-\d+\.woff2)\?v=([0-9a-f]{8})"\)/.exec(body);
    const range = /unicode-range:\s*([^;]+);/.exec(body);
    if (!source?.[1] || !source[2] || !range?.[1]) {
      throw new Error(`Unparseable @font-face block: ${body.trim()}`);
    }
    const ranges: UnicodeRange[] = [];
    for (const part of range[1].split(",")) {
      const parsed = parseRange(part.trim());
      if (!parsed) throw new Error(`Unparseable unicode-range value: ${part.trim()}`);
      ranges.push(parsed);
    }
    faces.push({ file: source[1], version: source[2], ranges });
  }
  return faces;
}

function coveredPoints(ranges: readonly UnicodeRange[]): Set<number> {
  const points = new Set<number>();
  for (const { start, end } of ranges) {
    for (let point = start; point <= end; point++) points.add(point);
  }
  return points;
}

function leafStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (value && typeof value === "object") {
    for (const child of Object.values(value)) leafStrings(child, into);
  }
  return into;
}

function interfaceText(): string[] {
  const text = [...leafStrings(en), ...leafStrings(zhCN), DYNAMIC_CHARS];
  for (const { label } of locales) text.push(label);
  for (const locale of ["en", "zh-CN"]) {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 31; day++) {
        text.push(formatter.format(new Date(Date.UTC(2026, month, day))));
      }
    }
  }
  // Scan every interface source file too, so copy added before it reaches a
  // dictionary cannot silently ship without a regenerated font.
  for (const file of sourceFiles(resolve(projectRoot, "src"))) {
    text.push(readFileSync(file, "utf8"));
  }
  return text;
}

function formatPoint(point: number): string {
  return `U+${point.toString(16).toUpperCase().padStart(4, "0")}`;
}

const faces = parseFontFaces(stylesheet);
const primary = faces.find((face) => face.file === PRIMARY_CHUNK);

describe("font chunk stylesheet", () => {
  it("covers every interface character with the priority chunk", () => {
    expect(primary, `${PRIMARY_CHUNK} must be declared in public/fonts/wenkai.css`).toBeDefined();
    const covered = coveredPoints(primary?.ranges ?? []);
    const required = new Map<number, string>();
    for (const string of interfaceText()) {
      for (const character of string) {
        const point = character.codePointAt(0);
        if (point === undefined) continue;
        // Whitespace and control characters never need a glyph; ICU placeholders
        // are ASCII and covered by the Latin block.
        if (/[\s\p{Cc}]/u.test(character)) continue;
        required.set(point, character);
      }
    }
    const missing = [...required]
      .filter(([point]) => !covered.has(point))
      .map(([point, character]) => `${JSON.stringify(character)} (${formatPoint(point)})`);
    expect(
      missing,
      `Interface characters missing from ${PRIMARY_CHUNK}; run scripts/build-fonts.py to regenerate the font chunks.`,
    ).toEqual([]);
  });

  it("references existing font files with their content hash", () => {
    expect(faces.length).toBeGreaterThan(0);
    const problems: string[] = [];
    for (const face of faces) {
      const path = join(fontsDir, face.file);
      if (!existsSync(path)) {
        problems.push(`${face.file} is referenced by wenkai.css but does not exist`);
        continue;
      }
      const digest = createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 8);
      if (digest !== face.version) {
        problems.push(
          `${face.file} declares ?v=${face.version} but its SHA-256 prefix is ${digest}`,
        );
      }
    }
    expect(
      problems,
      "Font stylesheet URLs must match the committed files; run scripts/build-fonts.py to regenerate them.",
    ).toEqual([]);
  });

  it("uses disjoint ranges whose total matches the recorded coverage", () => {
    const ranges = faces.flatMap((face) => face.ranges.map((range) => ({ ...range, face })));
    for (const { start, end, face } of ranges) {
      expect(start, `${face.file} declares an inverted range`).toBeLessThanOrEqual(end);
    }
    const ordered = [...ranges].sort((left, right) => left.start - right.start);
    const overlaps: string[] = [];
    let total = 0;
    let previousEnd = -1;
    let previousFile = "";
    for (const { start, end, face } of ordered) {
      if (start <= previousEnd) {
        overlaps.push(
          `${formatPoint(start)}-${formatPoint(end)} in ${face.file} overlaps ${previousFile} (ends at ${formatPoint(previousEnd)})`,
        );
      }
      total += end - start + 1;
      previousEnd = Math.max(previousEnd, end);
      previousFile = face.file;
    }
    expect(overlaps, "Font chunk unicode-ranges must not overlap").toEqual([]);
    const coverage = readFileSync(resolve(fontsDir, "coverage.txt"), "utf8");
    const recorded = /^Output characters:\s*(\d+)$/m.exec(coverage)?.[1];
    expect(
      recorded,
      "public/fonts/coverage.txt must record the output character count",
    ).toBeDefined();
    expect(total, "Font chunk ranges must cover every character in coverage.txt").toBe(
      Number(recorded),
    );
    expect(coveredPoints(ranges).size).toBe(total);
  });
});
