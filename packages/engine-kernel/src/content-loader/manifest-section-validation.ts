import { canonicalizeJson, inspectJsonSafety, type JsonValue } from "@narrative-engine/core";

import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ContentLoaderInput,
  type ContentLoaderResult,
  type ContentLoaderResultMetadata,
  type ValidatedContentGraph,
  type ValidationDiagnostic
} from "@narrative-engine/engine-contracts";

export type ContentManifestSectionValidationOptions = {
  readonly expectedSchemaVersion?: string | number;
  readonly expectedContractVersion?: string;
  readonly allowUndeclaredSections?: boolean;
};

const CONTENT_LOADER_BOUNDARY_VERSION = "content-loader-boundary@0.1.0" as const;
const VALIDATION_SOURCE = {
  kind: "content-loader",
  id: "manifest-section-validator"
} as const;

type ContentPackageShape = {
  readonly manifest?: Record<string, unknown>;
  readonly sections?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidContentId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(value);
}

function isValidVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value);
}

function isValidSchemaVersion(value: unknown): value is string | number {
  return (
    (typeof value === "number" && Number.isInteger(value) && value >= 0) ||
    isNonEmptyString(value)
  );
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function createContentDiagnostic(
  code: string,
  path: readonly (string | number)[],
  message: string,
  phase: "shape-validation" | "schema-validation" = "shape-validation",
  details?: JsonValue
): ValidationDiagnostic {
  return createValidationDiagnostic({
    ownerContract: CONTENT_LOADER_BOUNDARY_VERSION,
    code,
    severity: "error",
    category: phase === "schema-validation" ? "schema" : "shape",
    phase,
    path,
    message,
    source: VALIDATION_SOURCE,
    ...(details === undefined ? {} : { details })
  });
}

function buildMetadata(): ContentLoaderResultMetadata {
  return {
    deterministic: true,
    loaderVersion: CONTENT_LOADER_BOUNDARY_VERSION
  };
}

function buildGraph(
  manifest: Record<string, unknown>,
  sections: Record<string, unknown>
): ValidatedContentGraph {
  return {
    packageId: String(manifest.id),
    manifest: cloneJson(manifest as unknown as JsonValue) as Readonly<Record<string, JsonValue>>,
    sections: cloneJson(sections as unknown as JsonValue) as Readonly<Record<string, JsonValue>>,
    referenceIndex: {},
    dependencySummary: [],
    primitiveBindingSummary: [],
    localizationKeyIndex: [],
    assetReferenceIndex: [],
    diagnosticsSummary: {
      total: 0,
      blocking: 0,
      status: "valid"
    }
  };
}

function buildResult(
  status: ContentLoaderResult["status"],
  diagnostics: readonly ValidationDiagnostic[],
  graph?: ValidatedContentGraph
): ContentLoaderResult {
  return {
    status,
    diagnostics: sortValidationDiagnostics(diagnostics),
    metadata: buildMetadata(),
    ...(graph === undefined ? {} : { graph })
  };
}

function validateManifestShape(
  manifest: Record<string, unknown>,
  expectedSchemaVersion: string | number | undefined,
  expectedContractVersion: string | undefined
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  if (!isValidContentId(manifest.id)) {
    diagnostics.push(
      createContentDiagnostic(
        "CONTENT_MANIFEST_INVALID_ID",
        ["manifest", "id"],
        "Content manifest id must be a non-empty stable identifier."
      )
    );
  }

  if (!isNonEmptyString(manifest.name)) {
    diagnostics.push(
      createContentDiagnostic(
        "CONTENT_MANIFEST_INVALID_SHAPE",
        ["manifest", "name"],
        "Content manifest name is required."
      )
    );
  }

  if (!isValidVersion(manifest.version)) {
    diagnostics.push(
      createContentDiagnostic(
        "CONTENT_MANIFEST_INVALID_VERSION",
        ["manifest", "version"],
        "Content manifest version must be a semver string."
      )
    );
  }

  if (manifest.schemaVersion === undefined) {
    diagnostics.push(
      createContentDiagnostic(
        "CONTENT_SCHEMA_VERSION_MISSING",
        ["manifest", "schemaVersion"],
        "Content manifest schemaVersion is required.",
        "schema-validation"
      )
    );
  } else if (!isValidSchemaVersion(manifest.schemaVersion)) {
    diagnostics.push(
      createContentDiagnostic(
        "CONTENT_MANIFEST_INVALID_SHAPE",
        ["manifest", "schemaVersion"],
        "Content manifest schemaVersion must be a non-negative integer or non-empty string.",
        "schema-validation"
      )
    );
  } else if (
    expectedSchemaVersion !== undefined &&
    String(manifest.schemaVersion) !== String(expectedSchemaVersion)
  ) {
    diagnostics.push(
      createContentDiagnostic(
        "CONTENT_SCHEMA_VERSION_MISMATCH",
        ["manifest", "schemaVersion"],
        "Content manifest schemaVersion does not match the expected schema version.",
        "schema-validation",
        {
          expectedSchemaVersion: String(expectedSchemaVersion),
          actualSchemaVersion: String(manifest.schemaVersion)
        }
      )
    );
  }

  if (!Array.isArray(manifest.declaredSections) || !manifest.declaredSections.every(isNonEmptyString)) {
    diagnostics.push(
      createContentDiagnostic(
        "CONTENT_SECTION_DECLARATION_INVALID",
        ["manifest", "declaredSections"],
        "Content manifest declaredSections must be an array of non-empty strings."
      )
    );
  }

  if (
    expectedContractVersion !== undefined &&
    (!isNonEmptyString(manifest.contractVersion) ||
      manifest.contractVersion !== expectedContractVersion)
  ) {
    diagnostics.push(
      createContentDiagnostic(
        "CONTENT_MANIFEST_INVALID_SHAPE",
        ["manifest", "contractVersion"],
        "Content manifest contractVersion does not match the expected contract version.",
        "schema-validation",
        {
          expectedContractVersion
        }
      )
    );
  }

  return diagnostics;
}

function validateSections(
  manifest: Record<string, unknown>,
  sections: Record<string, unknown>,
  options: ContentManifestSectionValidationOptions
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];

  const declaredSections = Array.isArray(manifest.declaredSections)
    ? manifest.declaredSections.filter(isNonEmptyString)
    : [];

  for (const sectionName of declaredSections) {
    if (!(sectionName in sections)) {
      diagnostics.push(
        createContentDiagnostic(
          "CONTENT_SECTION_MISSING_DECLARED_SECTION",
          ["sections", sectionName],
          `Declared section "${sectionName}" is missing from the content package.`
        )
      );
    }
  }

  if (options.allowUndeclaredSections !== true) {
    for (const sectionName of Object.keys(sections).sort()) {
      if (!declaredSections.includes(sectionName)) {
        diagnostics.push(
          createContentDiagnostic(
            "CONTENT_SECTION_UNDECLARED_SECTION",
            ["sections", sectionName],
            `Section "${sectionName}" is present but not declared in manifest.declaredSections.`
          )
        );
      }
    }
  }

  return diagnostics;
}

export function validateContentManifestAndSections(
  input: ContentLoaderInput,
  options: ContentManifestSectionValidationOptions = {}
): ContentLoaderResult {
  if (!isRecord(input.rawPackage)) {
    return buildResult("blocked", [
      createContentDiagnostic(
        "CONTENT_MANIFEST_INVALID_SHAPE",
        ["rawPackage"],
        "Content loader rawPackage must be a JSON object."
      )
    ]);
  }

  const packageShape = input.rawPackage as ContentPackageShape;

  if (packageShape.manifest === undefined) {
    return buildResult("invalid", [
      createContentDiagnostic(
        "CONTENT_MANIFEST_MISSING",
        ["manifest"],
        "Content package is missing the required manifest."
      )
    ]);
  }

  if (!isRecord(packageShape.manifest)) {
    return buildResult("invalid", [
      createContentDiagnostic(
        "CONTENT_MANIFEST_INVALID_SHAPE",
        ["manifest"],
        "Content package manifest must be a JSON object."
      )
    ]);
  }

  if (packageShape.sections === undefined) {
    return buildResult("invalid", [
      createContentDiagnostic(
        "CONTENT_SECTION_DECLARATION_INVALID",
        ["sections"],
        "Content package sections container is required."
      )
    ]);
  }

  if (!isRecord(packageShape.sections)) {
    return buildResult("invalid", [
      createContentDiagnostic(
        "CONTENT_SECTION_DECLARATION_INVALID",
        ["sections"],
        "Content package sections container must be a JSON object."
      )
    ]);
  }

  const safetyIssues = inspectJsonSafety(input.rawPackage);
  if (safetyIssues.length > 0) {
    return buildResult(
      "blocked",
      safetyIssues.map((issue) =>
        createContentDiagnostic(
          "CONTENT_MANIFEST_INVALID_SHAPE",
          ["rawPackage", ...issue.path],
          issue.message
        )
      )
    );
  }

  const expectedSchemaVersion = options.expectedSchemaVersion ?? input.expectedSchemaVersion;
  const expectedContractVersion = options.expectedContractVersion ?? input.expectedContractVersion;

  const diagnostics = [
    ...validateManifestShape(
      packageShape.manifest,
      expectedSchemaVersion,
      expectedContractVersion
    ),
    ...validateSections(packageShape.manifest, packageShape.sections, options)
  ];

  if (diagnostics.length > 0) {
    return buildResult("invalid", diagnostics);
  }

  return buildResult("valid", [], buildGraph(packageShape.manifest, packageShape.sections));
}
