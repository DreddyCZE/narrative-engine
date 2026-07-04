import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import {
  STORAGE_ADAPTER_KINDS,
  STORAGE_OPERATION_KINDS,
  STORAGE_OPERATION_STATUSES,
  createStorageOperationResult,
  inspectStorageAppendEventsInput,
  inspectStorageLoadSnapshotInput,
  inspectStorageReadEventsInput,
  inspectStorageSaveSnapshotInput,
  isStorageAdapterKind,
  isStorageOperationKind,
  isStorageOperationStatus,
  type StorageAdapterContract,
  type StorageAppendEventsInput,
  type StorageLoadSnapshotInput,
  type StorageOperationResult,
  type StorageReadEventsInput,
  type StorageSaveSnapshotInput
} from "../packages/engine-contracts/src/index.js";

import {
  ENGINE_STATE_CONTRACT_VERSION,
  type PersistenceEventEnvelope,
  type PersistenceSnapshotRecord
} from "../packages/engine-contracts/src/index.js";

const eventEnvelope: PersistenceEventEnvelope = {
  records: [
    {
      eventId: "runtime-event.command.demo.inspect.01",
      eventType: "demo.inspected",
      sourceCommandId: "command.demo.inspect",
      transactionId: "transaction.runtime.inspect-demo",
      revision: 8,
      schemaVersion: 1,
      payload: {
        eventMappingId: "event-mapping.demo.inspect",
        packageId: "content.demo.minimal"
      },
      metadata: {
        deterministic: true,
        persistence: "memory",
        source: "runtime-host",
        createdAtPolicy: "logical",
        runtimeVersion: "runtime-host@0.1.0",
        contentPackageId: "content.demo.minimal",
        idempotencyKey: "append.demo.inspect.01"
      }
    }
  ],
  metadata: {
    deterministic: true,
    persistence: "memory",
    source: "event-store",
    batchId: "batch.demo.inspect.01"
  }
};

const snapshotRecord: PersistenceSnapshotRecord = {
  snapshotId: "snapshot.demo.slot-2",
  stateId: "state.runtime.current",
  revision: 8,
  contentPackageId: "content.demo.minimal",
  sourceEventRange: {
    fromRevision: 7,
    toRevision: 8
  },
  checksum: "sha256:demo-snapshot-8",
  state: {
    contractVersion: ENGINE_STATE_CONTRACT_VERSION,
    schemaId: "engine-state",
    schemaVersion: 1,
    stateId: "state.runtime.current",
    revision: 8,
    run: {
      activeModules: [],
      domains: []
    }
  },
  metadata: {
    deterministic: true,
    persistence: "memory",
    source: "save-snapshot-store",
    runtimeVersion: "runtime-host@0.1.0",
    contentPackageVersion: "content.demo.minimal@1.0.0"
  }
};

describe("storage adapter contracts", () => {
  it("exports storage adapter kinds, operation kinds, and status guards", () => {
    expect(STORAGE_ADAPTER_KINDS).toEqual(["memory", "file", "database"]);
    expect(STORAGE_OPERATION_KINDS).toEqual([
      "append-events",
      "list-events",
      "read-events",
      "save-snapshot",
      "load-snapshot",
      "health-check"
    ]);
    expect(STORAGE_OPERATION_STATUSES).toEqual(["completed", "rejected", "blocked", "error"]);

    expect(isStorageAdapterKind("memory")).toBe(true);
    expect(isStorageAdapterKind("external")).toBe(false);
    expect(isStorageOperationKind("save-snapshot")).toBe(true);
    expect(isStorageOperationKind("mutate-runtime")).toBe(false);
    expect(isStorageOperationStatus("completed")).toBe(true);
    expect(isStorageOperationStatus("saved")).toBe(false);
  });

  it("supports JSON-safe append, read, save, and load input examples", () => {
    const appendInput: StorageAppendEventsInput = {
      adapterKind: "file",
      expectedSchemaVersion: 1,
      envelope: eventEnvelope
    };
    const readInput: StorageReadEventsInput = {
      adapterKind: "database",
      eventIds: ["runtime-event.command.demo.inspect.01"],
      revisionRange: {
        fromRevision: 7,
        toRevision: 8
      }
    };
    const saveInput: StorageSaveSnapshotInput = {
      adapterKind: "memory",
      expectedSchemaVersion: 1,
      snapshot: snapshotRecord
    };
    const loadInput: StorageLoadSnapshotInput = {
      adapterKind: "file",
      snapshotId: "snapshot.demo.slot-2",
      stateId: "state.runtime.current"
    };

    expect(inspectStorageAppendEventsInput(appendInput)).toEqual([]);
    expect(inspectStorageReadEventsInput(readInput)).toEqual([]);
    expect(inspectStorageSaveSnapshotInput(saveInput)).toEqual([]);
    expect(inspectStorageLoadSnapshotInput(loadInput)).toEqual([]);
    expect(canonicalizeJson(appendInput)).toContain("runtime-event.command.demo.inspect.01");
    expect(canonicalizeJson(saveInput)).toContain("snapshot.demo.slot-2");
  });

  it("builds deterministic JSON-safe storage operation results", () => {
    const contract: StorageAdapterContract = {
      kind: "file",
      capabilities: [
        { operation: "append-events", batch: true, idempotent: true, persistent: true },
        { operation: "load-snapshot", persistent: true }
      ],
      deterministic: true,
      persistent: true,
      schemaVersion: 1
    };

    const first: StorageOperationResult = createStorageOperationResult({
      status: "completed",
      diagnostics: [],
      metadata: {
        deterministic: true,
        adapterKind: contract.kind,
        operation: "append-events",
        persistent: true,
        schemaVersion: 1,
        supportsIdempotency: true,
        recordCount: 1
      },
      eventEnvelope
    });

    const second: StorageOperationResult = createStorageOperationResult(JSON.parse(canonicalizeJson(first)) as StorageOperationResult);

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expect(contract.capabilities).toHaveLength(2);
  });

  it("reports invalid inputs deterministically", () => {
    const invalidAppend = inspectStorageAppendEventsInput({
      adapterKind: "external",
      expectedSchemaVersion: 0,
      envelope: {
        ...eventEnvelope,
        records: [{ ...eventEnvelope.records[0], eventId: "bad" }]
      }
    });
    const invalidLoad = inspectStorageLoadSnapshotInput({
      adapterKind: "memory",
      snapshotId: "bad"
    });

    expect(invalidAppend.map((diagnostic) => diagnostic.code)).toContain("STORAGE_ADAPTER_KIND_INVALID");
    expect(invalidAppend.map((diagnostic) => diagnostic.code)).toContain("PERSISTENCE_EVENT_RECORD_INVALID");
    expect(invalidLoad.map((diagnostic) => diagnostic.code)).toContain("STORAGE_LOAD_INPUT_INVALID");
  });

  it("keeps storage adapter contracts free of file IO and concrete adapter implementation", () => {
    const source = readFileSync("packages/engine-contracts/src/storage/storage-adapter-types.ts", "utf8");

    expect(source).not.toMatch(/readFileSync|writeFileSync|appendFileSync|node:fs|fetch\(/u);
    expect(source).not.toMatch(/sqlite|postgres|mongodb|localStorage|indexedDB/u);
    expect(source).not.toContain("class FileStorageAdapter");
    expect(source).not.toContain("class DatabaseStorageAdapter");
  });
});
