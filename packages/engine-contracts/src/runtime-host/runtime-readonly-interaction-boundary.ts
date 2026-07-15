import {
  canonicalizeJson,
  formatJsonPath,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import {
  inspectContentReadModelInput,
  type ContentReadModel,
  type ContentReadModelInput
} from "../content-runtime/content-read-model.js";
import {
  inspectRuntimePlayerState,
  type RuntimePlayerState
} from "../content-runtime/runtime-player-state.js";
import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ValidationDiagnostic,
  type ValidationDiagnosticCategory,
  type ValidationDiagnosticPhase
} from "../validation-diagnostic/validation-diagnostic.js";
import {
  inspectRuntimeReadonlyInputRequest,
  type RuntimeReadonlyInputRequest
} from "./runtime-readonly-input-request-contract.js";
import {
  executeRuntimeReadonlyRequest,
  type RuntimeReadonlyRequestExecutionResult
} from "./runtime-readonly-request-execution-facade.js";
import {
  toRuntimeCommandRequestFromReadonlyInput
} from "./runtime-readonly-input-request-contract.js";
import { type RuntimeCommandRequest } from "./runtime-host-types.js";

export const RUNTIME_READONLY_INTERACTION_STATUSES = ["executed", "rejected", "blocked"] as const;
export const RUNTIME_READONLY_INTERACTION_BOUNDARY_CONTRACT_VERSION =
  "runtime-readonly-interaction-boundary@0.1.0" as const;

const READONLY_INTERACTION_INPUT_KEYS = new Set(["input", "content", "playerState", "metadata"]);
const READONLY_INTERACTION_METADATA_KEYS = new Set(["requestId", "correlationId", "deterministic"]);

export type RuntimeReadonlyInteractionStatus = (typeof RUNTIME_READONLY_INTERACTION_STATUSES)[number];
export type RuntimeReadonlyInteractionDiagnostic = ValidationDiagnostic;

export type RuntimeReadonlyInteractionInput = {
  readonly input: RuntimeReadonlyInputRequest;
  readonly content: ContentReadModel | ContentReadModelInput;
  readonly playerState: RuntimePlayerState;
  readonly metadata?: {
    readonly requestId?: string;
    readonly correlationId?: string;
    readonly deterministic?: true;
  };
};

export type RuntimeReadonlyInteractionResult = {
  readonly status: RuntimeReadonlyInteractionStatus;
  readonly input?: RuntimeReadonlyInputRequest;
  readonly request?: RuntimeCommandRequest;
  readonly execution?: RuntimeReadonlyRequestExecutionResult;
  readonly diagnostics: readonly RuntimeReadonlyInteractionDiagnostic[];
  readonly initialPlayerState?: RuntimePlayerState;
  readonly finalPlayerState?: RuntimePlayerState;
  readonly metadata: {
    readonly deterministic: true;
    readonly interactionVersion: typeof RUNTIME_READONLY_INTERACTION_BOUNDARY_CONTRACT_VERSION;
    readonly requestId?: string;
    readonly correlationId?: string;
    readonly diagnosticCount: number;
  };
};

export class RuntimeReadonlyInteractionValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimeReadonlyInteractionDiagnostic[];

  public constructor(diagnostics: readonly RuntimeReadonlyInteractionDiagnostic[]) {
    super(formatRuntimeReadonlyInteractionValidationMessage(diagnostics));
    this.name = "RuntimeReadonlyInteractionValidationError";
    this.diagnostics = diagnostics;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContentReadModel(value: ContentReadModel | ContentReadModelInput): value is ContentReadModel {
  return typeof (value as ContentReadModel).getPackageId === "function";
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
): RuntimeReadonlyInteractionDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_READONLY_INTERACTION_BOUNDARY_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-readonly-interaction-boundary",
      id: "readonly-interaction-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function prefixDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  pathPrefix: readonly JsonPathSegment[],
  sourceId: string
): readonly RuntimeReadonlyInteractionDiagnostic[] {
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

function inspectMetadata(value: unknown): readonly RuntimeReadonlyInteractionDiagnostic[] {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_READONLY_INTERACTION_METADATA_INVALID",
        ["metadata"],
        "metadata must be an object when present.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeReadonlyInteractionDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!READONLY_INTERACTION_METADATA_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_READONLY_INTERACTION_METADATA_UNKNOWN_FIELD",
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
        "RUNTIME_READONLY_INTERACTION_METADATA_INVALID",
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
        "RUNTIME_READONLY_INTERACTION_METADATA_INVALID",
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
        "RUNTIME_READONLY_INTERACTION_METADATA_INVALID",
        ["metadata", "deterministic"],
        "metadata.deterministic must be true when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  return diagnostics;
}

function createBaseMetadata(
  input: Partial<RuntimeReadonlyInteractionInput>,
  diagnosticCount: number
): RuntimeReadonlyInteractionResult["metadata"] {
  return {
    deterministic: true,
    interactionVersion: RUNTIME_READONLY_INTERACTION_BOUNDARY_CONTRACT_VERSION,
    ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
    ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId }),
    diagnosticCount
  };
}

function createTerminalResult(
  input: Partial<RuntimeReadonlyInteractionInput>,
  status: RuntimeReadonlyInteractionStatus,
  diagnostics: readonly RuntimeReadonlyInteractionDiagnostic[],
  readonlyInput?: RuntimeReadonlyInputRequest,
  request?: RuntimeCommandRequest,
  execution?: RuntimeReadonlyRequestExecutionResult,
  initialPlayerState?: RuntimePlayerState,
  finalPlayerState?: RuntimePlayerState
): RuntimeReadonlyInteractionResult {
  const sortedDiagnostics = sortValidationDiagnostics(diagnostics);
  const result: RuntimeReadonlyInteractionResult = {
    status,
    ...(readonlyInput === undefined ? {} : { input: readonlyInput }),
    ...(request === undefined ? {} : { request }),
    ...(execution === undefined ? {} : { execution }),
    diagnostics: sortedDiagnostics,
    ...(initialPlayerState === undefined ? {} : { initialPlayerState }),
    ...(finalPlayerState === undefined ? {} : { finalPlayerState }),
    metadata: createBaseMetadata(input, sortedDiagnostics.length)
  };

  return cloneJsonValue(result as JsonValue) as RuntimeReadonlyInteractionResult;
}

export function inspectRuntimeReadonlyInteractionInput(
  value: unknown
): readonly RuntimeReadonlyInteractionDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_READONLY_INTERACTION_INPUT_INVALID",
        [],
        "runtime readonly interaction input must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeReadonlyInteractionDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!READONLY_INTERACTION_INPUT_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_READONLY_INTERACTION_INPUT_UNKNOWN_FIELD",
          [key],
          `unknown field "${key}" is not allowed.`,
          "shape",
          "shape-validation"
        )
      );
    }
  }

  diagnostics.push(...inspectMetadata(value.metadata));

  if (!("input" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_INTERACTION_INPUT_INVALID",
        ["input"],
        "input is required.",
        "shape",
        "shape-validation"
      )
    );
  } else {
    diagnostics.push(
      ...prefixDiagnostics(
        inspectRuntimeReadonlyInputRequest(value.input),
        ["input"],
        "readonly-input"
      )
    );
  }

  if (!("content" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_INTERACTION_INPUT_INVALID",
        ["content"],
        "content is required.",
        "shape",
        "shape-validation"
      )
    );
  } else if (!isContentReadModel(value.content as ContentReadModel | ContentReadModelInput)) {
    diagnostics.push(
      ...prefixDiagnostics(
        inspectContentReadModelInput(value.content),
        ["content"],
        "content-input"
      )
    );
  }

  if (!("playerState" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_INTERACTION_INPUT_INVALID",
        ["playerState"],
        "playerState is required.",
        "shape",
        "shape-validation"
      )
    );
  } else {
    diagnostics.push(
      ...prefixDiagnostics(
        inspectRuntimePlayerState(value.playerState),
        ["playerState"],
        "player-state"
      )
    );
  }

  return sortValidationDiagnostics(diagnostics);
}

export function formatRuntimeReadonlyInteractionValidationMessage(
  diagnostics: readonly RuntimeReadonlyInteractionDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime readonly interaction input is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimeReadonlyInteractionInput(
  value: unknown
): asserts value is RuntimeReadonlyInteractionInput {
  const diagnostics = inspectRuntimeReadonlyInteractionInput(value);
  if (diagnostics.length > 0) {
    throw new RuntimeReadonlyInteractionValidationError(diagnostics);
  }
}

export function executeRuntimeReadonlyInteraction(
  input: RuntimeReadonlyInteractionInput
): RuntimeReadonlyInteractionResult {
  const inputDiagnostics = inspectRuntimeReadonlyInteractionInput(input);
  const readonlyInput = isRecord(input) && "input" in input && isRecord(input.input)
    ? cloneJsonValue(input.input as JsonValue) as RuntimeReadonlyInputRequest
    : undefined;
  const initialPlayerState = isRecord(input) && "playerState" in input && isRecord(input.playerState)
    ? cloneJsonValue(input.playerState as JsonValue) as RuntimePlayerState
    : undefined;
  const finalPlayerState = initialPlayerState === undefined
    ? undefined
    : cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState;

  if (inputDiagnostics.length > 0) {
    return createTerminalResult(
      input,
      "rejected",
      inputDiagnostics,
      readonlyInput,
      undefined,
      undefined,
      initialPlayerState,
      finalPlayerState
    );
  }

  const request = toRuntimeCommandRequestFromReadonlyInput(input.input);
  const execution = executeRuntimeReadonlyRequest({
    request,
    content: input.content,
    playerState: input.playerState,
    metadata: {
      deterministic: true,
      ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
      ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId })
    }
  });
  const executionDiagnostics = prefixDiagnostics(execution.diagnostics, ["execution"], "interaction-execution");

  return createTerminalResult(
    input,
    execution.status,
    executionDiagnostics,
    readonlyInput ?? cloneJsonValue(input.input as JsonValue) as RuntimeReadonlyInputRequest,
    cloneJsonValue(request as JsonValue) as RuntimeCommandRequest,
    execution,
    initialPlayerState ?? cloneJsonValue(input.playerState as JsonValue) as RuntimePlayerState,
    finalPlayerState ?? cloneJsonValue(input.playerState as JsonValue) as RuntimePlayerState
  );
}
