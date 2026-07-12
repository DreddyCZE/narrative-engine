import {
  canonicalizeJson,
  formatJsonPath,
  inspectJsonSafety,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import { type ContentReadModel, createContentReadModel, type ContentReadModelInput } from "./content-read-model.js";
import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ValidationDiagnostic
} from "../validation-diagnostic/validation-diagnostic.js";

export const RUNTIME_PLAYER_STATE_SCHEMA_ID = "runtime-player-state" as const;
export const RUNTIME_PLAYER_STATE_SCHEMA_VERSION = 1 as const;

const RUNTIME_PLAYER_STATE_CONTRACT_VERSION = "runtime-player-state@0.1.0" as const;
const ENTITY_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;
const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;
const FLAG_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const TOP_LEVEL_KEYS = new Set([
  "stateId",
  "revision",
  "currentLocationId",
  "inventoryItemIds",
  "progressFlags",
  "metadata"
]);
const METADATA_KEYS = new Set(["contentPackageId", "createdAtRevision", "updatedAtRevision"]);

export type RuntimePlayerStateDiagnostic = ValidationDiagnostic;

export type RuntimePlayerInventoryState = {
  readonly inventoryItemIds: readonly string[];
};

export type RuntimePlayerProgressState = {
  readonly progressFlags: readonly string[];
};

export type RuntimePlayerStateMetadata = {
  readonly contentPackageId: string;
  readonly createdAtRevision?: number;
  readonly updatedAtRevision?: number;
};

export type RuntimePlayerState = RuntimePlayerInventoryState &
  RuntimePlayerProgressState & {
    readonly stateId: string;
    readonly revision: number;
    readonly currentLocationId: string;
    readonly metadata: RuntimePlayerStateMetadata;
  };

export type CreateInitialRuntimePlayerStateFromContentInput = {
  readonly content: ContentReadModel | ContentReadModelInput;
  readonly stateId?: string;
  readonly revision?: number;
  readonly metadata?: Omit<RuntimePlayerStateMetadata, "contentPackageId">;
};

export class RuntimePlayerStateValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimePlayerStateDiagnostic[];

  public constructor(diagnostics: readonly RuntimePlayerStateDiagnostic[]) {
    super(formatRuntimePlayerStateValidationMessage(diagnostics));
    this.name = "RuntimePlayerStateValidationError";
    this.diagnostics = diagnostics;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function createDiagnostic(
  code: string,
  path: readonly JsonPathSegment[],
  message: string,
  category: ValidationDiagnostic["category"],
  phase: string,
  details?: JsonValue
): RuntimePlayerStateDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_PLAYER_STATE_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-player-state",
      id: "state-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function pushJsonSafetyDiagnostics(
  diagnostics: RuntimePlayerStateDiagnostic[],
  value: unknown
): void {
  for (const issue of inspectJsonSafety(value)) {
    diagnostics.push(
      createDiagnostic(
        issue.code === "FORBIDDEN_KEY" ? "RUNTIME_PLAYER_STATE_FORBIDDEN_KEY" : "RUNTIME_PLAYER_STATE_NON_JSON_VALUE",
        issue.path,
        issue.message,
        issue.code === "FORBIDDEN_KEY" ? "security" : "serialization",
        "pre-serialization"
      )
    );
  }
}

function pushUnknownFieldDiagnostics(
  diagnostics: RuntimePlayerStateDiagnostic[],
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  pathPrefix: readonly JsonPathSegment[],
  code: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      diagnostics.push(
        createDiagnostic(
          code,
          [...pathPrefix, key],
          `unknown field "${key}" is not allowed.`,
          "shape",
          "shape-validation"
        )
      );
    }
  }
}

function pushDuplicateDiagnostics(
  diagnostics: RuntimePlayerStateDiagnostic[],
  values: readonly string[],
  path: "inventoryItemIds" | "progressFlags",
  code: string
): void {
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === undefined) {
      continue;
    }
    if (seen.has(value)) {
      diagnostics.push(
        createDiagnostic(
          code,
          [path, index],
          `${path} must not contain duplicates.`,
          "state",
          "state-validation",
          { duplicateValue: value }
        )
      );
      continue;
    }
    seen.add(value);
  }
}

function isContentReadModel(value: ContentReadModel | ContentReadModelInput): value is ContentReadModel {
  return typeof (value as ContentReadModel).getPackageId === "function";
}

export function inspectRuntimePlayerState(value: unknown): readonly RuntimePlayerStateDiagnostic[] {
  const diagnostics: RuntimePlayerStateDiagnostic[] = [];

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_PLAYER_STATE_INVALID",
        [],
        "runtime player state must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  pushJsonSafetyDiagnostics(diagnostics, value);
  pushUnknownFieldDiagnostics(
    diagnostics,
    value,
    TOP_LEVEL_KEYS,
    [],
    "RUNTIME_PLAYER_STATE_UNKNOWN_FIELD"
  );

  if (typeof value.stateId !== "string" || !ENTITY_ID_PATTERN.test(value.stateId)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_PLAYER_STATE_ID_INVALID",
        ["stateId"],
        "stateId is invalid.",
        "identity",
        "identity-validation"
      )
    );
  }

  if (!isNonNegativeInteger(value.revision)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_PLAYER_STATE_REVISION_INVALID",
        ["revision"],
        "revision must be a non-negative integer.",
        "state",
        "state-validation"
      )
    );
  }

  if (typeof value.currentLocationId !== "string" || !ENTITY_ID_PATTERN.test(value.currentLocationId)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_PLAYER_STATE_LOCATION_INVALID",
        ["currentLocationId"],
        "currentLocationId is invalid.",
        "reference",
        "reference-validation"
      )
    );
  }

  if (!Array.isArray(value.inventoryItemIds)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_PLAYER_STATE_INVENTORY_INVALID",
        ["inventoryItemIds"],
        "inventoryItemIds must be an array.",
        "shape",
        "shape-validation"
      )
    );
  } else {
    const inventoryItemIds = value.inventoryItemIds as readonly unknown[];
    for (let index = 0; index < inventoryItemIds.length; index += 1) {
      const inventoryItemId = inventoryItemIds[index];
      if (typeof inventoryItemId !== "string" || !ENTITY_ID_PATTERN.test(inventoryItemId)) {
        diagnostics.push(
          createDiagnostic(
            "RUNTIME_PLAYER_STATE_INVENTORY_ITEM_INVALID",
            ["inventoryItemIds", index],
            "inventory item id is invalid.",
            "reference",
            "reference-validation"
          )
        );
      }
    }
    pushDuplicateDiagnostics(diagnostics, inventoryItemIds as readonly string[], "inventoryItemIds", "RUNTIME_PLAYER_STATE_INVENTORY_DUPLICATE");
  }

  if (!Array.isArray(value.progressFlags)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_PLAYER_STATE_PROGRESS_INVALID",
        ["progressFlags"],
        "progressFlags must be an array.",
        "shape",
        "shape-validation"
      )
    );
  } else {
    const progressFlags = value.progressFlags as readonly unknown[];
    for (let index = 0; index < progressFlags.length; index += 1) {
      const progressFlag = progressFlags[index];
      if (typeof progressFlag !== "string" || !FLAG_ID_PATTERN.test(progressFlag)) {
        diagnostics.push(
          createDiagnostic(
            "RUNTIME_PLAYER_STATE_PROGRESS_FLAG_INVALID",
            ["progressFlags", index],
            "progress flag is invalid.",
            "state",
            "state-validation"
          )
        );
      }
    }
    pushDuplicateDiagnostics(diagnostics, progressFlags as readonly string[], "progressFlags", "RUNTIME_PLAYER_STATE_PROGRESS_DUPLICATE");
  }

  if (!isRecord(value.metadata)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_PLAYER_STATE_METADATA_INVALID",
        ["metadata"],
        "metadata must be an object.",
        "shape",
        "shape-validation"
      )
    );
  } else {
    pushUnknownFieldDiagnostics(
      diagnostics,
      value.metadata,
      METADATA_KEYS,
      ["metadata"],
      "RUNTIME_PLAYER_STATE_METADATA_UNKNOWN_FIELD"
    );

    if (typeof value.metadata.contentPackageId !== "string" || !PACKAGE_ID_PATTERN.test(value.metadata.contentPackageId)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_PLAYER_STATE_PACKAGE_ID_INVALID",
          ["metadata", "contentPackageId"],
          "metadata.contentPackageId is invalid.",
          "reference",
          "reference-validation"
        )
      );
    }

    if (
      value.metadata.createdAtRevision !== undefined &&
      !isNonNegativeInteger(value.metadata.createdAtRevision)
    ) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_PLAYER_STATE_METADATA_REVISION_INVALID",
          ["metadata", "createdAtRevision"],
          "createdAtRevision must be a non-negative integer when present.",
          "state",
          "state-validation"
        )
      );
    }

    if (
      value.metadata.updatedAtRevision !== undefined &&
      !isNonNegativeInteger(value.metadata.updatedAtRevision)
    ) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_PLAYER_STATE_METADATA_REVISION_INVALID",
          ["metadata", "updatedAtRevision"],
          "updatedAtRevision must be a non-negative integer when present.",
          "state",
          "state-validation"
        )
      );
    }
  }

  return sortValidationDiagnostics(diagnostics);
}

export function formatRuntimePlayerStateValidationMessage(
  diagnostics: readonly RuntimePlayerStateDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime player state is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimePlayerState(value: unknown): asserts value is RuntimePlayerState {
  const diagnostics = inspectRuntimePlayerState(value);
  if (diagnostics.length > 0) {
    throw new RuntimePlayerStateValidationError(diagnostics);
  }
}

export function createInitialRuntimePlayerStateFromContent(
  input: CreateInitialRuntimePlayerStateFromContentInput
): RuntimePlayerState {
  const readModel = isContentReadModel(input.content) ? input.content : createContentReadModel(input.content);
  const initialPlayerState = readModel.getInitialPlayerState();
  const packageId = readModel.getPackageId();
  const revision = input.revision ?? 0;

  const candidate = {
    stateId: input.stateId ?? `state.player.${packageId}`,
    revision,
    currentLocationId: initialPlayerState.startLocationId,
    inventoryItemIds: [...(initialPlayerState.inventoryItemIds ?? [])],
    progressFlags: [...(initialPlayerState.progressFlags ?? [])],
    metadata: {
      contentPackageId: packageId,
      ...(input.metadata?.createdAtRevision === undefined
        ? {}
        : { createdAtRevision: input.metadata.createdAtRevision }),
      ...(input.metadata?.updatedAtRevision === undefined
        ? {}
        : { updatedAtRevision: input.metadata.updatedAtRevision })
    }
  } satisfies RuntimePlayerState;

  assertRuntimePlayerState(candidate);
  return cloneJsonValue(candidate as JsonValue) as RuntimePlayerState;
}
