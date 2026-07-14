import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  RUNTIME_READONLY_INPUT_COMMAND_IDS,
  assertRuntimeReadonlyInputRequest,
  formatRuntimeReadonlyInputRequestValidationMessage,
  inspectRuntimeReadonlyInputRequest,
  toRuntimeCommandRequestFromReadonlyInput
} = engineContracts;

type RuntimeReadonlyInputRequest = engineContracts.RuntimeReadonlyInputRequest;

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime readonly input request contract", () => {
  it("accepts valid read-only input", () => {
    const validInputs: readonly RuntimeReadonlyInputRequest[] = [
      { commandId: "look" },
      {
        commandId: "inventory",
        metadata: {
          requestId: "request.inventory",
          correlationId: "correlation.inventory",
          deterministic: true
        }
      }
    ];

    for (const input of validInputs) {
      expect(inspectRuntimeReadonlyInputRequest(input)).toEqual([]);
      expect(() => { assertRuntimeReadonlyInputRequest(input); }).not.toThrow();
      expect(toRuntimeCommandRequestFromReadonlyInput(input)).toEqual({ commandId: input.commandId });
      expectJsonSafe(toRuntimeCommandRequestFromReadonlyInput(input));
    }

    expect(RUNTIME_READONLY_INPUT_COMMAND_IDS).toEqual(["look", "inventory"]);
    expect(formatRuntimeReadonlyInputRequestValidationMessage([])).toBe("Runtime readonly input request is valid.");
  });

  it("rejects unsupported commands", () => {
    const unsupportedCommandIds = ["go", "talk", "take", "use", "save", "load", "attack", ""] as const;

    for (const commandId of unsupportedCommandIds) {
      const diagnostics = inspectRuntimeReadonlyInputRequest({ commandId });
      expect(diagnostics.some((diagnostic) =>
        diagnostic.code === (commandId === ""
          ? "RUNTIME_READONLY_INPUT_REQUEST_COMMAND_ID_MISSING"
          : "RUNTIME_READONLY_INPUT_REQUEST_COMMAND_ID_UNSUPPORTED") &&
        canonicalizeJson(diagnostic.path) === canonicalizeJson(["commandId"])
      )).toBe(true);
    }
  });

  it("rejects invalid shape", () => {
    const forbiddenKeyInput = JSON.parse('{"commandId":"look","__proto__":"forbidden"}') as unknown;
    const invalidInputs = [
      {
        input: null,
        code: "RUNTIME_READONLY_INPUT_REQUEST_INVALID",
        path: []
      },
      {
        input: [],
        code: "RUNTIME_READONLY_INPUT_REQUEST_INVALID",
        path: []
      },
      {
        input: "look",
        code: "RUNTIME_READONLY_INPUT_REQUEST_INVALID",
        path: []
      },
      {
        input: {},
        code: "RUNTIME_READONLY_INPUT_REQUEST_COMMAND_ID_MISSING",
        path: ["commandId"]
      },
      {
        input: { commandId: 1 },
        code: "RUNTIME_READONLY_INPUT_REQUEST_COMMAND_ID_MISSING",
        path: ["commandId"]
      },
      {
        input: { commandId: "look", extra: true },
        code: "RUNTIME_READONLY_INPUT_REQUEST_UNKNOWN_FIELD",
        path: ["extra"]
      },
      {
        input: { commandId: "look", metadata: "invalid" },
        code: "RUNTIME_READONLY_INPUT_REQUEST_METADATA_INVALID",
        path: ["metadata"]
      },
      {
        input: { commandId: "look", metadata: { extra: true } },
        code: "RUNTIME_READONLY_INPUT_REQUEST_METADATA_UNKNOWN_FIELD",
        path: ["metadata", "extra"]
      },
      {
        input: { commandId: "look", metadata: { requestId: 7 } },
        code: "RUNTIME_READONLY_INPUT_REQUEST_METADATA_INVALID",
        path: ["metadata", "requestId"]
      },
      {
        input: { commandId: "look", metadata: { deterministic: false } },
        code: "RUNTIME_READONLY_INPUT_REQUEST_METADATA_INVALID",
        path: ["metadata", "deterministic"]
      },
      {
        input: forbiddenKeyInput,
        code: "RUNTIME_READONLY_INPUT_REQUEST_FORBIDDEN_KEY",
        path: ["__proto__"]
      }
    ] as const;

    for (const invalid of invalidInputs) {
      const diagnostics = inspectRuntimeReadonlyInputRequest(invalid.input);
      expect(diagnostics.some((diagnostic) =>
        diagnostic.code === invalid.code &&
        canonicalizeJson(diagnostic.path) === canonicalizeJson(invalid.path)
      )).toBe(true);
    }

    expect(() => {
      assertRuntimeReadonlyInputRequest({ commandId: "go" });
    }).toThrowError(/RUNTIME_READONLY_INPUT_REQUEST_COMMAND_ID_UNSUPPORTED/u);
  });

  it("is deterministic", () => {
    const input = {
      commandId: "look",
      metadata: {
        requestId: "request.look",
        correlationId: "correlation.look",
        deterministic: true as const
      }
    };

    const clonedInput = JSON.parse(canonicalizeJson(input)) as RuntimeReadonlyInputRequest;
    const firstDiagnostics = inspectRuntimeReadonlyInputRequest(input);
    const secondDiagnostics = inspectRuntimeReadonlyInputRequest(clonedInput);
    const firstConversion = toRuntimeCommandRequestFromReadonlyInput(input);
    const secondConversion = toRuntimeCommandRequestFromReadonlyInput(clonedInput);

    expect(canonicalizeJson(firstDiagnostics)).toBe(canonicalizeJson(secondDiagnostics));
    expect(canonicalizeJson(firstConversion)).toBe(canonicalizeJson(secondConversion));
  });

  it("does not mutate input during conversion", () => {
    const input: RuntimeReadonlyInputRequest = {
      commandId: "inventory",
      metadata: {
        requestId: "request.inventory",
        correlationId: "correlation.inventory",
        deterministic: true
      }
    };
    const before = canonicalizeJson(input);

    const result = toRuntimeCommandRequestFromReadonlyInput(input);

    expect(canonicalizeJson(input)).toBe(before);
    expect(result).toEqual({ commandId: "inventory" });
  });

  it("does not include execution outputs in the conversion result", () => {
    const result = toRuntimeCommandRequestFromReadonlyInput({ commandId: "look" });

    expect("plan" in result).toBe(false);
    expect("view" in result).toBe(false);
    expect("presentation" in result).toBe(false);
    expect("nextState" in result).toBe(false);
    expect("statePatch" in result).toBe(false);
    expect("events" in result).toBe(false);
    expect("runtimeDomainEventValues" in result).toBe(false);
    expect("transaction" in result).toBe(false);
    expect("saveResult" in result).toBe(false);
    expect("loadResult" in result).toBe(false);
  });

  it("does not introduce generic execution APIs", () => {
    expect("executeCommand" in engineContracts).toBe(false);
    expect("executeRuntimeCommand" in engineContracts).toBe(false);
    expect("applyCommand" in engineContracts).toBe(false);
    expect("moveTo" in engineContracts).toBe(false);
    expect("takeItem" in engineContracts).toBe(false);
    expect("talkToNpc" in engineContracts).toBe(false);
    expect("applyEffectToRuntimePlayerState" in engineContracts).toBe(false);
  });
});
