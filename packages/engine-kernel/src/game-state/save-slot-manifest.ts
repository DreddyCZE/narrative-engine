import {
  isStorageAdapterKind,
  type PersistenceEventEnvelope,
  type PersistenceEventRecord,
  type StorageAdapterContract,
  type StorageAdapterDiagnostic,
  type StorageAppendEventsInput,
  type StorageOperationResult,
  type StorageReadEventsInput
} from "@narrative-engine/engine-contracts";

export const SAVE_SLOT_MANIFEST_SCHEMA_ID = "save-slot-manifest" as const;
export const SAVE_SLOT_MANIFEST_SCHEMA_VERSION = 1 as const;
export const SAVE_SLOT_MANIFEST_RUNTIME_VERSION = "save-slot-manifest@1.0.0" as const;
export const SAVE_SLOT_MANIFEST_CONTENT_PACKAGE_ID = "engine.save-slots" as const;
export const SAVE_SLOT_MANIFEST_CONTENT_PACKAGE_VERSION = "save-slot-manifest@1" as const;

const SAVE_SLOT_EVENT_TYPE = "save-slot.recorded" as const;
const SAVE_SLOT_SOURCE_COMMAND_ID = "save-slot.manifest.record" as const;
const SAVE_SLOT_TRANSACTION_ID = "save-slot.manifest.record" as const;
const SAVE_SLOT_BATCH_ID_PREFIX = "batch.save-slot.manifest" as const;
const SAVE_SLOT_IDEMPOTENCY_PREFIX = "save-slot.manifest" as const;

const STORAGE_KEY_PATTERN = /^[a-z][a-z0-9-]{1,63}$/u;
const SNAPSHOT_ID_PATTERN = /^snapshot\.[A-Za-z0-9][A-Za-z0-9._:@/-]{1,159}$/u;
const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/u;

export type SaveSlotManifestEntry = {
  readonly storageKey: string;
  readonly snapshotId: string;
  readonly stateId: string;
  readonly revision: number;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly contentPackageId: string;
};

export type SaveSlotManifest = {
  readonly schemaId: typeof SAVE_SLOT_MANIFEST_SCHEMA_ID;
  readonly schemaVersion: typeof SAVE_SLOT_MANIFEST_SCHEMA_VERSION;
  readonly entries: readonly SaveSlotManifestEntry[];
  readonly metadata: {
    readonly deterministic: true;
    readonly runtimeVersion: typeof SAVE_SLOT_MANIFEST_RUNTIME_VERSION;
  };
};

export type SaveSlotManifestStorageAdapter = Pick<
  StorageAdapterContract,
  "kind" | "deterministic" | "persistent" | "schemaVersion"
> & {
  appendEventRecords: (input: StorageAppendEventsInput) => Promise<StorageOperationResult>;
  readEventRecords: (input: StorageReadEventsInput) => Promise<StorageOperationResult>;
};

export type RecordSaveSlotInput = {
  readonly storage: SaveSlotManifestStorageAdapter;
  readonly entry: SaveSlotManifestEntry;
};

export type LoadSaveSlotManifestInput = {
  readonly storage: SaveSlotManifestStorageAdapter;
};

export type RecordSaveSlotResult = {
  readonly status: "recorded" | "rejected" | "error";
  readonly diagnostics: readonly StorageAdapterDiagnostic[];
  readonly metadata: {
    readonly deterministic: true;
    readonly adapterKind: SaveSlotManifestStorageAdapter["kind"];
    readonly persistent: boolean;
    readonly storageKey: string;
    readonly eventId: string;
    readonly schemaId: typeof SAVE_SLOT_MANIFEST_SCHEMA_ID;
    readonly schemaVersion: typeof SAVE_SLOT_MANIFEST_SCHEMA_VERSION;
  };
  readonly manifest?: SaveSlotManifest;
  readonly entry?: SaveSlotManifestEntry;
  readonly storageResult?: StorageOperationResult;
};

export type LoadSaveSlotManifestResult = {
  readonly status: "loaded" | "rejected" | "error";
  readonly diagnostics: readonly StorageAdapterDiagnostic[];
  readonly metadata: {
    readonly deterministic: true;
    readonly adapterKind: SaveSlotManifestStorageAdapter["kind"];
    readonly persistent: boolean;
    readonly schemaId: typeof SAVE_SLOT_MANIFEST_SCHEMA_ID;
    readonly schemaVersion: typeof SAVE_SLOT_MANIFEST_SCHEMA_VERSION;
  };
  readonly manifest?: SaveSlotManifest;
  readonly storageResult?: StorageOperationResult;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDiagnostic(
  code: string,
  path: readonly (string | number)[],
  message: string
): StorageAdapterDiagnostic {
  return {
    code,
    path: [...path],
    message
  };
}

function isManifestStorageAdapter(value: unknown): value is SaveSlotManifestStorageAdapter {
  return (
    isRecord(value) &&
    value.deterministic === true &&
    typeof value.persistent === "boolean" &&
    typeof value.schemaVersion === "number" &&
    isStorageAdapterKind(value.kind) &&
    typeof value.appendEventRecords === "function" &&
    typeof value.readEventRecords === "function"
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isSaveSlotManifestEntry(value: unknown): value is SaveSlotManifestEntry {
  return (
    isRecord(value) &&
    typeof value.storageKey === "string" &&
    STORAGE_KEY_PATTERN.test(value.storageKey) &&
    typeof value.snapshotId === "string" &&
    SNAPSHOT_ID_PATTERN.test(value.snapshotId) &&
    isNonEmptyString(value.stateId) &&
    isPositiveInteger(value.revision) &&
    isNonEmptyString(value.schemaId) &&
    isPositiveInteger(value.schemaVersion) &&
    typeof value.contentPackageId === "string" &&
    PACKAGE_ID_PATTERN.test(value.contentPackageId)
  );
}

function createRecordMetadata(
  adapterKind: SaveSlotManifestStorageAdapter["kind"],
  persistent: boolean,
  storageKey: string,
  revision: number
) {
  return {
    deterministic: true as const,
    adapterKind,
    persistent,
    storageKey,
    eventId: toEventId(storageKey, revision),
    schemaId: SAVE_SLOT_MANIFEST_SCHEMA_ID,
    schemaVersion: SAVE_SLOT_MANIFEST_SCHEMA_VERSION
  };
}

function createLoadMetadata(
  adapterKind: SaveSlotManifestStorageAdapter["kind"],
  persistent: boolean
) {
  return {
    deterministic: true as const,
    adapterKind,
    persistent,
    schemaId: SAVE_SLOT_MANIFEST_SCHEMA_ID,
    schemaVersion: SAVE_SLOT_MANIFEST_SCHEMA_VERSION
  };
}

function createManifest(entries: readonly SaveSlotManifestEntry[]): SaveSlotManifest {
  return {
    schemaId: SAVE_SLOT_MANIFEST_SCHEMA_ID,
    schemaVersion: SAVE_SLOT_MANIFEST_SCHEMA_VERSION,
    entries: Object.freeze(entries.map((entry) => cloneValue(entry))),
    metadata: {
      deterministic: true,
      runtimeVersion: SAVE_SLOT_MANIFEST_RUNTIME_VERSION
    }
  };
}

function toEventId(storageKey: string, revision: number): string {
  return `save-slot.manifest.${storageKey}.r${String(revision)}`;
}

function createEventEnvelope(
  storage: SaveSlotManifestStorageAdapter,
  entry: SaveSlotManifestEntry
): PersistenceEventEnvelope {
  const eventRecord: PersistenceEventRecord = {
    eventId: toEventId(entry.storageKey, entry.revision),
    eventType: SAVE_SLOT_EVENT_TYPE,
    sourceCommandId: SAVE_SLOT_SOURCE_COMMAND_ID,
    transactionId: SAVE_SLOT_TRANSACTION_ID,
    revision: entry.revision,
    schemaVersion: SAVE_SLOT_MANIFEST_SCHEMA_VERSION,
    payload: {
      schemaId: SAVE_SLOT_MANIFEST_SCHEMA_ID,
      schemaVersion: SAVE_SLOT_MANIFEST_SCHEMA_VERSION,
      entry: cloneValue(entry)
    },
    metadata: {
      deterministic: true,
      persistence: storage.kind === "memory" ? "memory" : "future-storage",
      source: "event-store",
      createdAtPolicy: "logical",
      runtimeVersion: SAVE_SLOT_MANIFEST_RUNTIME_VERSION,
      contentPackageId: SAVE_SLOT_MANIFEST_CONTENT_PACKAGE_ID,
      idempotencyKey: `${SAVE_SLOT_IDEMPOTENCY_PREFIX}:${entry.storageKey}:r${String(entry.revision)}`
    }
  };

  return {
    records: Object.freeze([eventRecord]),
    metadata: {
      deterministic: true,
      persistence: storage.kind === "memory" ? "memory" : "future-storage",
      source: "event-store",
      batchId: `${SAVE_SLOT_BATCH_ID_PREFIX}.${entry.storageKey}.r${String(entry.revision)}`
    }
  };
}

function isManifestPayload(value: unknown): value is { readonly schemaId: string; readonly schemaVersion: number; readonly entry: SaveSlotManifestEntry } {
  return (
    isRecord(value) &&
    value.schemaId === SAVE_SLOT_MANIFEST_SCHEMA_ID &&
    value.schemaVersion === SAVE_SLOT_MANIFEST_SCHEMA_VERSION &&
    isSaveSlotManifestEntry(value.entry)
  );
}

function isManifestRecord(record: PersistenceEventRecord): boolean {
  return (
    record.eventType === SAVE_SLOT_EVENT_TYPE &&
    record.sourceCommandId === SAVE_SLOT_SOURCE_COMMAND_ID &&
    record.metadata.contentPackageId === SAVE_SLOT_MANIFEST_CONTENT_PACKAGE_ID
  );
}

function buildEntries(records: readonly PersistenceEventRecord[]): {
  readonly entries?: readonly SaveSlotManifestEntry[];
  readonly diagnostics: readonly StorageAdapterDiagnostic[];
} {
  const diagnostics: StorageAdapterDiagnostic[] = [];
  const entries = new Map<string, SaveSlotManifestEntry>();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record === undefined || !isManifestRecord(record)) {
      continue;
    }
    if (!isManifestPayload(record.payload)) {
      diagnostics.push(
        createDiagnostic(
          "SAVE_SLOT_MANIFEST_RECORD_INVALID",
          ["eventEnvelope", "records", index, "payload"],
          "save slot manifest record payload is invalid."
        )
      );
      continue;
    }
    entries.set(record.payload.entry.storageKey, cloneValue(record.payload.entry));
  }

  if (diagnostics.length > 0) {
    return { diagnostics };
  }

  return {
    entries: Object.freeze(
      [...entries.values()].sort((left, right) => left.storageKey.localeCompare(right.storageKey))
    ),
    diagnostics: Object.freeze([])
  };
}

export function inspectRecordSaveSlotInput(value: unknown): readonly StorageAdapterDiagnostic[] {
  const diagnostics: StorageAdapterDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("SAVE_SLOT_MANIFEST_INPUT_INVALID", [], "recordSaveSlot input must be an object."));
    return diagnostics;
  }
  if (!isManifestStorageAdapter(value.storage)) {
    diagnostics.push(createDiagnostic("SAVE_SLOT_MANIFEST_STORAGE_ADAPTER_INVALID", ["storage"], "storage adapter is invalid."));
  }
  if (!isSaveSlotManifestEntry(value.entry)) {
    diagnostics.push(createDiagnostic("SAVE_SLOT_MANIFEST_ENTRY_INVALID", ["entry"], "save slot manifest entry is invalid."));
  }
  return diagnostics;
}

export function inspectLoadSaveSlotManifestInput(value: unknown): readonly StorageAdapterDiagnostic[] {
  const diagnostics: StorageAdapterDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("SAVE_SLOT_MANIFEST_INPUT_INVALID", [], "loadSaveSlotManifest input must be an object."));
    return diagnostics;
  }
  if (!isManifestStorageAdapter(value.storage)) {
    diagnostics.push(createDiagnostic("SAVE_SLOT_MANIFEST_STORAGE_ADAPTER_INVALID", ["storage"], "storage adapter is invalid."));
  }
  return diagnostics;
}

export async function recordSaveSlot(input: RecordSaveSlotInput): Promise<RecordSaveSlotResult> {
  const diagnostics = inspectRecordSaveSlotInput(input);
  const fallbackStorageKey = isRecord(input) && isRecord(input.entry) && typeof input.entry.storageKey === "string"
    ? input.entry.storageKey
    : "invalid-storage-key";
  const fallbackRevision = isRecord(input) && isRecord(input.entry) && typeof input.entry.revision === "number"
    ? input.entry.revision
    : 1;
  const metadata = createRecordMetadata(
    isManifestStorageAdapter(input.storage) ? input.storage.kind : "memory",
    isManifestStorageAdapter(input.storage) ? input.storage.persistent : false,
    fallbackStorageKey,
    fallbackRevision
  );
  if (diagnostics.length > 0) {
    return {
      status: "rejected",
      diagnostics,
      metadata
    };
  }

  const envelope = createEventEnvelope(input.storage, input.entry);
  const storageResult = await input.storage.appendEventRecords({
    adapterKind: input.storage.kind,
    expectedSchemaVersion: input.storage.schemaVersion,
    envelope
  });

  if (storageResult.status === "completed") {
    return {
      status: "recorded",
      diagnostics: storageResult.diagnostics,
      metadata,
      manifest: createManifest([input.entry]),
      entry: cloneValue(input.entry),
      storageResult
    };
  }

  return {
    status: storageResult.status === "rejected" ? "rejected" : "error",
    diagnostics: storageResult.diagnostics,
    metadata,
    entry: cloneValue(input.entry),
    storageResult
  };
}

export async function loadSaveSlotManifest(input: LoadSaveSlotManifestInput): Promise<LoadSaveSlotManifestResult> {
  const diagnostics = inspectLoadSaveSlotManifestInput(input);
  const metadata = createLoadMetadata(
    isManifestStorageAdapter(input.storage) ? input.storage.kind : "memory",
    isManifestStorageAdapter(input.storage) ? input.storage.persistent : false
  );
  if (diagnostics.length > 0) {
    return {
      status: "rejected",
      diagnostics,
      metadata
    };
  }

  const storageResult = await input.storage.readEventRecords({
    adapterKind: input.storage.kind
  });

  if (storageResult.status === "rejected") {
    return {
      status: "rejected",
      diagnostics: storageResult.diagnostics,
      metadata,
      storageResult
    };
  }
  if (storageResult.status !== "completed") {
    return {
      status: "error",
      diagnostics: storageResult.diagnostics,
      metadata,
      storageResult
    };
  }

  const records = storageResult.eventEnvelope?.records;
  if (records === undefined) {
    return {
      status: "error",
      diagnostics: [createDiagnostic("SAVE_SLOT_MANIFEST_LOAD_RESULT_INVALID", ["eventEnvelope"], "storage adapter did not return an event envelope.")],
      metadata,
      storageResult
    };
  }

  const buildResult = buildEntries(records);
  if (buildResult.diagnostics.length > 0 || buildResult.entries === undefined) {
    return {
      status: "error",
      diagnostics: buildResult.diagnostics,
      metadata,
      storageResult
    };
  }

  return {
    status: "loaded",
    diagnostics: storageResult.diagnostics,
    metadata,
    manifest: createManifest(buildResult.entries),
    storageResult
  };
}

export async function listSaveSlots(input: LoadSaveSlotManifestInput): Promise<LoadSaveSlotManifestResult> {
  return loadSaveSlotManifest(input);
}

