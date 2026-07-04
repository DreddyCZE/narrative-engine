import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import {
  SERIALIZATION_FORMATS,
  createDeserializationResult,
  createSerializationResult,
  inspectSchemaMigrationPlan,
  inspectSerializationEnvelope,
  isSerializationFormat,
  type ChecksumMetadata,
  type DeserializationResult,
  type SchemaMigrationPlan,
  type SerializationEnvelope,
  type SerializationMetadata,
  type SerializationResult,
  type SerializedPayload
} from "../packages/engine-contracts/src/index.js";

const checksum: ChecksumMetadata = {
  algorithm: "sha256",
  value: "sha256:storage-envelope-v1"
};

const metadata: SerializationMetadata = {
  deterministic: true,
  format: "json",
  lineEndings: "lf",
  indentation: "two-spaces",
  contentType: "application/json",
  schemaVersion: {
    schemaId: "storage-envelope",
    version: 1
  },
  checksum
};

const envelope: SerializationEnvelope = {
  metadata,
  payload: {
    contractVersion: "storage-envelope@1.0.0",
    snapshotId: "snapshot.demo.slot-2",
    revision: 8
  }
};

describe("serialization schema contracts", () => {
  it("exports serialization formats and format guard", () => {
    expect(SERIALIZATION_FORMATS).toEqual(["json", "json-lines"]);
    expect(isSerializationFormat("json")).toBe(true);
    expect(isSerializationFormat("json-lines")).toBe(true);
    expect(isSerializationFormat("yaml")).toBe(false);
  });

  it("supports a JSON-safe serialization envelope with required schemaVersion and checksum metadata", () => {
    expect(inspectSerializationEnvelope(envelope)).toEqual([]);
    expect(canonicalizeJson(envelope)).toContain("storage-envelope");
    expect(canonicalizeJson(envelope)).toContain("sha256:storage-envelope-v1");
  });

  it("builds deterministic serialization and deserialization result examples", () => {
    const serializedPayload: SerializedPayload = {
      format: "json",
      content: canonicalizeJson(envelope),
      contentType: "application/json",
      schemaVersion: metadata.schemaVersion,
      checksum
    };

    const first: SerializationResult = createSerializationResult({
      status: "serialized",
      diagnostics: [],
      metadata,
      envelope,
      serializedPayload
    });
    const second: DeserializationResult = createDeserializationResult({
      status: "deserialized",
      diagnostics: [],
      metadata,
      envelope: JSON.parse(canonicalizeJson(envelope)) as SerializationEnvelope
    });

    expect(canonicalizeJson(first)).toContain("serialized");
    expect(canonicalizeJson(second)).toContain("deserialized");
    expect(canonicalizeJson(first.metadata)).toBe(canonicalizeJson(second.metadata));
  });

  it("keeps schema migration descriptors data-only and deterministic", () => {
    const plan: SchemaMigrationPlan = {
      schemaId: "storage-envelope",
      targetVersion: 3,
      steps: [
        {
          migrationId: "storage-envelope.1-to-2",
          schemaId: "storage-envelope",
          fromVersion: 1,
          toVersion: 2,
          deterministic: true,
          lossy: false,
          requiresContext: false,
          description: "Normalize checksum metadata fields."
        },
        {
          migrationId: "storage-envelope.2-to-3",
          schemaId: "storage-envelope",
          fromVersion: 2,
          toVersion: 3,
          deterministic: true,
          lossy: false,
          requiresContext: false,
          description: "Separate canonical serialization metadata from payload metadata."
        }
      ]
    };

    expect(inspectSchemaMigrationPlan(plan)).toEqual([]);
    expect(canonicalizeJson(plan)).toContain("storage-envelope.1-to-2");
  });

  it("reports invalid envelope and migration plan diagnostics deterministically", () => {
    const invalidEnvelope = inspectSerializationEnvelope({
      metadata: {
        ...metadata,
        format: "yaml",
        schemaVersion: {
          schemaId: "Bad Schema",
          version: 0
        }
      },
      payload: {
        snapshotId: "snapshot.demo.slot-2"
      }
    });
    const invalidPlan = inspectSchemaMigrationPlan({
      schemaId: "storage-envelope",
      targetVersion: 0,
      steps: [
        {
          migrationId: "bad",
          schemaId: "storage-envelope",
          fromVersion: 0,
          toVersion: 0,
          deterministic: false,
          lossy: "no",
          requiresContext: "no",
          description: ""
        }
      ]
    });

    expect(invalidEnvelope.map((diagnostic) => diagnostic.code)).toContain("SERIALIZATION_METADATA_INVALID");
    expect(invalidPlan.map((diagnostic) => diagnostic.code)).toContain("SERIALIZATION_MIGRATION_PLAN_INVALID");
    expect(invalidPlan.map((diagnostic) => diagnostic.code)).toContain("SERIALIZATION_MIGRATION_STEP_INVALID");
  });

  it("keeps serialization contracts free of file IO and migration runtime execution", () => {
    const source = readFileSync("packages/engine-contracts/src/storage/serialization-schema-types.ts", "utf8");

    expect(source).not.toMatch(/readFileSync|writeFileSync|appendFileSync|node:fs|fetch\(/u);
    expect(source).not.toMatch(/migrate\(|applyMigration|runMigration/u);
    expect(source).not.toMatch(/sqlite|postgres|mongodb|localStorage|indexedDB/u);
  });
});
