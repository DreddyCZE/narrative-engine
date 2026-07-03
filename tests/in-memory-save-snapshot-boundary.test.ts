import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { ENGINE_STATE_CONTRACT_VERSION, type PersistenceSnapshotRecord } from "../packages/engine-contracts/src/index.js";
import {
  createInMemorySaveSnapshotStore,
  listSnapshots,
  loadSnapshot,
  saveSnapshot
} from "../packages/engine-kernel/src/index.js";

function makeSnapshot(): PersistenceSnapshotRecord {
  return {
    snapshotId: "snapshot.demo.slot-1",
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
}

describe("in-memory save snapshot boundary", () => {
  it("saves and loads valid snapshots without mutating input or returned values", () => {
    const store = createInMemorySaveSnapshotStore();
    const snapshot = makeSnapshot();
    const beforeInput = canonicalizeJson(snapshot);

    const saved = saveSnapshot(store, { snapshot });
    const loaded = loadSnapshot(store, { snapshotId: snapshot.snapshotId });

    expect(saved.status).toBe("saved");
    expect(loaded.status).toBe("loaded");
    expect(loaded.snapshot).toEqual(snapshot);
    expect(listSnapshots(store)).toEqual([snapshot]);
    expect(canonicalizeJson(snapshot)).toBe(beforeInput);

    if (loaded.snapshot !== undefined) {
      (loaded.snapshot.state.run.domains as unknown as Array<unknown>).push({ broken: true });
    }

    expect(listSnapshots(store)).toEqual([snapshot]);
  });

  it("returns idempotent saved result for identical duplicate snapshots", () => {
    const store = createInMemorySaveSnapshotStore();
    const snapshot = makeSnapshot();

    saveSnapshot(store, { snapshot });
    const result = saveSnapshot(store, { snapshot });

    expect(result.status).toBe("saved");
    expect(result.metadata.idempotent).toBe(true);
    expect(listSnapshots(store)).toHaveLength(1);
  });

  it("rejects conflicting duplicate snapshot ids and invalid loads", () => {
    const store = createInMemorySaveSnapshotStore();
    const snapshot = makeSnapshot();
    saveSnapshot(store, { snapshot });

    const conflicting: PersistenceSnapshotRecord = {
      ...snapshot,
      revision: 9,
      state: {
        ...snapshot.state,
        revision: 9
      }
    };

    const rejectedSave = saveSnapshot(store, { snapshot: conflicting });
    const rejectedLoad = loadSnapshot(store, { snapshotId: "" });

    expect(rejectedSave.status).toBe("rejected");
    expect(rejectedSave.diagnostics.map((diagnostic) => diagnostic.code)).toContain("PERSISTENCE_SNAPSHOT_DUPLICATE_CONFLICT");
    expect(rejectedLoad.status).toBe("rejected");
    expect(rejectedLoad.diagnostics.map((diagnostic) => diagnostic.code)).toContain("PERSISTENCE_SNAPSHOT_ID_INVALID");
  });

  it("rejects invalid snapshot envelopes before save", () => {
    const store = createInMemorySaveSnapshotStore();
    const snapshot = makeSnapshot();
    const invalid: PersistenceSnapshotRecord = {
      ...snapshot,
      snapshotId: "bad"
    };

    const result = saveSnapshot(store, { snapshot: invalid });

    expect(result.status).toBe("rejected");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("PERSISTENCE_SNAPSHOT_RECORD_INVALID");
    expect(listSnapshots(store)).toEqual([]);
  });

  it("keeps the production save snapshot boundary free of file IO, DB, and external storage", () => {
    const source = readFileSync("packages/engine-kernel/src/persistence/in-memory-save-snapshot-store.ts", "utf8");

    expect(source).not.toMatch(/readFileSync|writeFileSync|appendFileSync|node:fs|fetch\(/u);
    expect(source).not.toContain("database adapter");
    expect(source).not.toContain("external storage");
    expect(source).not.toContain("replay runtime behavior");
  });
});
