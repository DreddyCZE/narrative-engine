import { formatJsonPath, inspectJsonSafety, type JsonPath } from "@narrative-engine/core";

import { inspectEntityIdentity, type EntityIdentityIssue } from "../entity/entity-identity.js";
import { compareSchemaVersions } from "../schema-versioning/schema-versioning.js";

export const ENGINE_STATE_CONTRACT_VERSION = "engine-state@0.1.0" as const;

export type EngineStateDomainAuthority = "engine" | "module" | "game";
export type EngineStatePersistence =
  | "transient"
  | "run"
  | "meta"
  | "snapshot-only"
  | "reconstructable";

export type EngineStateDomain = {
  readonly domainId: string;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly owner: string;
  readonly authority: EngineStateDomainAuthority;
  readonly persistence: EngineStatePersistence;
  readonly data: Record<string, unknown>;
};

export type EngineStateRun = {
  readonly seed?: string;
  readonly activeModules?: readonly string[];
  readonly domains: readonly EngineStateDomain[];
};

export type EngineStateMeta = {
  readonly domains: readonly EngineStateDomain[];
};

export type EngineStateSnapshot = {
  readonly contractVersion: typeof ENGINE_STATE_CONTRACT_VERSION;
  readonly schemaId: "engine-state";
  readonly schemaVersion: number;
  readonly stateId: string;
  readonly revision: number;
  readonly requiredDomains?: readonly string[];
  readonly run: EngineStateRun;
  readonly meta?: EngineStateMeta;
};

export type EngineStateIssueCode =
  | "ENGINE_STATE_NOT_OBJECT"
  | "ENGINE_STATE_NON_JSON_VALUE"
  | "ENGINE_STATE_INVALID_SCHEMA_VERSION"
  | "ENGINE_STATE_MISSING_REVISION"
  | "ENGINE_STATE_INVALID_REVISION"
  | "ENGINE_STATE_MISSING_ENTITIES"
  | "ENGINE_STATE_INVALID_ENTITIES"
  | "ENGINE_STATE_INVALID_ENTITY_IDENTITY"
  | "ENGINE_STATE_DUPLICATE_ENTITY_ID"
  | "ENGINE_STATE_FORBIDDEN_KEY";

export type EngineStateIssue = {
  readonly code: EngineStateIssueCode;
  readonly path: JsonPath;
  readonly message: string;
};

export type EngineStateValidationResult = {
  readonly valid: boolean;
  readonly issues: readonly EngineStateIssue[];
};

const ENGINE_STATE_SCHEMA_ID = "engine-state" as const;
const ROOT_SCHEMA_VERSION = 1;

const TOP_LEVEL_KEYS = new Set([
  "contractVersion",
  "schemaId",
  "schemaVersion",
  "stateId",
  "revision",
  "requiredDomains",
  "run",
  "meta"
]);
const RUN_KEYS = new Set(["seed", "activeModules", "domains"]);
const META_KEYS = new Set(["domains"]);
const DOMAIN_KEYS = new Set(["domainId", "schemaId", "schemaVersion", "owner", "authority", "persistence", "data"]);
const AUTHORITY_VALUES = new Set<EngineStateDomainAuthority>(["engine", "module", "game"]);
const PERSISTENCE_VALUES = new Set<EngineStatePersistence>([
  "transient",
  "run",
  "meta",
  "snapshot-only",
  "reconstructable"
]);
const REFERENCE_KEYS = new Set(["referenceId", "entityId", "sourceEntityId", "targetEntityId", "mainEntityId"]);
const STATE_ID_PATTERN = /^state\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}$/u;
const DOMAIN_ID_PATTERN = /^state-domain\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}$/u;
const ENTITY_ID_PATTERN =
  /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/u;
const MODULE_ID_PATTERN = /^[a-z](?:[a-z0-9]|[._-](?=[a-z0-9])){1,119}$/u;
const OWNER_PATTERN = /^[a-z](?:[a-z0-9]|[._-](?=[a-z0-9])){1,119}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function addIssue(
  issues: EngineStateIssue[],
  code: EngineStateIssueCode,
  path: JsonPath,
  message: string
): void {
  issues.push({ code, path: path.slice(), message });
}

function prefixEntityIssues(
  issues: EngineStateIssue[],
  prefix: JsonPath,
  sourceIssues: readonly EntityIdentityIssue[]
): void {
  for (const issue of sourceIssues) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITY_IDENTITY", [...prefix, ...issue.path], issue.message);
  }
}

function mapJsonSafetyIssues(
  issues: EngineStateIssue[],
  sourceIssues: readonly { code: string; path: JsonPath; message: string }[]
): void {
  for (const issue of sourceIssues) {
    addIssue(
      issues,
      issue.code === "FORBIDDEN_KEY" ? "ENGINE_STATE_FORBIDDEN_KEY" : "ENGINE_STATE_NON_JSON_VALUE",
      issue.path,
      issue.message
    );
  }
}

function validateSortedUniqueStrings(
  issues: EngineStateIssue[],
  value: unknown,
  path: JsonPath,
  code: EngineStateIssueCode,
  message: string,
  pattern?: RegExp
): readonly string[] | null {
  if (!Array.isArray(value)) {
    addIssue(issues, code, path, message);
    return null;
  }

  const items = value as readonly unknown[];
  const strings: string[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (typeof item !== "string" || (pattern !== undefined && !pattern.test(item))) {
      addIssue(issues, code, [...path, index], message);
      return null;
    }
    strings.push(item);
  }

  for (let index = 1; index < strings.length; index += 1) {
    const previous = strings[index - 1];
    const current = strings[index];
    if (previous === undefined || current === undefined || previous > current) {
      addIssue(issues, code, path, message);
      return null;
    }
  }

  if (new Set(strings).size !== strings.length) {
    addIssue(issues, code, path, message);
    return null;
  }

  return strings;
}

function looksLikeEntityIdentity(
  value: unknown
): value is {
  readonly contractVersion: string;
  readonly id: string;
  readonly entityType: string;
  readonly namespace: string;
  readonly schemaVersion: number;
} {
  return (
    isRecord(value) &&
    typeof value.contractVersion === "string" &&
    typeof value.id === "string" &&
    typeof value.entityType === "string" &&
    typeof value.namespace === "string" &&
    "schemaVersion" in value
  );
}

function scanEntityIdentities(
  value: unknown,
  path: JsonPath,
  issues: EngineStateIssue[],
  seen: WeakSet<object>,
  entityIds: Set<string>
): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (looksLikeEntityIdentity(value)) {
    const identityIssues = inspectEntityIdentity(value);
    if (identityIssues.length > 0) {
      prefixEntityIssues(issues, path, identityIssues);
    } else if (entityIds.has(value.id)) {
      addIssue(issues, "ENGINE_STATE_DUPLICATE_ENTITY_ID", [...path, "id"], "entity id must be unique.");
    } else {
      entityIds.add(value.id);
    }
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      scanEntityIdentities(value[index], [...path, index], issues, seen, entityIds);
    }
    return;
  }

  for (const [key, child] of Object.entries(value) as Array<[string, unknown]>) {
    if (REFERENCE_KEYS.has(key)) {
      if (typeof child !== "string" || !ENTITY_ID_PATTERN.test(child)) {
        if (isRecord(child)) {
          prefixEntityIssues(issues, [...path, key], inspectEntityIdentity(child));
        } else {
          addIssue(
            issues,
            "ENGINE_STATE_INVALID_ENTITY_IDENTITY",
            [...path, key],
            "entity references must use canonical Entity Identity IDs."
          );
        }
      }
      continue;
    }

    scanEntityIdentities(child, [...path, key], issues, seen, entityIds);
  }
}

function validateDomain(
  value: unknown,
  path: JsonPath,
  issues: EngineStateIssue[],
  seen: WeakSet<object>,
  entityIds: Set<string>
): string | null {
  if (!isRecord(value)) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", path, "domain must be an object.");
    return null;
  }

  for (const key of Object.keys(value)) {
    if (!DOMAIN_KEYS.has(key)) {
      addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", [...path, key], "domain contains an unknown field.");
    }
  }

  if (typeof value.domainId !== "string" || !DOMAIN_ID_PATTERN.test(value.domainId)) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", [...path, "domainId"], "domainId is invalid.");
  }
  if (typeof value.schemaId !== "string" || !/^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}$/u.test(value.schemaId)) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", [...path, "schemaId"], "schemaId is invalid.");
  }
  if (!isPositiveInteger(value.schemaVersion)) {
    addIssue(issues, "ENGINE_STATE_INVALID_SCHEMA_VERSION", [...path, "schemaVersion"], "schemaVersion is invalid.");
  }
  if (typeof value.owner !== "string" || !OWNER_PATTERN.test(value.owner)) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", [...path, "owner"], "owner is invalid.");
  }
  const authority = value.authority;
  if (typeof authority !== "string" || !AUTHORITY_VALUES.has(authority as EngineStateDomainAuthority)) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", [...path, "authority"], "authority is invalid.");
  }
  const persistence = value.persistence;
  if (typeof persistence !== "string" || !PERSISTENCE_VALUES.has(persistence as EngineStatePersistence)) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", [...path, "persistence"], "persistence is invalid.");
  }
  if (!isRecord(value.data)) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", [...path, "data"], "data must be a JSON object.");
  } else {
    scanEntityIdentities(value.data, [...path, "data"], issues, seen, entityIds);
  }

  if (value.persistence === "transient") {
    addIssue(
      issues,
      "ENGINE_STATE_INVALID_ENTITIES",
      [...path, "persistence"],
      "canonical snapshots must not contain transient domains."
    );
  }

  return typeof value.domainId === "string" ? value.domainId : null;
}

function validateDomainsCollection(
  value: unknown,
  path: JsonPath,
  issues: EngineStateIssue[],
  seen: WeakSet<object>,
  entityIds: Set<string>
): readonly string[] | null {
  if (!Array.isArray(value)) {
    addIssue(issues, "ENGINE_STATE_MISSING_ENTITIES", path, "domains collection is required.");
    return null;
  }

  const domainIds: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const domainId = validateDomain(value[index], [...path, index], issues, seen, entityIds);
    if (domainId !== null) {
      domainIds.push(domainId);
    }
  }

  for (let index = 1; index < domainIds.length; index += 1) {
    const previous = domainIds[index - 1];
    const current = domainIds[index];
    if (previous === undefined || current === undefined || previous > current) {
      addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", path, "domains must be sorted by domainId.");
      break;
    }
  }

  if (new Set(domainIds).size !== domainIds.length) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", path, "domains must not contain duplicate domainIds.");
  }

  return domainIds;
}

function validateRun(
  value: unknown,
  issues: EngineStateIssue[],
  seen: WeakSet<object>,
  entityIds: Set<string>
): readonly string[] | null {
  if (!isRecord(value)) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", ["run"], "run must be an object.");
    return null;
  }

  for (const key of Object.keys(value)) {
    if (!RUN_KEYS.has(key)) {
      addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", ["run", key], "run contains an unknown field.");
    }
  }

  if (value.seed !== undefined && typeof value.seed !== "string") {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", ["run", "seed"], "seed is invalid.");
  }

  validateSortedUniqueStrings(
    issues,
    value.activeModules,
    ["run", "activeModules"],
    "ENGINE_STATE_INVALID_ENTITIES",
    "activeModules must be a sorted array of unique module identifiers.",
    MODULE_ID_PATTERN
  );

  return validateDomainsCollection(value.domains, ["run", "domains"], issues, seen, entityIds);
}

function validateMeta(
  value: unknown,
  issues: EngineStateIssue[],
  seen: WeakSet<object>,
  entityIds: Set<string>
): readonly string[] | null {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", ["meta"], "meta must be an object when present.");
    return null;
  }

  for (const key of Object.keys(value)) {
    if (!META_KEYS.has(key)) {
      addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", ["meta", key], "meta contains an unknown field.");
    }
  }

  return validateDomainsCollection(value.domains, ["meta", "domains"], issues, seen, entityIds);
}

function validateRequiredDomains(
  value: unknown,
  issues: EngineStateIssue[],
  knownDomainIds: Set<string>
): readonly string[] | null {
  if (value === undefined) {
    return [];
  }

  const domains = validateSortedUniqueStrings(
    issues,
    value,
    ["requiredDomains"],
    "ENGINE_STATE_INVALID_ENTITIES",
    "requiredDomains must be a sorted array of unique domain identifiers.",
    DOMAIN_ID_PATTERN
  );
  if (domains === null) {
    return null;
  }

  for (const domainId of domains) {
    if (!knownDomainIds.has(domainId)) {
      addIssue(
        issues,
        "ENGINE_STATE_INVALID_ENTITIES",
        ["requiredDomains"],
        `required domain "${domainId}" is missing from run or meta domains.`
      );
    }
  }

  return domains;
}

export function inspectEngineStateSnapshot(value: unknown): readonly EngineStateIssue[] {
  const issues: EngineStateIssue[] = [];

  if (!isRecord(value)) {
    addIssue(issues, "ENGINE_STATE_NOT_OBJECT", [], "engine state snapshot must be a JSON object.");
    mapJsonSafetyIssues(issues, inspectJsonSafety(value));
    return issues;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value));

  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", [key], "engine state contains an unknown field.");
    }
  }

  if (value.contractVersion !== ENGINE_STATE_CONTRACT_VERSION) {
    addIssue(
      issues,
      "ENGINE_STATE_INVALID_SCHEMA_VERSION",
      ["contractVersion"],
      `contractVersion must be ${ENGINE_STATE_CONTRACT_VERSION}.`
    );
  }

  if (value.schemaId !== ENGINE_STATE_SCHEMA_ID) {
    addIssue(
      issues,
      "ENGINE_STATE_INVALID_SCHEMA_VERSION",
      ["schemaId"],
      `schemaId must be ${ENGINE_STATE_SCHEMA_ID}.`
    );
  }

  if (!isPositiveInteger(value.schemaVersion) || compareSchemaVersions(value.schemaVersion, ROOT_SCHEMA_VERSION) !== 0) {
    addIssue(
      issues,
      "ENGINE_STATE_INVALID_SCHEMA_VERSION",
      ["schemaVersion"],
      "schemaVersion must be 1."
    );
  }

  if (typeof value.stateId !== "string" || !STATE_ID_PATTERN.test(value.stateId)) {
    addIssue(issues, "ENGINE_STATE_INVALID_ENTITIES", ["stateId"], "stateId is invalid.");
  }

  if (value.revision === undefined) {
    addIssue(issues, "ENGINE_STATE_MISSING_REVISION", ["revision"], "revision is required.");
  } else if (!isNonNegativeInteger(value.revision)) {
    addIssue(issues, "ENGINE_STATE_INVALID_REVISION", ["revision"], "revision is invalid.");
  }

  const seen = new WeakSet<object>();
  const entityIds = new Set<string>();
  const runDomains = validateRun(value.run, issues, seen, entityIds);
  const metaDomains = validateMeta(value.meta, issues, seen, entityIds);
  const knownDomainIds = new Set<string>([
    ...(runDomains ?? []),
    ...(metaDomains ?? [])
  ]);

  validateRequiredDomains(value.requiredDomains, issues, knownDomainIds);

  scanEntityIdentities(value.run, ["run"], issues, seen, entityIds);
  scanEntityIdentities(value.meta, ["meta"], issues, seen, entityIds);

  return issues;
}

export function validateEngineStateSnapshot(value: unknown): EngineStateValidationResult {
  const issues = inspectEngineStateSnapshot(value);
  return {
    valid: issues.length === 0,
    issues
  };
}

export function isEngineStateSnapshot(value: unknown): value is EngineStateSnapshot {
  return inspectEngineStateSnapshot(value).length === 0;
}

export function assertEngineStateSnapshot(value: unknown): asserts value is EngineStateSnapshot {
  const issues = inspectEngineStateSnapshot(value);
  if (issues.length > 0) {
    throw new Error(formatEngineStateValidationMessage(issues));
  }
}

export function formatEngineStateValidationMessage(issues: readonly EngineStateIssue[]): string {
  const firstIssue = issues[0];
  if (!firstIssue) {
    return "Engine state snapshot is valid.";
  }
  return `${firstIssue.code} @ ${formatJsonPath(firstIssue.path)}: ${firstIssue.message}`;
}
