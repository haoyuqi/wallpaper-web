import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const readJson = (path) => {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};
const display = (value) =>
  value === null || value === undefined ? "Not available" : String(value);
const status = (value) =>
  ({ success: "Passed", failure: "Failed", cancelled: "Cancelled", skipped: "Skipped" })[value] ??
  "Not available";
const npmVersion = () => {
  try {
    return execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};

if (process.argv[2] === "collect") {
  const tests = readJson("vitest-results.json");
  const coverage = readJson("coverage/coverage-summary.json")?.total?.lines?.pct;
  const data = {
    node: process.versions.node,
    npm: npmVersion(),
    vue: readJson("node_modules/vue/package.json")?.version ?? null,
    tests: tests?.numTotalTests ?? null,
    passed: tests?.numPassedTests ?? null,
    files: tests?.testResults?.length ?? null,
    coverage: Number.isFinite(coverage) ? `${coverage}%` : null,
  };
  writeFileSync("ci-web-metrics.json", JSON.stringify(data));
} else if (process.argv[2] === "render") {
  const needs = readJson("ci-needs.json") ?? {};
  const data = readJson("ci-data/ci-web-metrics.json") ?? {};
  const jobs = [
    ["Release script tests", "release-script-tests"],
    ["Check", "check"],
    ["Unit tests", "unit-tests"],
    ["Build and E2E", "build-and-e2e"],
    ["Dependency audit", "dependency-audit"],
  ];
  const failed = jobs.filter(([, key]) => needs[key]?.result !== "success");
  const lines = [
    `# ${failed.length ? "🔴 CI failed" : "🟢 CI passed"}`,
    "",
    "| Tests · Vitest | Line coverage | Checks |",
    "| :--- | :--- | :--- |",
    `| **${display(data.passed)} / ${display(data.tests)} passed**<br>${display(data.files)} test files | **${display(data.coverage)}**<br>\`src/**/*.{ts,vue}\` | **${jobs.length - failed.length} / ${jobs.length} passed** |`,
    "",
    `**Environment:** Node.js ${display(data.node)} · npm ${display(data.npm)} · Vue ${display(data.vue)}`,
  ];
  if (failed.length) {
    lines.push(
      "",
      "## Checks needing attention",
      "",
      "| Job | Result |",
      "| --- | --- |",
      ...failed.map(([name, key]) => `| ${name} | ${status(needs[key]?.result)} |`),
    );
  }
  lines.push(
    "",
    `[Download test and coverage reports](${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}#artifacts). These are files saved by this CI run.`,
  );
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
} else {
  throw new Error("Expected collect or render");
}
