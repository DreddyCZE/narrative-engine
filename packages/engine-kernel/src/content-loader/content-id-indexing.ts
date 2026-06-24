import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ContentLoaderInput,
  type ValidationDiagnostic
} from "@narrative-engine/engine-contracts";

export type ContentIdIndexingOptions = {
  readonly allowCrossSectionDuplicateIds?: boolean;
};

export type ContentIdIndexEntry = {
  readonly id: string;
  readonly section: string;
  readonly path: string;
};

export type ContentIdIndexingResult = {
  readonly entries: readonly ContentIdIndexEntry[];
  readonly byId: Readonly<Record<string, readonly ContentIdIndexEntry[]>>;
  readonly bySection: Readonly<Record<string, readonly ContentIdIndexEntry[]>>;
  readonly diagnostics: readonly ValidationDiagnostic[];
};

const CONTENT_LOADER_BOUNDARY_VERSION = "content-loader-boundary@0.1.0" as const;
const VALIDATION_SOURCE = {
  kind: "content-loader",
  id: "content-id-indexer"
} as const;

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

const NON_INDEXED_SECTIONS = new Set(["validationManifest"]);

type ContentPackageShape = {
  readonly manifest?: {
    readonly declaredSections?: readonly string[];
  };
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

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function createContentDiagnostic(
  code: string,
  path: readonly (string | number)[],
  message: string,
  category: "identity" | "shape" = "identity",
  details?: JsonValue
): ValidationDiagnostic {
  return createValidationDiagnostic({
    ownerContract: CONTENT_LOADER_BOUNDARY_VERSION,
    code,
    severity: "error",
    category,
    phase: "shape-validation",
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

function getIdField(section: string, item: Record<string, unknown>): string | undefined {
  const mapped = SECTION_ID_FIELDS[section];
  if (mapped !== undefined) {
    return mapped;
  }
  if ("id" in item) {
    return "id";
  }
  return undefined;
}

function readRecordValue(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function compareEntries(left: ContentIdIndexEntry, right: ContentIdIndexEntry): number {
  const sectionComparison = left.section.localeCompare(right.section);
  if (sectionComparison !== 0) {
    return sectionComparison;
  }
  const idComparison = left.id.localeCompare(right.id);
  if (idComparison !== 0) {
    return idComparison;
  }
  return left.path.localeCompare(right.path);
}

function buildGroupedIndex(
  entries: readonly ContentIdIndexEntry[],
  groupKey: "id" | "section"
): Readonly<Record<string, readonly ContentIdIndexEntry[]>> {
  const grouped = new Map<string, ContentIdIndexEntry[]>();

  for (const entry of entries) {
    const key = entry[groupKey];
    const existing = grouped.get(key);
    if (existing === undefined) {
      grouped.set(key, [entry]);
      continue;
    }
    existing.push(entry);
  }

  return Object.freeze(
    Object.fromEntries(
      [...grouped.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, Object.freeze(value.slice().sort(compareEntries))])
    )
  );
}

function pointerToPath(pointer: string): readonly (string | number)[] {
  return pointer
    .split("/")
    .slice(1)
    .map((segment) => (/^\d+$/u.test(segment) ? Number(segment) : segment));
}

export function buildContentIdIndex(
  input: ContentLoaderInput,
  options: ContentIdIndexingOptions = {}
): ContentIdIndexingResult {
  const entries: ContentIdIndexEntry[] = [];
  const diagnostics: ValidationDiagnostic[] = [];

  if (!isRecord(input.rawPackage)) {
    return {
      entries: [],
      byId: {},
      bySection: {},
      diagnostics: sortValidationDiagnostics([
        createContentDiagnostic(
          "CONTENT_SECTION_ITEM_ID_INVALID",
          ["rawPackage"],
          "Content loader rawPackage must be a JSON object.",
          "shape"
        )
      ])
    };
  }

  const packageShape = input.rawPackage as ContentPackageShape;
  const sections = isRecord(packageShape.sections) ? packageShape.sections : {};
  const sectionOrder = getSectionOrder(packageShape);

  for (const sectionName of sectionOrder) {
    if (NON_INDEXED_SECTIONS.has(sectionName)) {
      continue;
    }

    const sectionValue = sections[sectionName];
    if (sectionValue === undefined) {
      continue;
    }

    if (!Array.isArray(sectionValue)) {
      continue;
    }

    const sectionItems = sectionValue as readonly unknown[];

    for (let index = 0; index < sectionItems.length; index += 1) {
      const item = sectionItems[index];
      const itemPath = ["sections", sectionName, index] as const;

      if (!isRecord(item)) {
        diagnostics.push(
          createContentDiagnostic(
            "CONTENT_SECTION_ITEM_ID_INVALID",
            itemPath,
            `Section "${sectionName}" entry must be a JSON object.`,
            "shape"
          )
        );
        continue;
      }

      const idField = getIdField(sectionName, item);
      if (idField === undefined) {
        diagnostics.push(
          createContentDiagnostic(
            "CONTENT_SECTION_ITEM_ID_MISSING",
            itemPath,
            `Section "${sectionName}" entry does not expose an indexable identifier field.`,
            "identity"
          )
        );
        continue;
      }

      const idValue = readRecordValue(item, idField);
      const fieldPath = [...itemPath, idField] as const;
      if (idValue === undefined) {
        diagnostics.push(
          createContentDiagnostic(
            "CONTENT_SECTION_ITEM_ID_MISSING",
            fieldPath,
            `Section "${sectionName}" entry is missing required identifier field "${idField}".`,
            "identity"
          )
        );
        continue;
      }

      if (!isValidContentId(idValue)) {
        diagnostics.push(
          createContentDiagnostic(
            "CONTENT_SECTION_ITEM_ID_INVALID",
            fieldPath,
            `Section "${sectionName}" identifier field "${idField}" must contain a stable content ID.`,
            "identity"
          )
        );
        continue;
      }

      entries.push({
        id: idValue,
        section: sectionName,
        path: `/${fieldPath.join("/")}`
      });
    }
  }

  const sortedEntries = entries.slice().sort(compareEntries);
  const byId = buildGroupedIndex(sortedEntries, "id");
  const bySection = buildGroupedIndex(sortedEntries, "section");

  for (const sectionEntries of Object.values(bySection)) {
    for (let index = 1; index < sectionEntries.length; index += 1) {
      const current = sectionEntries[index];
      const previous = sectionEntries[index - 1];
      if (current !== undefined && previous !== undefined && current.section === previous.section && current.id === previous.id) {
        diagnostics.push(
          createContentDiagnostic(
            "CONTENT_REFERENCE_DUPLICATE_ID",
            pointerToPath(current.path),
            `Duplicate identifier "${current.id}" appears in section "${current.section}".`,
            "identity",
            cloneJson({
              originalPath: previous.path,
              duplicateId: current.id
            })
          )
        );
      }
    }
  }

  if (options.allowCrossSectionDuplicateIds !== true) {
    for (const idEntries of Object.values(byId)) {
      const sectionsForId = [...new Set(idEntries.map((entry) => entry.section))].sort();
      if (sectionsForId.length > 1) {
        for (const entry of idEntries) {
          diagnostics.push(
            createContentDiagnostic(
              "CONTENT_REFERENCE_CROSS_SECTION_DUPLICATE_ID",
              pointerToPath(entry.path),
              `Identifier "${entry.id}" is duplicated across sections: ${sectionsForId.join(", ")}.`,
              "identity",
              cloneJson({
                sections: sectionsForId
              })
            )
          );
        }
      }
    }
  }

  return {
    entries: Object.freeze(sortedEntries),
    byId,
    bySection,
    diagnostics: sortValidationDiagnostics(diagnostics)
  };
}
