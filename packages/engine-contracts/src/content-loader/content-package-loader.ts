import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  type ContentPackage,
  inspectContentPackage
} from "../content/content-package-types.js";
import {
  type ContentLoaderInput,
  type ContentLoaderResult,
  type ContentLoaderSourceMetadata,
  type ValidatedContentGraph
} from "./content-loader-types.js";
import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ValidationDiagnostic,
  type ValidationDiagnosticCategory,
  type ValidationDiagnosticPhase,
  type ValidationDiagnosticSeverity,
  type ValidationDiagnosticSource
} from "../validation-diagnostic/validation-diagnostic.js";

export const CONTENT_PACKAGE_LOADER_VERSION = "content-package-loader@0.1.0" as const;

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function createLoaderSourceMetadata(source: ContentLoaderSourceMetadata | undefined): ValidationDiagnosticSource {
  return {
    kind: `content-loader.${source?.sourceKind ?? "unknown"}`,
    id: source?.sourceId ?? source?.packageId ?? "provided-object"
  };
}

function diagnosticCategoryForCode(code: string): ValidationDiagnosticCategory {
  if (code.includes("SCHEMA_VERSION")) {
    return "schema";
  }
  if (code.includes("REFERENCE")) {
    return "reference";
  }
  if (code.includes("ID_INVALID") || code.includes("DUPLICATE_ID")) {
    return "identity";
  }
  if (code.includes("FORBIDDEN_KEY")) {
    return "security";
  }
  if (code.includes("NON_JSON_VALUE")) {
    return "serialization";
  }
  if (code.includes("ACTION")) {
    return "validation";
  }
  return "shape";
}

function diagnosticPhaseForCode(code: string): ValidationDiagnosticPhase {
  if (code.includes("SCHEMA_VERSION")) {
    return "schema-validation";
  }
  if (code.includes("REFERENCE")) {
    return "reference-validation";
  }
  if (code.includes("FORBIDDEN_KEY") || code.includes("NON_JSON_VALUE")) {
    return "pre-serialization";
  }
  if (code.includes("ID_INVALID") || code.includes("DUPLICATE_ID")) {
    return "identity-validation";
  }
  return "content-package-validation";
}

function diagnosticSeverityForCode(code: string): ValidationDiagnosticSeverity {
  if (code.includes("FORBIDDEN_KEY") || code.includes("NON_JSON_VALUE")) {
    return "fatal";
  }
  return "error";
}

function mapContentPackageDiagnostics(
  value: unknown,
  source: ContentLoaderSourceMetadata | undefined
): readonly ValidationDiagnostic[] {
  const sourceMetadata = createLoaderSourceMetadata(source);
  return sortValidationDiagnostics(
    inspectContentPackage(value).map((diagnostic) =>
      createValidationDiagnostic({
        ownerContract: CONTENT_PACKAGE_LOADER_VERSION,
        code: diagnostic.code,
        severity: diagnosticSeverityForCode(diagnostic.code),
        category: diagnosticCategoryForCode(diagnostic.code),
        phase: diagnosticPhaseForCode(diagnostic.code),
        path: diagnostic.path,
        message: diagnostic.message,
        source: {
          ...sourceMetadata,
          path: diagnostic.path
        },
        ...(diagnostic.details === undefined ? {} : { details: diagnostic.details })
      })
    )
  );
}

function matchesExpectedSchemaVersion(contentPackage: ContentPackage, expectedSchemaVersion: number | string): boolean {
  if (typeof expectedSchemaVersion === "number") {
    return contentPackage.schemaVersion.version === expectedSchemaVersion;
  }

  return String(contentPackage.schemaVersion.version) === expectedSchemaVersion;
}

function summarizeDependencyPackage(value: unknown, index: number): JsonValue {
  const candidatePackageId =
    typeof value === "object" && value !== null && "packageId" in value && typeof (value as { packageId?: unknown }).packageId === "string"
      ? ((value as { packageId: string }).packageId)
      : "unknown";

  return {
    index,
    packageId: candidatePackageId,
    resolution: "deferred"
  };
}

function createDiagnosticsSummary(status: string, diagnostics: readonly ValidationDiagnostic[]): JsonValue {
  return {
    status,
    diagnosticCount: diagnostics.length,
    diagnosticCodes: uniqueSorted(diagnostics.map((diagnostic) => diagnostic.code))
  };
}

export function createValidatedContentGraphFromPackage(
  contentPackage: ContentPackage,
  input: Pick<ContentLoaderInput, "dependencyPackages" | "source"> = {}
): ValidatedContentGraph {
  const packageValue = cloneJsonValue(contentPackage);
  const dependencySummary = (input.dependencyPackages ?? []).map((dependencyPackage, index) =>
    summarizeDependencyPackage(dependencyPackage, index)
  );
  const progressFlags = uniqueSorted(packageValue.initialPlayerState.progressFlags ?? []);
  const actionAffordances = uniqueSorted(packageValue.actionAffordances);

  return {
    packageId: packageValue.packageId,
    manifest: {
      packageId: packageValue.packageId,
      title: packageValue.title,
      theme: packageValue.theme,
      schemaVersion: packageValue.schemaVersion,
      ...(packageValue.description === undefined ? {} : { description: packageValue.description }),
      ...(input.source === undefined ? {} : { source: cloneJsonValue(input.source as JsonValue) })
    },
    sections: {
      locations: packageValue.locations,
      items: packageValue.items ?? [],
      npcs: packageValue.npcs ?? [],
      dialogues: packageValue.dialogues ?? [],
      initialPlayerState: packageValue.initialPlayerState,
      actionAffordances
    },
    referenceIndex: {
      locationIds: uniqueSorted(packageValue.locations.map((location) => location.locationId)),
      itemIds: uniqueSorted((packageValue.items ?? []).map((item) => item.itemId)),
      npcIds: uniqueSorted((packageValue.npcs ?? []).map((npc) => npc.npcId)),
      dialogueIds: uniqueSorted((packageValue.dialogues ?? []).map((dialogue) => dialogue.dialogueId)),
      actionAffordances,
      progressFlags,
      exitTargetLocationIds: uniqueSorted(
        packageValue.locations.flatMap((location) => location.exits.map((exit) => exit.targetLocationId))
      )
    },
    dependencySummary,
    primitiveBindingSummary: [],
    localizationKeyIndex: [],
    assetReferenceIndex: [],
    diagnosticsSummary: createDiagnosticsSummary("valid", [])
  };
}

export function loadContentPackageFromObject(input: ContentLoaderInput): ContentLoaderResult {
  const diagnostics = mapContentPackageDiagnostics(input.rawPackage, input.source);
  if (diagnostics.length > 0) {
    return {
      status: "invalid",
      diagnostics,
      metadata: {
        deterministic: true,
        loaderVersion: CONTENT_PACKAGE_LOADER_VERSION
      }
    };
  }

  const contentPackage = cloneJsonValue(input.rawPackage as ContentPackage);
  if (
    input.expectedSchemaVersion !== undefined &&
    !matchesExpectedSchemaVersion(contentPackage, input.expectedSchemaVersion)
  ) {
    return {
      status: "blocked",
      diagnostics: [
        createValidationDiagnostic({
          ownerContract: CONTENT_PACKAGE_LOADER_VERSION,
          code: "CONTENT_PACKAGE_SCHEMA_MISMATCH",
          severity: "error",
          category: "schema",
          phase: "schema-validation",
          path: ["schemaVersion", "version"],
          message: "content package schema version does not match the expected schema version.",
          source: {
            ...createLoaderSourceMetadata(input.source),
            path: ["schemaVersion", "version"]
          },
          details: {
            expectedSchemaVersion: input.expectedSchemaVersion,
            actualSchemaVersion: contentPackage.schemaVersion.version
          }
        })
      ],
      metadata: {
        deterministic: true,
        loaderVersion: CONTENT_PACKAGE_LOADER_VERSION
      }
    };
  }

  return {
    status: "valid",
    graph: createValidatedContentGraphFromPackage(contentPackage, input),
    diagnostics: [],
    metadata: {
      deterministic: true,
      loaderVersion: CONTENT_PACKAGE_LOADER_VERSION
    }
  };
}
