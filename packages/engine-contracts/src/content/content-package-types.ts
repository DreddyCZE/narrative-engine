
import {
  formatJsonPath,
  inspectJsonSafety,
  type JsonPath,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import type { SchemaVersion } from "../storage/serialization-schema-types.js";

export const CONTENT_ACTION_AFFORDANCES = ["look", "go", "talk", "take", "use", "inventory", "save", "load"] as const;

export type ContentActionAffordance = (typeof CONTENT_ACTION_AFFORDANCES)[number];

export type ContentExitDescriptor = {
  readonly exitId: string;
  readonly label: string;
  readonly targetLocationId: string;
  readonly conditionFlag?: string;
  readonly locked?: boolean;
};

export type ContentLocationDescriptor = {
  readonly locationId: string;
  readonly title: string;
  readonly description: string;
  readonly exits: readonly ContentExitDescriptor[];
  readonly tags?: readonly string[];
};

export type ContentItemDescriptor = {
  readonly itemId: string;
  readonly title: string;
  readonly description: string;
  readonly locationId?: string;
  readonly portable?: boolean;
};

export type ContentNpcDescriptor = {
  readonly npcId: string;
  readonly name: string;
  readonly locationId: string;
  readonly dialogueId?: string;
};

export type ContentDialogueDescriptor = {
  readonly dialogueId: string;
  readonly title: string;
  readonly lines: readonly string[];
};

export type ContentInitialPlayerState = {
  readonly startLocationId: string;
  readonly inventoryItemIds?: readonly string[];
  readonly progressFlags?: readonly string[];
};

export type ContentPackage = {
  readonly packageId: string;
  readonly schemaVersion: SchemaVersion;
  readonly title: string;
  readonly theme: string;
  readonly description?: string;
  readonly locations: readonly ContentLocationDescriptor[];
  readonly items?: readonly ContentItemDescriptor[];
  readonly npcs?: readonly ContentNpcDescriptor[];
  readonly dialogues?: readonly ContentDialogueDescriptor[];
  readonly initialPlayerState: ContentInitialPlayerState;
  readonly actionAffordances: readonly ContentActionAffordance[];
};

export type ContentPackageDiagnostic = {
  readonly code: string;
  readonly path: JsonPath;
  readonly message: string;
  readonly details?: JsonValue;
};

export class ContentPackageValidationError extends TypeError {
  public readonly diagnostics: readonly ContentPackageDiagnostic[];

  public constructor(diagnostics: readonly ContentPackageDiagnostic[]) {
    super(formatContentPackageValidationMessage(diagnostics));
    this.name = "ContentPackageValidationError";
    this.diagnostics = diagnostics;
  }
}

const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;
const ENTITY_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;
const FLAG_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const THEME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/u;
const SCHEMA_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

type ReferenceTarget = {
  readonly value: string;
  readonly path: readonly JsonPathSegment[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function createDiagnostic(
  code: string,
  path: readonly JsonPathSegment[],
  message: string,
  details?: JsonValue
): ContentPackageDiagnostic {
  return {
    code,
    path: [...path],
    message,
    ...(details === undefined ? {} : { details: cloneValue(details) })
  };
}

function comparePath(left: JsonPath, right: JsonPath): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftSegment = left[index];
    const rightSegment = right[index];
    if (leftSegment === rightSegment) {
      continue;
    }
    const leftType = typeof leftSegment;
    const rightType = typeof rightSegment;
    if (leftType !== rightType) {
      return leftType === "number" ? -1 : 1;
    }
    if (typeof leftSegment === "number" && typeof rightSegment === "number") {
      return leftSegment - rightSegment;
    }
    return String(leftSegment).localeCompare(String(rightSegment));
  }
  return left.length - right.length;
}

function sortDiagnostics(diagnostics: readonly ContentPackageDiagnostic[]): readonly ContentPackageDiagnostic[] {
  return diagnostics
    .map((diagnostic, index) => ({ diagnostic, index }))
    .sort((left, right) => {
      const pathComparison = comparePath(left.diagnostic.path, right.diagnostic.path);
      if (pathComparison !== 0) {
        return pathComparison;
      }
      const codeComparison = left.diagnostic.code.localeCompare(right.diagnostic.code);
      if (codeComparison !== 0) {
        return codeComparison;
      }
      const messageComparison = left.diagnostic.message.localeCompare(right.diagnostic.message);
      if (messageComparison !== 0) {
        return messageComparison;
      }
      return left.index - right.index;
    })
    .map(({ diagnostic }) => diagnostic);
}

function mapJsonSafetyDiagnostics(
  issues: ReturnType<typeof inspectJsonSafety>,
  prefix: readonly JsonPathSegment[] = []
): readonly ContentPackageDiagnostic[] {
  return issues.map((issue) =>
    createDiagnostic(
      issue.code === "FORBIDDEN_KEY" ? "CONTENT_PACKAGE_FORBIDDEN_KEY" : "CONTENT_PACKAGE_NON_JSON_VALUE",
      [...prefix, ...issue.path],
      issue.message
    )
  );
}

function validateStringField(
  diagnostics: ContentPackageDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[],
  pattern: RegExp,
  code: string,
  message: string
): value is string {
  if (typeof value !== "string" || !pattern.test(value)) {
    diagnostics.push(createDiagnostic(code, path, message));
    return false;
  }
  return true;
}

function validateNonEmptyString(
  diagnostics: ContentPackageDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[],
  code: string,
  message: string
): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    diagnostics.push(createDiagnostic(code, path, message));
    return false;
  }
  return true;
}

function validateStringArray(
  diagnostics: ContentPackageDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[],
  entryPattern: RegExp,
  code: string,
  arrayMessage: string,
  entryMessage: string
): value is readonly string[] {
  if (!Array.isArray(value)) {
    diagnostics.push(createDiagnostic(code, path, arrayMessage));
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    validateStringField(diagnostics, value[index], [...path, index], entryPattern, code, entryMessage);
  }
  return true;
}

function validateSchemaVersion(
  diagnostics: ContentPackageDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[]
): value is SchemaVersion {
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("CONTENT_PACKAGE_SCHEMA_VERSION_INVALID", path, "schemaVersion must be an object."));
    return false;
  }
  if (typeof value.schemaId !== "string" || !SCHEMA_ID_PATTERN.test(value.schemaId)) {
    diagnostics.push(createDiagnostic("CONTENT_PACKAGE_SCHEMA_VERSION_INVALID", [...path, "schemaId"], "schemaId is invalid."));
  }
  if (!isPositiveInteger(value.version)) {
    diagnostics.push(createDiagnostic("CONTENT_PACKAGE_SCHEMA_VERSION_INVALID", [...path, "version"], "version must be a positive integer."));
  }
  return diagnostics.length === 0;
}

function pushDuplicateDiagnostic(
  diagnostics: ContentPackageDiagnostic[],
  path: readonly JsonPathSegment[],
  entityName: string,
  duplicateValue: string
): void {
  diagnostics.push(
    createDiagnostic("CONTENT_PACKAGE_DUPLICATE_ID", path, `${entityName} must be unique.`, {
      duplicateValue
    })
  );
}

function pushMissingReferenceDiagnostics(
  diagnostics: ContentPackageDiagnostic[],
  references: readonly ReferenceTarget[],
  knownIds: ReadonlySet<string>,
  message: string
): void {
  for (const reference of references) {
    if (!knownIds.has(reference.value)) {
      diagnostics.push(createDiagnostic("CONTENT_PACKAGE_REFERENCE_INVALID", reference.path, message));
    }
  }
}

export function isContentActionAffordance(value: unknown): value is ContentActionAffordance {
  return typeof value === "string" && CONTENT_ACTION_AFFORDANCES.includes(value as ContentActionAffordance);
}
export function inspectContentPackage(value: unknown): readonly ContentPackageDiagnostic[] {
  const diagnostics: ContentPackageDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", [], "content package must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value)));
  validateStringField(diagnostics, value.packageId, ["packageId"], PACKAGE_ID_PATTERN, "CONTENT_PACKAGE_ID_INVALID", "packageId is invalid.");
  validateSchemaVersion(diagnostics, value.schemaVersion, ["schemaVersion"]);
  validateNonEmptyString(diagnostics, value.title, ["title"], "CONTENT_PACKAGE_INVALID", "title must be a non-empty string.");
  validateStringField(diagnostics, value.theme, ["theme"], THEME_PATTERN, "CONTENT_PACKAGE_INVALID", "theme is invalid.");
  if (value.description !== undefined) {
    validateNonEmptyString(diagnostics, value.description, ["description"], "CONTENT_PACKAGE_INVALID", "description must be a non-empty string when present.");
  }

  const locationIds = new Set<string>();
  const itemIds = new Set<string>();
  const dialogueIds = new Set<string>();
  const npcIds = new Set<string>();
  const locationReferences: ReferenceTarget[] = [];
  const itemLocationRefs: ReferenceTarget[] = [];
  const npcLocationRefs: ReferenceTarget[] = [];
  const npcDialogueRefs: ReferenceTarget[] = [];
  const inventoryItemRefs: ReferenceTarget[] = [];

  if (!Array.isArray(value.locations)) {
    diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", ["locations"], "locations must be an array."));
  } else if (value.locations.length === 0) {
    diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", ["locations"], "locations must contain at least one location."));
  } else {
    const locations: readonly unknown[] = value.locations;
    for (let index = 0; index < locations.length; index += 1) {
      const location = locations[index];
      const path = ["locations", index] as const;
      if (!isRecord(location)) {
        diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", path, "location must be an object."));
        continue;
      }
      const locationId = location.locationId;
      const hasLocationId = validateStringField(diagnostics, locationId, [...path, "locationId"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_ID_INVALID", "locationId is invalid.");
      if (hasLocationId) {
        if (locationIds.has(locationId)) {
          pushDuplicateDiagnostic(diagnostics, [...path, "locationId"], "locationId", locationId);
        } else {
          locationIds.add(locationId);
        }
      }
      validateNonEmptyString(diagnostics, location.title, [...path, "title"], "CONTENT_PACKAGE_INVALID", "location title must be a non-empty string.");
      validateNonEmptyString(diagnostics, location.description, [...path, "description"], "CONTENT_PACKAGE_INVALID", "location description must be a non-empty string.");
      if (!Array.isArray(location.exits)) {
        diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", [...path, "exits"], "exits must be an array."));
      } else {
        const exits: readonly unknown[] = location.exits;
        for (let exitIndex = 0; exitIndex < exits.length; exitIndex += 1) {
          const exit = exits[exitIndex];
          const exitPath = [...path, "exits", exitIndex] as const;
          if (!isRecord(exit)) {
            diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", exitPath, "exit must be an object."));
            continue;
          }
          validateStringField(diagnostics, exit.exitId, [...exitPath, "exitId"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_ID_INVALID", "exitId is invalid.");
          validateNonEmptyString(diagnostics, exit.label, [...exitPath, "label"], "CONTENT_PACKAGE_INVALID", "exit label must be a non-empty string.");
          const targetLocationId = exit.targetLocationId;
          const hasTarget = validateStringField(diagnostics, targetLocationId, [...exitPath, "targetLocationId"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_REFERENCE_INVALID", "targetLocationId is invalid.");
          if (hasTarget) {
            locationReferences.push({ value: targetLocationId, path: [...exitPath, "targetLocationId"] });
          }
          if (exit.conditionFlag !== undefined) {
            validateStringField(diagnostics, exit.conditionFlag, [...exitPath, "conditionFlag"], FLAG_ID_PATTERN, "CONTENT_PACKAGE_INVALID", "conditionFlag is invalid.");
          }
          if (exit.locked !== undefined && typeof exit.locked !== "boolean") {
            diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", [...exitPath, "locked"], "locked must be a boolean when present."));
          }
        }
      }
      if (location.tags !== undefined) {
        validateStringArray(diagnostics, location.tags, [...path, "tags"], FLAG_ID_PATTERN, "CONTENT_PACKAGE_INVALID", "tags must be an array when present.", "tag is invalid.");
      }
    }
  }

  if (value.items !== undefined) {
    if (!Array.isArray(value.items)) {
      diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", ["items"], "items must be an array when present."));
    } else {
      const items: readonly unknown[] = value.items;
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const path = ["items", index] as const;
        if (!isRecord(item)) {
          diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", path, "item must be an object."));
          continue;
        }
        const itemId = item.itemId;
        const hasItemId = validateStringField(diagnostics, itemId, [...path, "itemId"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_ID_INVALID", "itemId is invalid.");
        if (hasItemId) {
          if (itemIds.has(itemId)) {
            pushDuplicateDiagnostic(diagnostics, [...path, "itemId"], "itemId", itemId);
          } else {
            itemIds.add(itemId);
          }
        }
        validateNonEmptyString(diagnostics, item.title, [...path, "title"], "CONTENT_PACKAGE_INVALID", "item title must be a non-empty string.");
        validateNonEmptyString(diagnostics, item.description, [...path, "description"], "CONTENT_PACKAGE_INVALID", "item description must be a non-empty string.");
        if (item.locationId !== undefined) {
          const itemLocationId = item.locationId;
          const hasLocationRef = validateStringField(diagnostics, itemLocationId, [...path, "locationId"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_REFERENCE_INVALID", "item locationId is invalid.");
          if (hasLocationRef) {
            itemLocationRefs.push({ value: itemLocationId, path: [...path, "locationId"] });
          }
        }
        if (item.portable !== undefined && typeof item.portable !== "boolean") {
          diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", [...path, "portable"], "portable must be a boolean when present."));
        }
      }
    }
  }
  if (value.dialogues !== undefined) {
    if (!Array.isArray(value.dialogues)) {
      diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", ["dialogues"], "dialogues must be an array when present."));
    } else {
      const dialogues: readonly unknown[] = value.dialogues;
      for (let index = 0; index < dialogues.length; index += 1) {
        const dialogue = dialogues[index];
        const path = ["dialogues", index] as const;
        if (!isRecord(dialogue)) {
          diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", path, "dialogue must be an object."));
          continue;
        }
        const dialogueId = dialogue.dialogueId;
        const hasDialogueId = validateStringField(diagnostics, dialogueId, [...path, "dialogueId"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_ID_INVALID", "dialogueId is invalid.");
        if (hasDialogueId) {
          if (dialogueIds.has(dialogueId)) {
            pushDuplicateDiagnostic(diagnostics, [...path, "dialogueId"], "dialogueId", dialogueId);
          } else {
            dialogueIds.add(dialogueId);
          }
        }
        validateNonEmptyString(diagnostics, dialogue.title, [...path, "title"], "CONTENT_PACKAGE_INVALID", "dialogue title must be a non-empty string.");
        if (!Array.isArray(dialogue.lines) || dialogue.lines.length === 0) {
          diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", [...path, "lines"], "lines must be a non-empty array."));
        } else {
          for (let lineIndex = 0; lineIndex < dialogue.lines.length; lineIndex += 1) {
            validateNonEmptyString(diagnostics, dialogue.lines[lineIndex], [...path, "lines", lineIndex], "CONTENT_PACKAGE_INVALID", "dialogue line must be a non-empty string.");
          }
        }
      }
    }
  }

  if (value.npcs !== undefined) {
    if (!Array.isArray(value.npcs)) {
      diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", ["npcs"], "npcs must be an array when present."));
    } else {
      const npcs: readonly unknown[] = value.npcs;
      for (let index = 0; index < npcs.length; index += 1) {
        const npc = npcs[index];
        const path = ["npcs", index] as const;
        if (!isRecord(npc)) {
          diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", path, "npc must be an object."));
          continue;
        }
        const npcId = npc.npcId;
        const hasNpcId = validateStringField(diagnostics, npcId, [...path, "npcId"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_ID_INVALID", "npcId is invalid.");
        if (hasNpcId) {
          if (npcIds.has(npcId)) {
            pushDuplicateDiagnostic(diagnostics, [...path, "npcId"], "npcId", npcId);
          } else {
            npcIds.add(npcId);
          }
        }
        validateNonEmptyString(diagnostics, npc.name, [...path, "name"], "CONTENT_PACKAGE_INVALID", "npc name must be a non-empty string.");
        const npcLocationId = npc.locationId;
        const hasLocationId = validateStringField(diagnostics, npcLocationId, [...path, "locationId"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_REFERENCE_INVALID", "npc locationId is invalid.");
        if (hasLocationId) {
          npcLocationRefs.push({ value: npcLocationId, path: [...path, "locationId"] });
        }
        if (npc.dialogueId !== undefined) {
          const npcDialogueId = npc.dialogueId;
          const hasDialogueRef = validateStringField(diagnostics, npcDialogueId, [...path, "dialogueId"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_REFERENCE_INVALID", "npc dialogueId is invalid.");
          if (hasDialogueRef) {
            npcDialogueRefs.push({ value: npcDialogueId, path: [...path, "dialogueId"] });
          }
        }
      }
    }
  }

  if (!isRecord(value.initialPlayerState)) {
    diagnostics.push(createDiagnostic("CONTENT_PACKAGE_INVALID", ["initialPlayerState"], "initialPlayerState must be an object."));
  } else {
    const startLocationId = value.initialPlayerState.startLocationId;
    const hasStartLocationId = validateStringField(diagnostics, startLocationId, ["initialPlayerState", "startLocationId"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_REFERENCE_INVALID", "startLocationId is invalid.");
    if (hasStartLocationId) {
      locationReferences.push({ value: startLocationId, path: ["initialPlayerState", "startLocationId"] });
    }
    if (value.initialPlayerState.inventoryItemIds !== undefined) {
      const inventoryItemIds = value.initialPlayerState.inventoryItemIds;
      const hasInventoryItemIds = validateStringArray(diagnostics, inventoryItemIds, ["initialPlayerState", "inventoryItemIds"], ENTITY_ID_PATTERN, "CONTENT_PACKAGE_REFERENCE_INVALID", "inventoryItemIds must be an array when present.", "inventory item reference is invalid.");
      if (hasInventoryItemIds) {
        for (let index = 0; index < inventoryItemIds.length; index += 1) {
          const inventoryItemId = inventoryItemIds[index];
          if (inventoryItemId === undefined) {
            continue;
          }
          inventoryItemRefs.push({ value: inventoryItemId, path: ["initialPlayerState", "inventoryItemIds", index] });
        }
      }
    }
    if (value.initialPlayerState.progressFlags !== undefined) {
      validateStringArray(diagnostics, value.initialPlayerState.progressFlags, ["initialPlayerState", "progressFlags"], FLAG_ID_PATTERN, "CONTENT_PACKAGE_INVALID", "progressFlags must be an array when present.", "progress flag is invalid.");
    }
  }

  if (!Array.isArray(value.actionAffordances) || value.actionAffordances.length === 0) {
    diagnostics.push(createDiagnostic("CONTENT_PACKAGE_ACTION_INVALID", ["actionAffordances"], "actionAffordances must be a non-empty array."));
  } else {
    for (let index = 0; index < value.actionAffordances.length; index += 1) {
      if (!isContentActionAffordance(value.actionAffordances[index])) {
        diagnostics.push(createDiagnostic("CONTENT_PACKAGE_ACTION_INVALID", ["actionAffordances", index], "action affordance is invalid."));
      }
    }
  }

  pushMissingReferenceDiagnostics(diagnostics, locationReferences, locationIds, "location reference does not exist.");
  pushMissingReferenceDiagnostics(diagnostics, itemLocationRefs, locationIds, "item location reference does not exist.");
  pushMissingReferenceDiagnostics(diagnostics, npcLocationRefs, locationIds, "npc location reference does not exist.");
  pushMissingReferenceDiagnostics(diagnostics, npcDialogueRefs, dialogueIds, "npc dialogue reference does not exist.");
  pushMissingReferenceDiagnostics(diagnostics, inventoryItemRefs, itemIds, "inventory item reference does not exist.");

  return sortDiagnostics(diagnostics);
}

export function formatContentPackageValidationMessage(diagnostics: readonly ContentPackageDiagnostic[]): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Content package value is valid.";
  }
  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertContentPackage(value: unknown): asserts value is ContentPackage {
  const diagnostics = inspectContentPackage(value);
  if (diagnostics.length > 0) {
    throw new ContentPackageValidationError(diagnostics);
  }
}
