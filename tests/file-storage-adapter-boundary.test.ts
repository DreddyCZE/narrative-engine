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
  type StorageReadEventsInput,
  type StorageSaveSnapshotInput
} from "../packages/engine-contracts/src/index.js";
import { createFileStorageAdapter } from "../packages/engine-kernel/src/storage/file-storage-adapter.js";

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

async function withTempDir(run: (rootDirectory: string) => Promise<void>): Promise<void> {
  const rootDirectory = await mkdtemp(join(tmpdir(), "narrative-engine-file-storage-"));
  try {
    await run(rootDirectory);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
}

describe("file storage adapter boundary", () => {
  it("writes and reads deterministic event records with idempotent duplicates", async () => {
    await withTempDir(async (rootDirectory) => {
      const adapter = createFileStorageAdapter({ rootDirectory });
      const appendInput: StorageAppendEventsInput = {
        adapterKind: "file",
        expectedSchemaVersion: 1,
        envelope: makeEventEnvelope()
      };

      const firstAppend = await adapter.appendEventRecords(appendInput);
      expect(firstAppend.status).toBe("completed");
      expect(firstAppend.metadata.recordCount).toBe(1);

      const secondAppend = await adapter.appendEventRecords(appendInput);
      expect(secondAppend.status).toBe("completed");
      expect(secondAppend.metadata.recordCount).toBe(0);
      expect(secondAppend.diagnostics[0]?.code).toBe("FILE_STORAGE_EVENT_DUPLICATE_EXISTING");

      const readInput: StorageReadEventsInput = {
        adapterKind: "file",
        revisionRange: { fromRevision: 1, toRevision: 100 }
      };
      const readResult = await adapter.listEventRecords(readInput);
      expect(readResult.status).toBe("completed");
      expect(readResult.eventEnvelope?.records).toHaveLength(1);
      expect(readResult.recordsRead).toEqual(["runtime-event.command.demo.inspect.01"]);

      const orderFile = await readFile(join(rootDirectory, "events", "order.json"), "utf8");
      const eventFile = await readFile(
        join(rootDirectory, "events", "records", `${encodeURIComponent("runtime-event.command.demo.inspect.01")}.json`),
        "utf8"
      );

      expect(orderFile).toContain("file-storage-event-order");
      expect(eventFile).toContain("persistence-event-record");
    });
  });

  it("rejects conflicting duplicates and protects against traversal", async () => {
    await withTempDir(async (rootDirectory) => {
      const adapter = createFileStorageAdapter({ rootDirectory });
      const appendInput: StorageAppendEventsInput = {
        adapterKind: "file",
        expectedSchemaVersion: 1,
        envelope: makeEventEnvelope()
      };
      await adapter.appendEventRecords(appendInput);

      const conflicting = makeEventEnvelope();
      conflicting.records[0] = {
        ...conflicting.records[0],
        payload: { changed: true }
      };
      const conflictResult = await adapter.appendEventRecords({
        adapterKind: "file",
        expectedSchemaVersion: 1,
        envelope: conflicting
      });
      expect(conflictResult.status).toBe("rejected");
      expect(conflictResult.diagnostics[0]?.code).toBe("FILE_STORAGE_EVENT_DUPLICATE_CONFLICT");

      const traversalInput: StorageLoadSnapshotInput = {
        adapterKind: "file",
        snapshotId: "snapshot.demo.slot-2/../escape"
      };
      const traversalResult = await adapter.loadSnapshot(traversalInput);
      expect(traversalResult.status).toBe("rejected");
      expect(traversalResult.diagnostics[0]?.code).toBe("FILE_STORAGE_PATH_TRAVERSAL");
    });
  });

  it("writes, loads, and idempotently re-saves snapshots while keeping loaded data copy-safe", async () => {
    await withTempDir(async (rootDirectory) => {
      const adapter = createFileStorageAdapter({ rootDirectory });
      const saveInput: StorageSaveSnapshotInput = {
        adapterKind: "file",
        expectedSchemaVersion: 1,
        snapshot: makeSnapshot()
      };

      const firstSave = await adapter.saveSnapshot(saveInput);
      expect(firstSave.status).toBe("completed");

      const secondSave = await adapter.saveSnapshot(saveInput);
      expect(secondSave.status).toBe("completed");
      expect(secondSave.diagnostics[0]?.code).toBe("FILE_STORAGE_SNAPSHOT_DUPLICATE_EXISTING");

      const loadResult = await adapter.loadSnapshot({
        adapterKind: "file",
        snapshotId: "snapshot.demo.slot-2",
        stateId: "state.runtime.current"
      });
      expect(loadResult.status).toBe("completed");
      expect(loadResult.snapshot?.snapshotId).toBe("snapshot.demo.slot-2");

      const loadedSnapshot = loadResult.snapshot as PersistenceSnapshotRecord & { state: { revision: number } };
      loadedSnapshot.state.revision = 999;

      const reloaded = await adapter.loadSnapshot({
        adapterKind: "file",
        snapshotId: "snapshot.demo.slot-2"
      });
      expect(reloaded.snapshot?.revision).toBe(8);
    });
  });

  it("returns deterministic diagnostics for missing and corrupt files and stays isolated from DB/network/runtime host writes", async () => {
    await withTempDir(async (rootDirectory) => {
      const adapter = createFileStorageAdapter({ rootDirectory });
      const missing = await adapter.loadSnapshot({
        adapterKind: "file",
        snapshotId: "snapshot.demo.slot-2"
      });
      expect(missing.status).toBe("blocked");
      expect(missing.diagnostics[0]?.code).toBe("FILE_STORAGE_SNAPSHOT_MISSING");

      const saveInput: StorageSaveSnapshotInput = {
        adapterKind: "file",
        expectedSchemaVersion: 1,
        snapshot: makeSnapshot()
      };
      await adapter.saveSnapshot(saveInput);
      const snapshotPath = resolve(rootDirectory, "snapshots", `${encodeURIComponent("snapshot.demo.slot-2")}.json`);
      await writeFile(snapshotPath, "{ not-json", "utf8");

      const corrupt = await adapter.loadSnapshot({
        adapterKind: "file",
        snapshotId: "snapshot.demo.slot-2"
      });
      expect(corrupt.status).toBe("error");
      expect(corrupt.diagnostics[0]?.code).toBe("FILE_STORAGE_JSON_INVALID");

      const source = await readFile("packages/engine-kernel/src/storage/file-storage-adapter.ts", "utf8");
      expect(source).not.toMatch(/sqlite|postgres|mongodb|localStorage|indexedDB|fetch\(|XMLHttpRequest/u);
      expect(source).not.toMatch(/executeInMemoryCommand|runtime-result-event-store-adapter/u);
    });
  });
});
