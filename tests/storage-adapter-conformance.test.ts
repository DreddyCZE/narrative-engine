import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ENGINE_STATE_CONTRACT_VERSION,
  type PersistenceEventEnvelope,
  type PersistenceSnapshotRecord,
  type StorageAdapterCapability,
  type StorageAdapterKind,
  type StorageAdapterContract,
  type StorageAppendEventsInput,
  type StorageLoadSnapshotInput,
  type StorageOperationResult,
  type StorageReadEventsInput,
  type StorageSaveSnapshotInput
} from "../packages/engine-contracts/src/index.js";
import {
  createFileStorageAdapter
} from "../packages/engine-kernel/src/storage/file-storage-adapter.js";
import {
  createMemoryStorageAdapter,
  type MemoryStorageAdapter
} from "../packages/engine-kernel/src/storage/memory-storage-adapter.js";

type StorageAdapterConformanceAdapter = StorageAdapterContract & {
  appendEventRecords: (input: StorageAppendEventsInput) => Promise<StorageOperationResult>;
  readEventRecords: (input: StorageReadEventsInput) => Promise<StorageOperationResult>;
  listEventRecords: (input: StorageReadEventsInput) => Promise<StorageOperationResult>;
  saveSnapshot: (input: StorageSaveSnapshotInput) => Promise<StorageOperationResult>;
  loadSnapshot: (input: StorageLoadSnapshotInput) => Promise<StorageOperationResult>;
};

type FileSubjectContext = {
  readonly kind: "file";
  readonly sandboxDirectory: string;
  readonly rootDirectory: string;
  readonly runtimeHostSentinelPath: string;
};

type MemorySubjectContext = {
  readonly kind: "memory";
  readonly sandboxDirectory: string;
  readonly runtimeHostSentinelPath: string;
};

type StorageAdapterConformanceSubject = {
  readonly name: string;
  readonly adapterKind: StorageAdapterKind;
  readonly expectedPersistent: boolean;
  readonly expectedCapabilityOperations: readonly StorageAdapterCapability["operation"][];
  create: () => Promise<StorageAdapterConformanceAdapter>;
  cleanup: () => Promise<void>;
  assertIdenticalEventDuplicate: (result: StorageOperationResult) => void;
  assertConflictingEventDuplicate: (result: StorageOperationResult) => void;
  assertIdenticalSnapshotDuplicate: (result: StorageOperationResult) => void;
  assertMissingSnapshot: (result: StorageOperationResult) => void;
  assertConflictingSnapshotDuplicate: (result: StorageOperationResult) => void;
  runSubjectSpecificAssertions?: (adapter: StorageAdapterConformanceAdapter) => Promise<void>;
};

type StorageAdapterConformanceRegistration = {
  readonly name: string;
  createSubject: () => Promise<StorageAdapterConformanceSubject>;
};

const EVENT_ONE_ID = "runtime-event.command.demo.inspect.01";
const EVENT_TWO_ID = "runtime-event.command.demo.inspect.02";
const SNAPSHOT_ID = "snapshot.demo.slot-2";
const RUNTIME_HOST_SENTINEL = '{"owner":"runtime-host","status":"untouched"}';
const EXPECTED_CAPABILITY_OPERATIONS = [
  "append-events",
  "list-events",
  "read-events",
  "save-snapshot",
  "load-snapshot",
  "health-check"
] as const;

function makeEventEnvelope(): PersistenceEventEnvelope {
  return {
    records: [
      {
        eventId: EVENT_ONE_ID,
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
        eventId: EVENT_TWO_ID,
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
    snapshotId: SNAPSHOT_ID,
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

async function listRelativeEntries(rootDirectory: string): Promise<readonly string[]> {
  const entries: string[] = [];

  async function walk(currentDirectory: string): Promise<void> {
    const directoryEntries = await readdir(currentDirectory, { withFileTypes: true });
    directoryEntries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of directoryEntries) {
      const fullPath = join(currentDirectory, entry.name);
      const relativePath = relative(rootDirectory, fullPath).replaceAll("\\", "/");
      entries.push(relativePath);
      if (entry.isDirectory()) {
        await walk(fullPath);
      }
    }
  }

  await walk(rootDirectory);
  return entries;
}

async function assertFileSubjectSpecificBoundaryBehavior(
  context: FileSubjectContext,
  adapter: StorageAdapterConformanceAdapter
): Promise<void> {
  const traversal = await adapter.loadSnapshot(loadInput("file", "snapshot.demo.slot-2/../escape"));
  expect(traversal.status).toBe("rejected");
  expect(traversal.diagnostics[0]?.code).toBe("FILE_STORAGE_PATH_TRAVERSAL");

  await adapter.appendEventRecords(appendInput("file", makeEventEnvelope()));
  await adapter.saveSnapshot(saveInput("file", makeSnapshot()));

  expect(await readFile(context.runtimeHostSentinelPath, "utf8")).toBe(RUNTIME_HOST_SENTINEL);
  expect(await listRelativeEntries(context.sandboxDirectory)).toEqual([
    "adapter-root",
    "adapter-root/events",
    "adapter-root/events/order.json",
    "adapter-root/events/records",
    `adapter-root/events/records/${encodeURIComponent(EVENT_ONE_ID)}.json`,
    "adapter-root/snapshots",
    `adapter-root/snapshots/${encodeURIComponent(SNAPSHOT_ID)}.json`,
    "runtime-host-sentinel.json"
  ]);

  const snapshotPath = resolve(context.rootDirectory, "snapshots", `${encodeURIComponent(SNAPSHOT_ID)}.json`);
  await writeFile(snapshotPath, "{ not-json", "utf8");

  const corrupt = await adapter.loadSnapshot(loadInput("file", SNAPSHOT_ID));
  expect(corrupt.status).toBe("error");
  expect(corrupt.diagnostics[0]?.code).toBe("FILE_STORAGE_JSON_INVALID");
}

async function assertMemorySubjectSpecificBoundaryBehavior(
  context: MemorySubjectContext,
  adapter: StorageAdapterConformanceAdapter,
  createPeer: () => Promise<MemoryStorageAdapter>
): Promise<void> {
  expect(await listRelativeEntries(context.sandboxDirectory)).toEqual(["runtime-host-sentinel.json"]);

  const appendResult = await adapter.appendEventRecords(appendInput("memory", makeEventEnvelope()));
  expectCompleted(appendResult);
  const saveResult = await adapter.saveSnapshot(saveInput("memory", makeSnapshot()));
  expectCompleted(saveResult);

  expect(await readFile(context.runtimeHostSentinelPath, "utf8")).toBe(RUNTIME_HOST_SENTINEL);
  expect(await listRelativeEntries(context.sandboxDirectory)).toEqual(["runtime-host-sentinel.json"]);

  const sameInstanceRead = await adapter.readEventRecords(readInput("memory"));
  expectCompleted(sameInstanceRead);
  expect(sameInstanceRead.recordsRead).toEqual([EVENT_ONE_ID]);

  const sameInstanceLoad = await adapter.loadSnapshot(loadInput("memory", SNAPSHOT_ID));
  expectCompleted(sameInstanceLoad);
  expect(sameInstanceLoad.snapshot?.snapshotId).toBe(SNAPSHOT_ID);

  const peerAdapter = await createPeer();
  const peerRead = await peerAdapter.readEventRecords(readInput("memory"));
  expectCompleted(peerRead);
  expect(peerRead.recordsRead).toEqual([]);

  const peerMissing = await peerAdapter.loadSnapshot(loadInput("memory", SNAPSHOT_ID));
  expect(peerMissing.status).toBe("blocked");
  expect(peerMissing.diagnostics[0]?.code).toBe("MEMORY_STORAGE_SNAPSHOT_MISSING");
}

async function createFileSubject(): Promise<StorageAdapterConformanceSubject> {
  const sandboxDirectory = await mkdtemp(join(tmpdir(), "narrative-engine-storage-conformance-file-"));
  const rootDirectory = join(sandboxDirectory, "adapter-root");
  const runtimeHostSentinelPath = join(sandboxDirectory, "runtime-host-sentinel.json");

  await mkdir(rootDirectory, { recursive: true });
  await writeFile(runtimeHostSentinelPath, RUNTIME_HOST_SENTINEL, "utf8");

  const context: FileSubjectContext = {
    kind: "file",
    sandboxDirectory,
    rootDirectory,
    runtimeHostSentinelPath
  };

  return {
    name: "file-storage-adapter",
    adapterKind: "file",
    expectedPersistent: true,
    expectedCapabilityOperations: EXPECTED_CAPABILITY_OPERATIONS,
    create: () => Promise.resolve(createFileStorageAdapter({ rootDirectory })),
    cleanup: async () => {
      await rm(sandboxDirectory, { recursive: true, force: true });
    },
    assertIdenticalEventDuplicate: (result) => {
      expect(result.diagnostics[0]?.code).toBe("FILE_STORAGE_EVENT_DUPLICATE_EXISTING");
    },
    assertConflictingEventDuplicate: (result) => {
      expect(result.diagnostics[0]?.code).toBe("FILE_STORAGE_EVENT_DUPLICATE_CONFLICT");
    },
    assertIdenticalSnapshotDuplicate: (result) => {
      expect(result.diagnostics[0]?.code).toBe("FILE_STORAGE_SNAPSHOT_DUPLICATE_EXISTING");
    },
    assertMissingSnapshot: (result) => {
      expect(result.diagnostics[0]?.code).toBe("FILE_STORAGE_SNAPSHOT_MISSING");
    },
    assertConflictingSnapshotDuplicate: (result) => {
      expect(result.diagnostics[0]?.code).toBe("FILE_STORAGE_SNAPSHOT_DUPLICATE_CONFLICT");
    },
    runSubjectSpecificAssertions: (adapter) => assertFileSubjectSpecificBoundaryBehavior(context, adapter)
  };
}

async function createMemorySubject(): Promise<StorageAdapterConformanceSubject> {
  const sandboxDirectory = await mkdtemp(join(tmpdir(), "narrative-engine-storage-conformance-memory-"));
  const runtimeHostSentinelPath = join(sandboxDirectory, "runtime-host-sentinel.json");

  await writeFile(runtimeHostSentinelPath, RUNTIME_HOST_SENTINEL, "utf8");

  return {
    name: "memory-storage-adapter",
    adapterKind: "memory",
    expectedPersistent: false,
    expectedCapabilityOperations: EXPECTED_CAPABILITY_OPERATIONS,
    create: () => Promise.resolve(createMemoryStorageAdapter()),
    cleanup: async () => {
      await rm(sandboxDirectory, { recursive: true, force: true });
    },
    assertIdenticalEventDuplicate: (result) => {
      expect(result.diagnostics[0]?.code).toBe("MEMORY_STORAGE_EVENT_DUPLICATE_EXISTING");
    },
    assertConflictingEventDuplicate: (result) => {
      expect(result.diagnostics[0]?.code).toBe("MEMORY_STORAGE_EVENT_DUPLICATE_CONFLICT");
    },
    assertIdenticalSnapshotDuplicate: (result) => {
      expect(result.diagnostics[0]?.code).toBe("MEMORY_STORAGE_SNAPSHOT_DUPLICATE_EXISTING");
    },
    assertMissingSnapshot: (result) => {
      expect(result.diagnostics[0]?.code).toBe("MEMORY_STORAGE_SNAPSHOT_MISSING");
    },
    assertConflictingSnapshotDuplicate: (result) => {
      expect(result.diagnostics[0]?.code).toBe("MEMORY_STORAGE_SNAPSHOT_DUPLICATE_CONFLICT");
    },
    runSubjectSpecificAssertions: async (adapter) => {
      const context: MemorySubjectContext = {
        kind: "memory",
        sandboxDirectory,
        runtimeHostSentinelPath
      };
      await assertMemorySubjectSpecificBoundaryBehavior(context, adapter, () => Promise.resolve(createMemoryStorageAdapter()));
    }
  };
}

const storageAdapterConformanceSubjects: readonly StorageAdapterConformanceRegistration[] = [
  {
    name: "file-storage-adapter",
    createSubject: createFileSubject
  },
  {
    name: "memory-storage-adapter",
    createSubject: createMemorySubject
  }
];

async function withSubject(
  createSubject: () => Promise<StorageAdapterConformanceSubject>,
  run: (subject: StorageAdapterConformanceSubject) => Promise<void>
): Promise<void> {
  const subject = await createSubject();
  try {
    await run(subject);
  } finally {
    await subject.cleanup();
  }
}

function appendInput(adapterKind: StorageAdapterKind, envelope: PersistenceEventEnvelope): StorageAppendEventsInput {
  return {
    adapterKind,
    expectedSchemaVersion: 1,
    envelope
  };
}

function readInput(adapterKind: StorageAdapterKind): StorageReadEventsInput {
  return {
    adapterKind,
    revisionRange: {
      fromRevision: 1,
      toRevision: 100
    }
  };
}

function saveInput(adapterKind: StorageAdapterKind, snapshot: PersistenceSnapshotRecord): StorageSaveSnapshotInput {
  return {
    adapterKind,
    expectedSchemaVersion: 1,
    snapshot
  };
}

function loadInput(adapterKind: StorageAdapterKind, snapshotId: string, stateId?: string): StorageLoadSnapshotInput {
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

describe("storage adapter conformance harness", () => {
  it("registers subject descriptors so future adapters can be added without rewriting the suite", () => {
    expect(storageAdapterConformanceSubjects.map((subject) => subject.name)).toEqual([
      "file-storage-adapter",
      "memory-storage-adapter"
    ]);
  });
});

for (const registration of storageAdapterConformanceSubjects) {
  describe(`storage adapter conformance: ${registration.name}`, () => {
    it("exposes expected capabilities through the public contract", async () => {
      await withSubject(registration.createSubject, async (subject) => {
        const adapter = await subject.create();

        expect(adapter.kind).toBe(subject.adapterKind);
        expect(adapter.deterministic).toBe(true);
        expect(adapter.persistent).toBe(subject.expectedPersistent);
        expect(adapter.capabilities.map((capability) => capability.operation)).toEqual(subject.expectedCapabilityOperations);
      });
    });

    it("appends events and reads them back in deterministic order", async () => {
      await withSubject(registration.createSubject, async (subject) => {
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
        expect(listed.recordsRead).toEqual([EVENT_ONE_ID, EVENT_TWO_ID]);
        expect(read.recordsRead).toEqual(listed.recordsRead);
        expect(listed.eventEnvelope?.records.map((record) => record.eventId)).toEqual(listed.recordsRead);
        expect(read.eventEnvelope?.records.map((record) => record.eventId)).toEqual(listed.recordsRead);
      });
    });

    it("treats identical duplicates as idempotent and conflicting duplicates as rejected", async () => {
      await withSubject(registration.createSubject, async (subject) => {
        const adapter = await subject.create();
        const envelope = makeEventEnvelope();

        const first = await adapter.appendEventRecords(appendInput(subject.adapterKind, envelope));
        const second = await adapter.appendEventRecords(appendInput(subject.adapterKind, envelope));
        expectCompleted(first);
        expectCompleted(second);
        expect(second.metadata.recordCount).toBe(0);
        subject.assertIdenticalEventDuplicate(second);

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
        subject.assertConflictingEventDuplicate(conflict);
      });
    });

    it("saves and loads snapshots with idempotence, copy safety, and deterministic missing diagnostics", async () => {
      await withSubject(registration.createSubject, async (subject) => {
        const adapter = await subject.create();
        const snapshot = makeSnapshot();

        const firstSave = await adapter.saveSnapshot(saveInput(subject.adapterKind, snapshot));
        const secondSave = await adapter.saveSnapshot(saveInput(subject.adapterKind, snapshot));
        expectCompleted(firstSave);
        expectCompleted(secondSave);
        subject.assertIdenticalSnapshotDuplicate(secondSave);

        const loaded = await adapter.loadSnapshot(loadInput(subject.adapterKind, snapshot.snapshotId, snapshot.stateId));
        expectCompleted(loaded);
        const loadedSnapshot = loaded.snapshot as PersistenceSnapshotRecord & { state: { revision: number } };
        loadedSnapshot.state.revision = 999;

        const reloaded = await adapter.loadSnapshot(loadInput(subject.adapterKind, snapshot.snapshotId));
        expectCompleted(reloaded);
        expect(reloaded.snapshot?.revision).toBe(8);

        const missing = await adapter.loadSnapshot(loadInput(subject.adapterKind, "snapshot.demo.missing"));
        expect(missing.status).toBe("blocked");
        subject.assertMissingSnapshot(missing);

        const conflicting = makeSnapshot();
        conflicting.checksum = "sha256:demo-snapshot-conflict";
        const conflict = await adapter.saveSnapshot(saveInput(subject.adapterKind, conflicting));
        expect(conflict.status).toBe("rejected");
        subject.assertConflictingSnapshotDuplicate(conflict);
      });
    });

    it("keeps subject-specific public-boundary behavior within the declared storage boundary", async () => {
      await withSubject(registration.createSubject, async (subject) => {
        const adapter = await subject.create();
        await subject.runSubjectSpecificAssertions?.(adapter);
      });
    });
  });
}
