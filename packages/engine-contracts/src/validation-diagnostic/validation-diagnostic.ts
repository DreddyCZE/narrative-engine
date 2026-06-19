import {
  canonicalizeJson,
  formatJsonPath,
  inspectJsonSafety,
  type JsonPath,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import { type EngineStateIssue } from "../engine-state/engine-state.js";
import { type EntityIdentityIssue } from "../entity/entity-identity.js";
import { type SchemaVersionIssue } from "../schema-versioning/schema-versioning.js";

export const VALIDATION_DIAGNOSTIC_CONTRACT_VERSION = "validation-diagnostic@0.1.0" as const;
export const VALIDATION_DIAGNOSTIC_SCHEMA_ID = "validation-diagnostic" as const;
export const VALIDATION_DIAGNOSTIC_SCHEMA_VERSION = 1 as const;

export type ValidationDiagnosticSeverity = "info" | "warning" | "error" | "fatal";

export type ValidationDiagnosticCategory =
  | "shape"
  | "schema"
  | "identity"
  | "reference"
  | "type"
  | "validation"
  | "state"
  | "condition"
  | "effect"
  | "command"
  | "transaction"
  | "event"
  | "concurrency"
  | "authorization"
  | "security"
  | "budget"
  | "serialization"
  | "migration"
  | "internal";

export type ValidationDiagnosticPhase = string;

export type ValidationDiagnosticSource = {
  readonly kind: string;
  readonly id: string;
  readonly path?: JsonPath;
  readonly contractVersion?: string;
};

export type ValidationDiagnostic = {
  readonly contractVersion: typeof VALIDATION_DIAGNOSTIC_CONTRACT_VERSION;
  readonly schemaId: typeof VALIDATION_DIAGNOSTIC_SCHEMA_ID;
  readonly schemaVersion: typeof VALIDATION_DIAGNOSTIC_SCHEMA_VERSION;
  readonly ownerContract?: string;
  readonly code: string;
  readonly severity: ValidationDiagnosticSeverity;
  readonly category: ValidationDiagnosticCategory;
  readonly phase: ValidationDiagnosticPhase;
  readonly path: JsonPath;
  readonly message: string;
  readonly source?: ValidationDiagnosticSource;
  readonly details?: JsonValue;
};

export type ValidationDiagnosticInput = {
  readonly ownerContract?: string;
  readonly code: string;
  readonly severity?: ValidationDiagnosticSeverity;
  readonly category?: ValidationDiagnosticCategory;
  readonly phase?: ValidationDiagnosticPhase;
  readonly path: readonly JsonPathSegment[];
  readonly message: string;
  readonly source?: ValidationDiagnosticSource;
  readonly details?: unknown;
};

export type ValidationDiagnosticIssueCode =
  | "INVALID_DIAGNOSTIC_SHAPE"
  | "INVALID_DIAGNOSTIC_CODE"
  | "INVALID_SEVERITY"
  | "INVALID_CATEGORY"
  | "INVALID_PHASE"
  | "INVALID_LOCATION"
  | "INVALID_SOURCE_REFERENCE"
  | "UNSAFE_DIAGNOSTIC_VALUE"
  | "DIAGNOSTIC_REFERENCE_CYCLE";

export type ValidationDiagnosticIssue = {
  readonly code: ValidationDiagnosticIssueCode;
  readonly path: JsonPath;
  readonly message: string;
};

export class ValidationDiagnosticValidationError extends TypeError {
  public readonly issues: readonly ValidationDiagnosticIssue[];

  public constructor(issues: readonly ValidationDiagnosticIssue[]) {
    super(formatValidationDiagnosticMessage(issues));
    this.name = "ValidationDiagnosticValidationError";
    this.issues = issues;
  }
}

export type ValidationDiagnosticAdapterOptions = {
  readonly ownerContract?: string;
  readonly source?: ValidationDiagnosticSource;
};

const TOP_LEVEL_KEYS = new Set([
  "contractVersion",
  "schemaId",
  "schemaVersion",
  "ownerContract",
  "code",
  "severity",
  "category",
  "phase",
  "path",
  "message",
  "source",
  "details"
]);

const CATEGORY_VALUES = new Set<ValidationDiagnosticCategory>([
  "shape",
  "schema",
  "identity",
  "reference",
  "type",
  "validation",
  "state",
  "condition",
  "effect",
  "command",
  "transaction",
  "event",
  "concurrency",
  "authorization",
  "security",
  "budget",
  "serialization",
  "migration",
  "internal"
]);

const SEVERITY_VALUES = new Set<ValidationDiagnosticSeverity>(["info", "warning", "error", "fatal"]);
const CONTRACT_VERSION_PATTERN = new RegExp(
  "^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}@[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-z0-9.-]+)?$",
  "u"
);
const CODE_PATTERN = new RegExp("^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$", "u");
const PHASE_PATTERN = new RegExp("^[a-z][a-z0-9._-]*$", "u");
const SOURCE_KIND_PATTERN = new RegExp("^[a-z][a-z0-9._-]*$", "u");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isJsonPath(value: unknown): value is JsonPath {
  return (
    Array.isArray(value) &&
    value.every((segment) => typeof segment === "string" || isNonNegativeInteger(segment))
  );
}

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function cloneSource(value: ValidationDiagnosticSource | undefined): ValidationDiagnosticSource | undefined {
  if (value === undefined) {
    return undefined;
  }

  return cloneJsonValue(value);
}

function addIssue(
  issues: ValidationDiagnosticIssue[],
  code: ValidationDiagnosticIssueCode,
  path: JsonPath,
  message: string
): void {
  issues.push({
    code,
    path: path.slice(),
    message
  });
}

function mapJsonSafetyIssues(
  issues: ValidationDiagnosticIssue[],
  sourceIssues: ReturnType<typeof inspectJsonSafety>,
  prefix: JsonPath = []
): void {
  for (const issue of sourceIssues) {
    addIssue(
      issues,
      issue.code === "CYCLIC_VALUE" ? "DIAGNOSTIC_REFERENCE_CYCLE" : "UNSAFE_DIAGNOSTIC_VALUE",
      [...prefix, ...issue.path],
      issue.message
    );
  }
}

function validateContractVersion(value: unknown, issues: ValidationDiagnosticIssue[]): boolean {
  if (typeof value !== "string") {
    addIssue(
      issues,
      "INVALID_DIAGNOSTIC_SHAPE",
      ["contractVersion"],
      "contractVersion is required."
    );
    return false;
  }
  if (value !== VALIDATION_DIAGNOSTIC_CONTRACT_VERSION) {
    addIssue(
      issues,
      "INVALID_DIAGNOSTIC_SHAPE",
      ["contractVersion"],
      `contractVersion must be ${VALIDATION_DIAGNOSTIC_CONTRACT_VERSION}.`
    );
    return false;
  }
  return true;
}

function validateSchemaId(value: unknown, issues: ValidationDiagnosticIssue[]): boolean {
  if (value !== VALIDATION_DIAGNOSTIC_SCHEMA_ID) {
    addIssue(
      issues,
      "INVALID_DIAGNOSTIC_SHAPE",
      ["schemaId"],
      `schemaId must be ${VALIDATION_DIAGNOSTIC_SCHEMA_ID}.`
    );
    return false;
  }
  return true;
}

function validateSchemaVersion(value: unknown, issues: ValidationDiagnosticIssue[]): boolean {
  if (value !== VALIDATION_DIAGNOSTIC_SCHEMA_VERSION) {
    addIssue(
      issues,
      "INVALID_DIAGNOSTIC_SHAPE",
      ["schemaVersion"],
      `schemaVersion must be ${String(VALIDATION_DIAGNOSTIC_SCHEMA_VERSION)}.`
    );
    return false;
  }
  return true;
}

function validateOwnerContract(value: unknown, issues: ValidationDiagnosticIssue[]): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "string" || !CONTRACT_VERSION_PATTERN.test(value)) {
    addIssue(
      issues,
      "INVALID_DIAGNOSTIC_SHAPE",
      ["ownerContract"],
      "ownerContract is invalid."
    );
  }
}

function validateCode(value: unknown, issues: ValidationDiagnosticIssue[]): void {
  if (typeof value !== "string" || !CODE_PATTERN.test(value)) {
    addIssue(issues, "INVALID_DIAGNOSTIC_CODE", ["code"], "code is invalid.");
  }
}

function validateSeverity(value: unknown, issues: ValidationDiagnosticIssue[]): void {
  if (typeof value !== "string" || !SEVERITY_VALUES.has(value as ValidationDiagnosticSeverity)) {
    addIssue(issues, "INVALID_SEVERITY", ["severity"], "severity is invalid.");
  }
}

function validateCategory(value: unknown, issues: ValidationDiagnosticIssue[]): void {
  if (typeof value !== "string" || !CATEGORY_VALUES.has(value as ValidationDiagnosticCategory)) {
    addIssue(issues, "INVALID_CATEGORY", ["category"], "category is invalid.");
  }
}

function validatePhase(value: unknown, issues: ValidationDiagnosticIssue[]): void {
  if (typeof value !== "string" || !PHASE_PATTERN.test(value)) {
    addIssue(issues, "INVALID_PHASE", ["phase"], "phase is invalid.");
  }
}

function validatePath(value: unknown, issues: ValidationDiagnosticIssue[]): value is JsonPath {
  if (!isJsonPath(value)) {
    addIssue(issues, "INVALID_LOCATION", ["path"], "path is invalid.");
    return false;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value), ["path"]);
  return issues.every((issue) => issue.code !== "INVALID_LOCATION" || issue.path[0] !== "path");
}

function validateSource(value: unknown, issues: ValidationDiagnosticIssue[]): value is ValidationDiagnosticSource {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value)) {
    addIssue(issues, "INVALID_SOURCE_REFERENCE", ["source"], "source must be an object.");
    return false;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value), ["source"]);

  for (const key of Object.keys(value)) {
    if (!new Set(["kind", "id", "path"]).has(key)) {
      addIssue(issues, "INVALID_SOURCE_REFERENCE", ["source", key], "source contains an unknown field.");
    }
  }

  if (typeof value.kind !== "string" || !SOURCE_KIND_PATTERN.test(value.kind)) {
    addIssue(issues, "INVALID_SOURCE_REFERENCE", ["source", "kind"], "source.kind is invalid.");
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    addIssue(issues, "INVALID_SOURCE_REFERENCE", ["source", "id"], "source.id is invalid.");
  }

  if (value.path !== undefined && !isJsonPath(value.path)) {
    addIssue(issues, "INVALID_SOURCE_REFERENCE", ["source", "path"], "source.path is invalid.");
  }

  return issues.filter((issue) => issue.path[0] === "source").length === 0;
}

function validateDetails(value: unknown, issues: ValidationDiagnosticIssue[]): value is JsonValue | undefined {
  if (value === undefined) {
    return true;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value), ["details"]);
  return inspectJsonSafety(value).length === 0;
}

function validateUnknownFields(value: Record<string, unknown>, issues: ValidationDiagnosticIssue[]): void {
  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      addIssue(issues, "INVALID_DIAGNOSTIC_SHAPE", [key], `unknown field "${key}" is not allowed.`);
    }
  }
}

function validateDiagnosticInput(value: unknown): ValidationDiagnosticIssue[] {
  const issues: ValidationDiagnosticIssue[] = [];

  if (!isRecord(value)) {
    addIssue(issues, "INVALID_DIAGNOSTIC_SHAPE", [], "diagnostic must be a JSON object.");
    mapJsonSafetyIssues(issues, inspectJsonSafety(value));
    return issues;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value));
  validateUnknownFields(value, issues);
  validateContractVersion(value.contractVersion, issues);
  validateSchemaId(value.schemaId, issues);
  validateSchemaVersion(value.schemaVersion, issues);
  validateOwnerContract(value.ownerContract, issues);
  validateCode(value.code, issues);
  validateSeverity(value.severity, issues);
  validateCategory(value.category, issues);
  validatePhase(value.phase, issues);
  validatePath(value.path, issues);

  if (typeof value.message !== "string" || value.message.length === 0) {
    addIssue(issues, "INVALID_DIAGNOSTIC_SHAPE", ["message"], "message is required.");
  }

  validateSource(value.source, issues);
  validateDetails(value.details, issues);

  return issues;
}

function buildCandidate(input: ValidationDiagnosticInput): ValidationDiagnostic {
  return {
    contractVersion: VALIDATION_DIAGNOSTIC_CONTRACT_VERSION,
    schemaId: VALIDATION_DIAGNOSTIC_SCHEMA_ID,
    schemaVersion: VALIDATION_DIAGNOSTIC_SCHEMA_VERSION,
    code: input.code,
    severity: input.severity ?? "error",
    category: input.category ?? "validation",
    phase: input.phase ?? "semantic-validation",
    path: [...input.path],
    message: input.message,
    ...(input.ownerContract === undefined ? {} : { ownerContract: input.ownerContract }),
    ...(input.source === undefined ? {} : { source: input.source }),
    ...(input.details === undefined ? {} : { details: input.details as JsonValue })
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

    const comparison = String(leftSegment).localeCompare(String(rightSegment));
    if (comparison !== 0) {
      return comparison;
    }
  }

  return left.length - right.length;
}

function severityRank(value: ValidationDiagnosticSeverity): number {
  switch (value) {
    case "fatal":
      return 4;
    case "error":
      return 3;
    case "warning":
      return 2;
    case "info":
      return 1;
  }
}

function compareDiagnostics(left: ValidationDiagnostic, right: ValidationDiagnostic): number {
  const pathComparison = comparePath(left.path, right.path);
  if (pathComparison !== 0) {
    return pathComparison;
  }

  const codeComparison = left.code.localeCompare(right.code);
  if (codeComparison !== 0) {
    return codeComparison;
  }

  const severityComparison = severityRank(right.severity) - severityRank(left.severity);
  if (severityComparison !== 0) {
    return severityComparison;
  }

  const categoryComparison = left.category.localeCompare(right.category);
  if (categoryComparison !== 0) {
    return categoryComparison;
  }

  const phaseComparison = left.phase.localeCompare(right.phase);
  if (phaseComparison !== 0) {
    return phaseComparison;
  }

  const ownerComparison = (left.ownerContract ?? "").localeCompare(right.ownerContract ?? "");
  if (ownerComparison !== 0) {
    return ownerComparison;
  }

  const messageComparison = left.message.localeCompare(right.message);
  if (messageComparison !== 0) {
    return messageComparison;
  }

  return 0;
}

function buildDiagnosticFromIssue(
  issue: { readonly code: string; readonly path: JsonPath; readonly message: string },
  options: ValidationDiagnosticAdapterOptions,
  defaults: {
    readonly ownerContract: string;
    readonly category: ValidationDiagnosticCategory;
    readonly phase: ValidationDiagnosticPhase;
    readonly source: ValidationDiagnosticSource;
  }
): ValidationDiagnostic {
  const ownerContract = options.ownerContract ?? defaults.ownerContract;
  const source = cloneSource(options.source ?? defaults.source) ?? defaults.source;

  return {
    contractVersion: VALIDATION_DIAGNOSTIC_CONTRACT_VERSION,
    schemaId: VALIDATION_DIAGNOSTIC_SCHEMA_ID,
    schemaVersion: VALIDATION_DIAGNOSTIC_SCHEMA_VERSION,
    code: issue.code,
    severity: "error",
    category: defaults.category,
    phase: defaults.phase,
    path: issue.path.slice(),
    message: issue.message,
    ownerContract,
    source
  };
}

export function inspectValidationDiagnostic(value: unknown): readonly ValidationDiagnosticIssue[] {
  return validateDiagnosticInput(value);
}

export function createValidationDiagnostic(input: ValidationDiagnosticInput): ValidationDiagnostic {
  const candidate = buildCandidate(input);
  const issues = validateDiagnosticInput(candidate);
  if (issues.length > 0) {
    throw new ValidationDiagnosticValidationError(issues);
  }

  const source = candidate.source === undefined ? undefined : cloneJsonValue(candidate.source);
  const details = candidate.details === undefined ? undefined : cloneJsonValue(candidate.details);

  return {
    ...candidate,
    ...(source === undefined ? {} : { source }),
    ...(details === undefined ? {} : { details })
  };
}

export function isValidationDiagnostic(value: unknown): value is ValidationDiagnostic {
  return inspectValidationDiagnostic(value).length === 0;
}

export function assertValidationDiagnostic(value: unknown): asserts value is ValidationDiagnostic {
  const issues = inspectValidationDiagnostic(value);
  if (issues.length > 0) {
    throw new ValidationDiagnosticValidationError(issues);
  }
}

export function normalizeValidationDiagnostics(
  diagnostics: readonly ValidationDiagnosticInput[]
): readonly ValidationDiagnostic[] {
  const normalized = diagnostics.map((diagnostic) => createValidationDiagnostic(diagnostic));
  return sortValidationDiagnostics(normalized);
}

export function sortValidationDiagnostics(
  diagnostics: readonly ValidationDiagnostic[]
): readonly ValidationDiagnostic[] {
  return diagnostics
    .map((diagnostic, index) => ({ diagnostic, index }))
    .sort((left, right) => {
      const comparison = compareDiagnostics(left.diagnostic, right.diagnostic);
      return comparison !== 0 ? comparison : left.index - right.index;
    })
    .map(({ diagnostic }) => diagnostic);
}

export function formatValidationDiagnostic(diagnostic: ValidationDiagnostic): string {
  return `${diagnostic.code} @ ${formatJsonPath(diagnostic.path)}: ${diagnostic.message}`;
}

export function formatValidationDiagnosticMessage(issues: readonly ValidationDiagnosticIssue[]): string {
  const firstIssue = issues[0];
  if (firstIssue === undefined) {
    return "Validation diagnostic is valid.";
  }

  return `${firstIssue.code} @ ${formatJsonPath(firstIssue.path)}: ${firstIssue.message}`;
}

export function adaptJsonSafetyIssues(
  issues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string }[],
  options: ValidationDiagnosticAdapterOptions = {}
): readonly ValidationDiagnostic[] {
  return sortValidationDiagnostics(
    issues.map((issue) =>
      buildDiagnosticFromIssue(issue, options, {
        ownerContract: VALIDATION_DIAGNOSTIC_CONTRACT_VERSION,
        category: issue.code === "FORBIDDEN_KEY" ? "security" : "serialization",
        phase: "pre-serialization",
        source: { kind: "system", id: "json-safe" }
      })
    )
  );
}

function entityCategoryForCode(code: string): ValidationDiagnosticCategory {
  if (code.includes("CONTRACT_VERSION") || code.includes("SCHEMA_VERSION") || code.includes("ALIAS")) {
    return "schema";
  }
  if (code.includes("TYPE") || code.includes("NAMESPACE") || code.includes("ID")) {
    return "identity";
  }
  if (code.includes("REFERENCE")) {
    return "reference";
  }
  if (code.includes("PROVENANCE") || code.includes("CHANGE")) {
    return "validation";
  }
  if (code.includes("FORBIDDEN_KEY") || code.includes("NON_JSON_VALUE")) {
    return "security";
  }
  return "identity";
}

function entityPhaseForCode(code: string): ValidationDiagnosticPhase {
  if (
    code.includes("CONTRACT_VERSION") ||
    code.includes("SCHEMA_VERSION") ||
    code.includes("ALIAS") ||
    code.includes("PROVENANCE") ||
    code.includes("CHANGE")
  ) {
    return "schema-validation";
  }

  if (code.includes("FORBIDDEN_KEY") || code.includes("NON_JSON_VALUE")) {
    return "pre-serialization";
  }

  return "identity-validation";
}

function schemaCategoryForCode(code: string): ValidationDiagnosticCategory {
  if (code.includes("MIGRATION")) {
    return "migration";
  }
  return "schema";
}

function stateCategoryForCode(code: string): ValidationDiagnosticCategory {
  if (code.includes("SCHEMA")) {
    return "schema";
  }
  if (code.includes("ENTITY_IDENTITY") || code.includes("REFERENCE")) {
    return "reference";
  }
  if (code.includes("REVISION")) {
    return "concurrency";
  }
  if (code.includes("FORBIDDEN_KEY") || code.includes("NON_JSON_VALUE")) {
    return "security";
  }
  if (code.includes("NON_JSON")) {
    return "serialization";
  }
  return "state";
}

export function adaptEntityIdentityIssues(
  issues: readonly EntityIdentityIssue[],
  options: ValidationDiagnosticAdapterOptions = {}
): readonly ValidationDiagnostic[] {
  return sortValidationDiagnostics(
    issues.map((issue) =>
      buildDiagnosticFromIssue(issue, options, {
        ownerContract: options.ownerContract ?? "entity-identity@0.1.0",
        category: entityCategoryForCode(issue.code),
        phase: entityPhaseForCode(issue.code),
        source: { kind: "entity-identity", id: "validator" }
      })
    )
  );
}

export function adaptSchemaVersioningIssues(
  issues: readonly SchemaVersionIssue[],
  options: ValidationDiagnosticAdapterOptions = {}
): readonly ValidationDiagnostic[] {
  return sortValidationDiagnostics(
    issues.map((issue) =>
      buildDiagnosticFromIssue(issue, options, {
        ownerContract: options.ownerContract ?? "schema-versioning@0.1.0",
        category: schemaCategoryForCode(issue.code),
        phase: "schema-validation",
        source: { kind: "schema-versioning", id: "validator" }
      })
    )
  );
}

export function adaptEngineStateIssues(
  issues: readonly EngineStateIssue[],
  options: ValidationDiagnosticAdapterOptions = {}
): readonly ValidationDiagnostic[] {
  return sortValidationDiagnostics(
    issues.map((issue) =>
      buildDiagnosticFromIssue(issue, options, {
        ownerContract: options.ownerContract ?? "engine-state@0.1.0",
        category: stateCategoryForCode(issue.code),
        phase: issue.code.includes("REVISION")
          ? "final-revision-check"
          : issue.code.includes("SCHEMA")
            ? "schema-validation"
            : issue.code.includes("ENTITY")
              ? "identity-validation"
              : issue.code.includes("REFERENCE")
                ? "reference-validation"
                : "shape-validation",
        source: { kind: "engine-state", id: "validator" }
      })
    )
  );
}
