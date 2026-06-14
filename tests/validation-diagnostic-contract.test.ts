import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeInvalidCases } from "./fixtures/contracts/validation-diagnostic/runtime-invalid/runtime-invalid";

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type DiagnosticValue =
  | { kind: "value"; value: JsonValue }
  | { kind: "redacted"; reason: "sensitive" | "too-large" | "not-serializable" | "security-policy" | "unsupported" };

type Location =
  | { kind: "document"; path: string }
  | { kind: "state"; domainId: string; path: string }
  | { kind: "schema"; schemaId: string; path: string }
  | { kind: "event"; transactionId: string; revision: number; sequence: number; path?: string }
  | { kind: "batch"; transactionId: string; previousRevision: number; revision: number; index?: number };

type Reference =
  | {
      relation?: string;
      kind: string;
      id?: string;
      domainId?: string;
      schemaId?: string;
      path?: string;
      index?: number;
    }
  | {
      relation: string;
      kind: string;
      id?: string;
      domainId?: string;
      schemaId?: string;
      path?: string;
      index?: number;
    };

type DiagnosticEnvelope = {
  contractVersion: string;
  schemaId: string;
  schemaVersion: number;
  ownerContract?: string;
  diagnosticId?: string;
  code: string;
  severity: "info" | "warning" | "error" | "fatal";
  category: string;
  phase: string;
  message: string;
  location?: Location;
  source?: Reference;
  related?: Reference[];
  expected?: DiagnosticValue;
  actual?: DiagnosticValue;
  metadata?: Record<string, JsonValue>;
};

type AggregateEnvelope = {
  contractVersion: string;
  schemaId: string;
  schemaVersion: number;
  status: "valid" | "valid-with-warnings" | "invalid" | "fatal";
  diagnostics: DiagnosticEnvelope[];
};

type ValidationIssue = {
  code: string;
  severity: "info" | "warning" | "error" | "fatal";
  category: string;
  phase: string;
  message: string;
  path?: string;
};

const contractVersion = "validation-diagnostic@0.1.0";
const schemaId = "validation-diagnostic";
const diagnosticIdPattern = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/;
const codePattern = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const phasePattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;
const jsonPointerPattern = /^(?:$|(?:\/(?:[^~/]|~0|~1)+)+)$/;
const forbiddenObjectKeys = new Set(["__proto__", "prototype", "constructor"]);
const fixtureRoot = resolve("tests/fixtures/contracts/validation-diagnostic");
const maxRuntimeMessageLength = 160;
const maxRuntimeRelatedReferences = 8;
const maxRuntimeDiagnostics = 8;

const codeRegistry = new Map<string, { severity: ValidationIssue["severity"]; category: string; phase: string }>([
  ["INVALID_DIAGNOSTIC_SHAPE", { severity: "error", category: "shape", phase: "shape-validation" }],
  ["INVALID_DIAGNOSTIC_ID", { severity: "error", category: "identity", phase: "identity-validation" }],
  ["INVALID_DIAGNOSTIC_CODE", { severity: "error", category: "schema", phase: "schema-validation" }],
  ["NOTE", { severity: "info", category: "validation", phase: "explain" }],
  ["INVALID_SEVERITY", { severity: "error", category: "schema", phase: "schema-validation" }],
  ["INVALID_CATEGORY", { severity: "error", category: "schema", phase: "schema-validation" }],
  ["INVALID_PHASE", { severity: "error", category: "schema", phase: "schema-validation" }],
  ["INVALID_LOCATION", { severity: "error", category: "reference", phase: "reference-validation" }],
  ["INVALID_SOURCE_REFERENCE", { severity: "error", category: "reference", phase: "reference-validation" }],
  ["INVALID_RELATED_REFERENCE", { severity: "error", category: "reference", phase: "reference-validation" }],
  ["UNSAFE_DIAGNOSTIC_VALUE", { severity: "error", category: "security", phase: "semantic-validation" }],
  ["DIAGNOSTIC_BUDGET_EXCEEDED", { severity: "error", category: "budget", phase: "validation" }],
  ["DIAGNOSTIC_OUTPUT_TRUNCATED", { severity: "warning", category: "budget", phase: "validation" }],
  ["DUPLICATE_DIAGNOSTIC_FINGERPRINT", { severity: "error", category: "validation", phase: "semantic-validation" }],
  ["DIAGNOSTIC_REFERENCE_CYCLE", { severity: "error", category: "reference", phase: "semantic-validation" }],
  ["INVALID_AGGREGATE_STATUS", { severity: "error", category: "validation", phase: "semantic-validation" }],
  ["VALIDATION_NOTE", { severity: "info", category: "validation", phase: "explain" }],
  ["VALIDATION_DEPRECATED_USAGE", { severity: "warning", category: "validation", phase: "authoring" }],
  ["INVALID_EFFECT_SHAPE", { severity: "error", category: "shape", phase: "shape-validation" }],
  ["INVALID_STATE_SHAPE", { severity: "error", category: "shape", phase: "shape-validation" }],
  ["REVISION_CONFLICT", { severity: "error", category: "concurrency", phase: "final-revision-check" }],
  ["ACCESS_DENIED", { severity: "error", category: "authorization", phase: "authorization" }],
  ["INVALID_COMMAND_SHAPE", { severity: "error", category: "shape", phase: "shape-validation" }],
  ["INVALID_TARGET", { severity: "error", category: "reference", phase: "reference-validation" }],
  ["INVALID_EVENT_SHAPE", { severity: "error", category: "shape", phase: "shape-validation" }],
  ["ATOMICITY_VIOLATION", { severity: "fatal", category: "internal", phase: "commit" }]
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const sorted: Record<string, JsonValue> = {};
  for (const key of Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    sorted[key] = sortJson((value as Record<string, JsonValue>)[key]);
  }
  return sorted;
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortJson(value as JsonValue), null, 2) + "\n";
}

function isJsonValue(value: unknown, depth = 0, seen = new Set<unknown>()): value is JsonValue {
  if (depth > 8) {
    return false;
  }
  if (value === null) {
    return true;
  }
  const kind = typeof value;
  if (kind === "boolean" || kind === "string") {
    return kind !== "string" || value.length <= 1024;
  }
  if (kind === "number") {
    return Number.isFinite(value);
  }
  if (kind !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 32) {
      return false;
    }
    return value.every((entry) => isJsonValue(entry, depth + 1, seen));
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  if (Object.keys(value).length > 16) {
    return false;
  }
  return Object.entries(value).every(([key, entry]) => {
    if (forbiddenObjectKeys.has(key)) {
      return false;
    }
    return isJsonValue(entry, depth + 1, seen);
  });
}

function hasForbiddenKey(value: unknown, seen = new Set<unknown>()): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => hasForbiddenKey(entry, seen));
  }
  for (const [key, entry] of Object.entries(value)) {
    if (forbiddenObjectKeys.has(key) || hasForbiddenKey(entry, seen)) {
      return true;
    }
  }
  return false;
}

function isEntityIdentityId(value: unknown): value is string {
  return typeof value === "string" && diagnosticIdPattern.test(value);
}

function isJsonPointer(value: unknown): value is string {
  return typeof value === "string" && value.length <= 512 && jsonPointerPattern.test(value);
}

function readFixture(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureRoot, relativePath), "utf8")) as unknown;
}

const loadFixture = readFixture;

function issue(code: string, path: string | undefined, message: string): ValidationIssue {
  const entry = codeRegistry.get(code) ?? { severity: "error", category: "validation", phase: "semantic-validation" };
  return { code, path, message, severity: entry.severity, category: entry.category, phase: entry.phase };
}

function kindPrefix(kind: string): string | undefined {
  switch (kind) {
    case "transaction":
      return "transaction";
    case "command":
      return "command";
    case "effect":
      return "effect";
    case "domain-event":
      return "domain-event";
    case "state-domain":
      return "state-domain";
    case "schema":
      return "schema";
    case "condition":
      return "condition";
    default:
      return undefined;
  }
}

function validateValueDescriptor(value: unknown, path: string): ValidationIssue[] {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return [issue("INVALID_DIAGNOSTIC_SHAPE", path, "Expected a diagnostic value descriptor.")];
  }
  if (value.kind === "redacted") {
    return typeof value.reason === "string" &&
      ["sensitive", "too-large", "not-serializable", "security-policy", "unsupported"].includes(value.reason)
      ? []
      : [issue("UNSAFE_DIAGNOSTIC_VALUE", path, "Redacted value descriptor is invalid.")];
  }
  if (value.kind !== "value") {
    return [issue("INVALID_DIAGNOSTIC_SHAPE", path, "Unknown value descriptor kind.")];
  }
  if (!("value" in value) || !isJsonValue(value.value) || hasForbiddenKey(value.value)) {
    return [issue("UNSAFE_DIAGNOSTIC_VALUE", path, "Value descriptor contains unsafe data.")];
  }
  return [];
}

function validateReference(value: unknown, path: string, expectedKind?: string): ValidationIssue[] {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return [issue("INVALID_DIAGNOSTIC_SHAPE", path, "Expected a structured reference.")];
  }
  if (expectedKind !== undefined && value.kind !== expectedKind) {
    return [issue("INVALID_SOURCE_REFERENCE", path, "Reference kind does not match the expected kind.")];
  }
  const prefix = kindPrefix(value.kind);
  if (prefix !== undefined && typeof value.id === "string" && !value.id.startsWith(`${prefix}.`)) {
    return [issue("INVALID_SOURCE_REFERENCE", path, "Reference identifier does not match its kind.")];
  }
  if (typeof value.id === "string" && !isEntityIdentityId(value.id)) {
    return [issue("INVALID_SOURCE_REFERENCE", path, "Reference identifier is not a valid entity identity.")];
  }
  if (typeof value.domainId === "string" && !isEntityIdentityId(value.domainId)) {
    return [issue("INVALID_SOURCE_REFERENCE", path, "Reference domainId is not valid.")];
  }
  if (typeof value.schemaId === "string" && value.schemaId.length > 128) {
    return [issue("INVALID_SOURCE_REFERENCE", path, "Reference schemaId is too long.")];
  }
  if (typeof value.path === "string" && !isJsonPointer(value.path)) {
    return [issue("INVALID_LOCATION", path, "Reference path is not a valid JSON Pointer.")];
  }
  if (typeof value.index === "number" && (!Number.isInteger(value.index) || value.index < 0)) {
    return [issue("INVALID_RELATED_REFERENCE", path, "Reference index is invalid.")];
  }
  return [];
}

function validateLocation(value: unknown): ValidationIssue[] {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return [issue("INVALID_LOCATION", "/location", "Location must be a structured object.")];
  }
  switch (value.kind) {
    case "document":
      return typeof value.path === "string" && isJsonPointer(value.path)
        ? []
        : [issue("INVALID_LOCATION", "/location/path", "Document location path is invalid.")];
    case "state":
      return typeof value.domainId === "string" &&
        isEntityIdentityId(value.domainId) &&
        value.domainId.startsWith("state-domain.") &&
        typeof value.path === "string" &&
        isJsonPointer(value.path)
        ? []
        : [issue("INVALID_LOCATION", "/location", "State location is invalid.")];
    case "schema":
      return typeof value.schemaId === "string" &&
        value.schemaId.length > 0 &&
        typeof value.path === "string" &&
        isJsonPointer(value.path)
        ? []
        : [issue("INVALID_LOCATION", "/location", "Schema location is invalid.")];
    case "event":
      return typeof value.transactionId === "string" &&
        isEntityIdentityId(value.transactionId) &&
        typeof value.revision === "number" &&
        Number.isInteger(value.revision) &&
        value.revision >= 0 &&
        typeof value.sequence === "number" &&
        Number.isInteger(value.sequence) &&
        value.sequence >= 0 &&
        (value.path === undefined || (typeof value.path === "string" && isJsonPointer(value.path)))
        ? []
        : [issue("INVALID_LOCATION", "/location", "Event location is invalid.")];
    case "batch":
      return typeof value.transactionId === "string" &&
        isEntityIdentityId(value.transactionId) &&
        typeof value.previousRevision === "number" &&
        Number.isInteger(value.previousRevision) &&
        value.previousRevision >= 0 &&
        typeof value.revision === "number" &&
        Number.isInteger(value.revision) &&
        value.revision >= 0 &&
        (value.index === undefined || (typeof value.index === "number" && Number.isInteger(value.index) && value.index >= 0))
        ? []
        : [issue("INVALID_LOCATION", "/location", "Batch location is invalid.")];
    default:
      return [issue("INVALID_LOCATION", "/location", "Unknown location kind.")];
  }
}

function validateDiagnosticEnvelope(candidate: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    return [issue("INVALID_DIAGNOSTIC_SHAPE", "", "Diagnostic must be a JSON object.")];
  }
  if (hasForbiddenKey(candidate)) {
    return [issue("FORBIDDEN_OBJECT_KEY", "", "Diagnostic contains a forbidden nested key.")];
  }
  if (!isJsonValue(candidate)) {
    return [issue("NON_SERIALIZABLE_VALUE", "", "Diagnostic is not JSON-safe.")];
  }

  const value = candidate as Record<string, unknown>;
  const allowedKeys = new Set([
    "contractVersion",
    "schemaId",
    "schemaVersion",
    "ownerContract",
    "diagnosticId",
    "code",
    "severity",
    "category",
    "phase",
    "message",
    "location",
    "source",
    "related",
    "expected",
    "actual",
    "metadata"
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push(issue("INVALID_DIAGNOSTIC_SHAPE", `/${key}`, "Unknown root field is not allowed."));
    }
  }

  if (value.contractVersion !== contractVersion || value.schemaId !== schemaId || value.schemaVersion !== 1) {
    issues.push(issue("INVALID_DIAGNOSTIC_SHAPE", "/schemaVersion", "Diagnostic envelope version is invalid."));
  }

  if (value.ownerContract !== undefined && (typeof value.ownerContract !== "string" || !/^[a-z][a-z0-9-]*@[0-9]+\.[0-9]+\.[0-9]+$/.test(value.ownerContract))) {
    issues.push(issue("INVALID_DIAGNOSTIC_SHAPE", "/ownerContract", "ownerContract is invalid."));
  }

  if (value.diagnosticId !== undefined && !isEntityIdentityId(value.diagnosticId)) {
    issues.push(issue("INVALID_DIAGNOSTIC_ID", "/diagnosticId", "diagnosticId is not a valid entity identity."));
  }

  if (typeof value.code !== "string" || !codePattern.test(value.code)) {
    issues.push(issue("INVALID_DIAGNOSTIC_CODE", "/code", "Diagnostic code is malformed."));
  } else if (!codeRegistry.has(value.code)) {
    issues.push(issue("INVALID_DIAGNOSTIC_CODE", "/code", "Unknown diagnostic code " + value.code + "."));
  }

  if (typeof value.severity !== "string" || !["info", "warning", "error", "fatal"].includes(value.severity)) {
    issues.push(issue("INVALID_SEVERITY", "/severity", "Severity is invalid."));
  }
  if (typeof value.category !== "string" || ![
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
  ].includes(value.category)) {
    issues.push(issue("INVALID_CATEGORY", "/category", "Category is invalid."));
  }
  if (typeof value.phase !== "string" || !phasePattern.test(value.phase)) {
    issues.push(issue("INVALID_PHASE", "/phase", "Phase is invalid."));
  }
  if (typeof value.message !== "string" || value.message.length < 1) {
    issues.push(issue("INVALID_DIAGNOSTIC_SHAPE", "/message", "Message is required."));
  } else if (value.message.length > maxRuntimeMessageLength) {
    issues.push(issue("DIAGNOSTIC_BUDGET_EXCEEDED", "/message", "Message exceeds the runtime budget."));
  }

  if (value.location !== undefined) {
    issues.push(...validateLocation(value.location));
  }
  if (value.source !== undefined) {
    issues.push(...validateReference(value.source, "/source"));
  }
  if (value.related !== undefined) {
    if (!Array.isArray(value.related)) {
      issues.push(issue("INVALID_RELATED_REFERENCE", "/related", "Related references must be an array."));
    } else {
      if (value.related.length > maxRuntimeRelatedReferences) {
        issues.push(issue("DIAGNOSTIC_BUDGET_EXCEEDED", "/related", "Too many related references."));
      }
      const fingerprints = new Set<string>();
      for (let index = 0; index < value.related.length; index += 1) {
        const relatedIssues = validateReference(value.related[index], "/related/" + String(index));
        issues.push(...relatedIssues);
        const fingerprint = canonicalStringify(value.related[index]);
        if (fingerprints.has(fingerprint)) {
          issues.push(issue("DUPLICATE_DIAGNOSTIC_FINGERPRINT", "/related/" + String(index), "Duplicate related reference detected."));
        }
        fingerprints.add(fingerprint);
      }
    }
  }
  if (value.expected !== undefined) {
    issues.push(...validateValueDescriptor(value.expected, "/expected"));
  }
  if (value.actual !== undefined) {
    issues.push(...validateValueDescriptor(value.actual, "/actual"));
    if (isRecord(value.actual) && value.actual.kind === "value" && isRecord(value.actual.value)) {
      const secretKeys = ["secret", "token", "password", "apiKey"];
      if (Object.keys(value.actual.value).some((key) => secretKeys.includes(key))) {
        issues.push(issue("UNSAFE_DIAGNOSTIC_VALUE", "/actual", "Sensitive actual values must be redacted."));
      }
    }
  }
  if (value.metadata !== undefined) {
    if (!isRecord(value.metadata) || hasForbiddenKey(value.metadata) || !isJsonValue(value.metadata)) {
      issues.push(issue("UNSAFE_DIAGNOSTIC_VALUE", "/metadata", "Metadata is not safe."));
    }
  }

  if (isRecord(value.source) && isRecord(value.location) && value.location.kind === "state" && value.source.kind === "transaction") {
    if (typeof value.source.id === "string" && value.source.id.startsWith("command.")) {
      issues.push(issue("INVALID_SOURCE_REFERENCE", "/source/id", "Source transaction reference is mismatched."));
    }
  }

  if (value.code && value.severity && value.category && value.phase) {
    const registryEntry = codeRegistry.get(value.code);
    if (registryEntry) {
      if (value.severity !== registryEntry.severity) {
        issues.push(issue("INVALID_SEVERITY", "/severity", "Severity does not match the canonical registry."));
      }
      if (value.category !== registryEntry.category) {
        issues.push(issue("INVALID_CATEGORY", "/category", "Category does not match the canonical registry."));
      }
      if (value.phase !== registryEntry.phase) {
        issues.push(issue("INVALID_PHASE", "/phase", "Phase does not match the canonical registry."));
      }
    }
  }

  if (
    isRecord(value.source) &&
    Array.isArray(value.related) &&
    value.related.some(
      (related) =>
        isRecord(related) &&
        related.relation === "causes" &&
        sameReference(value.source as Reference, related as Reference)
    )
  ) {
    issues.push(issue("DIAGNOSTIC_REFERENCE_CYCLE", "/related", "A causal reference cycle was detected."));
  }

  return issues;
}

function aggregateStatusForDiagnostics(diagnostics: DiagnosticEnvelope[]): AggregateEnvelope["status"] {
  if (diagnostics.some((diagnostic) => diagnostic.severity === "fatal")) {
    return "fatal";
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return "invalid";
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
    return "valid-with-warnings";
  }
  return "valid";
}

function fingerprintDiagnostic(diagnostic: DiagnosticEnvelope): string {
  return canonicalStringify({
    ownerContract: diagnostic.ownerContract ?? null,
    code: diagnostic.code,
    severity: diagnostic.severity,
    category: diagnostic.category,
    phase: diagnostic.phase,
    location: diagnostic.location ?? null,
    source: diagnostic.source ?? null,
    related: diagnostic.related ?? null,
    expected: diagnostic.expected ?? null,
    actual: diagnostic.actual ?? null
  });
}

function sameReference(left: Reference | undefined, right: Reference | undefined): boolean {
  if (left === undefined || right === undefined) {
    return false;
  }
  return (
    left.kind === right.kind &&
    left.id === right.id &&
    left.domainId === right.domainId &&
    left.schemaId === right.schemaId &&
    left.path === right.path &&
    left.index === right.index
  );
}

function validateAggregateEnvelope(candidate: unknown): ValidationIssue[] {
  if (!isRecord(candidate)) {
    return [issue("INVALID_DIAGNOSTIC_SHAPE", "", "Aggregate must be an object.")];
  }
  if (candidate.contractVersion !== contractVersion || candidate.schemaId !== schemaId || candidate.schemaVersion !== 1) {
    return [issue("INVALID_DIAGNOSTIC_SHAPE", "/schemaVersion", "Aggregate version is invalid.")];
  }
  if (!Array.isArray(candidate.diagnostics)) {
    return [issue("INVALID_DIAGNOSTIC_SHAPE", "/diagnostics", "Aggregate diagnostics must be an array.")];
  }

  const childIssues: ValidationIssue[] = [];
  const fingerprints = new Set<string>();
  const validatedDiagnostics: DiagnosticEnvelope[] = [];

  for (let index = 0; index < candidate.diagnostics.length; index += 1) {
    const child = candidate.diagnostics[index];
    const childIssuesForEntry = validateDiagnosticEnvelope(child);
    childIssues.push(
      ...childIssuesForEntry.map((diagnostic) => ({
        ...diagnostic,
        path: "/diagnostics/" + String(index) + (diagnostic.path ?? "")
      }))
    );
    if (childIssuesForEntry.length === 0) {
      validatedDiagnostics.push(child as DiagnosticEnvelope);
      const fingerprint = fingerprintDiagnostic(child as DiagnosticEnvelope);
      if (fingerprints.has(fingerprint)) {
        childIssues.push(issue("DUPLICATE_DIAGNOSTIC_FINGERPRINT", "/diagnostics/" + String(index), "Duplicate diagnostic fingerprint."));
      }
      fingerprints.add(fingerprint);
    }
  }

  if (candidate.diagnostics.length > maxRuntimeDiagnostics) {
    childIssues.push(issue("DIAGNOSTIC_BUDGET_EXCEEDED", "/diagnostics", "Aggregate exceeds the runtime budget."));
  }

  const expectedStatus = aggregateStatusForDiagnostics(validatedDiagnostics);
  if (candidate.status !== expectedStatus) {
    childIssues.push(issue("INVALID_AGGREGATE_STATUS", "/status", "Expected " + expectedStatus + " for the diagnostics present."));
  }
  return childIssues;
}

function canonicalizeDiagnosticEnvelope<T extends DiagnosticEnvelope | AggregateEnvelope>(value: T): T {
  return cloneJson(JSON.parse(canonicalStringify(value)) as T);
}

function loadCanonicalFixture(relativePath: string): DiagnosticEnvelope | AggregateEnvelope {
  return readFixture(relativePath) as DiagnosticEnvelope | AggregateEnvelope;
}

describe("Validation Diagnostic Contract", () => {
  it("exposes the contract schema identity", () => {
    const schema = JSON.parse(readFileSync(resolve("schemas/validation-diagnostic.schema.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.$id).toBe("https://schemas.narrative-engine.local/validation-diagnostic/0.1.0/schema.json");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["contractVersion", "schemaId", "schemaVersion"]);
  });

  for (const fixture of [
    "valid/minimal-error-diagnostic.json",
    "valid/warning-diagnostic.json",
    "valid/info-diagnostic.json",
    "valid/fatal-diagnostic.json",
    "valid/simple-code.json",
    "valid/multi-segment-code.json",
    "valid/owner-contract.json",
    "valid/document-location.json",
    "valid/state-location.json",
    "valid/source-reference.json",
    "valid/schema-location.json",
    "valid/event-location.json",
    "valid/batch-location.json",
    "valid/related-reference.json",
    "valid/safe-expected-actual.json",
    "valid/redacted-actual.json",
    "valid/metadata.json"
  ]) {
    it(`accepts valid diagnostic fixture ${fixture}`, () => {
      const candidate = loadCanonicalFixture(fixture);
      const issues = validateDiagnosticEnvelope(candidate);
      expect(issues).toHaveLength(0);
      const canonical = canonicalizeDiagnosticEnvelope(candidate as DiagnosticEnvelope);
      expect(canonicalStringify(canonical)).toBe(canonicalStringify(candidate));
    });
  }

  for (const fixture of [
    "valid/aggregate-valid-with-warnings.json",
    "valid/aggregate-invalid.json",
    "valid/aggregate-fatal.json"
  ]) {
    it(`accepts valid aggregate fixture ${fixture}`, () => {
      const candidate = loadCanonicalFixture(fixture);
      const issues = validateAggregateEnvelope(candidate);
      expect(issues).toHaveLength(0);
      const canonical = canonicalizeDiagnosticEnvelope(candidate as AggregateEnvelope);
      expect(canonicalStringify(canonical)).toBe(canonicalStringify(candidate));
    });
  }

  for (const fixture of [
    "invalid/missing-schema-version.json",
    "invalid/schema-version-zero.json",
    "invalid/invalid-diagnostic-id.json",
    "invalid/invalid-code.json",
    "invalid/invalid-code-lowercase.json",
    "invalid/invalid-code-leading-underscore.json",
    "invalid/invalid-code-trailing-underscore.json",
    "invalid/invalid-code-double-underscore.json",
    "invalid/invalid-code-whitespace.json",
    "invalid/invalid-code-too-long.json",
    "invalid/invalid-severity.json",
    "invalid/invalid-category.json",
    "invalid/invalid-phase.json",
    "invalid/invalid-location.json",
    "invalid/invalid-source-reference.json",
    "invalid/unknown-root-field.json",
    "invalid/oversized-message.json",
    "invalid/too-many-related-references.json",
    "invalid/executable-field.json",
    "invalid/unsafe-nested-metadata.json",
    "invalid/invalid-expected-actual.json"
  ]) {
    it(`rejects invalid fixture ${fixture}`, () => {
      const candidate = loadFixture(fixture);
      const issues = validateDiagnosticEnvelope(candidate);
      expect(issues.length).toBeGreaterThan(0);
    });
  }

  it("flags invalid diagnostic identities explicitly", () => {
    const candidate = loadFixture("invalid/invalid-diagnostic-id.json");
    const issues = validateDiagnosticEnvelope(candidate);
    expect(issues.map((entry) => entry.code)).toContain("INVALID_DIAGNOSTIC_ID");
  });

  it("rejects code grammar variants explicitly", () => {
    const cases = [
      ["invalid/invalid-code-lowercase.json", "INVALID_DIAGNOSTIC_CODE"],
      ["invalid/invalid-code-leading-underscore.json", "INVALID_DIAGNOSTIC_CODE"],
      ["invalid/invalid-code-trailing-underscore.json", "INVALID_DIAGNOSTIC_CODE"],
      ["invalid/invalid-code-double-underscore.json", "INVALID_DIAGNOSTIC_CODE"],
      ["invalid/invalid-code-whitespace.json", "INVALID_DIAGNOSTIC_CODE"],
      ["invalid/invalid-code-too-long.json", "INVALID_DIAGNOSTIC_CODE"]
    ] as const;
    for (const [fixture, code] of cases) {
      const candidate = loadFixture(fixture);
      const issues = validateDiagnosticEnvelope(candidate);
      expect(issues.map((entry) => entry.code)).toContain(code);
    }
  });

  for (const fixture of [
    "semantic-invalid/unknown-code.json",
    "semantic-invalid/wrong-default-category.json",
    "semantic-invalid/wrong-default-severity.json",
    "semantic-invalid/source-kind-mismatch.json",
    "semantic-invalid/location-kind-mismatch.json",
    "semantic-invalid/duplicate-diagnostic-fingerprint.json",
    "semantic-invalid/aggregate-status-mismatch.json",
    "semantic-invalid/warning-only-marked-invalid.json",
    "semantic-invalid/fatal-in-warning-aggregate.json",
    "semantic-invalid/sensitive-actual-without-redaction.json",
    "semantic-invalid/output-over-budget.json",
    "semantic-invalid/causal-cycle.json"
  ]) {
    it(`detects semantic invalid fixture ${fixture}`, () => {
      const candidate = loadCanonicalFixture(fixture);
      const issues = fixture.startsWith("semantic-invalid/aggregate") ||
        fixture.includes("aggregate") ||
        fixture.includes("duplicate-diagnostic-fingerprint")
        ? validateAggregateEnvelope(candidate)
        : validateDiagnosticEnvelope(candidate);
      expect(issues.length).toBeGreaterThan(0);
    });
  }

  it("preserves diagnostic message independence in fingerprints", () => {
    const left: DiagnosticEnvelope = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      code: "VALIDATION_NOTE",
      severity: "info",
      category: "validation",
      phase: "explain",
      message: "One message"
    };
    const right = { ...left, message: "A different message" };
    expect(fingerprintDiagnostic(left)).toBe(fingerprintDiagnostic(right));
  });

  it("keeps metadata out of the stable fingerprint", () => {
    const left: DiagnosticEnvelope = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      code: "VALIDATION_NOTE",
      severity: "info",
      category: "validation",
      phase: "explain",
      message: "Metadata A",
      source: {
        kind: "system"
      },
      location: {
        kind: "document",
        path: "/diagnostics/0"
      },
      metadata: {
        origin: "authoring"
      }
    };
    const right: DiagnosticEnvelope = {
      ...left,
      message: "Metadata B",
      metadata: {
        origin: "runtime",
        tags: ["alt"]
      }
    };
    expect(fingerprintDiagnostic(left)).toBe(fingerprintDiagnostic(right));
    expect(canonicalStringify(left)).not.toBe(canonicalStringify(right));
  });

  it("keeps owner contract in the registry fingerprint", () => {
    const left: DiagnosticEnvelope = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      ownerContract: "command@0.1.0",
      code: "NOTE",
      severity: "info",
      category: "validation",
      phase: "explain",
      message: "Owner A",
      source: { kind: "system" },
      location: { kind: "document", path: "/diagnostics/1" }
    };
    const right: DiagnosticEnvelope = {
      ...left,
      ownerContract: "transaction@0.1.0",
      message: "Owner B"
    };
    expect(fingerprintDiagnostic(left)).not.toBe(fingerprintDiagnostic(right));
  });

  it("keeps diagnostic order stable through canonical serialization", () => {
    const aggregate: AggregateEnvelope = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      status: "valid-with-warnings",
      diagnostics: [
        {
          contractVersion,
          schemaId,
          schemaVersion: 1,
          code: "VALIDATION_NOTE",
          severity: "info",
          category: "validation",
          phase: "explain",
          message: "First"
        },
        {
          contractVersion,
          schemaId,
          schemaVersion: 1,
          code: "DIAGNOSTIC_OUTPUT_TRUNCATED",
          severity: "warning",
          category: "budget",
          phase: "validation",
          message: "Second"
        }
      ]
    };
    const canonical = canonicalStringify(aggregate);
    expect(canonical.indexOf("First")).toBeLessThan(canonical.indexOf("Second"));
    expect(canonical).toBe(canonicalStringify(canonicalizeDiagnosticEnvelope(aggregate)));
  });

  it("redacts sensitive actual values when marked explicitly", () => {
    const candidate: DiagnosticEnvelope = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      code: "INVALID_STATE_SHAPE",
      severity: "error",
      category: "shape",
      phase: "shape-validation",
      message: "State value is sensitive.",
      actual: { kind: "redacted", reason: "sensitive" }
    };
    expect(validateDiagnosticEnvelope(candidate)).toHaveLength(0);
  });

  it("rejects runtime-invalid host values", () => {
    for (const candidate of runtimeInvalidCases as readonly { name: string; value: unknown }[]) {
      const runtimeValue: unknown = candidate.value;
      const diagnostic = {
        contractVersion,
        schemaId,
        schemaVersion: 1,
        code: "VALIDATION_NOTE",
        severity: "info",
        category: "validation",
        phase: "explain",
        message: "Runtime invalid input.",
        actual: { kind: "value", value: runtimeValue as JsonValue }
      };
      const issues = validateDiagnosticEnvelope(diagnostic);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((entry) => ["NON_SERIALIZABLE_VALUE", "UNSAFE_DIAGNOSTIC_VALUE", "FORBIDDEN_OBJECT_KEY"].includes(entry.code))).toBe(true);
    }
  });

  it("detects budget truncation deterministically", () => {
    const aggregate: AggregateEnvelope = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      status: "valid-with-warnings",
      diagnostics: Array.from({ length: 9 }, (_, index) => ({
        contractVersion,
        schemaId,
        schemaVersion: 1,
        code: index === 0 ? "VALIDATION_NOTE" : "DIAGNOSTIC_OUTPUT_TRUNCATED",
        severity: index === 0 ? "info" : "warning",
        category: index === 0 ? "validation" : "budget",
        phase: "validation",
        message: "Diagnostic " + String(index)
      }))
    };
    const first = validateAggregateEnvelope(aggregate);
    const second = validateAggregateEnvelope(aggregate);
    expect(first.map((entry) => entry.code)).toEqual(second.map((entry) => entry.code));
    expect(first.map((entry) => entry.code)).toContain("DIAGNOSTIC_BUDGET_EXCEEDED");
  });

  it("rejects source-kind mismatches", () => {
    const candidate: DiagnosticEnvelope = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      code: "INVALID_COMMAND_SHAPE",
      severity: "error",
      category: "shape",
      phase: "shape-validation",
      message: "Source kind mismatch.",
      source: {
        kind: "transaction",
        id: "command.runtime.open-main-door"
      }
    };
    expect(validateDiagnosticEnvelope(candidate).map((entry) => entry.code)).toContain("INVALID_SOURCE_REFERENCE");
  });

  it("rejects location-kind mismatches", () => {
    const candidate: DiagnosticEnvelope = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      code: "INVALID_LOCATION",
      severity: "error",
      category: "reference",
      phase: "reference-validation",
      message: "Location mismatch.",
      location: {
        kind: "state",
        domainId: "command.runtime.open-main-door",
        path: "/value"
      }
    };
    expect(validateDiagnosticEnvelope(candidate).map((entry) => entry.code)).toContain("INVALID_LOCATION");
  });

  it("rejects duplicated diagnostic fingerprints", () => {
    const candidate: AggregateEnvelope = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      status: "invalid",
      diagnostics: [
        {
          contractVersion,
          schemaId,
          schemaVersion: 1,
          code: "INVALID_EFFECT_SHAPE",
          severity: "error",
          category: "shape",
          phase: "shape-validation",
          message: "First"
        },
        {
          contractVersion,
          schemaId,
          schemaVersion: 1,
          code: "INVALID_EFFECT_SHAPE",
          severity: "error",
          category: "shape",
          phase: "shape-validation",
          message: "Second"
        }
      ]
    };
    const issues = validateAggregateEnvelope(candidate);
    expect(issues.map((entry) => entry.code)).toContain("DUPLICATE_DIAGNOSTIC_FINGERPRINT");
  });

  it("detects aggregate status mismatches", () => {
    const candidate: AggregateEnvelope = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      status: "invalid",
      diagnostics: [
        {
          contractVersion,
          schemaId,
          schemaVersion: 1,
          code: "VALIDATION_NOTE",
          severity: "info",
          category: "validation",
          phase: "explain",
          message: "Only informational."
        }
      ]
    };
    expect(validateAggregateEnvelope(candidate).map((entry) => entry.code)).toContain("INVALID_AGGREGATE_STATUS");
  });

  it("derives aggregate status across the full severity matrix", () => {
    const base = { contractVersion, schemaId, schemaVersion: 1 } as const;
    const cases: Array<[string, AggregateEnvelope["status"], DiagnosticEnvelope[]]> = [
      ["empty", "valid", []],
      [
        "info-only",
        "valid",
        [
          {
            ...base,
            code: "NOTE",
            severity: "info",
            category: "validation",
            phase: "explain",
            message: "Info only"
          }
        ]
      ],
      [
        "warning-only",
        "valid-with-warnings",
        [
          {
            ...base,
            code: "DIAGNOSTIC_OUTPUT_TRUNCATED",
            severity: "warning",
            category: "budget",
            phase: "validation",
            message: "Warning only"
          }
        ]
      ],
      [
        "info-warning",
        "valid-with-warnings",
        [
          {
            ...base,
            code: "NOTE",
            severity: "info",
            category: "validation",
            phase: "explain",
            message: "Info"
          },
          {
            ...base,
            code: "DIAGNOSTIC_OUTPUT_TRUNCATED",
            severity: "warning",
            category: "budget",
            phase: "validation",
            message: "Warning"
          }
        ]
      ],
      [
        "error-only",
        "invalid",
        [
          {
            ...base,
            code: "INVALID_EFFECT_SHAPE",
            severity: "error",
            category: "shape",
            phase: "shape-validation",
            message: "Error only"
          }
        ]
      ],
      [
        "warning-error",
        "invalid",
        [
          {
            ...base,
            code: "DIAGNOSTIC_OUTPUT_TRUNCATED",
            severity: "warning",
            category: "budget",
            phase: "validation",
            message: "Warning"
          },
          {
            ...base,
            code: "INVALID_EFFECT_SHAPE",
            severity: "error",
            category: "shape",
            phase: "shape-validation",
            message: "Error"
          }
        ]
      ],
      [
        "fatal-only",
        "fatal",
        [
          {
            ...base,
            code: "ATOMICITY_VIOLATION",
            severity: "fatal",
            category: "internal",
            phase: "commit",
            message: "Fatal only"
          }
        ]
      ],
      [
        "error-fatal",
        "fatal",
        [
          {
            ...base,
            code: "INVALID_EFFECT_SHAPE",
            severity: "error",
            category: "shape",
            phase: "shape-validation",
            message: "Error"
          },
          {
            ...base,
            code: "ATOMICITY_VIOLATION",
            severity: "fatal",
            category: "internal",
            phase: "commit",
            message: "Fatal"
          }
        ]
      ]
    ];

    for (const [name, expected, diagnostics] of cases) {
      const aggregate: AggregateEnvelope = {
        ...base,
        status: expected,
        diagnostics
      };
      expect(validateAggregateEnvelope(aggregate), name).toHaveLength(0);
      expect(aggregateStatusForDiagnostics(diagnostics)).toBe(expected);
    }
  });
});
