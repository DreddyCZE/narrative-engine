import {
  canonicalizeJson,
  formatJsonPath,
  inspectJsonSafety,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ValidationDiagnostic,
  type ValidationDiagnosticCategory,
  type ValidationDiagnosticPhase
} from "../validation-diagnostic/validation-diagnostic.js";
import { type RuntimeCommandRequest } from "./runtime-host-types.js";

export const RUNTIME_READONLY_INPUT_COMMAND_IDS = ["look", "inventory"] as const;
export const RUNTIME_READONLY_INPUT_REQUEST_CONTRACT_VERSION =
  "runtime-readonly-input-request-contract@0.1.0" as const;

const READONLY_INPUT_REQUEST_KEYS = new Set(["commandId", "metadata"]);
const READONLY_INPUT_REQUEST_METADATA_KEYS = new Set(["requestId", "correlationId", "deterministic"]);

export type RuntimeReadonlyInputCommandId = (typeof RUNTIME_READONLY_INPUT_COMMAND_IDS)[number];
export type RuntimeReadonlyInputRequestDiagnostic = ValidationDiagnostic;

export type RuntimeReadonlyInputRequest = {
  readonly commandId: RuntimeReadonlyInputCommandId;
  readonly metadata?: {
    readonly requestId?: string;
    readonly correlationId?: string;
    readonly deterministic?: true;
  };
};

export class RuntimeReadonlyInputRequestValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimeReadonlyInputRequestDiagnostic[];

  public constructor(diagnostics: readonly RuntimeReadonlyInputRequestDiagnostic[]) {
    super(formatRuntimeReadonlyInputRequestValidationMessage(diagnostics));
    this.name = "RuntimeReadonlyInputRequestValidationError";
    this.diagnostics = diagnostics;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function createDiagnostic(
  code: string,
  path: readonly JsonPathSegment[],
  message: string,
  category: ValidationDiagnosticCategory,
  phase: ValidationDiagnosticPhase,
  details?: JsonValue
): RuntimeReadonlyInputRequestDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_READONLY_INPUT_REQUEST_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-readonly-input-request-contract",
      id: "readonly-input-request",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function inspectMetadata(value: unknown): readonly RuntimeReadonlyInputRequestDiagnostic[] {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_READONLY_INPUT_REQUEST_METADATA_INVALID",
        ["metadata"],
        "metadata must be an object when present.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeReadonlyInputRequestDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!READONLY_INPUT_REQUEST_METADATA_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_READONLY_INPUT_REQUEST_METADATA_UNKNOWN_FIELD",
          ["metadata", key],
          `unknown field "${key}" is not allowed.`,
          "shape",
          "shape-validation"
        )
      );
    }
  }

  if (value.requestId !== undefined && typeof value.requestId !== "string") {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_INPUT_REQUEST_METADATA_INVALID",
        ["metadata", "requestId"],
        "requestId must be a string when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  if (value.correlationId !== undefined && typeof value.correlationId !== "string") {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_INPUT_REQUEST_METADATA_INVALID",
        ["metadata", "correlationId"],
        "correlationId must be a string when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  if (value.deterministic !== undefined && value.deterministic !== true) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_INPUT_REQUEST_METADATA_INVALID",
        ["metadata", "deterministic"],
        "metadata.deterministic must be true when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  return diagnostics;
}

function validateCommandId(
  diagnostics: RuntimeReadonlyInputRequestDiagnostic[],
  value: unknown
): value is RuntimeReadonlyInputCommandId {
  if (typeof value !== "string" || value.length === 0) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_INPUT_REQUEST_COMMAND_ID_MISSING",
        ["commandId"],
        "commandId is required.",
        "shape",
        "shape-validation"
      )
    );
    return false;
  }

  if (!(RUNTIME_READONLY_INPUT_COMMAND_IDS as readonly string[]).includes(value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_INPUT_REQUEST_COMMAND_ID_UNSUPPORTED",
        ["commandId"],
        "commandId is not supported by the read-only input contract.",
        "validation",
        "runtime-readonly-input-request-validation",
        { supportedCommandIds: RUNTIME_READONLY_INPUT_COMMAND_IDS }
      )
    );
    return false;
  }

  return true;
}

export function inspectRuntimeReadonlyInputRequest(
  value: unknown
): readonly RuntimeReadonlyInputRequestDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_READONLY_INPUT_REQUEST_INVALID",
        [],
        "runtime readonly input request must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeReadonlyInputRequestDiagnostic[] = [];

  for (const issue of inspectJsonSafety(value)) {
    diagnostics.push(
      createDiagnostic(
        issue.code === "FORBIDDEN_KEY"
          ? "RUNTIME_READONLY_INPUT_REQUEST_FORBIDDEN_KEY"
          : "RUNTIME_READONLY_INPUT_REQUEST_NON_JSON_VALUE",
        issue.path,
        issue.message,
        issue.code === "FORBIDDEN_KEY" ? "security" : "serialization",
        "pre-serialization"
      )
    );
  }

  for (const key of Object.keys(value)) {
    if (!READONLY_INPUT_REQUEST_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_READONLY_INPUT_REQUEST_UNKNOWN_FIELD",
          [key],
          `unknown field "${key}" is not allowed.`,
          "shape",
          "shape-validation"
        )
      );
    }
  }

  validateCommandId(diagnostics, value.commandId);
  diagnostics.push(...inspectMetadata(value.metadata));

  return sortValidationDiagnostics(diagnostics);
}

export function formatRuntimeReadonlyInputRequestValidationMessage(
  diagnostics: readonly RuntimeReadonlyInputRequestDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime readonly input request is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimeReadonlyInputRequest(
  value: unknown
): asserts value is RuntimeReadonlyInputRequest {
  const diagnostics = inspectRuntimeReadonlyInputRequest(value);
  if (diagnostics.length > 0) {
    throw new RuntimeReadonlyInputRequestValidationError(diagnostics);
  }
}

export function toRuntimeCommandRequestFromReadonlyInput(
  input: RuntimeReadonlyInputRequest
): RuntimeCommandRequest {
  assertRuntimeReadonlyInputRequest(input);

  return cloneJsonValue({
    commandId: input.commandId
  });
}
