import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const runBoundaryCheck = (fixtureName: string): { status: "pass" | "fail"; output: string } => {
  const fixtureRoot = `tests/fixtures/boundaries/${fixtureName}`;

  try {
    const output = execFileSync("node", ["tools/check-boundaries.mjs", fixtureRoot], {
      encoding: "utf8",
      stdio: "pipe"
    });
    return { status: "pass", output };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string };
    return {
      status: "fail",
      output: `${execError.stdout ?? ""}${execError.stderr ?? ""}`
    };
  }
};

describe("architecture boundary checker", () => {
  it("allows public workspace package imports", () => {
    const result = runBoundaryCheck("valid-public-package-import");

    expect(result.status).toBe("pass");
  });

  it("rejects engine imports of concrete game data", () => {
    const result = runBoundaryCheck("invalid-engine-import-game");

    expect(result.status).toBe("fail");
    expect(result.output).toContain("engine-no-app-game-theme");
  });

  it("rejects engine package dependencies on concrete game packages", () => {
    const result = runBoundaryCheck("invalid-engine-package-game-dependency");

    expect(result.status).toBe("fail");
    expect(result.output).toContain("package-dependency-boundary");
    expect(result.output).toContain("packages/engine-kernel/package.json");
  });

  it("rejects engine package dependencies on the editor app", () => {
    const result = runBoundaryCheck("invalid-engine-package-editor-dependency");

    expect(result.status).toBe("fail");
    expect(result.output).toContain("package-dependency-boundary");
    expect(result.output).toContain("apps/editor");
  });

  it("rejects runtime deep imports into engine source files", () => {
    const result = runBoundaryCheck("invalid-runtime-engine-deep-import");

    expect(result.status).toBe("fail");
    expect(result.output).toContain("runtime-no-engine-deep-import");
  });

  it("rejects package dependencies on the editor app", () => {
    const result = runBoundaryCheck("invalid-engine-editor-dependency");

    expect(result.status).toBe("fail");
    expect(result.output).toContain("editor-not-runtime-dependency");
  });

  it("rejects cross-package deep imports through src internals", () => {
    const result = runBoundaryCheck("invalid-cross-package-deep-import");

    expect(result.status).toBe("fail");
    expect(result.output).toContain("no-cross-package-src-import");
  });

  it("rejects executable files in canonical game data", () => {
    const result = runBoundaryCheck("invalid-game-executable-data");

    expect(result.status).toBe("fail");
    expect(result.output).toContain("game-data-no-executable");
  });

  it("allows ordinary non-executable game data files", () => {
    const result = runBoundaryCheck("valid-game-data-json");

    expect(result.status).toBe("pass");
  });

  it("ignores import-looking text inside comments", () => {
    const result = runBoundaryCheck("valid-commented-import-text");

    expect(result.status).toBe("pass");
  });

  it("reports file and rule id for boundary violations", () => {
    const result = runBoundaryCheck("invalid-engine-import-game");

    expect(result.status).toBe("fail");
    expect(result.output).toContain("packages/engine-kernel/src/index.ts");
    expect(result.output).toContain("[engine-no-app-game-theme]");
  });
});
