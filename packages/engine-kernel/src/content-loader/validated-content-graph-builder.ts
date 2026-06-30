import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  type ContentLoaderInput,
  type ContentLoaderResult,
  type ContentLoaderResultMetadata,
  type ValidatedContentGraph,
  type ValidationDiagnostic,
  sortValidationDiagnostics
} from "@narrative-engine/engine-contracts";

import { type ContentIdIndexingResult } from "./content-id-indexing.js";
import { type ContentM2PrimitiveBindingValidationResult } from "./m2-primitive-binding-validation.js";
import { type ContentReferenceValidationResult } from "./reference-validation.js";

export type BuildValidatedContentGraphInput = {
  readonly loaderInput: ContentLoaderInput;
  readonly manifestSectionResult: ContentLoaderResult;
  readonly idIndexResult: ContentIdIndexingResult;
  readonly referenceValidationResult: ContentReferenceValidationResult;
  readonly m2BindingValidationResult: ContentM2PrimitiveBindingValidationResult;
};

type ContentPackageShape = {
  readonly manifest?: Record<string, unknown>;
  readonly sections?: Record<string, unknown>;
};

type ReferenceFieldRule = {
  readonly field: string;
  readonly multiple?: boolean;
};

const CONTENT_LOADER_BOUNDARY_VERSION = "content-loader-boundary@0.1.0" as const;

const SECTION_ID_FIELDS: Readonly<Record<string, string>> = {
  actors: "id",
  assetReferences: "id",
  commands: "id",
  conditions: "conditionId",
  dialogues: "id",
  documents: "id",
  effects: "effectId",
  entities: "id",
  eventMappings: "id",
  items: "id",
  localization: "key",
  locations: "id",
  quests: "id",
  systems: "id"
};

const SECTION_REFERENCE_RULES = {
  actors: [{ field: "entityId" }, { field: "locationId" }, { field: "displayNameKey" }],
  assetReferences: [{ field: "ownerId" }, { field: "assetKey" }],
  commands: [
    { field: "conditionRefs", multiple: true },
    { field: "effectRefs", multiple: true },
    { field: "targetLocationId" },
    { field: "labelKey" }
  ],
  dialogues: [{ field: "locationId" }, { field: "speakerActorId" }, { field: "lineKey" }],
  documents: [
    { field: "entityId" },
    { field: "locationId" },
    { field: "titleKey" },
    { field: "bodyKey" }
  ],
  eventMappings: [{ field: "commandId" }, { field: "transactionId" }, { field: "titleKey" }],
  items: [{ field: "entityId" }, { field: "locationId" }, { field: "displayNameKey" }],
  locations: [{ field: "entityId" }, { field: "titleKey" }],
  quests: [
    { field: "locationId" },
    { field: "requiredItemIds", multiple: true },
    { field: "availableCommandIds", multiple: true },
    { field: "titleKey" }
  ],
  systems: [{ field: "descriptionKey" }]
} satisfies Readonly<Record<string, readonly ReferenceFieldRule[]>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function buildMetadata(): ContentLoaderResultMetadata {
  return {
    deterministic: true,
    loaderVersion: CONTENT_LOADER_BOUNDARY_VERSION
  };
}

function getSectionOrder(packageShape: ContentPackageShape): readonly string[] {
  const sections = isRecord(packageShape.sections) ? packageShape.sections : {};
  const declared = Array.isArray(packageShape.manifest?.declaredSections)
    ? packageShape.manifest.declaredSections.filter(isNonEmptyString)
    : [];
  const extras = Object.keys(sections)
    .filter((section) => !declared.includes(section))
    .sort();
  return [...declared, ...extras];
}

function getReferenceRules(sectionName: string): readonly ReferenceFieldRule[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(SECTION_REFERENCE_RULES, sectionName)) {
    return undefined;
  }

  return SECTION_REFERENCE_RULES[sectionName as keyof typeof SECTION_REFERENCE_RULES];
}

function getItemStableId(sectionName: string, item: Record<string, unknown>): string | undefined {
  const idField = SECTION_ID_FIELDS[sectionName];
  if (idField === undefined) {
    return undefined;
  }

  const idValue = item[idField];
  return isNonEmptyString(idValue) ? idValue : undefined;
}

function collectReferences(sectionName: string, item: Record<string, unknown>): readonly string[] {
  const rules = getReferenceRules(sectionName);
  if (rules === undefined) {
    return [];
  }

  const references: string[] = [];
  for (const rule of rules) {
    const value = item[rule.field];
    if (rule.multiple === true) {
      if (!Array.isArray(value)) {
        continue;
      }
      for (const entry of value) {
        if (isNonEmptyString(entry)) {
          references.push(entry);
        }
      }
      continue;
    }

    if (isNonEmptyString(value)) {
      references.push(value);
    }
  }

  return Object.freeze(references.slice());
}

function buildReferenceIndex(
  packageShape: ContentPackageShape
): Readonly<Record<string, readonly string[]>> {
  const sections = isRecord(packageShape.sections) ? packageShape.sections : {};
  const entries = new Map<string, readonly string[]>();

  for (const sectionName of getSectionOrder(packageShape)) {
    const sectionValue = sections[sectionName];
    if (!Array.isArray(sectionValue)) {
      continue;
    }

    for (const item of sectionValue) {
      if (!isRecord(item)) {
        continue;
      }

      const itemId = getItemStableId(sectionName, item);
      if (itemId === undefined) {
        continue;
      }

      entries.set(itemId, collectReferences(sectionName, item));
    }
  }

  return Object.freeze(
    Object.fromEntries([...entries.entries()].sort(([left], [right]) => left.localeCompare(right)))
  );
}
function buildPrimitiveBindingSummary(packageShape: ContentPackageShape): readonly JsonValue[] {
  const sections = isRecord(packageShape.sections) ? packageShape.sections : {};
  const summary: JsonValue[] = [];

  const pushSectionSummary = (sectionName: string, idField: string, typeField: string): void => {
    const sectionValue = sections[sectionName];
    if (!Array.isArray(sectionValue)) {
      return;
    }

    for (const item of sectionValue) {
      if (!isRecord(item) || !isNonEmptyString(item[idField])) {
        continue;
      }

      summary.push(
        cloneJson({
          section: sectionName,
          id: item[idField],
          type: isNonEmptyString(item[typeField]) ? item[typeField] : "unknown"
        })
      );
    }
  };

  pushSectionSummary("conditions", "conditionId", "type");
  pushSectionSummary("effects", "effectId", "type");
  pushSectionSummary("commands", "id", "commandType");
  pushSectionSummary("eventMappings", "id", "eventType");

  return Object.freeze(summary);
}

function buildLocalizationKeyIndex(packageShape: ContentPackageShape): readonly string[] {
  const localization = isRecord(packageShape.sections) ? packageShape.sections.localization : undefined;
  if (!Array.isArray(localization)) {
    return Object.freeze([]);
  }

  return Object.freeze(
    localization
      .filter(isRecord)
      .map((entry) => entry.key)
      .filter(isNonEmptyString)
  );
}

function buildAssetReferenceIndex(packageShape: ContentPackageShape): readonly string[] {
  const assets = isRecord(packageShape.sections) ? packageShape.sections.assetReferences : undefined;
  if (!Array.isArray(assets)) {
    return Object.freeze([]);
  }

  return Object.freeze(
    assets
      .filter(isRecord)
      .map((entry) =>
        isNonEmptyString(entry.id)
          ? entry.id
          : isNonEmptyString(entry.assetKey)
            ? entry.assetKey
            : undefined
      )
      .filter(isNonEmptyString)
  );
}

function buildDependencySummary(manifest: Record<string, unknown>): readonly JsonValue[] {
  return Array.isArray(manifest.dependencies)
    ? cloneJson(manifest.dependencies)
    : Object.freeze([] as const);
}
function buildDiagnosticsSummary(
  diagnostics: readonly ValidationDiagnostic[],
  idIndexResult: ContentIdIndexingResult,
  referenceIndex: Readonly<Record<string, readonly string[]>>,
  status: ContentLoaderResult["status"]
): JsonValue {
  return cloneJson({
    total: diagnostics.length,
    blocking: status === "blocked" ? diagnostics.length : 0,
    status,
    indexSummary: {
      idEntryCount: idIndexResult.entries.length,
      uniqueIdCount: Object.keys(idIndexResult.byId).length,
      sectionCount: Object.keys(idIndexResult.bySection).length,
      referenceOwnerCount: Object.keys(referenceIndex).length
    }
  });
}

export function buildValidatedContentGraphValue(
  input: BuildValidatedContentGraphInput
): ContentLoaderResult {
  const diagnostics = sortValidationDiagnostics([
    ...input.manifestSectionResult.diagnostics,
    ...input.idIndexResult.diagnostics,
    ...input.referenceValidationResult.diagnostics,
    ...input.m2BindingValidationResult.diagnostics
  ]);

  const blocked = input.manifestSectionResult.status === "blocked";
  const status: ContentLoaderResult["status"] = blocked
    ? "blocked"
    : diagnostics.length > 0 || input.manifestSectionResult.status !== "valid"
      ? "invalid"
      : "valid";

  if (!isRecord(input.loaderInput.rawPackage)) {
    return {
      status,
      diagnostics,
      metadata: buildMetadata()
    };
  }

  if (status !== "valid") {
    return {
      status,
      diagnostics,
      metadata: buildMetadata()
    };
  }

  const packageShape = input.loaderInput.rawPackage as ContentPackageShape;
  const manifest = isRecord(packageShape.manifest) ? packageShape.manifest : {};
  const sections = isRecord(packageShape.sections) ? packageShape.sections : {};
  const referenceIndex = buildReferenceIndex(packageShape);

  const graph: ValidatedContentGraph = {
    packageId:
      (isNonEmptyString(manifest.id) ? manifest.id : input.loaderInput.source?.packageId) ??
      "unknown-package",
    manifest: cloneJson(manifest as JsonValue) as Readonly<Record<string, JsonValue>>,
    sections: cloneJson(sections as JsonValue) as Readonly<Record<string, JsonValue>>,
    referenceIndex,
    dependencySummary: buildDependencySummary(manifest),
    primitiveBindingSummary: buildPrimitiveBindingSummary(packageShape),
    localizationKeyIndex: buildLocalizationKeyIndex(packageShape),
    assetReferenceIndex: buildAssetReferenceIndex(packageShape),
    diagnosticsSummary: buildDiagnosticsSummary(diagnostics, input.idIndexResult, referenceIndex, status)
  };

  return {
    status,
    diagnostics,
    graph,
    metadata: buildMetadata()
  };
}



