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
  "docs/contracts/CONTRACT_INVENTORY.md",
  "docs/contracts/CONTRACT_DEPENDENCY_ORDER.md",
  "docs/contracts/CONTRACT_VERSIONING_POLICY.md",
  "docs/contracts/ARCHITECTURE_BOUNDARIES.md",
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

if (activeTasks.length > 1) {
  errors.push(`Expected at most one active task, found ${activeTasks.length}.`);
}

const currentStatePath = join(root, "docs/status/CURRENT_STATE.md");
if (existsSync(currentStatePath)) {
  const currentState = readFileSync(currentStatePath, "utf8");
  const claimsNoActiveTask = /\*\*Active task:\*\*\s+none/iu.test(currentState);
  if (activeTasks.length === 0 && !claimsNoActiveTask) {
    errors.push("CURRENT_STATE.md must say `Active task: none` when no active task file exists.");
  }
  if (activeTasks.length === 1 && claimsNoActiveTask) {
    errors.push("CURRENT_STATE.md says no active task, but one active task file exists.");
  }
}

const requiredContracts = [
  "Entity Identity Contract",
  "Schema Versioning Contract",
  "Game Manifest Contract",
  "Game Data Schema Contract",
  "Engine State Contract",
  "Command Contract",
  "Transaction Contract",
  "Condition Contract",
  "Effect Contract",
  "Domain Event Contract",
  "Event Log Contract",
  "Scheduler Contract",
  "Check Resolver Contract",
  "View Model Contract",
  "Save Contract",
  "Migration Contract",
  "Validation Diagnostic Contract",
  "Localization Contract",
  "Theme Contract",
  "Asset Manifest Contract",
  "Plugin Contract",
  "Script Extension Contract",
  "Source Provenance Contract",
  "Runtime Error Contract",
  "Editor Draft and Approval Contract",
  "Context Pack Contract"
];

const inventoryPath = join(root, "docs/contracts/CONTRACT_INVENTORY.md");
if (existsSync(inventoryPath)) {
  const inventory = readFileSync(inventoryPath, "utf8");
  for (const contractName of requiredContracts) {
    if (!inventory.includes(`### ${contractName}`)) {
      errors.push(`Contract inventory missing required section: ${contractName}`);
    }
  }

  for (const status of ["IDENTIFIED", "DRAFT_REQUIRED", "DEFERRED", "NOT_REQUIRED"]) {
    if (!inventory.includes(status)) {
      errors.push(`Contract inventory missing status definition or use: ${status}`);
    }
  }
}

const dependencyOrderPath = join(root, "docs/contracts/CONTRACT_DEPENDENCY_ORDER.md");
if (existsSync(dependencyOrderPath)) {
  const dependencyOrder = readFileSync(dependencyOrderPath, "utf8");
  const requiredM1Order = [
    "1. Entity Identity",
    "2. Schema Versioning",
    "3. Engine State",
    "4. Condition",
    "5. Effect",
    "6. Command",
    "7. Transaction",
    "8. Domain Event",
    "9. Validation Diagnostic"
  ];

  let previousIndex = -1;
  for (const item of requiredM1Order) {
    const index = dependencyOrder.indexOf(item);
    if (index <= previousIndex) {
      errors.push(`Contract dependency order missing or reordering M1 item: ${item}`);
      break;
    }
    previousIndex = index;
  }

  if (!dependencyOrder.includes("```mermaid")) {
    errors.push("Contract dependency order must include a Mermaid dependency graph.");
  }
}

const versioningPolicyPath = join(root, "docs/contracts/CONTRACT_VERSIONING_POLICY.md");
if (existsSync(versioningPolicyPath)) {
  const versioningPolicy = readFileSync(versioningPolicyPath, "utf8");
  const requiredPolicyTerms = [
    "Package Version",
    "Contract Version",
    "Schema Version",
    "Save Format Version",
    "Plugin API Version",
    "Compatible Changes",
    "Incompatible Changes",
    "Deprecation Policy",
    "Migration Obligation",
    "Stable ID Aliasing",
    "Contract Test Fixtures",
    "No Silent Public Contract Changes"
  ];

  for (const term of requiredPolicyTerms) {
    if (!versioningPolicy.includes(term)) {
      errors.push(`Contract versioning policy missing section: ${term}`);
    }
  }
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
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
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
