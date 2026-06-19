import { describe, expect, it } from "vitest";

import {
  adaptEngineStateIssues,
  adaptEntityIdentityIssues,
  adaptJsonSafetyIssues,
  adaptSchemaVersioningIssues,
  assertValidationDiagnostic,
  createValidationDiagnostic,
  formatValidationDiagnostic,
  inspectValidationDiagnostic,
  isValidationDiagnostic,
  normalizeValidationDiagnostics,
  sortValidationDiagnostics,
  VALIDATION_DIAGNOSTIC_CONTRACT_VERSION,
  type ValidationDiagnosticInput
} from "../packages/engine-contracts/src/index.js";
import { inspectJsonSafety } from "../packages/core/src/index.js";
import { inspectEntityIdentity } from "../packages/engine-contracts/src/index.js";
import { inspectSchemaVersionDescriptor } from "../packages/engine-contracts/src/index.js";
import { inspectEngineStateSnapshot } from "../packages/engine-contracts/src/index.js";

function baseInput(overrides: Record<string, unknown> = {}): ValidationDiagnosticInput & Record<string, unknown> {
  const input: ValidationDiagnosticInput & Record<string, unknown> = {
    contractVersion: VALIDATION_DIAGNOSTIC_CONTRACT_VERSION,
    schemaId: "validation-diagnostic",
    schemaVersion: 1,
    code: "INVALID_DIAGNOSTIC_CODE",
    severity: "error",
    category: "schema",
    phase: "schema-validation",
    path: ["root", 0],
    message: "Invalid diagnostic code.",
    ...overrides
  };

  return input;
}

describe("Validation diagnostic adapter", () => {
  it("creates a valid diagnostic with default severity and stable formatting", () => {
    const diagnostic = createValidationDiagnostic(
      baseInput({
        severity: undefined,
        path: ["root", 1, "value"],
        message: "Diagnostic message.",
        source: { kind: "validator", id: "engine-state" },
        details: { nested: { value: 1 } }
      })
    );

    expect(diagnostic.severity).toBe("error");
    expect(isValidationDiagnostic(diagnostic)).toBe(true);
    expect(inspectValidationDiagnostic(diagnostic)).toEqual([]);
    expect(formatValidationDiagnostic(diagnostic)).toBe(
      "INVALID_DIAGNOSTIC_CODE @ /root/1/value: Diagnostic message."
    );
  });

  it("rejects invalid code and severity values", () => {
    const issues = inspectValidationDiagnostic(
      baseInput({
        code: "bad-code",
        severity: "severe"
      })
    );

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["INVALID_DIAGNOSTIC_CODE", "INVALID_SEVERITY"])
    );
  });

  it("rejects invalid paths", () => {
    const issues = inspectValidationDiagnostic(
      baseInput({
        path: ["root", Number.NaN]
      })
    );

    expect(issues.map((issue) => issue.code)).toContain("INVALID_LOCATION");
  });

  it("rejects invalid, forbidden, and cyclic details values", () => {
    const unsafeDetailsIssues = inspectValidationDiagnostic(
      baseInput({
        details: () => undefined
      })
    );
    expect(unsafeDetailsIssues.map((issue) => issue.code)).toContain("UNSAFE_DIAGNOSTIC_VALUE");

    const forbiddenDetailsIssues = inspectValidationDiagnostic(
      baseInput({
        details: JSON.parse('{"__proto__":{"polluted":true}}')
      })
    );
    expect(forbiddenDetailsIssues.map((issue) => issue.code)).toContain("UNSAFE_DIAGNOSTIC_VALUE");

    const cyclicDetails: Record<string, unknown> = { nested: {} };
    (cyclicDetails.nested as Record<string, unknown>).self = cyclicDetails;
    const cyclicDetailsIssues = inspectValidationDiagnostic(
      baseInput({
        details: cyclicDetails
      })
    );
    expect(cyclicDetailsIssues.map((issue) => issue.code)).toContain("DIAGNOSTIC_REFERENCE_CYCLE");
  });

  it("keeps diagnostics and inputs immutable", () => {
    const input = {
      code: "VALIDATION_NOTE",
      message: "Immutable input.",
      path: ["root", "value"],
      ownerContract: "engine-state@0.1.0",
      source: { kind: "validator", id: "engine-state" },
      details: { nested: { value: 1 } }
    } as const;
    const before = JSON.stringify(input);
    const diagnostic = createValidationDiagnostic(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(diagnostic.details).toEqual({ nested: { value: 1 } });
    expect(diagnostic.source).toEqual({ kind: "validator", id: "engine-state" });
  });

  it("sorts diagnostics deterministically", () => {
    const diagnostics = sortValidationDiagnostics([
      createValidationDiagnostic({
        code: "BETA",
        severity: "warning",
        category: "validation",
        phase: "semantic-validation",
        path: ["a"],
        message: "z"
      }),
      createValidationDiagnostic({
        code: "ALPHA",
        severity: "error",
        category: "validation",
        phase: "semantic-validation",
        path: ["a"],
        message: "b"
      }),
      createValidationDiagnostic({
        code: "ALPHA",
        severity: "error",
        category: "validation",
        phase: "semantic-validation",
        path: ["a"],
        message: "a"
      }),
      createValidationDiagnostic({
        code: "ALPHA",
        severity: "error",
        category: "validation",
        phase: "semantic-validation",
        path: ["b"],
        message: "a"
      })
    ]);

    expect(
      diagnostics.map(
        (diagnostic) => `${diagnostic.path.join(".")}:${diagnostic.code}:${diagnostic.severity}:${diagnostic.message}`
      )
    ).toEqual(["a:ALPHA:error:a", "a:ALPHA:error:b", "a:BETA:warning:z", "b:ALPHA:error:a"]);
  });

  it("normalizes diagnostics without mutating the input list", () => {
    const inputs = [
      {
        code: "ZETA",
        message: "Second",
        path: ["b"],
        category: "validation" as const,
        phase: "semantic-validation" as const
      },
      {
        code: "ALPHA",
        message: "First",
        path: ["a"],
        category: "validation" as const,
        phase: "semantic-validation" as const
      }
    ];

    const before = JSON.stringify(inputs);
    const normalized = normalizeValidationDiagnostics(inputs);

    expect(JSON.stringify(inputs)).toBe(before);
    expect(normalized.map((entry) => entry.code)).toEqual(["ALPHA", "ZETA"]);
  });

  it("adapts json safety issues and contract validator issues", () => {
    const jsonSafetyDiagnostics = adaptJsonSafetyIssues(inspectJsonSafety(JSON.parse('{"__proto__":1}')));
    expect(jsonSafetyDiagnostics[0]).toMatchObject({
      code: "FORBIDDEN_KEY",
      severity: "error",
      category: "security",
      phase: "pre-serialization",
      ownerContract: VALIDATION_DIAGNOSTIC_CONTRACT_VERSION
    });

    const entityDiagnostics = adaptEntityIdentityIssues(inspectEntityIdentity({}));
    expect(entityDiagnostics[0]).toMatchObject({
      severity: "error",
      ownerContract: "entity-identity@0.1.0"
    });

    const schemaDiagnostics = adaptSchemaVersioningIssues(inspectSchemaVersionDescriptor({}));
    expect(schemaDiagnostics[0]).toMatchObject({
      severity: "error",
      ownerContract: "schema-versioning@0.1.0"
    });

    const stateDiagnostics = adaptEngineStateIssues(inspectEngineStateSnapshot(undefined));
    expect(stateDiagnostics[0]).toMatchObject({
      severity: "error",
      ownerContract: "engine-state@0.1.0"
    });
  });

  it("asserts valid diagnostics and rejects invalid ones", () => {
    const diagnostic = createValidationDiagnostic(
      baseInput({
        message: "Asserted diagnostic.",
        path: ["root"]
      })
    );

    expect(() => {
      assertValidationDiagnostic(diagnostic);
    }).not.toThrow();
    expect(() => {
      assertValidationDiagnostic({ code: "bad" });
    }).toThrowError(/INVALID_DIAGNOSTIC_SHAPE/);
  });
});
