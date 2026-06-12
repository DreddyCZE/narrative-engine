import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const errors = [];

const requiredPaths = [
  "README.md",
  "PROJECT_CHARTER.md",
  "AGENTS.md",
  "CHANGELOG.md",
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  ".editorconfig",
  ".gitignore",
  ".nvmrc",
  "docs/spec/MASTER_SPEC.md",
  "docs/roadmap/ROADMAP.md",
  "docs/status/CURRENT_STATE.md",
  "docs/status/RISKS.md",
  "docs/status/TECH_DEBT.md",
  "docs/tasks/TASK_TEMPLATE.md",
  "docs/ideas/IDEA_TEMPLATE.md",
  "docs/adr/ADR_TEMPLATE.md",
  "docs/handoffs/HANDOFF_TEMPLATE.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/workflows/ci.yml"
];

for (const requiredPath of requiredPaths) {
  if (!existsSync(join(root, requiredPath))) {
    errors.push(`Missing required path: ${requiredPath}`);
  }
}

const activeTasksDir = join(root, "docs/tasks/active");
const activeTasks = existsSync(activeTasksDir)
  ? readdirSync(activeTasksDir).filter((name) => name.endsWith(".md"))
  : [];

if (activeTasks.length !== 1) {
  errors.push(`Expected exactly one active task, found ${activeTasks.length}.`);
}

const trackedFiles = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/u)
  .filter(Boolean);

const forbiddenChecks = [
  { pattern: /\bPurgatorium\b/iu, label: "Purgatorium" },
  { pattern: /\bARIA\b/u, label: "ARIA" },
  { pattern: /\bVl[cč]ek\b/iu, label: "legacy character name" },
  { pattern: /from\s+["'][^"']*(purgatorium|legacy|old-game)[^"']*["']/iu, label: "legacy import" }
];

const allowedExplanatoryFiles = new Set(["README.md", "PROJECT_CHARTER.md", "tools/validate.mjs"]);

for (const file of trackedFiles) {
  const absolute = join(root, file);
  if (!statSync(absolute).isFile()) {
    continue;
  }

  const content = readFileSync(absolute, "utf8");
  for (const check of forbiddenChecks) {
    if (check.pattern.test(content) && !allowedExplanatoryFiles.has(file)) {
      errors.push(`Forbidden legacy reference (${check.label}) in ${relative(root, absolute)}.`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Repository validation passed.");
