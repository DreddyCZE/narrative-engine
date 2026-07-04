import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ENGINE_STATE_CONTRACT_VERSION,
  type PersistenceEventEnvelope,
  type PersistenceSnapshotRecord,
  type StorageAppendEventsInput,
  type StorageLoadSnapshotInput,
  type StorageOperationResult,
  type StorageReadEventsInput,
  type StorageSaveSnapshotInput
} from "../packages/engine-contracts/src/index.js";
import {
  createFileStorageAdapter,
  type FileStorageAdapter
} from "../packages/engine-kernel/src/storage/file-storage-adapter.js";

type StorageAdapterConformanceSubject = {
  readonly name: string;
  readonly adapterKind: "file";
  create: () => Promise<FileStorageAdapter>;
  cleanup: () => Promise<void>;
  readonly rootDirectory: () => string;
}

function makeEventEnvelope(): PersistenceEventEnvelope {
  return {
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
          persistence: "future-storage",
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
      persistence: "future-storage",
      source: "event-store",
      batchId: "batch.demo.inspect.01"
    }
  };
}

function makeSecondEventEnvelope(): PersistenceEventEnvelope {
  return {
    records: [
      {
        eventId: "runtime-event.command.demo.inspect.02",
        eventType: "demo.inspected",
        sourceCommandId: "command.demo.inspect-again",
        transactionId: "transaction.runtime.inspect-demo.02",
        revision: 9,
        schemaVersion: 1,
        payload: {
          eventMappingId: "event-mapping.demo.inspect-02",
          packageId: "content.demo.minimal"
        },
        metadata: {
          deterministic: true,
          persistence: "future-storage",
          source: "runtime-host",
          createdAtPolicy: "logical",
          runtimeVersion: "runtime-host@0.1.0",
          contentPackageId: "content.demo.minimal",
          idempotencyKey: "append.demo.inspect.02"
        }
      }
    ],
    metadata: {
      deterministic: true,
      persistence: "future-storage",
      source: "event-store",
      batchId: "batch.demo.inspect.02"
    }
  };
}

function makeSnapshot(): PersistenceSnapshotRecord {
  return {
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
      persistence: "future-storage",
      source: "save-snapshot-store",
      runtimeVersion: "runtime-host@0.1.0",
      contentPackageVersion: "content.demo.minimal@1.0.0"
    }
  };
}

async function createFileSubject(): Promise<StorageAdapterConformanceSubject> {
  const rootDirectory = await mkdtemp(join(tmpdir(), "narrative-engine-storage-conformance-"));
  return {
    name: "file-storage-adapter",
    adapterKind: "file",
    create: () => Promise.resolve(createFileStorageAdapter({ rootDirectory })),
    cleanup: async () => {
      await rm(rootDirectory, { recursive: true, force: true });
    },
    rootDirectory: () => rootDirectory
  };
}

async function withSubject(run: (subject: StorageAdapterConformanceSubject) => Promise<void>): Promise<void> {
  const subject = await createFileSubject();
  try {
    await run(subject);
  } finally {
    await subject.cleanup();
  }
}

function appendInput(adapterKind: "file", envelope: PersistenceEventEnvelope): StorageAppendEventsInput {
  return {
    adapterKind,
    expectedSchemaVersion: 1,
    envelope
  };
}

function readInput(adapterKind: "file"): StorageReadEventsInput {
  return {
    adapterKind,
    revisionRange: {
      fromRevision: 1,
      toRevision: 100
    }
  };
}

function saveInput(adapterKind: "file", snapshot: PersistenceSnapshotRecord): StorageSaveSnapshotInput {
  return {
    adapterKind,
    expectedSchemaVersion: 1,
    snapshot
  };
}

function loadInput(adapterKind: "file", snapshotId: string, stateId?: string): StorageLoadSnapshotInput {
  return {
    adapterKind,
    snapshotId,
    ...(stateId === undefined ? {} : { stateId })
  };
}

function expectCompleted(result: StorageOperationResult): void {
  expect(result.status).toBe("completed");
  expect(result.metadata.deterministic).toBe(true);
}

describe("storage adapter conformance", () => {
  it("exposes expected capabilities through the public contract", async () => {
    await withSubject(async (subject) => {
      const adapter = await subject.create();

      expect(adapter.kind).toBe("file");
      expect(adapter.deterministic).toBe(true);
      expect(adapter.persistent).toBe(true);
      expect(adapter.capabilities.map((capability) => capability.operation)).toEqual([
        "append-events",
        "list-events",
        "read-events",
        "save-snapshot",
        "load-snapshot",
        "health-check"
      ]);
    });
  });

  it("appends events and reads them back in deterministic order", async () => {
    await withSubject(async (subject) => {
      const adapter = await subject.create();

      const firstAppend = await adapter.appendEventRecords(appendInput(subject.adapterKind, makeEventEnvelope()));
      const secondAppend = await adapter.appendEventRecords(appendInput(subject.adapterKind, makeSecondEventEnvelope()));
      expectCompleted(firstAppend);
      expectCompleted(secondAppend);
      expect(firstAppend.metadata.recordCount).toBe(1);
      expect(secondAppend.metadata.recordCount).toBe(1);

      const listed = await adapter.listEventRecords(readInput(subject.adapterKind));
      const read = await adapter.readEventRecords(readInput(subject.adapterKind));
      expectCompleted(listed);
      expectCompleted(read);
      expect(listed.recordsRead).toEqual([
        "runtime-event.command.demo.inspect.01",
        "runtime-event.command.demo.inspect.02"
      ]);
      expect(read.recordsRead).toEqual(listed.recordsRead);
      expect(listed.eventEnvelope?.records.map((record) => record.eventId)).toEqual(listed.recordsRead);
      expect(read.eventEnvelope?.records.map((record) => record.eventId)).toEqual(listed.recordsRead);
    });
  });

  it("treats identical duplicates as idempotent and conflicting duplicates as rejected", async () => {
    await withSubject(async (subject) => {
      const adapter = await subject.create();
      const envelope = makeEventEnvelope();

      const first = await adapter.appendEventRecords(appendInput(subject.adapterKind, envelope));
      const second = await adapter.appendEventRecords(appendInput(subject.adapterKind, envelope));
      expectCompleted(first);
      expectCompleted(second);
      expect(second.metadata.recordCount).toBe(0);
      expect(second.diagnostics[0]?.code).toBe("FILE_STORAGE_EVENT_DUPLICATE_EXISTING");

      const conflicting = makeEventEnvelope();
      conflicting.records[0] = {
        ...conflicting.records[0],
        payload: {
          eventMappingId: "event-mapping.demo.inspect.conflict",
          changed: true
        }
      };
      const conflict = await adapter.appendEventRecords(appendInput(subject.adapterKind, conflicting));
      expect(conflict.status).toBe("rejected");
      expect(conflict.diagnostics[0]?.code).toBe("FILE_STORAGE_EVENT_DUPLICATE_CONFLICT");
    });
  });

  it("saves and loads snapshots with idempotence, copy safety, and deterministic missing diagnostics", async () => {
    await withSubject(async (subject) => {
      const adapter = await subject.create();
      const snapshot = makeSnapshot();

      const firstSave = await adapter.saveSnapshot(saveInput(subject.adapterKind, snapshot));
      const secondSave = await adapter.saveSnapshot(saveInput(subject.adapterKind, snapshot));
      expectCompleted(firstSave);
      expectCompleted(secondSave);
      expect(secondSave.diagnostics[0]?.code).toBe("FILE_STORAGE_SNAPSHOT_DUPLICATE_EXISTING");

      const loaded = await adapter.loadSnapshot(loadInput(subject.adapterKind, snapshot.snapshotId, snapshot.stateId));
      expectCompleted(loaded);
      const loadedSnapshot = loaded.snapshot as PersistenceSnapshotRecord & { state: { revision: number } };
      loadedSnapshot.state.revision = 999;

      const reloaded = await adapter.loadSnapshot(loadInput(subject.adapterKind, snapshot.snapshotId));
      expectCompleted(reloaded);
      expect(reloaded.snapshot?.revision).toBe(8);

      const missing = await adapter.loadSnapshot(loadInput(subject.adapterKind, "snapshot.demo.missing"));
      expect(missing.status).toBe("blocked");
      expect(missing.diagnostics[0]?.code).toBe("FILE_STORAGE_SNAPSHOT_MISSING");

      const conflicting = makeSnapshot();
      conflicting.checksum = "sha256:demo-snapshot-conflict";
      const conflict = await adapter.saveSnapshot(saveInput(subject.adapterKind, conflicting));
      expect(conflict.status).toBe("rejected");
      expect(conflict.diagnostics[0]?.code).toBe("FILE_STORAGE_SNAPSHOT_DUPLICATE_CONFLICT");
    });
  });

  it("keeps root/path safety and returns deterministic corruption diagnostics", async () => {
    await withSubject(async (subject) => {
      const adapter = await subject.create();

      const traversal = await adapter.loadSnapshot(loadInput(subject.adapterKind, "snapshot.demo.slot-2/../escape"));
      expect(traversal.status).toBe("rejected");
      expect(traversal.diagnostics[0]?.code).toBe("FILE_STORAGE_PATH_TRAVERSAL");

      await adapter.saveSnapshot(saveInput(subject.adapterKind, makeSnapshot()));
      const snapshotPath = resolve(subject.rootDirectory(), "snapshots", `${encodeURIComponent("snapshot.demo.slot-2")}.json`);
      await writeFile(snapshotPath, "{ not-json", "utf8");

      const corrupt = await adapter.loadSnapshot(loadInput(subject.adapterKind, "snapshot.demo.slot-2"));
      expect(corrupt.status).toBe("error");
      expect(corrupt.diagnostics[0]?.code).toBe("FILE_STORAGE_JSON_INVALID");

      const source = await readFile("packages/engine-kernel/src/storage/file-storage-adapter.ts", "utf8");
      expect(source).not.toMatch(/sqlite|postgres|mongodb|localStorage|indexedDB|fetch\(|XMLHttpRequest/u);
      expect(source).not.toMatch(/executeInMemoryCommand|replay|runtime-result-event-store-adapter/u);
    });
  });
});