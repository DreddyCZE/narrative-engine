import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ContentLoaderInput,
  type ValidationDiagnostic
} from "@narrative-engine/engine-contracts";

import { type ContentIdIndexingResult } from "./content-id-indexing.js";

export type ContentReferenceValidationOptions = {
  readonly allowUnsupportedReferenceKinds?: boolean;
};

export type ContentReferenceValidationResult = {
  readonly diagnostics: readonly ValidationDiagnostic[];
};

type ContentPackageShape = {
  readonly manifest?: {
    readonly declaredSections?: readonly string[];
  };
  readonly sections?: Record<string, unknown>;
};

type ReferenceFieldRule = {
  readonly field: string;
  readonly targetSection?: string;
  readonly multiple?: boolean;
};

const CONTENT_LOADER_BOUNDARY_VERSION = "content-loader-boundary@0.1.0" as const;
const VALIDATION_SOURCE = {
  kind: "content-loader",
  id: "reference-validator"
} as const;

const SECTION_REFERENCE_RULES = {
  actors: [
    { field: "entityId", targetSection: "entities" },
    { field: "locationId", targetSection: "locations" },
    { field: "displayNameKey", targetSection: "localization" }
  ],
  assetReferences: [{ field: "ownerId" }],
  commands: [
    { field: "conditionRefs", targetSection: "conditions", multiple: true },
    { field: "effectRefs", targetSection: "effects", multiple: true },
    { field: "targetLocationId", targetSection: "locations" },
    { field: "labelKey", targetSection: "localization" }
  ],
  dialogues: [
    { field: "locationId", targetSection: "locations" },
    { field: "speakerActorId", targetSection: "actors" },
    { field: "lineKey", targetSection: "localization" }
  ],
  documents: [
    { field: "entityId", targetSection: "entities" },
    { field: "locationId", targetSection: "locations" },
    { field: "titleKey", targetSection: "localization" },
    { field: "bodyKey", targetSection: "localization" }
  ],
  eventMappings: [
    { field: "commandId", targetSection: "commands" },
    { field: "titleKey", targetSection: "localization" }
  ],
  items: [
    { field: "entityId", targetSection: "entities" },
    { field: "locationId", targetSection: "locations" },
    { field: "displayNameKey", targetSection: "localization" }
  ],
  locations: [
    { field: "entityId", targetSection: "entities" },
    { field: "titleKey", targetSection: "localization" }
  ],
  quests: [
    { field: "locationId", targetSection: "locations" },
    { field: "requiredItemIds", targetSection: "items", multiple: true },
    { field: "availableCommandIds", targetSection: "commands", multiple: true },
    { field: "titleKey", targetSection: "localization" }
  ],
  systems: [{ field: "descriptionKey", targetSection: "localization" }]
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

function createContentDiagnostic(
  code: string,
  path: readonly (string | number)[],
  message: string,
  details?: JsonValue
): ValidationDiagnostic {
  return createValidationDiagnostic({
    ownerContract: CONTENT_LOADER_BOUNDARY_VERSION,
    code,
    severity: "error",
    category: "reference",
    phase: "reference-validation",
    path,
    message,
    source: VALIDATION_SOURCE,
    ...(details === undefined ? {} : { details })
  });
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

function validateReferenceValue(
  diagnostics: ValidationDiagnostic[],
  byId: ContentIdIndexingResult["byId"],
  value: unknown,
  path: readonly (string | number)[],
  rule: ReferenceFieldRule,
  options: ContentReferenceValidationOptions
): void {
  if (!isNonEmptyString(value)) {
    if (options.allowUnsupportedReferenceKinds === true) {
      return;
    }

    diagnostics.push(
      createContentDiagnostic(
        "CONTENT_REFERENCE_UNSUPPORTED_KIND",
        path,
        `Reference field "${rule.field}" must use a stable string identifier.`,
        cloneJson({
          field: rule.field,
          expectedKind: rule.multiple === true ? "string[]" : "string"
        })
      )
    );
    return;
  }

  const matches = byId[value] ?? [];
  if (matches.length === 0) {
    diagnostics.push(
      createContentDiagnostic(
        "CONTENT_REFERENCE_MISSING_TARGET",
        path,
        `Reference field "${rule.field}" points to missing target "${value}".`,
        cloneJson({
          field: rule.field,
          targetId: value,
          ...(rule.targetSection === undefined ? {} : { expectedSection: rule.targetSection })
        })
      )
    );
    return;
  }

  if (rule.targetSection === undefined) {
    return;
  }

  const hasTargetSection = matches.some((entry) => entry.section === rule.targetSection);
  if (hasTargetSection) {
    return;
  }

  diagnostics.push(
    createContentDiagnostic(
      "CONTENT_REFERENCE_WRONG_SECTION",
      path,
      `Reference field "${rule.field}" points to "${value}" but expected section "${rule.targetSection}".`,
      cloneJson({
        field: rule.field,
        targetId: value,
        expectedSection: rule.targetSection,
        actualSections: [...new Set(matches.map((entry) => entry.section))].sort()
      })
    )
  );
}

function validateReferenceField(
  diagnostics: ValidationDiagnostic[],
  byId: ContentIdIndexingResult["byId"],
  item: Record<string, unknown>,
  itemPath: readonly (string | number)[],
  rule: ReferenceFieldRule,
  options: ContentReferenceValidationOptions
): void {
  if (!(rule.field in item)) {
    return;
  }

  const value = item[rule.field];
  const fieldPath = [...itemPath, rule.field] as const;

  if (rule.multiple === true) {
    if (!Array.isArray(value)) {
      if (options.allowUnsupportedReferenceKinds !== true) {
        diagnostics.push(
          createContentDiagnostic(
            "CONTENT_REFERENCE_UNSUPPORTED_KIND",
            fieldPath,
            `Reference field "${rule.field}" must be an array of stable string identifiers.`,
            cloneJson({
              field: rule.field,
              expectedKind: "string[]"
            })
          )
        );
      }
      return;
    }

    for (let index = 0; index < value.length; index += 1) {
      validateReferenceValue(
        diagnostics,
        byId,
        value[index],
        [...fieldPath, index],
        rule,
        options
      );
    }
    return;
  }

  validateReferenceValue(diagnostics, byId, value, fieldPath, rule, options);
}

export function validateContentReferences(
  input: ContentLoaderInput,
  idIndex: ContentIdIndexingResult,
  options: ContentReferenceValidationOptions = {}
): ContentReferenceValidationResult {
  if (!isRecord(input.rawPackage)) {
    return {
      diagnostics: sortValidationDiagnostics([
        createContentDiagnostic(
          "CONTENT_REFERENCE_UNSUPPORTED_KIND",
          ["rawPackage"],
          "Content loader rawPackage must be a JSON object before reference validation."
        )
      ])
    };
  }

  const packageShape = input.rawPackage as ContentPackageShape;
  const sections = isRecord(packageShape.sections) ? packageShape.sections : {};
  const diagnostics: ValidationDiagnostic[] = [];
  const sectionOrder = getSectionOrder(packageShape);

  for (const sectionName of sectionOrder) {
    const rules = getReferenceRules(sectionName);
    if (rules === undefined) {
      continue;
    }

    const sectionValue = sections[sectionName];
    if (!Array.isArray(sectionValue)) {
      continue;
    }

    const sectionItems = sectionValue as readonly unknown[];
    for (let itemIndex = 0; itemIndex < sectionItems.length; itemIndex += 1) {
      const item = sectionItems[itemIndex];
      if (!isRecord(item)) {
        continue;
      }

      const itemPath = ["sections", sectionName, itemIndex] as const;
      for (const rule of rules) {
        validateReferenceField(diagnostics, idIndex.byId, item, itemPath, rule, options);
      }
    }
  }

  return {
    diagnostics: sortValidationDiagnostics(diagnostics)
  };
}
