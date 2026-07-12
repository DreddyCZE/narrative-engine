import {
  formatJsonPath,
  inspectJsonSafety,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import {
  isContentActionAffordance,
  type ContentActionAffordance
} from "../content/content-package-types.js";
import {
  createContentReadModel,
  inspectContentReadModelInput,
  type ContentReadModel,
  type ContentReadModelInput
} from "../content-runtime/content-read-model.js";
import {
  inspectRuntimePlayerState,
  type RuntimePlayerState
} from "../content-runtime/runtime-player-state.js";
import { type RuntimeCommandRequest } from "./runtime-host-types.js";
import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ValidationDiagnostic,
  type ValidationDiagnosticCategory,
  type ValidationDiagnosticPhase
} from "../validation-diagnostic/validation-diagnostic.js";

export const RUNTIME_COMMAND_REQUEST_CONTRACT_VERSION = "runtime-command-request@0.1.0" as const;

const COMMAND_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const ENTITY_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;
const TOP_LEVEL_KEYS = new Set(["commandId", "actorId", "targetId", "payload"]);

export type RuntimeCommandRequestDiagnostic = ValidationDiagnostic;

export type RuntimeCommandRequestValidationInput = {
  readonly request: unknown;
  readonly content: ContentReadModel | ContentReadModelInput;
  readonly playerState?: RuntimePlayerState;
};

export class RuntimeCommandRequestValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimeCommandRequestDiagnostic[];

  public constructor(diagnostics: readonly RuntimeCommandRequestDiagnostic[]) {
    super(formatRuntimeCommandRequestValidationMessage(diagnostics));
    this.name = "RuntimeCommandRequestValidationError";
    this.diagnostics = diagnostics;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContentReadModel(value: ContentReadModel | ContentReadModelInput): value is ContentReadModel {
  return typeof (value as ContentReadModel).getPackageId === "function";
}

function createDiagnostic(
  code: string,
  path: readonly JsonPathSegment[],
  message: string,
  category: ValidationDiagnosticCategory,
  phase: ValidationDiagnosticPhase,
  details?: JsonValue
): RuntimeCommandRequestDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_COMMAND_REQUEST_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-command-request",
      id: "request-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function prefixDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  pathPrefix: readonly JsonPathSegment[],
  sourceId: string
): readonly RuntimeCommandRequestDiagnostic[] {
  return diagnostics.map((diagnostic) =>
    createValidationDiagnostic({
      ...diagnostic,
      path: [...pathPrefix, ...diagnostic.path],
      source: diagnostic.source === undefined
        ? {
            kind: sourceId,
            id: sourceId,
            path: [...pathPrefix, ...diagnostic.path]
          }
        : {
            ...diagnostic.source,
            id: sourceId,
            path: diagnostic.source.path === undefined
              ? [...pathPrefix, ...diagnostic.path]
              : [...pathPrefix, ...diagnostic.source.path]
          }
    })
  );
}

function validateCommandId(
  diagnostics: RuntimeCommandRequestDiagnostic[],
  value: unknown
): value is ContentActionAffordance {
  if (typeof value !== "string" || value.length === 0) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_COMMAND_REQUEST_COMMAND_ID_MISSING",
        ["commandId"],
        "commandId is required.",
        "shape",
        "shape-validation"
      )
    );
    return false;
  }

  if (!COMMAND_ID_PATTERN.test(value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_COMMAND_REQUEST_COMMAND_ID_INVALID",
        ["commandId"],
        "commandId is invalid.",
        "identity",
        "identity-validation"
      )
    );
    return false;
  }

  if (!isContentActionAffordance(value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_COMMAND_REQUEST_COMMAND_ID_UNSUPPORTED",
        ["commandId"],
        "commandId is not supported by the minimal runtime command set.",
        "validation",
        "runtime-command-request-validation",
        { supportedCommandIds: ["go", "inventory", "load", "look", "save", "take", "talk", "use"] }
      )
    );
    return false;
  }

  return true;
}

function validateOptionalEntityId(
  diagnostics: RuntimeCommandRequestDiagnostic[],
  key: "actorId" | "targetId",
  value: unknown
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "string" || !ENTITY_ID_PATTERN.test(value)) {
    diagnostics.push(
      createDiagnostic(
        key === "actorId"
          ? "RUNTIME_COMMAND_REQUEST_ACTOR_ID_INVALID"
          : "RUNTIME_COMMAND_REQUEST_TARGET_ID_INVALID",
        [key],
        `${key} is invalid.`,
        "identity",
        "identity-validation"
      )
    );
  }
}

export function inspectRuntimeCommandRequest(value: unknown): readonly RuntimeCommandRequestDiagnostic[] {
  const diagnostics: RuntimeCommandRequestDiagnostic[] = [];

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_COMMAND_REQUEST_INVALID",
        [],
        "runtime command request must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  for (const issue of inspectJsonSafety(value)) {
    diagnostics.push(
      createDiagnostic(
        issue.code === "FORBIDDEN_KEY"
          ? "RUNTIME_COMMAND_REQUEST_FORBIDDEN_KEY"
          : "RUNTIME_COMMAND_REQUEST_NON_JSON_VALUE",
        issue.path,
        issue.message,
        issue.code === "FORBIDDEN_KEY" ? "security" : "serialization",
        "pre-serialization"
      )
    );
  }

  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_COMMAND_REQUEST_UNKNOWN_FIELD",
          [key],
          `unknown field "${key}" is not allowed.`,
          "shape",
          "shape-validation"
        )
      );
    }
  }

  validateCommandId(diagnostics, value.commandId);
  validateOptionalEntityId(diagnostics, "actorId", value.actorId);
  validateOptionalEntityId(diagnostics, "targetId", value.targetId);

  return sortValidationDiagnostics(diagnostics);
}

export function formatRuntimeCommandRequestValidationMessage(
  diagnostics: readonly RuntimeCommandRequestDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime command request is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimeCommandRequest(value: unknown): asserts value is RuntimeCommandRequest {
  const diagnostics = inspectRuntimeCommandRequest(value);
  if (diagnostics.length > 0) {
    throw new RuntimeCommandRequestValidationError(diagnostics);
  }
}

export function inspectRuntimeCommandRequestAgainstContent(
  input: RuntimeCommandRequestValidationInput
): readonly RuntimeCommandRequestDiagnostic[] {
  const diagnostics: RuntimeCommandRequestDiagnostic[] = [
    ...prefixDiagnostics(inspectRuntimeCommandRequest(input.request), ["request"], "request-input")
  ];

  if (!isContentReadModel(input.content)) {
    diagnostics.push(
      ...prefixDiagnostics(
        inspectContentReadModelInput(input.content),
        ["content"],
        "content-input"
      )
    );
  }

  if (input.playerState !== undefined) {
    diagnostics.push(
      ...prefixDiagnostics(
        inspectRuntimePlayerState(input.playerState),
        ["playerState"],
        "player-state"
      )
    );
  }

  if (diagnostics.length > 0) {
    return sortValidationDiagnostics(diagnostics);
  }

  const request = input.request as RuntimeCommandRequest;
  const content = isContentReadModel(input.content) ? input.content : createContentReadModel(input.content);
  const commandId = request.commandId as ContentActionAffordance;

  if (!content.hasActionAffordance(commandId)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_COMMAND_REQUEST_COMMAND_UNAVAILABLE",
        ["request", "commandId"],
        "commandId is not available in the current content action affordances.",
        "reference",
        "content-affordance-validation",
        {
          commandId,
          packageId: content.getPackageId()
        }
      )
    );
  }

  return sortValidationDiagnostics(diagnostics);
}
