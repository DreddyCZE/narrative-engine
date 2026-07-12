import {
  canonicalizeJson,
  formatJsonPath,
  inspectJsonSafety,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import {
  isContentActionAffordance,
  type ContentActionAffordance,
  type ContentDialogueDescriptor,
  type ContentExitDescriptor,
  type ContentInitialPlayerState,
  type ContentItemDescriptor,
  type ContentLocationDescriptor,
  type ContentNpcDescriptor
} from "../content/content-package-types.js";
import { type ValidatedContentGraph, type ValidatedContentManifest } from "../content-loader/content-loader-types.js";
import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ValidationDiagnostic
} from "../validation-diagnostic/validation-diagnostic.js";

export type ContentReadModelDiagnostic = ValidationDiagnostic;

export type ContentReadModelInput = {
  readonly graph: ValidatedContentGraph;
};

export type ContentReadModel = {
  readonly getPackageId: () => string;
  readonly getManifest: () => ValidatedContentManifest;
  readonly getInitialPlayerState: () => ContentInitialPlayerState;
  readonly getStartLocation: () => ContentLocationDescriptor;
  readonly getLocation: (locationId: string) => ContentLocationDescriptor | undefined;
  readonly getLocations: () => readonly ContentLocationDescriptor[];
  readonly getExits: (locationId: string) => readonly ContentExitDescriptor[];
  readonly getItem: (itemId: string) => ContentItemDescriptor | undefined;
  readonly getItemsInLocation: (locationId: string) => readonly ContentItemDescriptor[];
  readonly getNpc: (npcId: string) => ContentNpcDescriptor | undefined;
  readonly getNpcsInLocation: (locationId: string) => readonly ContentNpcDescriptor[];
  readonly getDialogue: (dialogueId: string) => ContentDialogueDescriptor | undefined;
  readonly hasActionAffordance: (action: ContentActionAffordance) => boolean;
  readonly getProgressFlags: () => readonly string[];
};

export class ContentReadModelValidationError extends TypeError {
  public readonly diagnostics: readonly ContentReadModelDiagnostic[];

  public constructor(diagnostics: readonly ContentReadModelDiagnostic[]) {
    super(formatContentReadModelValidationMessage(diagnostics));
    this.name = "ContentReadModelValidationError";
    this.diagnostics = diagnostics;
  }
}

const CONTENT_READ_MODEL_CONTRACT = "content-read-model@0.1.0" as const;
const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;
const ENTITY_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function cloneOptional<T extends JsonValue>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : cloneJsonValue(value);
}

function createDiagnostic(
  code: string,
  path: readonly JsonPathSegment[],
  message: string,
  details?: JsonValue
): ContentReadModelDiagnostic {
  return createValidationDiagnostic({
    ownerContract: CONTENT_READ_MODEL_CONTRACT,
    code,
    severity: "error",
    category: code.includes("REFERENCE") ? "reference" : code.includes("ACTION") ? "validation" : "shape",
    phase: code.includes("REFERENCE") ? "reference-validation" : "content-read-model-validation",
    path,
    message,
    source: {
      kind: "content-read-model",
      id: "graph-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function getArraySection(sections: Record<string, unknown>, key: string): readonly unknown[] | undefined {
  const value = sections[key];
  return Array.isArray(value) ? value : undefined;
}

function getObjectSection(sections: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = sections[key];
  return isRecord(value) ? value : undefined;
}

export function inspectContentReadModelInput(value: unknown): readonly ContentReadModelDiagnostic[] {
  const diagnostics: ContentReadModelDiagnostic[] = [];
  if (!isRecord(value)) {
    return [createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", [], "content read model input must be an object.")];
  }

  const inputGraph = value.graph;
  if (!isRecord(inputGraph)) {
    return [createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph"], "graph must be an object.")];
  }

  diagnostics.push(
    ...inspectJsonSafety(inputGraph).map((issue) =>
      createDiagnostic(
        issue.code === "FORBIDDEN_KEY" ? "CONTENT_READ_MODEL_FORBIDDEN_KEY" : "CONTENT_READ_MODEL_NON_JSON_VALUE",
        ["graph", ...issue.path],
        issue.message
      )
    )
  );

  if (typeof inputGraph.packageId !== "string" || !PACKAGE_ID_PATTERN.test(inputGraph.packageId)) {
    diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph", "packageId"], "packageId is invalid."));
  }

  if (!isRecord(inputGraph.manifest)) {
    diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph", "manifest"], "manifest must be an object."));
  }

  if (!isRecord(inputGraph.sections)) {
    diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph", "sections"], "sections must be an object."));
    return sortValidationDiagnostics(diagnostics);
  }

  const sections = inputGraph.sections;
  const locations = getArraySection(sections, "locations");
  if (locations === undefined) {
    diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph", "sections", "locations"], "locations section must be an array."));
  }

  const initialPlayerState = getObjectSection(sections, "initialPlayerState");
  if (initialPlayerState === undefined) {
    diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph", "sections", "initialPlayerState"], "initialPlayerState section must be an object."));
  }

  const actionAffordances = getArraySection(sections, "actionAffordances");
  if (actionAffordances === undefined) {
    diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph", "sections", "actionAffordances"], "actionAffordances section must be an array."));
  } else {
    for (let index = 0; index < actionAffordances.length; index += 1) {
      if (!isContentActionAffordance(actionAffordances[index])) {
        diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_ACTION_INVALID", ["graph", "sections", "actionAffordances", index], "action affordance is invalid."));
      }
    }
  }

  if (!isRecord(inputGraph.referenceIndex)) {
    diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph", "referenceIndex"], "referenceIndex must be an object."));
  }

  if (locations !== undefined) {
    for (let index = 0; index < locations.length; index += 1) {
      const location = locations[index];
      if (!isRecord(location)) {
        diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph", "sections", "locations", index], "location must be an object."));
        continue;
      }
      if (typeof location.locationId !== "string" || !ENTITY_ID_PATTERN.test(location.locationId)) {
        diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph", "sections", "locations", index, "locationId"], "locationId is invalid."));
      }
      if (!Array.isArray(location.exits)) {
        diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_INPUT_INVALID", ["graph", "sections", "locations", index, "exits"], "exits must be an array."));
      }
    }
  }

  if (initialPlayerState !== undefined) {
    if (typeof initialPlayerState.startLocationId !== "string" || !ENTITY_ID_PATTERN.test(initialPlayerState.startLocationId)) {
      diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_REFERENCE_INVALID", ["graph", "sections", "initialPlayerState", "startLocationId"], "startLocationId is invalid."));
    } else if (locations !== undefined && !locations.some((location) => isRecord(location) && location.locationId === initialPlayerState.startLocationId)) {
      diagnostics.push(createDiagnostic("CONTENT_READ_MODEL_REFERENCE_INVALID", ["graph", "sections", "initialPlayerState", "startLocationId"], "start location does not exist in locations."));
    }
  }

  return sortValidationDiagnostics(diagnostics);
}

export function formatContentReadModelValidationMessage(diagnostics: readonly ContentReadModelDiagnostic[]): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Content read model input is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertContentReadModelInput(value: unknown): asserts value is ContentReadModelInput {
  const diagnostics = inspectContentReadModelInput(value);
  if (diagnostics.length > 0) {
    throw new ContentReadModelValidationError(diagnostics);
  }
}

export function createContentReadModel(input: ContentReadModelInput): ContentReadModel {
  assertContentReadModelInput(input);

  const graph = cloneJsonValue(input.graph as JsonValue) as ValidatedContentGraph;
  const sections = graph.sections as Record<string, unknown>;
  const manifest = cloneJsonValue(graph.manifest);
  const locations = cloneJsonValue((getArraySection(sections, "locations") ?? []) as JsonValue) as readonly ContentLocationDescriptor[];
  const items = cloneJsonValue((getArraySection(sections, "items") ?? []) as JsonValue) as readonly ContentItemDescriptor[];
  const npcs = cloneJsonValue((getArraySection(sections, "npcs") ?? []) as JsonValue) as readonly ContentNpcDescriptor[];
  const dialogues = cloneJsonValue((getArraySection(sections, "dialogues") ?? []) as JsonValue) as readonly ContentDialogueDescriptor[];
  const initialPlayerState = cloneJsonValue((getObjectSection(sections, "initialPlayerState") ?? {}) as JsonValue) as ContentInitialPlayerState;
  const actionAffordances = cloneJsonValue((getArraySection(sections, "actionAffordances") ?? []) as JsonValue) as readonly ContentActionAffordance[];

  const locationsById = new Map(locations.map((location) => [location.locationId, location] as const));
  const itemsById = new Map(items.map((item) => [item.itemId, item] as const));
  const npcsById = new Map(npcs.map((npc) => [npc.npcId, npc] as const));
  const dialoguesById = new Map(dialogues.map((dialogue) => [dialogue.dialogueId, dialogue] as const));
  const itemsByLocation = new Map<string, readonly ContentItemDescriptor[]>();
  const npcsByLocation = new Map<string, readonly ContentNpcDescriptor[]>();

  for (const location of locations) {
    itemsByLocation.set(location.locationId, items.filter((item) => item.locationId === location.locationId));
    npcsByLocation.set(location.locationId, npcs.filter((npc) => npc.locationId === location.locationId));
  }

  const startLocation = locationsById.get(initialPlayerState.startLocationId);
  if (startLocation === undefined) {
    throw new ContentReadModelValidationError([
      createDiagnostic("CONTENT_READ_MODEL_REFERENCE_INVALID", ["graph", "sections", "initialPlayerState", "startLocationId"], "start location does not exist in locations.")
    ]);
  }

  return {
    getPackageId: () => graph.packageId,
    getManifest: () => cloneJsonValue(manifest),
    getInitialPlayerState: () => cloneJsonValue(initialPlayerState as JsonValue) as ContentInitialPlayerState,
    getStartLocation: () => cloneJsonValue(startLocation as JsonValue) as ContentLocationDescriptor,
    getLocation: (locationId) => cloneOptional(locationsById.get(locationId) as JsonValue | undefined) as ContentLocationDescriptor | undefined,
    getLocations: () => cloneJsonValue(locations as JsonValue) as readonly ContentLocationDescriptor[],
    getExits: (locationId) => cloneJsonValue((locationsById.get(locationId)?.exits ?? []) as JsonValue) as readonly ContentExitDescriptor[],
    getItem: (itemId) => cloneOptional(itemsById.get(itemId) as JsonValue | undefined) as ContentItemDescriptor | undefined,
    getItemsInLocation: (locationId) => cloneJsonValue((itemsByLocation.get(locationId) ?? []) as JsonValue) as readonly ContentItemDescriptor[],
    getNpc: (npcId) => cloneOptional(npcsById.get(npcId) as JsonValue | undefined) as ContentNpcDescriptor | undefined,
    getNpcsInLocation: (locationId) => cloneJsonValue((npcsByLocation.get(locationId) ?? []) as JsonValue) as readonly ContentNpcDescriptor[],
    getDialogue: (dialogueId) => cloneOptional(dialoguesById.get(dialogueId) as JsonValue | undefined) as ContentDialogueDescriptor | undefined,
    hasActionAffordance: (action) => actionAffordances.includes(action),
    getProgressFlags: () => cloneJsonValue((initialPlayerState.progressFlags ?? []) as JsonValue) as readonly string[]
  };
}
