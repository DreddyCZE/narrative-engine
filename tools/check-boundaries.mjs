import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const GENERATED_DIRS = new Set([".git", ".turbo", ".cache", "coverage", "dist", "node_modules"]);
const GAME_EXECUTABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const GAME_EXECUTABLE_ALLOWED_DIRS = new Set(["tests", "test", "__tests__", "tools", "scripts"]);

const LEGACY_FIXTURE_DIR = "tests/fixtures/boundaries";

const ruleDescriptions = {
  "engine-no-app-game-theme":
    "packages/engine-* must not import apps, games, themes, or concrete runtime/game code.",
  "runtime-no-engine-deep-import":
    "apps/runtime must use public workspace package exports, not engine source internals.",
  "editor-not-runtime-dependency":
    "packages/** and apps/runtime/** must not import apps/editor/**.",
  "game-data-no-executable":
    "games/** canonical data must not contain executable JavaScript or TypeScript files.",
  "theme-no-runtime-internals":
    "themes/** must not import engine internals or game-data implementation.",
  "plugin-no-engine-internals": "plugins/** must not import engine package internals.",
  "workspace-public-entry": "workspace packages must expose a clear public src/index.ts entry.",
  "no-cross-package-src-import":
    "source files must not import another workspace package through src/** internals.",
  "package-dependency-boundary":
    "package.json dependency declarations must not bypass architecture boundaries."
};

function normalizePath(value) {
  return value.replaceAll("\\", "/").split(sep).join("/");
}

function isUnder(candidate, parent) {
  const rel = relative(parent, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/") && rel !== "..");
}

function toRepoPath(rootDir, filePath) {
  return normalizePath(relative(rootDir, filePath));
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function listFiles(rootDir, options = {}) {
  const includeBoundaryFixtures = options.includeBoundaryFixtures ?? false;
  const files = [];

  function visit(directory) {
    if (!existsSync(directory)) {
      return;
    }

    for (const entry of readdirSync(directory).sort()) {
      const absolute = join(directory, entry);
      const relativePath = toRepoPath(rootDir, absolute);
      const stats = statSync(absolute);

      if (stats.isDirectory()) {
        if (GENERATED_DIRS.has(entry)) {
          continue;
        }
        if (!includeBoundaryFixtures && relativePath.startsWith(`${LEGACY_FIXTURE_DIR}/`)) {
          continue;
        }
        visit(absolute);
        continue;
      }

      if (stats.isFile()) {
        files.push(absolute);
      }
    }
  }

  visit(rootDir);
  return files;
}

function listSourceFiles(rootDir, options = {}) {
  return listFiles(rootDir, options).filter((filePath) => SOURCE_EXTENSIONS.has(extname(filePath)));
}

function workspacePackages(rootDir) {
  const packagesDir = join(rootDir, "packages");
  if (!existsSync(packagesDir)) {
    return [];
  }

  return readdirSync(packagesDir)
    .sort()
    .map((entry) => join(packagesDir, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((packageDir) => {
      const packageJsonPath = join(packageDir, "package.json");
      const packageJson = existsSync(packageJsonPath) ? readJson(packageJsonPath) : {};
      return {
        dir: packageDir,
        name: packageJson.name,
        repoPath: toRepoPath(rootDir, packageDir)
      };
    });
}

function stripComments(content) {
  let output = "";
  let state = "code";

  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];
    const next = content[index + 1];

    if (state === "line-comment") {
      if (current === "\n") {
        output += "\n";
        state = "code";
      } else {
        output += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (current === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "code";
      } else {
        output += current === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (state === "single-quote" || state === "double-quote" || state === "template") {
      output += current;
      if (current === "\\") {
        output += next ?? "";
        index += 1;
        continue;
      }

      if (
        (state === "single-quote" && current === "'") ||
        (state === "double-quote" && current === '"') ||
        (state === "template" && current === "`")
      ) {
        state = "code";
      }
      continue;
    }

    if (current === "/" && next === "/") {
      output += "  ";
      index += 1;
      state = "line-comment";
      continue;
    }

    if (current === "/" && next === "*") {
      output += "  ";
      index += 1;
      state = "block-comment";
      continue;
    }

    if (current === "'") {
      state = "single-quote";
    } else if (current === '"') {
      state = "double-quote";
    } else if (current === "`") {
      state = "template";
    }

    output += current;
  }

  return output;
}

function parseImports(content) {
  const specifiers = [];
  const strippedContent = stripComments(content);
  const patterns = [
    /\bimport\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/gu,
    /\bexport\s+[^"']*\s+from\s+["']([^"']+)["']/gu,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu
  ];

  for (const pattern of patterns) {
    for (const match of strippedContent.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        specifiers.push(specifier);
      }
    }
  }

  return specifiers;
}

function resolveSpecifier(rootDir, sourceFile, specifier, packages) {
  if (specifier.startsWith(".")) {
    return {
      kind: "relative",
      target: resolve(dirname(sourceFile), specifier)
    };
  }

  const matchedPackage = packages.find(
    (pkg) => pkg.name && (specifier === pkg.name || specifier.startsWith(`${pkg.name}/`))
  );

  if (!matchedPackage) {
    return { kind: "external" };
  }

  if (specifier === matchedPackage.name) {
    return {
      kind: "workspace-public",
      package: matchedPackage,
      target: matchedPackage.dir,
      subpath: ""
    };
  }

  const subpath = specifier.slice(`${matchedPackage.name}/`.length);
  return {
    kind: "workspace-subpath",
    package: matchedPackage,
    target: join(matchedPackage.dir, subpath),
    subpath
  };
}

function findWorkspacePackageForFile(filePath, packages) {
  return packages.find((pkg) => isUnder(filePath, pkg.dir));
}

function isDeepPackageSourceTarget(target, pkg) {
  return isUnder(target, join(pkg.dir, "src"));
}

function isAllowedGameExecutable(filePath, rootDir) {
  const repoPathParts = toRepoPath(rootDir, filePath).split("/");
  if (repoPathParts.some((part) => GAME_EXECUTABLE_ALLOWED_DIRS.has(part))) {
    return true;
  }

  return basename(filePath).includes(".config.");
}

function addViolation(violations, rootDir, filePath, ruleId, problem) {
  violations.push({
    file: toRepoPath(rootDir, filePath),
    ruleId,
    problem
  });
}

function dependencySections(packageJson) {
  return [
    ["dependencies", packageJson.dependencies],
    ["devDependencies", packageJson.devDependencies],
    ["peerDependencies", packageJson.peerDependencies],
    ["optionalDependencies", packageJson.optionalDependencies]
  ].filter(([, dependencies]) => dependencies && typeof dependencies === "object");
}

function dependencyTargetsForbiddenPath(specifier) {
  return (
    specifier.includes("apps/") ||
    specifier.includes("apps\\") ||
    specifier.includes("games/") ||
    specifier.includes("games\\") ||
    specifier.includes("themes/") ||
    specifier.includes("themes\\")
  );
}

function dependencyTargetsEditor(specifier) {
  return specifier.includes("apps/editor") || specifier.includes("apps\\editor");
}

function checkPackageDependencies(rootDir, packages, violations) {
  const packageJsonPaths = packages.map((pkg) => join(pkg.dir, "package.json"));
  const runtimePackageJson = join(rootDir, "apps", "runtime", "package.json");
  if (existsSync(runtimePackageJson)) {
    packageJsonPaths.push(runtimePackageJson);
  }

  for (const packageJsonPath of packageJsonPaths.sort()) {
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const repoPath = toRepoPath(rootDir, packageJsonPath);
    const packageJson = readJson(packageJsonPath);
    const isEnginePackage = repoPath.startsWith("packages/engine-");
    const isRuntimeOrPackage = repoPath.startsWith("packages/") || repoPath === "apps/runtime/package.json";

    for (const [section, dependencies] of dependencySections(packageJson)) {
      for (const [dependencyName, dependencyVersion] of Object.entries(dependencies).sort()) {
        const version = String(dependencyVersion);
        const descriptor = `${section}.${dependencyName}=${version}`;

        if (
          isEnginePackage &&
          (dependencyTargetsForbiddenPath(dependencyName) || dependencyTargetsForbiddenPath(version))
        ) {
          addViolation(
            violations,
            rootDir,
            packageJsonPath,
            "package-dependency-boundary",
            `engine package dependency crosses forbidden layer: ${descriptor}.`
          );
        }

        if (
          isRuntimeOrPackage &&
          (dependencyTargetsEditor(dependencyName) || dependencyTargetsEditor(version))
        ) {
          addViolation(
            violations,
            rootDir,
            packageJsonPath,
            "package-dependency-boundary",
            `runtime/package dependency points at editor: ${descriptor}.`
          );
        }
      }
    }
  }
}

export function checkBoundaries(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const includeBoundaryFixtures = options.includeBoundaryFixtures ?? rootDir !== process.cwd();
  const violations = [];
  const packages = workspacePackages(rootDir);
  const sourceFiles = listSourceFiles(rootDir, { includeBoundaryFixtures });

  for (const pkg of packages) {
    const publicEntry = join(pkg.dir, "src", "index.ts");
    if (!pkg.name) {
      addViolation(violations, rootDir, join(pkg.dir, "package.json"), "workspace-public-entry", [
        "package.json must define a workspace package name."
      ].join(" "));
    }
    if (!existsSync(publicEntry)) {
      addViolation(violations, rootDir, publicEntry, "workspace-public-entry", [
        "workspace package must provide src/index.ts as its public entry point."
      ].join(" "));
    }
  }

  checkPackageDependencies(rootDir, packages, violations);

  for (const filePath of sourceFiles) {
    const repoPath = toRepoPath(rootDir, filePath);
    const content = readFileSync(filePath, "utf8");

    if (
      repoPath.startsWith("games/") &&
      GAME_EXECUTABLE_EXTENSIONS.has(extname(filePath)) &&
      !isAllowedGameExecutable(filePath, rootDir)
    ) {
      addViolation(
        violations,
        rootDir,
        filePath,
        "game-data-no-executable",
        `canonical game data may not use executable extension "${extname(filePath)}".`
      );
    }

    for (const specifier of parseImports(content)) {
      const resolved = resolveSpecifier(rootDir, filePath, specifier, packages);
      const target = resolved.target;
      const targetRepoPath = target ? toRepoPath(rootDir, target) : "";
      const sourcePackage = findWorkspacePackageForFile(filePath, packages);
      const targetPackage = packages.find((pkg) => target && isUnder(target, pkg.dir));

      if (
        repoPath.startsWith("packages/engine-") &&
        target &&
        (targetRepoPath.startsWith("apps/") ||
          targetRepoPath.startsWith("games/") ||
          targetRepoPath.startsWith("themes/"))
      ) {
        addViolation(
          violations,
          rootDir,
          filePath,
          "engine-no-app-game-theme",
          `engine package imports forbidden target "${specifier}".`
        );
      }

      if (
        repoPath.startsWith("apps/runtime/") &&
        resolved.kind !== "workspace-public" &&
        target &&
        targetRepoPath.startsWith("packages/engine-")
      ) {
        addViolation(
          violations,
          rootDir,
          filePath,
          "runtime-no-engine-deep-import",
          `runtime must import public package exports, not "${specifier}".`
        );
      }

      if (
        (repoPath.startsWith("packages/") || repoPath.startsWith("apps/runtime/")) &&
        target &&
        targetRepoPath.startsWith("apps/editor/")
      ) {
        addViolation(
          violations,
          rootDir,
          filePath,
          "editor-not-runtime-dependency",
          `runtime/package code must not depend on editor file "${specifier}".`
        );
      }

      if (
        repoPath.startsWith("themes/") &&
        target &&
        (targetRepoPath.startsWith("games/") ||
          targetRepoPath.startsWith("packages/engine-state/src/") ||
          targetRepoPath.startsWith("packages/engine-rules/src/"))
      ) {
        addViolation(
          violations,
          rootDir,
          filePath,
          "theme-no-runtime-internals",
          `theme imports forbidden implementation target "${specifier}".`
        );
      }

      if (
        repoPath.startsWith("plugins/") &&
        resolved.kind !== "workspace-public" &&
        target &&
        targetRepoPath.startsWith("packages/engine-") &&
        targetRepoPath.includes("/src/")
      ) {
        addViolation(
          violations,
          rootDir,
          filePath,
          "plugin-no-engine-internals",
          `plugin must use public extension APIs, not "${specifier}".`
        );
      }

      if (
        targetPackage &&
        sourcePackage &&
        sourcePackage.dir !== targetPackage.dir &&
        resolved.kind !== "workspace-public" &&
        isDeepPackageSourceTarget(target, targetPackage)
      ) {
        addViolation(
          violations,
          rootDir,
          filePath,
          "no-cross-package-src-import",
          `cross-package import must use public package export, not "${specifier}".`
        );
      }

      if (
        resolved.kind === "workspace-subpath" &&
        targetPackage &&
        resolved.subpath.startsWith("src/")
      ) {
        addViolation(
          violations,
          rootDir,
          filePath,
          "no-cross-package-src-import",
          `workspace package import must not target internal source subpath "${specifier}".`
        );
      }
    }
  }

  violations.sort((left, right) => {
    const leftKey = `${left.file}\0${left.ruleId}\0${left.problem}`;
    const rightKey = `${right.file}\0${right.ruleId}\0${right.problem}`;
    return leftKey.localeCompare(rightKey);
  });

  return { ok: violations.length === 0, violations };
}

export function formatViolations(violations) {
  return violations
    .map((violation) => `${violation.file} [${violation.ruleId}] ${violation.problem}`)
    .join("\n");
}

function main() {
  const rootDir = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  const result = checkBoundaries({ rootDir });

  if (!result.ok) {
    console.error(formatViolations(result.violations));
    process.exit(1);
  }

  console.log("Architecture boundary checks passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { ruleDescriptions };
