

import {
  createPersistenceResult,
  inspectPersistenceSnapshotRecord,
  type PersistenceDiagnostic,
  type PersistenceLoadSnapshotInput,
  type PersistenceResult,
  type PersistenceSnapshotEnvelope,
  type PersistenceSnapshotRecord,
  type PersistenceSaveSnapshotInput
} from "@narrative-engine/engine-contracts";

export type InMemorySaveSnapshotStore = {
  saveSnapshot: (input: PersistenceSaveSnapshotInput) => PersistenceResult;
  loadSnapshot: (input: PersistenceLoadSnapshotInput) => PersistenceResult;
  listSnapshots: () => readonly PersistenceSnapshotRecord[];
};

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneSnapshot(snapshot: PersistenceSnapshotRecord): PersistenceSnapshotRecord {
  return cloneValue(snapshot);
}

function createEnvelope(snapshots: readonly PersistenceSnapshotRecord[]): PersistenceSnapshotEnvelope {
  return {
    snapshots: Object.freeze(snapshots.map((snapshot) => cloneSnapshot(snapshot))),
    metadata: {
      deterministic: true,
      persistence: "memory",
      source: "save-snapshot-store"
    }
  };
}

function createSnapshotIdDiagnostic(
  snapshotId: string | undefined,
  path: readonly (string | number)[] = ["snapshotId"]
): PersistenceDiagnostic {
  return {
    code: "PERSISTENCE_SNAPSHOT_ID_INVALID",
    path: [...path],
    message:
      snapshotId === undefined || snapshotId.length === 0
        ? "snapshotId is required."
        : "snapshotId is invalid or unknown."
  };
}

export function saveSnapshot(store: InMemorySaveSnapshotStore, input: PersistenceSaveSnapshotInput): PersistenceResult {
  return store.saveSnapshot(input);
}

export function loadSnapshot(store: InMemorySaveSnapshotStore, input: PersistenceLoadSnapshotInput): PersistenceResult {
  return store.loadSnapshot(input);
}

export function listSnapshots(store: InMemorySaveSnapshotStore): readonly PersistenceSnapshotRecord[] {
  return store.listSnapshots();
}

export function createInMemorySaveSnapshotStore(
  initialSnapshots: readonly PersistenceSnapshotRecord[] = []
): InMemorySaveSnapshotStore {
  const snapshots = new Map<string, PersistenceSnapshotRecord>();
  const order: string[] = [];

  for (let index = 0; index < initialSnapshots.length; index += 1) {
    const snapshot = cloneSnapshot(initialSnapshots[index] as PersistenceSnapshotRecord);
    const diagnostics = inspectPersistenceSnapshotRecord(snapshot);
    if (diagnostics.length > 0) {
      throw new Error(diagnostics[0]?.message ?? "Initial snapshot is invalid.");
    }
    snapshots.set(snapshot.snapshotId, snapshot);
    order.push(snapshot.snapshotId);
  }

  return {
    saveSnapshot(input: PersistenceSaveSnapshotInput): PersistenceResult {
      const snapshot = cloneSnapshot(input.snapshot);
      const diagnostics = inspectPersistenceSnapshotRecord(snapshot);
      if (diagnostics.length > 0) {
        return createPersistenceResult({
          status: "rejected",
          diagnostics,
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "save-snapshot-store",
            operation: "save-snapshot"
          }
        });
      }

      const existing = snapshots.get(snapshot.snapshotId);
      if (existing !== undefined) {
        if (JSON.stringify(existing.state) === JSON.stringify(snapshot.state) && JSON.stringify(existing) === JSON.stringify(snapshot)) {
          return createPersistenceResult({
            status: "saved",
            diagnostics: [
              {
                code: "PERSISTENCE_SNAPSHOT_DUPLICATE_EXISTING",
                path: ["snapshot", "snapshotId"],
                message: `snapshotId "${snapshot.snapshotId}" already exists with identical canonical content.`
              }
            ],
            metadata: {
              deterministic: true,
              persistence: "memory",
              source: "save-snapshot-store",
              operation: "save-snapshot",
              idempotent: true,
              snapshotId: snapshot.snapshotId
            },
            snapshot: cloneSnapshot(existing),
            snapshotEnvelope: createEnvelope([existing])
          });
        }

        return createPersistenceResult({
          status: "rejected",
          diagnostics: [
            {
              code: "PERSISTENCE_SNAPSHOT_DUPLICATE_CONFLICT",
              path: ["snapshot", "snapshotId"],
              message: `snapshotId "${snapshot.snapshotId}" already exists with conflicting canonical content.`
            }
          ],
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "save-snapshot-store",
            operation: "save-snapshot",
            snapshotId: snapshot.snapshotId
          }
        });
      }

      snapshots.set(snapshot.snapshotId, cloneSnapshot(snapshot));
      order.push(snapshot.snapshotId);

      return createPersistenceResult({
        status: "saved",
        diagnostics: [],
        metadata: {
          deterministic: true,
          persistence: "memory",
          source: "save-snapshot-store",
          operation: "save-snapshot",
          snapshotId: snapshot.snapshotId
        },
        snapshot,
        snapshotEnvelope: createEnvelope([snapshot])
      });
    },

    loadSnapshot(input: PersistenceLoadSnapshotInput): PersistenceResult {
      if (typeof input.snapshotId !== "string" || input.snapshotId.trim().length === 0) {
        return createPersistenceResult({
          status: "rejected",
          diagnostics: [createSnapshotIdDiagnostic(undefined)],
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "save-snapshot-store",
            operation: "load-snapshot"
          }
        });
      }

      const snapshot = snapshots.get(input.snapshotId);
      if (snapshot === undefined) {
        return createPersistenceResult({
          status: "rejected",
          diagnostics: [createSnapshotIdDiagnostic(input.snapshotId)],
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "save-snapshot-store",
            operation: "load-snapshot",
            snapshotId: input.snapshotId
          }
        });
      }

      return createPersistenceResult({
        status: "loaded",
        diagnostics: [],
        metadata: {
          deterministic: true,
          persistence: "memory",
          source: "save-snapshot-store",
          operation: "load-snapshot",
          snapshotId: input.snapshotId
        },
        snapshot,
        snapshotEnvelope: createEnvelope([snapshot])
      });
    },

    listSnapshots(): readonly PersistenceSnapshotRecord[] {
      return Object.freeze(
        order
          .map((snapshotId) => snapshots.get(snapshotId))
          .filter((snapshot): snapshot is PersistenceSnapshotRecord => snapshot !== undefined)
          .map((snapshot) => cloneSnapshot(snapshot))
      );
    }
  };
}
