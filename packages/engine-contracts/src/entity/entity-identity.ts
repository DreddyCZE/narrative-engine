import { formatJsonPath, inspectJsonSafety, type JsonPath } from "@narrative-engine/core";

export const ENTITY_IDENTITY_CONTRACT_VERSION = "entity-identity@0.1.0" as const;

export type EntityIdentityAlias = {
  readonly id: string;
  readonly reason: "renamed" | "split" | "merged" | "legacy-import" | "migration";
  readonly sinceSchemaVersion: number;
  readonly removeAfterSchemaVersion?: number;
};

export type EntityIdentityProvenance = {
  readonly sourceFile?: string;
  readonly sourceEntityId?: string;
  readonly sourceRevision?: string;
  readonly sourceLine?: number;
  readonly generatedBy?: string;
  readonly taskId?: string;
  readonly commit?: string;
  readonly approvalState?: "draft" | "ai-draft" | "human-edited" | "approved" | "canonical";
};

export type EntityIdentityChange = {
  readonly revision?: number;
  readonly createdBy?: string;
  readonly updatedBy?: string;
};

export type EntityIdentity = {
  readonly contractVersion: typeof ENTITY_IDENTITY_CONTRACT_VERSION;
  readonly id: string;
  readonly entityType: string;
  readonly namespace: string;
  readonly schemaVersion: number;
  readonly tags?: readonly string[];
  readonly aliases?: readonly EntityIdentityAlias[];
  readonly provenance?: EntityIdentityProvenance;
  readonly change?: EntityIdentityChange;
};

export type EntityIdentityIssueCode =
  | "ENTITY_IDENTITY_NOT_OBJECT"
  | "ENTITY_IDENTITY_MISSING_CONTRACT_VERSION"
  | "ENTITY_IDENTITY_INVALID_CONTRACT_VERSION"
  | "ENTITY_IDENTITY_MISSING_ID"
  | "ENTITY_IDENTITY_INVALID_ID"
  | "ENTITY_IDENTITY_MISSING_TYPE"
  | "ENTITY_IDENTITY_INVALID_TYPE"
  | "ENTITY_IDENTITY_MISSING_NAMESPACE"
  | "ENTITY_IDENTITY_INVALID_NAMESPACE"
  | "ENTITY_IDENTITY_MISSING_SCHEMA_VERSION"
  | "ENTITY_IDENTITY_INVALID_SCHEMA_VERSION"
  | "ENTITY_IDENTITY_TYPE_MISMATCH"
  | "ENTITY_IDENTITY_NAMESPACE_MISMATCH"
  | "ENTITY_IDENTITY_UNKNOWN_FIELD"
  | "ENTITY_IDENTITY_INVALID_TAG"
  | "ENTITY_IDENTITY_INVALID_ALIAS"
  | "ENTITY_IDENTITY_INVALID_PROVENANCE"
  | "ENTITY_IDENTITY_INVALID_CHANGE"
  | "ENTITY_IDENTITY_NON_JSON_VALUE"
  | "ENTITY_IDENTITY_FORBIDDEN_KEY";

export type EntityIdentityIssue = {
  readonly code: EntityIdentityIssueCode;
  readonly path: JsonPath;
  readonly message: string;
};

export class EntityIdentityValidationError extends TypeError {
  public readonly issues: readonly EntityIdentityIssue[];

  public constructor(issues: readonly EntityIdentityIssue[]) {
    super(formatEntityIdentityValidationMessage(issues));
    this.name = "EntityIdentityValidationError";
    this.issues = issues;
  }
}

const CONTRACT_VERSION = ENTITY_IDENTITY_CONTRACT_VERSION;
const ID_PATTERN = new RegExp(
  "^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$",
  "u"
);
const ENTITY_TYPE_PATTERN = new RegExp("^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$", "u");
const NAMESPACE_PATTERN = new RegExp("^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}$", "u");
const TAG_PATTERN = new RegExp("^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$", "u");
const STABLE_TEXT_PATTERN = new RegExp("^[A-Za-z0-9._/@:-]+$", "u");
const SOURCE_FILE_PATTERN = new RegExp("^(?!/)(?![A-Za-z]:)(?!.*(^|/)\\.\\.?(/|$))[A-Za-z0-9._/-]+$", "u");
const TASK_PATTERN = new RegExp("^[A-Z]+-[0-9]{3,5}$", "u");
const COMMIT_PATTERN = new RegExp("^[0-9a-f]{7,40}$", "u");
const CHANGE_AUTHOR_PATTERN = new RegExp("^[a-z][a-z0-9._-]{1,79}$", "u");
const ALIAS_REASONS = new Set<string>([
  "renamed",
  "split",
  "merged",
  "legacy-import",
  "migration"
]);
const TOP_LEVEL_KEYS = new Set([
  "contractVersion",
  "id",
  "entityType",
  "namespace",
  "schemaVersion",
  "tags",
  "aliases",
  "provenance",
  "change"
]);
const ALIAS_KEYS = new Set(["id", "reason", "sinceSchemaVersion", "removeAfterSchemaVersion"]);
const PROVENANCE_KEYS = new Set([
  "sourceFile",
  "sourceEntityId",
  "sourceRevision",
  "sourceLine",
  "generatedBy",
  "taskId",
  "commit",
  "approvalState"
]);
const CHANGE_KEYS = new Set(["revision", "createdBy", "updatedBy"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isAliasReason(value: unknown): value is EntityIdentityAlias["reason"] {
  return typeof value === "string" && ALIAS_REASONS.has(value);
}

function isSorted(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous === undefined || current === undefined) {
      return false;
    }
    if (previous > current) {
      return false;
    }
  }
  return true;
}

function addIssue(
  issues: EntityIdentityIssue[],
  code: EntityIdentityIssueCode,
  path: JsonPath,
  message: string
): void {
  issues.push({ code, path: path.slice(), message });
}

function mapJsonSafetyIssues(issues: EntityIdentityIssue[], sourceIssues: ReturnType<typeof inspectJsonSafety>): void {
  for (const issue of sourceIssues) {
    const code =
      issue.code === "FORBIDDEN_KEY" ? "ENTITY_IDENTITY_FORBIDDEN_KEY" : "ENTITY_IDENTITY_NON_JSON_VALUE";
    addIssue(issues, code, issue.path, issue.message);
  }
}

function validateStringValue(
  issues: EntityIdentityIssue[],
  path: JsonPath,
  value: unknown,
  pattern: RegExp,
  missingCode: EntityIdentityIssueCode,
  invalidCode: EntityIdentityIssueCode,
  missingMessage: string,
  invalidMessage: string
): value is string {
  if (value === undefined) {
    addIssue(issues, missingCode, path, missingMessage);
    return false;
  }
  if (typeof value !== "string" || !pattern.test(value)) {
    addIssue(issues, invalidCode, path, invalidMessage);
    return false;
  }
  return true;
}

function validateOptionalString(
  issues: EntityIdentityIssue[],
  path: JsonPath,
  value: unknown,
  pattern: RegExp,
  code: EntityIdentityIssueCode,
  message: string
): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== "string" || !pattern.test(value)) {
    addIssue(issues, code, path, message);
    return false;
  }
  return true;
}

function validateTags(issues: EntityIdentityIssue[], value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    addIssue(issues, "ENTITY_IDENTITY_INVALID_TAG", ["tags"], "tags must be an array of strings.");
    return;
  }

  const tagsValue: readonly unknown[] = value as readonly unknown[];
  const tags: string[] = [];
  for (let index = 0; index < tagsValue.length; index += 1) {
    const tag = tagsValue[index];
    if (typeof tag !== "string" || !TAG_PATTERN.test(tag)) {
      addIssue(issues, "ENTITY_IDENTITY_INVALID_TAG", ["tags", index], "tag is not valid.");
      continue;
    }
    tags.push(tag);
  }

  const uniqueTags = new Set(tags);
  if (uniqueTags.size !== tags.length || !isSorted(tags)) {
    addIssue(
      issues,
      "ENTITY_IDENTITY_INVALID_TAG",
      ["tags"],
      uniqueTags.size !== tags.length ? "tags must be unique." : "tags must be sorted."
    );
  }
}

function validateAlias(issues: EntityIdentityIssue[], canonicalId: string, value: unknown, index: number): void {
  const path: JsonPath = ["aliases", index];
  if (!isRecord(value)) {
    addIssue(issues, "ENTITY_IDENTITY_INVALID_ALIAS", path, "alias must be an object.");
    return;
  }

  for (const key of Object.keys(value)) {
    if (!ALIAS_KEYS.has(key)) {
      addIssue(issues, "ENTITY_IDENTITY_INVALID_ALIAS", [...path, key], "alias contains an unknown field.");
    }
  }

  const aliasId = value.id;
  if (typeof aliasId !== "string" || !ID_PATTERN.test(aliasId)) {
    addIssue(issues, "ENTITY_IDENTITY_INVALID_ALIAS", [...path, "id"], "alias id is invalid.");
  } else if (aliasId === canonicalId) {
    addIssue(issues, "ENTITY_IDENTITY_INVALID_ALIAS", [...path, "id"], "alias id must differ from the canonical id.");
  }

  if (!isAliasReason(value.reason)) {
    addIssue(issues, "ENTITY_IDENTITY_INVALID_ALIAS", [...path, "reason"], "alias reason is invalid.");
  }

  if (!isPositiveInteger(value.sinceSchemaVersion)) {
    addIssue(
      issues,
      "ENTITY_IDENTITY_INVALID_ALIAS",
      [...path, "sinceSchemaVersion"],
      "alias sinceSchemaVersion must be a positive integer."
    );
  }

  if (value.removeAfterSchemaVersion !== undefined && !isPositiveInteger(value.removeAfterSchemaVersion)) {
    addIssue(
      issues,
      "ENTITY_IDENTITY_INVALID_ALIAS",
      [...path, "removeAfterSchemaVersion"],
      "alias removeAfterSchemaVersion must be a positive integer when present."
    );
  }
}

function validateAliases(issues: EntityIdentityIssue[], canonicalId: string, value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    addIssue(issues, "ENTITY_IDENTITY_INVALID_ALIAS", ["aliases"], "aliases must be an array.");
    return;
  }

  const aliasesValue: readonly unknown[] = value as readonly unknown[];
  const aliasIds: string[] = [];
  for (let index = 0; index < aliasesValue.length; index += 1) {
    validateAlias(issues, canonicalId, aliasesValue[index], index);
    const alias = aliasesValue[index];
    if (isRecord(alias) && typeof alias.id === "string" && ID_PATTERN.test(alias.id)) {
      aliasIds.push(alias.id);
    }
  }

  const uniqueAliasIds = new Set(aliasIds);
  if (uniqueAliasIds.size !== aliasIds.length || !isSorted(aliasIds)) {
    addIssue(
      issues,
      "ENTITY_IDENTITY_INVALID_ALIAS",
      ["aliases"],
      uniqueAliasIds.size !== aliasIds.length ? "aliases must be unique." : "aliases must be sorted."
    );
  }
}

function validateProvenance(issues: EntityIdentityIssue[], value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    addIssue(issues, "ENTITY_IDENTITY_INVALID_PROVENANCE", ["provenance"], "provenance must be an object.");
    return;
  }

  for (const key of Object.keys(value)) {
    if (!PROVENANCE_KEYS.has(key)) {
      addIssue(
        issues,
        "ENTITY_IDENTITY_INVALID_PROVENANCE",
        ["provenance", key],
        "provenance contains an unknown field."
      );
    }
  }

  validateOptionalString(
    issues,
    ["provenance", "sourceFile"],
    value.sourceFile,
    SOURCE_FILE_PATTERN,
    "ENTITY_IDENTITY_INVALID_PROVENANCE",
    "sourceFile is invalid."
  );
  validateOptionalString(
    issues,
    ["provenance", "sourceEntityId"],
    value.sourceEntityId,
    ID_PATTERN,
    "ENTITY_IDENTITY_INVALID_PROVENANCE",
    "sourceEntityId is invalid."
  );
  validateOptionalString(
    issues,
    ["provenance", "sourceRevision"],
    value.sourceRevision,
    STABLE_TEXT_PATTERN,
    "ENTITY_IDENTITY_INVALID_PROVENANCE",
    "sourceRevision is invalid."
  );
  if (value.sourceLine !== undefined && !isPositiveInteger(value.sourceLine)) {
    addIssue(
      issues,
      "ENTITY_IDENTITY_INVALID_PROVENANCE",
      ["provenance", "sourceLine"],
      "sourceLine must be a positive integer when present."
    );
  }
  validateOptionalString(
    issues,
    ["provenance", "generatedBy"],
    value.generatedBy,
    STABLE_TEXT_PATTERN,
    "ENTITY_IDENTITY_INVALID_PROVENANCE",
    "generatedBy is invalid."
  );
  validateOptionalString(
    issues,
    ["provenance", "taskId"],
    value.taskId,
    TASK_PATTERN,
    "ENTITY_IDENTITY_INVALID_PROVENANCE",
    "taskId is invalid."
  );
  validateOptionalString(
    issues,
    ["provenance", "commit"],
    value.commit,
    COMMIT_PATTERN,
    "ENTITY_IDENTITY_INVALID_PROVENANCE",
    "commit is invalid."
  );
  validateOptionalString(
    issues,
    ["provenance", "approvalState"],
    value.approvalState,
    /^(draft|ai-draft|human-edited|approved|canonical)$/u,
    "ENTITY_IDENTITY_INVALID_PROVENANCE",
    "approvalState is invalid."
  );
}

function validateChange(issues: EntityIdentityIssue[], value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    addIssue(issues, "ENTITY_IDENTITY_INVALID_CHANGE", ["change"], "change must be an object.");
    return;
  }

  for (const key of Object.keys(value)) {
    if (!CHANGE_KEYS.has(key)) {
      addIssue(issues, "ENTITY_IDENTITY_INVALID_CHANGE", ["change", key], "change contains an unknown field.");
    }
  }

  if (!isPositiveInteger(value.revision)) {
    addIssue(
      issues,
      "ENTITY_IDENTITY_INVALID_CHANGE",
      ["change", "revision"],
      "change revision must be a positive integer."
    );
  }
  validateOptionalString(
    issues,
    ["change", "createdBy"],
    value.createdBy,
    CHANGE_AUTHOR_PATTERN,
    "ENTITY_IDENTITY_INVALID_CHANGE",
    "createdBy is invalid."
  );
  validateOptionalString(
    issues,
    ["change", "updatedBy"],
    value.updatedBy,
    CHANGE_AUTHOR_PATTERN,
    "ENTITY_IDENTITY_INVALID_CHANGE",
    "updatedBy is invalid."
  );
}

function splitEntityId(value: string): [string, string, string] | null {
  const parts = value.split(".");
  return parts.length === 3 ? [parts[0]!, parts[1]!, parts[2]!] : null;
}

export function inspectEntityIdentity(value: unknown): readonly EntityIdentityIssue[] {
  const issues: EntityIdentityIssue[] = [];

  if (!isRecord(value)) {
    addIssue(issues, "ENTITY_IDENTITY_NOT_OBJECT", [], "entity identity must be a JSON object.");
    mapJsonSafetyIssues(issues, inspectJsonSafety(value));
    return issues;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value));

  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      addIssue(issues, "ENTITY_IDENTITY_UNKNOWN_FIELD", [key], `unknown field "${key}" is not allowed.`);
    }
  }

  if (value.contractVersion === undefined) {
    addIssue(issues, "ENTITY_IDENTITY_MISSING_CONTRACT_VERSION", ["contractVersion"], "contractVersion is required.");
  } else if (value.contractVersion !== CONTRACT_VERSION) {
    addIssue(
      issues,
      "ENTITY_IDENTITY_INVALID_CONTRACT_VERSION",
      ["contractVersion"],
      `contractVersion must be ${CONTRACT_VERSION}.`
    );
  }

  const id = typeof value.id === "string" ? value.id : undefined;
  const entityType = typeof value.entityType === "string" ? value.entityType : undefined;
  const namespace = typeof value.namespace === "string" ? value.namespace : undefined;

  const idIsValid = validateStringValue(
    issues,
    ["id"],
    value.id,
    ID_PATTERN,
    "ENTITY_IDENTITY_MISSING_ID",
    "ENTITY_IDENTITY_INVALID_ID",
    "id is required.",
    "id is invalid."
  );
  const typeIsValid = validateStringValue(
    issues,
    ["entityType"],
    value.entityType,
    ENTITY_TYPE_PATTERN,
    "ENTITY_IDENTITY_MISSING_TYPE",
    "ENTITY_IDENTITY_INVALID_TYPE",
    "entityType is required.",
    "entityType is invalid."
  );
  const namespaceIsValid = validateStringValue(
    issues,
    ["namespace"],
    value.namespace,
    NAMESPACE_PATTERN,
    "ENTITY_IDENTITY_MISSING_NAMESPACE",
    "ENTITY_IDENTITY_INVALID_NAMESPACE",
    "namespace is required.",
    "namespace is invalid."
  );

  if (idIsValid && typeIsValid && id !== undefined && entityType !== undefined) {
    const segments = splitEntityId(id);
    if (segments !== null && segments[0] !== entityType) {
      addIssue(
        issues,
        "ENTITY_IDENTITY_TYPE_MISMATCH",
        ["entityType"],
        "entityType must match the first ID segment."
      );
    }
  }

  if (idIsValid && namespaceIsValid && id !== undefined && namespace !== undefined) {
    const segments = splitEntityId(id);
    if (segments !== null && segments[1] !== namespace) {
      addIssue(
        issues,
        "ENTITY_IDENTITY_NAMESPACE_MISMATCH",
        ["namespace"],
        "namespace must match the second ID segment."
      );
    }
  }

  if (value.schemaVersion === undefined) {
    addIssue(
      issues,
      "ENTITY_IDENTITY_MISSING_SCHEMA_VERSION",
      ["schemaVersion"],
      "schemaVersion is required."
    );
  } else if (!isPositiveInteger(value.schemaVersion)) {
    addIssue(
      issues,
      "ENTITY_IDENTITY_INVALID_SCHEMA_VERSION",
      ["schemaVersion"],
      "schemaVersion must be a positive integer."
    );
  }

  validateTags(issues, value.tags);
  validateAliases(issues, typeof value.id === "string" ? value.id : "", value.aliases);
  validateProvenance(issues, value.provenance);
  validateChange(issues, value.change);

  return issues;
}

export function isEntityIdentity(value: unknown): value is EntityIdentity {
  return inspectEntityIdentity(value).length === 0;
}

export function assertEntityIdentity(value: unknown): asserts value is EntityIdentity {
  const issues = inspectEntityIdentity(value);
  if (issues.length > 0) {
    throw new EntityIdentityValidationError(issues);
  }
}

export function formatEntityIdentityValidationMessage(issues: readonly EntityIdentityIssue[]): string {
  const firstIssue = issues[0];
  if (!firstIssue) {
    return "Entity identity is valid.";
  }
  return `${firstIssue.code} @ ${formatJsonPath(firstIssue.path)}: ${firstIssue.message}`;
}
